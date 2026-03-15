/**
 * API layer — job creation.
 *
 * All calls that create a new processing job live here.  Each function
 * returns the server-assigned ``job_id`` string on success, or throws an
 * Error with a human-readable message on failure.
 */

import { API_URL } from "../config";

/**
 * Upload a raw audio Blob (e.g. assembled from IndexedDB chunks).
 *
 * @param {Blob}   blob       The audio data.
 * @param {string} filename   e.g. "recording.webm"
 * @param {File|null} agendaFile  Optional agenda file.
 * @returns {Promise<string>} job_id
 */
export async function postAudio(
  blob,
  filename,
  agendaFile = null,
  profileId = "general",
) {
  const body = new FormData();
  body.append("audio", blob, filename);
  if (agendaFile) body.append("agenda", agendaFile, agendaFile.name);
  body.append("profile_id", profileId);

  const res = await fetch(`${API_URL}/upload`, { method: "POST", body });
  if (!res.ok) throw new Error(`Server responded ${res.status}: ${await res.text()}`);

  const data = await res.json();
  return data.job_id;
}

/**
 * Upload an audio File object chosen by the user (file-picker).
 *
 * @param {File}      file        The audio file.
 * @param {File|null} agendaFile  Optional agenda file.
 * @returns {Promise<string>} job_id
 */
export async function postAudioFile(file, agendaFile = null, profileId = "general") {
  return postAudio(file, file.name, agendaFile, profileId);
}

/**
 * Upload a plain-text transcript file (skips the audio pipeline).
 *
 * @param {File}      transcriptFile  A .txt transcript.
 * @param {File|null} agendaFile      Optional agenda file.
 * @returns {Promise<string>} job_id
 */
export async function postTranscript(
  transcriptFile,
  agendaFile = null,
  profileId = "general",
) {
  const body = new FormData();
  body.append("transcript", transcriptFile, transcriptFile.name);
  if (agendaFile) body.append("agenda", agendaFile, agendaFile.name);
  body.append("profile_id", profileId);

  const res = await fetch(`${API_URL}/upload-transcript`, { method: "POST", body });
  if (!res.ok) throw new Error(`Server responded ${res.status}: ${await res.text()}`);

  const data = await res.json();
  return data.job_id;
}
