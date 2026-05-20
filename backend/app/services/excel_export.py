from pathlib import Path

import numpy as np
import xlsxwriter

from app.schemas import PaletteColor


def save_to_excel(
    index_matrix: np.ndarray,
    palette_ids: list[str],
    palette_rgb: list[tuple[int, int, int]],
    output_path: Path,
) -> Path:
    """保存 Excel 像素画和色卡对照表（对齐用户参考实现）"""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    workbook = xlsxwriter.Workbook(str(output_path))
    styles = []
    for i in range(len(palette_ids)):
        r, g, b = palette_rgb[i]
        hex_color = "#{:02x}{:02x}{:02x}".format(r, g, b)
        text_color = "white" if (r * 0.299 + g * 0.587 + b * 0.114) < 128 else "black"
        fmt = workbook.add_format(
            {
                "bg_color": hex_color,
                "font_color": text_color,
                "align": "center",
                "valign": "vcenter",
                "font_size": 8,
            }
        )
        styles.append(fmt)

    ws_grid = workbook.add_worksheet("像素画")
    rows, cols = index_matrix.shape
    ws_grid.set_column(0, cols - 1, 2.5)
    for r in range(rows):
        ws_grid.set_row(r, 12)
    for r in range(rows):
        for c in range(cols):
            idx = int(index_matrix[r, c])
            user_id = palette_ids[idx]
            ws_grid.write(r, c, user_id, styles[idx])

    ws_palette = workbook.add_worksheet("色卡对照表")
    ws_palette.set_column(0, 0, 15)
    ws_palette.set_column(1, 1, 15)
    ws_palette.set_column(2, 2, 10)
    ws_palette.write(0, 0, "色号")
    ws_palette.write(0, 1, "RGB")
    ws_palette.write(0, 2, "颜色")
    for i in range(len(palette_ids)):
        row = i + 1
        r, g, b = palette_rgb[i]
        rgb_str = f"{r},{g},{b}"
        ws_palette.write(row, 0, palette_ids[i])
        ws_palette.write(row, 1, rgb_str)
        ws_palette.write(row, 2, "", styles[i])

    workbook.close()
    return output_path


def export_from_palette(index_matrix: np.ndarray, colors: list[PaletteColor], output_path: Path) -> Path:
    palette_ids = [c.label for c in colors]
    palette_rgb = [(c.r, c.g, c.b) for c in colors]
    return save_to_excel(index_matrix, palette_ids, palette_rgb, output_path)
