"""
Meetings history routes.

Provides read/write access to past meeting records stored on disk.
"""

import datetime
import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, Response

from config import AUDIO_MIME_MAP, DATA_DIR, DEFAULT_PROFILE_ID
from meeting_profiles import get_profile
from storage import resolve_job_dir, update_meta
from pdf_generator import generate_transcript_pdf, generate_minutes_pdf

router = APIRouter(prefix="/meetings")


@router.get("")
def list_meetings():
    """Return all past meeting jobs, sorted most-recent first.

    Only includes jobs that have at least a transcript or minutes file.
    Jobs created before ``meta.json`` was introduced are handled by
    inferring state from the filesystem.
    """
    data_path = Path(DATA_DIR)
    if not data_path.exists():
        return []

    meetings = []
    for job_dir in data_path.iterdir():
        if not job_dir.is_dir():
            continue
        job_id = job_dir.name
        meta_path = job_dir / "meta.json"

        if meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
            except Exception:
                meta = {"id": job_id}
        else:
            # Legacy job — infer state from the filesystem
            has_transcript = (job_dir / "transcript.txt").exists()
            has_minutes = (job_dir / "minutes.md").exists()
            if not has_transcript and not has_minutes:
                continue
            ctime = job_dir.stat().st_mtime
            meta = {
                "id": job_id,
                "created_at": datetime.datetime.fromtimestamp(
                    ctime, tz=datetime.timezone.utc
                ).isoformat(),
                "mode": "audio" if any(job_dir.glob("audio.*")) else "transcript",
                "profile_id": DEFAULT_PROFILE_ID,
                "has_agenda": any(job_dir.glob("agenda*")),
                "has_transcript": has_transcript,
                "has_minutes": has_minutes,
                "has_audio": any(job_dir.glob("audio.*")),
            }

        if not meta.get("profile_id"):
            meta["profile_id"] = DEFAULT_PROFILE_ID

        if not meta.get("has_transcript") and not meta.get("has_minutes"):
            continue

        meetings.append(meta)

    meetings.sort(key=lambda m: m.get("created_at", ""), reverse=True)
    return meetings


@router.get("/{job_id}")
def get_meeting(job_id: str):
    """Return the transcript and minutes for a specific past meeting."""
    job_dir = resolve_job_dir(job_id)

    transcript_path = job_dir / "transcript.txt"
    minutes_path = job_dir / "minutes.md"
    meta_path = job_dir / "meta.json"

    minutes_ai_generated = minutes_path.exists()
    meta = {}
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            if "minutes_ai_generated" in meta:
                minutes_ai_generated = bool(meta.get("minutes_ai_generated"))
        except Exception:
            pass

    return {
        "job_id": job_id,
        "transcript": transcript_path.read_text(encoding="utf-8", errors="replace")
        if transcript_path.exists()
        else None,
        "minutes": minutes_path.read_text(encoding="utf-8", errors="replace")
        if minutes_path.exists()
        else None,
        "minutes_ai_generated": minutes_ai_generated,
        "profile_id": meta.get("profile_id", DEFAULT_PROFILE_ID) if meta_path.exists() else DEFAULT_PROFILE_ID,
    }


@router.patch("/{job_id}")
def rename_meeting(job_id: str, body: dict):
    """Update editable fields for a meeting (currently only ``title``)."""
    job_dir = resolve_job_dir(job_id)

    title = body.get("title", "")
    if not isinstance(title, str):
        raise HTTPException(status_code=422, detail="title must be a string")
    # Store None for empty/whitespace-only titles so the UI falls back to the date.
    update_meta(job_dir, title=title.strip() or None)
    return {"ok": True}


@router.patch("/{job_id}/minutes")
def update_meeting_minutes(job_id: str, body: dict):
    """Persist manually edited minutes and mark the record as human-edited."""
    job_dir = resolve_job_dir(job_id)

    minutes = body.get("minutes")
    if not isinstance(minutes, str):
        raise HTTPException(status_code=422, detail="minutes must be a string")

    (job_dir / "minutes.md").write_text(minutes, encoding="utf-8")
    update_meta(
        job_dir,
        has_minutes=True,
        minutes_ai_generated=False,
        minutes_last_edited_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
    )
    return {"ok": True}


