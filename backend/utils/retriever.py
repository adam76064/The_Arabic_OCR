"""
text_retriever.py - robust text & geometry retriever supporting blocks, tables, and poetry.
"""
import re
import difflib

DIACRITICS_RE = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D4-\u08E1\u08E3-\u08FF]")
TATWEEL_RE = re.compile(r"\u0640")


def normalize_word(w):
    if not w:
        return ""
    return TATWEEL_RE.sub("", DIACRITICS_RE.sub("", str(w)))


def is_point_in_bbox(px, py, bbox, margin=5.0):
    x1, y1, x2, y2 = bbox
    return (min(x1, x2) - margin) <= px <= (max(x1, x2) + margin) and (min(y1, y2) - margin) <= py <= (max(y1, y2) + margin)


def bboxes_overlap(b1, b2, margin=5.0):
    if not b1 or not b2:
        return False
    x1 = max(min(b1[0], b1[2]), min(b2[0], b2[2]))
    y1 = max(min(b1[1], b1[3]), min(b2[1], b2[3]))
    x2 = min(max(b1[0], b1[2]), max(b2[0], b2[2]))
    y2 = min(max(b1[1], b1[3]), max(b2[1], b2[3]))
    return (x2 + margin) >= (x1 - margin) and (y2 + margin) >= (y1 - margin)


