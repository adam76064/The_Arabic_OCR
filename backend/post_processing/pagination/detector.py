"""
detector.py — Pure-spatial & text-based Pagination Auto-Detector.

Detects page numbers across project pages by:
  1. Identifying candidate blocks in header (top 15%) or footer (bottom 15%) regions.
  2. Extracting standalone integer values (supporting ASCII, Arabic-Indic, and Persian digits).
  3. Verifying spatial consistency and numeric sequence continuity across consecutive pages or facing-page pairs.
  4. Annotating confirmed page-number blocks with category="Page-number" and is_page_number=True.
"""
import re
from typing import List, Dict, Any, Optional, Set, Tuple

_HINDU_TO_ARABIC = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")


def strip_html(text: str) -> str:
    if not text:
        return ""
    return re.sub(r"<[^>]+>", "", text).strip()


def extract_number_val(text: str) -> Optional[int]:
    """Extract single integer value from text if it matches a standalone page number format."""
    clean = strip_html(text)
    if not clean:
        return None
    clean_norm = clean.translate(_HINDU_TO_ARABIC)

    # Match formats: '140', '[140]', '(140)', '- 140 -', 'صفحة 140', 'Page 140', 'p. 140'
    pattern = re.compile(r"^(?:صفحة|page|الصفحة|p\.?)?[\s\-\[\(_]*(\d{1,5})[\s\-\]\)_]*$", re.IGNORECASE)
    m = pattern.search(clean_norm)
    if m:
        try:
            return int(m.group(1))
        except ValueError:
            return None
    return None


class PaginationDetector:
    """
    Detects and annotates page-number blocks across project pages.
    """

    def __init__(self, top_ratio: float = 0.18, bottom_ratio: float = 0.82):
        """
        Args:
            top_ratio: Fraction of max page Y coordinate defining top header region.
            bottom_ratio: Fraction of max page Y coordinate defining bottom footer region.
        """
        self.top_ratio = top_ratio
        self.bottom_ratio = bottom_ratio

    def detect_and_annotate_project(
        self,
        project: Dict[str, Any],
        page_indices: Optional[List[int]] = None,
        only_unreviewed: bool = True,
    ) -> Dict[str, Any]:
        """
        Scan project pages for page numbers and annotate matching blocks.

        Returns updated project dict.
        """
        pages = project.get("pages", [])
        if not pages:
            return project

        indices = page_indices if page_indices is not None else list(range(len(pages)))

        # ── 1. Candidate Extraction ─────────────────────────────────────────
        candidates_by_page: Dict[int, List[Dict[str, Any]]] = {}

        for p_idx in indices:
            if p_idx >= len(pages):
                continue
            page = pages[p_idx]
            ocr_data = page.get("ocr_data", [])
            if not ocr_data:
                continue

            if only_unreviewed:
                all_reviewed = all(b.get("reviewed") for b in ocr_data if b.get("text"))
                if all_reviewed:
                    continue

            # Compute effective max Y from bounding boxes
            valid_bboxes = [b["bbox"] for b in ocr_data if b.get("bbox") and len(b["bbox"]) == 4]
            if not valid_bboxes:
                continue
            max_y = max(bbox[3] for bbox in valid_bboxes)
            if max_y <= 0:
                continue

            cands = []
            for b_idx, block in enumerate(ocr_data):
                bbox = block.get("bbox")
                if not bbox or len(bbox) < 4:
                    continue

                text = block.get("text", "")
                val = extract_number_val(text)
                if val is None:
                    continue

                is_top = bbox[1] < max_y * self.top_ratio
                is_bottom = bbox[3] > max_y * self.bottom_ratio

                if is_top or is_bottom:
                    cands.append({
                        "page_idx": p_idx,
                        "block_idx": b_idx,
                        "val": val,
                        "bbox": bbox,
                        "zone": "top" if is_top else "bottom",
                        "x_center": (bbox[0] + bbox[2]) / 2.0,
                    })

            candidates_by_page[p_idx] = cands

        # ── 2. Cross-Page & Facing-Page Sequence Validation ─────────────────
        confirmed: Dict[int, Set[int]] = {}  # {page_idx: set of block_indices}

        # Mode A: Same-page facing pages (e.g. Page 0 contains 140 top-right and 141 top-left)
        for p_idx, cands in candidates_by_page.items():
            if len(cands) >= 2:
                sorted_cands = sorted(cands, key=lambda c: c["val"])
                for i in range(len(sorted_cands) - 1):
                    c1, c2 = sorted_cands[i], sorted_cands[i + 1]
                    if c1["zone"] == c2["zone"] and (c2["val"] == c1["val"] + 1 or c2["val"] == c1["val"] + 2):
                        confirmed.setdefault(c1["page_idx"], set()).add(c1["block_idx"])
                        confirmed.setdefault(c2["page_idx"], set()).add(c2["block_idx"])

        # Mode B: Consecutive pages (Page i -> Page i+1 or Page i+2)
        sorted_page_indices = sorted(candidates_by_page.keys())
        for idx_pos in range(len(sorted_page_indices) - 1):
            p1_idx = sorted_page_indices[idx_pos]
            p2_idx = sorted_page_indices[idx_pos + 1]
            cands1 = candidates_by_page[p1_idx]
            cands2 = candidates_by_page[p2_idx]

            for c1 in cands1:
                for c2 in cands2:
                    if c1["zone"] == c2["zone"]:
                        diff_val = c2["val"] - c1["val"]
                        diff_page = p2_idx - p1_idx
                        # Consecutive integer progression matches page index step (or +1/+2 step)
                        if diff_val == diff_page or diff_val in (1, 2):
                            confirmed.setdefault(c1["page_idx"], set()).add(c1["block_idx"])
                            confirmed.setdefault(c2["page_idx"], set()).add(c2["block_idx"])

        # ── 3. Annotating Confirmed Blocks ──────────────────────────────────
        count = 0
        for p_idx, block_set in confirmed.items():
            page = pages[p_idx]
            ocr_data = page.get("ocr_data", [])
            for b_idx in block_set:
                if b_idx < len(ocr_data):
                    block = ocr_data[b_idx]
                    block["category"] = "Page-number"
                    block["is_page_number"] = True
                    val = extract_number_val(block.get("text", ""))
                    if val is not None:
                        block["page_number_val"] = val
                    count += 1

        project["_pagination_applied"] = count
        return project
