from pathlib import Path
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models import Export, Palette, Project, RenderResult, User
from app.services.excel_export import export_from_palette
from app.services.pixelate import load_matrix
from app.services.render_service import result_to_out
from app.utils import parse_palette_colors, user_upload_dir

router = APIRouter(prefix="/results", tags=["results"])


@router.get("/{result_id}")
def get_result(
    result_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    result = db.get(RenderResult, result_id)
    if not result or result.user_id != user.id:
        raise HTTPException(404, "结果不存在")
    project = db.get(Project, result.project_id)
    return result_to_out(result, project)


@router.post("/{result_id}/export/excel")
def export_excel(
    result_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    result = db.get(RenderResult, result_id)
    if not result or result.user_id != user.id:
        raise HTTPException(404, "结果不存在")
    project = db.get(Project, result.project_id)
    palette = db.get(Palette, project.palette_id)
    colors = parse_palette_colors(palette.colors_json)
    indices = load_matrix(Path(result.matrix_path))
    cells = project.canvas_w * project.canvas_h
    if cells > settings.max_excel_cells:
        raise HTTPException(400, f"画布过大（{cells} 格），最大支持 {settings.max_excel_cells} 格导出")
    if user.is_guest:
        day_start = (
            datetime.now(timezone.utc)
            .replace(hour=0, minute=0, second=0, microsecond=0)
            .replace(tzinfo=None)
        )
        today_exports = (
            db.query(Export)
            .join(RenderResult, RenderResult.id == Export.result_id)
            .filter(RenderResult.user_id == user.id, Export.created_at >= day_start)
            .count()
        )
        if today_exports >= settings.guest_daily_export_limit:
            raise HTTPException(400, f"游客账号每天最多导出 {settings.guest_daily_export_limit} 个 Excel")

    out_path = user_upload_dir(user.id) / f"export_{result_id}.xlsx"
    export_from_palette(indices, colors, out_path)
    export = Export(result_id=result.id, xlsx_path=str(out_path))
    db.add(export)
    db.commit()
    return FileResponse(
        path=str(out_path),
        filename=f"pixel_art_{result_id}.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
