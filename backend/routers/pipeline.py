"""
WebSocket pipeline routes.

``/ws/{job_id}``            — full audio → transcript → minutes pipeline
``/ws-transcript/{job_id}`` — transcript-only → minutes pipeline
"""

import asyncio
import json
from pathlib import Path

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from audio_processing import process_audio
from config import DATA_DIR, LLM_AUDIO_MODEL, LLM_TRANSCRIPT_MODEL, STEP_MESSAGES
from llm import stream_minutes
from local_llm import stream_minutes_local
from storage import update_meta

router = APIRouter()


@router.websocket("/ws/{job_id}")
async def websocket_pipeline(websocket: WebSocket, job_id: str):
    """Run the full audio → transcript → minutes pipeline over a WebSocket.

    Flow:
      1. Validate the job and find the audio file.
      2. Stream WhisperX progress events to the client.
      3. Persist the completed transcript.
      4. Stream LLM-generated minutes chunk-by-chunk.
      5. Close gracefully.
    """
    await websocket.accept()
    print(f"🔌 WebSocket connected for job {job_id}")

    try:
        job_dir = Path(DATA_DIR) / job_id
        if not job_dir.exists():
            await websocket.send_json({"status": "error", "message": f"Job {job_id} not found"})
            await websocket.close(code=1008)
            return

        audio_files = [f for f in job_dir.iterdir() if f.name.startswith("audio")]
        if not audio_files:
            await websocket.send_json({"status": "error", "message": "No audio file for this job"})
            await websocket.close(code=1008)
            return

        audio_path = str(audio_files[0])

        agenda_text = ""
        agenda_files = [f for f in job_dir.iterdir() if f.name.startswith("agenda")]
        if agenda_files:
            agenda_text = agenda_files[0].read_text(encoding="utf-8", errors="replace")
            print(f"📝 Agenda loaded for job {job_id} ({len(agenda_text)} chars)")

        await websocket.send_json({
            "status": "processing",
            "step": "starting",
            "message": "Starting audio processing pipeline...",
        })
        print(f"⚙️ Transcribing job {job_id}: {audio_path}")

        # Bridge sync progress callbacks (worker thread) → async WebSocket sends.
        progress_queue: asyncio.Queue = asyncio.Queue()
        loop = asyncio.get_running_loop()

        def on_progress(step: str, detail: str = ""):
            print(f"📊 [{job_id}] {step}: {detail}")
            msg = {
                "status": "processing",
                "step": step,
                "message": STEP_MESSAGES.get(step, detail or step),
                "detail": detail,
            }
            loop.call_soon_threadsafe(progress_queue.put_nowait, msg)

        async def _run_pipeline():
            try:
                result = await asyncio.to_thread(
                    process_audio, audio_path, job_id, progress_hook=on_progress,
                )
                await progress_queue.put(("result", result))
            except Exception as exc:
                await progress_queue.put(("error", exc))

        pipeline_task = asyncio.create_task(_run_pipeline())

        transcript = None
        while True:
            msg = await progress_queue.get()
            if isinstance(msg, tuple):
                kind, value = msg
                if kind == "result":
                    transcript = value
                    break
                else:  # error
                    raise value
            await websocket.send_json(msg)

        await pipeline_task  # ensure clean shutdown

        (job_dir / "transcript.txt").write_text(transcript, encoding="utf-8")
        update_meta(job_dir, has_transcript=True)
        print(f"✅ Transcript saved for job {job_id}")

        await websocket.send_json({"status": "transcript_complete", "text": transcript})

        # Route to local LLM or OpenAI based on job meta
        use_local = False
        meta_path = job_dir / "meta.json"
        if meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
                use_local = bool(meta.get("use_local_llm", False))
            except Exception:
                pass

        if use_local:
            await stream_minutes_local(websocket, job_dir, job_id, transcript, agenda_text)
        else:
            await stream_minutes(websocket, job_dir, job_id, transcript, agenda_text, LLM_AUDIO_MODEL)

    except WebSocketDisconnect:
        print(f"⚠️ WebSocket disconnected for job {job_id}")
    except Exception as e:
        print(f"❌ WebSocket error for job {job_id}: {e}")
        try:
            await websocket.send_json({"status": "error", "message": str(e)})
            await websocket.close(code=1011)
        except Exception:
            pass  # client already gone


@router.websocket("/ws-transcript/{job_id}")
async def websocket_transcript_pipeline(websocket: WebSocket, job_id: str):
    """Generate minutes from a pre-uploaded transcript without audio processing.

    Flow:
      1. Read the saved ``transcript.txt`` and optional agenda.
      2. Send ``transcript_complete`` to the client.
      3. Stream LLM-generated minutes chunk-by-chunk.
      4. Close gracefully.
    """
    await websocket.accept()
    print(f"🔌 Transcript-only WebSocket connected for job {job_id}")

    try:
        job_dir = Path(DATA_DIR) / job_id
        if not job_dir.exists():
            await websocket.send_json({"status": "error", "message": f"Job {job_id} not found"})
            await websocket.close(code=1008)
            return

        transcript_path = job_dir / "transcript.txt"
        if not transcript_path.exists():
            await websocket.send_json({"status": "error", "message": "No transcript file for this job"})
            await websocket.close(code=1008)
            return

        await websocket.send_json({
            "status": "processing",
            "step": "reading_transcript",
            "message": "Reading uploaded transcript...",
        })
        transcript = transcript_path.read_text(encoding="utf-8", errors="replace")
        print(f"📄 Transcript loaded for job {job_id} ({len(transcript)} chars)")

        agenda_text = ""
        agenda_files = [f for f in job_dir.iterdir() if f.name.startswith("agenda")]
        if agenda_files:
            agenda_text = agenda_files[0].read_text(encoding="utf-8", errors="replace")
            print(f"📝 Agenda loaded for job {job_id} ({len(agenda_text)} chars)")

        await websocket.send_json({"status": "transcript_complete", "text": transcript})

        # Route to local LLM or OpenAI based on job meta
        use_local = False
        meta_path = job_dir / "meta.json"
        if meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
                use_local = bool(meta.get("use_local_llm", False))
            except Exception:
                pass

        if use_local:
            await stream_minutes_local(websocket, job_dir, job_id, transcript, agenda_text)
        else:
            await stream_minutes(websocket, job_dir, job_id, transcript, agenda_text, LLM_TRANSCRIPT_MODEL)

    except WebSocketDisconnect:
        print(f"⚠️ WebSocket disconnected for job {job_id}")
    except Exception as e:
        print(f"❌ WebSocket error for job {job_id}: {e}")
        try:
            await websocket.send_json({"status": "error", "message": str(e)})
            await websocket.close(code=1011)
        except Exception:
            pass  # client already gone
