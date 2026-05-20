import json
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.auth import get_current_or_guest_user
from app.config import settings
from app.database import get_db
from app.models import Export, Palette, Project, RenderBatch, RenderResult, User
from app.schemas import (
    BatchOut,
    BatchRequest,
    PreprocessParams,
    ProjectCreate,
    ProjectOut,
    ProjectUpdate,
    RenderRequest,
    RenderResultOut,
)
from app.services.excel_export import export_from_palette
from app.services.pixelate import load_matrix
from app.services.render_service import preprocess_preview, render_batch, render_single, result_to_out
from app.utils import parse_palette_colors, rel_url, save_upload

router = APIRouter(prefix="/projects", tags=["projects"])


def _project_out(p: Project) -> ProjectOut:
    crop = json.loads(p.crop_json) if p.crop_json else None
    preprocess = json.loads(p.preprocess_json) if p.preprocess_json else None
    return ProjectOut(
        id=p.id,
        name=p.name,
        palette_id=p.palette_id,
        source_image_url=rel_url(p.source_image_path),
        canvas_w=p.canvas_w,
        canvas_h=p.canvas_h,
        crop=crop,
        preprocess=preprocess,
        created_at=p.created_at,
    )


def _get_project(db: Session, user: User, project_id: int) -> Project:
    p = db.get(Project, project_id)
    if not p or p.user_id != user.id:
        raise HTTPException(404, "项目不存在")
    return p


@router.post("", response_model=ProjectOut)
async def create_project(
    user: Annotated[User, Depends(get_current_or_guest_user)],
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(...),
    palette_id: int = Form(...),
    name: str = Form("未命名项目"),
    canvas_w: int = Form(32),
    canvas_h: int = Form(32),
    crop_json: str | None = Form(None),
    preprocess_json: str | None = Form(None),
):
    if canvas_w > settings.max_canvas_size or canvas_h > settings.max_canvas_size:
        raise HTTPException(400, f"画布最大 {settings.max_canvas_size}x{settings.max_canvas_size}")
    palette = db.get(Palette, palette_id)
    if not palette or palette.user_id != user.id:
        raise HTTPException(404, "色盘不存在")
    content = await file.read()
    path = save_upload(user.id, file.filename or "image.png", content)
    project = Project(
        user_id=user.id,
        palette_id=palette_id,
        name=name,
        source_image_path=path,
        canvas_w=canvas_w,
        canvas_h=canvas_h,
        crop_json=crop_json,
        preprocess_json=preprocess_json,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return _project_out(project)


@router.get("", response_model=list[ProjectOut])
def list_projects(user: Annotated[User, Depends(get_current_or_guest_user)], db: Annotated[Session, Depends(get_db)]):
    items = db.query(Project).filter(Project.user_id == user.id).order_by(Project.created_at.desc()).all()
    return [_project_out(p) for p in items]


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: int,
    user: Annotated[User, Depends(get_current_or_guest_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return _project_out(_get_project(db, user, project_id))


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int,
    body: ProjectUpdate,
    user: Annotated[User, Depends(get_current_or_guest_user)],
    db: Annotated[Session, Depends(get_db)],
):
    p = _get_project(db, user, project_id)
    if body.name is not None:
        p.name = body.name
    if body.palette_id is not None:
        palette = db.get(Palette, body.palette_id)
        if not palette or palette.user_id != user.id:
            raise HTTPException(404, "色盘不存在")
        p.palette_id = body.palette_id
    if body.canvas_w is not None:
        p.canvas_w = body.canvas_w
    if body.canvas_h is not None:
        p.canvas_h = body.canvas_h
    if body.crop is not None:
        p.crop_json = body.crop.model_dump_json()
    if body.preprocess is not None:
        p.preprocess_json = body.preprocess.model_dump_json()
    db.commit()
    db.refresh(p)
    return _project_out(p)


@router.post("/{project_id}/preprocess")
def preview_preprocess(
    project_id: int,
    params: PreprocessParams,
    user: Annotated[User, Depends(get_current_or_guest_user)],
    db: Annotated[Session, Depends(get_db)],
):
    p = _get_project(db, user, project_id)
    from app.utils import user_upload_dir

    out = preprocess_preview(p, params)
    path = user_upload_dir(user.id) / f"{uuid.uuid4().hex}_preprocess.png"
    out.save(path)
    return {"preview_url": rel_url(str(path))}


@router.post("/{project_id}/render", response_model=RenderResultOut)
def render_project(
    project_id: int,
    body: RenderRequest,
    user: Annotated[User, Depends(get_current_or_guest_user)],
    db: Annotated[Session, Depends(get_db)],
):
    p = _get_project(db, user, project_id)
    result = render_single(db, user, p, body)
    return result_to_out(result, p)


@router.post("/{project_id}/batch", response_model=BatchOut)
def batch_render(
    project_id: int,
    body: BatchRequest,
    user: Annotated[User, Depends(get_current_or_guest_user)],
    db: Annotated[Session, Depends(get_db)],
):
    p = _get_project(db, user, project_id)
    batch = render_batch(db, user, p, body)
    results = db.query(RenderResult).filter(RenderResult.batch_id == batch.id).all()
    return BatchOut(
        id=batch.id,
        project_id=p.id,
        results=[result_to_out(r, p) for r in results],
    )
