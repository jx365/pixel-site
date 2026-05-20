import gzip
import json
from pathlib import Path

import numpy as np
from PIL import Image

from app.schemas import PaletteColor, PreprocessParams, RenderParams
from app.services.preprocess import apply_preprocess

BAYER_4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], dtype=np.float32) / 16.0


def rgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    r, g, b = rgb[..., 0] / 255.0, rgb[..., 1] / 255.0, rgb[..., 2] / 255.0
    r = np.where(r > 0.04045, ((r + 0.055) / 1.055) ** 2.4, r / 12.92)
    g = np.where(g > 0.04045, ((g + 0.055) / 1.055) ** 2.4, g / 12.92)
    b = np.where(b > 0.04045, ((b + 0.055) / 1.055) ** 2.4, b / 12.92)
    x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375
    y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750
    z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041
    x, y, z = x / 0.95047, y / 1.0, z / 1.08883
    x = np.where(x > 0.008856, x ** (1 / 3), 7.787 * x + 16 / 116)
    y = np.where(y > 0.008856, y ** (1 / 3), 7.787 * y + 16 / 116)
    z = np.where(z > 0.008856, z ** (1 / 3), 7.787 * z + 16 / 116)
    return np.stack([116 * y - 16, 500 * (x - y), 200 * (y - z)], axis=-1)


def apply_tone(img: Image.Image, saturation: float, gamma: float, contrast: float) -> Image.Image:
    arr = np.array(img.convert("RGB"), dtype=np.float32) / 255.0
    gray = arr.mean(axis=2, keepdims=True)
    arr = gray + (arr - gray) * saturation
    arr = np.clip(arr, 0, 1)
    arr = np.power(arr, 1.0 / max(gamma, 0.01))
    arr = np.clip((arr - 0.5) * contrast + 0.5, 0, 1)
    return Image.fromarray((arr * 255).astype(np.uint8))


def crop_image(img: Image.Image, crop: dict | None) -> Image.Image:
    if not crop:
        return img
    w, h = img.size
    x = int(crop["x"] * w)
    y = int(crop["y"] * h)
    cw = int(crop["w"] * w)
    ch = int(crop["h"] * h)
    return img.crop((x, y, x + cw, y + ch))


def _palette_arrays(colors: list[PaletteColor]):
    rgb = np.array([[c.r, c.g, c.b] for c in colors], dtype=np.float32)
    lab = rgb_to_lab(rgb)
    labels = [c.label for c in colors]
    return rgb, lab, labels


def _nearest_indices(pixels: np.ndarray, palette_rgb: np.ndarray, palette_lab: np.ndarray, color_space: str) -> np.ndarray:
    if color_space == "lab":
        px_lab = rgb_to_lab(pixels.astype(np.float32))
        diff = px_lab[:, np.newaxis, :] - palette_lab[np.newaxis, :, :]
        dist = np.sum(diff**2, axis=2)
    else:
        diff = pixels[:, np.newaxis, :].astype(np.float32) - palette_rgb[np.newaxis, :, :]
        dist = np.sum(diff**2, axis=2)
    return np.argmin(dist, axis=1).reshape(pixels.shape[0], pixels.shape[1] if pixels.ndim == 3 else 1)


def _floyd_steinberg(indices: np.ndarray, pixels: np.ndarray, palette_rgb: np.ndarray, palette_lab: np.ndarray, color_space: str) -> np.ndarray:
    h, w = indices.shape
    work = pixels.astype(np.float32).copy()
    out = np.zeros((h, w), dtype=np.int32)
    for y in range(h):
        for x in range(w):
            old = work[y, x]
            if color_space == "lab":
                px_lab = rgb_to_lab(old.reshape(1, 1, 3))[0, 0]
                diff = palette_lab - px_lab
                idx = int(np.argmin(np.sum(diff**2, axis=1)))
            else:
                diff = palette_rgb - old
                idx = int(np.argmin(np.sum(diff**2, axis=1)))
            out[y, x] = idx
            new = palette_rgb[idx]
            err = old - new
            if x + 1 < w:
                work[y, x + 1] += err * 7 / 16
            if y + 1 < h:
                if x > 0:
                    work[y + 1, x - 1] += err * 3 / 16
                work[y + 1, x] += err * 5 / 16
                if x + 1 < w:
                    work[y + 1, x + 1] += err * 1 / 16
    return out


def _ordered_dither(pixels: np.ndarray, palette_rgb: np.ndarray, palette_lab: np.ndarray, color_space: str) -> np.ndarray:
    h, w, _ = pixels.shape
    work = pixels.astype(np.float32).copy()
    for y in range(h):
        for x in range(w):
            threshold = (BAYER_4[y % 4, x % 4] - 0.5) * 32
            work[y, x] = np.clip(work[y, x] + threshold, 0, 255)
    flat = work.reshape(-1, 3)
    if color_space == "lab":
        px_lab = rgb_to_lab(flat)
        diff = px_lab[:, np.newaxis, :] - palette_lab[np.newaxis, :, :]
        dist = np.sum(diff**2, axis=2)
    else:
        diff = flat[:, np.newaxis, :] - palette_rgb[np.newaxis, :, :]
        dist = np.sum(diff**2, axis=2)
    return np.argmin(dist, axis=1).reshape(h, w)


def pixelate(
    img: Image.Image,
    colors: list[PaletteColor],
    canvas_w: int,
    canvas_h: int,
    params: RenderParams,
    preprocess: PreprocessParams | None = None,
) -> tuple[np.ndarray, Image.Image]:
    if params.preprocess:
        preprocess = params.preprocess
    work = apply_preprocess(img, preprocess)
    work = apply_tone(work, params.saturation, params.gamma, params.contrast)

    if params.render_mode == "dominant":
        big = work.resize((canvas_w * 4, canvas_h * 4), Image.Resampling.BILINEAR)
        work = big.resize((canvas_w, canvas_h), Image.Resampling.NEAREST)
    else:
        work = work.resize((canvas_w, canvas_h), Image.Resampling.NEAREST)

    pixels = np.array(work, dtype=np.float32)
    palette_rgb, palette_lab, _ = _palette_arrays(colors)

    if params.dither == "floyd-steinberg":
        indices = _floyd_steinberg(
            np.zeros((canvas_h, canvas_w), dtype=np.int32),
            pixels,
            palette_rgb,
            palette_lab,
            params.color_space,
        )
    elif params.dither == "ordered-bayer":
        indices = _ordered_dither(pixels, palette_rgb, palette_lab, params.color_space)
    else:
        flat = pixels.reshape(-1, 3)
        if params.color_space == "lab":
            px_lab = rgb_to_lab(flat)
            diff = px_lab[:, np.newaxis, :] - palette_lab[np.newaxis, :, :]
            dist = np.sum(diff**2, axis=2)
        else:
            diff = flat[:, np.newaxis, :] - palette_rgb[np.newaxis, :, :]
            dist = np.sum(diff**2, axis=2)
        indices = np.argmin(dist, axis=1).reshape(canvas_h, canvas_w)

    out_rgb = palette_rgb[indices].astype(np.uint8)
    preview = Image.fromarray(out_rgb, mode="RGB")
    return indices.astype(np.int32), preview


def save_matrix(path: Path, indices: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wt", encoding="utf-8") as f:
        json.dump(indices.tolist(), f)


def load_matrix(path: Path) -> np.ndarray:
    with gzip.open(path, "rt", encoding="utf-8") as f:
        return np.array(json.load(f), dtype=np.int32)
