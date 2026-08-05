"""
OCR Service - unified pipeline:
standardize + clean + apply category formatting defaults.
Used by all trigger_* methods to avoid duplication.
"""
from typing import List, Dict
from .handler import OCRHandler
from ..text import ArabicTextCleaner


class OCRService:
    def __init__(self):
        self.handler = OCRHandler()

    def standardize_and_clean(
        self,
        raw_blocks: List[Dict],
        page_data: Dict,
        engine_dpi: float = 200.0,
        text_config: Dict | None = None,
        category_formatting: Dict | None = None,
        post_processing: Dict | None = None,
    ) -> List[Dict]:
        """
        1. Standardize coordinates from engine DPI to 72 DPI native space.
        2. Clean text via ArabicTextCleaner.
        3. Apply category formatting defaults (dir, align) where missing.
        4. Apply post-processing pipeline (Reading Order Auto-Sorting, etc.) if enabled.
        """
        text_config = text_config or {}
        cleaner = ArabicTextCleaner(text_config)

        native_w = float(page_data.get("native_width", 0))
        native_h = float(page_data.get("native_height", 0))

        standardized = self.handler.standardize_page_blocks(raw_blocks, native_w, native_h, current_dpi=engine_dpi)

        cat_fmt_map = category_formatting or (text_config.get("category_formatting", {}) if isinstance(text_config, dict) else {})

        for el in standardized:
            if el.get("text"):
                el["text"] = cleaner.clean(el["text"])
            cat = el.get("category", "Text")
            fmt = cat_fmt_map.get(cat, {})
            if fmt:
                if fmt.get("dir"):
                    el["dir"] = fmt["dir"]
                if fmt.get("align"):
                    el["align"] = fmt["align"]

        # Step 4: Run post-processing automatically after OCR recognition if enabled
        if post_processing and any(post_processing.values()):
            try:
                from ...post_processing import PostProcessingManager
                manager = PostProcessingManager(config=post_processing)
                standardized = manager.process_page(standardized, page_height=native_h)
            except Exception as e:
                print(f"[OCRService] Post-processing hook error: {e}")

        return standardized

    def clean_existing_elements(
        self,
        elements: List[Dict],
        page_data: Dict,
        engine_dpi: float = 200.0,
        text_config: Dict | None = None,
        category_formatting: Dict | None = None,
        post_processing: Dict | None = None,
    ):
        """Wrapper for backward compatibility with old _apply_cleaning_to_elements."""
        return self.standardize_and_clean(elements, page_data, engine_dpi, text_config, category_formatting, post_processing)

