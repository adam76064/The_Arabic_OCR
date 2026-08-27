"""
Main entry - slim version using new organized backend/app/api.
Fixes pywebview WinForms logging OSError on Windows when stdout is not available.
"""
import os
import sys
import json
import logging
import warnings
import urllib.parse
from threading import Thread

# Suppress dependency warnings (e.g. urllib3 / requests version mismatch on Python 3.12-3.14)
warnings.filterwarnings('ignore')

import webview
import webview.util
from backend.app.api import Api
from backend.app.api import cleanup_old_residue as _cleanup

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

# --- Patch pywebview js_bridge_call for safe page navigation ---
# When the frontend navigates (window.location.href), pending asynchronous calls in Python threads
# may finish after the previous page has unloaded, causing evaluate_js to fail with:
# "TypeError: Cannot read properties of undefined (reading '<value_id>')"
# We wrap the JS return callback with a presence check and safe exception handler.
_original_js_bridge_call = getattr(webview.util, 'js_bridge_call', None)

def _safe_js_bridge_call(window, func_name, param, value_id):
    def get_nested_attribute(obj, attr_str):
        for attr in attr_str.split('.'):
            obj = getattr(obj, attr, None)
            if obj is None:
                return None
        return obj

    if func_name in ('pywebviewMoveWindow', 'pywebviewEventHandler', 'pywebviewAsyncCallback', 'pywebviewStateUpdate', 'pywebviewStateDelete'):
        if _original_js_bridge_call:
            return _original_js_bridge_call(window, func_name, param, value_id)
        return

    func = window._functions.get(func_name) or get_nested_attribute(window._js_api, func_name)

    if func is not None:
        def _call():
            try:
                result = func(*param)
                result = json.dumps(result).replace('\\', '\\\\').replace("'", "\\'")
                retval = f"{{value: '{result}'}}"
            except Exception as e:
                error = {'message': str(e), 'name': type(e).__name__}
                result = json.dumps(error).replace('\\', '\\\\').replace("'", "\\'")
                retval = f"{{isError: true, value: '{result}'}}"

            try:
                safe_code = (
                    f'if (window.pywebview && window.pywebview._returnValuesCallbacks && '
                    f'window.pywebview._returnValuesCallbacks["{func_name}"] && '
                    f'window.pywebview._returnValuesCallbacks["{func_name}"]["{value_id}"]) {{ '
                    f'window.pywebview._returnValuesCallbacks["{func_name}"]["{value_id}"]({retval}); '
                    f'}}'
                )
                window.evaluate_js(safe_code)
            except Exception:
                pass

        Thread(target=_call).start()
    elif _original_js_bridge_call:
        _original_js_bridge_call(window, func_name, param, value_id)

try:
    webview.util.js_bridge_call = _safe_js_bridge_call
except Exception:
    pass

def get_resource_path(relative_path):
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), relative_path)

def main():
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
    webview.start(debug=False)

if __name__ == '__main__':
    main()
