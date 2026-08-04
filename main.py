import os
import getpass
import tempfile
import shutil
import webview
from backend.project_manager import ProjectManager
from backend.config_manager import ConfigManager
from backend.pdf_processor import PDFProcessor
from backend.ocr_handler import OCRHandler
from backend.exporter import export_json, export_txt, export_docx
from backend.lan_discovery import LANDiscovery
from backend.lan_sync import LANSyncServer, LANSyncClient

import fitz  # PyMuPDF for PDF chunking
from backend.paddleocr_client import PaddleOCRClient
from backend.google_lens_ocr import GoogleLensOCR
from backend.block_stitcher import BlockStitcher
from pathlib import Path
from backend.quran_handler import QuranHandler
from backend.llm_ocr import LLMOCRHandler
import tempfile
import glob
from backend.text_cleaner import ArabicTextCleaner
from backend.table_handler import TableHandler
from backend.exporter import export_json, export_txt, export_docx
from backend.epub_builder import export_epub3, export_html  # <-- Add this line

def cleanup_old_residue():
    """Scans for and removes stale OCR temp folders on app startup."""
    temp_dir = tempfile.gettempdir()
    # Find folders starting with our OCR prefixes
    patterns = ['paddleocr_*', 'glens_ocr_*', 'llm_ocr_*', 'locro_ocr_*']
    for pattern in patterns:
        for path in glob.glob(os.path.join(temp_dir, pattern)):
            try:
                shutil.rmtree(path, ignore_errors=True)
            except:
                pass

def extract_pdf_range(src_path, start_idx, end_idx, out_path):
    """Extracts a specific range of pages into a new temporary PDF."""
    doc = fitz.open(src_path)
    new_doc = fitz.open()
    new_doc.insert_pdf(doc, from_page=start_idx, to_page=end_idx)
    new_doc.save(out_path)
    new_doc.close()
    doc.close()
    
