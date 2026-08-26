"""
Main entry - slim version using new organized backend/app/api.
Fixes pywebview WinForms logging OSError on Windows and handles valid file URIs.
"""
import os
import sys
import logging
import warnings
from pathlib import Path

# Silence third-party dependency warnings (e.g. requests / urllib3 mismatch on newer Python versions)
warnings.filterwarnings('ignore', category=Warning)

# --- Fix pywebview logging flood that causes OSError [WinError 1] on WinForms ---
# pywebview's util.py does logger.debug(...) which tries to write to stderr.
# When app is run without console (WinForms via pythonw), stderr handle is invalid -> OSError.
# We silence all webview loggers and replace handlers with NullHandler to prevent "Logging error" tracebacks.
try:
    for name in ['webview', 'webview.platforms.winforms', 'webview.platforms.edgechromium', 'webview.util', 'requests', 'urllib3']:
        lg = logging.getLogger(name)
        lg.handlers = [logging.NullHandler()]
        lg.setLevel(logging.CRITICAL)
        lg.propagate = False
    logging.getLogger().handlers = [logging.NullHandler()]
    logging.basicConfig(level=logging.CRITICAL, handlers=[logging.NullHandler()])
    logging.raiseExceptions = False
except Exception:
    pass

import webview

from backend.app.api import Api
from backend.app.api import cleanup_old_residue as _cleanup

def get_resource_path(relative_path):
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), relative_path)

def main():
    try:
        _cleanup()
    except Exception:
        pass

    # Extra safety: ensure webview logger is quiet before start
    try:
        if hasattr(webview, 'logger'):
            webview.logger.disabled = False
            webview.logger.setLevel(logging.WARNING)
    except Exception:
        pass

    api = Api()
    raw_html_path = get_resource_path(os.path.join('frontend', 'index.html'))
    # Use proper Path.resolve().as_uri() to guarantee valid file:/// URI on all platforms (Windows, Linux, macOS)
    html_uri = Path(raw_html_path).resolve().as_uri()

    window = webview.create_window(
        'OCR Review Tool - Arabic OCR',
        url=html_uri,
        js_api=api,
        width=1280,
        height=800,
        min_size=(1000, 700),
    )
    api.set_window(window)
    
    # Start webview with debug enabled and safe fallback
    try:
        webview.start(debug=True)
    except Exception:
        try:
            webview.start()
        except Exception as e:
            print(f"[Main] Failed to start webview window: {e}")

if __name__ == '__main__':
    main()
