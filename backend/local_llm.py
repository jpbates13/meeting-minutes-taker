"""
Local LLM summarization.

Mirrors the ``stream_minutes`` WebSocket interface from ``llm.py`` but runs
a local Hugging Face ``transformers`` model instead of calling the OpenAI API.

The model is loaded into VRAM on-demand with 4-bit NF4 quantization to fit
within 16 GB, and immediately purged after generation to share GPU memory
with WhisperX.
"""

import gc
import json
import os
import asyncio
import logging
from pathlib import Path
from threading import Thread

import torch
from fastapi import WebSocket

from config import LOCAL_LLM_MODEL_ID, STEP_MESSAGES, DEFAULT_PROFILE_ID
from meeting_profiles import build_system_prompt, get_profile
from storage import update_meta

logger = logging.getLogger(__name__)


async def stream_minutes_local(
    websocket: WebSocket,
    job_dir: Path,
    job_id: str,
    transcript: str,
    agenda_text: str,
) -> None:
    """Generate meeting minutes with a local LLM and stream over *websocket*.

    Follows exactly the same WebSocket protocol as ``llm.stream_minutes``
    (``minutes_chunk`` messages + final ``complete``), so the frontend needs
    no special handling.

    Key design decisions for 16 GB VRAM:
      - 4-bit NF4 quantization via BitsAndBytes (~4 GB for a 7B model)
      - Strict GPU isolation (device_map={"": 0}) to prevent PCIe spillover
      - Async-safe streaming via asyncio.to_thread to avoid blocking FastAPI
      - Nuclear VRAM teardown: all local tensors + model + tokenizer
    """
    from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig, TextIteratorStreamer

    await websocket.send_json({
        "status": "processing",
        "step": "loading_local_llm",
        "message": STEP_MESSAGES.get("loading_local_llm", "Loading local LLM…"),
    })
    print(f"🤖 Loading local LLM for job {job_id}")

    # ── Resolve meeting profile ──
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

    model = None
    tokenizer = None
    input_ids = None
    streamer = None
    generation_kwargs = None
    try:
        # ── Load model + tokenizer (on-demand, 4-bit quantized) ──
        hf_token = os.getenv("HF_TOKEN") or None

        quant_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_compute_dtype=torch.float16,
            bnb_4bit_use_double_quant=True,
            bnb_4bit_quant_type="nf4",
        )

        tokenizer = AutoTokenizer.from_pretrained(
            LOCAL_LLM_MODEL_ID, token=hf_token,
        )
        model = AutoModelForCausalLM.from_pretrained(
            LOCAL_LLM_MODEL_ID,
            quantization_config=quant_config,
            device_map={"": 0},
            token=hf_token,
        )

        await websocket.send_json({
            "status": "processing",
            "step": "generating_minutes_local",
            "message": STEP_MESSAGES.get(
                "generating_minutes_local",
                "Generating meeting minutes with local LLM…",
            ),
        })
        print(f"🤖 Generating minutes locally for job {job_id}")

        # ── Build chat-template input ──
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]

        input_ids = tokenizer.apply_chat_template(
            messages, return_tensors="pt", add_generation_prompt=True,
        ).to(model.device)

        # ── Stream generation (non-blocking) ──
        streamer = TextIteratorStreamer(
            tokenizer, skip_prompt=True, skip_special_tokens=True,
        )

        generation_kwargs = {
            "input_ids": input_ids,
            "max_new_tokens": 4096,
            "temperature": 0.7,
            "do_sample": True,
            "streamer": streamer,
        }

        thread = Thread(target=model.generate, kwargs=generation_kwargs)
        thread.start()

        # Bridge the synchronous streamer → async event loop via a queue.
        # A helper thread drains the streamer and puts tokens into the queue;
        # the coroutine awaits queue.get() without blocking FastAPI.
        token_queue: asyncio.Queue = asyncio.Queue()
        loop = asyncio.get_running_loop()
        _SENTINEL = object()

        def _drain_streamer():
            """Run in a thread — reads from the synchronous streamer."""
            try:
                for text in streamer:
                    loop.call_soon_threadsafe(token_queue.put_nowait, text)
            finally:
                loop.call_soon_threadsafe(token_queue.put_nowait, _SENTINEL)

        drain_thread = Thread(target=_drain_streamer, daemon=True)
        drain_thread.start()

        full_minutes: list[str] = []
        while True:
            token = await token_queue.get()
            if token is _SENTINEL:
                break
            if token:
                full_minutes.append(token)
                await websocket.send_json({
                    "status": "minutes_chunk",
                    "text": token,
                })

        thread.join()
        drain_thread.join()

        minutes_text = "".join(full_minutes)
        (job_dir / "minutes.md").write_text(minutes_text, encoding="utf-8")
        update_meta(job_dir, has_minutes=True, minutes_ai_generated=True)
        print(f"✅ Local LLM minutes saved for job {job_id} ({len(minutes_text)} chars)")

        await websocket.send_json({"status": "complete"})
        await websocket.close(code=1000)
        print(f"✅ WebSocket closed normally for job {job_id}")

    finally:
        # 1. Break the Thread's hidden reference to the bound method (`model.generate`)
        if 'thread' in locals() and thread is not None:
            # Wipe the internal references so the Thread object drops the model
            thread._target = None 
            thread._args = None
            thread._kwargs = None
            del thread
            
        if 'drain_thread' in locals():
            del drain_thread

        # 2. Release Accelerate's global hooks (The Silver Bullet)
        from accelerate.utils import release_memory
        if 'model' in locals() and model is not None:
            # This purges the model from Hugging Face's global device_map registry
            model = release_memory(model)
            del model

        # 3. Explicitly nuke the other heavy local variables
        if 'input_ids' in locals(): del input_ids
        if 'generation_kwargs' in locals(): del generation_kwargs
        if 'streamer' in locals(): del streamer
        if 'tokenizer' in locals(): del tokenizer
        if 'token_queue' in locals(): del token_queue

        # 4. Double GC pass to sever circular references
        gc.collect()
        gc.collect()

        # 5. Flush CUDA cache and print the proof
        if torch.cuda.is_available():
            torch.cuda.synchronize()
            torch.cuda.empty_cache()
            
            allocated = torch.cuda.memory_allocated() / 1024**2
            reserved = torch.cuda.memory_reserved() / 1024**2
            logger.info(
                "[%s] VRAM after teardown: %.1f MB allocated, %.1f MB reserved",
                job_id, allocated, reserved,
            )
            print(f"🧹 VRAM Purged: {allocated:.1f}MB allocated, {reserved:.1f}MB reserved")