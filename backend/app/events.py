"""
events.py - handles pushing progress / updates from Python to JS frontend.
Small helper to avoid scattering evaluate_js calls everywhere.
"""
import json


class EventEmitter:
    def __init__(self, window_getter):
        """
        window_getter: callable returning pywebview window or None
        """
        self._window_getter = window_getter

    def _window(self):
        try:
            return self._window_getter()
        except Exception:
            return None

    def _emit(self, js_fn: str, payload: dict | str):
        w = self._window()
        if not w:
            return
        try:
            if isinstance(payload, str):
                data = payload
            else:
                data = json.dumps(payload, ensure_ascii=False)
            w.evaluate_js(f"window.{js_fn} && window.{js_fn}({data})")
        except Exception:
            pass

    def pdf_progress(self, stage: str, current: int, total: int):
        self._emit("onPdfProgress", {"stage": stage, "current": current, "total": total})

    def ocr_progress(self, stage: str, message: str, percentage: float = 0):
        # to keep backward compat, support both object and positional string
        try:
            w = self._window()
            if not w:
                return
            payload = json.dumps({"stage": stage, "message": message, "percentage": percentage})
            w.evaluate_js(f"window.onPaddleProgress && window.onPaddleProgress({payload})")
            # also legacy signature: onPaddleProgress(msg, percent) was used in paddle client
            # but our event uses object; paddle client still calls evaluate_js directly.
        except Exception:
            pass

    def lan_update(self, payload: dict):
        self._emit("onLanUpdate", payload)
