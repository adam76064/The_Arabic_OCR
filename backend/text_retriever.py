"""
text_retriever.py
Modular helper to retrieve text, lines, and words for bounding boxes and table cells 
from pristine raw OCR data.
Preserves original OCR line and word reading orders (supporting both RTL and LTR scripts).
Intelligently aligns user-edited text with word-level bounding boxes so tracking works smoothly.
"""

import re
import difflib

DIACRITICS_RE = re.compile(r'[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D4-\u08E1\u08E3-\u08FF]')
TATWEEL_RE = re.compile(r'\u0640')

def normalize_word(w):
    if not w:
        return ""
    return TATWEEL_RE.sub('', DIACRITICS_RE.sub('', w))

def is_point_in_bbox(px, py, bbox, margin=5.0):
    x1, y1, x2, y2 = bbox
    return (x1 - margin) <= px <= (x2 + margin) and (y1 - margin) <= py <= (y2 + margin)

def extract_lines_and_words_for_bbox(raw_ocr_blocks, target_bbox, margin=5.0):
    """
    Extracts raw lines and words matching target_bbox from raw_ocr_blocks.
    Iterates through lines and words in their ORIGINAL OCR sequence to maintain 
    correct reading order (LTR, RTL, etc.) without arbitrary spatial re-sorting.
    """
    if not raw_ocr_blocks or not target_bbox:
        return [], ""

    tx1, ty1, tx2, ty2 = target_bbox
    extracted_lines = []
    plain_text_lines = []

    for block in raw_ocr_blocks:
        bx1, by1, bx2, by2 = block.get('bbox', [0, 0, 0, 0])

        # Quick check: does the block intersect target bbox at all?
        if bx2 < tx1 - margin or bx1 > tx2 + margin or by2 < ty1 - margin or by1 > ty2 + margin:
            continue

        lines = block.get('lines', [])
        if lines:
            for line in lines:
                words = line.get('words', [])
                if words:
                    line_words = []
                    for w in words:
                        w_bbox = w.get('bbox')
                        if w_bbox:
                            wx = (w_bbox[0] + w_bbox[2]) / 2.0
                            wy = (w_bbox[1] + w_bbox[3]) / 2.0
                        else:
                            geom = w.get('geometry', {})
                            wx = geom.get('center_x', 0)
                            wy = geom.get('center_y', 0)

                        if is_point_in_bbox(wx, wy, target_bbox, margin=margin):
                            line_words.append(dict(w))

                    if line_words:
                        line_copy = dict(line)
                        line_copy['words'] = line_words
                        line_copy['text'] = " ".join([w.get('text', '') for w in line_words])
                        extracted_lines.append(line_copy)
                        plain_text_lines.append(line_copy['text'])
                else:
                    # Line without words array
                    l_bbox = line.get('bbox')
                    if l_bbox:
                        lx = (l_bbox[0] + l_bbox[2]) / 2.0
                        ly = (l_bbox[1] + l_bbox[3]) / 2.0
                        if is_point_in_bbox(lx, ly, target_bbox, margin=margin):
                            extracted_lines.append(dict(line))
                            plain_text_lines.append(line.get('text', ''))
                    else:
                        extracted_lines.append(dict(line))
                        plain_text_lines.append(line.get('text', ''))
        else:
            # Block has no lines array
            b_text = block.get('text', '')
            if b_text and not block.get('category') == 'Picture':
                plain_text_lines.append(b_text)

    full_text = "\n".join(plain_text_lines).strip()
    return extracted_lines, full_text

def extract_text_for_bbox(raw_ocr_blocks, target_bbox, margin=5.0):
    _, text = extract_lines_and_words_for_bbox(raw_ocr_blocks, target_bbox, margin=margin)
    return text

