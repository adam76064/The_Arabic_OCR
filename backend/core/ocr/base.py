"""
base.py - defines OCR Adapter interface and common result container.
"""
from typing import List, Dict, Any, Protocol


class OCRAdapter(Protocol):
    """All OCR engines should implement extract or similar."""

    def extract(self, image_path: str, **kwargs) -> Dict[str, Any]:
        ...


class OCRResult:
    """Normalized result wrapper: blocks + meta"""

    def __init__(self, success: bool, blocks: List[Dict] = None, error: str = None, meta: Dict = None):
        self.success = success
        self.blocks = blocks or []
        self.error = error
        self.meta = meta or {}

    def to_dict(self):
        return {"success": self.success, "blocks": self.blocks, "error": self.error, "meta": self.meta}
