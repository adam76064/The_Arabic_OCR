"""
Main entry - slim version using new organized backend/app/api.
"""
import os
import sys
import glob
import json
import logging
import warnings
import urllib.parse
from threading import Thread

# --- Ensure pythonnet / clr_loader can resolve Python.Runtime.dll on Windows ---
if sys.platform == 'win32':
    _candidate_dirs = []
    if hasattr(sys, '_MEIPASS'):
        _candidate_dirs.extend([sys._MEIPASS, os.path.join(sys._MEIPASS, '_internal')])
    if getattr(sys, 'frozen', False):
        _exe_dir = os.path.dirname(sys.executable)
        _candidate_dirs.extend([_exe_dir, os.path.join(_exe_dir, '_internal')])
    _candidate_dirs.append(os.path.dirname(os.path.abspath(__file__)))

    for _cdir in _candidate_dirs:
        if os.path.isdir(_cdir):
            if hasattr(os, 'add_dll_directory'):
                try:
                    os.add_dll_directory(_cdir)
                except Exception:
                    pass
            if 'PYTHONNET_PYDLL' not in os.environ:
                _matched_dlls = glob.glob(os.path.join(_cdir, 'python3*.dll'))
                if _matched_dlls:
                    os.environ['PYTHONNET_PYDLL'] = _matched_dlls[0]

# Suppress noisy library dependency warnings (e.g. urllib3 / requests version mismatch)
warnings.filterwarnings('ignore', category=Warning, module='requests')

# --- Bypass Protobuf strict runtime version validation ---
# Prevents VersionError when gencode version is newer than runtime version across environments
try:
    import google.protobuf.runtime_version
    google.protobuf.runtime_version.ValidateProtobufRuntimeVersion = lambda *args, **kwargs: None
except Exception:
    pass

import webview
import webview.util
from backend.app.api import Api
from backend.app.api import cleanup_old_residue as _cleanup

# Configure persistent multi-destination logging
import platform
import shutil
from pathlib import Path
from logging.handlers import RotatingFileHandler

def get_log_file_path():
    if sys.platform == 'win32':
        base = os.getenv('APPDATA') or os.path.join(str(Path.home()), 'AppData', 'Roaming')
        log_dir = os.path.join(base, 'The_Arabic_OCR', 'logs')
    elif sys.platform == 'darwin':
        log_dir = os.path.expanduser('~/Library/Logs/The_Arabic_OCR')
    else:
        log_dir = os.path.expanduser('~/.local/share/The_Arabic_OCR/logs')
    try:
        os.makedirs(log_dir, exist_ok=True)
        return os.path.join(log_dir, 'app.log')
    except Exception:
        return os.path.join(os.path.dirname(os.path.abspath(__file__)), 'app.log')

LOG_FILE = get_log_file_path()

_handlers = []
try:
    _file_handler = RotatingFileHandler(LOG_FILE, maxBytes=10 * 1024 * 1024, backupCount=3, encoding='utf-8')
    _file_handler.setFormatter(logging.Formatter('[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s'))
    _handlers.append(_file_handler)
except Exception:
    pass

if sys.stdout is not None:
    _stream_handler = logging.StreamHandler(sys.stdout)
    _stream_handler.setFormatter(logging.Formatter('[%(levelname)s] [%(name)s]: %(message)s'))
    _handlers.append(_stream_handler)

logging.basicConfig(level=logging.INFO, handlers=_handlers or None)
logger = logging.getLogger('TheArabicOCR')

def show_native_message_box(title, message, icon='error'):
    """Show a native GUI alert when window or critical subsystem fails."""
    if sys.platform == 'win32':
        try:
            import ctypes
            # 0x10 = MB_ICONERROR, 0x30 = MB_ICONWARNING, 0x40 = MB_ICONINFORMATION
            flag = 0x10 if icon == 'error' else (0x30 if icon == 'warning' else 0x40)
            ctypes.windll.user32.MessageBoxW(0, message, title, flag | 0x0)
            return
        except Exception:
            pass
    elif sys.platform == 'darwin':
        try:
            import subprocess
            icon_str = 'stop' if icon == 'error' else 'caution'
            subprocess.run([
                'osascript', '-e',
                f'display dialog "{message}" with title "{title}" buttons {{"OK"}} default button "OK" with icon {icon_str}'
            ], check=False)
            return
        except Exception:
            pass
    elif sys.platform.startswith('linux'):
        try:
            import subprocess
            if shutil.which('zenity'):
                opt = '--error' if icon == 'error' else '--warning'
                subprocess.run(['zenity', opt, f'--title={title}', f'--text={message}'], check=False)
                return
            elif shutil.which('kdialog'):
                opt = '--error' if icon == 'error' else '--sorry'
                subprocess.run(['kdialog', opt, message, '--title', title], check=False)
                return
        except Exception:
            pass

    if sys.stderr:
        print(f"[{title}] {message}", file=sys.stderr)

