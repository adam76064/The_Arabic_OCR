from .handler import OCRHandler
from .service import OCRService
from .base import OCRAdapter, OCRResult
from .paddle import PaddleOCRClient
from .google_lens import GoogleLensOCR
from .locro import run_locro_ocr, get_screen_ai
from .llm import LLMOCRHandler

__all__ = [
    "OCRHandler",
    "OCRService",
    "OCRAdapter",
    "OCRResult",
    "PaddleOCRClient",
    "GoogleLensOCR",
    "run_locro_ocr",
    "get_screen_ai",
    "LLMOCRHandler",
]
