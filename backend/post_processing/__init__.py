"""
post_processing — rule-based post-OCR enhancement modules.

Includes:
  - reading_order: automatic sorting of OCR bounding boxes to Arabic reading order (Top-to-Bottom, Right-to-Left).
  - pagination: automatic cross-page page number detection and category="Page-number" labelling.
"""
from .manager import PostProcessingManager

__all__ = ["PostProcessingManager"]
