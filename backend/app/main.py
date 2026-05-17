"""
DataMatchX — FastAPI Application Entry Point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import os

from app.api.routes import router
from app.config import settings

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "DataMatchX: A multi-format data comparison & validation engine. "
        "Upload source + target files with a mapping definition and get a "
        "detailed, downloadable diff report."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(router, prefix="/api")

# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health():
    return JSONResponse({"status": "ok", "service": settings.APP_NAME, "version": settings.APP_VERSION})


@app.get("/", tags=["System"])
async def root():
    return JSONResponse({"message": f"Welcome to {settings.APP_NAME}", "docs": "/docs"})
