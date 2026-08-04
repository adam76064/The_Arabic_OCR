# table_detector/column_finder.py
"""
Path B (borderless tables) — column detection.
Columns are found FIRST, globally, across the whole crop height, because
gutters between columns are positionally stable regardless of how much
any individual cell's text wraps. Row-finding happens per-column, after
this.
"""
import numpy as np


def _estimate_gutter_floor(blobs, min_jump_ratio=1.8):
    """
    Looks for genuine evidence of TWO distinct gap populations among
    horizontally-adjacent, vertically-overlapping (same-line) blobs: small
    gaps (inside a word, or between disconnected letters of one word) vs
    large gaps (between actual words/columns). If the sorted gap sequence
    shows a clear jump between two clusters, the midpoint of that jump is
    a threshold that should distinguish "still the same column" from "a
    real column break", regardless of the crop's absolute scale.

    Deliberately conservative: with too few gaps, or no clear jump (e.g. a
    simple 2-column table where the only observed same-line gap IS the
    column gutter itself — there's no second, smaller population to
    contrast it against), this returns None rather than guessing, so the
    caller falls back to the flat ratio-based floor instead of demanding
    something even wider than the real gutter.
    """
    if len(blobs) < 4:
        return None
    ordered = sorted(blobs, key=lambda b: b["x1"])
    gaps = []
    for i, b in enumerate(ordered):
        same_line = [o for o in ordered[i + 1:] if o["y1"] < b["y2"] and o["y2"] > b["y1"]]
        if not same_line:
            continue
        nxt = min(same_line, key=lambda o: o["x1"])
        gap = nxt["x1"] - b["x2"]
        if gap > 0:
            gaps.append(gap)
    if len(gaps) < 4:
        return None

    gaps.sort()
    best_i, best_ratio = None, min_jump_ratio
    for i in range(len(gaps) - 1):
        a, b = gaps[i], gaps[i + 1]
        if a <= 0:
            continue
        ratio = b / a
        if ratio > best_ratio:
            best_ratio, best_i = ratio, i
    if best_i is None:
        return None  # no clear two-cluster split -- don't override the flat floor
    return (gaps[best_i] + gaps[best_i + 1]) / 2


def find_columns(blobs, crop_width, min_gutter_ratio=0.012, merge_gap_ratio=0.006):
    """
    blobs: list of {x1,y1,x2,y2} from blob_detector.
    Returns a sorted list of (x_start, x_end) column bands covering the
    ink-occupied span of the crop.
    """
    if not blobs:
        return [(0, crop_width)]

    coverage = np.zeros(crop_width, dtype=np.int32)
    for b in blobs:
        x1 = max(0, min(b["x1"], crop_width - 1))
        x2 = max(0, min(b["x2"], crop_width))
        if x2 > x1:
            coverage[x1:x2] += 1

    min_gutter_abs = max(4, int(crop_width * min_gutter_ratio))
    gutter_floor = _estimate_gutter_floor(blobs)
    min_gutter = max(min_gutter_abs, int(round(gutter_floor))) if gutter_floor else min_gutter_abs
    merge_gap = max(2, int(crop_width * merge_gap_ratio))

    # Find runs of x where coverage == 0 (candidate gutters), long enough to count.
    is_empty = coverage == 0
    gutters = []
    x = 0
    while x < crop_width:
        if is_empty[x]:
            start = x
            while x < crop_width and is_empty[x]:
                x += 1
            if x - start >= min_gutter:
                gutters.append((start, x))
        else:
            x += 1

    # Column bands = the ink-occupied spans between gutters (trim outer margins).
    ink_xs = np.where(coverage > 0)[0]
    if len(ink_xs) == 0:
        return [(0, crop_width)]
    left, right = ink_xs.min(), ink_xs.max() + 1

    bands = []
    cursor = left
    for gs, ge in gutters:
        if gs <= cursor:
            continue
        if gs >= right:
            break
        bands.append((cursor, gs))
        cursor = ge
    if cursor < right:
        bands.append((cursor, right))

    # Merge any bands separated by only a tiny residual gap (noise).
    merged = []
    for band in bands:
        if merged and band[0] - merged[-1][1] <= merge_gap:
            merged[-1] = (merged[-1][0], band[1])
        else:
            merged.append(list(band))
    return [tuple(b) for b in merged] if merged else [(left, right)]
