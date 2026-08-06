"""
manager.py — PostProcessingManager orchestrates all post-processing enhancements.

Post-processing features:
  1. auto_sort_reading_order: Sorts OCR bounding box blocks into Arabic reading order
     (Top-to-Bottom, Right-to-Left, and Right-column first for multi-column pages).
  2. detect_pagination: Detects page numbers across project pages using spatial proximity
     and numeric sequence validation, annotating blocks with category="Page-number".
"""
import copy
from typing import List, Dict, Any, Optional

from .reading_order.sorter import ArabicReadingOrderSorter
from .pagination.detector import PaginationDetector


class PostProcessingManager:
    """
    Orchestrates post-processing enhancements on OCR page blocks and projects.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self._reading_order_sorter = ArabicReadingOrderSorter()
        self._pagination_detector = PaginationDetector()

    def process_page(
        self,
        ocr_blocks: List[Dict[str, Any]],
        image_path: Optional[str] = None,
        page_height: float = 0.0,
    ) -> List[Dict[str, Any]]:
        """
        Apply active single-page post-processing steps to an OCR block list.
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

        # ── Step 1: Per-page post-processing (reading order, etc.) ─────────
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

        # ── Step 2: Cross-page pagination auto-detection ───────────────────
        if self.config.get("detect_pagination", False):
            updated = self._pagination_detector.detect_and_annotate_project(
                updated, page_indices=indices, only_unreviewed=only_unreviewed
            )

        updated["_post_processing_applied"] = count
        return updated
