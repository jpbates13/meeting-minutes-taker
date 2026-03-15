/**
 * usePipeline — WebSocket-driven pipeline state.
 *
 * Call ``connect(jobId, wsPath, initialSteps)`` to open a WebSocket to
 * the backend and start streaming progress updates.  All output state
 * (transcript, minutes, status, pipeline steps) lives here.
 */

import { useState, useCallback } from "react";
import { WS_URL } from "../config";
import { patchMeetingMinutes } from "../api/meetings";
import {
  buildInitialSteps,
  advanceTo,
  markAllCompleted,
  resolveUIStep,
} from "../lib/pipeline";

export default function usePipeline() {
  const [pipelineSteps, setPipelineSteps] = useState([]);
  const [pipelineMessage, setPipelineMessage] = useState("");
  const [status, setStatus] = useState("Ready");
  const [transcript, setTranscript] = useState("");
  const [minutes, setMinutes] = useState("");
  const [minutesAiGenerated, setMinutesAiGenerated] = useState(false);
  const [jobId, setJobId] = useState(null);

  /** Reset all output state (call before starting a new job). */
  const resetOutput = useCallback(() => {
    setTranscript("");
    setMinutes("");
    setMinutesAiGenerated(false);
    setPipelineSteps([]);
    setPipelineMessage("");
    setJobId(null);
  }, []);

  /**
   * Open a WebSocket to ``/${wsPath}/${jobId}`` and stream progress into state.
   *
   * @param {string}      jobId
   * @param {string}      wsPath       "ws" for audio jobs, "ws-transcript" for transcript-only
   * @param {Array|null}  initialSteps Override the default step list
   */
  const connect = useCallback((jobId, wsPath = "ws", initialSteps = null) => {
    const wsUrl = `${WS_URL}/${wsPath}/${jobId}`;
    console.log("Opening WebSocket:", wsUrl);
    setStatus("Connecting to processing pipeline…");
    setPipelineSteps(initialSteps ?? buildInitialSteps());
    setPipelineMessage("");
    setJobId(jobId); // Store jobId for export functionality
    setMinutesAiGenerated(true);

    const ws = new WebSocket(wsUrl);

    ws.addEventListener("open", () => {
      console.log("WebSocket connected");
      setStatus("Connected — processing…");
    });

    ws.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log("WS message:", msg);

        switch (msg.status) {
          case "processing": {
            const uiStep = resolveUIStep(msg.step);
            if (uiStep) setPipelineSteps((prev) => advanceTo(prev, uiStep));
            setPipelineMessage(msg.message || "");
            setStatus(msg.message || "Processing…");
            break;
          }
          case "transcript_complete":
            setTranscript(msg.text);
            setStatus("Transcript ready — generating minutes…");
            break;
          case "minutes_chunk":
            setMinutes((prev) => prev + msg.text);
            break;
          case "complete":
            setPipelineSteps((prev) => markAllCompleted(prev));
            setPipelineMessage("");
            setStatus("Processing complete.");
            break;
          case "error":
            setPipelineMessage("");
            setStatus(`⚠ Error: ${msg.message}`);
            break;
          default:
            console.warn("Unknown WS status:", msg.status);
        }
      } catch (err) {
        console.error("Failed to parse WS message:", err);
      }
    });

    ws.addEventListener("close", (event) => {
      console.log("WebSocket closed:", event.code, event.reason);
      if (event.code !== 1000) setStatus("Connection closed.");
    });

    ws.addEventListener("error", () => {
      setStatus("⚠ WebSocket connection error.");
    });
  }, []);

  /** Load a past meeting's output directly into state (no WebSocket needed). */
  const loadMeeting = useCallback(
    (
      newTranscript,
      newMinutes,
      jobId = null,
      newMinutesAiGenerated = false,
    ) => {
    setTranscript(newTranscript);
    setMinutes(newMinutes);
    setMinutesAiGenerated(newMinutesAiGenerated);
    setPipelineSteps([]);
    setPipelineMessage("");
    setStatus("Loaded past meeting.");
    // Store the current jobId for export functionality
    setJobId(jobId);
    },
    [],
  );

  const saveMinutes = useCallback(
    async (updatedMinutes) => {
      if (!jobId) throw new Error("No meeting selected.");
      await patchMeetingMinutes(jobId, updatedMinutes);
      setMinutes(updatedMinutes);
      setMinutesAiGenerated(false);
    },
    [jobId],
  );

  return {
    pipelineSteps,
    pipelineMessage,
    status,
    setStatus,
    transcript,
    minutes,
    minutesAiGenerated,
    jobId,
    connect,
    loadMeeting,
    saveMinutes,
    resetOutput,
  };
}
