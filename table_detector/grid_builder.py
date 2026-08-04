# table_detector/grid_builder.py
"""
Assembles the final output JSON. All detection above works in plain
image x/y coordinates, direction-agnostic; RTL remapping happens here,
as one isolated last step, by flipping column indices.
"""


def remap_rtl(cells, n_cols):
    """Flips visual left-to-right column order into logical RTL order
    (col 0 = rightmost). row/col stay 0-indexed; only the column index
    (and therefore reading order) changes — geometry/bboxes are untouched."""
    remapped = []
    for c in cells:
        new_col = n_cols - c["col"] - c["col_span"]
        remapped.append({**c, "col": new_col})
    return remapped


def build_output(cells, n_rows, n_cols, crop_origin, crop_size, method, confidence, rtl=True):
    if rtl:
        cells = remap_rtl(cells, n_cols)

    cx, cy = crop_origin
    for c in cells:
        x1, y1, x2, y2 = c["bbox_crop"]
        c["bbox_abs"] = [x1 + cx, y1 + cy, x2 + cx, y2 + cy]

    cells.sort(key=lambda c: (c["row"], c["col"]))

    return {
        "crop_origin": [int(cx), int(cy)],
        "crop_size": [int(crop_size[0]), int(crop_size[1])],
        "detection_method": method,
        "confidence": round(float(confidence), 3),
        "grid": {"rows": n_rows, "cols": n_cols},
        "cells": cells,
    }
