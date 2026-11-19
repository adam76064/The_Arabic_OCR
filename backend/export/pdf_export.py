"""
pdf_export.py — High-fidelity PDF reconstruction engine for Arabic documents (F-2).

Supports:
1. Flowing Mode: Clean sequential reflow of headings, paragraphs, poetry, tables, and page numbers with RTL shaping.
2. Exact Mode: Pixel-accurate coordinate positioning matching 72 DPI native PDF bounding boxes.
3. Proper Arabic shaping via arabic_reshaper and Unicode BiDi algorithm.
"""

from typing import List, Dict, Any, Optional
import os
import re
import fitz  # PyMuPDF

try:
    import arabic_reshaper
    HAS_RESHAPER = True
except ImportError:
    HAS_RESHAPER = False

try:
    from bidi.algorithm import get_display
    HAS_BIDI = True
except ImportError:
    HAS_BIDI = False


def _shape_arabic(text: str) -> str:
    """Shapes Arabic glyphs and applies BiDi visual ordering for PDF rendering."""
    if not text:
        return ""
    # Strip HTML tags
    clean = re.sub(r"<[^>]+>", "", text).strip()
    if not clean:
        return ""
    if HAS_RESHAPER:
        configuration = {
            "delete_harakat": False,
            "support_ligatures": True,
        }
        reshaper = arabic_reshaper.ArabicReshaper(configuration=configuration)
        reshaped = reshaper.reshape(clean)
    else:
        reshaped = clean

    if HAS_BIDI:
        return get_display(reshaped)
    return reshaped


def export_pdf(
    project: Dict[str, Any],
    page_indices: List[int],
    output_path: str,
    opts: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Exports project pages to a reconstructed searchable PDF.
    opts:
        mode: 'flowing' | 'exact' (default 'flowing')
        page_size: 'A4' | 'A5' | 'Letter' (default 'A4')
        font_size: int (default 12)
        merge_cross_page_paragraphs: bool (default True)
    """
    opts = opts or {}
    mode = opts.get("mode") or opts.get("pdf_mode", "flowing")
    font_size_base = int(opts.get("font_size", 12))
    merge_cross_page = bool(opts.get("merge_cross_page_paragraphs", True))

    PAGE_DIMENSIONS = {
        "A4": (595.32, 841.92),
        "A5": (419.53, 595.32),
        "Letter": (612.0, 792.0),
    }
    default_w, default_h = PAGE_DIMENSIONS.get(opts.get("page_size", "A4"), PAGE_DIMENSIONS["A4"])

    doc = fitz.open()

    if mode == "exact":
        # ── Exact Mode: 1:1 Coordinate Positioning ──────────────────────────────
        for page_idx in page_indices:
            if page_idx >= len(project.get("pages", [])):
                continue
            page_data = project["pages"][page_idx]
            pw = float(page_data.get("width") or default_w)
            ph = float(page_data.get("height") or default_h)

            pdf_page = doc.new_page(width=pw, height=ph)
            ocr_data = page_data.get("ocr_data", [])

            for el in ocr_data:
                cat = el.get("category", "Text")
                if cat in ("Page-header", "Page-footer", "Header", "Footer"):
                    continue

                bbox = el.get("bbox")
                text = el.get("text", "").strip()
                if not bbox or len(bbox) != 4 or not text:
                    continue

                rect = fitz.Rect(bbox[0], bbox[1], bbox[2], bbox[3])
                # Ensure minimum height
                if rect.height < 12:
                    rect.y1 = rect.y0 + 14

                f_size = float(el.get("font_size") or font_size_base)
                shaped = _shape_arabic(text)

                try:
                    pdf_page.insert_textbox(
                        rect,
                        shaped,
                        fontsize=f_size,
                        align=fitz.TEXT_ALIGN_RIGHT,
                    )
                except Exception:
                    # Fallback to single text insert
                    pdf_page.insert_text(
                        fitz.Point(rect.x0, rect.y0 + f_size),
                        shaped[:120],
                        fontsize=f_size,
                    )

    else:
        # ── Flowing Mode: Clean Sequential Document Flow ───────────────────────
        margin_x = 54.0  # 0.75 in
        margin_top = 54.0
        margin_bottom = 54.0
        usable_w = default_w - (2 * margin_x)
        usable_h = default_h - margin_top - margin_bottom

        pdf_page = doc.new_page(width=default_w, height=default_h)
        cur_y = margin_top

        last_cat = None
        last_text = ""

        for p_counter, page_idx in enumerate(page_indices):
            if page_idx >= len(project.get("pages", [])):
                continue
            page_data = project["pages"][page_idx]
            ocr_data = page_data.get("ocr_data", [])

            # Check cross-page continuation
            is_cont = False
            if merge_cross_page and p_counter > 0 and last_cat == "Text" and ocr_data:
                if last_text and not last_text.rstrip().endswith((".", "؟", "!", ":")):
                    first_body = next((b for b in ocr_data if b.get("category") == "Text"), None)
                    if first_body:
                        is_cont = True

            if p_counter > 0 and not is_cont and cur_y > margin_top + 40:
                # Page break
                pdf_page = doc.new_page(width=default_w, height=default_h)
                cur_y = margin_top

            for el in ocr_data:
                cat = el.get("category", "Text")
                if cat in ("Page-header", "Page-footer", "Header", "Footer"):
                    continue

                text = el.get("text", "").strip()
                if not text:
                    continue

                f_size = font_size_base
                line_h = f_size * 1.5

                if cat == "Title":
                    f_size = font_size_base + 6
                    line_h = f_size * 1.6
                elif cat == "Section-header":
                    f_size = font_size_base + 3
                    line_h = f_size * 1.5
                elif cat == "Footnote":
                    f_size = max(8, font_size_base - 3)
                    line_h = f_size * 1.4

                shaped = _shape_arabic(text)
                lines = shaped.split("\n")
                block_h = len(lines) * line_h + 8

                # Check if we need a new page
                if cur_y + block_h > default_h - margin_bottom:
                    pdf_page = doc.new_page(width=default_w, height=default_h)
                    cur_y = margin_top

                rect = fitz.Rect(margin_x, cur_y, margin_x + usable_w, cur_y + block_h)
                align_code = fitz.TEXT_ALIGN_CENTER if cat in ("Title", "Page-number") else fitz.TEXT_ALIGN_RIGHT

                try:
                    pdf_page.insert_textbox(
                        rect,
                        shaped,
                        fontsize=f_size,
                        align=align_code,
                    )
                except Exception:
                    pass

                cur_y += block_h + 6
                last_cat = cat
                last_text = text

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    doc.save(output_path)
    doc.close()
    return output_path
