import io
from collections import defaultdict

import numpy as np
from PIL import Image

from app.schemas import ColorCandidate


def _rgb_to_lab(rgb: np.ndarray) -> np.ndarray:
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


def _delta_e(lab1: np.ndarray, lab2: np.ndarray) -> float:
    return float(np.sqrt(np.sum((lab1 - lab2) ** 2)))


def merge_similar_colors(candidates: list[ColorCandidate], threshold: float = 6.0) -> list[ColorCandidate]:
    if not candidates:
        return []
    labs = [_rgb_to_lab(np.array([c.r, c.g, c.b], dtype=np.float32)) for c in candidates]
    merged: list[ColorCandidate] = []
    used = [False] * len(candidates)
    for i, c in enumerate(candidates):
        if used[i]:
            continue
        total_r, total_g, total_b, total_count = c.r * c.count, c.g * c.count, c.b * c.count, c.count
        used[i] = True
        for j in range(i + 1, len(candidates)):
            if used[j]:
                continue
            if _delta_e(labs[i], labs[j]) < threshold:
                used[j] = True
                oc = candidates[j]
                total_r += oc.r * oc.count
                total_g += oc.g * oc.count
                total_b += oc.b * oc.count
                total_count += oc.count
        merged.append(
            ColorCandidate(
                r=int(round(total_r / total_count)),
                g=int(round(total_g / total_count)),
                b=int(round(total_b / total_count)),
                count=total_count,
            )
        )
    merged.sort(key=lambda x: -x.count)
    return merged


def extract_colors_from_image(
    data: bytes,
    max_colors: int = 128,
    bucket_size: int = 4,
    merge_threshold: float = 6.0,
) -> list[ColorCandidate]:
    img = Image.open(io.BytesIO(data)).convert("RGB")
    # Use larger sample to preserve palette richness from source charts.
    img.thumbnail((400, 400), Image.Resampling.LANCZOS)
    arr = np.array(img)
    # Lighter quantization: keep more distinct tones than previous /8 scheme.
    q = max(1, int(bucket_size))
    quantized = (arr // q) * q + q // 2
    counts: defaultdict[tuple[int, int, int], int] = defaultdict(int)
    for row in quantized.reshape(-1, 3):
        key = (int(row[0]), int(row[1]), int(row[2]))
        counts[key] += 1
    candidates = [
        ColorCandidate(r=k[0], g=k[1], b=k[2], count=v)
        for k, v in sorted(counts.items(), key=lambda x: -x[1])
    ][: max_colors * 2]
    return merge_similar_colors(candidates, threshold=merge_threshold)[:max_colors]


def extract_from_multiple(
    files: list[bytes],
    max_colors: int = 128,
    bucket_size: int = 4,
    merge_threshold: float = 6.0,
) -> list[ColorCandidate]:
    all_candidates: list[ColorCandidate] = []
    for data in files:
        all_candidates.extend(
            extract_colors_from_image(
                data,
                max_colors=max_colors,
                bucket_size=bucket_size,
                merge_threshold=merge_threshold,
            )
        )
    combined: defaultdict[tuple[int, int, int], int] = defaultdict(int)
    for c in all_candidates:
        key = (c.r, c.g, c.b)
        combined[key] += c.count
    merged = [
        ColorCandidate(r=k[0], g=k[1], b=k[2], count=v)
        for k, v in sorted(combined.items(), key=lambda x: -x[1])
    ]
    return merge_similar_colors(merged, threshold=merge_threshold)[:max_colors]
