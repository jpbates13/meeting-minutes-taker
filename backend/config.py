"""
Application configuration.

All environment variables, model names, static prompts, and lookup tables
live here so they can be imported anywhere without circular dependencies.
``load_dotenv()`` is called at the top so that env vars are available as
soon as this module is imported.
"""

import os

from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Server
# ---------------------------------------------------------------------------
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8001))
DATA_DIR = os.getenv("DATA_DIR", "data")
AUDIO_TARGET_BITRATE = "128k"
AUDIO_TARGET_BITRATE_BPS = 128_000

# ---------------------------------------------------------------------------
# LLM
# ---------------------------------------------------------------------------
LLM_AUDIO_MODEL = "gpt-5.4"       # used after full audio → transcript pipeline
LLM_TRANSCRIPT_MODEL = "gpt-5-mini"  # used for transcript-only jobs
LOCAL_LLM_MODEL_ID = os.getenv("LOCAL_LLM_MODEL_ID", "Qwen/Qwen2.5-7B-Instruct")

DEFAULT_PROFILE_ID = "general"
DEFAULT_ORGANIZATION_NAME = "Your Organization"

SYSTEM_PROMPT = """You are an expert recording secretary.

Your objective is to transform a raw, often conversational meeting transcript into formal, publication-ready meeting minutes. Real meetings can be non-linear; it is your job to logically organize the discussion into cohesive topics, even if the conversation jumps around.

Use the following dynamic structure. If a standard element (like "Approval of Minutes") did not occur, omit the section entirely rather than writing "Not provided."

1. **Call to Order:** Date, time, and presiding officer (if available).
2. **Attendance / Roll Call:** List attendees and roles. Note explicitly stated absences.
3. **Approval of Previous Minutes:** Record motions, second, and vote when present.
4. **Main Business & Discussions:** Create clear, descriptive subheadings for each major topic.
    - Group related tangents together rather than strictly following chronology.
    - Capture key arguments, concerns, decisions, and updates.
    - Record any motions made, who moved and seconded, and vote outcomes.
5. **Public / Open Comments:** Summarize audience or stakeholder questions and responses (if applicable).
6. **Action Items:** Numbered list of tasks, owners, and deadlines (if identifiable).
7. **Adjournment:** Motion to adjourn and time (if stated).

Formatting Rules:
- Use clean Markdown formatting.
- Be concise but precise.
- Attribute statements and motions to specific speakers by name when identifiable.
- If an agenda is provided, use it as a guide, but prioritize what was actually discussed.
- Never fabricate or hallucinate information not explicitly present in the transcript."""

# ---------------------------------------------------------------------------
# WebSocket progress step → user-facing message
# ---------------------------------------------------------------------------
STEP_MESSAGES: dict[str, str] = {
    "preprocessing":      "Loading and converting audio file...",
    "noise_reduction":    "Reducing background noise...",
    "preprocessing_done": "Audio preprocessing complete.",
    "loading_model":      "Loading WhisperX speech recognition model...",
    "vad":                "Detecting voice activity...",
    "transcribing":       "Transcribing speech to text...",
    "transcription_done": "Transcription complete.",
    "aligning":           "Aligning word-level timestamps...",
    "diarizing":          "Identifying speakers (diarization)...",
    "diarization_done":   "Speaker identification complete.",
    "formatting":         "Building speaker-attributed transcript...",
    "done":               "Audio processing complete.",
    "generating_minutes":       "Generating meeting minutes with AI...",
    "loading_local_llm":         "Loading local LLM into GPU memory...",
    "generating_minutes_local":  "Generating meeting minutes with local LLM...",
}

# ---------------------------------------------------------------------------
# Audio MIME types (for serving recorded audio files)
# ---------------------------------------------------------------------------
AUDIO_MIME_MAP: dict[str, str] = {
    ".mp3":  "audio/mpeg",
    ".webm": "audio/webm",
    ".mp4":  "audio/mp4",
    ".ogg":  "audio/ogg",
    ".wav":  "audio/wav",
}
