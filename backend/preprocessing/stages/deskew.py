"""
deskew.py — Stage 3: Deskew (Auto skew detection & manual fine angle rotation).
"""
from typing import Any, Dict, Optional, Tuple
import cv2
import numpy as np

from .base import BaseStage

try:
    import stalib
    HAS_STALIB = True
except ImportError:
    HAS_STALIB = False


class DeskewStage(BaseStage):
    """
    Stage 3: Deskew.
    Detects text line skew automatically and applies micro-rotation with white background padding.
    """

    def __init__(self):
        super().__init__("deskew")

    def get_default_params(self) -> Dict[str, Any]:
        return {
            "angle": None,       # Manual angle in degrees, or None for auto-detect
            "auto_detect": True, # If True and angle is None, runs auto-detection
            "manual": False,     # Set to True when user manually moves slider
        }

    def detect_skew_angle(self, image_np: np.ndarray, dpi: int = 300) -> Tuple[float, float]:
        """
        Detect skew angle in degrees and confidence (0.0 to 1.0) using stalib or Hough lines.
        """
        # 1. Try stalib DeskewProcessor
        if HAS_STALIB and hasattr(stalib, "DeskewProcessor"):
            try:
                proc = stalib.DeskewProcessor()
                res = proc.find_skew(image_np, dpi_x=dpi, dpi_y=dpi)
                angle = float(getattr(res, "angle", 0.0))
                confidence = float(getattr(res, "confidence", 1.0))
                if abs(angle) > 0.05:
                    return float(np.clip(angle, -45.0, 45.0)), confidence
            except Exception:
                pass

        # 2. Fast & robust Hough Lines text baseline detector
        try:
            gray = cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY) if len(image_np.shape) == 3 else image_np.copy()
            h, w = gray.shape[:2]

            # Downsample large images for speed
            scale = 1.0
            if max(h, w) > 1600:
                scale = 1600.0 / max(h, w)
                small_gray = cv2.resize(gray, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
            else:
                small_gray = gray

            # Edge detection
            edges = cv2.Canny(small_gray, 50, 200, apertureSize=3)
            lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=80, minLineLength=int(60 * scale), maxLineGap=int(10 * scale))

            if lines is not None and len(lines) > 0:
                angles = []
                for line in lines:
                    x1, y1, x2, y2 = line[0]
                    dx = x2 - x1
                    dy = y2 - y1
                    if dx == 0:
                        continue
                    deg = np.degrees(np.arctan2(dy, dx))
                    # Only consider near-horizontal text lines (-30° to +30°)
                    if -30.0 <= deg <= 30.0:
                        angles.append(deg)

                if len(angles) >= 3:
                    median_deg = float(np.median(angles))
                    # Round to 2 decimals
                    return float(round(np.clip(median_deg, -30.0, 30.0), 2)), 0.85

            # 3. Fallback to minAreaRect on foreground contours
            thresh = cv2.threshold(small_gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
            pts = np.column_stack(np.where(thresh > 0))
            if len(pts) > 100:
                rect_angle = cv2.minAreaRect(pts)[-1]
                if rect_angle < -45:
                    rect_angle = -(90 + rect_angle)
                elif rect_angle > 45:
                    rect_angle = 90 - rect_angle
                else:
                    rect_angle = -rect_angle
                if -25.0 <= rect_angle <= 25.0:
                    return float(round(np.clip(rect_angle, -25.0, 25.0), 2)), 0.6
        except Exception:
            pass

        return 0.0, 0.0

    def apply_deskew(
        self,
        image_np: np.ndarray,
        angle: float,
        dpi: int = 300,
    ) -> np.ndarray:
        """
        Rotate image by angle in degrees with pure white background fill.
        Skips micro-rotations (<0.15°) to avoid repeated interpolation blur and canvas expansion.
        """
        if abs(angle) < 0.15:
            return image_np.copy()

        if HAS_STALIB and hasattr(stalib, "DeskewProcessor"):
            try:
                proc = stalib.DeskewProcessor(angle_deg=angle)
                res_img = proc.process(image_np, dpi_x=dpi, dpi_y=dpi)
                if isinstance(res_img, np.ndarray) and res_img.size > 0:
                    return res_img
            except Exception:
                pass

        # OpenCV rotation
        h, w = image_np.shape[:2]
        center = (w / 2.0, h / 2.0)
        rot_mat = cv2.getRotationMatrix2D(center, angle, 1.0)

        # Expand canvas size to avoid clipping text
        cos_val = np.abs(rot_mat[0, 0])
        sin_val = np.abs(rot_mat[0, 1])
        new_w = int((h * sin_val) + (w * cos_val))
        new_h = int((h * cos_val) + (w * sin_val))

        rot_mat[0, 2] += (new_w / 2.0) - center[0]
        rot_mat[1, 2] += (new_h / 2.0) - center[1]

        deskewed = cv2.warpAffine(
            image_np,
            rot_mat,
            (new_w, new_h),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_CONSTANT,
            borderValue=(255, 255, 255) if len(image_np.shape) == 3 else 255,
        )
        return deskewed

    def process(
        self,
        image_np: np.ndarray,
        params: Optional[Dict[str, Any]] = None,
        dpi: int = 300,
    ) -> Dict[str, Any]:
        p = self.get_default_params()
        if params:
            p.update(params)

        manual = p.get("manual", False)
        manual_angle = p.get("angle")
        auto_detect = p.get("auto_detect", True)

        detected_angle, confidence = self.detect_skew_angle(image_np, dpi=dpi)

        # If angle is explicitly provided, use it; otherwise run auto-detection
        if manual_angle is not None and manual_angle != "":
            effective_angle = float(manual_angle)
        elif auto_detect:
            effective_angle = detected_angle
        else:
            effective_angle = 0.0

        effective_angle = float(np.clip(effective_angle, -45.0, 45.0))
        # If noise angle < 0.15°, treat as zero
        if abs(effective_angle) < 0.15:
            effective_angle = 0.0

        deskewed = self.apply_deskew(image_np, effective_angle, dpi=dpi)
        was_rotated = abs(effective_angle) >= 0.15

        return {
            "image": deskewed,
            "metadata": {
                "angle": effective_angle,
                "detected_angle": detected_angle,
                "confidence": confidence,
                "is_deskewed": True,
                "was_rotated": was_rotated,
            },
        }
