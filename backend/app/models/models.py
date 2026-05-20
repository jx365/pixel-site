from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    palettes: Mapped[list["Palette"]] = relationship(back_populates="user")
    projects: Mapped[list["Project"]] = relationship(back_populates="user")


class Palette(Base):
    __tablename__ = "palettes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(128))
    colors_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="palettes")
    projects: Mapped[list["Project"]] = relationship(back_populates="palette")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    palette_id: Mapped[int] = mapped_column(ForeignKey("palettes.id"))
    name: Mapped[str] = mapped_column(String(128), default="未命名项目")
    source_image_path: Mapped[str] = mapped_column(String(512))
    crop_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    canvas_w: Mapped[int] = mapped_column(Integer, default=32)
    canvas_h: Mapped[int] = mapped_column(Integer, default=32)
    preprocess_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="projects")
    palette: Mapped["Palette"] = relationship(back_populates="projects")
    batches: Mapped[list["RenderBatch"]] = relationship(back_populates="project")


class RenderBatch(Base):
    __tablename__ = "render_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    param_grid_json: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="completed")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project: Mapped["Project"] = relationship(back_populates="batches")
    results: Mapped[list["RenderResult"]] = relationship(back_populates="batch")


class RenderResult(Base):
    __tablename__ = "render_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    batch_id: Mapped[int | None] = mapped_column(ForeignKey("render_batches.id"), nullable=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    thumb_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    preview_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    matrix_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    params_json: Mapped[str] = mapped_column(Text, default="{}")
    source: Mapped[str] = mapped_column(String(16), default="render")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    batch: Mapped["RenderBatch | None"] = relationship(back_populates="results")
    exports: Mapped[list["Export"]] = relationship(back_populates="result")


class Export(Base):
    __tablename__ = "exports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    result_id: Mapped[int] = mapped_column(ForeignKey("render_results.id"))
    xlsx_path: Mapped[str] = mapped_column(String(512))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    result: Mapped["RenderResult"] = relationship(back_populates="exports")
