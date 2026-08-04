# table_detector/row_grouper.py
"""
Path B — per-column row/paragraph grouping.
A column can mix single-line short phrases and multi-line wrapped text,
so we can't just cluster by identical y. Instead: group blobs into text
lines by y-overlap, then group consecutive lines into paragraphs (cells)
by comparing the gap between them to the median line height.
"""
import numpy as np


def _group_into_lines(blobs):
    """Blobs -> text lines, by vertical (y-range) overlap/proximity."""
    if not blobs:
        return []
    blobs = sorted(blobs, key=lambda b: b["y1"])
    lines = [[blobs[0]]]
    for b in blobs[1:]:
        last = lines[-1]
        last_y2 = max(x["y2"] for x in last)
        last_y1 = min(x["y1"] for x in last)
        # Same line if this blob's y-range overlaps the current line's band at all.
        if b["y1"] < last_y2 and b["y2"] > last_y1:
            last.append(b)
        else:
            lines.append([b])
    line_boxes = []
    for group in lines:
        line_boxes.append({
            "y1": min(g["y1"] for g in group),
            "y2": max(g["y2"] for g in group),
            "x1": min(g["x1"] for g in group),
            "x2": max(g["x2"] for g in group),
            "blobs": group,
        })
    return line_boxes


def group_column_into_paragraphs(blobs, median_h, wrap_factor=0.8, row_factor=1.6):
    """
    Returns a list of paragraph dicts for one column:
      {y1, y2, x1, x2, lines: [...], ambiguous_gap_before: bool}
    `ambiguous_gap_before` flags a gap that's bigger than "still wrapping"
    but smaller than a confident "new row" gap — a real split-vs-wrap call
    that ultimately gets resolved by row_reconciler comparing across columns.
    """
    lines = _group_into_lines(blobs)
    if not lines:
        return []

    wrap_gap_max = median_h * wrap_factor
    row_gap_min = median_h * row_factor

    paragraphs = [{"y1": lines[0]["y1"], "y2": lines[0]["y2"],
                   "x1": lines[0]["x1"], "x2": lines[0]["x2"],
                   "lines": [lines[0]], "ambiguous_gap_before": False}]

    for line in lines[1:]:
        prev = paragraphs[-1]
        gap = line["y1"] - prev["y2"]
        if gap <= wrap_gap_max:
            # Still wrapping within the same cell.
            prev["y2"] = max(prev["y2"], line["y2"])
            prev["x1"] = min(prev["x1"], line["x1"])
            prev["x2"] = max(prev["x2"], line["x2"])
            prev["lines"].append(line)
        else:
            paragraphs.append({
                "y1": line["y1"], "y2": line["y2"],
                "x1": line["x1"], "x2": line["x2"],
                "lines": [line],
                "ambiguous_gap_before": gap < row_gap_min,
            })
    return paragraphs
