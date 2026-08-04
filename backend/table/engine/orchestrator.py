# table_detector/orchestrator.py
"""
Entry point: detect_table_structure(img, crop_origin, rtl) -> JSON dict
matching the schema the frontend table model (row/col/row_span/col_span)
already reads and writes.

Note on deskew: if a nonzero skew angle was corrected internally, bbox_crop
values are in the DESKEWED crop's coordinate frame, not the original's.
bbox_abs is only crop_origin-shifted, so for anything beyond a couple of
degrees of skew, per-cell OCR should run against the deskewed crop
(returned here as `debug.deskewed_gray`) rather than against the original
full-resolution image at bbox_abs.
"""
from . import preprocess, line_grid_detector, blob_detector, column_finder
from . import row_grouper, row_reconciler, span_detector, grid_builder


def _run_path_b(binary, rtl):
    blobs = blob_detector.find_blobs(binary)
    if not blobs:
        return None
    median_h = blob_detector.median_line_height(blobs)
    col_bands = column_finder.find_columns(blobs, binary.shape[1])

    columns_paragraphs = []
    for band in col_bands:
        band_blobs = [b for b in blobs if band[0] <= (b["x1"] + b["x2"]) / 2 < band[1]]
        columns_paragraphs.append(row_grouper.group_column_into_paragraphs(band_blobs, median_h))

    row_bands = row_reconciler.build_row_bands(columns_paragraphs, median_h)
    if not row_bands:
        return None

    band_assignments = []
    ambiguous, total = 0, 0
    for paras in columns_paragraphs:
        assigns = []
        for p in paras:
            total += 1
            ambiguous += int(p["ambiguous_gap_before"])
            assigns.append(row_reconciler.assign_to_bands(p, row_bands))
        band_assignments.append(assigns)

    bridges = span_detector.detect_horizontal_bridges(binary, col_bands, row_bands)
    cells = span_detector.build_cells_path_b(col_bands, row_bands, columns_paragraphs, band_assignments, bridges)

    ambiguous_ratio = (ambiguous / total) if total else 0.0
    confidence = max(0.3, 0.75 - ambiguous_ratio * 0.5)
    return {
        "cells": cells, "n_rows": len(row_bands), "n_cols": len(col_bands),
        "method": "whitespace", "confidence": confidence,
    }


def detect_table_structure(img, crop_origin=(0, 0), rtl=True):
    pre = preprocess.preprocess(img)
    binary = pre["binary"]
    h, w = binary.shape

    result = line_grid_detector.detect(binary)
    if result is not None:
        result["confidence"] = 0.92
    else:
        result = _run_path_b(binary, rtl)

    if result is None:
        return {
            "crop_origin": list(crop_origin), "crop_size": [w, h],
            "detection_method": "none", "confidence": 0.0,
            "grid": {"rows": 0, "cols": 0}, "cells": [],
        }

    return grid_builder.build_output(
        result["cells"], result["n_rows"], result["n_cols"],
        crop_origin, (w, h), result["method"], result["confidence"], rtl=rtl,
    )
