"""
Main entry - slim version using new organized backend/app/api.
Fixes pywebview WinForms logging OSError on Windows and handles valid file URIs.
Patches pywebview race condition on Windows where early JS API calls execute before window.shown is set.
"""
import os
import sys
import logging
import warnings
from pathlib import Path

# Silence third-party dependency warnings (e.g. requests / urllib3 mismatch on newer Python versions)
warnings.filterwarnings('ignore')

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
import webview.window
import webview.util

# Global reference to the main window
_active_window = None

# --- Fix pywebview WinForms / Chromium early IPC race condition ---
# EdgeChromium starts and fires JS API calls before WinForms dispatches Form.Shown.
# We unwrap evaluate_js and ensure window.shown is set so early calls return immediately without freezing.
try:
    if hasattr(webview, 'window') and hasattr(webview.window, 'Window'):
        _orig_evaluate_js = webview.window.Window.evaluate_js
        _unwrapped_evaluate_js = getattr(_orig_evaluate_js, '__wrapped__', _orig_evaluate_js)

        def _safe_evaluate_js(self, script, callback=None):
            if hasattr(self, 'shown') and hasattr(self.shown, 'set'):
                self.shown.set()
            try:
                return _unwrapped_evaluate_js(self, script, callback)
            except Exception:
                return _orig_evaluate_js(self, script, callback)

        webview.window.Window.evaluate_js = _safe_evaluate_js

    # Also wrap webview.util._call to guarantee window.shown is set whenever JS calls Python
    if hasattr(webview, 'util') and hasattr(webview.util, '_call'):
        _orig_util_call = webview.util._call

        def _safe_util_call(func_name, param, value_id):
            global _active_window
            if _active_window and hasattr(_active_window, 'shown') and hasattr(_active_window.shown, 'set'):
                _active_window.shown.set()
            return _orig_util_call(func_name, param, value_id)

        webview.util._call = _safe_util_call
except Exception:
    pass

from backend.app.api import Api
from backend.app.api import cleanup_old_residue as _cleanup

def get_resource_path(relative_path):
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), relative_path)

def main():
    global _active_window
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
    _active_window = window

    # Ensure window.shown is set immediately so early calls from Chromium never block or fail
    if hasattr(window, 'shown') and hasattr(window.shown, 'set'):
        window.shown.set()

    # Double layer safety: also patch instance evaluate_js
    try:
        _inst_evaluate_js = window.evaluate_js
        _unwrapped_inst = getattr(_inst_evaluate_js, '__wrapped__', _inst_evaluate_js)

        def _safe_inst_evaluate_js(script, callback=None):
            if hasattr(window, 'shown') and hasattr(window.shown, 'set'):
                window.shown.set()
            try:
                return _unwrapped_inst(script, callback)
            except Exception:
                return _inst_evaluate_js(script, callback)

        window.evaluate_js = _safe_inst_evaluate_js
    except Exception:
        pass

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
