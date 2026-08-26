"""
content.py — Stage 4: Select Content (Auto content box detection & interactive bounding box).
"""
from typing import Any, Dict, Optional, Tuple, Union
import cv2
import numpy as np

from .base import BaseStage

try:
    import stalib
    HAS_STALIB = True
except ImportError:
    HAS_STALIB = False


class ContentSelectionStage(BaseStage):
    """
    Stage 4: Select Content.
    Detects the bounding rectangle containing text/illustrations and trims blank borders.
    """

    def __init__(self):
        super().__init__("content")

    def get_default_params(self) -> Dict[str, Any]:
        return {
            "content_rect": None,  # {'x': 0, 'y': 0, 'width': w, 'height': h} or None
            "auto_detect": True,
            "padding": 10,         # Padding around detected content in px
            "apply_crop": False,   # If True, returns cropped image; else returns image + bbox metadata
        }

    def detect_content_rect(
        self,
        image_np: np.ndarray,
        dpi: int = 300,
        padding: int = 10,
    ) -> Dict[str, float]:
        """
        Detect bounding rectangle of main content.
        """
        h, w = image_np.shape[:2]
        full_rect = {"x": 0.0, "y": 0.0, "width": float(w), "height": float(h)}

        if HAS_STALIB and hasattr(stalib, "ContentSelector"):
            try:
                selector = stalib.ContentSelector()
                res = selector.process(image_np, dpi_x=dpi, dpi_y=dpi)
                c_rect = getattr(res, "content_rect", None)
                if c_rect and isinstance(c_rect, dict) and c_rect.get("width", 0) > 20 and c_rect.get("height", 0) > 20:
                    x = max(0.0, float(c_rect.get("x", 0.0)) - padding)
                    y = max(0.0, float(c_rect.get("y", 0.0)) - padding)
                    width = min(float(w) - x, float(c_rect.get("width", w)) + 2 * padding)
                    height = min(float(h) - y, float(c_rect.get("height", h)) + 2 * padding)
                    return {"x": x, "y": y, "width": width, "height": height}
            except Exception:
                pass

        # Fallback content box detection using morphological gradient
        try:
            gray = cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY) if len(image_np.shape) == 3 else image_np
            # Otsu thresholding
            thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
            
            # Remove black scanning borders by ignoring outer 2%
            margin_x = int(w * 0.02)
            margin_y = int(h * 0.02)
            inner_thresh = np.zeros_like(thresh)
            inner_thresh[margin_y:h-margin_y, margin_x:w-margin_x] = thresh[margin_y:h-margin_y, margin_x:w-margin_x]

            # Dilate to connect text lines
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 15))
            dilated = cv2.dilate(inner_thresh, kernel, iterations=2)

            contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if contours:
                # Find union bounding box of significant contours
                min_x, min_y = w, h
                max_x, max_y = 0, 0
                found = False
                for cnt in contours:
                    area = cv2.contourArea(cnt)
                    if area > (w * h * 0.001):  # Ignore tiny specks
                        bx, by, bw, bh = cv2.boundingRect(cnt)
                        min_x = min(min_x, bx)
                        min_y = min(min_y, by)
                        max_x = max(max_x, bx + bw)
                        max_y = max(max_y, by + bh)
                        found = True

                if found and max_x > min_x and max_y > min_y:
                    x = max(0.0, float(min_x) - padding)
                    y = max(0.0, float(min_y) - padding)
                    width = min(float(w) - x, float(max_x - min_x) + 2 * padding)
                    height = min(float(h) - y, float(max_y - min_y) + 2 * padding)
                    return {"x": x, "y": y, "width": width, "height": height}
        except Exception:
            pass

        return full_rect

    def process(
        self,
        image_np: np.ndarray,
        params: Optional[Dict[str, Any]] = None,
        dpi: int = 300,
    ) -> Dict[str, Any]:
        p = self.get_default_params()
        if params:
            p.update(params)

        h, w = image_np.shape[:2]
        content_rect = p.get("content_rect")
        padding = int(p.get("padding", 10))
        apply_crop = p.get("apply_crop", False)

        detected_rect = self.detect_content_rect(image_np, dpi=dpi, padding=padding)

        if content_rect and isinstance(content_rect, dict):
            ref_w = float(content_rect.get("ref_width") or content_rect.get("canvas_width") or w)
            ref_h = float(content_rect.get("ref_height") or content_rect.get("canvas_height") or h)

            scale_x = float(w) / ref_w if ref_w > 0 else 1.0
            scale_y = float(h) / ref_h if ref_h > 0 else 1.0

            raw_x = float(content_rect.get("x", 0.0)) * scale_x
            raw_y = float(content_rect.get("y", 0.0)) * scale_y
            raw_w = float(content_rect.get("width", w)) * scale_x
            raw_h = float(content_rect.get("height", h)) * scale_y

            x = float(np.clip(raw_x, 0.0, max(0.0, w - 10)))
            y = float(np.clip(raw_y, 0.0, max(0.0, h - 10)))
            width = float(np.clip(raw_w, 10.0, w - x))
            height = float(np.clip(raw_h, 10.0, h - y))
            final_rect = {"x": x, "y": y, "width": width, "height": height}
        elif content_rect and isinstance(content_rect, (list, tuple)) and len(content_rect) == 4:
            x = float(np.clip(content_rect[0], 0.0, max(0.0, w - 10)))
            y = float(np.clip(content_rect[1], 0.0, max(0.0, h - 10)))
            width = float(np.clip(content_rect[2], 10.0, w - x))
            height = float(np.clip(content_rect[3], 10.0, h - y))
            final_rect = {"x": x, "y": y, "width": width, "height": height}
        else:
            final_rect = detected_rect

        if apply_crop:
            x = max(0, min(int(final_rect["x"]), w - 10))
            y = max(0, min(int(final_rect["y"]), h - 10))
            cw = max(10, min(int(final_rect["width"]), w - x))
            ch = max(10, min(int(final_rect["height"]), h - y))
            
            # If the crop rect covers almost the entire image (already cropped), avoid redundant slicing
            if x <= 2 and y <= 2 and abs(cw - w) <= 4 and abs(ch - h) <= 4:
                cropped = image_np.copy()
            else:
                cropped = image_np[y:y+ch, x:x+cw].copy()

            return {
                "image": cropped,
                "metadata": {
                    "content_rect": final_rect,
                    "detected_rect": detected_rect,
                    "page_rect": {"x": 0.0, "y": 0.0, "width": float(cw), "height": float(ch)},
                    "is_content_selected": True,
                    "is_cropped": True,
                },
            }

        return {
            "image": image_np.copy(),
            "metadata": {
                "content_rect": final_rect,
                "detected_rect": detected_rect,
                "page_rect": {"x": 0.0, "y": 0.0, "width": float(w), "height": float(h)},
                "is_content_selected": True,
                "is_cropped": False,
            },
        }
