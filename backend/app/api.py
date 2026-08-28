"""
App API - thin facade over core services.
Replaces monolithic Api class in main.py with modular, organized version.
Preserves same public method names so frontend JS continues to work.
"""
import os
import sys
import getpass
import tempfile
import shutil
import glob
import json
import fitz  # PyMuPDF
import webview

from pathlib import Path

from ..core.config import ConfigManager
from ..core.projects import ProjectManager
from ..core.pdf import PDFProcessor, extract_pdf_range
from ..core.ocr.service import OCRService
from ..core.ocr.paddle import PaddleOCRClient
from ..core.ocr.google_lens import GoogleLensOCR
from ..core.ocr.locro import run_locro_ocr
from ..core.ocr.llm import LLMOCRHandler
from ..core.text import ArabicTextCleaner
from ..core.quran import QuranHandler
from ..table.handler import TableHandler
from ..export import export_json, export_txt, export_docx, export_html, export_epub3
from ..collab.discovery import LANDiscovery
from ..collab.sync import LANSyncServer, LANSyncClient
from ..utils.retriever import populate_layout_blocks_text
from ..post_processing import PostProcessingManager
from ..preprocessing import PreprocessingEngine, BatchPreprocessingWorker
from .events import EventEmitter


def cleanup_old_residue():
    temp_dir = tempfile.gettempdir()
    patterns = ['paddleocr_*', 'glens_ocr_*', 'llm_ocr_*', 'locro_ocr_*']
    for pattern in patterns:
        for path in glob.glob(os.path.join(temp_dir, pattern)):
            try:
                shutil.rmtree(path, ignore_errors=True)
            except Exception:
                pass


