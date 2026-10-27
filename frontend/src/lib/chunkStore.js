/**
 * chunkStore — crash-safe recording storage in IndexedDB.
 *
 * Each MediaRecorder timeslice is written as it arrives, so a closed tab or a
 * crashed browser loses at most one chunk. A session is
 *   { id, mimeType, startedAt, status: "recording" | "stopped" | "uploaded", chunkCount }
 * and is recoverable until it has been uploaded.
 */

const DB_NAME = "meeting-recorder";
const DB_VERSION = 1;
const SESSIONS = "sessions";
const CHUNKS = "chunks";
const PURGE_EMPTY_AFTER_MS = 24 * 60 * 60 * 1000;

let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(SESSIONS)) db.createObjectStore(SESSIONS, { keyPath: "id" });
        if (!db.objectStoreNames.contains(CHUNKS)) {
          db.createObjectStore(CHUNKS, { keyPath: ["sessionId", "index"] }).createIndex("sessionId", "sessionId");
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

const done = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

async function tx(stores, mode, fn) {
  const db = await openDb();
  const t = db.transaction(stores, mode);
  const result = await fn(t);
  await new Promise((resolve, reject) => {
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
  return result;
}

async function updateSession(id, changes) {
  return tx([SESSIONS], "readwrite", async (t) => {
    const store = t.objectStore(SESSIONS);
    const session = await done(store.get(id));
    if (session) store.put({ ...session, ...changes });
  });
}

export function createSession(id, mimeType) {
  return tx([SESSIONS], "readwrite", (t) =>
    done(t.objectStore(SESSIONS).put({ id, mimeType, startedAt: Date.now(), status: "recording", chunkCount: 0 })),
  );
}

export function storeChunk(sessionId, index, blob) {
  return tx([SESSIONS, CHUNKS], "readwrite", async (t) => {
    t.objectStore(CHUNKS).put({ sessionId, index, blob });
    const sessions = t.objectStore(SESSIONS);
    const session = await done(sessions.get(sessionId));
    if (session) sessions.put({ ...session, chunkCount: Math.max(session.chunkCount, index + 1) });
  });
}

export const markSessionStopped = (id) => updateSession(id, { status: "stopped", stoppedAt: Date.now() });

export const markSessionUploaded = (id) => updateSession(id, { status: "uploaded", uploadedAt: Date.now() });

/** Concatenate a session's chunks, in order, into one Blob. */
export async function assembleSession(id) {
  return tx([SESSIONS, CHUNKS], "readonly", async (t) => {
    const session = await done(t.objectStore(SESSIONS).get(id));
    if (!session) throw new Error(`Recording session ${id} not found`);
    const chunks = await done(t.objectStore(CHUNKS).index("sessionId").getAll(id));
    chunks.sort((a, b) => a.index - b.index);
    const mimeType = session.mimeType || chunks[0]?.blob.type || "audio/webm";
    return { blob: new Blob(chunks.map((c) => c.blob), { type: mimeType }), mimeType, chunkCount: chunks.length };
  });
}

/** Sessions that were never uploaded and still hold audio. */
export async function getRecoverableSessions() {
  const sessions = await tx([SESSIONS], "readonly", (t) => done(t.objectStore(SESSIONS).getAll()));
  return sessions.filter((s) => s.status !== "uploaded" && s.chunkCount > 0);
}

export function deleteSession(id) {
  return tx([SESSIONS, CHUNKS], "readwrite", async (t) => {
    t.objectStore(SESSIONS).delete(id);
    const chunks = t.objectStore(CHUNKS);
    const keys = await done(chunks.index("sessionId").getAllKeys(id));
    keys.forEach((key) => chunks.delete(key));
  });
}

/** Remove uploaded sessions and day-old empty ones. Unuploaded audio is kept until recovered or discarded. */
export async function purgeOldSessions() {
  const sessions = await tx([SESSIONS], "readonly", (t) => done(t.objectStore(SESSIONS).getAll()));
  const cutoff = Date.now() - PURGE_EMPTY_AFTER_MS;
  for (const s of sessions) {
    if (s.status === "uploaded" || (s.chunkCount === 0 && s.startedAt < cutoff)) await deleteSession(s.id);
  }
}
