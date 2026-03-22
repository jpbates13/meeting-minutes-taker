/**
 * API layer — meeting history.
 *
 * All calls that read or update past meeting records live here.
 */

import { API_URL } from "../config";

/**
 * Fetch all past meetings, sorted most-recent first.
 * @returns {Promise<Array>}
 */
export async function fetchMeetings() {
  const res = await fetch(`${API_URL}/meetings`);
  if (!res.ok) throw new Error(`Server ${res.status}`);
  return res.json();
}

/**
 * Fetch the full transcript and minutes for a single meeting.
 * @param {string} id  job_id
 * @returns {Promise<{job_id: string, transcript: string|null, minutes: string|null}>}
 */
export async function fetchMeeting(id) {
  const res = await fetch(`${API_URL}/meetings/${id}`);
  if (!res.ok) throw new Error(`Server ${res.status}`);
  return res.json();
}

/**
 * Update editable fields for a meeting (currently only `title`).
 * @param {string} id    job_id
 * @param {object} patch e.g. { title: "Board Meeting #12" }
 * @returns {Promise<{ok: boolean}>}
 */
export async function patchMeeting(id, patch) {
  const res = await fetch(`${API_URL}/meetings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Server ${res.status}`);
  return res.json();
}

/**
 * Save manually edited minutes for a meeting.
 * @param {string} id       job_id
 * @param {string} minutes  updated minutes markdown/text
 * @returns {Promise<{ok: boolean}>}
 */
export async function patchMeetingMinutes(id, minutes) {
  const res = await fetch(`${API_URL}/meetings/${id}/minutes`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ minutes }),
  });
  if (!res.ok) throw new Error(`Server ${res.status}`);
  return res.json();
}

/**
 * Finalize a meeting: mark as human-reviewed and permanently purge raw files.
 * @param {string} id  job_id
 * @returns {Promise<{ok: boolean, purged_files: string[]}>}
 */
export async function finalizeMinutes(id) {
  const res = await fetch(`${API_URL}/meetings/${id}/finalize`, {
    method: "POST",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Server ${res.status}`);
  }
  return res.json();
}
