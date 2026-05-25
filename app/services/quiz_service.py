"""
quiz_service.py
---------------
Generates MCQ quizzes from extracted study-material text using the Groq API.

Reuses the existing Groq key-rotation infrastructure (_call_groq, GROQ_KEYS,
_strip_think_tags, _convert_latex) from groq_service.py — no duplicate API
setup needed.

Quiz count is determined dynamically by content length:
  < 1 500 chars  → 5 questions  (small document)
  1 500–4 000    → 10 questions (medium document)
  > 4 000 chars  → 15 questions (large document)

Difficulty distribution requested in the prompt: 40% easy, 40% medium, 20% hard.
"""

import json
import logging
import re

from app.services.groq_service import (
    GROQ_KEYS,
    GROQ_MODEL,
    FALLBACK_MODEL,
    _call_groq,
    _strip_think_tags,
    _convert_latex,
)
from groq import RateLimitError, AuthenticationError, APIStatusError

logger = logging.getLogger(__name__)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _determine_question_count(text: str) -> int:
    """Return quiz size based on content length."""
    length = len(text.strip())
    if length < 1_500:
        return 5
    elif length < 4_000:
        return 8
    else:
        return 10  # capped at 10 — keeps JSON output well within token limits


def _build_quiz_prompt(text: str, num_questions: int) -> str:
    """
    Build the Groq prompt that instructs the model to act as an exam-paper
    generator and return a strict JSON quiz object.

    Key constraints baked into the prompt:
    - Questions must come ONLY from the provided material (no hallucination)
    - 4 options per question, exactly one correct answer
    - Difficulty split: 40% easy, 40% medium, 20% hard
    - Incorrect options must be believable distractors
    - No duplicate questions
    - Output must be valid JSON — nothing else
    """
    easy_count  = max(1, round(num_questions * 0.4))
    medium_count = max(1, round(num_questions * 0.4))
    hard_count  = num_questions - easy_count - medium_count

    return f"""You are an expert exam-paper generator. Your task is to create a high-quality MCQ quiz strictly based on the study material provided below.

RULES (follow exactly):
1. Generate exactly {num_questions} multiple-choice questions.
2. Difficulty distribution: {easy_count} easy, {medium_count} medium, {hard_count} hard.
3. Each question must have exactly 4 options labeled "A", "B", "C", "D".
4. Only ONE option is correct.
5. Questions must be based STRICTLY on the provided content — no outside knowledge, no hallucination.
6. Question types to include: conceptual, definition-based, important facts/formulas, application-based.
7. Incorrect options must be believable distractors (not obviously wrong).
8. No duplicate or near-duplicate questions.
9. Do NOT use LaTeX math notation — write all math in plain text.
10. Do NOT include any reasoning, explanation outside the JSON, or preamble text.

OUTPUT FORMAT — return ONLY valid JSON, nothing else:
{{
  "quiz_title": "<topic derived from the content>",
  "questions": [
    {{
      "question": "<question text>",
      "options": ["<option A>", "<option B>", "<option C>", "<option D>"],
      "correct_answer": "<exact text of the correct option>",
      "explanation": "<one-sentence explanation of why the answer is correct>",
      "difficulty": "easy" | "medium" | "hard"
    }}
  ]
}}

STUDY MATERIAL:
{text}"""


def _extract_json_from_response(raw: str) -> dict:
    """
    Robustly extract the JSON object from the model response.
    The model sometimes wraps JSON in ```json ... ``` fences — strip those first.
    """
    # Remove think tags and LaTeX artifacts
    raw = _strip_think_tags(raw)
    raw = _convert_latex(raw)

    # Strip markdown code fences if present
    raw = re.sub(r"```(?:json)?\s*", "", raw)
    raw = re.sub(r"```\s*$", "", raw, flags=re.MULTILINE)
    raw = raw.strip()

    # Find the outermost JSON object
    start = raw.find("{")
    end   = raw.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError("No JSON object found in model response")

    json_str = raw[start:end]
    return json.loads(json_str)


