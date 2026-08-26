"""
output.py — Stage 6: Output / Binarization (None, ZigZag, Otsu, Sauvola, Wolf, Despeckle).
"""
from typing import Any, Dict, Optional, Tuple
import cv2
import numpy as np

from .base import BaseStage
from .zigzag import process as zigzag_process

try:
    import stalib
    import stalib_cpp
    HAS_STALIB = True
except ImportError:
    HAS_STALIB = False


class OutputStage(BaseStage):
    """
    Stage 6: Output Processing & Binarization.
    Supports None (default, preserves scan), ZigZag (official ACM DocEng'24 Bloechle algorithm),
    Otsu, Sauvola, and Wolf algorithms, illumination flattening, despeckling, and stroke adjustment.
    """

    def __init__(self):
        super().__init__("output")

    def get_default_params(self) -> Dict[str, Any]:
        return {
            "mode": "bw",                       # 'bw', 'color_grayscale', 'mixed'
            "binarization": "none",             # 'none' (default), 'zigzag', 'otsu', 'sauvola', 'wolf'
            "threshold_adjustment": 0,          # -100 to +100 (thinner < 0 < thicker)
            "sauvola_k": 0.34,                  # 0.1 to 0.6
            "sauvola_window": 51,               # odd integer (15 to 101)
            "wolf_k": 0.30,                     # 0.1 to 0.6
            "wolf_window": 51,                  # odd integer (15 to 101)
            "zigzag_detail": 30,                # Window size (5 to 120, default 30)
            "zigzag_intensity": 0,              # Threshold offset (-50 to +50, default 0)
            "zigzag_weight": 90.0,              # Background weight percentage (40 to 100, default 90)
            "normalize_illumination": True,     # Flatten background shadows
            "despeckle": 0.0,                   # Despeckle intensity (0.0 to 5.0)
            "morphological_smoothing": False,
            "savitzky_golay_smoothing": False,
            "fill_margins": True,
            "posterize": False,
            "posterize_level": 16,
        }

    # ── OpenCV / NumPy Helper Algorithms ───────────────────────────────────

    def _normalize_illumination_cv(self, gray: np.ndarray) -> np.ndarray:
        """Equalize illumination background by division with morphological background estimate."""
        kernel_size = max(25, int(min(gray.shape) * 0.05) | 1)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
        bg = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, kernel)
        bg = np.maximum(bg, 1)
        norm = np.clip((gray.astype(np.float32) / bg.astype(np.float32)) * 255.0, 0, 255).astype(np.uint8)
        return norm

    def _sauvola_cv(self, gray: np.ndarray, window_size: int = 51, k: float = 0.34, thresh_adj: int = 0) -> np.ndarray:
        """Pure-NumPy / OpenCV fast Sauvola thresholding."""
        w = window_size if window_size % 2 == 1 else window_size + 1
        gray_f = gray.astype(np.float32)
        mean = cv2.boxFilter(gray_f, -1, (w, w), borderType=cv2.BORDER_REPLICATE)
        sqmean = cv2.boxFilter(gray_f * gray_f, -1, (w, w), borderType=cv2.BORDER_REPLICATE)
        variance = np.maximum(sqmean - (mean * mean), 0.0)
        stddev = np.sqrt(variance)

        R = 128.0
        T = mean * (1.0 + k * ((stddev / R) - 1.0))
        if thresh_adj != 0:
            T += (thresh_adj * 1.28)

        binary = np.where(gray_f >= T, 255, 0).astype(np.uint8)
        return binary

    def _wolf_cv(self, gray: np.ndarray, window_size: int = 51, k: float = 0.30, thresh_adj: int = 0) -> np.ndarray:
        """Wolf-Jolion local adaptive binarization for degraded documents."""
        w = window_size if window_size % 2 == 1 else window_size + 1
        gray_f = gray.astype(np.float32)
        mean = cv2.boxFilter(gray_f, -1, (w, w), borderType=cv2.BORDER_REPLICATE)
        sqmean = cv2.boxFilter(gray_f * gray_f, -1, (w, w), borderType=cv2.BORDER_REPLICATE)
        variance = np.maximum(sqmean - (mean * mean), 0.0)
        stddev = np.sqrt(variance)

        min_I = float(np.min(gray_f))
        max_s = float(np.max(stddev)) if np.max(stddev) > 0 else 1.0

        T = mean - k * (1.0 - (stddev / max_s)) * (mean - min_I)
        if thresh_adj != 0:
            T += (thresh_adj * 1.28)

        binary = np.where(gray_f >= T, 255, 0).astype(np.uint8)
        return binary

    def _despeckle_cv(self, binary: np.ndarray, radius: float = 1.0) -> np.ndarray:
        """Remove small speckles from binary image."""
        if radius <= 0.2:
            return binary
        k_size = int(max(1, round(radius))) * 2 + 1
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k_size, k_size))
        clean = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
        return clean

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
        mode = str(p.get("mode", "bw")).lower()
        binarization = str(p.get("binarization", "none")).lower()
        thresh_adj = int(p.get("threshold_adjustment", 0))
        norm_illum = bool(p.get("normalize_illumination", True))
        despeckle_val = float(p.get("despeckle", 0.0))
        sauvola_k = float(p.get("sauvola_k", 0.34))
        sauvola_window = int(p.get("sauvola_window", 51))
        wolf_k = float(p.get("wolf_k", 0.30))
        wolf_window = int(p.get("wolf_window", 51))
        zigzag_detail = int(p.get("zigzag_detail", 30))
        zigzag_intensity = int(p.get("zigzag_intensity", thresh_adj))
        zigzag_weight = float(p.get("zigzag_weight", 90.0))

        # ── 1. Default: NONE (Preserve clean input image) ────────────────────
        if binarization in ["none", "off", "disable", "disabled"]:
            return {
                "image": image_np,
                "metadata": {
                    "mode": mode,
                    "binarization": "none",
                },
            }

        # ── 2. Official Bloechle ZigZag Algorithm ───────────────────────────
        if binarization == "zigzag":
            rgb_in = cv2.cvtColor(image_np, cv2.COLOR_BGR2RGB) if len(image_np.shape) == 3 else cv2.cvtColor(image_np, cv2.COLOR_GRAY2RGB)
            zz_mode = "gray" if mode in ["gray", "color_grayscale"] else "binary"
            zz_out, info = zigzag_process(
                rgb_in,
                mode=zz_mode,
                size=zigzag_detail,
                weight=zigzag_weight,
                upsample=False,
                threshold_offset=zigzag_intensity,
            )
            if despeckle_val > 0.1 and zz_mode == "binary":
                zz_out = self._despeckle_cv(zz_out, radius=despeckle_val)

            out_bgr = cv2.cvtColor(zz_out, cv2.COLOR_GRAY2BGR) if len(zz_out.shape) == 2 else cv2.cvtColor(zz_out, cv2.COLOR_RGB2BGR)
            return {
                "image": out_bgr,
                "metadata": {
                    "mode": mode,
                    "binarization": "zigzag",
                    "zigzag_detail": zigzag_detail,
                    "zigzag_intensity": zigzag_intensity,
                    "zigzag_weight": zigzag_weight,
                    "zigzag_info": info,
                },
            }

        # ── 3. Stalib OutputProcessor if available ──────────────────────────
        if HAS_STALIB and hasattr(stalib, "OutputProcessor") and hasattr(stalib_cpp, "output") and binarization in ["otsu", "sauvola", "wolf"]:
            try:
                op = stalib.OutputProcessor(
                    mode=mode,
                    binarization=binarization,
                    despeckle=despeckle_val,
                    dpi=dpi,
                )
                op.params.threshold_adjustment = thresh_adj
                op.params.normalize_illumination = norm_illum
                op.params.sauvola_k = sauvola_k
                op.params.sauvola_window = sauvola_window
                op.params.wolf_k = wolf_k
                op.params.wolf_window = wolf_window
                op.params.morphological_smoothing = bool(p.get("morphological_smoothing", False))
                op.params.savitzky_golay_smoothing = bool(p.get("savitzky_golay_smoothing", False))
                op.params.fill_margins = bool(p.get("fill_margins", True))

                c_rect = {"x": 0.0, "y": 0.0, "width": float(w), "height": float(h)}
                p_rect = {"x": 0.0, "y": 0.0, "width": float(w), "height": float(h)}
                res = op.process(image_np, c_rect, p_rect)
                primary = getattr(res, "primary", None)
                if isinstance(primary, np.ndarray) and primary.size > 0:
                    if len(primary.shape) == 2:
                        primary_bgr = cv2.cvtColor(primary, cv2.COLOR_GRAY2BGR)
                    else:
                        primary_bgr = primary
                    return {
                        "image": primary_bgr,
                        "metadata": {
                            "mode": mode,
                            "binarization": binarization,
                            "threshold_adjustment": thresh_adj,
                        },
                    }
            except Exception:
                pass

        # ── 4. OpenCV / NumPy Fallback Pipeline ──────────────────────────────
        gray = cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY) if len(image_np.shape) == 3 else image_np.copy()

        if norm_illum:
            gray = self._normalize_illumination_cv(gray)

        if mode == "color_grayscale":
            out = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
            return {"image": out, "metadata": {"mode": mode, "binarization": "none"}}

        if binarization == "sauvola":
            binary = self._sauvola_cv(gray, window_size=sauvola_window, k=sauvola_k, thresh_adj=thresh_adj)
        elif binarization == "wolf":
            binary = self._wolf_cv(gray, window_size=wolf_window, k=wolf_k, thresh_adj=thresh_adj)
        else:  # 'otsu'
            otsu_thresh, _ = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            eff_thresh = np.clip(otsu_thresh + (thresh_adj * 1.28), 10, 245)
            _, binary = cv2.threshold(gray, eff_thresh, 255, cv2.THRESH_BINARY)

        # Despeckle filter
        if despeckle_val > 0.1:
            binary = self._despeckle_cv(binary, radius=despeckle_val)

        out_bgr = cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR)
        return {
            "image": out_bgr,
            "metadata": {
                "mode": mode,
                "binarization": binarization,
                "threshold_adjustment": thresh_adj,
            },
        }
