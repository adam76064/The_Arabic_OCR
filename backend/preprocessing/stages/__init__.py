"""
Stages package for ScanTailor Advanced pre-processing pipeline.
"""
from .base import BaseStage, image_to_numpy, numpy_to_base64_jpeg, numpy_to_base64_png
from .orientation import OrientationStage
from .split import PageSplitStage
from .deskew import DeskewStage
from .content import ContentSelectionStage
from .layout import PageLayoutStage
from .output import OutputStage

__all__ = [
    "BaseStage",
    "OrientationStage",
    "PageSplitStage",
    "DeskewStage",
    "ContentSelectionStage",
    "PageLayoutStage",
    "OutputStage",
    "image_to_numpy",
    "numpy_to_base64_jpeg",
    "numpy_to_base64_png",
]
