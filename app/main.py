import traceback
import asyncio
import os

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routes.notes import router as notes_router
from app.routes.quiz import router as quiz_router

app = FastAPI(
    title="Notes Maker",
    description="AI Smart Notes Generator API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(notes_router)
app.include_router(quiz_router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "error": type(exc).__name__,
            "detail": str(exc),
            "traceback": traceback.format_exc()
        }
    )


@app.get("/")
def home():
    return {"message": "AI Backend Running"}


# ── Keep-alive: self-ping every 10 minutes so Render doesn't spin down ──
RENDER_URL = os.getenv("RENDER_EXTERNAL_URL", "")

@app.on_event("startup")
async def start_keepalive():
    if RENDER_URL:
        asyncio.create_task(_keepalive_loop())


async def _keepalive_loop():
    await asyncio.sleep(60)  # wait 1 min after startup before first ping
    async with httpx.AsyncClient() as client:
        while True:
            try:
                await client.get(f"{RENDER_URL}/", timeout=10)
            except Exception:
                pass
            await asyncio.sleep(10 * 60)  # ping every 10 minutes