def extract_lines_and_words_for_bbox(raw_ocr_blocks, target_bbox, margin=5.0):
    """
    Extracts lines, words, and text matching target_bbox from raw OCR blocks.
    Accurately handles:
    - Normal text blocks (with line/word bboxes or plain text)
    - Sub-regions (table cells, 2-column classical poetry hemistichs)
    - Existing table structures in raw_ocr_blocks (without dumping the whole table into each cell)
    """
    if not raw_ocr_blocks or not target_bbox:
        return [], ""

    tx1, ty1, tx2, ty2 = target_bbox
    t_min_x, t_max_x = min(tx1, tx2), max(tx1, tx2)
    t_min_y, t_max_y = min(ty1, ty2), max(ty1, ty2)
    target_norm_box = [t_min_x, t_min_y, t_max_x, t_max_y]
    t_w = max(1.0, t_max_x - t_min_x)
    t_h = max(1.0, t_max_y - t_min_y)
    t_area = t_w * t_h

    extracted_lines = []
    plain_text_lines = []

    for block in raw_ocr_blocks:
        b_box = block.get("bbox", [0, 0, 0, 0])
        bx1, by1, bx2, by2 = b_box
        b_min_x, b_max_x = min(bx1, bx2), max(bx1, bx2)
        b_min_y, b_max_y = min(by1, by2), max(by1, by2)
        b_w = max(1.0, b_max_x - b_min_x)
        b_h = max(1.0, b_max_y - b_min_y)
        b_area = b_w * b_h

        # Quick rejection if block does not overlap target
        if b_max_x < t_min_x - margin or b_min_x > t_max_x + margin or b_max_y < t_min_y - margin or b_min_y > t_max_y + margin:
            continue

        # --- 1. If raw block is a Table/Poetry with table_structure cells ---
        if "table_structure" in block and block["table_structure"] and "cells" in block["table_structure"]:
            matched_cells = []
            for cell in block["table_structure"]["cells"]:
                c_bbox = cell.get("bbox")
                if not c_bbox:
                    continue
                cx1, cy1, cx2, cy2 = min(c_bbox[0], c_bbox[2]), min(c_bbox[1], c_bbox[3]), max(c_bbox[0], c_bbox[2]), max(c_bbox[1], c_bbox[3])
                ix1, iy1 = max(cx1, t_min_x), max(cy1, t_min_y)
                ix2, iy2 = min(cx2, t_max_x), min(cy2, t_max_y)
                if ix2 > ix1 and iy2 > iy1:
                    inter_area = (ix2 - ix1) * (iy2 - iy1)
                    c_area = max(1.0, (cx2 - cx1) * (cy2 - cy1))
                    if inter_area / min(c_area, t_area) > 0.3 or is_point_in_bbox((cx1 + cx2)/2, (cy1 + cy2)/2, target_norm_box, margin=margin):
                        matched_cells.append(cell)

            for m_cell in matched_cells:
                if m_cell.get("lines"):
                    for l in m_cell["lines"]:
                        extracted_lines.append(dict(l))
                        if l.get("text"):
                            plain_text_lines.append(l["text"])
                elif m_cell.get("text"):
                    clean_txt = m_cell["text"].replace("<br/>", "\n").replace("<br>", "\n").strip()
                    if clean_txt:
                        plain_text_lines.append(clean_txt)
            if matched_cells:
                continue

        # --- 2. If raw block has lines ---
        lines = block.get("lines", [])
        if lines:
            for line in lines:
                l_box = line.get("bbox") or [0, 0, 0, 0]
                lx1, ly1, lx2, ly2 = l_box
                l_min_x, l_max_x = min(lx1, lx2), max(lx1, lx2)
                l_min_y, l_max_y = min(ly1, ly2), max(ly1, ly2)
                has_lbox = any(l_box) and (l_max_x > l_min_x or l_max_y > l_min_y)

                # Check if line intersects the target Y-span
                if has_lbox:
                    if l_max_y < t_min_y - margin or l_min_y > t_max_y + margin:
                        continue

                words = line.get("words", [])
                if words:
                    line_words = []
                    for w in words:
                        w_bbox = w.get("bbox")
                        if w_bbox and any(w_bbox):
                            wx = (w_bbox[0] + w_bbox[2]) / 2.0
                            wy = (w_bbox[1] + w_bbox[3]) / 2.0
                        else:
                            geom = w.get("geometry", {})
                            cx = float(geom.get("center_x", 0))
                            cy = float(geom.get("center_y", 0))
                            if cx <= 1.0 and cy <= 1.0 and b_w > 1:
                                wx = b_min_x + cx * b_w
                                wy = b_min_y + cy * b_h
                            else:
                                wx, wy = cx, cy

                        if is_point_in_bbox(wx, wy, target_norm_box, margin=margin):
                            line_words.append(dict(w))

                    if line_words:
                        line_copy = dict(line)
                        line_copy["words"] = line_words
                        line_copy["text"] = " ".join([str(w.get("text", "")).strip() for w in line_words if w.get("text")])
                        if line_copy["text"]:
                            extracted_lines.append(line_copy)
                            plain_text_lines.append(line_copy["text"])
                else:
                    # Line without word bboxes
                    l_text = str(line.get("text", "")).strip()
                    if not l_text:
                        continue

                    l_w = max(1.0, l_max_x - l_min_x)
                    is_sub_column = has_lbox and (t_w < l_w * 0.75 or t_w < b_w * 0.75)

                    if is_sub_column:
                        tokens = l_text.split()
                        if len(tokens) >= 2:
                            # In RTL Arabic: right column is first half (صدر), left column is second half (عجز)
                            t_cx = (t_min_x + t_max_x) / 2.0
                            is_right_col = t_cx > (b_min_x + b_max_x) / 2.0
                            mid = len(tokens) // 2
                            col_tokens = tokens[:mid] if is_right_col else tokens[mid:]
                            col_str = " ".join(col_tokens)
                            if col_str:
                                line_copy = dict(line)
                                line_copy["text"] = col_str
                                extracted_lines.append(line_copy)
                                plain_text_lines.append(col_str)
                        else:
                            t_cx = (t_min_x + t_max_x) / 2.0
                            if t_cx > (b_min_x + b_max_x) / 2.0:
                                extracted_lines.append(dict(line))
                                plain_text_lines.append(l_text)
                    else:
                        if has_lbox:
                            lx_center = (l_min_x + l_max_x) / 2.0
                            ly_center = (l_min_y + l_max_y) / 2.0
                            if is_point_in_bbox(lx_center, ly_center, target_norm_box, margin=margin):
                                extracted_lines.append(dict(line))
                                plain_text_lines.append(l_text)
                        else:
                            if t_area >= b_area * 0.6:
                                extracted_lines.append(dict(line))
                                plain_text_lines.append(l_text)

        # --- 3. If raw block has NO lines (lines list is empty or block is text-only) ---
        else:
            b_text = str(block.get("text", "")).strip()
            if b_text and block.get("category") != "Picture":
                # Check if target is approximately the entire block
                if t_area >= b_area * 0.7:
                    plain_text_lines.append(b_text)
                else:
                    # Sub-cell / poetry cell inside block: match by row (Y) and column (X)
                    raw_lines = [l.strip() for l in b_text.split("\n") if l.strip()]
                    if raw_lines:
                        row_h = b_h / len(raw_lines)
                        t_cy = (t_min_y + t_max_y) / 2.0
                        line_idx = max(0, min(len(raw_lines) - 1, int((t_cy - b_min_y) / max(1.0, row_h))))
                        l_text = raw_lines[line_idx]

                        if t_w < b_w * 0.75:
                            tokens = l_text.split()
                            if len(tokens) >= 2:
                                t_cx = (t_min_x + t_max_x) / 2.0
                                is_right_col = t_cx > (b_min_x + b_max_x) / 2.0
                                mid = len(tokens) // 2
                                col_tokens = tokens[:mid] if is_right_col else tokens[mid:]
                                plain_text_lines.append(" ".join(col_tokens))
                            else:
                                t_cx = (t_min_x + t_max_x) / 2.0
                                if t_cx > (b_min_x + b_max_x) / 2.0:
                                    plain_text_lines.append(l_text)
                        else:
                            plain_text_lines.append(l_text)

    full_text = "\n".join([p for p in plain_text_lines if p.strip()]).strip()
    return extracted_lines, full_text


