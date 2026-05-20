import numpy as np
from PIL import Image, ImageFilter

from app.schemas import PreprocessParams


def apply_preprocess(img: Image.Image, params: PreprocessParams | None) -> Image.Image:
    if params is None or not params.enabled:
        return img
    out = img.convert("RGB")
    if params.blur_radius > 0:
        out = out.filter(ImageFilter.MedianFilter(size=params.blur_radius * 2 + 1))
        out = out.filter(ImageFilter.GaussianBlur(radius=params.blur_radius))
    arr = np.array(out, dtype=np.float32)
    levels = params.posterize_levels
    step = 255.0 / (levels - 1) if levels > 1 else 255.0
    arr = np.round(arr / step) * step
    if params.edge_strength > 0:
        gray = np.array(out.convert("L"), dtype=np.float32)
        gx = np.zeros_like(gray)
        gy = np.zeros_like(gray)
        gx[:, 1:-1] = gray[:, 2:] - gray[:, :-2]
        gy[1:-1, :] = gray[2:, :] - gray[:-2, :]
        edge = np.clip(np.sqrt(gx**2 + gy**2), 0, 255)
        edge3 = edge[..., np.newaxis]
        arr = np.clip(arr - edge3 * params.edge_strength * 0.5, 0, 255)
    return Image.fromarray(arr.astype(np.uint8))
