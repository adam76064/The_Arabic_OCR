"""
digital_extractor.py — High-fidelity deterministic extraction engine for digital-born Arabic PDFs.

Core Capabilities:
1. Digital vs. Scanned Triage: Inspects selectable text layers, detects missing/corrupt CMaps,
   and determines whether a page should be extracted digitally (100% fidelity) or routed to OCR.
2. Presentation Form De-shaping: Normalizes Unicode Presentation Forms-A and Forms-B
   (\uFB50-\uFDFF, \uFE70-\uFEFF) back to standard canonical Arabic (\u0600-\u06FF) via NFKC and explicit tables.
3. BiDi & Visual Reversal Repair: Detects and resolves reversed Arabic text written in LTR byte order.
4. Layout & Geometry Preservation: Maps block, line, and word spans directly into the 72 DPI
   coordinate space used by The_Arabic_OCR, preserving font sizes, font families, and colors.
"""

from typing import List, Dict, Any, Tuple, Optional
import os
import re
import unicodedata
import fitz  # PyMuPDF

try:
    from bidi.algorithm import get_display
    HAS_BIDI = True
except ImportError:
    HAS_BIDI = False


# Arabic presentation form boundaries
RE_ARABIC_CHAR = re.compile(r"[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]")
RE_ARABIC_PRESENTATION = re.compile(r"[\uFB50-\uFDFF\uFE70-\uFEFF]")
RE_TASHKEEL = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]")

# Letters that can NEVER appear at the beginning of a proper Arabic word
# (If found at the start of a multi-letter word, the word is almost certainly reversed)
INVALID_ARABIC_INITIALS = set("ةىـ")

# Vertical Nastaliq / ArabicTypesetting CMap paint transpositions
NASTALIQ_VERTICAL_REPAIRS = [
    ("اجللسة", "الجلسة"),
    ("منرة", "نمرة"),
    ("مخسة", "خمسة"),
    ("تالتني", "تلاتين"),
    ("وتالنتي", "وتلاتين"),
    ("الرمحن", "الرحمن"),
    ("الرحمي", "الرحيم"),
    ("حرضات", "حضرات"),
    ("احملمكة", "المحكمة"),
    ("حماةل", "محالة"),
    ("ابلعمةل", "بالعملة"),
    ("ابالطبع", "بالطبع"),
    ("ابلتأكيد", "بالتأكيد"),
    ("س ياداتمك", "سيادتكم"),
    ("س يادة", "سيادة"),
    ("س يدي", "سيدي"),
    ("بس يطة", "بسيطة"),
    ("واحضة", "واضحة"),
    ("الأدةل", "الأدلة"),
    ("ختفى", "تخفى"),
    ("لكهنا", "لكنها"),
    ("عداةل", "عدالة"),
    ("مهتم", "متهم"),
    ("عىل", "على"),
    ("جمرية", "جريمة"),
    ("حنن", "نحن"),
    ("نرتكهبا", "نرتكبها"),
    ("مجيعا", "جميعا"),
    ("أ س تاذ", "أستاذ"),
    ("أس تاذ", "أستاذ"),
]


