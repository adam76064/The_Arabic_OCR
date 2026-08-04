# backend/table_handler.py
import os
import cv2
import fitz  # PyMuPDF
import numpy as np
from table_detector import (
    preprocess, line_grid_detector, blob_detector,
    column_finder, row_grouper, row_reconciler, span_detector,
)


class TableHandler:
    def __init__(self, project_manager):
        self.project_manager = project_manager

    # ══════════════════════════════════════════════════════════════
    # TIER 1 — Native PDF vectors
    # ══════════════════════════════════════════════════════════════
    def _rects_overlap(self, a, b):
        """Manual bounds check — fitz.Rect.intersects() returns False for
        zero-area rects, which is exactly what a horizontal or vertical
        line's own bounding rect is (zero height or zero width), so every
        line would be incorrectly rejected before ever being rasterized."""
        return not (b.x1 < a.x0 or b.x0 > a.x1 or b.y1 < a.y0 or b.y0 > a.y1)

    def _detect_from_vectors(self, pdf_path, page_index, tx1, ty1, tx2, ty2,
                              scale_x, scale_y, crop_w, crop_h):
        """
        Rasterizes the ACTUAL per-item vector geometry (each line/rect's own
        points) into a mask, then reuses the same ruling-line grid detector
        as the image paths. Previously this used path.get("rect") — the
        bounding box of the *entire* drawing path — for every item inside
        it, which collapses any multi-segment path (e.g. a whole table's
        gridlines drawn as one compound path, common from Word/LibreOffice)
        into a single meaningless blob.
        """
        doc = fitz.open(pdf_path)
        try:
            pdf_page = doc[page_index]
            # Padded so ruling lines drawn exactly at the table's own
            # boundary edges (very common — that boundary IS the crop
            # rectangle) don't land at pixel index crop_w/crop_h, which is
            # one past the last valid array index and would silently fail
            # to rasterize.
            pad = 4
            mask = np.zeros((crop_h + 2 * pad, crop_w + 2 * pad), dtype=np.uint8)
            table_rect = fitz.Rect(tx1, ty1, tx2, ty2)
            found_any = False

            for path in pdf_page.get_drawings():
                path_rect = path.get("rect")
                if not path_rect or not self._rects_overlap(table_rect, path_rect):
                    continue  # cheap skip before inspecting individual items
                is_filled = path.get("fill") is not None

                for item in path["items"]:
                    op = item[0]
                    geom_rect = None
                    if op == "l":
                        p1, p2 = item[1], item[2]
                        geom_rect = fitz.Rect(min(p1.x, p2.x), min(p1.y, p2.y),
                                               max(p1.x, p2.x), max(p1.y, p2.y))
                    elif op == "re":
                        r = item[1]
                        # A large FILLED rectangle is cell shading, not a
                        # ruling line — only treat it as a border if it's
                        # thin (some exporters draw borders as filled thin
                        # rects instead of stroked lines).
                        if is_filled and min(r.width, r.height) > 3:
                            continue
                        geom_rect = r
                    elif op == "qu":
                        geom_rect = item[1].rect
                    else:
                        continue  # bezier curves aren't ruling lines

                    if not geom_rect or not self._rects_overlap(table_rect, geom_rect):
                        continue

                    px1 = int(round((geom_rect.x0 - tx1) * scale_x)) + pad
                    py1 = int(round((geom_rect.y0 - ty1) * scale_y)) + pad
                    px2 = int(round((geom_rect.x1 - tx1) * scale_x)) + pad
                    py2 = int(round((geom_rect.y1 - ty1) * scale_y)) + pad
                    px1, px2 = max(0, min(px1, mask.shape[1] - 1)), max(0, min(px2, mask.shape[1] - 1))
                    py1, py2 = max(0, min(py1, mask.shape[0] - 1)), max(0, min(py2, mask.shape[0] - 1))
                    if px2 <= px1:
                        px2 = px1 + 1
                    if py2 <= py1:
                        py2 = py1 + 1
                    cv2.rectangle(mask, (px1, py1), (px2, py2), 255, -1)
                    found_any = True

            if not found_any:
                return None

            mask = cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=1)
            grid = line_grid_detector.detect_grid(mask, min_len_ratio=0.05)
            if grid is None:
                return None
            cells, n_rows, n_cols = line_grid_detector.build_cells(grid)
            # Undo the padding before handing coordinates back.
            grid_cols_x = [x - pad for x in grid["cols_x"]]
            grid_rows_y = [y - pad for y in grid["rows_y"]]
            for c in cells:
                c["bbox_crop"] = [c["bbox_crop"][0] - pad, c["bbox_crop"][1] - pad,
                                   c["bbox_crop"][2] - pad, c["bbox_crop"][3] - pad]
            return cells, grid_cols_x, grid_rows_y
        finally:
            doc.close()

    # ══════════════════════════════════════════════════════════════
    # TIER 2 — OCR word coordinates, no image touched
    # ══════════════════════════════════════════════════════════════
    def _detect_from_word_coordinates(self, table_block, tx1, ty1, scale_x, scale_y, crop_w, crop_h):
        boxes = []
        for line in table_block.get("lines", []):
            for w in line.get("words", []):
                bx1, by1, bx2, by2 = w.get("bbox", [0, 0, 0, 0])
                boxes.append({
                    "x1": int(round((bx1 - tx1) * scale_x)), "y1": int(round((by1 - ty1) * scale_y)),
                    "x2": int(round((bx2 - tx1) * scale_x)), "y2": int(round((by2 - ty1) * scale_y)),
                })
        if not boxes:
            return None

        median_h = blob_detector.median_line_height(boxes)
        col_bands = column_finder.find_columns(boxes, crop_w)

        columns_paragraphs = []
        for band in col_bands:
            band_boxes = [b for b in boxes if band[0] <= (b["x1"] + b["x2"]) / 2 < band[1]]
            columns_paragraphs.append(row_grouper.group_column_into_paragraphs(band_boxes, median_h))

        row_bands = row_reconciler.build_row_bands(columns_paragraphs, median_h)
        if not row_bands:
            return None

        band_assignments = []
        for paras in columns_paragraphs:
            band_assignments.append([row_reconciler.assign_to_bands(p, row_bands) for p in paras])

        # No raster image here by design ("without touching the image") —
        # merge detection has to work from the word boxes themselves.
        bridges = span_detector.detect_horizontal_bridges_from_boxes(boxes, col_bands, row_bands)
        cells = span_detector.build_cells_path_b(col_bands, row_bands, columns_paragraphs, band_assignments, bridges)

        cols_x = [0] + [col_bands[i][1] for i in range(len(col_bands) - 1)] + [crop_w]
        rows_y = [0] + [row_bands[i][1] for i in range(len(row_bands) - 1)] + [crop_h]
        return cells, cols_x, rows_y

    # ══════════════════════════════════════════════════════════════
    # TIER 3 — Image morphology (smear), whitespace sub-path
    # ══════════════════════════════════════════════════════════════
    def _detect_from_pixels(self, binary):
        blobs = blob_detector.find_blobs(binary)
        if not blobs:
            return None
        median_h = blob_detector.median_line_height(blobs)
        crop_h, crop_w = binary.shape
        col_bands = column_finder.find_columns(blobs, crop_w)

        columns_paragraphs = []
        for band in col_bands:
            band_blobs = [b for b in blobs if band[0] <= (b["x1"] + b["x2"]) / 2 < band[1]]
            columns_paragraphs.append(row_grouper.group_column_into_paragraphs(band_blobs, median_h))

        row_bands = row_reconciler.build_row_bands(columns_paragraphs, median_h)
        if not row_bands:
            return None

        band_assignments = []
        for paras in columns_paragraphs:
            band_assignments.append([row_reconciler.assign_to_bands(p, row_bands) for p in paras])

        bridges = span_detector.detect_horizontal_bridges(binary, col_bands, row_bands)
        cells = span_detector.build_cells_path_b(col_bands, row_bands, columns_paragraphs, band_assignments, bridges)

        cols_x = [0] + [col_bands[i][1] for i in range(len(col_bands) - 1)] + [crop_w]
        rows_y = [0] + [row_bands[i][1] for i in range(len(row_bands) - 1)] + [crop_h]
        return cells, cols_x, rows_y

    # ══════════════════════════════════════════════════════════════
    # ENTRY POINT
    # ══════════════════════════════════════════════════════════════
    def process_table_layout(self, project_id, page_index, block_index, extraction_method="auto"):
        project = self.project_manager.load_project(project_id)
        if not project:
            return {'ok': False}

        page = project['pages'][page_index]
        img_path = os.path.join(self.project_manager.projects_dir, project_id, 'images', page['image_path'])
        pdf_path = project.get('pdf_path')

        table_block = page.get('ocr_data', [])[block_index]
        tx1, ty1, tx2, ty2 = table_block['bbox']
        native_w, native_h = float(page.get('native_width', 1)), float(page.get('native_height', 1))

        full_img = cv2.imread(img_path)
        scale_x, scale_y = full_img.shape[1] / native_w, full_img.shape[0] / native_h
        crop_w = max(1, int(round((tx2 - tx1) * scale_x)))
        crop_h = max(1, int(round((ty2 - ty1) * scale_y)))

        cells = cols_x_local = rows_y_local = None
        method_used = "none"

        # ── TIER 1: Native PDF Vectors ──────────────────────────────
        if extraction_method in ("auto", "native") and pdf_path and os.path.exists(pdf_path):
            try:
                result = self._detect_from_vectors(pdf_path, page_index, tx1, ty1, tx2, ty2,
                                                    scale_x, scale_y, crop_w, crop_h)
                if result:
                    cells, cols_x_local, rows_y_local = result
                    method_used = "native_vectors"
            except Exception as e:
                print(f"Vector extraction failed: {e}")

        # ── TIER 2: Coordinates (OCR words) ─────────────────────────
        if cells is None and extraction_method in ("auto", "coordinates"):
            result = self._detect_from_word_coordinates(table_block, tx1, ty1, scale_x, scale_y, crop_w, crop_h)
            if result:
                cells, cols_x_local, rows_y_local = result
                method_used = "coordinates"

        # ── TIER 3: Smear / Image Morphology ────────────────────────
        if cells is None and extraction_method in ("auto", "smear"):
            crop_x1, crop_y1 = int(max(0, tx1 * scale_x)), int(max(0, ty1 * scale_y))
            crop_x2 = int(min(full_img.shape[1], tx2 * scale_x))
            crop_y2 = int(min(full_img.shape[0], ty2 * scale_y))
            table_crop = full_img[crop_y1:crop_y2, crop_x1:crop_x2]

            if table_crop.size > 0:
                binary = preprocess.preprocess(table_crop)["binary"]
                grid = line_grid_detector.detect_grid(binary)
                if grid is not None:
                    cells, _, _ = line_grid_detector.build_cells(grid)
                    cols_x_local, rows_y_local = grid["cols_x"], grid["rows_y"]
                    method_used = "smear_lines"
                else:
                    result = self._detect_from_pixels(binary)
                    if result:
                        cells, cols_x_local, rows_y_local = result
                        method_used = "smear_whitespace"

        if cells is None:
            cells, cols_x_local, rows_y_local = [], [0, crop_w], [0, crop_h]

        # ── Convert LOCAL crop-pixel space back into native PDF-point space.
        # Plain element-wise conversion (no dedup/re-sort!) — cell.row/col
        # indices reference positions in these arrays directly, so length
        # and order must be preserved exactly.
        cols_x = [round((x / scale_x) + tx1, 2) for x in cols_x_local]
        rows_y = [round((y / scale_y) + ty1, 2) for y in rows_y_local]

        # Cell bboxes are derived from cols_x/rows_y + indices, matching
        # exactly how the frontend itself recomputes them on merge/split/
        # resize — so the initial render and any later edit stay consistent.
        cells_native = []
        for c in cells:
            r, cc, rs, cs = c["row"], c["col"], c["row_span"], c["col_span"]
            cells_native.append({
                "row": r, "col": cc, "row_span": rs, "col_span": cs,
                "bbox": [cols_x[cc], rows_y[r], cols_x[cc + cs], rows_y[r + rs]],
                "text": "",
            })

        table_block['table_structure'] = {
            "rows": max((c["row"] + c["row_span"] for c in cells_native), default=0),
            "cols": max((c["col"] + c["col_span"] for c in cells_native), default=0),
            "cols_x": cols_x, "rows_y": rows_y,
            "cells": cells_native, "method": method_used,
        }
        self.project_manager.update_project(project_id, project)
        return {'ok': True, 'table_structure': table_block['table_structure']}
