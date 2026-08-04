"""
TableHandler - bridge between project storage and table detection engine.
Cleaned version of original backend/table_handler.py
"""
import os
import cv2
import fitz  # PyMuPDF
import numpy as np

try:
    from .engine import orchestrator, line_grid_detector, blob_detector, column_finder, row_grouper, row_reconciler
except ImportError:
    # fallback when imported as table_detector still
    from table_detector import orchestrator, line_grid_detector, blob_detector, column_finder, row_grouper, row_reconciler

from ..utils.retriever import extract_text_for_bbox


class TableHandler:
    def __init__(self, project_manager):
        self.project_manager = project_manager

    def process_table_layout(self, project_id, page_index, block_index, extraction_method="auto"):
        project = self.project_manager.load_project(project_id)
        if not project:
            return {'ok': False, 'error': 'Project not found'}

        page = project['pages'][page_index]
        img_path = os.path.join(self.project_manager.projects_dir, project_id, 'images', page['image_path'])
        pdf_path = project.get('pdf_path')

        table_block = page.get('ocr_data', [])[block_index]
        tx1, ty1, tx2, ty2 = table_block['bbox']
        native_w, native_h = float(page.get('native_width', 1)), float(page.get('native_height', 1))

        full_img = cv2.imread(img_path)
        if full_img is None:
            return {'ok': False, 'error': 'Image not found'}
        scale_x, scale_y = full_img.shape[1] / native_w, full_img.shape[0] / native_h

        grid = None
        method_used = "none"
        cols_x, rows_y = [tx1, tx2], [ty1, ty2]

        # Tier 1: Native PDF vectors
        if extraction_method in ["auto", "native"] and pdf_path and os.path.exists(pdf_path):
            try:
                doc = fitz.open(pdf_path)
                pdf_page = doc[page_index]
                vector_mask = np.zeros((int((ty2 - ty1)*scale_y) + 20, int((tx2 - tx1)*scale_x) + 20), dtype=np.uint8)
                lines_found = False
                for path in pdf_page.get_drawings():
                    for item in path["items"]:
                        if item[0] in ("l", "c", "re"):
                            rect = path.get("rect")
                            if rect and fitz.Rect(tx1, ty1, tx2, ty2).intersects(rect):
                                px1, py1 = int((rect.x0 - tx1)*scale_x), int((rect.y0 - ty1)*scale_y)
                                px2, py2 = int((rect.x1 - tx1)*scale_x), int((rect.y1 - ty1)*scale_y)
                                cv2.rectangle(vector_mask, (px1, py1), (px2, py2), 255, -1)
                                lines_found = True
                doc.close()
                if lines_found:
                    vector_mask = cv2.dilate(vector_mask, np.ones((3,3), np.uint8), iterations=1)
                    grid_result = line_grid_detector.detect_grid(vector_mask, min_len_ratio=0.05)
                    if grid_result:
                        grid = grid_result
                        method_used = "native_vectors"
                        cols_x = [round((x / scale_x) + tx1, 2) for x in grid["cols_x"]]
                        rows_y = [round((y / scale_y) + ty1, 2) for y in grid["rows_y"]]
            except Exception as e:
                print(f"[TableHandler] Vector extraction failed: {e}")

        # Tier 2: Word coordinates
        if grid is None and extraction_method in ["auto", "coordinates"]:
            blobs = []
            for line in table_block.get('lines', []):
                for w in line.get('words', []):
                    bx1, by1, bx2, by2 = w.get('bbox', [0,0,0,0])
                    blobs.append({
                        "x1": int((bx1 - tx1) * scale_x), "y1": int((by1 - ty1) * scale_y),
                        "x2": int((bx2 - tx1) * scale_x), "y2": int((by2 - ty1) * scale_y)
                    })
            if blobs:
                median_h = blob_detector.median_line_height(blobs)
                crop_width = int((tx2 - tx1) * scale_x)
                col_bands = column_finder.find_columns(blobs, crop_width)
                columns_paragraphs = []
                for band in col_bands:
                    band_blobs = [b for b in blobs if band[0] <= (b["x1"] + b["x2"]) / 2 < band[1]]
                    columns_paragraphs.append(row_grouper.group_column_into_paragraphs(band_blobs, median_h))
                row_bands = row_reconciler.build_row_bands(columns_paragraphs, median_h)
                if col_bands and row_bands:
                    cols_x = [tx1] + [round((b[1] / scale_x) + tx1, 2) for b in col_bands[:-1]] + [tx2]
                    rows_y = [ty1] + [round((b[1] / scale_y) + ty1, 2) for b in row_bands[:-1]] + [ty2]
                    method_used = "coordinates"
                    grid = True

        # Tier 3: Image morphology / smear
        if grid is None and extraction_method in ["auto", "smear"]:
            crop_x1, crop_y1 = int(max(0, tx1 * scale_x)), int(max(0, ty1 * scale_y))
            crop_x2, crop_y2 = int(min(full_img.shape[1], tx2 * scale_x)), int(min(full_img.shape[0], ty2 * scale_y))
            table_crop = full_img[crop_y1:crop_y2, crop_x1:crop_x2]
            binary = orchestrator.preprocess.preprocess(table_crop)["binary"]

            grid_result = line_grid_detector.detect_grid(binary)
            if grid_result:
                cols_x = [round((x / scale_x) + tx1, 2) for x in grid_result["cols_x"]]
                rows_y = [round((y / scale_y) + ty1, 2) for y in grid_result["rows_y"]]
                method_used = "smear_lines"
            else:
                blobs = blob_detector.find_blobs(binary)
                if blobs:
                    median_h = blob_detector.median_line_height(blobs)
                    col_bands = column_finder.find_columns(blobs, binary.shape[1])
                    columns_paragraphs = []
                    for band in col_bands:
                        columns_paragraphs.append(row_grouper.group_column_into_paragraphs([b for b in blobs if band[0] <= (b["x1"] + b["x2"])/2 < band[1]], median_h))
                    row_bands = row_reconciler.build_row_bands(columns_paragraphs, median_h)
                    cols_x = [tx1] + [round((b[1] / scale_x) + tx1, 2) for b in col_bands[:-1]] + [tx2]
                    rows_y = [ty1] + [round((b[1] / scale_y) + ty1, 2) for b in row_bands[:-1]] + [ty2]
                    method_used = "smear_whitespace"

        # Build final cells
        cols_x, rows_y = sorted(list(set(cols_x))), sorted(list(set(rows_y)))
        cells_72dpi = []

        raw_ocr_blocks = self.project_manager.load_raw_ocr(project_id, page_index)

        all_table_text = []
        for r in range(len(rows_y) - 1):
            for c in range(len(cols_x) - 1):
                cell_bbox = [cols_x[c], rows_y[r], cols_x[c+1], rows_y[r+1]]
                cell_text_raw = extract_text_for_bbox(raw_ocr_blocks, cell_bbox, margin=5.0)
                final_text = cell_text_raw.replace('\n', '<br>')

                if final_text:
                    all_table_text.append(cell_text_raw)

                cells_72dpi.append({
                    "row": r, "col": c,
                    "row_span": 1, "col_span": 1,
                    "bbox": cell_bbox,
                    "text": final_text
                })

        table_block['table_structure'] = {
            "rows": len(rows_y) - 1, "cols": len(cols_x) - 1,
            "cols_x": cols_x, "rows_y": rows_y,
            "cells": cells_72dpi,
            "method": method_used
        }
        table_block['text'] = "\n".join(all_table_text)

        self.project_manager.update_project(project_id, project)
        return {'ok': True, 'table_structure': table_block['table_structure']}
