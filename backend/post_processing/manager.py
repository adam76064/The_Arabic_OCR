"""
manager.py — PostProcessingManager orchestrates all post-processing enhancements.

Post-processing features:
  1. auto_sort_reading_order: Sorts OCR bounding box blocks into Arabic reading order
     (Top-to-Bottom, Right-to-Left, and Right-column first for multi-column pages).
"""
import copy
from typing import List, Dict, Any, Optional

from .reading_order.sorter import ArabicReadingOrderSorter


class PostProcessingManager:
    """
    Orchestrates post-processing enhancements on OCR page blocks.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self._reading_order_sorter = ArabicReadingOrderSorter()

    def process_page(
        self,
        ocr_blocks: List[Dict[str, Any]],
        image_path: Optional[str] = None,
        page_height: float = 0.0,
    ) -> List[Dict[str, Any]]:
        """
        Apply active post-processing steps to a single page's OCR blocks.
        """
        if not ocr_blocks:
            return ocr_blocks

        blocks = [dict(b) for b in ocr_blocks]

        # ── Step 1: Reading Order Auto-Sorting (RTL & Multi-Column) ─────────
        if self.config.get("auto_sort_reading_order", False):
            blocks = self._reading_order_sorter.sort_page_blocks(blocks)

        return blocks

    def process_project_pages(
        self,
        project: Dict[str, Any],
        image_dir: str = "",
        page_indices: Optional[List[int]] = None,
        only_unreviewed: bool = True,
    ) -> Dict[str, Any]:
        """
        Apply post-processing to specified pages of a project.
        """
        updated = copy.deepcopy(project)
        pages = updated.get("pages", [])
        indices = page_indices if page_indices is not None else list(range(len(pages)))

        count = 0
        for i in indices:
            if i >= len(pages):
                continue
            page = pages[i]

            if only_unreviewed:
                ocr_data = page.get("ocr_data", [])
                all_reviewed = all(b.get("reviewed") for b in ocr_data if b.get("text"))
                if all_reviewed and ocr_data:
                    continue

            ocr_data = page.get("ocr_data", [])
            page_h = page.get("height", 0.0)
            updated_ocr = self.process_page(ocr_data, page_height=page_h)
            page["ocr_data"] = updated_ocr
            count += 1

        updated["_post_processing_applied"] = count
        return updated
