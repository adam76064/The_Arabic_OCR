"""
sorter.py — Pure-spatial Arabic Reading Order Bounding Box Sorter.

Arabic reading order rules:
  1. Vertical flow: Top to Bottom.
  2. Horizontal flow within a line/row: Right to Left (descending X coordinate).
  3. Multi-column flow: Column 1 is on the RIGHT (largest X range) and read top-to-bottom first,
     followed by Column 2 on the LEFT read top-to-bottom second.
"""
from typing import List, Dict, Any, Tuple


class ArabicReadingOrderSorter:
    """
    Sorts OCR bounding box blocks according to Arabic reading order (Top-to-Bottom, Right-to-Left).
    Supports single-column, multi-column (e.g., 2-column), and mixed page layouts.
    """

    def __init__(self, y_overlap_threshold: float = 0.5):
        """
        Args:
            y_overlap_threshold: Fraction of line height vertical overlap required
                                 to group two boxes into the same horizontal line.
        """
        self.y_overlap_threshold = y_overlap_threshold

    def sort_page_blocks(self, ocr_blocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Sort OCR block dicts in Arabic reading order.

        Args:
            ocr_blocks: List of OCR block dicts, each with 'bbox' [x1, y1, x2, y2].

        Returns:
            New list of OCR blocks sorted in Arabic reading order.
        """
        if not ocr_blocks:
            return []

        blocks = [dict(b) for b in ocr_blocks]

        # Filter blocks with valid bounding boxes
        valid_blocks = [b for b in blocks if b.get("bbox") and len(b["bbox"]) == 4]
        invalid_blocks = [b for b in blocks if not b.get("bbox") or len(b["bbox"]) < 4]

        if not valid_blocks:
            return blocks

        max_x = max(b["bbox"][2] for b in valid_blocks)
        max_y = max(b["bbox"][3] for b in valid_blocks)

        if max_x <= 0:
            return blocks

        # ── 1. Column Gutter Detection ─────────────────────────────────────────
        # Build horizontal histogram across non-full-width blocks
        x_hist = [0] * (int(max_x) + 10)
        for b in valid_blocks:
            bbox = b["bbox"]
            w = bbox[2] - bbox[0]
            if w < max_x * 0.75:
                start_x = int(max(0, bbox[0]))
                end_x = int(min(max_x, bbox[2]))
                for x in range(start_x, end_x):
                    x_hist[x] += 1

        min_search = int(max_x * 0.25)
        max_search = int(max_x * 0.75)

        gutter_x = None
        min_density = float("inf")
        for x in range(min_search, max_search):
            if x_hist[x] < min_density:
                min_density = x_hist[x]
                gutter_x = x

        has_two_columns = (gutter_x is not None) and (min_density <= 2)

        # ── 2. Column & Line Sorting Helper ──────────────────────────────────
        def _sort_column(col_blocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
            if not col_blocks:
                return []

            # Primary sort by y1 (top)
            col_blocks.sort(key=lambda b: b["bbox"][1])

            # Group into horizontal line rows based on vertical overlap
            lines: List[List[Dict[str, Any]]] = []
            for b in col_blocks:
                bbox = b["bbox"]
                y1, y2 = bbox[1], bbox[3]
                h = max(1.0, y2 - y1)

                matched = False
                for line in lines:
                    ref_bbox = line[0]["bbox"]
                    ref_y1, ref_y2 = ref_bbox[1], ref_bbox[3]
                    ref_h = max(1.0, ref_y2 - ref_y1)

                    if abs(y1 - ref_y1) < min(h, ref_h) * self.y_overlap_threshold:
                        line.append(b)
                        matched = True
                        break

                if not matched:
                    lines.append([b])

            # Within each line row, sort RIGHT-TO-LEFT (descending x2 / x1)
            sorted_res = []
            for line in lines:
                line.sort(key=lambda b: (b["bbox"][2], b["bbox"][0]), reverse=True)
                sorted_res.extend(line)

            return sorted_res

        # ── 3. Page Layout Partitioning & Sorting ────────────────────────────
        if has_two_columns and gutter_x is not None:
            right_col = []
            left_col = []
            full_width = []

            for b in valid_blocks:
                bbox = b["bbox"]
                w = bbox[2] - bbox[0]
                center_x = (bbox[0] + bbox[2]) / 2.0
                if w > max_x * 0.75:
                    full_width.append(b)
                elif center_x >= gutter_x:
                    right_col.append(b)
                else:
                    left_col.append(b)

            sorted_right = _sort_column(right_col)
            sorted_left = _sort_column(left_col)

            # Separate full-width headers (top 15%) and footers (bottom 85%)
            top_full = [b for b in full_width if b["bbox"][1] < max_y * 0.15]
            bottom_full = [b for b in full_width if b["bbox"][1] >= max_y * 0.85]
            mid_full = [b for b in full_width if max_y * 0.15 <= b["bbox"][1] < max_y * 0.85]

            result = []
            result.extend(_sort_column(top_full))
            result.extend(sorted_right)
            result.extend(sorted_left)
            result.extend(_sort_column(mid_full))
            result.extend(_sort_column(bottom_full))
            result.extend(invalid_blocks)
            return result
        else:
            sorted_single = _sort_column(valid_blocks)
            sorted_single.extend(invalid_blocks)
            return sorted_single
