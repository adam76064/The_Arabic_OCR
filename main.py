"""
Main entry - slim version using new organized backend/app/api.
"""
import os
import sys
import webview

from backend.app.api import Api, cleanup_old_residue
from backend.app.api import cleanup_old_residue as _cleanup

def get_resource_path(relative_path):
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), relative_path)

def main():
    # Cleanup temp residue from previous runs
    try:
        _cleanup()
    except Exception:
        pass

    api = Api()
    html_path = get_resource_path(os.path.join('frontend', 'index.html'))

    window = webview.create_window(
        'OCR Review Tool - Arabic OCR',
        url=f'file://{html_path}',
        js_api=api,
        width=1280,
        height=800,
        min_size=(1000, 700),
    )
    api.set_window(window)
    webview.start(debug=True)

if __name__ == '__main__':
    main()