@router.get("/{job_id}/audio")
def get_meeting_audio(job_id: str):
    """Stream the raw audio file for a past meeting.

    Starlette's ``FileResponse`` supports HTTP Range requests automatically,
    so the browser can seek without re-downloading the entire file.
    """
    job_dir = resolve_job_dir(job_id)

    audio_files = sorted(job_dir.glob("audio.*"))
    if not audio_files:
        raise HTTPException(status_code=404, detail="No audio file for this meeting")

    audio_path = audio_files[0]
    media_type = AUDIO_MIME_MAP.get(audio_path.suffix.lower(), "audio/webm")
    return FileResponse(str(audio_path), media_type=media_type)


@router.get("/{job_id}/export/transcript")
def export_transcript_pdf(job_id: str):
    """Export the meeting transcript as a PDF with console-style formatting."""
    job_dir = resolve_job_dir(job_id)
    transcript_path = job_dir / "transcript.txt"
    
    if not transcript_path.exists():
        raise HTTPException(status_code=404, detail="No transcript available for this meeting")
    
    # Get meeting metadata for title and date
    meta_path = job_dir / "meta.json"
    meeting_title = "Meeting Transcript"
    meeting_date = None
    
    profile_id = DEFAULT_PROFILE_ID
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            meeting_title = meta.get("title") or "Meeting Transcript"
            profile_id = str(meta.get("profile_id") or DEFAULT_PROFILE_ID)
            if meta.get("created_at"):
                # Parse ISO datetime and format nicely
                created_at = datetime.datetime.fromisoformat(meta["created_at"].replace("Z", "+00:00"))
                meeting_date = created_at.strftime("%B %d, %Y at %I:%M %p")
        except Exception:
            pass

    profile = get_profile(profile_id)
    organization_name = profile.get("organization_name") or "Your Organization"
    
    # Read transcript content
    transcript_text = transcript_path.read_text(encoding="utf-8", errors="replace")
    
    # Generate PDF
    pdf_bytes = generate_transcript_pdf(
        transcript_text,
        meeting_title,
        meeting_date,
        organization_name=organization_name,
    )
    
    # Create filename
    filename = f"transcript_{job_id}.pdf"
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            if meta.get("title"):
                safe_title = "".join(c for c in meta["title"] if c.isalnum() or c in (' ', '-', '_')).rstrip()
                filename = f"transcript_{safe_title[:30]}.pdf"
        except Exception:
            pass
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/{job_id}/export/minutes")
def export_minutes_pdf(job_id: str):
    """Export the meeting minutes as a beautifully formatted PDF."""
    job_dir = resolve_job_dir(job_id)
    minutes_path = job_dir / "minutes.md"
    
    if not minutes_path.exists():
        raise HTTPException(status_code=404, detail="No minutes available for this meeting")
    
    # Get meeting metadata for title and date
    meta_path = job_dir / "meta.json"
    meeting_title = "Meeting Minutes"
    meeting_date = None
    
    profile_id = DEFAULT_PROFILE_ID
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            meeting_title = meta.get("title") or "Meeting Minutes"
            profile_id = str(meta.get("profile_id") or DEFAULT_PROFILE_ID)
            if meta.get("created_at"):
                # Parse ISO datetime and format nicely
                created_at = datetime.datetime.fromisoformat(meta["created_at"].replace("Z", "+00:00"))
                meeting_date = created_at.strftime("%B %d, %Y at %I:%M %p")
        except Exception:
            pass

    profile = get_profile(profile_id)
    organization_name = profile.get("organization_name") or "Your Organization"
    
    # Read minutes content
    minutes_text = minutes_path.read_text(encoding="utf-8", errors="replace")
    
    include_ai_disclaimer = True
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            if "minutes_ai_generated" in meta:
                include_ai_disclaimer = bool(meta.get("minutes_ai_generated"))
        except Exception:
            pass

    # Generate PDF
    pdf_bytes = generate_minutes_pdf(
        minutes_text,
        meeting_title,
        meeting_date,
        include_ai_disclaimer=include_ai_disclaimer,
        organization_name=organization_name,
    )
    
    # Create filename
    filename = f"minutes_{job_id}.pdf"
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            if meta.get("title"):
                safe_title = "".join(c for c in meta["title"] if c.isalnum() or c in (' ', '-', '_')).rstrip()
                filename = f"minutes_{safe_title[:30]}.pdf"
        except Exception:
            pass
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