def align_user_text_to_lines(lines, user_text):
    """
    Aligns user's custom/edited text tokens to the word bboxes in lines using SequenceMatcher.
    Prunes unmatched words so the line/word structures strictly match the user's text tokens.
    """
    if not lines or not user_text:
        return lines, user_text

    clean_user = re.sub(r'<[^>]+>', ' ', user_text)
    user_tokens = [t for t in re.split(r'\s+', clean_user) if t.strip()]
    if not user_tokens:
        return lines, user_text

    # Flatten original words
    orig_words = []
    for l_idx, line in enumerate(lines):
        for w_idx, w in enumerate(line.get('words', [])):
            orig_words.append((l_idx, w_idx, dict(w)))

    if not orig_words:
        return lines, user_text

    orig_tokens_norm = [normalize_word(w[2].get('text', '')) for w in orig_words]
    user_tokens_norm = [normalize_word(t) for t in user_tokens]

    matcher = difflib.SequenceMatcher(None, orig_tokens_norm, user_tokens_norm)
    
    matched_orig_indices = {}
    
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag in ('equal', 'replace'):
            orig_slice = orig_words[i1:i2]
            user_slice = user_tokens[j1:j2]
            for k in range(min(len(orig_slice), len(user_slice))):
                l_idx, w_idx, word_obj = orig_slice[k]
                word_obj['text'] = user_slice[k]
                matched_orig_indices[(l_idx, w_idx)] = word_obj

    # Reconstruct lines containing ONLY matched words (pruning out-of-scope words)
    new_lines = []
    for l_idx, line in enumerate(lines):
        kept_words = []
        for w_idx, w in enumerate(line.get('words', [])):
            if (l_idx, w_idx) in matched_orig_indices:
                kept_words.append(matched_orig_indices[(l_idx, w_idx)])

        if kept_words:
            line_copy = dict(line)
            line_copy['words'] = kept_words
            line_copy['text'] = " ".join([w.get('text', '') for w in kept_words])
            new_lines.append(line_copy)

    return new_lines, user_text

def populate_table_cells_from_raw(raw_ocr_blocks, table_block, margin=5.0):
    """
    Populates table_structure['cells'] text and words using raw_ocr_blocks.
    """
    if not table_block or 'table_structure' not in table_block:
        return table_block

    cells = table_block['table_structure'].get('cells', [])
    all_cell_texts = []

    for cell in cells:
        c_bbox = cell.get('bbox')
        if not c_bbox:
            continue

        c_lines, cell_text = extract_lines_and_words_for_bbox(raw_ocr_blocks, c_bbox, margin=margin)
        cell_formatted = cell_text.replace('\n', '<br/>')

        # If cell already had edited text, preserve user text
        if cell.get('text') and cell['text'].strip():
            cell_formatted = cell['text']
            c_lines, _ = align_user_text_to_lines(c_lines, cell_formatted)

        cell['text'] = cell_formatted
        if c_lines:
            cell['lines'] = c_lines
        if cell_formatted:
            all_cell_texts.append(cell_formatted)

    if all_cell_texts:
        table_block['text'] = "\n".join(all_cell_texts)

    return table_block

def populate_layout_blocks_text(raw_ocr_blocks, current_layout_blocks, preserve_reviewed=True):
    """
    Re-maps text and reconstructs lines/words for a list of layout blocks from raw_ocr_blocks.
    Preserves user edits and reviewed blocks while restoring word/line tracking structures.
    """
    if not raw_ocr_blocks:
        return current_layout_blocks

    updated_blocks = []
    for block in current_layout_blocks:
        b_copy = dict(block)

        # 1. Handle Tables & Poetry (شعر عمودي)
        if (b_copy.get('category') == 'Table' or b_copy.get('category') == 'شعر عمودي') and 'table_structure' in b_copy:
            b_copy = populate_table_cells_from_raw(raw_ocr_blocks, b_copy)
            updated_blocks.append(b_copy)
            continue

        # 2. Extract lines & words from raw OCR for block bbox
        bbox = b_copy.get('bbox')
        if bbox:
            raw_lines, raw_text = extract_lines_and_words_for_bbox(raw_ocr_blocks, bbox)
            
            # Check if block has user-edited text or reviewed status
            has_user_text = bool(b_copy.get('text') and b_copy.get('text').strip())
            is_reviewed = bool(b_copy.get('reviewed'))

            if is_reviewed and preserve_reviewed:
                aligned_lines, _ = align_user_text_to_lines(raw_lines, b_copy['text'])
                b_copy['lines'] = aligned_lines
            elif has_user_text:
                aligned_lines, _ = align_user_text_to_lines(raw_lines, b_copy['text'])
                b_copy['lines'] = aligned_lines
            else:
                b_copy['text'] = raw_text
                b_copy['lines'] = raw_lines

        updated_blocks.append(b_copy)

    return updated_blocks
