# Meeting Minutes Generator

## Project Overview
A local-first, GPU-accelerated web application designed to securely record, transcribe, and summarize meeting minutes. Built with strict corporate compliance and data privacy in mind, the application supports a fully "air-gapped" workflow. 

It captures audio via the browser, processes it using local GPU resources (transcription + LLM synthesis), and streams the generated minutes back in real-time. It features built-in tools for handling sensitive discussions and enforcing document retention policies.

## Key Privacy & Compliance Features
* **Air-Gapped Processing (Local LLM):** Optionally run the entire transcription and summarization pipeline locally without an internet connection, ensuring zero third-party data sharing.
* **"Off the Record" Mode:** A native pause function that instantly suspends audio capture during sensitive conversations (e.g., Executive Sessions) to ensure unapproved discussions are never processed or transcribed.
* **Strict Document Retention (Auto-Purge):** Enforces corporate data hygiene. Once a human reviewer explicitly marks the AI-generated draft as "Finalized," the backend permanently deletes all raw audio files and intermediate transcripts from the server, leaving only the official, human-reviewed text record.

## Architecture & Tech Stack
* **Frontend:** React and Tailwind CSS. Utilizes the `MediaRecorder` API for audio capture with native pause/resume state management, and WebSockets for real-time UI streaming.
* **Backend:** Python FastAPI. Handles asynchronous file uploads, background processing, WebSocket streaming, and secure file deletion.
* **Machine Learning / Audio Pipeline:** * `pydub` and `noisereduce` for HVAC and background noise cleanup.
    * `whisperx` for CUDA-accelerated transcription and speaker diarization.
* **Synthesis (Dual-Mode):** * **Cloud API:** Routes through enterprise endpoints (e.g., OpenAI) with zero-training data retention policies.
    * **Local LLM:** Fully offline summarization using open-source models (e.g., Qwen 2.5) running directly on local VRAM.
* **Infrastructure:** Docker and Docker Compose with NVIDIA Container Toolkit for GPU passthrough.

## Hardware & Network Constraints
* **Compute:** The backend is optimized for an NVIDIA RTX 5070 Ti. Heavy audio processing and local LLM inference are configured to aggressively utilize `cuda` and `float16` to manage VRAM constraints.
* **Network:** The frontend is designed to be accessed remotely via Tailscale MagicDNS (HTTPS). The FastAPI backend implements strict CORS policies, and the frontend handles WebSocket connections securely over the Tailscale mesh network.

## Pipeline Flow
1. **Capture:** User records audio in the browser. The recording can be paused at any time for "Off the Record" discussions. An agenda (text/PDF) can be optionally uploaded.
2. **Ingest:** The frontend POSTs FormData to the FastAPI backend, which returns a unique `job_id`.
3. **Connect:** The frontend establishes a WebSocket connection using the `job_id` to monitor progress.
4. **Clean & Transcribe:** The backend normalizes the audio (16kHz mono, 128 kbps), runs WhisperX for text and speaker diarization, and streams the status back to the client.
5. **Summarize:** The labeled transcript, agenda, and selected meeting profile are sent to the LLM (Cloud or Local). The drafted minutes are streamed back to the frontend in real-time.
6. **Review & Purge:** A human operator reviews the draft. Upon clicking "Finalize," the system permanently destroys the raw audio and transcript files, outputting the final official PDF.