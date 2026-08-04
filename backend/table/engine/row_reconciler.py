# table_detector/row_reconciler.py
"""
Path B — reconciles per-column paragraph runs into one shared set of row
bands. A row's vertical extent = the union across columns (the tallest/
most-wrapped cell in that row sets the band; shorter cells in the same
row just sit inside it). A column whose single paragraph spans more than
one shared band is a vertical merge for that column.
"""
import numpy as np


def build_row_bands(columns_paragraphs, median_h, tolerance_factor=0.15):
    """
    columns_paragraphs: list (per column) of paragraph lists from row_grouper.
    A row band is the union of every paragraph interval (from any column)
    that vertically overlaps another — this is the direct implementation
    of "a row's extent = union across columns": if column B's short cell
    and column A's tall/wrapped cell occupy overlapping y-ranges, they're
    the same row, however different their individual heights are.
    Returns a sorted list of (y_start, y_end) global row bands.
    """
    intervals = []
    for paras in columns_paragraphs:
        for p in paras:
            intervals.append([p["y1"], p["y2"]])
    if not intervals:
        return []

    tolerance = max(1.0, median_h * tolerance_factor)
    intervals.sort(key=lambda iv: iv[0])
    merged = [intervals[0]]
    for iv in intervals[1:]:
        if iv[0] <= merged[-1][1] + tolerance:
            merged[-1][1] = max(merged[-1][1], iv[1])
        else:
            merged.append(iv)
    return [(a, b) for a, b in merged]


def assign_to_bands(paragraph, bands, overlap_ratio=0.4):
    """Returns the (start_idx, end_idx) range of bands this paragraph
    overlaps (inclusive), based on vertical overlap fraction."""
    p_h = max(1.0, paragraph["y2"] - paragraph["y1"])
    covered = []
    for i, (bs, be) in enumerate(bands):
        overlap = min(paragraph["y2"], be) - max(paragraph["y1"], bs)
        if overlap > 0 and overlap / p_h >= overlap_ratio:
            covered.append(i)
        elif overlap > 0 and overlap / max(1.0, be - bs) >= overlap_ratio:
            covered.append(i)
    if not covered:
        # Fallback: whichever band centre is closest.
        center = (paragraph["y1"] + paragraph["y2"]) / 2
        dists = [abs(center - (bs + be) / 2) for bs, be in bands]
        covered = [int(np.argmin(dists))]
    return min(covered), max(covered)
