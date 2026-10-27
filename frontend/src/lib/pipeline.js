/**
 * Pipeline step model for the PipelineChecklist.
 *
 * The backend reports fine-grained steps (see STEP_MESSAGES in
 * backend/config.py); these helpers map them onto a short list of UI steps
 * and advance their pending → active → completed status.
 */

const AUDIO_STEPS = [
  { id: "preprocess", label: "Prepare audio" },
  { id: "transcribe", label: "Transcribe speech" },
  { id: "align", label: "Align timestamps" },
  { id: "diarize", label: "Identify speakers" },
  { id: "minutes", label: "Generate minutes" },
];

const TRANSCRIPT_ONLY_STEPS = [
  { id: "read", label: "Read transcript" },
  { id: "minutes", label: "Generate minutes" },
];

// Backend step → UI step id.
const STEP_MAP = {
  starting: "preprocess",
  preprocessing: "preprocess",
  noise_reduction: "preprocess",
  preprocessing_done: "preprocess",
  loading_model: "transcribe",
  transcribing: "transcribe",
  vad: "transcribe",
  transcription_done: "transcribe",
  aligning: "align",
  diarizing: "diarize",
  diarization_done: "diarize",
  formatting: "diarize",
  done: "diarize",
  reading_transcript: "read",
  generating_minutes: "minutes",
  loading_local_llm: "minutes",
  generating_minutes_local: "minutes",
};

const withStatus = (steps) => steps.map((s) => ({ ...s, status: "pending" }));

export const buildInitialSteps = () => withStatus(AUDIO_STEPS);

export const buildTranscriptOnlySteps = () => withStatus(TRANSCRIPT_ONLY_STEPS);

export const resolveUIStep = (backendStep) => STEP_MAP[backendStep] ?? null;

/** Mark every step before *stepId* completed and *stepId* active. */
export function advanceTo(steps, stepId) {
  const idx = steps.findIndex((s) => s.id === stepId);
  if (idx === -1) return steps;
  return steps.map((s, i) => ({
    ...s,
    status: i < idx ? "completed" : i === idx ? "active" : s.status === "completed" ? "completed" : "pending",
  }));
}

export const markAllCompleted = (steps) => steps.map((s) => ({ ...s, status: "completed" }));
