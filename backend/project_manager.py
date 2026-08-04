import os
import json
import uuid
import shutil
import hashlib
import threading
from datetime import datetime


class ProjectManager:
    def __init__(self, projects_dir='projects'):
        self.projects_dir = projects_dir
        self.lock = threading.RLock()
        if not os.path.exists(self.projects_dir):
            os.makedirs(self.projects_dir)

    def create_project(self, metadata):
        project_id = str(uuid.uuid4())
        project_path = os.path.join(self.projects_dir, project_id)
        os.makedirs(project_path)
        os.makedirs(os.path.join(project_path, 'images'))

        project_data = {
            'id': project_id,
            'created_at': datetime.now().isoformat(),
            'metadata': metadata,
            'pdf_path': '',
            'pdf_hash': '',
            'pages': [],
            'dictionary': []
        }

        self._save_project_file(project_id, project_data)
        return project_data

    def list_projects(self):
        projects = []
        for project_id in os.listdir(self.projects_dir):
            # Skip floating files like app_settings.json that aren't project folders
            if not os.path.isdir(os.path.join(self.projects_dir, project_id)):
                continue
                
            project_data = self.load_project(project_id)
            
            # Only append if the data successfully loaded and has valid metadata
            if project_data and 'metadata' in project_data:
                projects.append({
                    'id': project_data.get('id', project_id),
                    'title': project_data['metadata'].get('title', 'Untitled'),
                    'author': project_data['metadata'].get('author', 'Unknown'),
                    'created_at': project_data.get('created_at', '')
                })
        return projects
    
    def update_project(self, project_id, project_data):
        self._save_project_file(project_id, project_data)

    def update_project_metadata(self, project_id, new_metadata):
        with self.lock:
            project = self.load_project(project_id)
            if project:
                project['metadata'] = { **project.get('metadata', {}), **new_metadata }
                self._save_project_file(project_id, project)
                return {'ok': True}
            return {'ok': False, 'error': 'Project not found'}

    def delete_project(self, project_id, delete_files=True):
        with self.lock:
            path = os.path.join(self.projects_dir, project_id)
            if os.path.exists(path):
                if delete_files:
                    shutil.rmtree(path, ignore_errors=True)
                else:
                    # Rename project.json to disabled if keeping files on disk
                    proj_file = os.path.join(path, 'project.json')
                    if os.path.exists(proj_file):
                        try:
                            os.rename(proj_file, os.path.join(path, 'project.json.disabled'))
                        except Exception:
                            pass
            return {'ok': True}

    def delete_page(self, project_id, page_index, delete_files=False):
        with self.lock:
            project = self.load_project(project_id)
            if not project or 'pages' not in project:
                return {'ok': False, 'error': 'المشروع غير موجود'}
            
            pages = project.get('pages', [])
            if 0 <= page_index < len(pages):
                removed_page = pages.pop(page_index)
                
                if delete_files:
                    project_dir = os.path.join(self.projects_dir, project_id)
                    images_dir = os.path.join(project_dir, 'images')
                    
                    # 1. Resolve image path against project directory and images subdirectory
                    rel_img = removed_page.get('image_path')
                    pdf_idx = removed_page.get('pdf_index')
                    
                    possible_img_paths = []
                    if rel_img:
                        possible_img_paths.append(os.path.join(images_dir, rel_img))
                        possible_img_paths.append(os.path.join(project_dir, rel_img))
                        if os.path.isabs(rel_img):
                            possible_img_paths.append(rel_img)
                    
                    if pdf_idx is not None:
                        possible_img_paths.append(os.path.join(images_dir, f"page_{pdf_idx}.jpg"))
                        possible_img_paths.append(os.path.join(images_dir, f"page_{pdf_idx}.png"))
                        possible_img_paths.append(os.path.join(images_dir, f"page_{page_index}.jpg"))
                        possible_img_paths.append(os.path.join(images_dir, f"page_{page_index}.png"))
                    
                    for p_path in set(possible_img_paths):
                        if os.path.exists(p_path):
                            try:
                                os.remove(p_path)
                                print(f"[delete_page] Deleted page image: {p_path}")
                            except Exception as e:
                                print(f"[delete_page] Error deleting image {p_path}: {e}")
                                
                    # 2. Resolve raw OCR JSON files
                    raw_dir = os.path.join(project_dir, 'raw_ocr')
                    possible_raw_paths = [
                        os.path.join(raw_dir, f"page_{page_index}.json")
                    ]
                    if pdf_idx is not None:
                        possible_raw_paths.append(os.path.join(raw_dir, f"page_{pdf_idx}.json"))

                    for r_path in set(possible_raw_paths):
                        if os.path.exists(r_path):
                            try:
                                os.remove(r_path)
                                print(f"[delete_page] Deleted raw OCR file: {r_path}")
                            except Exception as e:
                                print(f"[delete_page] Error deleting raw OCR {r_path}: {e}")

                self._save_project_file(project_id, project)
                return {'ok': True, 'pages_left': len(project['pages'])}
            return {'ok': False, 'error': 'رقم الصفحة غير صحيح'}

    @staticmethod
    def hash_password(password):
        salt = os.urandom(16)
        dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 200000)
        return salt.hex() + ':' + dk.hex()

    @staticmethod
    def verify_password(password, stored):
        try:
            salt_hex, hash_hex = stored.split(':')
            salt = bytes.fromhex(salt_hex)
            dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 200000)
            return dk.hex() == hash_hex
        except Exception:
            return False

    # ---------------- App-wide settings ----------------
    # Separate from per-project data: this is a single JSON file that
    # holds cross-page preferences (undo/redo depth, keyboard shortcuts,
    # UI zoom, etc.) so they survive navigating between the app's pages
    # and restarting the app, instead of resetting to defaults on every
    # page load like the in-memory window.__appSettings object does.

    def load_app_settings(self):
        path = os.path.join(self.projects_dir, 'app_settings.json')
        if os.path.exists(path):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}

    def save_app_settings(self, settings):
        path = os.path.join(self.projects_dir, 'app_settings.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(settings, f, ensure_ascii=False, indent=2)
        return True

    def load_project(self, project_id):
        # 👈 تأمين عملية القراءة: لا تقرأ الملف إذا كان هناك من يكتب عليه الآن
        with self.lock: 
            path = os.path.join(self.projects_dir, project_id, 'project.json')
            if os.path.exists(path):
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        return json.load(f)
                except (UnicodeDecodeError, json.JSONDecodeError) as e:
                    print(f"Warning: Project {project_id} is corrupted and will be skipped. ({e})")
                    return None
                except Exception as e:
                    print(f"Unexpected error loading {project_id}: {e}")
                    return None
            return None

    def _save_project_file(self, project_id, project_data):
        # 👈 تأمين عملية الكتابة: ضع أي طلبات حفظ أخرى في طابور الانتظار
        with self.lock: 
            path = os.path.join(self.projects_dir, project_id, 'project.json')
            temp_path = path + '.tmp'
            backup_path = os.path.join(self.projects_dir, project_id, 'project_backup.json')
            
            # إنشاء نسخة احتياطية أولاً
            if os.path.exists(path):
                import shutil
                try:
                    shutil.copy2(path, backup_path)
                except Exception as e:
                    print(f"Warning: Failed to create backup: {e}")
            
            # الكتابة الآمنة (Atomic Write) في ملف مؤقت أولاً
            with open(temp_path, 'w', encoding='utf-8') as f:
                json.dump(project_data, f, ensure_ascii=False, indent=4)
                f.flush()
                os.fsync(f.fileno()) # إجبار نظام التشغيل على الحفظ الفوري في القرص الصلب
                
            # استبدال الملف القديم بالجديد بضربة واحدة آمنة
            os.replace(temp_path, path)

    # ---------------- Raw OCR Backup Handling ----------------

    def save_raw_ocr(self, project_id, page_index, raw_ocr_data):
        """Saves a pristine backup of original OCR output for a specific page."""
        with self.lock:
            raw_dir = os.path.join(self.projects_dir, project_id, 'raw_ocr')
            os.makedirs(raw_dir, exist_ok=True)
            path = os.path.join(raw_dir, f'page_{page_index}.json')
            temp_path = path + '.tmp'
            with open(temp_path, 'w', encoding='utf-8') as f:
                json.dump(raw_ocr_data, f, ensure_ascii=False, indent=4)
                f.flush()
                os.fsync(f.fileno())
            os.replace(temp_path, path)

    def load_raw_ocr(self, project_id, page_index):
        """Loads pristine raw OCR data for a page. Fallbacks to current page ocr_data if not found."""
        with self.lock:
            path = os.path.join(self.projects_dir, project_id, 'raw_ocr', f'page_{page_index}.json')
            if os.path.exists(path):
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        return json.load(f)
                except Exception as e:
                    print(f"Failed to load raw_ocr for page {page_index}: {e}")
            
            # Fallback: load project and snapshot current ocr_data if available
            project = self.load_project(project_id)
            if project and 'pages' in project and 0 <= page_index < len(project['pages']):
                return project['pages'][page_index].get('ocr_data', [])
            return []


