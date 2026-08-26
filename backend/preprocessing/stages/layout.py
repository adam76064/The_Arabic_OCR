"""
layout.py — Stage 5: Page Layout & Margins (Margin rulers, alignments, standardize page dimensions).
"""
from typing import Any, Dict, Optional, Tuple
import cv2
import numpy as np

from .base import BaseStage

try:
    import stalib
    import stalib_cpp
    HAS_STALIB = True
except ImportError:
    HAS_STALIB = False


class PageLayoutStage(BaseStage):
    """
    Stage 5: Page Layout.
    Takes the selected content area and adds white margins strictly OUTSIDE of it,
    creating a clean, standardized page without cutting into or overwriting text blocks.
    Supports 'match_size' (ScanTailor Advanced) to standardize all pages to the widest page.
    """

    def __init__(self):
        super().__init__("layout")

    def get_default_params(self) -> Dict[str, Any]:
        return {
            "margins": {
                "top": 10.0,
                "bottom": 10.0,
                "left": 15.0,
                "right": 15.0,
                "unit": "mm",  # 'mm' or 'px'
            },
            "alignment": {
                "horizontal": "CENTER",  # 'CENTER', 'LEFT', 'RIGHT'
                "vertical": "CENTER",    # 'CENTER', 'TOP', 'BOTTOM'
            },
            "match_size": True,
            "max_content_width": None,
            "max_content_height": None,
            "apply_layout": False,
        }

    def mm_to_px(self, mm_val: float, dpi: int = 300) -> int:
        """Convert millimeters to pixels at given DPI (1 inch = 25.4 mm)."""
        return max(0, int(round((float(mm_val) / 25.4) * dpi)))

    def process(
        self,
        image_np: np.ndarray,
        params: Optional[Dict[str, Any]] = None,
        dpi: int = 300,
    ) -> Dict[str, Any]:
        p = self.get_default_params()
        if params:
            if "margins" in params and isinstance(params["margins"], dict):
                p["margins"].update(params["margins"])
            if "alignment" in params and isinstance(params["alignment"], dict):
                p["alignment"].update(params["alignment"])
            for k in ["match_size", "max_content_width", "max_content_height", "apply_layout", "content_rect"]:
                if k in params:
                    p[k] = params[k]

        h, w = image_np.shape[:2]
        margins_dict = p.get("margins", {})
        align_dict = p.get("alignment", {})
        content_rect = p.get("content_rect")
        apply_layout = p.get("apply_layout", False)
        match_size = p.get("match_size", True)

        unit = margins_dict.get("unit", "mm")
        if unit == "mm":
            m_top = self.mm_to_px(margins_dict.get("top", 10.0), dpi)
            m_bottom = self.mm_to_px(margins_dict.get("bottom", 10.0), dpi)
            m_left = self.mm_to_px(margins_dict.get("left", 15.0), dpi)
            m_right = self.mm_to_px(margins_dict.get("right", 15.0), dpi)
        else:
            m_top = max(0, int(margins_dict.get("top", 30)))
            m_bottom = max(0, int(margins_dict.get("bottom", 30)))
            m_left = max(0, int(margins_dict.get("left", 45)))
            m_right = max(0, int(margins_dict.get("right", 45)))

        # 1. Resolve Content Bounding Box
        if content_rect and isinstance(content_rect, dict) and int(content_rect.get("width", 0)) > 20:
            cx = max(0, int(content_rect.get("x", 0)))
            cy = max(0, int(content_rect.get("y", 0)))
            cw = int(content_rect.get("width", w))
            ch = int(content_rect.get("height", h))
        else:
            # If no content_rect passed, detect non-white content area to avoid compounding existing margins
            try:
                gray = cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY) if len(image_np.shape) == 3 else image_np
                non_white = np.where(gray < 250)
                if len(non_white[0]) > 50:
                    min_y, max_y = int(np.min(non_white[0])), int(np.max(non_white[0]))
                    min_x, max_x = int(np.min(non_white[1])), int(np.max(non_white[1]))
                    cx, cy = max(0, min_x - 4), max(0, min_y - 4)
                    cw = min(w - cx, (max_x - min_x) + 8)
                    ch = min(h - cy, (max_y - min_y) + 8)
                else:
                    cx, cy, cw, ch = 0, 0, w, h
            except Exception:
                cx, cy, cw, ch = 0, 0, w, h

        # Clamp content box to image boundaries
        cx = min(cx, max(0, w - 1))
        cy = min(cy, max(0, h - 1))
        cw = max(10, min(cw, w - cx))
        ch = max(10, min(ch, h - cy))

        # 2. Match size across pages (widest / tallest page standard)
        max_cw = cw
        max_ch = ch
        if match_size:
            if p.get("max_content_width"):
                max_cw = max(cw, int(p["max_content_width"]))
            if p.get("max_content_height"):
                max_ch = max(ch, int(p["max_content_height"]))

        # Target canvas dimensions = effective max content dimensions + outer margins
        new_w = max_cw + m_left + m_right
        new_h = max_ch + m_top + m_bottom

        # 3. If applying layout, extract content box and pad margins OUTSIDE
        if apply_layout:
            # Crop the content area
            crop_content = image_np[cy:cy + ch, cx:cx + cw].copy()

            # Allocate pure white canvas
            if len(image_np.shape) == 3:
                padded = np.ones((new_h, new_w, image_np.shape[2]), dtype=np.uint8) * 255
            else:
                padded = np.ones((new_h, new_w), dtype=np.uint8) * 255

            h_align = str(align_dict.get("horizontal", "CENTER")).upper()
            v_align = str(align_dict.get("vertical", "CENTER")).upper()

            # Horizontal placement within (max_cw + margins)
            if h_align == "LEFT":
                dst_x = m_left
            elif h_align == "RIGHT":
                dst_x = new_w - m_right - cw
            else:  # CENTER
                dst_x = m_left + max(0, (max_cw - cw) // 2)

            # Vertical placement within (max_ch + margins)
            if v_align == "TOP":
                dst_y = m_top
            elif v_align == "BOTTOM":
                dst_y = new_h - m_bottom - ch
            else:  # CENTER
                dst_y = m_top + max(0, (max_ch - ch) // 2)

            dst_x = max(0, min(dst_x, new_w - cw))
            dst_y = max(0, min(dst_y, new_h - ch))

            # Paste content onto pure white canvas
            padded[dst_y:dst_y + ch, dst_x:dst_x + cw] = crop_content
            out_image = padded
        else:
            dst_x, dst_y = 0, 0
            out_image = image_np.copy()

        return {
            "image": out_image,
            "metadata": {
                "margins_px": {"top": m_top, "bottom": m_bottom, "left": m_left, "right": m_right},
                "margins_mm": {
                    "top": float(margins_dict.get("top", 10.0)),
                    "bottom": float(margins_dict.get("bottom", 10.0)),
                    "left": float(margins_dict.get("left", 15.0)),
                    "right": float(margins_dict.get("right", 15.0)),
                },
                "alignment": align_dict,
                "match_size": match_size,
                "target_width": new_w,
                "target_height": new_h,
                "max_content_width": max_cw,
                "max_content_height": max_ch,
                "content_rect": {"x": cx, "y": cy, "width": cw, "height": ch},
                "content_placement": {"x": dst_x, "y": dst_y, "width": cw, "height": ch},
                "is_layout_applied": bool(apply_layout),
            },
        }
