from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Palette, User
from app.schemas import ExtractResponse, PaletteCreate, PaletteOut, PaletteUpdate
from app.services.color_extract import extract_from_multiple
from app.utils import dump_palette_colors, parse_palette_colors

router = APIRouter(prefix="/palettes", tags=["palettes"])


def _to_out(p: Palette) -> PaletteOut:
    return PaletteOut(
        id=p.id,
        name=p.name,
        colors=parse_palette_colors(p.colors_json),
        created_at=p.created_at,
    )


@router.post("/extract", response_model=ExtractResponse)
async def extract_colors(
    user: Annotated[User, Depends(get_current_user)],
    files: list[UploadFile] = File(...),
    quality: str = Form("balanced"),
):
    if not files:
        raise HTTPException(400, "请至少上传一张图片")
    blobs = [await f.read() for f in files]
    profile = {
        "conservative": {"max_colors": 64, "bucket_size": 6, "merge_threshold": 9.0},
        "balanced": {"max_colors": 128, "bucket_size": 4, "merge_threshold": 6.0},
        "high_fidelity": {"max_colors": 192, "bucket_size": 2, "merge_threshold": 4.0},
    }
    if quality not in profile:
        raise HTTPException(400, "无效的提取强度，可选：conservative / balanced / high_fidelity")
    params = profile[quality]
    candidates = extract_from_multiple(
        blobs,
        max_colors=params["max_colors"],
        bucket_size=params["bucket_size"],
        merge_threshold=params["merge_threshold"],
    )
    return ExtractResponse(candidates=candidates)


@router.get("", response_model=list[PaletteOut])
def list_palettes(user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]):
    items = db.query(Palette).filter(Palette.user_id == user.id).order_by(Palette.created_at.desc()).all()
    return [_to_out(p) for p in items]


@router.post("", response_model=PaletteOut)
def create_palette(
    body: PaletteCreate,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    if not body.colors:
        raise HTTPException(400, "色盘不能为空")
    p = Palette(user_id=user.id, name=body.name, colors_json=dump_palette_colors(body.colors))
    db.add(p)
    db.commit()
    db.refresh(p)
    return _to_out(p)


@router.get("/{palette_id}", response_model=PaletteOut)
def get_palette(
    palette_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    p = db.get(Palette, palette_id)
    if not p or p.user_id != user.id:
        raise HTTPException(404, "色盘不存在")
    return _to_out(p)


@router.put("/{palette_id}", response_model=PaletteOut)
def update_palette(
    palette_id: int,
    body: PaletteUpdate,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    p = db.get(Palette, palette_id)
    if not p or p.user_id != user.id:
        raise HTTPException(404, "色盘不存在")
    if body.name is not None:
        p.name = body.name
    if body.colors is not None:
        p.colors_json = dump_palette_colors(body.colors)
    db.commit()
    db.refresh(p)
    return _to_out(p)


@router.delete("/{palette_id}")
def delete_palette(
    palette_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    p = db.get(Palette, palette_id)
    if not p or p.user_id != user.id:
        raise HTTPException(404, "色盘不存在")
    db.delete(p)
    db.commit()
    return {"ok": True}
