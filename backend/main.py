"""
Application entry point.

Creates the FastAPI app, registers middleware and routers, and starts
uvicorn when run directly.  All business logic lives in the modules
imported below:

  config.py          — settings, prompts, and constant maps
  storage.py         — filesystem helpers (job dirs, meta.json)
  llm.py             — OpenAI client and stream_minutes helper
  audio_processing.py — WhisperX transcription / diarization pipeline
  routers/jobs.py    — POST /upload, /upload-transcript, /process
  routers/pipeline.py — WS  /ws, /ws-transcript
  routers/meetings.py — GET/PATCH /meetings and sub-routes
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import DATA_DIR, HOST, PORT
from routers import jobs, meetings, pipeline, profiles

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="Meeting Minutes Taker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # running over Tailscale — all origins are trusted
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print(f"✅ FastAPI app initialized — data directory: {DATA_DIR}")

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(jobs.router)
app.include_router(pipeline.router)
app.include_router(meetings.router)
app.include_router(profiles.router)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    print(f"🚀 Starting server on {HOST}:{PORT}")
    uvicorn.run(app, host=HOST, port=PORT)

