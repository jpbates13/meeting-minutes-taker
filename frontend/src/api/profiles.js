import { API_URL } from "../config";

export async function fetchProfiles() {
  const res = await fetch(`${API_URL}/profiles`);
  if (!res.ok) throw new Error(`Server ${res.status}`);
  return res.json();
}

export async function createProfile(payload) {
  const res = await fetch(`${API_URL}/profiles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Server ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function updateProfile(profileId, payload) {
  const res = await fetch(`${API_URL}/profiles/${profileId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Server ${res.status}: ${await res.text()}`);
  return res.json();
}
