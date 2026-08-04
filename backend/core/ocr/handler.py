"""
OCRHandler - standardizes raw OCR blocks at all levels (block/line/word)
Handles both absolute bbox and relative geometry inputs.
"""
import json  # kept for compatibility


class OCRHandler:
    def __init__(self):
        self.categories = [
            "Caption",
            "Footnote",
            "Formula",
            "List-item",
            "Page-footer",
            "Page-header",
            "Picture",
            "Section-header",
            "Table",
            "Text",
            "Title",
        ]

    def standardize_page_blocks(self, raw_blocks, native_w, native_h, current_dpi=200.0):
        """
        Returns standardized blocks with:
        - bbox at 72 DPI (native PDF pts space)
        - geometry as relative percentages
        - all levels processed.
        """
        if not raw_blocks:
            return []

        dpi_scale = 72.0 / current_dpi
        standardized = []

        def process_coordinates(item):
            bbox = [0.0, 0.0, 0.0, 0.0]
            geometry = {"center_x": 0.0, "center_y": 0.0, "width": 0.0, "height": 0.0, "angle_deg": 0.0}

            angle = float(item.get("angle_deg", item.get("geometry", {}).get("angle_deg", 0.0)))
            geometry["angle_deg"] = angle

            if "geometry" in item and "center_x" in item["geometry"]:
                g = item["geometry"]
                geometry.update(
                    {
                        "center_x": float(g.get("center_x", 0)),
                        "center_y": float(g.get("center_y", 0)),
                        "width": float(g.get("width", 0)),
                        "height": float(g.get("height", 0)),
                    }
                )
                cx, cy = geometry["center_x"] * native_w, geometry["center_y"] * native_h
                w, h = geometry["width"] * native_w, geometry["height"] * native_h
                bbox = [round(cx - w / 2, 2), round(cy - h / 2, 2), round(cx + w / 2, 2), round(cy + h / 2, 2)]

            elif "bbox" in item or "coordinate" in item:
                raw_box = item.get("bbox") or item.get("coordinate") or [0, 0, 0, 0]
                if any(raw_box):
                    bbox = [round(v * dpi_scale, 2) for v in raw_box]
                    w_pts = bbox[2] - bbox[0]
                    h_pts = bbox[3] - bbox[1]
                    cx_pts = bbox[0] + w_pts / 2
                    cy_pts = bbox[1] + h_pts / 2
                    geometry.update(
                        {
                            "center_x": round(cx_pts / native_w, 4) if native_w > 0 else 0,
                            "center_y": round(cy_pts / native_h, 4) if native_h > 0 else 0,
                            "width": round(w_pts / native_w, 4) if native_w > 0 else 0,
                            "height": round(h_pts / native_h, 4) if native_h > 0 else 0,
                        }
                    )
            return bbox, geometry

        for index, raw in enumerate(raw_blocks):
            category = raw.get("category") or raw.get("block_label") or "Text"
            category = str(category).capitalize()
            if category not in self.categories:
                category = "Text"

            text = raw.get("text") or raw.get("block_content") or ""
            reviewed = bool(raw.get("reviewed", False))
            direction = raw.get("dir", "rtl")
            align = raw.get("align", "right")
            order = int(raw.get("order", index + 1))

            bbox, geometry = process_coordinates(raw)

            lines_data = []
            for line in raw.get("lines", []):
                line_text = line.get("text", "")
                line_bbox, line_geom = process_coordinates(line)

                words_data = []
                for word in line.get("words", []):
                    w_text = word.get("text", "")
                    w_bbox, w_geom = process_coordinates(word)
                    w_entry = {"text": w_text, "bbox": w_bbox, "geometry": w_geom}
                    if "confidence" in word:
                        w_entry["confidence"] = word["confidence"]
                    words_data.append(w_entry)

                l_entry = {"text": line_text, "bbox": line_bbox, "geometry": line_geom, "words": words_data}
                if "confidence" in line:
                    l_entry["confidence"] = line["confidence"]
                lines_data.append(l_entry)

            block_entry = {
                "order": order,
                "category": category,
                "bbox": bbox,
                "geometry": geometry,
                "text": text,
                "reviewed": reviewed,
                "dir": direction,
                "align": align,
                "lines": lines_data,
            }
            if "confidence" in raw:
                block_entry["confidence"] = raw["confidence"]
            if "table_structure" in raw:
                block_entry["table_structure"] = raw["table_structure"]
            standardized.append(block_entry)

        return standardized
