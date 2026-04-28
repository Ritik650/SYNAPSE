from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .db.session import create_tables
from .api import (
    auth,
    health as health_router,
    ingest,
    timeline,
    score,
    intelligence,
    records,
    reports,
    care_circle,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    os.makedirs("uploads/meals", exist_ok=True)
    os.makedirs("uploads/labs", exist_ok=True)
    os.makedirs("uploads/voice", exist_ok=True)
    yield


app = FastAPI(
    title="Synapse API",
    description="Personal Health Intelligence Platform",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://synapse-a395.vercel.app",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static uploads
if os.path.exists("uploads"):
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# API routes
PREFIX = "/api/v1"

app.include_router(health_router.router, prefix=PREFIX)
app.include_router(auth.router, prefix=PREFIX)
app.include_router(ingest.router, prefix=PREFIX)
app.include_router(timeline.router, prefix=PREFIX)
app.include_router(score.router, prefix=PREFIX)
app.include_router(intelligence.router, prefix=PREFIX)
app.include_router(records.router, prefix=PREFIX)
app.include_router(reports.router, prefix=PREFIX)
app.include_router(care_circle.router, prefix=PREFIX)


@app.get("/")
def root():
    return {"message": "Synapse API — /api/v1/health for status"}