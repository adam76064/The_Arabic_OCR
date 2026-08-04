"""Shim - backward compat, now lives in backend.utils.retriever"""
from .utils.retriever import (
    extract_lines_and_words_for_bbox,
    extract_text_for_bbox,
    populate_layout_blocks_text,
    normalize_word,
    is_point_in_bbox,
    align_user_text_to_lines,
    populate_table_cells_from_raw,
)

__all__ = [
    "extract_lines_and_words_for_bbox",
    "extract_text_for_bbox",
    "populate_layout_blocks_text",
]
