"""
post_processing — rule-based post-OCR enhancement modules.

Includes:
  - reading_order: automatic sorting of OCR bounding boxes to Arabic reading order (Top-to-Bottom, Right-to-Left).
"""
from .manager import PostProcessingManager

__all__ = ["PostProcessingManager"]
