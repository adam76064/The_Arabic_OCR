import os
import getpass
import webview
from backend.project_manager import ProjectManager
from backend.pdf_processor import PDFProcessor
from backend.ocr_handler import OCRHandler
from backend.exporter import export_json, export_txt, export_docx
from backend.lan_discovery import LANDiscovery
from backend.lan_sync import LANSyncServer, LANSyncClient


class Api:
    def __init__(self):
        self.project_manager = ProjectManager()
        self.pdf_processor = PDFProcessor()
        self.ocr_handler = OCRHandler()
        self._window = None
        self.lan_discovery = LANDiscovery()
        self.lan_server = None          # LANSyncServer when hosting
        self.lan_client = None          # LANSyncClient when joined as guest
        self.username = getpass.getuser()

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
        metadata['lan_enabled'] = bool(metadata.get('lan_enabled'))
        if metadata['lan_enabled'] and lan_password:
            metadata['lan_password_hash'] = ProjectManager.hash_password(lan_password)

        project = self.project_manager.create_project(metadata)
        project_id = project['id']

        hashes = self.pdf_processor.get_pdf_hashes(pdf_path)
        project['pdf_path'] = pdf_path
        project['pdf_hash'] = hashes['sha256']
        project['pdf_hashes'] = hashes

        output_dir = os.path.join(self.project_manager.projects_dir, project_id, 'images')

        pages = self.pdf_processor.process_pdf(pdf_path, output_dir)
        project['pages'] = pages

        self.project_manager.update_project(project_id, project)
        if metadata['lan_enabled']:
            self.start_lan_sharing(project_id, lan_password=lan_password)
        return project

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

    def scan_lan_projects(self, timeout=3):
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

    def broadcast_page_update(self, project_id, page_index, ocr_data):
        # Called after a local edit so connected LAN peers get it in real time
        if self.lan_server:
            self.lan_server.broadcast_update(page_index, ocr_data, self.username)
        if self.lan_client:
            self.lan_client.send_update(page_index, ocr_data, self.username)

    def request_lan_file(self, filename):
        if self.lan_client:
            return self.lan_client.request_file(filename)
        return None

    def _push_update_to_frontend(self, payload):
        if self._window:
            import json as _json
            self._window.evaluate_js(f"window.onLanUpdate && window.onLanUpdate({_json.dumps(payload)})")

    def load_project(self, project_id):
        return self.project_manager.load_project(project_id)

    def get_projects(self):
        return self.project_manager.list_projects()

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
        with open(ocr_json_path, 'r', encoding='utf-8') as f:
            ocr_content = f.read()

        elements = self.ocr_handler.parse_dots_ocr(ocr_content, text_config=text_config)

        if page_index is not None:
            project['pages'][page_index]['ocr_data'] = elements

        self.project_manager.update_project(project_id, project)
        return project

    def update_page_ocr(self, project_id, page_index, ocr_data):
        project = self.project_manager.load_project(project_id)
        project['pages'][page_index]['ocr_data'] = ocr_data
        self.project_manager.update_project(project_id, project)
        self.broadcast_page_update(project_id, page_index, ocr_data)
        return True

    def delete_project(self, project_id):
        self.project_manager.delete_project(project_id)
        return True

    # ───── Export ─────

    def export_project(self, project_id, fmt, page_indices, opts=None):
        """fmt: 'json' | 'txt' | 'docx'  page_indices: list of ints (0-based)"""
        project = self.project_manager.load_project(project_id)
        safe_title = (project['metadata'].get('title') or 'export').replace(' ', '_')[:40]
        out_dir = os.path.join(self.project_manager.projects_dir, project_id)

        filters = {
            'json': ('JSON files (*.json)', 'All files (*.*)'),
            'txt':  ('Text files (*.txt)',  'All files (*.*)'),
            'docx': ('Word files (*.docx)', 'All files (*.*)'),
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

        if fmt == 'json':
            return export_json(project, page_indices, output_path)
        elif fmt == 'txt':
            return export_txt(project, page_indices, output_path,
                              logical_start=project['metadata'].get('logical_start', 1))
        elif fmt == 'docx':
            return export_docx(project, page_indices, output_path, opts)
        return None


def main():
    api = Api()

    html_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'frontend', 'index.html')

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
