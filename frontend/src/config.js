// ──────────────────────────────────────────────
// NOTE: Microphone access via getUserMedia requires a secure context.
// In this project we serve the frontend over HTTPS using Tailscale
// MagicDNS (e.g. https://macbook.tail12345.ts.net).  Accessing via
// plain HTTP or a raw IP will cause the browser to deny mic permissions.
// ──────────────────────────────────────────────

// Replace with the Tailscale IP / MagicDNS hostname of the backend machine,
// or leave as-is to auto-detect from the current browser location.
const BACKEND_HOST =
  import.meta.env.VITE_BACKEND_HOST || `${window.location.hostname}:8443`;

export const API_URL = `https://${BACKEND_HOST}`;
export const WS_URL = `wss://${BACKEND_HOST}`;
export const RECORDER_AUDIO_BITRATE_BPS = 128_000;
