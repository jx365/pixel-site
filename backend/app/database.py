from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def migrate_schema():
    # 轻量迁移：项目当前未引入 Alembic，先保证新增字段在 SQLite 上可用。
    if "sqlite" not in settings.database_url:
        return
    with engine.begin() as conn:
        rows = conn.exec_driver_sql("PRAGMA table_info(users)").fetchall()
        existing_cols = {r[1] for r in rows}
        col_defs = {
            "display_name": "TEXT DEFAULT '游客'",
            "auth_provider": "TEXT DEFAULT 'guest'",
            "role": "TEXT DEFAULT 'guest'",
            "is_guest": "INTEGER DEFAULT 1",
            "guest_session_id": "TEXT",
            "weibo_id": "TEXT",
        }
        for col, ddl in col_defs.items():
            if col not in existing_cols:
                conn.exec_driver_sql(f"ALTER TABLE users ADD COLUMN {col} {ddl}")
