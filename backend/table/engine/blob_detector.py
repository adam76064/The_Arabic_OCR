# table_detector/blob_detector.py
"""
Finds text blobs (word/line fragments) purely from ink connectivity —
no OCR engine involved. Used by Path B (borderless tables) to find rows
and columns geometrically before any text recognition happens.
"""
import cv2
import numpy as np


def find_blobs(binary, min_area=6, min_dim=2, calibrate=True):
    """
    binary: ink=255 image (already deskewed/binarized).
    Returns a list of dicts: {x1,y1,x2,y2} for each connected ink
    component, after a horizontal dilation that fuses individual
    character strokes into word-sized blobs (without merging across
    normal word-spacing gaps).

    `calibrate`: if True (default), the dilation width is derived from
    the text's OWN detected scale rather than the image's pixel width.
    Tying it to image width breaks whenever font size and crop
    resolution aren't in the ratio that constant assumed — a small
    crop of a big scan and a downscaled full page need very different
    dilation amounts for the same physical letter-spacing. This does a
    quick first pass with minimal dilation just to get an unbiased
    estimate of line height, then re-fuses at the right scale.
    """
    def _components(dilate_w):
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (dilate_w, 1))
        fused = cv2.dilate(binary, kernel, iterations=1)
        num, labels, stats, _ = cv2.connectedComponentsWithStats(fused, connectivity=8)
        found = []
        for i in range(1, num):  # skip background label 0
            x, y, bw, bh, area = stats[i]
            if area < min_area or bw < min_dim or bh < min_dim:
                continue
            # Re-tighten the bbox against the *original* (un-dilated) ink so
            # positions used for column/row math aren't inflated by the dilation.
            region = binary[y:y + bh, x:x + bw]
            ys, xs = np.where(region > 0)
            if len(xs) == 0:
                continue
            found.append({
                "x1": int(x + xs.min()), "y1": int(y + ys.min()),
                "x2": int(x + xs.max() + 1), "y2": int(y + ys.max() + 1),
            })
        return found

    if not calibrate:
        w = binary.shape[1]
        return _components(max(2, w // 200))

    # Pass 1: minimal dilation — just enough to join individual strokes into
    # letter-scale fragments — purely to get an unbiased line-height estimate.
    rough = _components(2)
    if not rough:
        return rough
    est_height = median_line_height(rough)

    # Pass 2: re-fuse using a width scaled to the text's own size. This is
    # the actual distinguishing factor between "gap inside one word" and
    # "gap between two words" — font size, not image resolution.
    dilate_w = max(2, int(round(est_height * 0.35)))
    return _components(dilate_w)


def median_line_height(blobs):
    if not blobs:
        return 10.0
    heights = [b["y2"] - b["y1"] for b in blobs]
    return float(np.median(heights))
