"""
split.py — Stage 2: Page Split (Auto split, single/spread detection, sloped cutter line, subpage extraction).
"""
from typing import Any, Dict, List, Optional, Tuple
import cv2
import numpy as np

from .base import BaseStage

try:
    import stalib
    import stalib_cpp
    HAS_STALIB = True
except ImportError:
    HAS_STALIB = False


class PageSplitStage(BaseStage):
    """
    Stage 2: Page Split.
    Detects single page vs book spread (double page).
    Provides 2-point sloped cutter line ((x1, y1), (x2, y2)) and subpage splitting.
    """

    def __init__(self):
        super().__init__("split")

    def get_default_params(self) -> Dict[str, Any]:
        return {
            "layout_type": "auto",  # 'auto', 'single_page', 'two_pages'
            "split_line": None,     # Optional [ [x1, y1], [x2, y2] ]
            "split_direction": "rtl",  # 'rtl' (Arabic: right page first) or 'ltr'
            "apply_split": False,   # If True in pipeline, returns list of images
        }

    def estimate_split(
        self,
        image_np: np.ndarray,
        layout_type: str = "auto",
        dpi: int = 300,
    ) -> Dict[str, Any]:
        """
        Estimate cutter line without splitting the image.
        """
        h, w = image_np.shape[:2]
        default_mid = w / 2.0
        default_line = [[float(default_mid), 0.0], [float(default_mid), float(h)]]

        if HAS_STALIB and hasattr(stalib, "PageSplitter"):
            try:
                splitter = stalib.PageSplitter(layout_type=layout_type)
                res = splitter.process(image_np, dpi_x=dpi, dpi_y=dpi)
                
                # Check detected cutter line
                cutter = getattr(res, "inscribed_cutter_lines", None) or getattr(res, "cutter_lines", None)
                res_type = str(getattr(res, "type", "single_page"))

                line = default_line
                if cutter and len(cutter) > 0:
                    c = cutter[0]
                    # c is ((x1, y1), (x2, y2))
                    line = [[float(c[0][0]), float(c[0][1])], [float(c[1][0]), float(c[1][1])]]

                num_pages = int(getattr(res, "num_sub_pages", 1))
                is_two_pages = "two_pages" in res_type or num_pages == 2 or (layout_type == "two_pages")
                
                return {
                    "is_two_pages": is_two_pages,
                    "split_line": line,
                    "num_sub_pages": 2 if is_two_pages else 1,
                    "type": "two_pages" if is_two_pages else "single_page",
                    "width": w,
                    "height": h,
                }
            except Exception:
                pass

        # Fallback estimation via vertical projection / aspect ratio
        is_two_pages = layout_type == "two_pages" or (layout_type == "auto" and w >= h * 1.05)
        if is_two_pages:
            # Simple valley detection around center 20%
            gray = cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY) if len(image_np.shape) == 3 else image_np
            # Vertical projection profile
            mid_start = int(w * 0.35)
            mid_end = int(w * 0.65)
            proj = np.mean(gray[:, mid_start:mid_end], axis=0)
            valley_idx = int(np.argmin(proj)) + mid_start
            line = [[float(valley_idx), 0.0], [float(valley_idx), float(h)]]
        else:
            line = default_line

        return {
            "is_two_pages": is_two_pages,
            "split_line": line,
            "num_sub_pages": 2 if is_two_pages else 1,
            "type": "two_pages" if is_two_pages else "single_page",
            "width": w,
            "height": h,
        }

    def split_image(
        self,
        image_np: np.ndarray,
        split_line: Optional[List[List[float]]] = None,
        direction: str = "rtl",
    ) -> List[np.ndarray]:
        """
        Split image along vertical or sloped split_line.
        Returns [right_page, left_page] if RTL, else [left_page, right_page].
        """
        h, w = image_np.shape[:2]
        if not split_line or len(split_line) < 2:
            split_line = [[w / 2.0, 0.0], [w / 2.0, float(h)]]

        p1 = split_line[0]  # [x1, y1] (top)
        p2 = split_line[1]  # [x2, y2] (bottom)
        x1, y1 = float(p1[0]), float(p1[1])
        x2, y2 = float(p2[0]), float(p2[1])

        # If vertical split (or close to vertical)
        if abs(x1 - x2) < 2.0:
            split_x = int(np.clip((x1 + x2) / 2.0, 10, w - 10))
            left_img = image_np[:, :split_x]
            right_img = image_np[:, split_x:]
        else:
            # Sloped split line using polygon masks
            # Left polygon: (0,0) -> (x1, y1) -> (x2, y2) -> (0, h)
            # Right polygon: (x1, y1) -> (w, 0) -> (w, h) -> (x2, y2)
            max_x = max(x1, x2)
            min_x = min(x1, x2)
            left_cut_w = int(np.clip(max_x, 10, w))
            right_cut_start = int(np.clip(min_x, 0, w - 10))

            left_img = image_np[:, :left_cut_w].copy()
            right_img = image_np[:, right_cut_start:].copy()

        if direction.lower() == "rtl":
            return [right_img, left_img]
        return [left_img, right_img]

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
        layout_type = p.get("layout_type", "auto")
        split_line = p.get("split_line")
        direction = p.get("split_direction", "rtl")
        apply_split = p.get("apply_split", False)

        # 1. Estimate if line not provided
        estimation = self.estimate_split(image_np, layout_type=layout_type, dpi=dpi)

        if split_line and isinstance(split_line, (list, tuple)) and len(split_line) >= 2:
            ref_w = float(p.get("ref_width") or p.get("canvas_width") or w)
            ref_h = float(p.get("ref_height") or p.get("canvas_height") or h)
            scale_x = float(w) / ref_w if ref_w > 0 else 1.0
            scale_y = float(h) / ref_h if ref_h > 0 else 1.0

            x1 = float(split_line[0][0]) * scale_x
            y1 = float(split_line[0][1]) * scale_y
            x2 = float(split_line[1][0]) * scale_x
            y2 = float(split_line[1][1]) * scale_y
            active_line = [[x1, y1], [x2, y2]]
        else:
            active_line = estimation["split_line"]

        is_two_pages = estimation["is_two_pages"] if layout_type == "auto" else (layout_type == "two_pages")

        if apply_split and is_two_pages:
            sub_pages = self.split_image(image_np, active_line, direction=direction)
            return {
                "image": sub_pages,
                "metadata": {
                    "is_two_pages": True,
                    "split_line": active_line,
                    "num_sub_pages": len(sub_pages),
                    "split_direction": direction,
                    "width": w,
                    "height": h,
                },
            }

        return {
            "image": image_np.copy(),
            "metadata": {
                "is_two_pages": is_two_pages,
                "split_line": active_line,
                "num_sub_pages": 2 if is_two_pages else 1,
                "split_direction": direction,
                "width": w,
                "height": h,
            },
        }
