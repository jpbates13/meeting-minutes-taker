"""
Audio Processing Module
=======================
Preprocesses, transcribes, diarizes, and formats meeting audio into
speaker-attributed text.

Usage:
    from audio_processing import process_audio
    transcript = process_audio("/path/to/audio.webm", "job-uuid")
"""

import os
import logging
from pathlib import Path
from typing import Callable, Optional

import torch
from whisperx.diarize import DiarizationPipeline

from config import AUDIO_TARGET_BITRATE

# Point pydub at the bundled ffmpeg.exe (must be in backend/ dir)
_FFMPEG_PATH = str(Path(__file__).resolve().parent / "ffmpeg.exe")
if Path(_FFMPEG_PATH).exists():
    from pydub import AudioSegment
    AudioSegment.converter = _FFMPEG_PATH
    AudioSegment.ffprobe = _FFMPEG_PATH
else:
    from pydub import AudioSegment  # fall back to system PATH

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
TARGET_SAMPLE_RATE = 16_000
HF_TOKEN = os.getenv("HF_TOKEN")


def preprocess_audio(
    input_path: str,
    job_id: str,
    progress_hook: Optional[Callable[[str, str], None]] = None,
) -> str:
    """Load audio, normalize to 16 kHz mono, and export a temporary
    128 kbps ``_clean.mp3`` next to the original file.
    """
    def _progress(step: str, detail: str = ""):
        logger.info("[%s] %s %s", job_id, step, detail)
        if progress_hook:
            progress_hook(step, detail)
            
    _progress("preprocessing", f"Loading {input_path}")

    # Load with pydub
    audio = AudioSegment.from_file(input_path)

    # Convert to 16 kHz mono, and force 16-bit sample width before encoding.
    audio = (
        audio
        .set_frame_rate(TARGET_SAMPLE_RATE)
        .set_channels(1)
        .set_sample_width(2)        # guarantee 16-bit PCM
    )

    clean_path = str(Path(input_path).with_name(f"{job_id}_clean.mp3"))
    audio.export(clean_path, format="mp3", bitrate=AUDIO_TARGET_BITRATE)
    
    _progress(
        "preprocessing_done",
        f"Normalized 16 kHz mono {AUDIO_TARGET_BITRATE} audio saved: {clean_path}",
    )

    return clean_path


