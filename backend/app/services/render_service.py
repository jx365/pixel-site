import json
import uuid
from itertools import product
from pathlib import Path

from PIL import Image
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Palette, Project, RenderBatch, RenderResult, User
from app.schemas import BatchRequest, PreprocessParams, RenderParams, RenderRequest
from app.services.pixelate import pixelate, save_matrix
from app.services.preprocess import apply_preprocess
from app.utils import parse_palette_colors, rel_url, user_upload_dir


def _load_cropped_image(project: Project) -> Image.Image:
    img = Image.open(project.source_image_path).convert("RGB")
    if project.crop_json:
        crop = json.loads(project.crop_json)
        w, h = img.size
        x, y = int(crop["x"] * w), int(crop["y"] * h)
        cw, ch = int(crop["w"] * w), int(crop["h"] * h)
        img = img.crop((x, y, x + cw, y + ch))
    return img


def _project_preprocess(project: Project) -> PreprocessParams | None:
    if not project.preprocess_json:
        return None
    return PreprocessParams(**json.loads(project.preprocess_json))


def _palette_for_project(db: Session, project: Project) -> list:
    palette = db.get(Palette, project.palette_id)
    return parse_palette_colors(palette.colors_json)


def _save_result_files(
    user_id: int,
    indices,
    preview: Image.Image,
    thumb_max: int = 120,
) -> tuple[str, str, str]:
    base = user_upload_dir(user_id) / uuid.uuid4().hex
    matrix_path = Path(str(base) + "_matrix.json.gz")
    preview_path = Path(str(base) + "_preview.png")
    thumb_path = Path(str(base) + "_thumb.png")
    save_matrix(matrix_path, indices)
    preview.save(preview_path)
    thumb = preview.copy()
    thumb.thumbnail((thumb_max, thumb_max), Image.Resampling.NEAREST)
    thumb.save(thumb_path)
    return str(matrix_path), str(preview_path), str(thumb_path)


def render_single(
    db: Session,
    user: User,
    project: Project,
    body: RenderRequest,
) -> RenderResult:
    colors = _palette_for_project(db, project)
    preprocess = body.params.preprocess or _project_preprocess(project)
    img = _load_cropped_image(project)
    img = apply_preprocess(img, preprocess)

    indices, preview = pixelate(
        img,
        colors,
        project.canvas_w,
        project.canvas_h,
        body.params,
        preprocess=None,
    )
    matrix_path, preview_path, thumb_path = _save_result_files(user.id, indices, preview)
    result = RenderResult(
        project_id=project.id,
        user_id=user.id,
        batch_id=None,
        thumb_path=thumb_path,
        preview_path=preview_path,
        matrix_path=str(matrix_path),
        params_json=body.params.model_dump_json(),
        source="render",
    )
    db.add(result)
    db.commit()
    db.refresh(result)
    return result


def _expand_param_grid(base: RenderParams, grid) -> list[RenderParams]:
    axes: dict[str, list] = {}
    if grid.dither and grid.dither.values:
        axes["dither"] = grid.dither.values
    if grid.saturation and grid.saturation.values:
        axes["saturation"] = [float(v) for v in grid.saturation.values]
    if grid.gamma and grid.gamma.values:
        axes["gamma"] = [float(v) for v in grid.gamma.values]
    if grid.contrast and grid.contrast.values:
        axes["contrast"] = [float(v) for v in grid.contrast.values]
    if grid.render_mode and grid.render_mode.values:
        axes["render_mode"] = grid.render_mode.values
    if grid.color_space and grid.color_space.values:
        axes["color_space"] = grid.color_space.values

    if not axes:
        return [base]

    keys = list(axes.keys())
    combos = list(product(*(axes[k] for k in keys)))
    if len(combos) > settings.max_batch_combinations:
        combos = combos[: settings.max_batch_combinations]

    results = []
    for combo in combos:
        data = base.model_dump()
        for k, v in zip(keys, combo):
            data[k] = v
        results.append(RenderParams(**data))
    return results


def render_batch(
    db: Session,
    user: User,
    project: Project,
    body: BatchRequest,
) -> RenderBatch:
    colors = _palette_for_project(db, project)
    preprocess = body.base_params.preprocess or _project_preprocess(project)
    img = _load_cropped_image(project)
    img = apply_preprocess(img, preprocess)

    param_list = _expand_param_grid(body.base_params, body.param_grid)
    batch = RenderBatch(
        project_id=project.id,
        param_grid_json=body.model_dump_json(),
        status="completed",
    )
    db.add(batch)
    db.flush()

    for params in param_list:
        indices, preview = pixelate(
            img.copy(),
            colors,
            project.canvas_w,
            project.canvas_h,
            params,
            preprocess=None,
        )
        matrix_path, preview_path, thumb_path = _save_result_files(user.id, indices, preview, thumb_max=100)
        result = RenderResult(
            project_id=project.id,
            user_id=user.id,
            batch_id=batch.id,
            thumb_path=thumb_path,
            preview_path=preview_path,
            matrix_path=str(matrix_path),
            params_json=params.model_dump_json(),
            source="render",
        )
        db.add(result)

    db.commit()
    db.refresh(batch)
    return batch


def preprocess_preview(project: Project, params: PreprocessParams | None) -> Image.Image:
    img = _load_cropped_image(project)
    return apply_preprocess(img, params)


def result_to_out(result: RenderResult, project: Project) -> dict:
    return {
        "id": result.id,
        "project_id": result.project_id,
        "params": json.loads(result.params_json),
        "thumb_url": rel_url(result.thumb_path) if result.thumb_path else None,
        "preview_url": rel_url(result.preview_path) if result.preview_path else None,
        "canvas_w": project.canvas_w,
        "canvas_h": project.canvas_h,
        "created_at": result.created_at.isoformat(),
    }