class Api:
    def __init__(self):
        self.config_manager = ConfigManager()
        self.config_manager.auto_migrate_legacy_data()
        
        projects_dir = os.path.join(self.config_manager.get_data_path(), 'projects')
        self.project_manager = ProjectManager(projects_dir=projects_dir)
        self.pdf_processor = PDFProcessor()
        self.ocr_handler = OCRHandler()
        self._window = None
        self.lan_discovery = LANDiscovery()
        self.lan_server = None          # LANSyncServer when hosting
        self.lan_client = None          # LANSyncClient when joined as guest

        self.cloud_host = None          
        self.cloud_guest = None

        self.username = getpass.getuser()

        self.table_handler = TableHandler(self.project_manager)
        
        # ربط مسار ملف القرآن الموجود في مجلد data الرئيسي
        quran_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'Quran.json')
        self.quran_handler = QuranHandler(json_path=quran_path)

    def set_window(self, window):
        self._window = window

    def select_pdf(self):
        result = self._window.create_file_dialog(
            webview.FileDialog.OPEN,
            allow_multiple=False,
            file_types=('PDF files (*.pdf)', 'All files (*.*)')
        )
        return result[0] if result else None

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

        self._emit_pdf_progress('hashing', 0, 0)
        hashes = self.pdf_processor.get_pdf_hashes(pdf_path)
        project['pdf_path'] = pdf_path
        project['pdf_hash'] = hashes['sha256']
        project['pdf_hashes'] = hashes

        output_dir = os.path.join(self.project_manager.projects_dir, project_id, 'images')

        def on_progress(current, total):
            self._emit_pdf_progress('rendering', current, total)

        pages = self.pdf_processor.process_pdf(pdf_path, output_dir, progress_callback=on_progress)
        project['pages'] = pages

        self.project_manager.update_project(project_id, project)
        if metadata['lan_enabled']:
            self.start_lan_sharing(project_id, lan_password=lan_password)
        self._emit_pdf_progress('done', len(pages), len(pages))
        return project

    def _emit_pdf_progress(self, stage, current, total):
        if self._window:
            import json as _json
            payload = _json.dumps({'stage': stage, 'current': current, 'total': total})
            self._window.evaluate_js(f"window.onPdfProgress && window.onPdfProgress({payload})")

    # ---------------- LAN ----------------

    def start_lan_sharing(self, project_id, lan_password=None):
        project = self.project_manager.load_project(project_id)
        meta = project.get('metadata', {})
        requires_password = 'lan_password_hash' in meta
        if requires_password and not lan_password:
            # We only have the PBKDF2 hash on disk, not the plaintext -
            # sharing can't be (re)started without the password being
            # supplied again by whoever is hosting.
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
        client = LANSyncClient(host, port, project_id, password,
                                on_remote_update=self._push_update_to_frontend)
        result = client.connect_and_sync()
        if result.get('ok'):
            self.lan_client = client
            local_project = result['project']
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
                import json
                with open(token_path, 'r', encoding='utf-8') as f:
                    tdata = json.load(f)
                    if tdata.get('account'):
                        return tdata['account']
            except Exception:
                pass
        return self.username or getpass.getuser()

    def broadcast_page_update(self, project_id, page_index, ocr_data):
        # Called after a local edit so connected LAN/Cloud peers get it in real time
        username = self.get_display_username()
        
        # 1. LAN Broadcasting
        if self.lan_server:
            self.lan_server.broadcast_update(page_index, ocr_data, username)
        if self.lan_client:
            self.lan_client.send_update(page_index, ocr_data, username)

    def request_lan_file(self, filename):
        if self.lan_client:
            return self.lan_client.request_file(filename)
        return None

    def _push_update_to_frontend(self, payload):
        if self._window:
            try:
                import json as _json
                self._window.evaluate_js(f"window.onLanUpdate && window.onLanUpdate({_json.dumps(payload)})")
            except Exception:
                pass

    def load_project(self, project_id):
        return self.project_manager.load_project(project_id)

    def get_projects(self):
        return self.project_manager.list_projects()

    def validate_password_strength(self, password):
        from backend.project_merger import validate_password_strength
        return validate_password_strength(password)

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

    def merge_projects_api(self, project_id, remote_project, resolutions=None):
        from backend.project_merger import ProjectMerger
        local_project = self.project_manager.load_project(project_id)
        result = ProjectMerger.merge(local_project, remote_project, resolutions)
        self.project_manager.update_project(project_id, result['merged_project'])
        return {'ok': True, 'conflicts': result['conflicts']}

    def get_network_status(self):
        """Returns the live status of the lan connection"""
        status = {'cloud': False, 'status': 'offline', 'lan_peers': [], 'cloud_peers': [], 'last_error': None}
        if getattr(self, 'lan_server', None):
            status['lan_peers'] = self.lan_server.get_active_peers()
        return status

    # ---------------- App-wide settings ----------------

    def get_app_settings(self):
        return self.project_manager.load_app_settings()

    def get_system_fonts(self):
        """Fetches all installed fonts safely (Thread-Safe, No Tkinter)."""
        import platform
        clean_fonts = []
        if platform.system() == 'Windows':
            import winreg
            try:
                # Thread-safe read directly from the Windows OS registry
                key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts")
                for i in range(0, winreg.QueryInfoKey(key)[1]):
                    font_name, _, _ = winreg.EnumValue(key, i)
                    # Clean up the name (Removes " (TrueType)" or " (OpenType)" suffixes)
                    font_name = font_name.split(' (')[0] 
                    if not font_name.startswith('@'):
                        clean_fonts.append(font_name)
                winreg.CloseKey(key)
            except Exception as e:
                print(f"Registry font load failed: {e}")
        
        # Fallback just in case the registry blocks us
        if not clean_fonts:
            clean_fonts = ["Arial", "Simplified Arabic", "Traditional Arabic", "Tahoma", "Times New Roman"]
            
        return {'ok': True, 'fonts': sorted(list(set(clean_fonts)))}
    
    def save_app_settings(self, settings):
        return self.project_manager.save_app_settings(settings)

    def select_ocr_json(self):
        result = self._window.create_file_dialog(
            webview.FileDialog.OPEN,
            allow_multiple=False,
            file_types=('JSON files (*.json)', 'All files (*.*)')
        )
        return result[0] if result else None

    def add_ocr_data(self, project_id, ocr_json_path, page_index=None):
        project = self.project_manager.load_project(project_id)
        text_config = project.get('metadata', {}).get('text_features', {})
        try:
            data = json.loads(ocr_content)
            elements = data.get('elements', []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
            if text_config:
                cleaner = ArabicTextCleaner(text_config)
                for el in elements:
                    if 'text' in el and el.get('category') != 'Picture':
                        el['text'] = cleaner.clean(el['text'])
        except Exception as e:
            print(f"Error parsing OCR JSON in add_ocr_data: {e}")
            elements = []

        if page_index is not None:
            project['pages'][page_index]['ocr_data'] = elements
            project['pages'][page_index]['status'] = 'pending'
            self.project_manager.save_raw_ocr(project_id, page_index, elements)

        self.project_manager.update_project(project_id, project)
        return project

    def update_page_ocr(self, project_id, page_index, ocr_data, status=None):
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

    def delete_project(self, project_id, delete_files=True):
        return self.project_manager.delete_project(project_id, delete_files=delete_files)

    def delete_page(self, project_id, page_index, delete_files=False):
        return self.project_manager.delete_page(project_id, page_index, delete_files=delete_files)

    def _emit_paddle_progress(self, stage, message, percentage=0):
        if self._window:
            import json as _json
            payload = _json.dumps({'stage': stage, 'message': message, 'percentage': percentage})
            self._window.evaluate_js(f"window.onPaddleProgress && window.onPaddleProgress({payload})")

    def trigger_paddle_ocr(self, project_id, start_idx, end_idx):
        """
        Handles chunking, limits, and processing for PaddleOCR.
        start_idx and end_idx are 0-based inclusive.
        """
        project = self.project_manager.load_project(project_id)
        text_config = project.get('metadata', {}).get('text_features', {})

        if not project:
            return {'ok': False, 'error': 'المشروع غير موجود.'}

        pdf_path = project.get('pdf_path')
        if not pdf_path or not os.path.exists(pdf_path):
            return {'ok': False, 'error': 'تعذّر العثور على ملف PDF الأصلي.'}

        paddle_client = PaddleOCRClient(data_dir=self.project_manager.projects_dir)
        
        # Check daily limits before starting
        if paddle_client.get_limits() <= 0:
            return {'ok': False, 'error': 'لقد استنفدت الحد اليومي المجاني.'}

        try:
            tmp_dir = tempfile.mkdtemp(prefix='paddleocr_')
            current_start = start_idx
            
            # Smart Segmentation: Process in chunks of 200 pages max
            while current_start <= end_idx:
                current_end = min(current_start + paddle_client.max_pages_per_chunk - 1, end_idx)
                
                self._emit_paddle_progress('extracting', f"تجهيز الصفحات من {current_start+1} إلى {current_end+1}...")
                
                tmp_pdf_path = os.path.join(tmp_dir, f"chunk_{current_start}_{current_end}.pdf")
                extract_pdf_range(pdf_path, current_start, current_end, tmp_pdf_path)

                self._emit_paddle_progress('uploading', f"جاري رفع الدفعة ({current_start+1}-{current_end+1})...")
                
                # Consume 1 limit per chunk upload
                paddle_client.decrement_limit()
                
                # Process the chunk (polling progress is emitted inside the client)
                paddle_pages = paddle_client.process_pdf_chunk(tmp_pdf_path, window=self._window)
                app_formatted_pages = paddle_client.parse_paddle_to_app_format(
                    paddle_pages, 
                    project['pages'], 
                    current_start
                )
                
                for i, ocr_data in enumerate(app_formatted_pages):
                    actual_page_index = current_start + i
                    if actual_page_index < len(project['pages']):
                        pg_data = project['pages'][actual_page_index]
                        cleaned_elements = self._apply_cleaning_to_elements(ocr_data, text_config, pg_data, engine_dpi=200.0)
                        project['pages'][actual_page_index]['ocr_data'] = cleaned_elements
                        project['pages'][actual_page_index]['status'] = 'pending'
                        self.project_manager.save_raw_ocr(project_id, actual_page_index, cleaned_elements)

                self.project_manager.update_project(project_id, project)
                current_start = current_end + 1

            self._emit_paddle_progress('completed', 'تمت المعالجة بنجاح!', 100)
            return {'ok': True, 'project': project, 'trials_left': paddle_client.get_limits()}

        except Exception as e:
            self._emit_paddle_progress('error', str(e), 0)
            return {'ok': False, 'error': str(e)}
            os.startfile(tmp_dir) # remove me 
        finally:
            import shutil
            shutil.rmtree(tmp_dir, ignore_errors=True)
    def get_paddle_limits(self):
        """Allows frontend to query remaining daily limits"""
        paddle_client = PaddleOCRClient(data_dir=self.project_manager.projects_dir)
        return paddle_client.get_limits()

    # ───── Export ─────

    def request_directory_dialog(self):
        """Asks the user for a destination folder for batch exports."""
        result = self._window.create_file_dialog(webview.FileDialog.FOLDER)
        return result[0] if result else None
    
    def export_project(self, project_id, fmt, page_indices, opts=None, output_dir=None):
        """fmt: 'json'|'txt'|'docx'|'html'|'epub3', page_indices: list of ints"""
        project = self.project_manager.load_project(project_id)
        safe_title = (project['metadata'].get('title') or 'export').replace(' ', '_')[:40]

        # If output_dir is provided (from the multi-export page), skip the dialog and build the path
        if output_dir:
            output_path = os.path.join(output_dir, f"{safe_title}.{fmt}")
        else:
            # Fallback for single-file exports from other parts of the app
            out_dir = os.path.join(self.project_manager.projects_dir, project_id)
            filters = {
                'json': ('JSON files (*.json)', 'All files (*.*)'),
                'txt':  ('Text files (*.txt)',  'All files (*.*)'),
                'docx': ('Word files (*.docx)', 'All files (*.*)'),
                'html': ('HTML files (*.html)', 'All files (*.*)'),
                'epub3': ('EPUB files (*.epub)', 'All files (*.*)'),
            }
            result = self._window.create_file_dialog(
                webview.FileDialog.SAVE,
                directory=out_dir,
                save_filename=f"{safe_title}.{fmt}",
                file_types=filters.get(fmt, ('All files (*.*)',))
            )
            if not result:
                return None
            output_path = result if isinstance(result, str) else result[0]

        # Route to the correct exporter
        if fmt == 'json':
            return export_json(project, page_indices, output_path)
        elif fmt == 'txt':
            return export_txt(project, page_indices, output_path, project['metadata'].get('logical_start', 1), opts=opts)
        elif fmt == 'docx':
            return export_docx(project, page_indices, output_path, opts)
        elif fmt == 'html':                                        
            return export_html(project, page_indices, output_path, opts)
        elif fmt == 'epub3':                                       
            return export_epub3(project, page_indices, output_path, opts)
        return None
    


# ==========================================
    # LOCRO OCR INTEGRATION
    # ==========================================
    def trigger_locro_ocr(self, project_id, start_idx, end_idx, mode):
        project = self.project_manager.load_project(project_id)
        text_config = project.get('metadata', {}).get('text_features', {})
        if not project: return {'ok': False, 'error': 'المشروع غير موجود.'}

        pdf_path = project.get('pdf_path')
        if not pdf_path or not os.path.exists(pdf_path): return {'ok': False, 'error': 'تعذّر العثور على ملف PDF.'}

        from backend.locro_ocr import run_locro_ocr
        try:
            tmp_dir = tempfile.mkdtemp(prefix='locro_ocr_')
            doc = fitz.open(pdf_path)
            total_pages = (end_idx - start_idx) + 1
            
            for current_idx in range(start_idx, end_idx + 1):
                page_ui_num = current_idx + 1
                progress_pct = ((current_idx - start_idx) / total_pages) * 100
                self._emit_paddle_progress('extracting', f"جاري المسح عبر Locro Offline لصفحة {page_ui_num}...", progress_pct)
                
                pix = doc.load_page(current_idx).get_pixmap(dpi=300)
                img_path = os.path.join(tmp_dir, f"page_{current_idx}.png")
                pix.save(img_path)

                page_data = project['pages'][current_idx]
                
                blocks = run_locro_ocr(img_path)
                
                if mode == 'full_page':
                    cleaned_elements = self._apply_cleaning_to_elements(blocks, text_config, page_data, engine_dpi=300.0)
                    project['pages'][current_idx]['ocr_data'] = cleaned_elements
                    project['pages'][current_idx]['status'] = 'pending'
                    self.project_manager.save_raw_ocr(project_id, current_idx, cleaned_elements)
                
                elif mode == 'bboxes':
                    existing_data = page_data.get('ocr_data', [])
                    if not existing_data: continue
                    
                    native_w = float(page_data.get('native_width', 1))
                    native_h = float(page_data.get('native_height', 1))
                    
                    # 1. Normalize Locro blocks from 300 DPI to 72 DPI FIRST!
                    # This ensures all words and lines inside Locro blocks are at 72 DPI and have 'geometry'.
                    normalized_locro_blocks = self.ocr_handler.standardize_page_blocks(
                        blocks, native_w, native_h, current_dpi=300.0
                    )
                    
                    for b in existing_data:
                        b['text'] = ""
                        b['_temp_lines'] = []
                        if b.get('category') == 'Table' and 'table_structure' in b:
                            for cell in b['table_structure'].get('cells', []):
                                cell['text'] = ""
                                cell['_ordered_lines'] = [] 
                    
                    for block in normalized_locro_blocks:
                        for line in block.get('lines', []):
                            table_line_words = {} 
                            
                            for word in line.get('words', []):
                                # Now words have 'geometry' and their 'bbox' is in 72 DPI
                                w_geom = word.get('geometry', {})
                                if not w_geom: continue
                                
                                wx = w_geom['center_x'] * native_w
                                wy = w_geom['center_y'] * native_h
                                
                                for e_block in existing_data:
                                    bx1, by1, bx2, by2 = e_block['bbox']
                                    
                                    if (bx1 - 10) <= wx <= (bx2 + 10) and (by1 - 10) <= wy <= (by2 + 10):
                                        if e_block.get('category') == 'Table' and 'table_structure' in e_block:
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
                                if e_block.get('category') == 'Table' and 'table_structure' in e_block:
                                    b_id = id(e_block)
                                    if b_id in table_line_words:
                                        for cell in e_block['table_structure']['cells']:
                                            words_in_cell = table_line_words[b_id].get(id(cell), [])
                                            if words_in_cell:
                                                cell['_ordered_lines'].append(" ".join(words_in_cell))
                    
                    for b in existing_data:
                        if b.get('category') == 'Table' and 'table_structure' in b:
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
                    
                    table_structures_backup = {i: b['table_structure'] for i, b in enumerate(existing_data) if 'table_structure' in b}
                    cleaned_elements = self._apply_cleaning_to_elements(existing_data, text_config, page_data, engine_dpi=72.0)
                    for idx, ts in table_structures_backup.items():
                        if idx < len(cleaned_elements):
                            cleaned_elements[idx]['table_structure'] = ts
                            cleaned_elements[idx]['category'] = 'Table'
                    
                    project['pages'][current_idx]['ocr_data'] = cleaned_elements
                    self.project_manager.save_raw_ocr(project_id, current_idx, cleaned_elements)
                
                self.project_manager.update_project(project_id, project)

            self._emit_paddle_progress('completed', 'تمت المعالجة عبر Locro بنجاح!', 100)
            return {'ok': True, 'project': project}
            
        except Exception as e:
            self._emit_paddle_progress('error', str(e), 0)
            return {'ok': False, 'error': str(e)}
        finally:
            import shutil
            if 'tmp_dir' in locals() and os.path.exists(tmp_dir):
                shutil.rmtree(tmp_dir, ignore_errors=True)

    # ==========================================
    # GOOGLE LENS OCR INTEGRATION
    # ==========================================
    def trigger_google_lens_ocr(self, project_id, start_idx, end_idx, mode):
        project = self.project_manager.load_project(project_id)
        text_config = project.get('metadata', {}).get('text_features', {})
        if not project: return {'ok': False, 'error': 'المشروع غير موجود.'}

        pdf_path = project.get('pdf_path')
        if not pdf_path or not os.path.exists(pdf_path): return {'ok': False, 'error': 'تعذّر العثور على ملف PDF.'}

        try:
            glens = GoogleLensOCR(max_workers=3)
            tmp_dir = tempfile.mkdtemp(prefix='glens_ocr_')
            doc = fitz.open(pdf_path)
            total_pages = (end_idx - start_idx) + 1
            
            for current_idx in range(start_idx, end_idx + 1):
                page_ui_num = current_idx + 1
                progress_pct = ((current_idx - start_idx) / total_pages) * 100
                self._emit_paddle_progress('extracting', f"تجهيز صفحة {page_ui_num}...", progress_pct)
                
                pix = doc.load_page(current_idx).get_pixmap(dpi=300)
                img_path = os.path.join(tmp_dir, f"page_{current_idx}.png")
                pix.save(img_path)

                page_data = project['pages'][current_idx]
                ui_w = (page_data.get('native_width', 0) / 72.0) * 200.0
                ui_h = (page_data.get('native_height', 0) / 72.0) * 200.0

                self._emit_paddle_progress('uploading', f"جاري المسح عبر Google Lens لصفحة {page_ui_num}...", progress_pct + 10)
                
                results = glens.extract_batch([Path(img_path)])
                
                if not results or not results[0].get('success'):
                    continue
                    
                detailed_blocks = results[0].get('detailed_blocks', [])

                if mode == 'full_page':
                    new_ocr_data = []
                    for block in detailed_blocks:
                        geom = block.get('geometry', {})
                        if not geom: continue
                        
                        # تجميع نصوص الأسطر لضمان وجود النص في الكتلة الرئيسية
                        lines_text = [line.get('text', '') for line in block.get('lines', [])]
                        block['text'] = "\n".join(lines_text)
                        
                        # إضافة الخصائص الافتراضية للكتلة (نحتفظ بالكائن الأصلي بما فيه من lines و words)
                        block['category'] = "Text"
                        block['reviewed'] = False
                        block['dir'] = "rtl"
                        block['align'] = "right"
                        
                        new_ocr_data.append(block)
                        
                    cleaned_data = self._apply_cleaning_to_elements(new_ocr_data, text_config, page_data, engine_dpi=200.0)
                    project['pages'][current_idx]['ocr_data'] = cleaned_data
                    project['pages'][current_idx]['status'] = 'pending'
                    self.project_manager.save_raw_ocr(project_id, current_idx, cleaned_data)

                elif mode == 'bboxes':
                    existing_data = page_data.get('ocr_data', [])
                    if not existing_data: continue
                    
                    native_w = float(page_data.get('native_width', 1))
                    native_h = float(page_data.get('native_height', 1))
                    
                    # تهيئة الخلايا لتستقبل الأسطر بالترتيب
                    for b in existing_data:
                        b['text'] = ""
                        b['_temp_lines'] = []
                        if b.get('category') == 'Table' and 'table_structure' in b:
                            for cell in b['table_structure'].get('cells', []):
                                cell['text'] = ""
                                cell['_ordered_lines'] = [] 
                    
                    # التوزيع المكاني مع الحفاظ التام على ترتيب Google Lens
                    for block in detailed_blocks:
                        for line in block.get('lines', []):
                            # قاموس مؤقت لتجميع كلمات هذا السطر وتوزيعها على الخلايا المناسبة
                            table_line_words = {} 
                            
                            for word in line.get('words', []):
                                w_geom = word.get('geometry', {})
                                if not w_geom: continue
                                
                                wx = w_geom['center_x'] * native_w
                                wy = w_geom['center_y'] * native_h
                                
                                for e_block in existing_data:
                                    bx1, by1, bx2, by2 = e_block['bbox']
                                    
                                    if (bx1 - 10) <= wx <= (bx2 + 10) and (by1 - 10) <= wy <= (by2 + 10):
                                        if e_block.get('category') == 'Table' and 'table_structure' in e_block:
                                            b_id = id(e_block)
                                            if b_id not in table_line_words:
                                                table_line_words[b_id] = {id(c): [] for c in e_block['table_structure']['cells']}
                                                
                                            for cell in e_block['table_structure']['cells']:
                                                cx1, cy1, cx2, cy2 = cell['bbox']
                                                if (cx1 - 5) <= wx <= (cx2 + 5) and (cy1 - 5) <= wy <= (cy2 + 5):
                                                    # إضافة الكلمة الخلية المناسبة (ستنضاف بالترتيب الطبيعي للسطر!)
                                                    table_line_words[b_id][id(cell)].append(word.get('text', ''))
                                                    break
                                        else:
                                            e_block['_temp_lines'].append((wy, line))
                                        break
                            
                            # بعد انتهاء السطر، نقوم بدمج الكلمات التي وقعت في كل خلية كسطر جديد
                            for e_block in existing_data:
                                if e_block.get('category') == 'Table' and 'table_structure' in e_block:
                                    b_id = id(e_block)
                                    if b_id in table_line_words:
                                        for cell in e_block['table_structure']['cells']:
                                            words_in_cell = table_line_words[b_id].get(id(cell), [])
                                            if words_in_cell:
                                                cell['_ordered_lines'].append(" ".join(words_in_cell))
                    
                    # إعادة بناء النص النهائي
                    for b in existing_data:
                        if b.get('category') == 'Table' and 'table_structure' in b:
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
                    
                    # حماية جداولك من الحذف أثناء الفلترة
                    table_structures_backup = {i: b['table_structure'] for i, b in enumerate(existing_data) if 'table_structure' in b}
                    cleaned_elements = self._apply_cleaning_to_elements(existing_data, text_config, page_data, engine_dpi=72.0)
                    for idx, ts in table_structures_backup.items():
                        if idx < len(cleaned_elements):
                            cleaned_elements[idx]['table_structure'] = ts
                            cleaned_elements[idx]['category'] = 'Table'
                    
                    project['pages'][current_idx]['ocr_data'] = cleaned_elements
                    self.project_manager.save_raw_ocr(project_id, current_idx, cleaned_elements)

                self.project_manager.update_project(project_id, project)

            doc.close()
            self._emit_paddle_progress('completed', 'تمت المعالجة عبر Google Lens بنجاح!', 100)
            return {'ok': True, 'project': project}

        except Exception as e:
            import traceback
            traceback.print_exc()
            self._emit_paddle_progress('error', str(e), 100)
            return {'ok': False, 'error': str(e)}
        finally:
            import shutil
            shutil.rmtree(tmp_dir, ignore_errors=True)
            pass
        
        
    # ==========================================
    # QURAN INSERTION INTEGRATION
    # ==========================================
    def quran_get_surahs(self):
        """إرجاع قائمة بجميع السور لملء القائمة المنسدلة"""
        return self.quran_handler.get_surahs()

    def quran_search(self, query):
        """البحث في القرآن الكريم بنص معين"""
        return self.quran_handler.search_text(query)

    def quran_get_range(self, surah_id, from_ayah, to_ayah):
        """جلب آيات محددة بناءً على السورة والأرقام"""
        return self.quran_handler.get_range(surah_id, from_ayah, to_ayah)

    def quran_format_insertion(self, ayah_ids, with_citation):
        """تنسيق الآيات بالأقواس والتخريج لإدراجها في الواجهة"""
        return self.quran_handler.format_insertion(ayah_ids, with_citation)

    # ==========================================
    # LLM VISION OCR INTEGRATION
    # ==========================================
    def trigger_llm_ocr(self, project_id, start_idx, end_idx, llm_config):

        project = self.project_manager.load_project(project_id)
        text_config = project.get('metadata', {}).get('text_features', {})

        if not project: return {'ok': False, 'error': 'المشروع غير موجود.'}

        pdf_path = project.get('pdf_path')
        if not pdf_path or not os.path.exists(pdf_path): return {'ok': False, 'error': 'تعذّر العثور على ملف PDF.'}

        try:
            llm_handler = LLMOCRHandler()
            tmp_dir = tempfile.mkdtemp(prefix='llm_ocr_')
            doc = fitz.open(pdf_path)
            total_pages = (end_idx - start_idx) + 1
            
            for current_idx in range(start_idx, end_idx + 1):
                page_ui_num = current_idx + 1
                progress_pct = ((current_idx - start_idx) / total_pages) * 100
                self._emit_paddle_progress('extracting', f"تجهيز صفحة {page_ui_num}...", progress_pct)
                
                # استخراج الصورة (استخدمنا 200 DPI لتقليل حجم الصورة للـ API وتسريع الاستجابة)
                pix = doc.load_page(current_idx).get_pixmap(dpi=200)
                img_path = os.path.join(tmp_dir, f"page_{current_idx}.png")
                pix.save(img_path)

                page_data = project['pages'][current_idx]
                ui_w = (page_data.get('native_width', 0) / 72.0) * 200.0
                ui_h = (page_data.get('native_height', 0) / 72.0) * 200.0

                self._emit_paddle_progress('uploading', f"جاري المسح عبر الذكاء الاصطناعي لصفحة {page_ui_num}...", progress_pct + 10)
                
                result = llm_handler.extract_page(img_path, llm_config)
                
                if not result.get('success'):
                    raise Exception(result.get('error'))
                    
                elements = result.get('data', {}).get('elements', [])
                img_width = result.get('img_width')
                img_height = result.get('img_height')

                new_ocr_data = []
                for el in elements:
                    bbox = el.get('bbox', [0, 0, 0, 0])
                    
                    # ---------------------------------------------------------
                    # Decompression & Scaling (The Magic Fix)
                    # ---------------------------------------------------------
                    # الـ AI يعيد لنا إحداثيات من 0 إلى 1000. 
                    # نقوم بقسمتها على 1000 لنحصل على النسبة المئوية، ثم نضربها في أبعاد واجهتنا (200 DPI).
                    scale_x = ui_w / 1000.0
                    scale_y = ui_h / 1000.0
                    
                    x1 = bbox[0] * scale_x
                    y1 = bbox[1] * scale_y
                    x2 = bbox[2] * scale_x
                    y2 = bbox[3] * scale_y
                    
                    # التأكد من عدم وجود قيم سالبة أو مقلوبة بالخطأ
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

                cleaned_llm_data = self._apply_cleaning_to_elements(new_ocr_data, text_config, page_data, engine_dpi=1000.0)
                project['pages'][current_idx]['ocr_data'] = cleaned_llm_data
                project['pages'][current_idx]['status'] = 'pending'
                self.project_manager.save_raw_ocr(project_id, current_idx, cleaned_llm_data)
                self.project_manager.update_project(project_id, project)

            doc.close()
            self._emit_paddle_progress('completed', 'تمت المعالجة عبر الذكاء الاصطناعي بنجاح!', 100)
            return {'ok': True, 'project': project}

        except Exception as e:
            import traceback
            traceback.print_exc()
            self._emit_paddle_progress('error', str(e), 100)
            return {'ok': False, 'error': str(e)}
        finally:
            import shutil
            shutil.rmtree(tmp_dir, ignore_errors=True)
    
    def _apply_cleaning_to_elements(self, elements, text_config, page_data, engine_dpi=200.0, category_formatting=None):
        """Universal cleaning and structural standardization pass for all OCR outputs."""
        from backend.text_cleaner import ArabicTextCleaner
        cleaner = ArabicTextCleaner(text_config)
        
        # 1. جلب أبعاد المستند الأصلية من الصفحة المعنية
        native_w = float(page_data.get('native_width', 0))
        native_h = float(page_data.get('native_height', 0))
        
        # 2. تحويل وتوحيد هيكلية المصفوفة لتطابق مواصفات معيار السحابة و Google Lens
        standardized_blocks = self.ocr_handler.standardize_page_blocks(
            elements, native_w, native_h, current_dpi=engine_dpi
        )
        
        # 3. تطبيق قواعد تنظيف النصوص وتنسيقات التصنيفات الافتراضية
        cat_fmt_map = category_formatting or (text_config.get('category_formatting', {}) if isinstance(text_config, dict) else {})
        for el in standardized_blocks:
            if 'text' in el and el['text']:
                el['text'] = cleaner.clean(el['text']) 
            cat = el.get('category', 'Text')
            fmt = cat_fmt_map.get(cat, {})
            if fmt:
                if fmt.get('dir'):
                    el['dir'] = fmt['dir']
                if fmt.get('align'):
                    el['align'] = fmt['align']
        return standardized_blocks


    def update_project_metadata(self, project_id, new_metadata):
        """Updates ONLY the metadata using the existing ProjectManager architecture."""
        try:
            # 1. تحميل المشروع باستخدام مدير المشاريع الخاص بك
            project = self.project_manager.load_project(project_id)
            
            # 2. تحديث الإعدادات
            if 'metadata' not in project:
                project['metadata'] = {}
            project['metadata'].update(new_metadata)
            
            # 3. حفظ المشروع مجدداً باستخدام مدير المشاريع
            self.project_manager.update_project(project_id, project)
            
            return {'ok': True}
        except Exception as e:
            print(f"Failed to update metadata: {e}")
            return {'ok': False, 'error': str(e)}

    def reapply_text_processing_to_project(self, project_id):
        """Re-applies the current project text processing rules & category defaults to all pages."""
        try:
            from backend.text_cleaner import ArabicTextCleaner
            project = self.project_manager.load_project(project_id)
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
                        # 1. Clean block text
                        if el.get('text'):
                            el['text'] = cleaner.clean(el['text'])
                        
                        # 2. Apply category formatting direction / alignment defaults if missing
                        fmt = cat_fmt_map.get(cat, {})
                        if fmt:
                            if fmt.get('dir') and not el.get('dir'):
                                el['dir'] = fmt['dir']
                            if fmt.get('align') and not el.get('align'):
                                el['align'] = fmt['align']

                        # 3. Clean table cell text if block is a table
                        if (cat == 'Table' or cat == 'شعر عمودي') and 'table_structure' in el:
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
     
    def auto_layout_table_block(self, project_id, page_index, block_index, extraction_method="auto"):
        return self.table_handler.process_table_layout(project_id, page_index, block_index, extraction_method)

    def repopulate_page_text_from_raw(self, project_id, page_index, layout_blocks):
        """Re-populates text for layout blocks using pristine raw OCR backup while preserving reviewed text."""
        from backend.text_retriever import populate_layout_blocks_text
        raw_ocr = self.project_manager.load_raw_ocr(project_id, page_index)
        updated_blocks = populate_layout_blocks_text(raw_ocr, layout_blocks, preserve_reviewed=True)
        project = self.project_manager.load_project(project_id)
        if project and 'pages' in project and 0 <= page_index < len(project['pages']):
            project['pages'][page_index]['ocr_data'] = updated_blocks
            self.project_manager.update_project(project_id, project)
        return {'ok': True, 'ocr_data': updated_blocks}


    def get_app_data_path(self):
        return self.config_manager.get_data_path()

    def select_app_data_folder(self):
        result = self._window.create_file_dialog(
            webview.FolderDialog,
            allow_multiple=False
        )
        return result[0] if result else None

    def change_app_data_path(self, new_path):
        success, msg = self.config_manager.change_data_path(new_path)
        if success:
            # Re-initialize ProjectManager with new path
            projects_dir = os.path.join(self.config_manager.get_data_path(), 'projects')
            self.project_manager = ProjectManager(projects_dir=projects_dir)
            
            # Re-initialize table handler with new project manager
            self.table_handler = TableHandler(self.project_manager)
            return {'ok': True}
        return {'ok': False, 'error': msg}


def get_resource_path(relative_path):
    """Get absolute path to resource, works for dev and for PyInstaller frozen app"""
    import sys
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), relative_path)

def main():
    api = Api()

    html_path = get_resource_path(os.path.join('frontend', 'index.html'))

    window = webview.create_window(
        'OCR Review Tool',
        url=f'file://{html_path}',
        js_api=api,
        width=1200,
        height=800,
        min_size=(1000, 700), x=None, y=None
    )
    api.set_window(window)
    webview.start(debug=True)


if __name__ == '__main__':
    main()
