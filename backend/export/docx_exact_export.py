"""
docx_exact_export.py — 1:1 Pixel-Perfect Word (DOCX) Exporter using Positioned Frames.

Maps 72 DPI PostScript bounding boxes to Word DrawingML Frame elements (dxa units),
reconstructing the exact visual layout of each PDF page in Microsoft Word with
native RTL BiDi OpenXML properties.
"""

from typing import List, Dict, Any, Optional
import os
import re
from docx import Document
from docx.shared import Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

from docx.enum.table import WD_TABLE_DIRECTION
from .shared import (
    SKIP_CATEGORIES,
    _set_section_rtl,
    _set_style_rtl,
    _reorder_pPr,
    _reorder_rPr,
    _split_block_paragraphs,
    parse_inline_runs,
    _OPENXML_JC_MAP,
    _set_table_no_borders,
    _fill_poetry_cell,
    _parse_poetry_lines,
    _set_paragraph_spacing,
    _apply_paragraph_layout,
    _apply_run_formatting,
    _css_color_to_hex,
)


def _create_table_position_element(left_pt: float, top_pt: float) -> OxmlElement:
    """
    Creates an OpenXML <w:tblpPr> element anchored to the page.
    Positions a floating table at exact (X, Y) coordinates in twips (1 pt = 20 dxa).
    """
    left_dxa = int(round(max(0.0, left_pt) * 20.0))
    top_dxa = int(round(max(0.0, top_pt) * 20.0))

    tblp_pr = OxmlElement("w:tblpPr")
    tblp_pr.set(qn("w:leftFromText"), "0")
    tblp_pr.set(qn("w:rightFromText"), "0")
    tblp_pr.set(qn("w:topFromText"), "0")
    tblp_pr.set(qn("w:bottomFromText"), "0")
    tblp_pr.set(qn("w:vertAnchor"), "page")
    tblp_pr.set(qn("w:horzAnchor"), "page")
    tblp_pr.set(qn("w:tblpX"), str(left_dxa))
    tblp_pr.set(qn("w:tblpY"), str(top_dxa))
    return tblp_pr


def _create_frame_element(
    left_pt: float,
    top_pt: float,
    width_pt: float,
    height_pt: float,
    wrap: str = "none",
    h_rule: str = "atLeast",
) -> OxmlElement:
    """
    Creates an OpenXML <w:framePr> element anchored to the page margins.
    1 pt = 20 dxa (twentieths of a point).
    """
    left_dxa = int(round(max(0.0, left_pt) * 20.0))
    top_dxa = int(round(max(0.0, top_pt) * 20.0))
    width_dxa = int(round(max(1.0, width_pt) * 20.0))
    height_dxa = int(round(max(1.0, height_pt) * 20.0))

    frame_pr = OxmlElement("w:framePr")
    frame_pr.set(qn("w:w"), str(width_dxa))
    frame_pr.set(qn("w:h"), str(height_dxa))
    frame_pr.set(qn("w:hRule"), h_rule)
    frame_pr.set(qn("w:x"), str(left_dxa))
    frame_pr.set(qn("w:y"), str(top_dxa))
    frame_pr.set(qn("w:hAnchor"), "page")
    frame_pr.set(qn("w:vAnchor"), "page")
    frame_pr.set(qn("w:wrap"), wrap)
    return frame_pr


