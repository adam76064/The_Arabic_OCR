"""
Google Lens OCR adapter.
Wraps chrome_lens_py with thread-safe event loops per original code.
"""
import asyncio
import json
from pathlib import Path
from typing import List, Dict, Callable, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    from chrome_lens_py import LensAPI
except ImportError:
    LensAPI = None


class GoogleLensOCR:
    def __init__(self, max_workers: int = 4):
        self.max_workers = max_workers

    def _extract_single_sync(self, image_path: Path) -> Dict:
        try:
            if LensAPI is None:
                return {"text": "", "detailed_blocks": [], "success": False, "error": "chrome_lens_py not installed"}
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            lens = LensAPI()
            result = loop.run_until_complete(lens.process_image(image_path=str(image_path), output_format="detailed"))
            loop.close()

            detailed_blocks = result.get("detailed_blocks", [])
            full_text_lines = []
            for block in detailed_blocks:
                for line in block.get("lines", []):
                    full_text_lines.append(line.get("text", ""))
            full_text = "\n".join(full_text_lines)

            return {"text": full_text, "detailed_blocks": detailed_blocks, "success": True}
        except Exception as e:
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