class Api:
    def __init__(self):
        self.config_manager = ConfigManager()
        self.config_manager.auto_migrate_legacy_data()

        projects_dir = os.path.join(self.config_manager.get_data_path(), 'projects')
        self.project_manager = ProjectManager(projects_dir=projects_dir)
        self.pdf_processor = PDFProcessor()
        self.ocr_service = OCRService()
        self._window = None

        self.lan_discovery = LANDiscovery()
        self.lan_server = None
        self.lan_client = None

        self.username = getpass.getuser()
        self.table_handler = TableHandler(self.project_manager)

        if hasattr(sys, '_MEIPASS'):
            quran_path = os.path.join(sys._MEIPASS, 'data', 'Quran.json')
        else:
            quran_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'data', 'Quran.json')
            if not os.path.exists(quran_path):
                quran_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'data', 'Quran.json')
        self.quran_handler = QuranHandler(json_path=quran_path)
        self.preprocessing_engine = PreprocessingEngine(self.project_manager)
        self.preprocessing_worker = None

        self.events = EventEmitter(lambda: self._window)

    # --- window binding ---
    def set_window(self, window):
        self._window = window
        if hasattr(window, 'shown') and hasattr(window.shown, 'set'):
            window.shown.set()

    # --- dialogs ---
    def select_pdf(self):
        result = self._window.create_file_dialog(
            webview.FileDialog.OPEN,
            allow_multiple=False,
            file_types=('PDF files (*.pdf)', 'All files (*.*)')
        )
        return result[0] if result else None

    def select_ocr_json(self):
        result = self._window.create_file_dialog(
            webview.FileDialog.OPEN,
            allow_multiple=False,
            file_types=('JSON files (*.json)', 'All files (*.*)')
        )
        return result[0] if result else None

    def request_directory_dialog(self):
        result = self._window.create_file_dialog(webview.FileDialog.FOLDER)
        return result[0] if result else None

    # --- project lifecycle ---
    def create_project(self, metadata, pdf_path):
        lan_password = metadata.pop('lan_password', None)
        metadata['owner'] = self.username
        metadata['lan_enabled'] = bool(metadata.get('lan_enabled', False))
        metadata['lan_broadcasting'] = bool(metadata.get('lan_broadcasting', False))
        metadata['cloud_broadcasting'] = bool(metadata.get('cloud_broadcasting', False))
        if metadata['lan_enabled'] and lan_password:
            metadata['lan_password_hash'] = ProjectManager.hash_password(lan_password)

        project = self.project_manager.create_project(metadata)
        project_id = project['id']

        self.events.pdf_progress('hashing', 0, 0)
        hashes = self.pdf_processor.get_pdf_hashes(pdf_path)
        project['pdf_path'] = pdf_path
        project['pdf_hash'] = hashes['sha256']
        project['pdf_hashes'] = hashes

        output_dir = os.path.join(self.project_manager.projects_dir, project_id, 'images')

        def on_progress(current, total):
            self.events.pdf_progress('rendering', current, total)

        pages = self.pdf_processor.process_pdf(pdf_path, output_dir, progress_callback=on_progress)
        project['pages'] = pages

        self.project_manager.update_project(project_id, project)
        if metadata['lan_enabled']:
            try:
                self.start_lan_sharing(project_id, lan_password=lan_password)
            except Exception:
                pass
        self.events.pdf_progress('done', len(pages), len(pages))
        return project

    def load_project(self, project_id):
        # Ensure any missing thumbnails exist on disk (e.g. for split sub-pages)
        try:
            self.project_manager.ensure_project_thumbnails(project_id)
        except Exception:
            pass
        # Review page needs all OCR data hydrated from per-page files
        return self.project_manager.load_project_with_ocr(project_id)

    def get_projects(self):
        return self.project_manager.list_projects()

    def delete_project(self, project_id, delete_files=True):
        return self.project_manager.delete_project(project_id, delete_files=delete_files)

    def delete_page(self, project_id, page_index, delete_files=False):
        return self.project_manager.delete_page(project_id, page_index, delete_files=delete_files)

    def delete_project_page(self, project_id, page_index, delete_files=False):
        return self.delete_page(project_id, page_index, delete_files=delete_files)

    def update_project(self, project_id, project_data):
        self.project_manager.update_project(project_id, project_data)
        return {"ok": True}

    def update_page_ocr(self, project_id, page_index, ocr_data, status=None):
        # Fast load — we only need page status, not all OCR text across the project
        project = self.project_manager.load_project(project_id)
        if project and 0 <= page_index < len(project.get('pages', [])):
            project['pages'][page_index]['ocr_data'] = ocr_data
            if status is not None:
                project['pages'][page_index]['status'] = status
            else:
                if ocr_data and all(b.get('category') == 'Picture' or b.get('reviewed') for b in ocr_data):
                    project['pages'][page_index]['status'] = 'reviewed'
                elif project['pages'][page_index].get('status') == 'reviewed':
                    project['pages'][page_index]['status'] = 'pending'
            self.project_manager.update_project(project_id, project)
            self.broadcast_page_update(project_id, page_index, ocr_data)
        return True

    def update_project_metadata(self, project_id, new_metadata):
        try:
            project = self.project_manager.load_project(project_id)
            if 'metadata' not in project:
                project['metadata'] = {}
            project['metadata'].update(new_metadata)
            self.project_manager.update_project(project_id, project)
            return {'ok': True}
        except Exception as e:
            print(f"[Api] update metadata failed: {e}")
            return {'ok': False, 'error': str(e)}

    def reapply_text_processing_to_project(self, project_id):
        try:
            # Full load required — we iterate and mutate every page's OCR text
            project = self.project_manager.load_project_with_ocr(project_id)
            if not project:
                return {'ok': False, 'error': 'المشروع غير موجود.'}
            meta = project.get('metadata', {})
            text_config = meta.get('text_features', {})
            cat_fmt_map = meta.get('category_formatting', {})
            cleaner = ArabicTextCleaner(text_config)

            updated_count = 0
            for page in project.get('pages', []):
                ocr_data = page.get('ocr_data', [])
                if not ocr_data:
                    continue
                for el in ocr_data:
                    cat = el.get('category', 'Text')
                    if cat != 'Picture':
                        if el.get('text'):
                            el['text'] = cleaner.clean(el['text'])
                        fmt = cat_fmt_map.get(cat, {})
                        if fmt:
                            if fmt.get('dir') and not el.get('dir'):
                                el['dir'] = fmt['dir']
                            if fmt.get('align') and not el.get('align'):
                                el['align'] = fmt['align']
                        if (cat == 'Table' or cat == 'Vertical-poetry') and 'table_structure' in el:
                            cells = el['table_structure'].get('cells', [])
                            for c in cells:
                                if c.get('text'):
                                    c['text'] = cleaner.clean(c['text'])
                updated_count += 1

            self.project_manager.update_project(project_id, project)
            return {'ok': True, 'count': updated_count}
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {'ok': False, 'error': str(e)}



    def apply_project_settings_changes(self, project_id, apply_scope="unreviewed"):
        if apply_scope == "none":
            return {'ok': True, 'count': 0}
            
        try:
            # 1. Reapply Text Processing — full OCR load needed to iterate all page text
            project = self.project_manager.load_project_with_ocr(project_id)

            if not project:
                return {'ok': False, 'error': 'المشروع غير موجود.'}
                
            meta = project.get('metadata', {})
            text_config = meta.get('text_features', {})
            cat_fmt_map = meta.get('category_formatting', {})
            cleaner = ArabicTextCleaner(text_config)

            for page in project.get('pages', []):
                ocr_data = page.get('ocr_data', [])
                if not ocr_data:
                    continue
                    
                if apply_scope == "unreviewed":
                    all_reviewed = all(b.get('reviewed') for b in ocr_data if b.get('text'))
                    if all_reviewed and ocr_data:
                        continue

                for el in ocr_data:
                    cat = el.get('category', 'Text')
                    if cat != 'Picture':
                        if el.get('text'):
                            el['text'] = cleaner.clean(el['text'])
                        fmt = cat_fmt_map.get(cat, {})
                        if fmt:
                            if fmt.get('dir') and not el.get('dir'):
                                el['dir'] = fmt['dir']
                            if fmt.get('align') and not el.get('align'):
                                el['align'] = fmt['align']
                        if (cat == 'Table' or cat == 'Vertical-poetry') and 'table_structure' in el:
                            cells = el['table_structure'].get('cells', [])
                            for c in cells:
                                if c.get('text'):
                                    c['text'] = cleaner.clean(c['text'])
                                    
            self.project_manager.update_project(project_id, project)
            
            # 2. Run post processing
            only_unreviewed = (apply_scope == "unreviewed")
            res_pp = self.run_post_processing_to_project(project_id, only_unreviewed=only_unreviewed)
            if not res_pp.get('ok'):
                return res_pp
                
            return {'ok': True, 'count': 1}
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {'ok': False, 'error': str(e)}

    # --- OCR unified cleaning helper ---
    def _apply_cleaning_to_elements(self, elements, text_config, page_data, engine_dpi=200.0, category_formatting=None, post_processing=None):
        return self.ocr_service.clean_existing_elements(
            elements, page_data, engine_dpi=engine_dpi, text_config=text_config, category_formatting=category_formatting, post_processing=post_processing
        )

    def _emit_paddle_progress(self, stage, message, percentage=0):
        self.events.ocr_progress(stage, message, percentage)

    # --- OCR engines ---
    def get_paddle_limits(self):
        client = PaddleOCRClient(data_dir=self.project_manager.projects_dir)
        return client.get_limits()

    def _create_pdf_from_project_pages(self, project_id: str, pages_subset: list, out_pdf_path: str, fallback_doc=None):
        """
        Build a temporary PDF chunk for PaddleOCR using the exact working/preprocessed page images.
        """
        project_dir = os.path.join(self.project_manager.projects_dir, project_id)
        doc = fitz.open()

        for page_data in pages_subset:
            img_rel = page_data.get('image_path')
            img_full = os.path.join(project_dir, 'images', img_rel) if img_rel else ''

            if img_full and os.path.exists(img_full):
                try:
                    img_doc = fitz.open(img_full)
                    rect = img_doc[0].rect
                    pdf_bytes = img_doc.convert_to_pdf()
                    img_pdf = fitz.open("pdf", pdf_bytes)
                    page = doc.new_page(width=rect.width, height=rect.height)
                    page.show_pdf_page(rect, img_pdf, 0)
                    img_doc.close()
                    img_pdf.close()
                    continue
                except Exception as e:
                    print(f"[_create_pdf_from_project_pages] Error converting {img_full}: {e}")

            # Fallback to pristine PDF page if image raster failed
            if fallback_doc is not None:
                pdf_idx = page_data.get('pdf_index', 0)
                if 0 <= pdf_idx < len(fallback_doc):
                    doc.insert_pdf(fallback_doc, from_page=pdf_idx, to_page=pdf_idx)
        doc.save(out_pdf_path)
        doc.close()

    def trigger_paddle_ocr(self, project_id, start_idx, end_idx, page_indices=None):
        project = self.project_manager.load_project(project_id)
        meta = project.get('metadata', {}) if project else {}
        text_config = meta.get('text_features', {})
        cat_fmt = meta.get('category_formatting', {})
        post_proc = meta.get('post_processing', {})

        if not project:
            return {'ok': False, 'error': 'المشروع غير موجود.'}

        paddle_client = PaddleOCRClient(data_dir=self.project_manager.projects_dir)
        if paddle_client.get_limits() <= 0:
            return {'ok': False, 'error': 'لقد استنفدت الحد اليومي المجاني.'}

        pdf_path = project.get('pdf_path')
        fallback_doc = fitz.open(pdf_path) if (pdf_path and os.path.exists(pdf_path)) else None

        if page_indices is not None and isinstance(page_indices, list) and len(page_indices) > 0:
            indices_to_process = [int(i) for i in page_indices if 0 <= int(i) < len(project['pages'])]
        else:
            indices_to_process = list(range(start_idx, end_idx + 1))

        if not indices_to_process:
            return {'ok': False, 'error': 'لم يتم تحديد صفحات صالحة للمعالجة.'}

        try:
            tmp_dir = tempfile.mkdtemp(prefix='paddleocr_')
            chunk_size = paddle_client.max_pages_per_chunk
            for chunk_offset in range(0, len(indices_to_process), chunk_size):
                chunk_indices = indices_to_process[chunk_offset : chunk_offset + chunk_size]
                first_num = chunk_indices[0] + 1
                last_num = chunk_indices[-1] + 1
                self._emit_paddle_progress('extracting', f"تجهيز الصفحات ({', '.join(str(i+1) for i in chunk_indices)})...")
                tmp_pdf_path = os.path.join(tmp_dir, f"chunk_{chunk_offset}.pdf")

                pages_subset = [project['pages'][i] for i in chunk_indices]
                self._create_pdf_from_project_pages(project_id, pages_subset, tmp_pdf_path, fallback_doc=fallback_doc)

                self._emit_paddle_progress('uploading', f"جاري رفع الدفعة ({first_num}-{last_num})...")
                paddle_client.decrement_limit()
                paddle_pages = paddle_client.process_pdf_chunk(tmp_pdf_path, window=self._window)
                app_formatted_pages = paddle_client.parse_paddle_to_app_format(
                    paddle_pages, project['pages'], chunk_indices[0]
                )
                for i, ocr_data in enumerate(app_formatted_pages):
                    if i < len(chunk_indices):
                        actual_page_index = chunk_indices[i]
                        pg_data = project['pages'][actual_page_index]
                        cleaned_elements = self._apply_cleaning_to_elements(ocr_data, text_config, pg_data, engine_dpi=200.0, category_formatting=cat_fmt, post_processing=post_proc)
                        project['pages'][actual_page_index]['ocr_data'] = cleaned_elements
                        project['pages'][actual_page_index]['status'] = 'pending'
                        self.project_manager.save_raw_ocr(project_id, actual_page_index, cleaned_elements)

                self.project_manager.update_project(project_id, project)

            self._emit_paddle_progress('completed', 'تمت المعالجة بنجاح!', 100)
            return {'ok': True, 'project': project, 'trials_left': paddle_client.get_limits()}

        except Exception as e:
            self._emit_paddle_progress('error', str(e), 0)
            return {'ok': False, 'error': str(e)}
        finally:
            if fallback_doc is not None:
                try:
                    if not fallback_doc.is_closed:
                        fallback_doc.close()
                except Exception:
                    pass
            shutil.rmtree(tmp_dir, ignore_errors=True)

    def trigger_locro_ocr(self, project_id, start_idx, end_idx, mode, page_indices=None):
        project = self.project_manager.load_project(project_id)
        meta = project.get('metadata', {}) if project else {}
        text_config = meta.get('text_features', {})
        cat_fmt = meta.get('category_formatting', {})
        post_proc = meta.get('post_processing', {})
        if not project:
            return {'ok': False, 'error': 'المشروع غير موجود.'}

        pdf_path = project.get('pdf_path')
        doc = fitz.open(pdf_path) if (pdf_path and os.path.exists(pdf_path)) else None
        project_dir = os.path.join(self.project_manager.projects_dir, project_id)

        if page_indices is not None and isinstance(page_indices, list) and len(page_indices) > 0:
            indices_to_process = [int(i) for i in page_indices if 0 <= int(i) < len(project['pages'])]
        else:
            indices_to_process = list(range(start_idx, end_idx + 1))

        if not indices_to_process:
            return {'ok': False, 'error': 'لم يتم تحديد صفحات صالحة للمعالجة.'}

        try:
            tmp_dir = tempfile.mkdtemp(prefix='locro_ocr_')
            total_pages = len(indices_to_process)

            for seq_idx, current_idx in enumerate(indices_to_process):
                page_ui_num = current_idx + 1
                progress_pct = (seq_idx / total_pages) * 100
                self._emit_paddle_progress('extracting', f"جاري المسح عبر Locro Offline لصفحة {page_ui_num}...", progress_pct)

                page_data = project['pages'][current_idx]
                img_rel = page_data.get('image_path')
                img_full = os.path.join(project_dir, 'images', img_rel) if img_rel else ''

                if img_full and os.path.exists(img_full):
                    active_img_path = img_full
                elif doc is not None:
                    pix = doc.load_page(page_data.get('pdf_index', current_idx)).get_pixmap(dpi=300)
                    active_img_path = os.path.join(tmp_dir, f"page_{current_idx}.png")
                    pix.save(active_img_path)
                else:
                    continue

                blocks = run_locro_ocr(active_img_path)

                if mode == 'full_page':
                    cleaned_elements = self._apply_cleaning_to_elements(blocks, text_config, page_data, engine_dpi=300.0, category_formatting=cat_fmt, post_processing=post_proc)
                    project['pages'][current_idx]['ocr_data'] = cleaned_elements
                    project['pages'][current_idx]['status'] = 'pending'
                    self.project_manager.save_raw_ocr(project_id, current_idx, cleaned_elements)
                elif mode == 'bboxes':
                    existing_data = page_data.get('ocr_data', [])
                    if not existing_data:
                        continue
                    native_w = float(page_data.get('native_width', 1))
                    native_h = float(page_data.get('native_height', 1))
                    normalized_locro_blocks = self.ocr_service.handler.standardize_page_blocks(blocks, native_w, native_h, current_dpi=300.0)
                    for b in existing_data:
                        b['text'] = ""
                        b['_temp_lines'] = []
                        if (b.get('category') in ('Table', 'Vertical-poetry', 'Poem')) and 'table_structure' in b:
                            for cell in b['table_structure'].get('cells', []):
                                cell['text'] = ""
                                cell['_ordered_lines'] = []

                    for block in normalized_locro_blocks:
                        for line in block.get('lines', []):
                            table_line_words = {}
                            for word in line.get('words', []):
                                w_geom = word.get('geometry', {})
                                if not w_geom:
                                    continue
                                wx = w_geom['center_x'] * native_w
                                wy = w_geom['center_y'] * native_h
                                for e_block in existing_data:
                                    bx1, by1, bx2, by2 = e_block['bbox']
                                    if (bx1 - 10) <= wx <= (bx2 + 10) and (by1 - 10) <= wy <= (by2 + 10):
                                        if (e_block.get('category') in ('Table', 'Vertical-poetry', 'Poem')) and 'table_structure' in e_block:
                                            b_id = id(e_block)
                                            if b_id not in table_line_words:
                                                table_line_words[b_id] = {id(c): [] for c in e_block['table_structure']['cells']}
                                            for cell in e_block['table_structure']['cells']:
                                                cx1, cy1, cx2, cy2 = cell['bbox']
                                                if (cx1 - 5) <= wx <= (cx2 + 5) and (cy1 - 5) <= wy <= (cy2 + 5):
                                                    table_line_words[b_id][id(cell)].append(word.get('text', ''))
                                                    break
                                        else:
                                            e_block['_temp_lines'].append((wy, line))
                                        break
                            for e_block in existing_data:
                                if (e_block.get('category') in ('Table', 'Vertical-poetry', 'Poem')) and 'table_structure' in e_block:
                                    b_id = id(e_block)
                                    if b_id in table_line_words:
                                        for cell in e_block['table_structure']['cells']:
                                            words_in_cell = table_line_words[b_id].get(id(cell), [])
                                            if words_in_cell:
                                                cell['_ordered_lines'].append(" ".join(words_in_cell))
                    for b in existing_data:
                        if (b.get('category') in ('Table', 'Vertical-poetry', 'Poem')) and 'table_structure' in b:
                            all_cell_texts = []
                            for cell in b['table_structure'].get('cells', []):
                                if '_ordered_lines' in cell:
                                    cell['text'] = "<br>".join(cell['_ordered_lines'])
                                    del cell['_ordered_lines']
                                if cell.get('text'):
                                    all_cell_texts.append(cell['text'])
                            b['text'] = "\n".join(all_cell_texts)
                            b['lines'] = []
                        else:
                            b['_temp_lines'].sort(key=lambda x: x[0])
                            seen_line_ids = set()
                            unique_lines = []
                            for _, line_obj in b['_temp_lines']:
                                line_id = id(line_obj)
                                if line_id not in seen_line_ids:
                                    seen_line_ids.add(line_id)
                                    unique_lines.append(line_obj)
                            b['lines'] = unique_lines
                            b['text'] = "\n".join([line_obj.get('text', '') for line_obj in b['lines']])
                            del b['_temp_lines']

                    table_structures_backup = {i: (b['table_structure'], b.get('category', 'Table')) for i, b in enumerate(existing_data) if 'table_structure' in b}
                    cleaned_elements = self._apply_cleaning_to_elements(existing_data, text_config, page_data, engine_dpi=72.0)
                    for idx, (ts, orig_cat) in table_structures_backup.items():
                        if idx < len(cleaned_elements):
                            cleaned_elements[idx]['table_structure'] = ts
                            cleaned_elements[idx]['category'] = orig_cat or 'Table'
                    project['pages'][current_idx]['ocr_data'] = cleaned_elements
                    self.project_manager.save_raw_ocr(project_id, current_idx, cleaned_elements)

                if (seq_idx + 1) % 10 == 0:
                    self.project_manager.update_project(project_id, project)

            self.project_manager.update_project(project_id, project)
            self._emit_paddle_progress('completed', 'تمت المعالجة عبر Locro بنجاح!', 100)
            return {'ok': True, 'project': project}

        except Exception as e:
            self._emit_paddle_progress('error', str(e), 0)
            return {'ok': False, 'error': str(e)}
        finally:
            if doc is not None:
                try:
                    if not doc.is_closed:
                        doc.close()
                except Exception:
                    pass
            if 'tmp_dir' in locals() and os.path.exists(tmp_dir):
                shutil.rmtree(tmp_dir, ignore_errors=True)

    def trigger_google_lens_ocr(self, project_id, start_idx, end_idx, mode, page_indices=None):
        project = self.project_manager.load_project(project_id)
        meta = project.get('metadata', {}) if project else {}
        text_config = meta.get('text_features', {})
        cat_fmt = meta.get('category_formatting', {})
        post_proc = meta.get('post_processing', {})
        if not project:
            return {'ok': False, 'error': 'المشروع غير موجود.'}

        pdf_path = project.get('pdf_path')
        doc = fitz.open(pdf_path) if (pdf_path and os.path.exists(pdf_path)) else None
        project_dir = os.path.join(self.project_manager.projects_dir, project_id)

        if page_indices is not None and isinstance(page_indices, list) and len(page_indices) > 0:
            indices_to_process = [int(i) for i in page_indices if 0 <= int(i) < len(project['pages'])]
        else:
            indices_to_process = list(range(start_idx, end_idx + 1))

        if not indices_to_process:
            return {'ok': False, 'error': 'لم يتم تحديد صفحات صالحة للمعالجة.'}

        try:
            glens = GoogleLensOCR(max_workers=3)
            tmp_dir = tempfile.mkdtemp(prefix='glens_ocr_')
            total_pages = len(indices_to_process)

            for seq_idx, current_idx in enumerate(indices_to_process):
                page_ui_num = current_idx + 1
                progress_pct = (seq_idx / total_pages) * 100
                self._emit_paddle_progress('extracting', f"تجهيز صفحة {page_ui_num}...", progress_pct)

                page_data = project['pages'][current_idx]
                img_rel = page_data.get('image_path')
                img_full = os.path.join(project_dir, 'images', img_rel) if img_rel else ''

                if img_full and os.path.exists(img_full):
                    active_img_path = img_full
                elif doc is not None:
                    pix = doc.load_page(page_data.get('pdf_index', current_idx)).get_pixmap(dpi=300)
                    active_img_path = os.path.join(tmp_dir, f"page_{current_idx}.png")
                    pix.save(active_img_path)
                else:
                    continue

                page_data = project['pages'][current_idx]
                self._emit_paddle_progress('uploading', f"جاري المسح عبر Google Lens لصفحة {page_ui_num}...", progress_pct + 10)

                results = glens.extract_batch([Path(active_img_path)])

                if not results or not results[0].get('success'):
                    continue
                detailed_blocks = results[0].get('detailed_blocks', [])

                if mode == 'full_page':
                    new_ocr_data = []
                    for block in detailed_blocks:
                        geom = block.get('geometry', {})
                        if not geom:
                            continue
                        lines_text = [line.get('text', '') for line in block.get('lines', [])]
                        block['text'] = "\n".join(lines_text)
                        block['category'] = "Text"
                        block['reviewed'] = False
                        block['dir'] = "rtl"
                        block['align'] = "right"
                        new_ocr_data.append(block)

                    cleaned_data = self._apply_cleaning_to_elements(new_ocr_data, text_config, page_data, engine_dpi=200.0, category_formatting=cat_fmt, post_processing=post_proc)
                    project['pages'][current_idx]['ocr_data'] = cleaned_data
                    project['pages'][current_idx]['status'] = 'pending'
                    self.project_manager.save_raw_ocr(project_id, current_idx, cleaned_data)

                elif mode == 'bboxes':
                    existing_data = page_data.get('ocr_data', [])
                    if not existing_data:
                        continue
                    native_w = float(page_data.get('native_width', 1))
                    native_h = float(page_data.get('native_height', 1))

                    for b in existing_data:
                        b['text'] = ""
                        b['_temp_lines'] = []
                        if (b.get('category') in ('Table', 'Vertical-poetry', 'Poem')) and 'table_structure' in b:
                            for cell in b['table_structure'].get('cells', []):
                                cell['text'] = ""
                                cell['_ordered_lines'] = []

                    for block in detailed_blocks:
                        for line in block.get('lines', []):
                            table_line_words = {}
                            for word in line.get('words', []):
                                w_geom = word.get('geometry', {})
                                if not w_geom:
                                    continue
                                wx = w_geom['center_x'] * native_w
                                wy = w_geom['center_y'] * native_h
                                for e_block in existing_data:
                                    bx1, by1, bx2, by2 = e_block['bbox']
                                    if (bx1 - 10) <= wx <= (bx2 + 10) and (by1 - 10) <= wy <= (by2 + 10):
                                        if (e_block.get('category') in ('Table', 'Vertical-poetry', 'Poem')) and 'table_structure' in e_block:
                                            b_id = id(e_block)
                                            if b_id not in table_line_words:
                                                table_line_words[b_id] = {id(c): [] for c in e_block['table_structure']['cells']}
                                            for cell in e_block['table_structure']['cells']:
                                                cx1, cy1, cx2, cy2 = cell['bbox']
                                                if (cx1 - 5) <= wx <= (cx2 + 5) and (cy1 - 5) <= wy <= (cy2 + 5):
                                                    table_line_words[b_id][id(cell)].append(word.get('text', ''))
                                                    break
                                        else:
                                            e_block['_temp_lines'].append((wy, line))
                                        break
                            for e_block in existing_data:
                                if (e_block.get('category') in ('Table', 'Vertical-poetry', 'Poem')) and 'table_structure' in e_block:
                                    b_id = id(e_block)
                                    if b_id in table_line_words:
                                        for cell in e_block['table_structure']['cells']:
                                            words_in_cell = table_line_words[b_id].get(id(cell), [])
                                            if words_in_cell:
                                                cell['_ordered_lines'].append(" ".join(words_in_cell))

                    for b in existing_data:
                        if (b.get('category') in ('Table', 'Vertical-poetry', 'Poem')) and 'table_structure' in b:
                            all_cell_texts = []
                            for cell in b['table_structure'].get('cells', []):
                                if '_ordered_lines' in cell:
                                    cell['text'] = "<br>".join(cell['_ordered_lines'])
                                    del cell['_ordered_lines']
                                if cell.get('text'):
                                    all_cell_texts.append(cell['text'])
                            b['text'] = "\n".join(all_cell_texts)
                            b['lines'] = []
                        else:
                            b['_temp_lines'].sort(key=lambda x: x[0])
                            seen_line_ids = set()
                            unique_lines = []
                            for _, line_obj in b['_temp_lines']:
                                line_id = id(line_obj)
                                if line_id not in seen_line_ids:
                                    seen_line_ids.add(line_id)
                                    unique_lines.append(line_obj)
                            b['lines'] = unique_lines
                            b['text'] = "\n".join([line_obj.get('text', '') for line_obj in b['lines']])
                            del b['_temp_lines']

                    table_structures_backup = {i: (b['table_structure'], b.get('category', 'Table')) for i, b in enumerate(existing_data) if 'table_structure' in b}
                    cleaned_elements = self._apply_cleaning_to_elements(existing_data, text_config, page_data, engine_dpi=72.0)
                    for idx, (ts, orig_cat) in table_structures_backup.items():
                        if idx < len(cleaned_elements):
                            cleaned_elements[idx]['table_structure'] = ts
                            cleaned_elements[idx]['category'] = orig_cat or 'Table'

                    project['pages'][current_idx]['ocr_data'] = cleaned_elements
                    self.project_manager.save_raw_ocr(project_id, current_idx, cleaned_elements)

                if (seq_idx + 1) % 10 == 0:
                    self.project_manager.update_project(project_id, project)

            self.project_manager.update_project(project_id, project)
            self._emit_paddle_progress('completed', 'تمت المعالجة عبر Google Lens بنجاح!', 100)
            return {'ok': True, 'project': project}

        except Exception as e:
            import traceback
            traceback.print_exc()
            self._emit_paddle_progress('error', str(e), 100)
            return {'ok': False, 'error': str(e)}
        finally:
            if doc is not None:
                try:
                    if not doc.is_closed:
                        doc.close()
                except Exception:
                    pass
            shutil.rmtree(tmp_dir, ignore_errors=True)

    def trigger_llm_ocr(self, project_id, start_idx, end_idx, llm_config, page_indices=None):
        project = self.project_manager.load_project(project_id)
        meta = project.get('metadata', {}) if project else {}
        text_config = meta.get('text_features', {})
        cat_fmt = meta.get('category_formatting', {})
        post_proc = meta.get('post_processing', {})
        if not project:
            return {'ok': False, 'error': 'المشروع غير موجود.'}

        pdf_path = project.get('pdf_path')
        doc = fitz.open(pdf_path) if (pdf_path and os.path.exists(pdf_path)) else None
        project_dir = os.path.join(self.project_manager.projects_dir, project_id)

        if page_indices is not None and isinstance(page_indices, list) and len(page_indices) > 0:
            indices_to_process = [int(i) for i in page_indices if 0 <= int(i) < len(project['pages'])]
        else:
            indices_to_process = list(range(start_idx, end_idx + 1))

        if not indices_to_process:
            return {'ok': False, 'error': 'لم يتم تحديد صفحات صالحة للمعالجة.'}

        try:
            llm_handler = LLMOCRHandler()
            tmp_dir = tempfile.mkdtemp(prefix='llm_ocr_')
            total_pages = len(indices_to_process)

            for seq_idx, current_idx in enumerate(indices_to_process):
                page_ui_num = current_idx + 1
                progress_pct = (seq_idx / total_pages) * 100
                self._emit_paddle_progress('extracting', f"تجهيز صفحة {page_ui_num}...", progress_pct)

                page_data = project['pages'][current_idx]
                img_rel = page_data.get('image_path')
                img_full = os.path.join(project_dir, 'images', img_rel) if img_rel else ''

                if img_full and os.path.exists(img_full):
                    active_img_path = img_full
                elif doc is not None:
                    pix = doc.load_page(page_data.get('pdf_index', current_idx)).get_pixmap(dpi=200)
                    active_img_path = os.path.join(tmp_dir, f"page_{current_idx}.png")
                    pix.save(active_img_path)
                else:
                    continue

                self._emit_paddle_progress('uploading', f"جاري المسح عبر الذكاء الاصطناعي لصفحة {page_ui_num}...", progress_pct + 10)

                result = llm_handler.extract_page(active_img_path, llm_config)
                if not result.get('success'):
                    raise Exception(result.get('error'))

                elements = result.get('data', {}).get('elements', [])
                ui_w = (page_data.get('native_width', 0) / 72.0) * 200.0
                ui_h = (page_data.get('native_height', 0) / 72.0) * 200.0

                new_ocr_data = []
                for el in elements:
                    bbox = el.get('bbox', [0, 0, 0, 0])
                    scale_x = ui_w / 1000.0
                    scale_y = ui_h / 1000.0
                    x1 = bbox[0] * scale_x
                    y1 = bbox[1] * scale_y
                    x2 = bbox[2] * scale_x
                    y2 = bbox[3] * scale_y
                    x_min, x_max = min(x1, x2), max(x1, x2)
                    y_min, y_max = min(y1, y2), max(y1, y2)
                    new_ocr_data.append({
                        "bbox": [round(x_min, 2), round(y_min, 2), round(x_max, 2), round(y_max, 2)],
                        "text": el.get('text', ''),
                        "category": el.get('category', 'Text'),
                        "reviewed": False,
                        "dir": "rtl",
                        "align": "right"
                    })

                cleaned_llm_data = self._apply_cleaning_to_elements(new_ocr_data, text_config, page_data, engine_dpi=1000.0, category_formatting=cat_fmt, post_processing=post_proc)
                project['pages'][current_idx]['ocr_data'] = cleaned_llm_data
                project['pages'][current_idx]['status'] = 'pending'
                self.project_manager.save_raw_ocr(project_id, current_idx, cleaned_llm_data)

                if (seq_idx + 1) % 10 == 0:
                    self.project_manager.update_project(project_id, project)

            self.project_manager.update_project(project_id, project)
            self._emit_paddle_progress('completed', 'تمت المعالجة عبر الذكاء الاصطناعي بنجاح!', 100)
            return {'ok': True, 'project': project}

        except Exception as e:
            import traceback
            traceback.print_exc()
            self._emit_paddle_progress('error', str(e), 100)
            return {'ok': False, 'error': str(e)}
        finally:
            if doc is not None:
                try:
                    if not doc.is_closed:
                        doc.close()
                except Exception:
                    pass
            shutil.rmtree(tmp_dir, ignore_errors=True)

    # --- Quran ---
    def quran_get_surahs(self):
        return self.quran_handler.get_surahs()

    def quran_search(self, query):
        return self.quran_handler.search_text(query)

    def quran_get_range(self, surah_id, from_ayah, to_ayah):
        return self.quran_handler.get_range(surah_id, from_ayah, to_ayah)

    def quran_format_insertion(self, ayah_ids, with_citation):
        return self.quran_handler.format_insertion(ayah_ids, with_citation)

    # --- Table ---
    def auto_layout_table_block(self, project_id, page_index, block_index, extraction_method="auto"):
        return self.table_handler.process_table_layout(project_id, page_index, block_index, extraction_method)

    def repopulate_page_text_from_raw(self, project_id, page_index, layout_blocks):
        raw_ocr = self.project_manager.load_raw_ocr(project_id, page_index)
        updated_blocks = populate_layout_blocks_text(raw_ocr, layout_blocks, preserve_reviewed=True)
        project = self.project_manager.load_project(project_id)
        if project and 'pages' in project and 0 <= page_index < len(project['pages']):
            project['pages'][page_index]['ocr_data'] = updated_blocks
            self.project_manager.update_project(project_id, project)
        return {'ok': True, 'ocr_data': updated_blocks}

    # --- Export ---
    def export_project(self, project_id, fmt, page_indices, opts=None, output_dir=None):
        try:
            # Export needs every page's OCR text content
            project = self.project_manager.load_project_with_ocr(project_id)
            if not project:
                return {'ok': False, 'error': 'المشروع غير موجود.'}


            safe_title = (project.get('metadata', {}).get('title') or 'export').replace(' ', '_')[:40]
            filters = {
                'json': ('JSON files (*.json)', 'All files (*.*)'),
                'txt': ('Text files (*.txt)', 'All files (*.*)'),
                'docx': ('Word files (*.docx)', 'All files (*.*)'),
                'html': ('HTML files (*.html)', 'All files (*.*)'),
                'epub3': ('EPUB files (*.epub)', 'All files (*.*)'),
                'epub': ('EPUB files (*.epub)', 'All files (*.*)'),
            }

            # Normalize formats into a list
            if isinstance(fmt, (list, tuple)):
                formats = [str(f).lower().strip() for f in fmt if str(f).strip()]
            elif isinstance(fmt, str):
                formats = [fmt.lower().strip()]
            else:
                formats = ['docx']

            if not formats:
                return {'ok': False, 'error': 'لم يتم تحديد صيغ للتصدير.'}

            # If multiple formats requested, ask for destination directory
            if len(formats) > 1:
                if output_dir:
                    target_dir = output_dir
                else:
                    out_dir = os.path.join(self.project_manager.projects_dir, project_id)
                    selected_folder = self._window.create_file_dialog(
                        webview.FileDialog.FOLDER,
                        directory=out_dir,
                    )
                    if not selected_folder:
                        return None
                    target_dir = selected_folder if isinstance(selected_folder, str) else selected_folder[0]

                exported_files = []
                for f in formats:
                    ext = 'epub' if f == 'epub3' else f
                    out_path = os.path.join(target_dir, f"{safe_title}.{ext}")
                    self._run_single_export(project, f, page_indices, out_path, opts)
                    exported_files.append(out_path)

                return {'ok': True, 'paths': exported_files, 'directory': target_dir}

            # Single format export
            single_fmt = formats[0]
            ext = 'epub' if single_fmt == 'epub3' else single_fmt
            if output_dir:
                output_path = os.path.join(output_dir, f"{safe_title}.{ext}")
            else:
                out_dir = os.path.join(self.project_manager.projects_dir, project_id)
                fmt_filter = filters.get(single_fmt, ('All files (*.*)',))
                result = self._window.create_file_dialog(
                    webview.FileDialog.SAVE,
                    directory=out_dir,
                    save_filename=f"{safe_title}.{ext}",
                    file_types=fmt_filter
                )
                if not result:
                    return None
                output_path = result if isinstance(result, str) else result[0]

            out_res = self._run_single_export(project, single_fmt, page_indices, output_path, opts)
            return {'ok': True, 'path': out_res}

        except Exception as e:
            import traceback
            traceback.print_exc()
            return {'ok': False, 'error': str(e)}

    def _run_single_export(self, project, fmt, page_indices, output_path, opts=None):
        if fmt == 'json':
            return export_json(project, page_indices, output_path)
        elif fmt == 'txt':
            return export_txt(project, page_indices, output_path, project.get('metadata', {}).get('logical_start', 1), opts=opts)
        elif fmt == 'docx':
            return export_docx(project, page_indices, output_path, opts)
        elif fmt == 'html':
            return export_html(project, page_indices, output_path, opts)
        elif fmt == 'epub3' or fmt == 'epub':
            return export_epub3(project, page_indices, output_path, opts)
        return output_path

    # --- LAN / Collaboration ---
    def start_lan_sharing(self, project_id, lan_password=None):
        project = self.project_manager.load_project(project_id)
        meta = project.get('metadata', {})
        requires_password = 'lan_password_hash' in meta
        if requires_password and not lan_password:
            raise ValueError('lan_password required to (re)start sharing for a password-protected project')
        self.lan_server = LANSyncServer(
            project_id=project_id,
            project_manager=self.project_manager,
            password_hash=meta.get('lan_password_hash'),
            on_remote_update=self._push_update_to_frontend,
            password=lan_password,
        )
        port = self.lan_server.start()
        self.lan_discovery.register(
            project_id=project_id,
            name=meta.get('title', 'Untitled'),
            port=port,
            owner=meta.get('owner', self.username),
            requires_password=requires_password,
            page_count=len(project.get('pages', [])),
        )
        return {'port': port}

    def stop_lan_sharing(self):
        self.lan_discovery.unregister()
        if self.lan_server:
            self.lan_server.stop()
            self.lan_server = None

    def scan_lan_projects(self, timeout=1.0):
        return self.lan_discovery.browse(timeout=timeout)

    def join_lan_project(self, host, port, project_id, password=None):
        client = LANSyncClient(host, port, project_id, password, on_remote_update=self._push_update_to_frontend)
        result = client.connect_and_sync()
        if result.get('ok'):
            self.lan_client = client
            # For join flow, project will be synced via lan updates; placeholder None okay
            local_project = result.get('project')
            if local_project:
                local_project['lan_remote'] = {'host': host, 'port': port, 'project_id': project_id}
                self.project_manager.update_project(project_id, local_project)
        return result

    def get_lan_peers(self):
        if self.lan_server:
            return self.lan_server.list_peers()
        return []

    def get_display_username(self):
        try:
            settings = self.project_manager.load_app_settings()
            if settings and settings.get('user_name'):
                return settings['user_name']
        except Exception:
            pass
        token_path = os.path.join(self.project_manager.projects_dir, 'gdrive_token.json')
        if os.path.exists(token_path):
            try:
                with open(token_path, 'r', encoding='utf-8') as f:
                    tdata = json.load(f)
                    if tdata.get('account'):
                        return tdata['account']
            except Exception:
                pass
        return self.username or getpass.getuser()

    def broadcast_page_update(self, project_id, page_index, ocr_data):
        username = self.get_display_username()
        if self.lan_server:
            self.lan_server.broadcast_update(page_index, ocr_data, username)
        if self.lan_client:
            self.lan_client.send_update(page_index, ocr_data, username)

    def _push_update_to_frontend(self, payload):
        if self._window:
            try:
                import json as _json
                self._window.evaluate_js(f"window.onLanUpdate && window.onLanUpdate({_json.dumps(payload)})")
            except Exception:
                pass

    def get_active_collaborators(self, project_id):
        collaborators = {'lan': [], 'cloud': []}
        if getattr(self, 'lan_server', None) and self.lan_server.project_id == project_id:
            collaborators['lan'] = self.lan_server.get_active_peers()
        return collaborators

    def toggle_broadcasting(self, project_id, coop_type, enabled):
        project = self.project_manager.load_project(project_id)
        meta = project.get('metadata', {})
        if coop_type == 'lan':
            meta['lan_broadcasting'] = bool(enabled)
            if getattr(self, 'lan_server', None) and self.lan_server.project_id == project_id:
                self.lan_server.set_broadcasting(enabled)
        self.project_manager.update_project_metadata(project_id, meta)
        return {'ok': True, 'lan_broadcasting': meta.get('lan_broadcasting', True)}

    def get_network_status(self):
        status = {'cloud': False, 'status': 'offline', 'lan_peers': [], 'cloud_peers': [], 'last_error': None}
        if getattr(self, 'lan_server', None):
            status['lan_peers'] = self.lan_server.get_active_peers()
        return status

    def merge_projects_api(self, project_id, remote_project, resolutions=None):
        from ..collab.merger import ProjectMerger
        local_project = self.project_manager.load_project(project_id)
        result = ProjectMerger.merge(local_project, remote_project, resolutions)
        self.project_manager.update_project(project_id, result['merged_project'])
        return {'ok': True, 'conflicts': result['conflicts']}

    def validate_password_strength(self, password):
        from ..collab.merger import validate_password_strength
        return validate_password_strength(password)

    # --- Settings ---
    def get_app_settings(self):
        return self.project_manager.load_app_settings()

    def save_app_settings(self, settings):
        return self.project_manager.save_app_settings(settings)

    def get_system_fonts(self):
        import platform
        clean_fonts = []
        if platform.system() == 'Windows':
            import winreg
            try:
                key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts")
                for i in range(0, winreg.QueryInfoKey(key)[1]):
                    font_name, _, _ = winreg.EnumValue(key, i)
                    font_name = font_name.split(' (')[0]
                    if not font_name.startswith('@'):
                        clean_fonts.append(font_name)
                winreg.CloseKey(key)
            except Exception as e:
                print(f"Registry font load failed: {e}")
        if not clean_fonts:
            clean_fonts = ["Arial", "Simplified Arabic", "Traditional Arabic", "Tahoma", "Times New Roman"]
        return {'ok': True, 'fonts': sorted(list(set(clean_fonts)))}

    def get_app_data_path(self):
        return self.config_manager.get_data_path()

    def select_app_data_folder(self):
        # Fixed: pywebview 4.x uses FileDialog.FOLDER, not FolderDialog
        try:
            result = self._window.create_file_dialog(webview.FileDialog.FOLDER)
            # FileDialog.FOLDER returns list or string depending on version
            if isinstance(result, (list, tuple)):
                return result[0] if result else None
            return result
        except AttributeError:
            # Fallback for older pywebview or if constant missing
            try:
                result = self._window.create_file_dialog(webview.FileDialog.FOLDER, allow_multiple=False)  # type: ignore
                return result[0] if isinstance(result, (list, tuple)) and result else result
            except Exception as e:
                print(f"[Api] select_app_data_folder failed: {e}")
                return None

    def change_app_data_path(self, new_path):
        success, msg = self.config_manager.change_data_path(new_path)
        if success:
            projects_dir = os.path.join(self.config_manager.get_data_path(), 'projects')
            self.project_manager = ProjectManager(projects_dir=projects_dir)
            self.table_handler = TableHandler(self.project_manager)
            return {'ok': True}
        return {'ok': False, 'error': msg}

    # Legacy add_ocr_data (kept for backward compat, though original had bug with undefined ocr_content)
    def add_ocr_data(self, project_id, ocr_json_path, page_index=None):
        project = self.project_manager.load_project(project_id)
        text_config = project.get('metadata', {}).get('text_features', {})
        try:
            # Try reading as file path first
            if os.path.exists(ocr_json_path):
                with open(ocr_json_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            else:
                data = json.loads(ocr_json_path)
            elements = data.get('elements', []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
            if text_config:
                cleaner = ArabicTextCleaner(text_config)
                for el in elements:
                    if 'text' in el and el.get('category') != 'Picture':
                        el['text'] = cleaner.clean(el['text'])
        except Exception as e:
            print(f"Error parsing OCR JSON in add_ocr_data: {e}")
            elements = []

        if page_index is not None and project and 'pages' in project and 0 <= page_index < len(project['pages']):
            project['pages'][page_index]['ocr_data'] = elements
            project['pages'][page_index]['status'] = 'pending'
            self.project_manager.save_raw_ocr(project_id, page_index, elements)

    # ── Post-Processing ──────────────────────────────────────────────────

    def apply_reading_order_sorting(self, project_id, page_indices=None, only_unreviewed=True):
        """
        Sort OCR bounding boxes into Arabic reading order (Top-to-Bottom, Right-to-Left).
        """
        try:
            project = self.project_manager.load_project_with_ocr(project_id)
            if not project:
                return {'ok': False, 'error': 'المشروع غير موجود.'}

            pp_config = project.get('metadata', {}).get('post_processing', {})
            # Ensure auto_sort_reading_order is enabled for this run
            pp_config['auto_sort_reading_order'] = True
            manager = PostProcessingManager(config=pp_config)

            pages = project.get('pages', [])
            indices = page_indices if page_indices is not None else list(range(len(pages)))
            processed = 0

            for i in indices:
                if i >= len(pages):
                    continue
                page = pages[i]

                if only_unreviewed:
                    ocr_data = page.get('ocr_data', [])
                    all_reviewed = all(
                        b.get('reviewed') for b in ocr_data if b.get('text')
                    )
                    if all_reviewed and ocr_data:
                        continue

                page_height = page.get('height', 0.0)
                ocr_data = page.get('ocr_data', [])

                updated = manager.process_page(ocr_data, page_height=page_height)
                page['ocr_data'] = updated
                processed += 1

            self.project_manager.update_project(project_id, project)
            return {'ok': True, 'count': processed}
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {'ok': False, 'error': str(e)}

    def apply_pagination_detection(self, project_id, page_indices=None, only_unreviewed=True):
        """
        Detect page numbers across project pages and annotate blocks with category="Page-number".
        """
        try:
            project = self.project_manager.load_project_with_ocr(project_id)
            if not project:
                return {'ok': False, 'error': 'المشروع غير موجود.'}

            pp_config = project.get('metadata', {}).get('post_processing', {})
            pp_config['detect_pagination'] = True
            manager = PostProcessingManager(config=pp_config)

            updated = manager.process_project_pages(project, page_indices=page_indices, only_unreviewed=only_unreviewed)
            count = updated.get('_pagination_applied', 0)

            self.project_manager.update_project(project_id, updated)
            return {'ok': True, 'count': count}
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {'ok': False, 'error': str(e)}

    def run_post_processing_to_project(self, project_id, only_unreviewed=True):
        """
        Apply all enabled post-processing steps to eligible pages of a project.
        """
        try:
            project = self.project_manager.load_project_with_ocr(project_id)
            if not project:
                return {'ok': False, 'error': 'المشروع غير موجود.'}


            pp_config = project.get('metadata', {}).get('post_processing', {})

            if not any(pp_config.values()):
                return {'ok': True, 'count': 0, 'message': 'لا توجد خيارات معالجة مفعلة.'}

            manager = PostProcessingManager(config=pp_config)
            updated = manager.process_project_pages(project, only_unreviewed=only_unreviewed)
            processed = updated.get('_post_processing_applied', 0)

            self.project_manager.update_project(project_id, updated)
            return {'ok': True, 'count': processed}
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {'ok': False, 'error': str(e)}

    # --- Pre-processing Pipeline (ScanTailor Advanced) ---

    def get_preprocessing_defaults(self):
        """Return default configuration parameters for all 6 stages."""
        try:
            return {'ok': True, 'defaults': self.preprocessing_engine.get_stage_defaults()}
        except Exception as e:
            return {'ok': False, 'error': str(e)}

    def preview_preprocessing_stage(self, project_id, page_index, stage_name, params=None, from_original=True, dpi=300):
        """
        Execute pipeline up to stage_name and return base64 preview + computed metadata.
        """
        try:
            res = self.preprocessing_engine.preview_stage(
                project_id=project_id,
                page_index=int(page_index),
                target_stage=stage_name,
                stages_params=params or {},
                from_original=from_original,
                dpi=int(dpi),
            )
            return res
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {'success': False, 'error': str(e)}

    def apply_preprocessing_stage_to_page(self, project_id, page_index, stage_name, stage_params=None, dpi=300):
        """
        Apply a SINGLE preprocessing stage directly to the active working page image.
        """
        try:
            res = self.preprocessing_engine.apply_stage_to_page(
                project_id=project_id,
                page_index=int(page_index),
                stage_name=stage_name,
                stage_params=stage_params or {},
                dpi=int(dpi),
            )
            return res
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {'success': False, 'error': str(e)}

    def apply_preprocessing_stage_to_all(self, project_id, stage_name, stage_params=None, page_indices=None, dpi=300):
        """
        Apply a SINGLE preprocessing stage across multiple pages asynchronously.
        """
        try:
            project = self.project_manager.load_project(project_id)
            if not project:
                return {'ok': False, 'error': 'المشروع غير موجود.'}

            pages = project.get('pages', [])
            if page_indices is None:
                indices = list(range(len(pages)))
            else:
                indices = [int(i) for i in page_indices if 0 <= int(i) < len(pages)]

            options = {
                "stages_to_run": [stage_name],
                "from_original": False,  # Operate on active page state
                "split_spread": (stage_name == "split"),
                "dpi": int(dpi),
            }
            stages_params = {stage_name: stage_params or {}}
            return self.batch_run_preprocessing(project_id, indices, stages_params=stages_params, options=options)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {'ok': False, 'error': str(e)}

    def apply_preprocessing_to_page(self, project_id, page_index, stages_params=None, stages_to_run=None, split_spread=False, from_original=True, dpi=300):
        """
        Apply and commit pre-processing pipeline for a single page.
        """
        try:
            res = self.preprocessing_engine.process_and_save_page(
                project_id=project_id,
                page_index=int(page_index),
                stages_params=stages_params or {},
                stages_to_run=stages_to_run,
                from_original=from_original,
                split_spread=split_spread,
                dpi=int(dpi),
            )
            return res
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {'success': False, 'error': str(e)}

    def batch_run_preprocessing(self, project_id, page_indices=None, stages_params=None, options=None):
        """
        Run multi-page batch pre-processing asynchronously on a background worker thread.
        """
        try:
            project = self.project_manager.load_project(project_id)
            if not project:
                return {'ok': False, 'error': 'المشروع غير موجود.'}

            pages = project.get('pages', [])
            if page_indices is None:
                indices = list(range(len(pages)))
            else:
                indices = [int(i) for i in page_indices if 0 <= int(i) < len(pages)]

            if not indices:
                return {'ok': False, 'error': 'لم يتم تحديد صفحات للمعالجة.'}

            if self.preprocessing_worker and self.preprocessing_worker.is_running:
                return {'ok': False, 'error': 'هناك عملية معالجة أخرى جارية بالفعل.'}

            def on_progress(payload):
                self.events.preprocessing_progress(payload)

            def on_completed(payload):
                self.events.preprocessing_progress(payload)

            self.preprocessing_worker = BatchPreprocessingWorker(
                engine=self.preprocessing_engine,
                project_id=project_id,
                page_indices=indices,
                stages_params=stages_params or {},
                options=options or {},
                progress_callback=on_progress,
                completed_callback=on_completed,
            )
            self.preprocessing_worker.start()
            return {'ok': True, 'total': len(indices)}
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {'ok': False, 'error': str(e)}

    def cancel_preprocessing(self):
        """Cancel ongoing batch pre-processing."""
        try:
            if self.preprocessing_worker and self.preprocessing_worker.is_running:
                self.preprocessing_worker.stop()
                return {'ok': True, 'message': 'تم إيقاف المعالجة.'}
            return {'ok': True, 'message': 'لا توجد معالجة جارية.'}
        except Exception as e:
            return {'ok': False, 'error': str(e)}

    def reset_page_preprocessing(self, project_id, page_index):
        """Reset page to original unedited scan."""
        try:
            page = self.preprocessing_engine.storage.reset_page_to_original(project_id, int(page_index))
            return {'ok': True, 'page': page}
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {'ok': False, 'error': str(e)}



