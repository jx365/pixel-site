import json
import uuid
from pathlib import Path

from app.config import UPLOAD_DIR
from app.schemas import PaletteColor, PreprocessParams


def user_upload_dir(user_id: int) -> Path:
    d = UPLOAD_DIR / str(user_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def save_upload(user_id: int, filename: str, content: bytes) -> str:
    ext = Path(filename).suffix or ".png"
    path = user_upload_dir(user_id) / f"{uuid.uuid4().hex}{ext}"
    path.write_bytes(content)
    return str(path)


def rel_url(abs_path: str) -> str:
    p = Path(abs_path)
    if not p.is_absolute():
        return f"/uploads/{p.name}"
    try:
        rel = p.relative_to(UPLOAD_DIR)
        return f"/uploads/{rel.as_posix()}"
    except ValueError:
        return f"/uploads/{p.name}"


def parse_palette_colors(colors_json: str) -> list[PaletteColor]:
    data = json.loads(colors_json)
    return [PaletteColor(**c) for c in data]


def dump_palette_colors(colors: list[PaletteColor]) -> str:
    return json.dumps([c.model_dump() for c in colors], ensure_ascii=False)


def parse_preprocess(raw: str | None) -> PreprocessParams | None:
    if not raw:
        return None
    return PreprocessParams(**json.loads(raw))