def export_docx_exact(
    project: Dict[str, Any],
    page_indices: List[int],
    output_path: str,
    opts: Optional[Dict[str, Any]] = None,
) -> bool:
    """
    Exports specified project pages to a DOCX document using absolutely positioned frames.
    Preserves exact (x, y, width, height) layout coordinates from the source PDF.
    """
    opts = opts or {}
    font_name = opts.get("font_name") or "Traditional Arabic"
    font_size_default = int(opts.get("font_size", 14))
    rtl = bool(opts.get("rtl", True))
    include_background = bool(opts.get("include_background", False))
    text_mode = opts.get("text_mode", "formatted")

    doc = Document()

    # Clear initial section margins so coordinates map from true page edge (0,0)
    first_section = doc.sections[0]
    first_section.top_margin = Pt(0)
    first_section.bottom_margin = Pt(0)
    first_section.left_margin = Pt(0)
    first_section.right_margin = Pt(0)

    # Style defaults
    style = doc.styles["Normal"]
    _set_style_rtl(style, font_name=font_name, font_size_pt=font_size_default, is_rtl=rtl)

    cat_fmt_map = project.get("metadata", {}).get("category_formatting", {}) or {}

    for idx_seq, p_idx in enumerate(page_indices):
        if p_idx < 0 or p_idx >= len(project.get("pages", [])):
            continue

        page = project["pages"][p_idx]
        native_w = float(page.get("native_width", 595.3))  # default A4
        native_h = float(page.get("native_height", 841.9))

        # Create new section for each subsequent page to allow page-specific dimensions
        if idx_seq > 0:
            # Insert an invisible bare paragraph to anchor the section break away from the last
            # positioned frame — prevents Word from misassigning frames across pages.
            _sep = doc.add_paragraph()
            _sep_pPr = _sep._p.get_or_add_pPr()
            _pb = OxmlElement("w:pageBreakBefore")
            _pb.set(qn("w:val"), "0")
            _sep_pPr.append(_pb)
            _sp = OxmlElement("w:spacing")
            _sp.set(qn("w:before"), "0")
            _sp.set(qn("w:after"), "0")
            _sp.set(qn("w:line"), "1")
            _sp.set(qn("w:lineRule"), "exact")
            _sep_pPr.append(_sp)
            _reorder_pPr(_sep_pPr)
            section = doc.add_section()
            section.top_margin = Pt(0)
            section.bottom_margin = Pt(0)
            section.left_margin = Pt(0)
            section.right_margin = Pt(0)
        else:
            section = first_section

        section.page_width = Pt(native_w)
        section.page_height = Pt(native_h)
        _set_section_rtl(section, is_rtl=rtl)

        ocr_data = page.get("ocr_data", [])

        # In exact layout mode, we do NOT skip page-header or page-number, because
        # the user wants an exact visual replica of the PDF page.
        # We only skip explicitly suppressed categories or empty blocks.
        exact_skip_categories = set(opts.get("skip_categories", []))

        # Process each block on the page
        for el in ocr_data:
            cat = el.get("category", "Text")
            if cat in exact_skip_categories:
                continue

            raw_text = el.get("text", "").strip()
            bbox = el.get("bbox") or [0, 0, native_w, native_h]
            if len(bbox) < 4:
                continue

            x1, y1, x2, y2 = bbox
            bw = max(1.0, x2 - x1)
            bh = max(1.0, y2 - y1)

            # Determine styling and direction
            cat_fmt = cat_fmt_map.get(cat, {})
            el_align = el.get("align") or cat_fmt.get("align") or ("center" if cat in ("Title", "Caption") else "right")
            el_dir = el.get("dir") or cat_fmt.get("dir") or ("rtl" if rtl else "ltr")
            is_rtl = (el_dir == "rtl")

            block_font_size = el.get("font_size") or el.get("fontSize") or font_size_default

            # ── Picture Block ─────────────────────────────────────────────────
            if cat == "Picture":
                # Add picture frame placeholder or embed image if available
                p = doc.add_paragraph()
                p_pr = p._p.get_or_add_pPr()
                p_pr.append(_create_frame_element(x1, y1, bw, bh, wrap="none"))
                _reorder_pPr(p_pr)
                continue

            # ── Poetry Blocks (Vertical-poetry & Staggered-poetry) ────────────
            if cat in ("Vertical-poetry", "Staggered-poetry"):
                verses = _parse_poetry_lines(el)
                if verses:
                    ptbl = doc.add_table(rows=len(verses), cols=3)
                    _set_table_no_borders(ptbl)
                    if is_rtl:
                        ptbl.table_direction = WD_TABLE_DIRECTION.RTL
                    ptblp_pr = _create_table_position_element(x1, y1)
                    ptbl._element.tblPr.insert(0, ptblp_pr)

                    # Explicitly set total table width in dxa
                    ptbl_w_dxa = int(round(bw * 20.0))
                    ptbl_w = ptbl._element.tblPr.find(qn("w:tblW"))
                    if ptbl_w is None:
                        ptbl_w = OxmlElement("w:tblW")
                        ptbl._element.tblPr.append(ptbl_w)
                    ptbl_w.set(qn("w:type"), "dxa")
                    ptbl_w.set(qn("w:w"), str(ptbl_w_dxa))

                    col_w_sadr = int(round(bw * 0.45 * 20.0))
                    col_w_sep = int(round(bw * 0.10 * 20.0))
                    col_w_ajuz = int(round(bw * 0.45 * 20.0))

                    for v_idx, (right, left) in enumerate(verses):
                        row = ptbl.rows[v_idx]
                        c0, c1, c2 = row.cells[0], row.cells[1], row.cells[2]
                        for c_elem, w_dxa in ((c0, col_w_sadr), (c1, col_w_sep), (c2, col_w_ajuz)):
                            tcPr = c_elem._element.get_or_add_tcPr()
                            tcW = tcPr.find(qn("w:tcW"))
                            if tcW is None:
                                tcW = OxmlElement("w:tcW")
                                tcPr.append(tcW)
                            tcW.set(qn("w:type"), "dxa")
                            tcW.set(qn("w:w"), str(w_dxa))

                        _fill_poetry_cell(c0, right, font_name, block_font_size, is_rtl=is_rtl, align="lowKashida")
                        _fill_poetry_cell(c1, "...", font_name, max(8, int(block_font_size) - 4), is_rtl=is_rtl, align="center")
                        _fill_poetry_cell(c2, left, font_name, block_font_size, is_rtl=is_rtl, align="lowKashida")
                    continue

            # ── Structured Table Block ────────────────────────────────────────
            if cat == "Table":
                ts = el.get("table_structure")
                # If table_structure is absent, try synthesizing from pipe or tab separated lines
                if not ts and raw_text and ("\t" in raw_text or "|" in raw_text):
                    t_lines = [ln.strip() for ln in raw_text.splitlines() if ln.strip()]
                    rows_parsed = []
                    for t_ln in t_lines:
                        clean_ln = t_ln.strip("|")
                        sep = "\t" if "\t" in clean_ln else "|"
                        parts = [p.strip() for p in clean_ln.split(sep)]
                        if all(re.match(r"^[:\- ]+$", p) for p in parts if p):
                            continue
                        rows_parsed.append(parts)
                    if rows_parsed:
                        max_c = max(len(r) for r in rows_parsed)
                        if max_c > 1:
                            synth_cells = []
                            for r_i, r_data in enumerate(rows_parsed):
                                for c_i in range(max_c):
                                    c_txt = r_data[c_i] if c_i < len(r_data) else ""
                                    synth_cells.append({"row": r_i, "col": c_i, "text": c_txt, "row_span": 1, "col_span": 1})
                            ts = {"rows": len(rows_parsed), "cols": max_c, "cells": synth_cells}

                if ts:
                    num_rows = ts.get("rows", 1)
                    num_cols = ts.get("cols", 1)
                    cells = ts.get("cells", [])
                    cols_x = ts.get("cols_x", [])
                    if num_rows > 0 and num_cols > 0:
                        tbl = doc.add_table(rows=num_rows, cols=num_cols)
                        tbl.style = "Table Grid"
                        if is_rtl:
                            tbl.table_direction = WD_TABLE_DIRECTION.RTL
                        tblp_pr = _create_table_position_element(x1, y1)
                        tbl._element.tblPr.insert(0, tblp_pr)

                        # Explicitly set total table width in dxa
                        tbl_w_dxa = int(round(bw * 20.0))
                        tbl_w_elem = tbl._element.tblPr.find(qn("w:tblW"))
                        if tbl_w_elem is None:
                            tbl_w_elem = OxmlElement("w:tblW")
                            tbl._element.tblPr.append(tbl_w_elem)
                        tbl_w_elem.set(qn("w:type"), "dxa")
                        tbl_w_elem.set(qn("w:w"), str(tbl_w_dxa))

                        # Determine column widths in points
                        col_widths_pt = []
                        if cols_x and len(cols_x) >= num_cols + 1:
                            for ci in range(num_cols):
                                col_widths_pt.append(max(10.0, float(cols_x[ci + 1]) - float(cols_x[ci])))
                        else:
                            col_widths_pt = [bw / max(1, num_cols)] * num_cols

                        for c_info in cells:
                            r = c_info.get("row", 0)
                            c = c_info.get("col", 0)
                            r_span = c_info.get("row_span", 1)
                            c_span = c_info.get("col_span", 1)
                            if r < num_rows and c < num_cols:
                                top_left_cell = tbl.cell(r, c)
                                if r_span > 1 or c_span > 1:
                                    target_r = min(r + r_span - 1, num_rows - 1)
                                    target_c = min(c + c_span - 1, num_cols - 1)
                                    top_left_cell.merge(tbl.cell(target_r, target_c))
                                top_left_cell.text = ""

                                # Set explicit cell width in dxa
                                cell_w_pt = sum(col_widths_pt[c:c + c_span]) if (c + c_span <= len(col_widths_pt)) else col_widths_pt[c]
                                cell_w_dxa = int(round(cell_w_pt * 20.0))
                                tcPr = top_left_cell._element.get_or_add_tcPr()
                                tcW = tcPr.find(qn("w:tcW"))
                                if tcW is None:
                                    tcW = OxmlElement("w:tcW")
                                    tcPr.append(tcW)
                                tcW.set(qn("w:type"), "dxa")
                                tcW.set(qn("w:w"), str(cell_w_dxa))

                                cell_text = c_info.get("text", "")
                                c_para = top_left_cell.paragraphs[0]
                                _set_paragraph_spacing(c_para, 0, 0)
                                c_align = c_info.get("align") or el_align
                                _apply_paragraph_layout(c_para, c_align, is_rtl)
                                if cell_text:
                                    runs_spec = parse_inline_runs(cell_text) if text_mode == "formatted" else [(cell_text, {})]
                                    for r_txt, r_style in runs_spec:
                                        if not r_txt:
                                            continue
                                        if r_txt == "\n":
                                            c_para.add_run().add_break()
                                            continue
                                        run = c_para.add_run(r_txt)
                                        _apply_run_formatting(run, r_style, font_name, block_font_size, is_r_rtl=is_rtl, cat_fmt=cat_fmt)
                                bg_color = c_info.get("bg_color")
                                if bg_color:
                                    hex_bg = _css_color_to_hex(bg_color)
                                    if hex_bg:
                                        shd = OxmlElement("w:shd")
                                        shd.set(qn("w:val"), "clear")
                                        shd.set(qn("w:color"), "auto")
                                        shd.set(qn("w:fill"), hex_bg)
                                        tcPr.append(shd)
                        continue

            # ── Text Block in Positioned Frame ───────────────────────────────
            paragraphs = _split_block_paragraphs(raw_text) if text_mode == "formatted" else [raw_text]
            if not paragraphs:
                paragraphs = [""]

            # In OpenXML, multiple paragraphs cannot share a single framePr cleanly
            # unless they are separate frames or combined. We calculate line step for sub-paragraphs.
            sub_h = bh / max(1, len(paragraphs))

            for p_sub_idx, p_content in enumerate(paragraphs):
                p = doc.add_paragraph()
                p_pr = p._p.get_or_add_pPr()

                # Add frame position
                frame_top = y1 + (p_sub_idx * sub_h)
                p_pr.append(_create_frame_element(x1, frame_top, bw, sub_h, wrap="none"))

                # Apply paragraph alignment & RTL BiDi flags honoring Word XSD sequence order
                _apply_paragraph_layout(p, el_align, is_rtl)

                # Zero margins / spacing inside frame for tight alignment
                sp_elem = p_pr.find(qn("w:spacing"))
                if sp_elem is None:
                    sp_elem = OxmlElement("w:spacing")
                    p_pr.append(sp_elem)
                sp_elem.set(qn("w:before"), "0")
                sp_elem.set(qn("w:after"), "0")
                sp_elem.set(qn("w:line"), "240")  # 1.0 line spacing
                sp_elem.set(qn("w:lineRule"), "auto")

                _reorder_pPr(p_pr)

                # Add formatted text runs
                if text_mode == "formatted":
                    runs_spec = parse_inline_runs(p_content)
                else:
                    runs_spec = [(p_content, {})]

                for run_text, style_spec in runs_spec:
                    if not run_text:
                        continue
                    if run_text == "\n":
                        p.add_run().add_break()
                        continue
                    run = p.add_run(run_text)
                    r_pr = run._r.get_or_add_rPr()

                    # Font Family
                    r_font = style_spec.get("font_family") or el.get("font_name") or font_name
                    r_fonts = OxmlElement("w:rFonts")
                    r_fonts.set(qn("w:ascii"), r_font)
                    r_fonts.set(qn("w:hAnsi"), r_font)
                    r_fonts.set(qn("w:cs"), r_font)
                    r_pr.append(r_fonts)

                    # Font Size
                    r_sz_pt = style_spec.get("font_size") or block_font_size
                    try:
                        r_sz_val = int(round(float(r_sz_pt) * 2.0))
                    except Exception:
                        r_sz_val = int(font_size_default * 2)

                    sz_elem = OxmlElement("w:sz")
                    sz_elem.set(qn("w:val"), str(r_sz_val))
                    r_pr.append(sz_elem)

                    sz_cs = OxmlElement("w:szCs")
                    sz_cs.set(qn("w:val"), str(r_sz_val))
                    r_pr.append(sz_cs)

                    # Bold / Italic
                    if style_spec.get("bold") or cat_fmt.get("bold"):
                        b_elem = OxmlElement("w:b")
                        r_pr.append(b_elem)
                        b_cs = OxmlElement("w:bCs")
                        r_pr.append(b_cs)

                    if style_spec.get("italic") or cat_fmt.get("italic"):
                        i_elem = OxmlElement("w:i")
                        r_pr.append(i_elem)
                        i_cs = OxmlElement("w:iCs")
                        r_pr.append(i_cs)

                    # RTL flag
                    if is_rtl:
                        rtl_elem = OxmlElement("w:rtl")
                        rtl_elem.set(qn("w:val"), "1")
                        r_pr.append(rtl_elem)

                    # Color
                    color_hex = style_spec.get("color") or el.get("font_color")
                    if color_hex and isinstance(color_hex, str) and color_hex.startswith("#") and len(color_hex) == 7:
                        c_elem = OxmlElement("w:color")
                        c_elem.set(qn("w:val"), color_hex[1:].upper())
                        r_pr.append(c_elem)

                    _reorder_rPr(r_pr)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    doc.save(output_path)
    return True
