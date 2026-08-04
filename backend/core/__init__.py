"""
core - foundational services for the Arabic OCR app.
Re-export for convenience.
"""
from .config import ConfigManager
from .projects import ProjectManager
from .pdf import PDFProcessor, extract_pdf_range
from .text import ArabicTextCleaner
from .quran import QuranHandler

__all__ = [
    "ConfigManager",
    "ProjectManager",
    "PDFProcessor",
    "extract_pdf_range",
    "ArabicTextCleaner",
    "QuranHandler",
]
