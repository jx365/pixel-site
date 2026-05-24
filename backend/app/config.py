from pathlib import Path

from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


class Settings(BaseSettings):
    secret_key: str = "change-me-in-production-use-env-var"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    database_url: str = f"sqlite:///{BASE_DIR / 'pixel_art.db'}"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost,http://127.0.0.1"
    max_canvas_size: int = 200
    max_batch_combinations: int = 50
    max_excel_cells: int = 40000
    guest_daily_work_limit: int = 1
    guest_daily_export_limit: int = 10
    admin_invite_code: str = "HUASHI-ADMIN-2026"

    class Config:
        env_file = ".env"

    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
