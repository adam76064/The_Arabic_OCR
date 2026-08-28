"""
Locro OCR adapter - offline Chrome ScreenAI.
"""
import logging

logger = logging.getLogger(__name__)

_SCREEN_AI_INSTANCE = None


def get_screen_ai():
    global _SCREEN_AI_INSTANCE
    if _SCREEN_AI_INSTANCE is not None:
        return _SCREEN_AI_INSTANCE

    ScreenAI = None
    try:
        from ...vendor.locro import ScreenAI
    except (ImportError, ValueError):
        pass

    if ScreenAI is None:
        try:
            from backend.vendor.locro import ScreenAI
        except ImportError:
            pass

    if ScreenAI is None:
        try:
            from locro import ScreenAI
        except ImportError:
            pass

    if ScreenAI is None:
        raise RuntimeError("تعذر استيراد وحدة Locro ScreenAI المدمجة.")

    try:
        _SCREEN_AI_INSTANCE = ScreenAI()
        return _SCREEN_AI_INSTANCE
    except Exception as e:
        raise RuntimeError(
            f"تعذر تشغيل نموذج Locro ScreenAI: متصفح Google Chrome غير مثبت في المسار الافتراضي على الجهاز أو غير متاح.\nالتفاصيل: {e}"
        )


def run_locro_ocr(image_path, config=None):
    ai = get_screen_ai()
    res = ai.ocr(str(image_path))
    data = res.to_dict()

    blocks = []

    for page in data.get("pages", []):
        page_w = float(page.get("width", 1))
        page_h = float(page.get("height", 1))

        for b_idx, block in enumerate(page.get("blocks", [])):
            block_type = block.get("block_type", "paragraph")
            category = "Text"
            if block_type == "table":
                category = "Table"
            elif block_type == "image":
                category = "Picture"
            elif block_type == "list":
                category = "List-item"

            lines_data = []
            block_bbox = None

            for line in block.get("lines", []):
                lb = line.get("bounding_box", {})
                if lb:
                    lx, ly, lw, lh = lb.get("x", 0), lb.get("y", 0), lb.get("width", 0), lb.get("height", 0)
                    line_bbox = [round(lx, 2), round(ly, 2), round(lx + lw, 2), round(ly + lh, 2)]
                    line_geom = {
                        "center_x": (lx + lw / 2.0) / page_w if page_w else 0,
                        "center_y": (ly + lh / 2.0) / page_h if page_h else 0,
                        "width": lw / page_w if page_w else 0,
                        "height": lh / page_h if page_h else 0,
                    }
                else:
                    line_bbox = [0.0, 0.0, 0.0, 0.0]
                    line_geom = {}

                words_data = []
                for word in line.get("words", []):
                    wb = word.get("bounding_box", {})
                    if wb:
                        wx, wy, ww, wh = wb.get("x", 0), wb.get("y", 0), wb.get("width", 0), wb.get("height", 0)
                        w_bbox = [round(wx, 2), round(wy, 2), round(wx + ww, 2), round(wy + wh, 2)]
                        w_geom = {
                            "center_x": (wx + ww / 2.0) / page_w if page_w else 0,
                            "center_y": (wy + wh / 2.0) / page_h if page_h else 0,
                            "width": ww / page_w if page_w else 0,
                            "height": wh / page_h if page_h else 0,
                        }
                    else:
                        w_bbox = [0.0, 0.0, 0.0, 0.0]
                        w_geom = {}

                    w_entry = {"text": word.get("text", ""), "bbox": w_bbox, "geometry": w_geom, "confidence": round(word.get("confidence", 1.0), 4)}
                    words_data.append(w_entry)

                l_entry = {"text": line.get("text", ""), "bbox": line_bbox, "geometry": line_geom, "words": words_data}
                lines_data.append(l_entry)

                if block_bbox is None:
                    block_bbox = list(line_bbox)
                else:
                    block_bbox[0] = min(block_bbox[0], line_bbox[0])
                    block_bbox[1] = min(block_bbox[1], line_bbox[1])
                    block_bbox[2] = max(block_bbox[2], line_bbox[2])
                    block_bbox[3] = max(block_bbox[3], line_bbox[3])

            if block_bbox is None:
                block_bbox = [0.0, 0.0, 0.0, 0.0]
                block_geom = {}
            else:
                block_geom = {
                    "center_x": ((block_bbox[0] + block_bbox[2]) / 2.0) / page_w if page_w else 0,
                    "center_y": ((block_bbox[1] + block_bbox[3]) / 2.0) / page_h if page_h else 0,
                    "width": (block_bbox[2] - block_bbox[0]) / page_w if page_w else 0,
                    "height": (block_bbox[3] - block_bbox[1]) / page_h if page_h else 0,
                }

            block_text = "\n".join(l["text"] for l in lines_data)

            blocks.append({"category": category, "text": block_text, "bbox": block_bbox, "geometry": block_geom, "lines": lines_data})

    return blocks
