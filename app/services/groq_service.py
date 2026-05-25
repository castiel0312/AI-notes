import os
import re
import logging

from groq import Groq, RateLimitError, AuthenticationError
from groq import APIStatusError
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

GROQ_MODEL = "llama-3.3-70b-versatile"
FALLBACK_MODEL = "llama-3.1-8b-instant"  # lighter model as last resort

# Load all available keys (skip empty ones)
_ALL_KEYS = [
    os.getenv("GROQ_API_KEY_1", ""),
    os.getenv("GROQ_API_KEY_2", ""),
    os.getenv("GROQ_API_KEY_3", ""),
    os.getenv("GROQ_API_KEY", ""),  # legacy single key support
]
GROQ_KEYS = [k.strip() for k in _ALL_KEYS if k.strip()]

if not GROQ_KEYS:
    raise RuntimeError("No Groq API keys found. Set GROQ_API_KEY_1, _2, or _3 in .env")


def _strip_think_tags(text: str) -> str:
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()


def _convert_latex(text: str) -> str:
    text = re.sub(r"\\\(|\\\)", "", text)
    text = re.sub(r"\\\[|\\\]", "", text)
    replacements = [
        (r"\\rightarrow", "->"), (r"\\leftarrow", "<-"),
        (r"\\leq", "<="), (r"\\geq", ">="), (r"\\neq", "!="),
        (r"\\approx", "~"), (r"\\times", "x"), (r"\\cdot", "."),
        (r"\\ldots|\\dots", "..."), (r"\\infty", "infinity"),
        (r"\\sqrt\{(.+?)\}", r"sqrt(\1)"),
        (r"\\frac\{(.+?)\}\{(.+?)\}", r"(\1)/(\2)"),
        (r"\\text\{(.+?)\}", r"\1"),
        (r"\\mathbf\{(.+?)\}", r"\1"),
        (r"\\mathrm\{(.+?)\}", r"\1"),
    ]
    for pattern, repl in replacements:
        text = re.sub(pattern, repl, text)
    text = re.sub(r"\\[a-zA-Z]+", "", text)
    text = re.sub(r" {2,}", " ", text)
    return text


def _call_groq(api_key: str, prompt: str, model: str, max_tokens: int = 2048) -> str:
    """Make a single Groq API call with the given key."""
    client = Groq(api_key=api_key)
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=max_tokens,
        temperature=0.3,
    )
    return response.choices[0].message.content


def _build_prompt(text: str, mode: str) -> str:
    base = (
        "Do NOT use LaTeX math notation. Write all math in plain text. "
        "Do NOT include any internal reasoning or thinking.\n\n"
        f"Content:\n{text}"
    )
    if mode == "detailed":
        return (
            "Generate detailed educational notes from the following content. "
            "Include explanations, examples, formulas, and definitions. " + base
        )
    elif mode == "important":
        return (
            "Generate concise important-point notes for MCQ revision. "
            "Use bullet points and keywords only. " + base
        )
    else:
        return (
            "Generate mixed educational notes. "
            "Include bullet points, explanations for important concepts, and formulas where needed. " + base
        )


def generate_notes(text: str, mode: str) -> str:
    """
    Try each Groq API key in order. On rate limit or quota exhaustion,
    rotate to the next key. Falls back to a lighter model if all keys
    fail on the primary model. Raises RuntimeError if everything fails.
    """
    prompt = _build_prompt(text, mode)
    last_error = None

    # Try primary model with each key
    for i, key in enumerate(GROQ_KEYS):
        try:
            logger.info(f"Trying Groq key {i+1}/{len(GROQ_KEYS)} with model {GROQ_MODEL}")
            raw = _call_groq(key, prompt, GROQ_MODEL)
            raw = _strip_think_tags(raw)
            raw = _convert_latex(raw)
            return raw.strip()
        except RateLimitError as e:
            logger.warning(f"Key {i+1} rate limited: {e}")
            last_error = e
        except AuthenticationError as e:
            logger.warning(f"Key {i+1} auth failed: {e}")
            last_error = e
        except APIStatusError as e:
            if e.status_code in (429, 402):
                logger.warning(f"Key {i+1} quota/rate error ({e.status_code}): {e}")
                last_error = e
            else:
                raise
        except Exception as e:
            logger.warning(f"Key {i+1} unexpected error: {e}")
            last_error = e

    # All keys failed on primary model — try fallback model
    logger.warning(f"All keys failed on {GROQ_MODEL}, trying fallback model {FALLBACK_MODEL}")
    for i, key in enumerate(GROQ_KEYS):
        try:
            raw = _call_groq(key, prompt, FALLBACK_MODEL)
            raw = _strip_think_tags(raw)
            raw = _convert_latex(raw)
            return raw.strip()
        except Exception as e:
            logger.warning(f"Fallback key {i+1} also failed: {e}")
            last_error = e

    raise RuntimeError(
        f"All Groq API keys exhausted on both models. Last error: {last_error}"
    )
