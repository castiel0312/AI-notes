# AI Notes Maker

An AI-powered study assistant that transforms uploaded documents into structured notes, translated output, audio summaries, and interactive MCQ quizzes — all in one pipeline.

---

## Features

- **Smart Notes Generation** — Upload PDFs, PowerPoint files, or images and get AI-generated notes in three modes: *Detailed*, *Important Points* (MCQ-style bullets), or *Mixed*
- **Multilingual Output** — Notes are generated in English and optionally translated into 10 Indian languages via the Sarvam AI API
- **Text-to-Speech** — A 500-character audio preview of the notes is generated per language using Sarvam's TTS API
- **PDF Export** — Generated notes are packaged into a downloadable PDF
- **MCQ Quiz Generator** — Produces a structured multiple-choice quiz from the same uploaded material, with difficulty distribution (40% easy / 40% medium / 20% hard) and explanations per question
- **OCR Support** — Image files (PNG, JPG, JPEG) are processed via Tesseract OCR for text extraction
- **Groq API Key Rotation** — Supports up to 3 Groq API keys with automatic fallback to a lighter model if rate limits are hit
- **Render Keep-Alive** — Self-pings every 10 minutes to prevent Render's free-tier spin-down

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI, Uvicorn |
| AI / LLM | Groq API (`llama-3.3-70b-versatile`, fallback `llama-3.1-8b-instant`) |
| Translation | Sarvam AI (`mayura:v1`) |
| TTS | Sarvam AI (`bulbul:v1`) |
| OCR | Tesseract, OCR.space API |
| PDF Generation | Custom PDF generator service |
| Frontend | React 19, Vite 8 |
| Deployment | Render (via `render.yaml`) |

---

## Project Structure

```
AI-notes-master/
├── app/
│   ├── main.py                  # FastAPI app, CORS, keep-alive loop
│   ├── config/
│   │   └── settings.py          # Loads env vars
│   ├── routes/
│   │   ├── notes.py             # /generate-notes, /download-notes, /download-audio
│   │   └── quiz.py              # /generate-quiz
│   ├── services/
│   │   ├── groq_service.py      # LLM note generation with key rotation
│   │   ├── quiz_service.py      # MCQ quiz generation via Groq
│   │   ├── sarvam_service.py    # Sarvam-based note generation (alternative)
│   │   ├── translate_service.py # Sarvam translation (chunked)
│   │   ├── tts_service.py       # Sarvam text-to-speech
│   │   ├── notes_service.py     # File text extraction (PDF/PPTX/image)
│   │   ├── ocr_service.py       # OCR via OCR.space
│   │   ├── pdf_generator.py     # PDF output generation
│   │   └── pdf_service.py       # PDF helper utilities
│   └── utils/
│       └── chunk_text.py        # Text chunking for LLM input
├── notes_maker_frontend/        # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx
│   │   └── App.css
│   └── package.json
├── .env.example                 # Environment variable template
├── render.yaml                  # Render deployment config
├── build.sh                     # Render build script
└── requirements.txt             # Python dependencies
```

---

## Getting Started

### Prerequisites

- Python 3.11+ (see `.python-version`)
- Node.js 18+ (for the frontend)
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) installed on your system
- API keys for [Groq](https://console.groq.com), [Sarvam AI](https://www.sarvam.ai), and [OCR.space](https://ocr.space/OCRAPI)

### Backend Setup

```bash
# Clone the repo
git clone <your-repo-url>
cd AI-notes-master

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env and fill in your API keys

# Start the backend
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`. Interactive docs are at `http://localhost:8000/docs`.

### Frontend Setup

```bash
cd notes_maker_frontend
npm install
npm run dev
```

The frontend dev server runs at `http://localhost:5173` by default.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```env
SARVAM_API_KEY=your_sarvam_api_key_here
GROQ_API_KEY_1=your_groq_key_1_here
GROQ_API_KEY_2=your_groq_key_2_here   # optional — used for rotation
GROQ_API_KEY_3=your_groq_key_3_here   # optional — used for rotation
OCR_SPACE_API_KEY=your_ocr_space_key_here
```

At least one Groq key is required. Multiple keys enable automatic rate-limit rotation.

---

## API Reference

### `POST /generate-notes`

Upload one or more study files and receive AI-generated notes.

**Form fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `files` | File[] | Yes | PDF, PPTX, PNG, JPG, or JPEG |
| `mode` | string | Yes | `detailed`, `important`, or `mixed` |
| `language` | string | No | Language code (default: `en`) |

**Response:**
```json
{
  "success": true,
  "mode": "detailed",
  "language": "ta",
  "results": [
    {
      "file": "lecture.pdf",
      "notes": "...",
      "pdf_url": "/download-notes/lecture_notes.pdf",
      "audio_url": "/download-audio/lecture_ta.wav",
      "language": "ta"
    }
  ]
}
```

### `POST /generate-quiz`

Generate an MCQ quiz from one or more uploaded files.

**Form fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `files` | File[] | Yes | PDF, PPTX, PNG, JPG, or JPEG |

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "file": "lecture.pdf",
      "quiz": {
        "quiz_title": "Introduction to Thermodynamics",
        "questions": [
          {
            "question": "...",
            "options": ["A", "B", "C", "D"],
            "correct_answer": "B",
            "explanation": "...",
            "difficulty": "medium"
          }
        ]
      }
    }
  ]
}
```

### `GET /languages`

Returns all supported language codes and names.

### `GET /download-notes/{filename}`

Download a generated PDF notes file.

### `GET /download-audio/{filename}`

Download a generated WAV audio file.

### `GET /health`

Returns backend status and Tesseract version.

---

## Supported Languages

| Code | Language |
|---|---|
| `en` | English |
| `hi` | Hindi |
| `bn` | Bengali |
| `gu` | Gujarati |
| `kn` | Kannada |
| `ml` | Malayalam |
| `mr` | Marathi |
| `od` | Odia |
| `pa` | Punjabi |
| `ta` | Tamil |
| `te` | Telugu |

---

## Deployment on Render

The project includes a `render.yaml` for one-click deployment to [Render](https://render.com).

1. Push the repo to GitHub
2. Create a new Render Web Service pointing to the repo
3. Render will auto-detect `render.yaml` and configure the service
4. Set the environment variables in the Render dashboard (they are marked `sync: false` for security)

The build command runs `bash build.sh` (installs Python dependencies) and the start command is:
```
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

A built-in keep-alive loop pings the service every 10 minutes via `RENDER_EXTERNAL_URL` to prevent spin-down on the free tier.

---

## Notes on Rate Limits

The Groq service uses an automatic key rotation strategy:

1. Tries each configured key in order (`GROQ_API_KEY_1` → `_2` → `_3`)
2. On `RateLimitError` or quota exhaustion (HTTP 429/402), rotates to the next key
3. If all keys fail on the primary model (`llama-3.3-70b-versatile`), falls back to `llama-3.1-8b-instant`
4. Raises `RuntimeError` only after all keys and both models are exhausted

The Sarvam translation API has a ~1000 character limit per request; the service automatically chunks longer texts and reassembles the result.

---

## License

This project does not currently include a license file. All rights reserved to the author unless otherwise specified.
