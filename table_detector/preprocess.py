# table_detector/preprocess.py
"""
Preprocessing for a user-selected table crop: deskew + binarize.
Works whether the input is a raw scan, a binarized scan, or a
digital-document-converted image — each path is a no-op when it's
already in the right state.
"""
import cv2
import numpy as np


def _to_gray(img):
    if img.ndim == 3:
        return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return img


def _looks_already_binary(gray):
    """True if the image already has (near) only two intensity levels."""
    hist = cv2.calcHist([gray], [0], None, [256], [0, 256]).flatten()
    populated = np.count_nonzero(hist > (gray.size * 0.001))
    return populated <= 3


def binarize(gray):
    """Returns a binary image where ink/text = 255, background = 0."""
    if _looks_already_binary(gray):
        # Still need to know polarity: assume the minority class is ink.
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        white_ratio = np.count_nonzero(binary) / binary.size
        if white_ratio > 0.5:
            binary = cv2.bitwise_not(binary)
        return binary

    # Adaptive threshold handles uneven scan lighting; invert so ink=255.
    binary = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV,
        blockSize=31, C=10
    )
    # Light denoise — isolated single-pixel scan speckle shouldn't count as ink.
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    return binary


def estimate_skew_angle(binary):
    """Estimates rotation (degrees) using the minimum-area rect of ink pixels.
    Returns 0.0 if there isn't enough ink to make a confident estimate."""
    coords = cv2.findNonZero(binary)
    if coords is None or len(coords) < 50:
        return 0.0
    rect = cv2.minAreaRect(coords)
    angle = rect[-1]
    # cv2.minAreaRect angle convention varies by OpenCV version/rect orientation;
    # normalize to the smallest rotation that would make edges axis-aligned.
    if angle < -45:
        angle = 90 + angle
    if abs(angle) > 20:
        # Large "angle" on a wide, mostly-horizontal blob is almost always a
        # rect-orientation artifact, not real skew — ignore it rather than
        # risk a wild rotation.
        return 0.0
    return angle


def deskew(gray, binary, angle):
    if abs(angle) < 0.2:
        return gray, binary
    h, w = gray.shape
    M = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    gray_r = cv2.warpAffine(gray, M, (w, h), flags=cv2.INTER_CUBIC, borderValue=255)
    binary_r = cv2.warpAffine(binary, M, (w, h), flags=cv2.INTER_NEAREST, borderValue=0)
    return gray_r, binary_r


def preprocess(img):
    """img: BGR or grayscale numpy array (the user's cropped selection).
    Returns dict(gray, binary, angle) all deskew-corrected."""
    gray = _to_gray(img)
    binary = binarize(gray)
    angle = estimate_skew_angle(binary)
    gray, binary = deskew(gray, binary, angle)
    if abs(angle) >= 0.2:
        # Re-binarize post-rotation; interpolation can soften edges.
        binary = binarize(gray)
    return {"gray": gray, "binary": binary, "angle": angle}