def _validate_quiz(data: dict) -> dict:
    """
    Validate and normalise the parsed quiz dict.
    Raises ValueError with a descriptive message on structural problems.
    """
    if "questions" not in data or not isinstance(data["questions"], list):
        raise ValueError("Quiz JSON missing 'questions' list")

    if not data["questions"]:
        raise ValueError("Quiz has no questions")

    cleaned_questions = []
    for i, q in enumerate(data["questions"]):
        # Required fields
        if not q.get("question"):
            logger.warning(f"Question {i+1} missing 'question' field — skipping")
            continue
        options = q.get("options", [])
        if len(options) != 4:
            logger.warning(f"Question {i+1} has {len(options)} options (expected 4) — skipping")
            continue
        if not q.get("correct_answer"):
            logger.warning(f"Question {i+1} missing 'correct_answer' — skipping")
            continue

        # Normalise: ensure correct_answer is one of the options
        correct = q["correct_answer"].strip()
        if correct not in [o.strip() for o in options]:
            # Try to match by prefix (model sometimes truncates)
            matched = next((o for o in options if o.strip().startswith(correct[:20])), None)
            if matched:
                correct = matched.strip()
            else:
                logger.warning(f"Question {i+1} correct_answer not in options — skipping")
                continue

        cleaned_questions.append({
            "question":       q["question"].strip(),
            "options":        [o.strip() for o in options],
            "correct_answer": correct,
            "explanation":    q.get("explanation", "").strip(),
            "difficulty":     q.get("difficulty", "medium").lower(),
        })

    if not cleaned_questions:
        raise ValueError("No valid questions after validation")

    data["questions"] = cleaned_questions
    data.setdefault("quiz_title", "Quiz")
    return data


# ── Public API ────────────────────────────────────────────────────────────────

def generate_quiz(extracted_text: str) -> dict:
    """
    Generate an MCQ quiz from already-extracted document text.

    Args:
        extracted_text: Plain text extracted from a PDF/PPTX/image by
                        notes_service.process_file() — reused directly,
                        no re-parsing needed.

    Returns:
        A validated quiz dict:
        {
            "quiz_title": str,
            "questions": [
                {
                    "question": str,
                    "options": [str, str, str, str],
                    "correct_answer": str,
                    "explanation": str,
                    "difficulty": "easy" | "medium" | "hard"
                },
                ...
            ]
        }

    Raises:
        ValueError: if extracted_text is empty or too short.
        RuntimeError: if all Groq keys fail.
    """
    text = extracted_text.strip()
    if not text:
        raise ValueError("No text provided for quiz generation.")
    if len(text) < 100:
        raise ValueError("Content is too short to generate meaningful quiz questions.")

    # Limit input to 4 000 chars — leaves plenty of token headroom for the
    # JSON response (each question needs ~300–400 tokens output).
    text_for_quiz = text[:4_000]

    num_questions = _determine_question_count(text_for_quiz)
    prompt = _build_quiz_prompt(text_for_quiz, num_questions)
    last_error = None

    # ── Try primary model with each key ──────────────────────────────────────
    for i, key in enumerate(GROQ_KEYS):
        try:
            logger.info(f"[quiz] Trying key {i+1}/{len(GROQ_KEYS)} with {GROQ_MODEL}")
            # Use 6000 max_tokens — quiz JSON is much larger than notes output
            raw = _call_groq(key, prompt, GROQ_MODEL, max_tokens=6000)
            quiz = _validate_quiz(_extract_json_from_response(raw))
            logger.info(f"[quiz] Generated {len(quiz['questions'])} questions successfully")
            return quiz
        except (RateLimitError, AuthenticationError) as e:
            logger.warning(f"[quiz] Key {i+1} rate/auth error: {e}")
            last_error = e
        except APIStatusError as e:
            if e.status_code in (429, 402):
                logger.warning(f"[quiz] Key {i+1} quota error ({e.status_code}): {e}")
                last_error = e
            else:
                raise
        except (ValueError, json.JSONDecodeError) as e:
            logger.warning(f"[quiz] Key {i+1} returned invalid JSON: {e}")
            last_error = e
        except Exception as e:
            logger.warning(f"[quiz] Key {i+1} unexpected error: {e}")
            last_error = e

    # ── Fallback: lighter model + fewer questions ─────────────────────────────
    logger.warning(f"[quiz] All keys failed on {GROQ_MODEL}, trying {FALLBACK_MODEL} with fewer questions")
    fallback_questions = max(5, num_questions - 3)
    fallback_prompt = _build_quiz_prompt(text_for_quiz[:2_000], fallback_questions)
    for i, key in enumerate(GROQ_KEYS):
        try:
            raw = _call_groq(key, fallback_prompt, FALLBACK_MODEL, max_tokens=4000)
            quiz = _validate_quiz(_extract_json_from_response(raw))
            logger.info(f"[quiz] Fallback generated {len(quiz['questions'])} questions")
            return quiz
        except Exception as e:
            logger.warning(f"[quiz] Fallback key {i+1} failed: {e}")
            last_error = e

    raise RuntimeError(
        f"Quiz generation failed — all Groq keys exhausted. Last error: {last_error}"
    )