# ---------------------------------------------------------------------------
# 2. Transcription, alignment & diarization
# ---------------------------------------------------------------------------
def transcribe_and_diarize(
    clean_path: str,
    job_id: str,
    progress_hook: Optional[Callable[[str, str], None]] = None,
) -> str:
    """Run WhisperX transcription + alignment + diarization pipeline
    and return a formatted speaker-attributed transcript.

    Automatically selects CUDA (float16) when available, else falls
    back to CPU (float32).
    """
    def _progress(step: str, detail: str = ""):
        logger.info("[%s] %s %s", job_id, step, detail)
        if progress_hook:
            progress_hook(step, detail)
    import whisperx  # heavy import — deferred on purpose

    # Device / compute selection
    if torch.cuda.is_available():
        device = "cuda"
        compute_type = "float16"
        logger.info("[%s] Using CUDA with float16", job_id)
    else:
        device = "cpu"
        compute_type = "float32"
        logger.info("[%s] CUDA unavailable — falling back to CPU (float32)", job_id)

    model = None
    try:
        # ---- Transcribe ----
        _progress("loading_model", "Loading WhisperX model")
        model = whisperx.load_model(
            "large-v3",
            device=device,
            compute_type=compute_type,
        )

        _progress("transcribing", "Running WhisperX transcription (en)")
        audio = whisperx.load_audio(clean_path)
        _progress("vad", "Detecting voice activity segments")
        result = model.transcribe(audio, batch_size=16, language="en")
        _progress("transcription_done", f"{len(result.get('segments', []))} segments found")

        # ---- Align ----
        _progress("aligning", "Loading alignment model and aligning timestamps")
        align_model, align_metadata = whisperx.load_align_model(
            language_code="en",
            device=device,
        )
        result = whisperx.align(
            result["segments"],
            align_model,
            align_metadata,
            audio,
            device,
            return_char_alignments=False,
        )

        # Free alignment model before loading diarization pipeline
        del align_model
        torch.cuda.empty_cache() if torch.cuda.is_available() else None

        # ---- Diarize ----
        if not HF_TOKEN:
            logger.warning(
                "[%s] HF_TOKEN not set — skipping diarization. "
                "Speakers will not be labelled.",
                job_id,
            )
        else:
            _progress("diarizing", "Running Pyannote diarization pipeline")
            # Force GPU for Pyannote when CUDA is available
            diarize_device = torch.device("cuda") if torch.cuda.is_available() else torch.device("cpu")
            diarize_pipeline = DiarizationPipeline(
                token=HF_TOKEN,
                device=diarize_device,
            )
            # whisperx's DiarizationPipeline.__call__ expects a numpy
            # array — it internally wraps it as the pyannote dict:
            #   {'waveform': torch.Tensor, 'sample_rate': int}
            # This bypasses torchcodec (broken on Windows) entirely.
            diarize_segments = diarize_pipeline(audio)
            _progress("diarization_done", "Assigning speakers to segments")
            result = whisperx.assign_word_speakers(diarize_segments, result)

        # ---- Format output ----
        _progress("formatting", "Building speaker-attributed transcript")
        transcript = _format_transcript(result["segments"])
        _progress("done", f"Transcription complete ({len(transcript)} chars)")
        return transcript

    except Exception:
        logger.exception("[%s] Error during transcription/diarization", job_id)
        raise
    finally:
        # Deterministic cleanup — release GPU memory regardless of outcome
        del model
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            logger.info("[%s] GPU memory released", job_id)


# ---------------------------------------------------------------------------
# 3. Formatting helpers
# ---------------------------------------------------------------------------
def _format_transcript(segments: list[dict]) -> str:
    """Collapse consecutive segments by the same speaker and return a
    clean ``SPEAKER_XX: [text]`` string.
    """
    lines: list[str] = []
    current_speaker: str | None = None
    current_text: list[str] = []

    for seg in segments:
        speaker = seg.get("speaker", "UNKNOWN")
        text = seg.get("text", "").strip()
        if not text:
            continue

        if speaker == current_speaker:
            current_text.append(text)
        else:
            # flush previous speaker block
            if current_speaker is not None:
                lines.append(f"{current_speaker}: {' '.join(current_text)}")
            current_speaker = speaker
            current_text = [text]

    # flush last block
    if current_speaker is not None:
        lines.append(f"{current_speaker}: {' '.join(current_text)}")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Public entry-point
# ---------------------------------------------------------------------------
def process_audio(
    input_path: str,
    job_id: str,
    progress_hook: Optional[Callable[[str, str], None]] = None,
) -> str:
    """Full pipeline: preprocess → transcribe → diarize → format.

    Parameters
    ----------
    input_path : str
        Path to the raw uploaded audio file.
    job_id : str
        Unique identifier for the current job (used for logging and
        naming intermediate files).
    progress_hook : callable, optional
        ``progress_hook(step, detail)`` is called at every major stage
        so callers can report status (e.g. over a WebSocket).

    Returns
    -------
    str
        Speaker-attributed transcript.
    """
    logger.info("[%s] === Starting audio processing pipeline ===", job_id)
    clean_path: Optional[str] = None

    try:
        clean_path = preprocess_audio(input_path, job_id, progress_hook=progress_hook)
        transcript = transcribe_and_diarize(clean_path, job_id, progress_hook=progress_hook)
        logger.info("[%s] === Pipeline finished ===", job_id)
        return transcript
    except Exception:
        logger.exception("[%s] Pipeline failed", job_id)
        raise
    finally:
        if clean_path:
            clean_file = Path(clean_path)
            if clean_file.exists():
                clean_file.unlink()
                logger.info("[%s] Removed temporary normalized audio: %s", job_id, clean_path)
