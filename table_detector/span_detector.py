# table_detector/span_detector.py
"""
Shared merge-detection step, used by both paths so the logic isn't
duplicated. Path A already resolves spans directly from missing ruling
segments (see line_grid_detector.build_cells) — this module is mainly
exercised by Path B, where merges/splits have to be inferred from ink
geometry instead of missing lines.
"""
import numpy as np


def detect_horizontal_bridges_from_boxes(boxes, column_bands, row_bands, gutter_inset=2):
    """
    Same idea as detect_horizontal_bridges, but for cases where there's no
    raster image to check ink against — only text boxes (e.g. OCR word
    coordinates used directly, without touching the page image at all).
    A box that genuinely straddles a gutter (starts before it, ends after
    it) for a given row band counts as a horizontal merge for that row.
    """
    bridges = set()
    for ci in range(len(column_bands) - 1):
        gx1 = column_bands[ci][1] + gutter_inset
        gx2 = column_bands[ci + 1][0] - gutter_inset
        if gx2 <= gx1:
            continue
        for ri, (ry1, ry2) in enumerate(row_bands):
            for b in boxes:
                if b["y1"] < ry2 and b["y2"] > ry1 and b["x1"] < gx1 and b["x2"] > gx2:
                    bridges.add((ri, ci))
                    break
    return bridges


def detect_horizontal_bridges(binary, column_bands, row_bands, gutter_inset=2):
    """
    For each internal gutter between adjacent column bands, checks — per
    row band — whether ink actually bridges the gutter for that row only
    (a horizontal merge for that specific row), even though the gutter is
    empty across most other rows (which is why column_finder found it as
    a column boundary in the first place).

    `gutter_inset` shrinks the checked strip INWARD from each column band's
    real ink edge (rather than expanding outward), since expanding outward
    would immediately overlap the neighboring column's real text — the
    column band boundary already sits exactly at that text's edge.

    Returns a set of (row_idx, col_idx) pairs that bridge into the NEXT
    column for that row.
    """
    bridges = set()
    for ci in range(len(column_bands) - 1):
        gx1 = column_bands[ci][1] + gutter_inset
        gx2 = column_bands[ci + 1][0] - gutter_inset
        if gx2 <= gx1:
            continue  # gutter too narrow to check safely; assume no bridge
        for ri, (ry1, ry2) in enumerate(row_bands):
            y1, y2 = int(max(0, ry1)), int(min(binary.shape[0], ry2))
            x1, x2 = int(max(0, gx1)), int(min(binary.shape[1], gx2))
            if y2 <= y1 or x2 <= x1:
                continue
            strip = binary[y1:y2, x1:x2]
            if strip.size and (strip > 0).any():
                bridges.add((ri, ci))
    return bridges


def build_cells_path_b(column_bands, row_bands, columns_paragraphs, band_assignments, bridges):
    """
    Assembles the final (row, col, row_span, col_span, bbox) cell list
    for Path B from:
      - band_assignments[col_idx] = list of (start_band, end_band) per paragraph
      - bridges = set of (row_idx, col_idx) that merge into the next column
    A cell that both spans multiple row bands (vertical merge) and bridges
    horizontally is combined into one rectangular span.
    """
    n_rows, n_cols = len(row_bands), len(column_bands)
    occupied = set()
    cells = []

    for ci, paras in enumerate(columns_paragraphs):
        for p, (r0, r1) in zip(paras, band_assignments[ci]):
            if (r0, ci) in occupied:
                continue  # already covered by a preceding horizontal merge
            col_span = 1
            c = ci
            # Extend col_span while every row in [r0,r1] bridges c -> c+1.
            while c + 1 < n_cols and all((r, c) in bridges for r in range(r0, r1 + 1)):
                col_span += 1
                c += 1
            row_span = r1 - r0 + 1
            for r in range(r0, r1 + 1):
                for cc in range(ci, ci + col_span):
                    occupied.add((r, cc))

            x1 = min(column_bands[ci][0], p["x1"])
            x2 = max(column_bands[min(ci + col_span - 1, n_cols - 1)][1], p["x2"])
            y1 = min(row_bands[r0][0], p["y1"])
            y2 = max(row_bands[r1][1], p["y2"])

            cells.append({
                "row": r0, "col": ci,
                "row_span": row_span, "col_span": col_span,
                "bbox_crop": [int(x1), int(y1), int(x2), int(y2)],
            })
    return cells
