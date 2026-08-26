"""
base.py — Abstract BaseStage and image conversion utilities for ScanTailor Advanced pipeline.
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, Tuple, Union
import base64
import io
import numpy as np
from PIL import Image
import cv2


def image_to_numpy(image_input: Union[str, np.ndarray, Image.Image]) -> np.ndarray:
    """
    Standardize an image input (file path, PIL Image, or NumPy array) to a BGR NumPy array (uint8).
    """
    if isinstance(image_input, str):
        # Read from file using cv2.imdecode to safely support Unicode paths on Windows
        with open(image_input, "rb") as f:
            file_bytes = np.frombuffer(f.read(), dtype=np.uint8)
            img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
            if img is None:
                raise ValueError(f"Failed to read image from path: {image_input}")
            return img

    if isinstance(image_input, Image.Image):
        rgb_img = image_input.convert("RGB")
        np_img = np.array(rgb_img)
        # Convert RGB to BGR for OpenCV / stalib standard
        return cv2.cvtColor(np_img, cv2.COLOR_RGB2BGR)

    if isinstance(image_input, np.ndarray):
        if image_input.dtype != np.uint8:
            image_input = np.clip(image_input, 0, 255).astype(np.uint8)
        if len(image_input.shape) == 2:
            return cv2.cvtColor(image_input, cv2.COLOR_GRAY2BGR)
        return image_input

    raise TypeError(f"Unsupported image type: {type(image_input)}")


try:
    import simplejpeg
    HAS_SIMPLEJPEG = True
except ImportError:
    HAS_SIMPLEJPEG = False


def numpy_to_base64_jpeg(img_np: np.ndarray, quality: int = 80) -> str:
    """
    Encode a NumPy BGR or Grayscale image into a data URI base64 JPEG string.
    Uses simplejpeg/turbojpeg when available, else optimized OpenCV imencode with fast DCT.
    """
    if HAS_SIMPLEJPEG and img_np.ndim in (2, 3):
        try:
            if img_np.ndim == 2:
                encimg = simplejpeg.encode_jpeg(img_np, quality=quality, colorspace='GRAY', fastdct=True)
            else:
                encimg = simplejpeg.encode_jpeg(img_np, quality=quality, colorspace='BGR', fastdct=True)
            b64_str = base64.b64encode(encimg).decode("ascii")
            return f"data:image/jpeg;base64,{b64_str}"
        except Exception:
            pass

    encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
    if hasattr(cv2, "IMWRITE_JPEG_OPTIMIZE"):
        encode_param.extend([int(cv2.IMWRITE_JPEG_OPTIMIZE), 0])
    if hasattr(cv2, "IMWRITE_JPEG_FASTEST"):
        encode_param.extend([int(cv2.IMWRITE_JPEG_FASTEST), 1])

    success, encimg = cv2.imencode(".jpg", img_np, encode_param)
    if not success:
        raise ValueError("Failed to encode image to JPEG")
    b64_str = base64.b64encode(encimg).decode("ascii")
    return f"data:image/jpeg;base64,{b64_str}"


def numpy_to_base64_png(img_np: np.ndarray) -> str:
    """
    Encode a NumPy image into a data URI base64 PNG string.
    """
    success, encimg = cv2.imencode(".png", img_np)
    if not success:
        raise ValueError("Failed to encode image to PNG")
    b64_str = base64.b64encode(encimg).decode("ascii")
    return f"data:image/png;base64,{b64_str}"


class BaseStage(ABC):
    """
    Abstract interface for a ScanTailor Advanced pre-processing stage.
    """

    def __init__(self, name: str):
        self.name = name

    @abstractmethod
    def process(
        self,
        image_np: np.ndarray,
        params: Optional[Dict[str, Any]] = None,
        dpi: int = 300,
    ) -> Dict[str, Any]:
        """
        Execute stage processing.
        Returns dict containing:
          - 'image': processed NumPy image (or images if split)
          - 'metadata': computed parameters, bounding boxes, or confidence metrics
        """
        pass

    @abstractmethod
    def get_default_params(self) -> Dict[str, Any]:
        """
        Return the default parameter dictionary for this stage.
        """
        pass
