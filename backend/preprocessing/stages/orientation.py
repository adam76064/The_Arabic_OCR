"""
orientation.py — Stage 1: Fix Orientation (0°, 90°, 180°, 270°).
"""
from typing import Any, Dict, Optional
import cv2
import numpy as np

from .base import BaseStage

try:
    import stalib
    HAS_STALIB = True
except ImportError:
    HAS_STALIB = False


class OrientationStage(BaseStage):
    """
    Stage 1: Fix Orientation.
    Rotates image by 0, 90, 180, or 270 degrees clockwise.
    """

    def __init__(self):
        super().__init__("orientation")

    def get_default_params(self) -> Dict[str, Any]:
        return {
            "rotation": 0,  # 0, 90, 180, 270
            "auto_detect": False,
        }

    def process(
        self,
        image_np: np.ndarray,
        params: Optional[Dict[str, Any]] = None,
        dpi: int = 300,
    ) -> Dict[str, Any]:
        p = self.get_default_params()
        if params:
            p.update(params)

        rotation = int(p.get("rotation", 0)) % 360
        # Normalize to 0, 90, 180, 270
        valid_rotations = [0, 90, 180, 270]
        if rotation not in valid_rotations:
            # Round to nearest 90
            rotation = min(valid_rotations, key=lambda x: abs(x - rotation))

        if rotation == 0:
            return {
                "image": image_np.copy(),
                "metadata": {"rotation": 0, "detected_rotation": 0},
            }

        # Try stalib first
        if HAS_STALIB and hasattr(stalib, "FixOrientationProcessor"):
            try:
                proc = stalib.FixOrientationProcessor(rotation)
                rotated = proc.process(image_np)
                return {
                    "image": rotated,
                    "metadata": {"rotation": rotation, "detected_rotation": rotation},
                }
            except Exception:
                pass

        # OpenCV Fallback
        if rotation == 90:
            rotated = cv2.rotate(image_np, cv2.ROTATE_90_CLOCKWISE)
        elif rotation == 180:
            rotated = cv2.rotate(image_np, cv2.ROTATE_180)
        elif rotation == 270:
            rotated = cv2.rotate(image_np, cv2.ROTATE_90_COUNTERCLOCKWISE)
        else:
            rotated = image_np.copy()

        return {
            "image": rotated,
            "metadata": {"rotation": rotation, "detected_rotation": rotation},
        }