def _global_exception_handler(exc_type, exc_value, exc_traceback):
    if issubclass(exc_type, KeyboardInterrupt):
        sys.__excepthook__(exc_type, exc_value, exc_traceback)
        return
    logger.critical("Unhandled top-level exception:", exc_info=(exc_type, exc_value, exc_traceback))
    show_native_message_box(
        "The Arabic OCR - Critical Error",
        f"An unexpected error occurred and the application must close.\n\n"
        f"{exc_type.__name__}: {exc_value}\n\n"
        f"Diagnostic details have been saved to:\n{LOG_FILE}",
        icon='error'
    )

sys.excepthook = _global_exception_handler

def log_system_diagnostics():
    logger.info("==========================================")
    logger.info("Starting The Arabic OCR")
    logger.info("Platform: %s (%s, %s)", sys.platform, platform.platform(), platform.machine())
    logger.info("Python: %s (%s)", sys.version.split()[0], sys.executable)
    logger.info("Frozen bundle: %s", getattr(sys, 'frozen', False))
    logger.info("Log path: %s", LOG_FILE)

    if sys.platform == 'win32':
        # Check Edge WebView2 Runtime in Windows Registry
        try:
            import winreg
            wv2_ver = None
            for root in [winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER]:
                for subkey in [
                    r"SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-2870-4104-8522-4293077E08CE}",
                    r"SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-2870-4104-8522-4293077E08CE}",
                ]:
                    try:
                        with winreg.OpenKey(root, subkey) as k:
                            val, _ = winreg.QueryValueEx(k, "pv")
                            if val:
                                wv2_ver = val
                                break
                    except Exception:
                        pass
                if wv2_ver:
                    break
            if wv2_ver:
                logger.info("Microsoft Edge WebView2 detected: %s", wv2_ver)
            else:
                logger.warning("Microsoft Edge WebView2 is NOT detected in Windows registry!")
        except Exception as e:
            logger.debug("WebView2 registry check error: %s", e)
    logger.info("==========================================")

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
                logger.error("Error executing %s: %s", func_name, e, exc_info=True)
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
            except BaseException:
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
    log_system_diagnostics()

    try:
        _cleanup()
    except Exception as e:
        logger.debug("Cleanup residue error: %s", e)

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

    # Platform-specific GUI engine fallback sequence
    if sys.platform.startswith('linux'):
        gui_engines = ['qt', 'gtk', None]
    elif sys.platform == 'darwin':
        gui_engines = [None, 'cocoa', 'qt']
    else:
        # On Windows: Try modern Edge Chromium, then Qt (Chromium), then WinForms, then MSHTML
        gui_engines = [None, 'edgechromium', 'qt', 'winforms', 'mshtml']

    started = False
    for gui_engine in gui_engines:
        try:
            logger.info("Attempting to start GUI with engine: '%s'", gui_engine or "default")
            if gui_engine:
                webview.start(debug=False, gui=gui_engine)
            else:
                webview.start(debug=False)
            started = True
            break
        except Exception as e:
            logger.warning("Failed to start webview with GUI engine '%s': %s", gui_engine, e, exc_info=True)
            continue

    if not started:
        error_msg = (
            "Could not initialize any supported display engine (WebView).\n\n"
            "Possible causes:\n"
            "1. Microsoft Edge WebView2 Runtime is missing or disabled.\n"
            "2. Microsoft Visual C++ 2015-2022 Redistributable is missing.\n\n"
            f"Detailed diagnostic logs have been saved to:\n{LOG_FILE}"
        )
        logger.critical(error_msg)
        show_native_message_box("The Arabic OCR - Display Engine Error", error_msg, icon='error')
        sys.exit(1)

if __name__ == '__main__':
    main()
