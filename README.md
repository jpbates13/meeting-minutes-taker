# Meeting Minutes Generator

## Project Overview

A local-first, GPU-accelerated web application designed to record, transcribe, and summarize meeting minutes for general-purpose meetings.

The application captures audio from a MacBook browser, sends it over a secure Tailscale network to a local PC backend, processes the audio using local GPU resources, and streams the generated meeting minutes back to the client in real-time.

## Architecture & Tech Stack

- **Frontend:** Single-page Vanilla HTML/JS and Tailwind CSS. Uses `MediaRecorder` API for audio capture and WebSockets for real-time UI updates.
- **Backend:** Python FastAPI. Handles asynchronous file uploads, background tasks, and WebSocket streaming.
- **Machine Learning / Audio:** - `pydub` and `noisereduce` for HVAC/background noise cleanup.
  - `whisperx` for CUDA-accelerated transcription and speaker diarization.
- **Synthesis:** Cloud LLM API for summarizing the transcript into formal meeting minutes based on an uploaded agenda and selected meeting profile.
- **Infrastructure:** Docker and Docker Compose with NVIDIA Container Toolkit for GPU passthrough.

## Hardware & Network Constraints

- **Compute:** The backend runs on a machine with an NVIDIA RTX 5070 Ti. All heavy audio processing must be configured to utilize `cuda` and `float16`.
- **Network:** The frontend will be accessed remotely via Tailscale MagicDNS (HTTPS). The backend must configure CORS to allow this, and the frontend must handle WebSocket connections securely.

## Pipeline Flow

1. **Capture:** User records audio in the browser and optionally uploads a text/PDF agenda.
2. **Ingest:** Frontend POSTs FormData to the FastAPI backend. Backend returns a `job_id`.
3. **Connect:** Frontend establishes a WebSocket connection using the `job_id`.
4. **Clean & Transcribe:** Backend normalizes audio to temporary 16kHz mono 128 kbps audio, runs WhisperX for text and speaker diarization, then deletes the temporary file. Status is streamed via WebSocket.
5. **Summarize:** The labeled transcript and agenda are sent to an LLM with a strict generic system prompt plus optional profile-specific instructions. The text response is streamed back to the frontend in real-time.
