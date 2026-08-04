# table_detector/cell_ocr.py
"""
Bridges structure detection to text recognition, without hardcoding any
particular OCR engine. `ocr_fn` is supplied by the caller — it can wrap
whichever engine the user currently has selected (Tesseract, the Gradio
dotsocr_client, etc).
"""


def fill_cell_text(result, full_res_image, ocr_fn, pad=2):
    """
    result: the JSON dict from orchestrator.detect_table_structure().
    full_res_image: the ORIGINAL full-resolution source image (numpy array,
        BGR or gray) that crop_origin/bbox_abs are relative to. Do not pass
        the cropped/deskewed image here — bbox_abs is defined against the
        original.
    ocr_fn: callable(cropped_image_ndarray) -> str. The caller's chosen
        OCR engine, already configured (language, etc).
    pad: pixels of padding added around each cell crop before OCR, since a
        tight bbox can clip ascenders/descenders.

    Mutates and returns `result`, adding a "text" key to every cell.
    """
    h, w = full_res_image.shape[:2]
    for cell in result["cells"]:
        x1, y1, x2, y2 = cell["bbox_abs"]
        x1, y1 = max(0, x1 - pad), max(0, y1 - pad)
        x2, y2 = min(w, x2 + pad), min(h, y2 + pad)
        if x2 <= x1 or y2 <= y1:
            cell["text"] = ""
            continue
        crop = full_res_image[y1:y2, x1:x2]
        try:
            cell["text"] = ocr_fn(crop)
        except Exception as e:
            cell["text"] = ""
            cell["ocr_error"] = str(e)
    return result
