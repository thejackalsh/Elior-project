import base64
import numpy as np
import cv2

MIN_BRIGHTNESS = 40


def decode_image(b64: str) -> np.ndarray:
    data = b64.split(",")[-1]
    arr = np.frombuffer(base64.b64decode(data), np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def letterbox(img: np.ndarray) -> tuple[np.ndarray, float, int, int]:
    """Pad to square then resize — preserves aspect ratio."""
    h, w = img.shape[:2]
    size = max(h, w)
    canvas = np.zeros((size, size, 3), dtype=np.uint8)
    y_off = (size - h) // 2
    x_off = (size - w) // 2
    canvas[y_off:y_off + h, x_off:x_off + w] = img
    scale = 640 / size
    return cv2.resize(canvas, (640, 640)), scale, x_off, y_off


def is_too_dark(img: np.ndarray) -> bool:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return float(gray.mean()) < MIN_BRIGHTNESS


def norm_bbox(box: list[float], scale: float, x_off: int, y_off: int,
              w_orig: int, h_orig: int) -> list[float]:
    """Convert bbox from 640x640 letterbox space to normalized 0-1."""
    x1 = max(0.0, (box[0] / scale - x_off) / w_orig)
    y1 = max(0.0, (box[1] / scale - y_off) / h_orig)
    x2 = min(1.0, (box[2] / scale - x_off) / w_orig)
    y2 = min(1.0, (box[3] / scale - y_off) / h_orig)
    return [x1, y1, x2, y2]
