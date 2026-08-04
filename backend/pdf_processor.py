"""Shim - backward compat, now lives in backend.core.pdf"""
from .core.pdf import PDFProcessor, extract_pdf_range
__all__ = ["PDFProcessor", "extract_pdf_range"]

# Keep standalone helper previously defined in main.py but now import
def extract_pdf_range_shim(*args, **kwargs):
    return extract_pdf_range(*args, **kwargs)