def extract_text_for_bbox(raw_ocr_blocks, target_bbox, margin=5.0):
    _, text = extract_lines_and_words_for_bbox(raw_ocr_blocks, target_bbox, margin=margin)
    return text


def align_user_text_to_lines(lines, user_text):
    if not lines or not user_text:
        return lines, user_text

    clean_user = re.sub(r"<[^>]+>", " ", str(user_text))
    user_tokens = [t for t in re.split(r"\s+", clean_user) if t.strip()]
    if not user_tokens:
        return lines, user_text

    orig_words = []
    for l_idx, line in enumerate(lines):
        for w_idx, w in enumerate(line.get("words", [])):
            orig_words.append((l_idx, w_idx, dict(w)))

    if not orig_words:
        return lines, user_text

    orig_tokens_norm = [normalize_word(w[2].get("text", "")) for w in orig_words]
    user_tokens_norm = [normalize_word(t) for t in user_tokens]

    matcher = difflib.SequenceMatcher(None, orig_tokens_norm, user_tokens_norm)

    matched_orig_indices = {}

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag in ("equal", "replace"):
            orig_slice = orig_words[i1:i2]
            user_slice = user_tokens[j1:j2]
            for k in range(min(len(orig_slice), len(user_slice))):
                l_idx, w_idx, word_obj = orig_slice[k]
                word_obj["text"] = user_slice[k]
                matched_orig_indices[(l_idx, w_idx)] = word_obj

    new_lines = []
    for l_idx, line in enumerate(lines):
        kept_words = []
        for w_idx, w in enumerate(line.get("words", [])):
            if (l_idx, w_idx) in matched_orig_indices:
                kept_words.append(matched_orig_indices[(l_idx, w_idx)])

        if kept_words:
            line_copy = dict(line)
            line_copy["words"] = kept_words
            line_copy["text"] = " ".join([w.get("text", "") for w in kept_words])
            new_lines.append(line_copy)

    return new_lines, user_text


def populate_table_cells_from_raw(raw_ocr_blocks, table_block, margin=5.0):
    if not table_block or "table_structure" not in table_block:
        return table_block

    cells = table_block["table_structure"].get("cells", [])
    if not cells:
        return table_block

    # Detect corrupted states where every cell has identical full-table text
    non_empty_texts = [c.get("text", "").strip() for c in cells if c.get("text", "").strip()]
    is_corrupted = (
        len(cells) > 1
        and len(non_empty_texts) >= len(cells)
        and len(set(non_empty_texts)) == 1
        and bool(table_block.get("text"))
    )

    all_cell_texts = []

    for cell in cells:
        c_bbox = cell.get("bbox")
        if not c_bbox:
            continue

        c_lines, cell_text = extract_lines_and_words_for_bbox(raw_ocr_blocks, c_bbox, margin=margin)
        cell_formatted = cell_text.replace("\n", "<br/>")

        if not is_corrupted and cell.get("text") and cell["text"].strip():
            cell_formatted = cell["text"]
            if c_lines:
                c_lines, _ = align_user_text_to_lines(c_lines, cell_formatted)

        cell["text"] = cell_formatted
        if c_lines:
            cell["lines"] = c_lines
        if cell_formatted:
            all_cell_texts.append(cell_formatted)

    if all_cell_texts:
        table_block["text"] = "\n".join(all_cell_texts)

    return table_block


def populate_layout_blocks_text(raw_ocr_blocks, current_layout_blocks, preserve_reviewed=True):
    if not raw_ocr_blocks:
        return current_layout_blocks

    updated_blocks = []
    for block in current_layout_blocks:
        b_copy = dict(block)
        cat = b_copy.get("category")

        if (cat in ("Table", "Vertical-poetry", "Poem")) and "table_structure" in b_copy:
            b_copy = populate_table_cells_from_raw(raw_ocr_blocks, b_copy)
            updated_blocks.append(b_copy)
            continue

        bbox = b_copy.get("bbox")
        if bbox:
            raw_lines, raw_text = extract_lines_and_words_for_bbox(raw_ocr_blocks, bbox)

            has_user_text = bool(b_copy.get("text") and b_copy.get("text").strip())
            is_reviewed = bool(b_copy.get("reviewed"))

            if is_reviewed and preserve_reviewed:
                aligned_lines, _ = align_user_text_to_lines(raw_lines, b_copy["text"])
                b_copy["lines"] = aligned_lines
            elif has_user_text:
                aligned_lines, _ = align_user_text_to_lines(raw_lines, b_copy["text"])
                b_copy["lines"] = aligned_lines
            else:
                b_copy["text"] = raw_text
                b_copy["lines"] = raw_lines

        updated_blocks.append(b_copy)

    return updated_blocks
