import { useRef, useState, useCallback, useEffect } from "react";
import { postAudio, postAudioFile, postTranscript } from "../api/jobs";
import { RECORDER_AUDIO_BITRATE_BPS } from "../config";
import { buildTranscriptOnlySteps } from "../lib/pipeline";
import usePipeline from "./usePipeline";
import useWaveform from "./useWaveform";
import {
  createSession,
  storeChunk,
  markSessionStopped,
  markSessionUploaded,
  assembleSession,
  getRecoverableSessions,
  deleteSession,
  purgeOldSessions,
} from "../lib/chunkStore";

// ── Helpers ──

/** Pick a MIME type the browser actually supports. */
function getSupportedMime() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return ""; // let the browser decide
}

function formatTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function mimeToExt(mimeType) {
  if (mimeType.includes("webm")) return ".webm";
  if (mimeType.includes("mp4")) return ".mp4";
  return ".ogg";
}

/** Generate a UUID (crypto.randomUUID or fallback). */
function newSessionId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Timeslice interval in ms — how often we flush a chunk to IndexedDB. */
const TIMESLICE_MS = 5_000;

// ── Hook ──

export default function useRecorder() {
  // Delegate WebSocket + output state to usePipeline
  const pipeline = usePipeline();

  // Delegate canvas management to useWaveform
  const waveform = useWaveform();

  // Recording-specific state
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [savedChunks, setSavedChunks] = useState(0);
  const [recoverableSession, setRecoverableSession] = useState(null);

  // Refs for mutable recording state (not rendered directly)
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const agendaFileRef = useRef(null);

  // Chunk-writing state — tracks the current session
  const sessionIdRef = useRef(null);
  const chunkIndexRef = useRef(0);

  // ── On-mount: check for recoverable sessions ──

  useEffect(() => {
    let cancelled = false;

    async function checkRecovery() {
      try {
        // Purge ancient uploaded sessions first (background housekeeping)
        await purgeOldSessions();

        const sessions = await getRecoverableSessions();
        if (!cancelled && sessions.length > 0) {
          // Take the most recent recoverable session
          const latest = sessions.sort((a, b) => b.startedAt - a.startedAt)[0];
          console.log("🔄 Recoverable session found:", latest);
          setRecoverableSession(latest);
        }
      } catch (err) {
        console.warn("Recovery check failed:", err);
      }
    }

    checkRecovery();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Timer ──

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 500);
  }, []);

  const stopTimer = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  // ── Upload helpers (use api/jobs.js) ──

  /**
   * Upload an assembled audio Blob and kick off the WebSocket pipeline.
   * @param {Blob}        blob
   * @param {string}      ext  e.g. ".webm"
   * @param {string|null} sid  IndexedDB session to mark uploaded on success
   */
  const uploadRecording = useCallback(
    async (blob, ext, sid, profileId = "general", useLocalLlm = false) => {
      pipeline.setStatus("Uploading recording…");
      pipeline.resetOutput();

      try {
        const jobId = await postAudio(
          blob,
          `recording${ext}`,
          agendaFileRef.current,
          profileId,
          useLocalLlm,
        );
        console.log("Upload successful — job_id:", jobId);
        pipeline.setStatus(`Upload complete. Job ID: ${jobId}`);

        if (sid) {
          markSessionUploaded(sid).then(() => {
            setTimeout(() => deleteSession(sid), 5_000);
          });
        }

        pipeline.connect(jobId);
      } catch (err) {
        console.error("Upload failed:", err);
        pipeline.setStatus(`⚠ Upload failed: ${err.message}`);
        // Do NOT delete the session — user can retry recovery later
      }
    },
    [pipeline],
  );

  // ── Recording lifecycle (chunked + IndexedDB) ──

  const startRecording = useCallback(async (profileId = "general", useLocalLlm = false) => {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (err) {
      pipeline.setStatus(
        "⚠ Microphone access denied. Ensure you are on HTTPS (Tailscale MagicDNS).",
      );
      console.error("getUserMedia error:", err);
      return;
    }

    audioStreamRef.current = stream;

    const mimeType = getSupportedMime();
    const recorder = new MediaRecorder(stream, {
      mimeType,
      audioBitsPerSecond: RECORDER_AUDIO_BITRATE_BPS,
    });

    const sid = newSessionId();
    sessionIdRef.current = sid;
    chunkIndexRef.current = 0;
    setSavedChunks(0);

    try {
      await createSession(sid, recorder.mimeType);
      console.log(`💾 IndexedDB session created: ${sid}`);
    } catch (err) {
      console.error("Failed to create IndexedDB session:", err);
    }

    recorder.addEventListener("dataavailable", async (e) => {
      if (e.data.size === 0) return;
      const idx = chunkIndexRef.current++;
      try {
        await storeChunk(sid, idx, e.data);
        setSavedChunks(idx + 1);
      } catch (err) {
        console.error(`Failed to store chunk ${idx}:`, err);
      }
    });

    // ── On stop, assemble from IndexedDB and upload ──
    recorder.addEventListener("stop", async () => {
      try {
        await markSessionStopped(sid);
        console.log(`⏹️ Session ${sid} marked stopped`);

        const { blob, mimeType: mt, chunkCount } = await assembleSession(sid);
        console.log(
          `📦 Assembled ${chunkCount} chunks → ${(blob.size / 1024).toFixed(1)} KB (${mt})`,
        );

        uploadRecording(blob, mimeToExt(mt), sid, profileId, useLocalLlm);
      } catch (err) {
        console.error("Failed to assemble recording:", err);
        pipeline.setStatus(
          "⚠ Failed to assemble recording. Try recovering from the banner.",
        );
      }
    });

    // ── Start with timeslice for chunk-based recording ──
    recorder.start(TIMESLICE_MS);
    mediaRecorderRef.current = recorder;

    waveform.setupAnalyser(stream);

    setIsRecording(true);
    startTimer();
    pipeline.setStatus("Recording…");
    // Clear any leftover recovery banner since we're starting fresh
    setRecoverableSession(null);
  }, [pipeline, waveform, startTimer, uploadRecording]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    const stream = audioStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
    }
    setIsRecording(false);
    stopTimer();
    waveform.stopWaveform();
  }, [stopTimer, waveform]);

  // ── Recovery actions ──

  /**
   * Recover a previous session: reassemble its chunks from IndexedDB
   * and upload the resulting blob.
   */
  const recoverSession = useCallback(
    async (session) => {
      if (!session) return;
      pipeline.setStatus("Recovering previous recording…");
      pipeline.resetOutput();
      setRecoverableSession(null);

      try {
        const { blob, mimeType, chunkCount } = await assembleSession(
          session.id,
        );
        console.log(
          `🔄 Recovered ${chunkCount} chunks → ${(blob.size / (1024 * 1024)).toFixed(1)} MB`,
        );
        pipeline.setStatus(
          `Recovered ${chunkCount} chunks (${(blob.size / (1024 * 1024)).toFixed(1)} MB). Uploading…`,
        );

        await uploadRecording(blob, mimeToExt(mimeType), session.id);
      } catch (err) {
        console.error("Recovery failed:", err);
        pipeline.setStatus(`⚠ Recovery failed: ${err.message}`);
      }
    },
    [pipeline, uploadRecording],
  );

  const discardSession = useCallback(async (session) => {
    if (!session) return;
    try {
      await deleteSession(session.id);
      console.log(`🗑️ Discarded session ${session.id}`);
    } catch (err) {
      console.warn("Failed to discard session:", err);
    }
    setRecoverableSession(null);
  }, []);

  const setAgendaFile = useCallback((file) => {
    agendaFileRef.current = file || null;
  }, []);

  const uploadAudioFile = useCallback(
    async (file, profileId = "general", useLocalLlm = false) => {
      if (!file) return;
      pipeline.setStatus("Uploading audio file…");
      pipeline.resetOutput();
      try {
        const jobId = await postAudioFile(
          file,
          agendaFileRef.current,
          profileId,
          useLocalLlm,
        );
        console.log("Upload successful — job_id:", jobId);
        pipeline.setStatus(`Upload complete. Job ID: ${jobId}`);
        pipeline.connect(jobId);
      } catch (err) {
        console.error("Upload failed:", err);
        pipeline.setStatus(`⚠ Upload failed: ${err.message}`);
      }
    },
    [pipeline],
  );

  const uploadTranscriptFile = useCallback(
    async (transcriptFile, agendaFile, profileId = "general", useLocalLlm = false) => {
      if (!transcriptFile) return;
      pipeline.setStatus("Uploading transcript…");
      pipeline.resetOutput();
      try {
        const jobId = await postTranscript(transcriptFile, agendaFile, profileId, useLocalLlm);
        console.log("Transcript upload successful — job_id:", jobId);
        pipeline.setStatus(`Transcript uploaded. Job ID: ${jobId}`);
        pipeline.connect(jobId, "ws-transcript", buildTranscriptOnlySteps());
      } catch (err) {
        console.error("Transcript upload failed:", err);
        pipeline.setStatus(`⚠ Upload failed: ${err.message}`);
      }
    },
    [pipeline],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return {
    // Recording state
    isRecording,
    elapsed,
    elapsedFormatted: formatTime(elapsed),
    savedChunks,
    recoverableSession,
    // Pipeline/output state (from usePipeline)
    status: pipeline.status,
    transcript: pipeline.transcript,
    minutes: pipeline.minutes,
    minutesAiGenerated: pipeline.minutesAiGenerated,
    pipelineSteps: pipeline.pipelineSteps,
    pipelineMessage: pipeline.pipelineMessage,
    jobId: pipeline.jobId,
    loadMeeting: pipeline.loadMeeting,
    saveMinutes: pipeline.saveMinutes,
    clearMeeting: pipeline.resetOutput,
    // Waveform (from useWaveform)
    canvasRef: waveform.canvasRef,
    clearCanvas: waveform.clearCanvas,
    // Actions
    startRecording,
    stopRecording,
    setAgendaFile,
    uploadAudioFile,
    uploadTranscriptFile,
    recoverSession,
    discardSession,
  };
}
