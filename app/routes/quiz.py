"""
quiz.py  (routes)
-----------------
Provides the POST /generate-quiz endpoint.

Reuses the EXACT same file-upload + text-extraction pipeline as /generate-notes
(notes_service.process_file) so the PDF/PPTX is never parsed twice when the
frontend calls both endpoints for the same file.

Request  : multipart/form-data  { files: File[] }
Response : JSON quiz object (see quiz_service.generate_quiz for schema)
"""

import os
from typing import List

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from app.services.notes_service import process_file   # reuse existing extractor
from app.services.quiz_service import generate_quiz

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".pptx", ".png", ".jpg", ".jpeg"}


@router.post(
    "/generate-quiz",
    summary="Generate MCQ quiz from uploaded study material",
    openapi_extra={
        "requestBody": {
            "content": {
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "required": ["files"],
                        "properties": {
                            "files": {
                                "type": "array",
                                "items": {"type": "string", "format": "binary"},
                                "description": "Upload PDF, PPTX, or image files"
                            }
                        }
                    }
                }
            },
            "required": True
        }
    }
)
async def generate_quiz_route(
    files: List[UploadFile] = File(...)
):
    """
    For each uploaded file:
    1. Save to uploads/ (same directory as notes pipeline)
    2. Extract text via notes_service.process_file (reuses existing logic)
    3. Generate MCQ quiz via quiz_service.generate_quiz (Groq API)
    4. Return structured JSON quiz

    Returns a list of per-file results so the frontend can handle
    multi-file uploads the same way it does for notes.
    """
    results = []

    for file in files:
        ext = os.path.splitext(file.filename)[1].lower()

        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type '{ext}'. Allowed: pdf, pptx, png, jpg, jpeg"
            )

        # ── Save uploaded file (same path as notes pipeline) ─────────────────
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as f:
            f.write(await file.read())

        # ── Extract text — reuse existing pipeline, no duplicate parsing ──────
        try:
            extracted_text = process_file(file_path)
        except Exception as e:
            results.append({
                "file": file.filename,
                "quiz": None,
                "error": f"Text extraction failed: {str(e)}"
            })
            continue

        if not extracted_text.strip():
            results.append({
                "file": file.filename,
                "quiz": None,
                "error": "No text could be extracted from this file."
            })
            continue

        # ── Generate quiz via Groq ────────────────────────────────────────────
        try:
            quiz = generate_quiz(extracted_text)
        except ValueError as e:
            # Content too short or empty
            results.append({
                "file": file.filename,
                "quiz": None,
                "error": str(e)
            })
            continue
        except RuntimeError as e:
            # All API keys exhausted
            raise HTTPException(status_code=502, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Quiz generation failed: {str(e)}")

        results.append({
            "file": file.filename,
            "quiz": quiz,
            "error": None
        })

    return JSONResponse(content={"success": True, "results": results})
