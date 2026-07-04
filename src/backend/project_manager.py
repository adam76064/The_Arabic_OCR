import os
import json
import uuid
import shutil
import hashlib
from datetime import datetime


class ProjectManager:
    def __init__(self, projects_dir='projects'):
        self.projects_dir = projects_dir
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

    def load_project(self, project_id):
        path = os.path.join(self.projects_dir, project_id, 'project.json')
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return None

    def list_projects(self):
        projects = []
        for project_id in os.listdir(self.projects_dir):
            project_data = self.load_project(project_id)
            if project_data:
                projects.append({
                    'id': project_data['id'],
                    'title': project_data['metadata'].get('title', 'Untitled'),
                    'author': project_data['metadata'].get('author', 'Unknown'),
                    'created_at': project_data['created_at']
                })
        return projects

    def update_project(self, project_id, project_data):
        self._save_project_file(project_id, project_data)

    def delete_project(self, project_id):
        path = os.path.join(self.projects_dir, project_id)
        if os.path.exists(path):
            shutil.rmtree(path)

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

    def _save_project_file(self, project_id, project_data):
        path = os.path.join(self.projects_dir, project_id, 'project.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(project_data, f, ensure_ascii=False, indent=4)
