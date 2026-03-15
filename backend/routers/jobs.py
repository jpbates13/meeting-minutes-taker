"""
Job management routes.

Handles file uploads and the (synchronous) audio-processing endpoint.
WebSocket-based pipeline routes live in ``routers/pipeline.py``.
"""

import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from audio_processing import process_audio
from config import DATA_DIR, DEFAULT_PROFILE_ID
from storage import ensure_job_dir, save_upload, write_meta

router = APIRouter()


@router.post("/upload")
def upload(
    audio: UploadFile = File(...),
    agenda: UploadFile = File(None),
    profile_id: str = Form(DEFAULT_PROFILE_ID),
    use_local_llm: str = Form("false"),
):
    """Save an audio file (and optional agenda) and return a job ID.

    The frontend should then open ``/ws/{job_id}`` to run the full pipeline.
    """
    job_id = str(uuid.uuid4())
    print(f"🎙️ New upload job: {job_id}")

    try:
        job_dir = ensure_job_dir(job_id)

        audio_ext = Path(audio.filename).suffix or ".webm"
        audio_path = job_dir / f"audio{audio_ext}"
        save_upload(audio, audio_path)
        print(f"✅ Audio saved for job {job_id}: {audio_path}")

        agenda_path = None
        if agenda and agenda.filename:
            agenda_ext = Path(agenda.filename).suffix or ".txt"
            agenda_path = job_dir / f"agenda{agenda_ext}"
            save_upload(agenda, agenda_path)
            print(f"📝 Agenda saved for job {job_id}: {agenda_path}")
        else:
            print(f"⚠️ No agenda provided for job {job_id}, skipping")

        write_meta(
            job_dir,
            job_id,
            "audio",
            has_agenda=bool(agenda_path),
            has_audio=True,
            profile_id=profile_id or DEFAULT_PROFILE_ID,
            use_local_llm=use_local_llm.lower() == "true",
        )

        response = {"job_id": job_id, "audio_file": str(audio_path)}
        if agenda_path:
            response["agenda_file"] = str(agenda_path)

        print(f"🚀 Upload complete for job {job_id}")
        return response

    except Exception as e:
        print(f"❌ Upload failed for job {job_id}: {e}")
        job_dir = Path(DATA_DIR) / job_id
        if job_dir.exists():
            shutil.rmtree(job_dir)
            print(f"🗑️ Cleaned up failed job directory: {job_dir}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload-transcript")
def upload_transcript(
    transcript: UploadFile = File(...),
    agenda: UploadFile = File(None),
    profile_id: str = Form(DEFAULT_PROFILE_ID),
    use_local_llm: str = Form("false"),
):
    """Save a raw ``.txt`` transcript (and optional agenda) and return a job ID.

    The frontend should then open ``/ws-transcript/{job_id}`` to stream
    LLM-generated minutes without running the audio pipeline.
    """
    job_id = str(uuid.uuid4())
    print(f"📄 New transcript-only job: {job_id}")

    try:
        job_dir = ensure_job_dir(job_id)

        transcript_dest = job_dir / "transcript.txt"
        save_upload(transcript, transcript_dest)
        print(f"✅ Transcript saved for job {job_id}: {transcript_dest}")

        agenda_path = None
        if agenda and agenda.filename:
            agenda_ext = Path(agenda.filename).suffix or ".txt"
            agenda_path = job_dir / f"agenda{agenda_ext}"
            save_upload(agenda, agenda_path)
            print(f"📝 Agenda saved for job {job_id}: {agenda_path}")

        write_meta(
            job_dir,
            job_id,
            "transcript",
            has_agenda=bool(agenda_path),
            has_transcript=True,
            profile_id=profile_id or DEFAULT_PROFILE_ID,
            use_local_llm=use_local_llm.lower() == "true",
        )

        response = {
            "job_id": job_id,
            "mode": "transcript",
            "transcript_file": str(transcript_dest),
        }
        if agenda_path:
            response["agenda_file"] = str(agenda_path)

        print(f"🚀 Transcript upload complete for job {job_id}")
        return response

    except Exception as e:
        print(f"❌ Transcript upload failed for job {job_id}: {e}")
        job_dir = Path(DATA_DIR) / job_id
        if job_dir.exists():
            shutil.rmtree(job_dir)
            print(f"🗑️ Cleaned up failed job directory: {job_dir}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/process/{job_id}")
def process(job_id: str):
    """Run the (blocking) audio-processing pipeline for a previously uploaded job.

    Prefer the WebSocket endpoint ``/ws/{job_id}`` for real-time progress updates.
    """
    job_dir = Path(DATA_DIR) / job_id
    if not job_dir.exists():
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    audio_files = [f for f in job_dir.iterdir() if f.name.startswith("audio")]
    if not audio_files:
        raise HTTPException(status_code=404, detail="No audio file for this job")

    audio_path = str(audio_files[0])
    print(f"⚙️ Processing job {job_id}: {audio_path}")

    try:
        transcript = process_audio(audio_path, job_id)
        (job_dir / "transcript.txt").write_text(transcript, encoding="utf-8")
        print(f"✅ Transcript saved for job {job_id}")
        return {"job_id": job_id, "transcript": transcript}
    except Exception as e:
        print(f"❌ Processing failed for job {job_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
