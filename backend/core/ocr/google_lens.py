"""
Google Lens OCR adapter.
Wraps chrome_lens_py with thread-safe async executions.
"""
import os
import sys
import asyncio
import logging
from pathlib import Path
from typing import List, Dict, Callable, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    import certifi
    os.environ.setdefault("SSL_CERT_FILE", certifi.where())
    os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())
except Exception:
    pass

try:
    from chrome_lens_py import LensAPI
except ImportError:
    try:
        from chrome_lens_py.api import LensAPI
    except ImportError:
        LensAPI = None

logger = logging.getLogger(__name__)


class GoogleLensOCR:
    def __init__(self, max_workers: int = 3):
        self.max_workers = max_workers

    def _extract_single_sync(self, image_path: Path) -> Dict:
        if LensAPI is None:
            return {
                "text": "",
                "detailed_blocks": [],
                "success": False,
                "error": "حزمة chrome_lens_py غير متوفرة في بيئة التشغيل.",
            }

        async def _run():
            lens = LensAPI()
            try:
                res = await lens.process_image(image_path=str(image_path), output_format="detailed")
                return res
            finally:
                if hasattr(lens, "request_handler") and hasattr(lens.request_handler, "client"):
                    try:
                        await lens.request_handler.client.aclose()
                    except Exception:
                        pass

        try:
            result = asyncio.run(_run())

            detailed_blocks = result.get("detailed_blocks", []) if isinstance(result, dict) else []
            full_text_lines = []
            for block in detailed_blocks:
                for line in block.get("lines", []):
                    if isinstance(line, dict):
                        full_text_lines.append(line.get("text", ""))
                    elif isinstance(line, str):
                        full_text_lines.append(line)
            full_text = "\n".join(full_text_lines)

            return {"text": full_text, "detailed_blocks": detailed_blocks, "success": True}
        except Exception as e:
            logger.error("GoogleLensOCR extraction error on %s: %s", image_path, e, exc_info=True)
            return {"text": "", "detailed_blocks": [], "success": False, "error": str(e)}

    def extract_batch(self, image_paths: List[Path], progress_callback: Optional[Callable] = None) -> List[Dict]:
        results = [None] * len(image_paths)
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_idx = {executor.submit(self._extract_single_sync, p): i for i, p in enumerate(image_paths)}
            for future in as_completed(future_to_idx):
                idx = future_to_idx[future]
                try:
                    data = future.result()
                    results[idx] = {"page": idx + 1, **data}
                except Exception as e:
                    results[idx] = {"page": idx + 1, "text": "", "detailed_blocks": [], "success": False, "error": str(e)}
                if progress_callback:
                    try:
                        progress_callback(idx + 1, len(image_paths), results[idx])
                    except Exception:
                        pass
        return results
