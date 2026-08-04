"""
Main entry - slim version using new organized backend/app/api.
Fixes pywebview WinForms logging OSError on Windows when stdout is not available.
"""
import os
import sys
import logging

# --- Fix pywebview logging flood that causes OSError [WinError 1] on WinForms ---
# pywebview's util.py does logger.debug(...) which tries to write to stderr.
# When app is run without console (WinForms via pythonw), stderr handle is invalid -> OSError.
# We silence all webview loggers and replace handlers with NullHandler to prevent "Logging error" tracebacks.
try:
    for name in ['webview', 'webview.platforms.winforms', 'webview.platforms.edgechromium', 'webview.util']:
        lg = logging.getLogger(name)
        lg.handlers = [logging.NullHandler()]
        lg.setLevel(logging.CRITICAL)
        lg.propagate = False
    logging.getLogger().handlers = [logging.NullHandler()]
    logging.basicConfig(level=logging.CRITICAL, handlers=[logging.NullHandler()])
    # Prevent logging module from trying to print its own errors to stderr
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
        # pywebview 4.x keeps logger in webview module? try both
        if hasattr(webview, 'logger'):
            webview.logger.disabled = False
            webview.logger.setLevel(logging.WARNING)
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
    # debug=True re-enabled so user can see JS console / inspect (right-click)
    # Logging is already silenced above with NullHandler + CRITICAL + raiseExceptions=False,
    # so the WinForms OSError flood won't happen even with debug=True.
    webview.start(debug=True)

if __name__ == '__main__':
    main()
