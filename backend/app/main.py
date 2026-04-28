from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from .core.config import get_settings
from .db.session import create_tables
from .api import auth, health as health_router, ingest, timeline, score, intelligence, records, reports, care_circle

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    os.makedirs("uploads/meals",  exist_ok=True)
    os.makedirs("uploads/labs",   exist_ok=True)
    os.makedirs("uploads/voice",  exist_ok=True)
    # Auto-seed demo user on first boot
    try:
        from .db.session import SessionLocal
        from .services.seed import seed_demo
        from .models.user import User
        from .services.synthetic import DEMO_EMAIL
        db = SessionLocal()
        try:
            exists = db.query(User).filter(User.email == DEMO_EMAIL).first()
            if not exists:
                seed_demo(db)
        finally:
            db.close()
    except Exception as e:
        print(f"[seed] skipped: {e}")
    yield


app = FastAPI(
    title="Synapse API",
    description="Personal Health Intelligence Platform",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if os.path.exists("uploads"):
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

PREFIX = "/api/v1"
app.include_router(health_router.router, prefix=PREFIX)
app.include_router(auth.router,          prefix=PREFIX)
app.include_router(ingest.router,        prefix=PREFIX)
app.include_router(timeline.router,      prefix=PREFIX)
app.include_router(score.router,         prefix=PREFIX)
app.include_router(intelligence.router,  prefix=PREFIX)
app.include_router(records.router,       prefix=PREFIX)
app.include_router(reports.router,       prefix=PREFIX)
app.include_router(care_circle.router,   prefix=PREFIX)


@app.get("/")
def root():
    return {"message": "Synapse API — /api/v1/health for status"}