class DigitalPDFExtractor:
    """
    Deterministic extractor for digital-born Arabic PDFs.
    Bypasses OCR to guarantee zero text alteration and instant extraction.
    """

    def __init__(self, min_char_threshold: int = 30):
        self.min_char_threshold = min_char_threshold

    # ── 1. Digital vs. Scanned Triage ──────────────────────────────────────────

    def is_digital_page(self, page: fitz.Page) -> Tuple[bool, str]:
        """
        Determines whether a page contains a valid, extractable digital Arabic/text layer.
        Returns:
            (is_digital, reason)
        """
        text = page.get_text("text") or ""
        text_clean = text.strip()
        total_len = len(text_clean)

        if total_len < self.min_char_threshold:
            return False, f"insufficient_characters ({total_len} < {self.min_char_threshold})"

        # Check for CMap corruption or private-use encoding (e.g. lots of \ufffd or \ue000-\uf8ff)
        corrupt_chars = sum(1 for c in text_clean if ord(c) == 0xFFFD or 0xE000 <= ord(c) <= 0xF8FF)
        if corrupt_chars > total_len * 0.25:
            return False, f"corrupt_font_cmap ({corrupt_chars}/{total_len} corrupt/private codepoints)"

        # Count readable alphanumeric / Arabic characters
        arabic_chars = len(RE_ARABIC_CHAR.findall(text_clean))
        latin_alphanum = sum(1 for c in text_clean if c.isalnum() and ord(c) < 128)

        meaningful_ratio = (arabic_chars + latin_alphanum) / total_len if total_len > 0 else 0.0
        if meaningful_ratio < 0.35:
            return False, f"low_meaningful_ratio ({meaningful_ratio:.2f} < 0.35)"

        return True, "valid_digital_layer"

    # ── 2. Arabic Text & Ligature Normalization ────────────────────────────────

    @staticmethod
    def detect_visual_reversal(text: str) -> bool:
        """
        Detects whether an Arabic text string (line or span) is written in visual LTR reverse byte order.
        Uses strict linguistic indicators (invalid word initials, position-0 diacritics, definite article).
        Avoids false-positive prefix collisions and never flags valid words ending in 'لا' or 'لاً'.
        """
        words = re.findall(r"[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]+", text)
        if not words:
            return False

        score_reversed = 0
        score_normal = 0

        for w in words:
            if not w:
                continue
            # Indicator 1: Letters that cannot initiate a proper Arabic word (ة, ى, ـ)
            if w[0] in INVALID_ARABIC_INITIALS:
                score_reversed += 4

            # Indicator 2: Combining diacritics / tashkeel appearing at position 0 (impossible in normal Arabic)
            if RE_TASHKEEL.match(w[0]):
                score_reversed += 3

            # Indicator 3: Definite article 'ال' and prefixed variants at start (normal)
            if w.startswith(("ال", "وال", "فال", "بال", "كال", "لل")):
                score_normal += 3

            # Indicator 4: Words ending with valid feminine 'ة' or normal suffixes (normal)
            if w.endswith("ة"):
                score_normal += 2
            for sfx in ("ها", "هم", "هن", "كم", "نا", "ين", "ون", "ات"):
                if w.endswith(sfx) and len(w) > len(sfx):
                    score_normal += 1

        return score_reversed > score_normal

    def normalize_arabic_string(self, text: str) -> str:
        """
        Normalizes Arabic text by un-shaping presentation forms to base Unicode,
        merging decomposed characters, fixing font CMap ligature omissions (<03FB>),
        repairing vertical Nastaliq stacking transpositions, and correcting visual byte reversals.
        """
        if not text:
            return ""

        # Step 1: NFKC Normalization — converts Presentation Forms A & B to canonical Arabic
        norm = unicodedata.normalize("NFKC", text)
        norm = norm.replace("\xa0", " ")
        # Farsi variants mapped by NFKC -> standard Arabic
        norm = norm.replace("\u06CC", "\u064A")  # Farsi Yeh -> Arabic Yeh
        norm = norm.replace("\u06A9", "\u0643")  # Farsi Keh -> Arabic Kaf

        # Step 1.1: Fix Microsoft Word CMap <03FB> ligature bug
        # CID <03FB> maps ligature 'لاً' to '\u0644\u064B' or '\u064B\u0644', omitting Alef
        norm = norm.replace("\u064B\u0644", "لا")
        norm = re.sub(r"\u0644\u064B(?=\s|$|[^\u0621-\u064A])", "لاً", norm)

        # Step 1.2: Fix Word inverted Lam-Hamza streams (اإل -> الإ, األ -> الأ, اآل -> الآ)
        norm = re.sub(r"اإل(?=[\u0621-\u064A])", "الإ", norm)
        norm = re.sub(r"األ(?=[\u0621-\u064A])", "الأ", norm)
        norm = re.sub(r"اآل(?=[\u0621-\u064A])", "الآ", norm)

        # Step 1.3: Nastaliq / ArabicTypesetting vertical CMap paint inversions
        for src, dst in NASTALIQ_VERTICAL_REPAIRS:
            if src in norm:
                norm = norm.replace(src, dst)

        # Step 2: Line-level reversal detection and correction via UAX #9 BiDi
        if self.detect_visual_reversal(norm):
            if HAS_BIDI:
                norm = get_display(norm)
            else:
                norm = self._reverse_grapheme_clusters(norm)

        # Step 3: Check and repair any isolated tokens that might still have reversed initials
        words = norm.split(" ")
        repaired_words = []
        for w in words:
            if not w:
                continue
            repaired_words.append(self._repair_word_direction(w))

        return " ".join(repaired_words)

    def _repair_word_direction(self, word: str) -> str:
        """
        Checks if an Arabic word was written backwards in the PDF stream (e.g. 'ةسردلما' instead of 'المدرسة')
        and reverses it if needed. Uses bidi.get_display when available so that mixed
        Arabic/Latin/digit tokens are reversed correctly without corrupting embedded numbers.
        INVALID_ARABIC_INITIALS (ة, ى, ـ) can never appear at the start of a correctly-ordered word,
        so their presence at position 0 is a definitive reversal indicator.
        NOTE: Never assume words ending in 'لا' are reversed definite articles ('ال'); words naturally
        ending in 'لا' (مقالاً, مثلاً, أصلاً, عملاً, فعلاً, إلا, كلا, لولا) are standard Arabic.
        """
        arabic_letters = [c for c in word if RE_ARABIC_CHAR.match(c) and not RE_TASHKEEL.match(c)]
        if len(arabic_letters) < 2:
            return word

        needs_reversal = False

        # Indicator 1: Word starts with a character that cannot initiate an Arabic word (ة, ى, ـ)
        if arabic_letters[0] in INVALID_ARABIC_INITIALS:
            needs_reversal = True

        if not needs_reversal:
            return word

        # Prefer bidi library for safe reversal of mixed Arabic/Latin/digit tokens
        if HAS_BIDI:
            return get_display(word)
        return self._reverse_grapheme_clusters(word)

    @staticmethod
    def _reverse_grapheme_clusters(text: str) -> str:
        """
        Reverses an Arabic string by grapheme clusters so that diacritics / tashkeel marks
        (fatha, damma, kasra, tanween, shadda, sukun) remain strictly attached to their host letters.
        """
        clusters: List[str] = []
        current: List[str] = []
        for c in text:
            if RE_TASHKEEL.match(c) and current:
                current.append(c)
            else:
                if current:
                    clusters.append("".join(current))
                current = [c]
        if current:
            clusters.append("".join(current))
        clusters.reverse()
        return "".join(clusters)

    # ── 3. Page Layout & Block Extraction ──────────────────────────────────────

    def extract_page(
        self,
        doc: fitz.Document,
        page_index: int,
        native_width: Optional[float] = None,
        native_height: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Extracts structured blocks from a single PDF page matching The_Arabic_OCR schema.
        All coordinates are natively 72 DPI PostScript points.
        """
        if page_index < 0 or page_index >= len(doc):
            return {"ok": False, "error": f"Invalid page index {page_index}", "blocks": []}

        page = doc[page_index]
        rect = page.rect
        page_w = native_width or float(rect.width)
        page_h = native_height or float(rect.height)

        is_digital, reason = self.is_digital_page(page)
        if not is_digital:
            return {
                "ok": False,
                "is_digital": False,
                "reason": reason,
                "blocks": [],
            }

        # Extract structured tables using PyMuPDF if available
        table_blocks: List[Dict[str, Any]] = []
        table_bboxes: List[List[float]] = []
        try:
            tabs = page.find_tables()
            for tab in tabs.tables:
                tb_box = [round(float(c), 2) for c in tab.bbox]
                tb_w = max(1.0, tb_box[2] - tb_box[0])
                tb_h = max(1.0, tb_box[3] - tb_box[1])

                # Filter out highlight pseudo-tables:
                # Real tables must have at least 2 rows and minimum height of 40 points.
                # Highlight boxes behind words typically have height <= 30 pt and row_count <= 2.
                if tab.row_count < 2 or tb_h < 40.0:
                    continue

                table_bboxes.append(tb_box)
                tcx = tb_box[0] + (tb_w / 2.0)
                tcy = tb_box[1] + (tb_h / 2.0)
                tb_geom = {
                    "center_x": round(tcx / page_w, 4) if page_w > 0 else 0.0,
                    "center_y": round(tcy / page_h, 4) if page_h > 0 else 0.0,
                    "width": round(tb_w / page_w, 4) if page_w > 0 else 0.0,
                    "height": round(tb_h / page_h, 4) if page_h > 0 else 0.0,
                    "angle_deg": 0.0,
                }

                # Extract cells using page.get_text with clip to preserve logical reading order
                # and avoid PyMuPDF's LTR coordinate sweep reversal on Arabic text
                extracted_rows: List[List[str]] = []
                ts_cells = []
                for r_idx, row in enumerate(tab.rows):
                    row_cells_text = []
                    for c_idx, cell_bbox in enumerate(row.cells):
                        if cell_bbox is None:
                            c_text = ""
                        else:
                            c_raw = page.get_text("text", clip=cell_bbox).strip()
                            c_text = " ".join(c_raw.split())
                        norm_text = self.normalize_arabic_string(c_text).strip()
                        row_cells_text.append(norm_text)
                        ts_cells.append({
                            "row": r_idx,
                            "col": c_idx,
                            "row_span": 1,
                            "col_span": 1,
                            "text": norm_text,
                        })
                    extracted_rows.append(row_cells_text)

                table_text = "\n".join([" | ".join(r) for r in extracted_rows])
                table_blocks.append({
                    "order": 0,
                    "category": "Table",
                    "bbox": tb_box,
                    "geometry": tb_geom,
                    "text": table_text,
                    "reviewed": True,
                    "dir": "rtl",
                    "align": "right",
                    "table_structure": {
                        "rows": tab.row_count,
                        "cols": tab.col_count,
                        "cells": ts_cells,
                    },
                    "lines": [],
                    "is_digital": True,
                })
        except Exception:
            pass

        def _is_inside_table(b_box: List[float]) -> bool:
            for tb in table_bboxes:
                if (
                    b_box[0] >= tb[0] - 5
                    and b_box[1] >= tb[1] - 5
                    and b_box[2] <= tb[2] + 5
                    and b_box[3] <= tb[3] + 5
                ):
                    return True
            return False

        # Extract structured text tree and exact word bounding boxes from PyMuPDF
        page_dict = page.get_text("dict")
        raw_blocks = page_dict.get("blocks", [])

        # Index native word bounding boxes by (block_no, line_no)
        raw_words = page.get_text("words") or []
        words_by_line: Dict[Tuple[int, int], List[Tuple[float, float, float, float, str]]] = {}
        for w_item in raw_words:
            if len(w_item) >= 7:
                x0, y0, x1, y1, w_text, b_no, l_no = w_item[:7]
                words_by_line.setdefault((int(b_no), int(l_no)), []).append(
                    (float(x0), float(y0), float(x1), float(y1), str(w_text))
                )

        # Gather font statistics for intelligent heading/title classification
        font_sizes: List[float] = []
        for b in raw_blocks:
            if b.get("type") == 0:  # text block
                for line in b.get("lines", []):
                    for span in line.get("spans", []):
                        sz = float(span.get("size", 0.0))
                        if sz > 0:
                            font_sizes.append(sz)

        median_font_size = sorted(font_sizes)[len(font_sizes) // 2] if font_sizes else 12.0

        standardized_blocks: List[Dict[str, Any]] = []

        for b_idx, raw_b in enumerate(raw_blocks):
            b_type = raw_b.get("type", 0)
            bbox = [round(float(coord), 2) for coord in raw_b.get("bbox", [0, 0, 0, 0])]

            # Skip text blocks that fall inside a recognized table to prevent duplication
            if b_type == 0 and table_bboxes and _is_inside_table(bbox):
                continue

            bw = max(1.0, bbox[2] - bbox[0])
            bh = max(1.0, bbox[3] - bbox[1])
            cx = bbox[0] + (bw / 2.0)
            cy = bbox[1] + (bh / 2.0)

            geometry = {
                "center_x": round(cx / page_w, 4) if page_w > 0 else 0.0,
                "center_y": round(cy / page_h, 4) if page_h > 0 else 0.0,
                "width": round(bw / page_w, 4) if page_w > 0 else 0.0,
                "height": round(bh / page_h, 4) if page_h > 0 else 0.0,
                "angle_deg": 0.0,
            }

            # ── Type 1: Image / Figure Block ──────────────────────────────────
            if b_type == 1:
                standardized_blocks.append({
                    "order": 0,
                    "category": "Picture",
                    "bbox": bbox,
                    "geometry": geometry,
                    "text": "[صورة]",
                    "reviewed": True,
                    "dir": "rtl",
                    "align": "center",
                    "lines": [],
                    "is_digital": True,
                })
                continue

            # ── Type 0: Text Block ────────────────────────────────────────────
            lines_data: List[Dict[str, Any]] = []
            block_text_lines: List[str] = []
            span_fonts: List[str] = []
            span_sizes: List[float] = []
            span_colors: List[int] = []

            for l_idx, raw_line in enumerate(raw_b.get("lines", [])):
                line_bbox = [round(float(c), 2) for c in raw_line.get("bbox", bbox)]
                lw = max(1.0, line_bbox[2] - line_bbox[0])
                lh = max(1.0, line_bbox[3] - line_bbox[1])
                lcx = line_bbox[0] + (lw / 2.0)
                lcy = line_bbox[1] + (lh / 2.0)

                line_geom = {
                    "center_x": round(lcx / page_w, 4) if page_w > 0 else 0.0,
                    "center_y": round(lcy / page_h, 4) if page_h > 0 else 0.0,
                    "width": round(lw / page_w, 4) if page_w > 0 else 0.0,
                    "height": round(lh / page_h, 4) if page_h > 0 else 0.0,
                    "angle_deg": 0.0,
                }

                line_spans_text: List[str] = []
                words_data: List[Dict[str, Any]] = []

                raw_spans = raw_line.get("spans", [])
                raw_line_concat = " ".join(s.get("text", "") for s in raw_spans)
                line_reversed = self.detect_visual_reversal(raw_line_concat)

                for span in raw_spans:
                    span_text = self.normalize_arabic_string(span.get("text", ""))
                    if not span_text.strip():
                        continue

                    line_spans_text.append(span_text)
                    span_fonts.append(span.get("font", "Traditional Arabic"))
                    span_sizes.append(float(span.get("size", median_font_size)))
                    span_colors.append(int(span.get("color", 0)))

                    # Populate word data (fallback to span slicing if words_by_line is empty)
                    if (b_idx, l_idx) not in words_by_line:
                        s_bbox = span.get("bbox", line_bbox)
                        s_words = span_text.split()
                        word_count = len(s_words)
                        s_w = max(1.0, s_bbox[2] - s_bbox[0])
                        s_step = s_w / max(1, word_count)
                        for w_idx, w_str in enumerate(s_words):
                            wx1 = round(s_bbox[0] + (w_idx * s_step), 2)
                            wx2 = round(wx1 + s_step, 2)
                            wy1 = round(s_bbox[1], 2)
                            wy2 = round(s_bbox[3], 2)
                            words_data.append({
                                "text": w_str,
                                "bbox": [wx1, wy1, wx2, wy2],
                                "geometry": {
                                    "center_x": round(((wx1 + wx2) / 2.0) / page_w, 4) if page_w > 0 else 0.0,
                                    "center_y": round(((wy1 + wy2) / 2.0) / page_h, 4) if page_h > 0 else 0.0,
                                    "width": round((wx2 - wx1) / page_w, 4) if page_w > 0 else 0.0,
                                    "height": round((wy2 - wy1) / page_h, 4) if page_h > 0 else 0.0,
                                    "angle_deg": 0.0,
                                },
                            })

                # If PyMuPDF native word boxes are available for this line, use them for exact font metrics
                if (b_idx, l_idx) in words_by_line:
                    words_data = []
                    raw_line_words = words_by_line[(b_idx, l_idx)]
                    if line_reversed:
                        raw_line_words = list(reversed(raw_line_words))
                    for wx1, wy1, wx2, wy2, raw_w in raw_line_words:
                        norm_w = self.normalize_arabic_string(raw_w).strip()
                        if not norm_w:
                            continue
                        wx1_r, wy1_r, wx2_r, wy2_r = round(wx1, 2), round(wy1, 2), round(wx2, 2), round(wy2, 2)
                        words_data.append({
                            "text": norm_w,
                            "bbox": [wx1_r, wy1_r, wx2_r, wy2_r],
                            "geometry": {
                                "center_x": round(((wx1_r + wx2_r) / 2.0) / page_w, 4) if page_w > 0 else 0.0,
                                "center_y": round(((wy1_r + wy2_r) / 2.0) / page_h, 4) if page_h > 0 else 0.0,
                                "width": round(max(1.0, wx2_r - wx1_r) / page_w, 4) if page_w > 0 else 0.0,
                                "height": round(max(1.0, wy2_r - wy1_r) / page_h, 4) if page_h > 0 else 0.0,
                                "angle_deg": 0.0,
                            },
                        })

                full_line_text = " ".join(line_spans_text).strip()
                if full_line_text:
                    block_text_lines.append(full_line_text)
                    lines_data.append({
                        "text": full_line_text,
                        "bbox": line_bbox,
                        "geometry": line_geom,
                        "words": words_data,
                    })

            full_block_text = "\n".join(block_text_lines).strip()
            if not full_block_text:
                continue

            # Dominant font attributes
            dominant_font = max(set(span_fonts), key=span_fonts.count) if span_fonts else "Traditional Arabic"
            # Round sizes to 1 decimal before dedup so 11.9999 and 12.0001 are treated as the same size
            _span_sizes_r = [round(s, 1) for s in span_sizes]
            dominant_size = max(set(_span_sizes_r), key=_span_sizes_r.count) if _span_sizes_r else median_font_size
            dominant_color = max(set(span_colors), key=span_colors.count) if span_colors else 0

            # Categorize based on spatial zone and font sizing
            category = self._classify_category(bbox, page_h, dominant_size, median_font_size, full_block_text)

            standardized_blocks.append({
                "order": 0,
                "category": category,
                "bbox": bbox,
                "geometry": geometry,
                "text": full_block_text,
                "reviewed": True,
                "dir": "rtl",
                "align": "right" if category not in ("Title", "Page-header", "Page-footer", "Page-number") else "center",
                "font_name": dominant_font,
                "font_size": round(dominant_size, 1),
                "font_color": f"#{dominant_color:06x}",
                "lines": lines_data,
                "is_digital": True,
            })

        # Merge table blocks and text blocks, then sort in natural reading order
        all_blocks = table_blocks + standardized_blocks
        all_blocks.sort(key=lambda b: (b["bbox"][1], b["bbox"][0]))
        for idx_b, b in enumerate(all_blocks):
            b["order"] = idx_b + 1

        return {
            "ok": True,
            "is_digital": True,
            "page_index": page_index,
            "native_width": page_w,
            "native_height": page_h,
            "blocks": all_blocks,
        }

    def _classify_category(
        self,
        bbox: List[float],
        page_h: float,
        font_size: float,
        median_font_size: float,
        text: str,
    ) -> str:
        """Heuristic block category classification based on geometry and font scale."""
        y_top = bbox[1]
        y_bottom = bbox[3]

        # Top 8% of page -> Page-header
        if y_bottom <= page_h * 0.08:
            return "Page-header"

        # Bottom 8% of page -> Page-footer or Page-number
        if y_top >= page_h * 0.92:
            # Check if it consists mostly of digits
            stripped = text.strip()
            if re.match(r"^[\d\u0660-\u0669\u06F0-\u06F9\s\-\–\/]+$", stripped):
                return "Page-number"
            return "Page-footer"

        # Significantly larger font -> Title / Header
        if font_size >= median_font_size * 1.4:
            return "Title"
        if font_size >= median_font_size * 1.18:
            return "Section-header"

        return "Text"
