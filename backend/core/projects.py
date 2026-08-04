"""
ProjectManager - handles project CRUD, atomic JSON writes, raw_ocr backups.

Cleaned version of original project_manager.py:
- Thread-safe via RLock
- Atomic writes (tmp + fsync + replace)
- Backup copy
- Same public API preserved for compatibility.
"""
import os
import json
import uuid
import shutil
import hashlib
import threading
from datetime import datetime


class ProjectManager:
    def __init__(self, projects_dir="projects"):
        self.projects_dir = projects_dir
        self.lock = threading.RLock()
        if not os.path.exists(self.projects_dir):
            os.makedirs(self.projects_dir)

    # --- Creation / Listing ---
    def create_project(self, metadata: dict):
        project_id = str(uuid.uuid4())
        project_path = os.path.join(self.projects_dir, project_id)
        os.makedirs(project_path)
        os.makedirs(os.path.join(project_path, "images"))

        project_data = {
            "id": project_id,
            "created_at": datetime.now().isoformat(),
            "metadata": metadata,
            "pdf_path": "",
            "pdf_hash": "",
            "pages": [],
            "dictionary": [],
        }
        self._save_project_file(project_id, project_data)
        return project_data

    def list_projects(self):
        projects = []
        if not os.path.exists(self.projects_dir):
            return projects
        for project_id in os.listdir(self.projects_dir):
            full = os.path.join(self.projects_dir, project_id)
            if not os.path.isdir(full):
                continue
            data = self.load_project(project_id)
            if data and "metadata" in data:
                projects.append(
                    {
                        "id": data.get("id", project_id),
                        "title": data["metadata"].get("title", "Untitled"),
                        "author": data["metadata"].get("author", "Unknown"),
                        "created_at": data.get("created_at", ""),
                    }
                )
        return projects

    def load_project(self, project_id):
        with self.lock:
            path = os.path.join(self.projects_dir, project_id, "project.json")
            if os.path.exists(path):
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        return json.load(f)
                except (UnicodeDecodeError, json.JSONDecodeError) as e:
                    print(f"[Projects] Corrupted {project_id}: {e}")
                    return None
                except Exception as e:
                    print(f"[Projects] Unexpected error {project_id}: {e}")
                    return None
            return None

    def update_project(self, project_id, project_data):
        self._save_project_file(project_id, project_data)

    def update_project_metadata(self, project_id, new_metadata):
        with self.lock:
            project = self.load_project(project_id)
            if project:
                project["metadata"] = {**project.get("metadata", {}), **new_metadata}
                self._save_project_file(project_id, project)
                return {"ok": True}
            return {"ok": False, "error": "Project not found"}

    # --- Deletion ---
    def delete_project(self, project_id, delete_files=True):
        with self.lock:
            path = os.path.join(self.projects_dir, project_id)
            if os.path.exists(path):
                if delete_files:
                    shutil.rmtree(path, ignore_errors=True)
                else:
                    proj_file = os.path.join(path, "project.json")
                    if os.path.exists(proj_file):
                        try:
                            os.rename(proj_file, os.path.join(path, "project.json.disabled"))
                        except Exception:
                            pass
            return {"ok": True}

    def delete_page(self, project_id, page_index, delete_files=False):
        with self.lock:
            project = self.load_project(project_id)
            if not project or "pages" not in project:
                return {"ok": False, "error": "المشروع غير موجود"}

            pages = project.get("pages", [])
            if 0 <= page_index < len(pages):
                removed_page = pages.pop(page_index)

                if delete_files:
                    project_dir = os.path.join(self.projects_dir, project_id)
                    images_dir = os.path.join(project_dir, "images")
                    rel_img = removed_page.get("image_path")
                    pdf_idx = removed_page.get("pdf_index")

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
                            except Exception as e:
                                print(f"[delete_page] img deletion error {p_path}: {e}")

                    raw_dir = os.path.join(project_dir, "raw_ocr")
                    possible_raw_paths = [os.path.join(raw_dir, f"page_{page_index}.json")]
                    if pdf_idx is not None:
                        possible_raw_paths.append(os.path.join(raw_dir, f"page_{pdf_idx}.json"))

                    for r_path in set(possible_raw_paths):
                        if os.path.exists(r_path):
                            try:
                                os.remove(r_path)
                            except Exception as e:
                                print(f"[delete_page] raw deletion error {r_path}: {e}")

                self._save_project_file(project_id, project)
                return {"ok": True, "pages_left": len(project["pages"])}
            return {"ok": False, "error": "رقم الصفحة غير صحيح"}

    # --- Password hashing ---
    @staticmethod
    def hash_password(password: str):
        salt = os.urandom(16)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200000)
        return salt.hex() + ":" + dk.hex()

    @staticmethod
    def verify_password(password: str, stored: str):
        try:
            salt_hex, hash_hex = stored.split(":")
            salt = bytes.fromhex(salt_hex)
            dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200000)
            return dk.hex() == hash_hex
        except Exception:
            return False

    # --- App settings (global) ---
    def load_app_settings(self):
        path = os.path.join(self.projects_dir, "app_settings.json")
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}

    def save_app_settings(self, settings):
        path = os.path.join(self.projects_dir, "app_settings.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(settings, f, ensure_ascii=False, indent=2)
        return True

    # --- Internal atomic save ---
    def _save_project_file(self, project_id, project_data):
        with self.lock:
            path = os.path.join(self.projects_dir, project_id, "project.json")
            temp_path = path + ".tmp"
            backup_path = os.path.join(self.projects_dir, project_id, "project_backup.json")

            if os.path.exists(path):
                try:
                    shutil.copy2(path, backup_path)
                except Exception as e:
                    print(f"[Projects] Backup failed: {e}")

            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(project_data, f, ensure_ascii=False, indent=4)
                f.flush()
                os.fsync(f.fileno())
            os.replace(temp_path, path)

    # --- Raw OCR backups ---
    def save_raw_ocr(self, project_id, page_index, raw_ocr_data):
        with self.lock:
            raw_dir = os.path.join(self.projects_dir, project_id, "raw_ocr")
            os.makedirs(raw_dir, exist_ok=True)
            path = os.path.join(raw_dir, f"page_{page_index}.json")
            temp_path = path + ".tmp"
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(raw_ocr_data, f, ensure_ascii=False, indent=4)
                f.flush()
                os.fsync(f.fileno())
            os.replace(temp_path, path)

    def load_raw_ocr(self, project_id, page_index):
        with self.lock:
            path = os.path.join(self.projects_dir, project_id, "raw_ocr", f"page_{page_index}.json")
            if os.path.exists(path):
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        return json.load(f)
                except Exception as e:
                    print(f"[Projects] Failed load raw_ocr page {page_index}: {e}")

            project = self.load_project(project_id)
            if project and "pages" in project and 0 <= page_index < len(project["pages"]):
                return project["pages"][page_index].get("ocr_data", [])
            return []
