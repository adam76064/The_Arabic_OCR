"""
pdf_export.py — High-fidelity PDF reconstruction engine for Arabic documents (F-2).

Supports:
1. Flowing Mode: Clean sequential reflow of headings, paragraphs, poetry, tables, and page numbers with RTL shaping.
2. Exact Mode: Pixel-accurate coordinate positioning matching 72 DPI native PDF bounding boxes.
3. Proper Arabic shaping via arabic_reshaper and Unicode BiDi algorithm.
4. Arabic TrueType font embedding ensuring characters render without question marks (?) or encoding failure.
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


def _get_arabic_font_path(custom_path: Optional[str] = None) -> Optional[str]:
    """Finds an available TrueType font file on the host system that supports Arabic."""
    candidates = []
    if custom_path and os.path.exists(custom_path):
        return custom_path

    env_path = os.environ.get("ARABIC_FONT_PATH")
    if env_path and os.path.exists(env_path):
        return env_path

    # Windows fonts
    candidates.extend([
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/tahoma.ttf",
        "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/calibri.ttf",
        "C:/Windows/Fonts/times.ttf",
    ])

    # Linux fonts
    candidates.extend([
        "/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/opentype/noto/NotoNaskhArabic-Regular.otf",
        "/usr/share/fonts/truetype/freefont/FreeSerif.ttf",
    ])

    # macOS fonts
    candidates.extend([
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/GeezaPro.ttc",
        "/Library/Fonts/Arial.ttf",
    ])

    for c in candidates:
        if os.path.exists(c):
            return c
    return None


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
        font_path: str (optional path to TTF font)
        merge_cross_page_paragraphs: bool (default True)
    """
    opts = opts or {}
    mode = opts.get("mode") or opts.get("pdf_mode", "flowing")
    font_size_base = int(opts.get("font_size", 12))
    merge_cross_page = bool(opts.get("merge_cross_page_paragraphs", True))

    font_path = _get_arabic_font_path(opts.get("font_path"))
    font_buffer = None
    if font_path and os.path.exists(font_path):
        try:
            with open(font_path, "rb") as f:
                font_buffer = f.read()
        except Exception:
            font_buffer = None

    font_alias = "ArabicFont" if font_buffer else "helv"

    PAGE_DIMENSIONS = {
        "A4": (595.32, 841.92),
        "A5": (419.53, 595.32),
        "Letter": (612.0, 792.0),
    }
    default_w, default_h = PAGE_DIMENSIONS.get(opts.get("page_size", "A4"), PAGE_DIMENSIONS["A4"])

    doc = fitz.open()

    def _setup_page_font(p: fitz.Page) -> str:
        if font_buffer:
            try:
                p.insert_font(fontname="ArabicFont", fontbuffer=font_buffer)
                return "ArabicFont"
            except Exception:
                return "helv"
        return "helv"

    if mode == "exact":
        # ── Exact Mode: 1:1 Coordinate Positioning ──────────────────────────────
        for page_idx in page_indices:
            if page_idx >= len(project.get("pages", [])):
                continue
            page_data = project["pages"][page_idx]
            pw = float(page_data.get("width") or default_w)
            ph = float(page_data.get("height") or default_h)

            pdf_page = doc.new_page(width=pw, height=ph)
            active_font = _setup_page_font(pdf_page)
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
                if rect.height < 14:
                    rect.y1 = rect.y0 + 16

                f_size = float(el.get("font_size") or font_size_base)
                shaped = _shape_arabic(text)

                try:
                    rc = pdf_page.insert_textbox(
                        rect,
                        shaped,
                        fontname=active_font,
                        fontsize=f_size,
                        align=fitz.TEXT_ALIGN_RIGHT,
                    )
                    # If text did not fit in original bbox, expand slightly to prevent clipping
                    if rc < 0:
                        rect.y1 += abs(rc) + 6
                        pdf_page.insert_textbox(
                            rect,
                            shaped,
                            fontname=active_font,
                            fontsize=max(8.0, f_size * 0.9),
                            align=fitz.TEXT_ALIGN_RIGHT,
                        )
                except Exception:
                    try:
                        pdf_page.insert_text(
                            fitz.Point(rect.x0, rect.y0 + f_size),
                            shaped,
                            fontname=active_font,
                            fontsize=f_size,
                        )
                    except Exception:
                        pass

    else:
        # ── Flowing Mode: Clean Sequential Document Flow ───────────────────────
        margin_x = 54.0  # 0.75 in
        margin_top = 54.0
        margin_bottom = 54.0
        usable_w = default_w - (2 * margin_x)

        pdf_page = doc.new_page(width=default_w, height=default_h)
        active_font = _setup_page_font(pdf_page)
        cur_y = margin_top

        # Aggregate body blocks across pages, handling cross-page continuation
        all_flowing_blocks = []
        for p_counter, page_idx in enumerate(page_indices):
            if page_idx >= len(project.get("pages", [])):
                continue
            page_data = project["pages"][page_idx]
            ocr_data = page_data.get("ocr_data", [])

            # Page separator marker (unless cross-page merge applies to first paragraph)
            page_blocks = []
            for el in ocr_data:
                cat = el.get("category", "Text")
                if cat in ("Page-header", "Page-footer", "Header", "Footer"):
                    continue
                txt = el.get("text", "").strip()
                if txt:
                    page_blocks.append(dict(el))

            if merge_cross_page and all_flowing_blocks and page_blocks:
                last_b = all_flowing_blocks[-1]
                first_b = page_blocks[0]
                if last_b.get("category") == "Text" and first_b.get("category") == "Text":
                    l_text = last_b.get("text", "").rstrip()
                    if l_text and not l_text.endswith((".", "؟", "!", ":", "؛")):
                        # Merge continuing paragraph into previous block
                        last_b["text"] = l_text + " " + first_b.get("text", "").strip()
                        page_blocks.pop(0)

            all_flowing_blocks.extend(page_blocks)

        for el in all_flowing_blocks:
            cat = el.get("category", "Text")
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
            block_h = max(24.0, len(lines) * line_h + 8)

            # Check if we need a new page
            if cur_y + block_h > default_h - margin_bottom:
                pdf_page = doc.new_page(width=default_w, height=default_h)
                active_font = _setup_page_font(pdf_page)
                cur_y = margin_top

            rect = fitz.Rect(margin_x, cur_y, margin_x + usable_w, cur_y + block_h)
            align_code = fitz.TEXT_ALIGN_CENTER if cat in ("Title", "Page-number") else fitz.TEXT_ALIGN_RIGHT

            try:
                rc = pdf_page.insert_textbox(
                    rect,
                    shaped,
                    fontname=active_font,
                    fontsize=f_size,
                    align=align_code,
                )
                if rc < 0:
                    # Need more vertical space
                    rect.y1 += abs(rc) + 6
                    pdf_page.insert_textbox(
                        rect,
                        shaped,
                        fontname=active_font,
                        fontsize=f_size,
                        align=align_code,
                    )
                    cur_y = rect.y1 + 6
                else:
                    cur_y += block_h + 6
            except Exception:
                cur_y += block_h + 6

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    doc.save(output_path)
    doc.close()
    return output_path
