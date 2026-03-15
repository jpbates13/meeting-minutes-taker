"""
Storage helpers.

All filesystem operations for job directories and meta.json files are
centralised here so the rest of the application never needs to know about
the on-disk layout.
"""

import json
import shutil
import datetime
from pathlib import Path

from fastapi import HTTPException

from config import DATA_DIR


# ---------------------------------------------------------------------------
# Job directory helpers
# ---------------------------------------------------------------------------

def ensure_job_dir(job_id: str) -> Path:
    """Create (if necessary) and return the path to a job's data directory."""
    job_dir = Path(DATA_DIR) / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    return job_dir


def resolve_job_dir(job_id: str) -> Path:
    """Resolve a job directory and guard against path-traversal attacks.

    Raises:
        HTTPException 400 if job_id contains path-traversal sequences.
        HTTPException 404 if the directory does not exist.
    """
    base = Path(DATA_DIR).resolve()
    job_dir = (base / job_id).resolve()
    if not str(job_dir).startswith(str(base)):
        raise HTTPException(status_code=400, detail="Invalid job ID")
    if not job_dir.exists():
        raise HTTPException(status_code=404, detail=f"Meeting {job_id} not found")
    return job_dir


# ---------------------------------------------------------------------------
# File upload helper
# ---------------------------------------------------------------------------

def save_upload(upload_file, dest_path: Path) -> Path:
    """Write a FastAPI ``UploadFile`` to *dest_path* and return the path."""
    try:
        with open(dest_path, "wb") as f:
            shutil.copyfileobj(upload_file.file, f)
        print(f"💾 Saved file: {dest_path}")
        return dest_path
    except Exception as e:
        print(f"❌ Failed to save file {dest_path}: {e}")
        raise


# ---------------------------------------------------------------------------
# meta.json helpers
# ---------------------------------------------------------------------------

def write_meta(
    job_dir: Path,
    job_id: str,
    mode: str,
    has_agenda: bool,
    profile_id: str,
    has_transcript: bool = False,
    has_audio: bool = False,
    use_local_llm: bool = False,
) -> dict:
    """Write the initial ``meta.json`` for a new job and return it."""
    meta = {
        "id": job_id,
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "mode": mode,
        "profile_id": profile_id,
        "has_agenda": has_agenda,
        "has_transcript": has_transcript,
        "has_minutes": False,
        "has_audio": has_audio,
        "use_local_llm": use_local_llm,
        "title": None,
    }
    (job_dir / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return meta


def update_meta(job_dir: Path, **kwargs) -> None:
    """Merge *kwargs* into the existing ``meta.json`` (creates one if missing)."""
    meta_path = job_dir / "meta.json"
    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception:
        meta = {}
    meta.update(kwargs)
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
