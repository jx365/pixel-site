from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class WeiboLoginRequest(BaseModel):
    access_token: str | None = None


class UserOut(BaseModel):
    id: int
    username: str
    display_name: str
    role: str
    auth_provider: str
    is_guest: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProfileUpdate(BaseModel):
    display_name: str = Field(min_length=1, max_length=64)


class InviteUpgradeRequest(BaseModel):
    invite_code: str = Field(min_length=1, max_length=64)


class PaletteColor(BaseModel):
    sort: int
    label: str
    r: int = Field(ge=0, le=255)
    g: int = Field(ge=0, le=255)
    b: int = Field(ge=0, le=255)


class PaletteCreate(BaseModel):
    name: str
    colors: list[PaletteColor]


class PaletteUpdate(BaseModel):
    name: str | None = None
    colors: list[PaletteColor] | None = None


class PaletteOut(BaseModel):
    id: int
    name: str
    colors: list[PaletteColor]
    created_at: datetime

    class Config:
        from_attributes = True


class ColorCandidate(BaseModel):
    r: int
    g: int
    b: int
    count: int


class ExtractResponse(BaseModel):
    candidates: list[ColorCandidate]


class CropRect(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    w: float = Field(gt=0, le=1)
    h: float = Field(gt=0, le=1)


class PreprocessParams(BaseModel):
    enabled: bool = True
    posterize_levels: int = Field(default=6, ge=2, le=16)
    blur_radius: int = Field(default=2, ge=0, le=10)
    edge_strength: float = Field(default=0.3, ge=0, le=1)


class RenderParams(BaseModel):
    color_space: str = "lab"
    render_mode: str = "nearest"
    dither: str = "none"
    saturation: float = Field(default=1.0, ge=0, le=2)
    gamma: float = Field(default=1.0, ge=0.3, le=2.5)
    contrast: float = Field(default=1.0, ge=0.5, le=2)
    smart_cutout: bool = False
    preprocess: PreprocessParams | None = None


class ProjectCreate(BaseModel):
    palette_id: int
    name: str = "未命名项目"
    canvas_w: int = Field(default=32, ge=1, le=200)
    canvas_h: int = Field(default=32, ge=1, le=200)
    crop: CropRect | None = None
    preprocess: PreprocessParams | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    palette_id: int | None = None
    canvas_w: int | None = Field(default=None, ge=1, le=200)
    canvas_h: int | None = Field(default=None, ge=1, le=200)
    crop: CropRect | None = None
    preprocess: PreprocessParams | None = None


class ProjectOut(BaseModel):
    id: int
    name: str
    palette_id: int
    source_image_url: str
    canvas_w: int
    canvas_h: int
    crop: CropRect | None
    preprocess: PreprocessParams | None
    created_at: datetime


class RenderRequest(BaseModel):
    params: RenderParams


class ParamRange(BaseModel):
    values: list[Any]


class ParamGrid(BaseModel):
    dither: ParamRange | None = None
    saturation: ParamRange | None = None
    gamma: ParamRange | None = None
    contrast: ParamRange | None = None
    render_mode: ParamRange | None = None
    color_space: ParamRange | None = None


class BatchRequest(BaseModel):
    base_params: RenderParams
    param_grid: ParamGrid


class RenderResultOut(BaseModel):
    id: int
    project_id: int
    params: dict
    thumb_url: str | None
    preview_url: str | None
    canvas_w: int
    canvas_h: int
    created_at: datetime


class BatchOut(BaseModel):
    id: int
    project_id: int
    results: list[RenderResultOut]


class WorkCreate(BaseModel):
    result_id: int
    title: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=4000)


class WorkOut(BaseModel):
    id: int
    user_id: int
    author_name: str
    title: str
    description: str | None
    image_url: str
    like_count: int
    comment_count: int
    status: str
    removed_reason: str | None
    created_at: datetime
    is_liked: bool = False


class CommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class CommentOut(BaseModel):
    id: int
    work_id: int
    user_id: int
    author_name: str
    content: str
    status: str
    removed_reason: str | None
    created_at: datetime


class NotificationOut(BaseModel):
    id: int
    category: str
    title: str
    content: str
    related_type: str | None
    related_id: int | None
    created_at: datetime
    is_read: bool


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    content: str = Field(min_length=1, max_length=5000)


class AnnouncementOut(BaseModel):
    id: int
    admin_user_id: int
    title: str
    content: str
    created_at: datetime


class LeaderboardItem(BaseModel):
    user_id: int
    display_name: str
    likes: int


class ModerateRequest(BaseModel):
    reason: str = Field(min_length=5, max_length=4000)


class ModerationLogOut(BaseModel):
    id: int
    admin_user_id: int
    target_user_id: int
    target_type: str
    target_id: int
    action: str
    reason: str
    created_at: datetime
