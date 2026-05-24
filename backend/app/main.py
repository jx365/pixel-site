from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import auth, community, palettes, projects, results
from app.config import UPLOAD_DIR, settings
from app.database import Base, engine, migrate_schema


@asynccontextmanager
async def lifespan(app: FastAPI):
    migrate_schema()
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="像素画生成 API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

app.include_router(auth.router, prefix="/api")
app.include_router(palettes.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(results.router, prefix="/api")
app.include_router(community.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
