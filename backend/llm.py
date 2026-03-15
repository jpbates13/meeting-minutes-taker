"""
LLM integration.

Owns the OpenAI client singleton and the ``stream_minutes`` helper that
generates meeting minutes from a transcript and streams the result over a
WebSocket connection.
"""

from pathlib import Path
import json

from fastapi import WebSocket
from openai import OpenAI

from config import DEFAULT_PROFILE_ID, STEP_MESSAGES
from meeting_profiles import build_system_prompt, get_profile
from storage import update_meta

client = OpenAI()  # reads OPENAI_API_KEY from env


async def stream_minutes(
    websocket: WebSocket,
    job_dir: Path,
    job_id: str,
    transcript: str,
    agenda_text: str,
    model: str,
) -> None:
    """Stream LLM-generated minutes over *websocket*, persist them, then close.

    Sends ``minutes_chunk`` messages while streaming and a final ``complete``
    message on success.
    """
    await websocket.send_json({
        "status": "processing",
        "step": "generating_minutes",
        "message": STEP_MESSAGES["generating_minutes"],
    })
    print(f"🤖 Generating minutes for job {job_id}")

    profile_id = DEFAULT_PROFILE_ID
    meta_path = job_dir / "meta.json"
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            profile_id = str(meta.get("profile_id") or DEFAULT_PROFILE_ID)
        except Exception:
            profile_id = DEFAULT_PROFILE_ID

    profile = get_profile(profile_id)
    system_prompt = build_system_prompt(profile)

    user_content = f"## Transcript\n\n{transcript}"
    if agenda_text:
        user_content += f"\n\n## Agenda\n\n{agenda_text}"

    stream = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        stream=True,
    )

    full_minutes: list[str] = []
    for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            full_minutes.append(delta.content)
            await websocket.send_json({"status": "minutes_chunk", "text": delta.content})

    minutes_text = "".join(full_minutes)
    (job_dir / "minutes.md").write_text(minutes_text, encoding="utf-8")
    update_meta(job_dir, has_minutes=True, minutes_ai_generated=True)
    print(f"✅ Minutes saved for job {job_id} ({len(minutes_text)} chars)")

    await websocket.send_json({"status": "complete"})
    await websocket.close(code=1000)
    print(f"✅ WebSocket closed normally for job {job_id}")
