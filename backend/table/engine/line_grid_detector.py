# table_detector/line_grid_detector.py
"""
Path A — bordered tables. Isolates horizontal/vertical ruling lines
morphologically, reconstructs the grid from their positions, and detects
merged cells as places where an interior divider is missing along part
of its length.
"""
import cv2
import numpy as np


def _line_mask(binary, axis, min_len_ratio):
    h, w = binary.shape
    if axis == "h":
        size = max(10, int(w * min_len_ratio))
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (size, 1))
    else:
        size = max(10, int(h * min_len_ratio))
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, size))
    mask = cv2.erode(binary, kernel, iterations=1)
    mask = cv2.dilate(mask, kernel, iterations=1)
    return mask


def _cluster_positions(positions, merge_dist):
    """Sorted 1D positions -> merged cluster centers."""
    if not positions:
        return []
    positions = sorted(positions)
    clusters = [[positions[0]]]
    for p in positions[1:]:
        if p - clusters[-1][-1] <= merge_dist:
            clusters[-1].append(p)
        else:
            clusters.append([p])
    return [int(round(np.mean(c))) for c in clusters]


def detect_grid(binary, min_len_ratio=0.08, coverage_thresh=0.5):
    """
    Returns None if no reliable ruling-line grid is found (caller should
    fall back to Path B), otherwise a dict with:
      rows_y: sorted list of horizontal line y-positions (len = numRows+1)
      cols_x: sorted list of vertical line x-positions (len = numCols+1)
      h_mask, v_mask: the isolated line masks (used for merge detection)
    """
    h, w = binary.shape
    h_mask = _line_mask(binary, "h", min_len_ratio)
    v_mask = _line_mask(binary, "v", min_len_ratio)

    h_coverage = (h_mask > 0).sum(axis=1) / w      # per-row fraction covered
    v_coverage = (v_mask > 0).sum(axis=0) / h       # per-col fraction covered

    row_ys = np.where(h_coverage > coverage_thresh)[0].tolist()
    col_xs = np.where(v_coverage > coverage_thresh)[0].tolist()

    row_ys = _cluster_positions(row_ys, merge_dist=max(3, h // 200))
    col_xs = _cluster_positions(col_xs, merge_dist=max(3, w // 200))

    if len(row_ys) < 2 or len(col_xs) < 2:
        return None  # not enough structure for even a single bordered cell

    return {"rows_y": row_ys, "cols_x": col_xs, "h_mask": h_mask, "v_mask": v_mask}


def _segment_has_ink(mask, axis, fixed, start, end, min_run_ratio=0.6):
    """Checks whether `mask` has a continuous-enough ink run along one
    divider segment (used to tell a real divider from a missing one)."""
    if axis == "v":  # vertical divider at x=fixed, spanning y in [start,end]
        strip = mask[start:end, max(0, fixed - 1):fixed + 2]
    else:  # horizontal divider at y=fixed, spanning x in [start,end]
        strip = mask[max(0, fixed - 1):fixed + 2, start:end]
    if strip.size == 0:
        return False
    # Collapse across the narrow probe width to get one ink-present flag per
    # position ALONG the divider's length, then average over that length.
    # (Collapsing the other way -- across the length -- only ever yields a
    # couple of booleans regardless of how long the run is, so a single
    # stray pixel anywhere along the run could flip the whole check to
    # "ink present" even when the divider is mostly missing.)
    coverage = (strip > 0).any(axis=1 if axis == "v" else 0)
    return coverage.mean() >= min_run_ratio


def build_cells(grid):
    """Turns ruling-line positions into a list of grid cells, merging
    neighbors wherever the dividing segment between them is missing."""
    rows_y, cols_x = grid["rows_y"], grid["cols_x"]
    n_rows, n_cols = len(rows_y) - 1, len(cols_x) - 1
    h_mask, v_mask = grid["h_mask"], grid["v_mask"]

    # union-find over the (n_rows x n_cols) base grid
    parent = list(range(n_rows * n_cols))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i, j):
        ri, rj = find(i), find(j)
        if ri != rj:
            parent[ri] = rj

    def idx(r, c):
        return r * n_cols + c

    # Horizontal neighbors (missing vertical divider between them = merge)
    for r in range(n_rows):
        for c in range(n_cols - 1):
            x = cols_x[c + 1]
            if not _segment_has_ink(v_mask, "v", x, rows_y[r], rows_y[r + 1]):
                union(idx(r, c), idx(r, c + 1))

    # Vertical neighbors (missing horizontal divider between them = merge)
    for r in range(n_rows - 1):
        for c in range(n_cols):
            y = rows_y[r + 1]
            if not _segment_has_ink(h_mask, "h", y, cols_x[c], cols_x[c + 1]):
                union(idx(r, c), idx(r + 1, c))

    groups = {}
    for r in range(n_rows):
        for c in range(n_cols):
            root = find(idx(r, c))
            groups.setdefault(root, []).append((r, c))

    cells = []
    for members in groups.values():
        rs = [m[0] for m in members]
        cs = [m[1] for m in members]
        r0, r1 = min(rs), max(rs)
        c0, c1 = min(cs), max(cs)
        cells.append({
            "row": r0, "col": c0,
            "row_span": r1 - r0 + 1, "col_span": c1 - c0 + 1,
            "bbox_crop": [cols_x[c0], rows_y[r0], cols_x[c1 + 1], rows_y[r1 + 1]],
        })

    return cells, n_rows, n_cols


def detect(binary):
    grid = detect_grid(binary)
    if grid is None:
        return None
    cells, n_rows, n_cols = build_cells(grid)
    return {"cells": cells, "n_rows": n_rows, "n_cols": n_cols, "method": "lines"}
