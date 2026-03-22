import { useEffect, useState, useCallback, useRef } from "react";
import { fetchMeetings, fetchMeeting, patchMeeting } from "../api/meetings";
import { API_URL } from "../config";
import { Clock, ChevronDown, ChevronUp, Play, Square, Edit2, PlayCircle, X, Check, CheckCircle2, FileAudio, FileText, FileCode2, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function MeetingHistory({ onLoad }) {
  const [open, setOpen] = useState(false);
  const [meetings, setMeetings] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [loadingId, setLoadingId] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState(null);
  const editInputRef = useRef(null);

  const loadMeetings = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      setMeetings(await fetchMeetings());
    } catch (err) {
      console.error("Failed to fetch meetings:", err);
      setError("Could not load meeting history.");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadMeetings();
  }, [open, loadMeetings]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleLoad = async (meeting) => {
    setLoadingId(meeting.id);
    try {
      const data = await fetchMeeting(meeting.id);
      onLoad(
        data.transcript ?? "",
        data.minutes ?? "",
        meeting.id,
        Boolean(data.minutes_ai_generated),
        data.finalized_at ?? null,
      );
    } catch (err) {
      console.error("Failed to load meeting:", err);
    } finally {
      setLoadingId(null);
    }
  };

  const togglePlayer = (id) => {
    setPlayingId((prev) => (prev === id ? null : id));
  };

  const startEdit = (m) => {
    setEditingId(m.id);
    setEditTitle(m.title ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
  };

  const saveTitle = async (id) => {
    setSavingId(id);
    try {
      await patchMeeting(id, { title: editTitle });
      setMeetings((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, title: editTitle.trim() || null } : m
        )
      );
    } catch (err) {
      console.error("Failed to save title:", err);
    } finally {
      setSavingId(null);
      setEditingId(null);
      setEditTitle("");
    }
  };

  const handleTitleKeyDown = (e, id) => {
    if (e.key === "Enter") saveTitle(id);
    if (e.key === "Escape") cancelEdit();
  };

  function formatDate(iso) {
    if (!iso) return "Unknown date";
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <section className="bg-gray-900/40 backdrop-blur-xl border border-white/10 p-6 sm:p-8 rounded-2xl shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      
      {/* Header row */}
      <div 
        className="flex items-center justify-between cursor-pointer relative z-10 group"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg group-hover:bg-indigo-500/20 transition-colors">
            <Clock className="w-5 h-5 text-indigo-400" />
          </div>
          <h2 className="text-xl font-semibold text-white tracking-tight">Past Meetings</h2>
        </div>
        <button className="flex items-center gap-2 text-sm font-medium text-gray-400 group-hover:text-white transition-colors">
          {open ? (
            <>
              Hide
              <ChevronUp className="w-4 h-4" />
            </>
          ) : (
            <>
              Show
              <ChevronDown className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* Body */}
      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden mt-6 relative z-10"
          >
            {fetching && <div className="text-sm font-medium text-indigo-400 flex items-center gap-2"><div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /> Loading history...</div>}
            {error && <p className="text-sm text-red-400 font-medium">{error}</p>}
            {!fetching && !error && meetings.length === 0 && (
              <p className="text-sm text-gray-400 italic bg-white/5 py-4 px-6 rounded-xl border border-white/5 text-center">No completed meetings found.</p>
            )}

            {!fetching && meetings.length > 0 && (
              <ul className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                {meetings.map((m) => (
                  <motion.li 
                    key={m.id} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="bg-gray-800/40 hover:bg-gray-800/60 transition-colors border border-white/5 hover:border-white/10 rounded-xl overflow-hidden shadow-sm"
                  >
                    {/* Main row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4">
                      {/* Info / editable title */}
                      <div className="flex flex-col gap-2 min-w-0 flex-1">
                        {editingId === m.id ? (
                          /* ── Edit mode ── */
                          <div className="flex items-center gap-2">
                            <input
                              ref={editInputRef}
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              onKeyDown={(e) => handleTitleKeyDown(e, m.id)}
                              placeholder={formatDate(m.created_at)}
                              maxLength={120}
                              className="flex-1 min-w-0 bg-gray-900 border border-indigo-500/50 rounded-lg px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-medium shadow-inner"
                            />
                            <button
                              onClick={() => saveTitle(m.id)}
                              disabled={savingId === m.id}
                              title="Save"
                              className="p-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg disabled:opacity-50 transition-colors"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              title="Cancel"
                              className="p-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          /* ── Display mode ── */
                          <div className="flex items-center gap-2 min-w-0 group/title">
                            <span className="text-sm text-gray-100 font-semibold truncate leading-none">
                              {m.title || formatDate(m.created_at)}
                            </span>
                            {m.title && (
                              <span className="text-xs text-gray-500 truncate hidden sm:inline leading-none mt-0.5 font-medium">
                                — {formatDate(m.created_at)}
                              </span>
                            )}
                            <button
                              onClick={() => startEdit(m)}
                              title="Rename"
                              className="flex-shrink-0 text-gray-500 hover:text-indigo-400 opacity-0 group-hover/title:opacity-100 transition-all p-1"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {/* Badges */}
                        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider font-bold">
                          <span
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${
                              m.mode === "audio"
                                ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/20"
                                : "bg-amber-500/10 text-amber-300 border-amber-500/20"
                            }`}
                          >
                            {m.mode === "audio" ? <FileAudio className="w-3 h-3" /> : <FileCode2 className="w-3 h-3" />}
                            {m.mode === "audio" ? "Audio" : "Text"}
                          </span>
                          
                          {m.finalized_at ? (
                            <span className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-emerald-500/10 text-emerald-300 border-emerald-500/20">
                              <ShieldCheck className="w-3 h-3" />
                              Finalized
                            </span>
                          ) : (
                            <div className="flex items-center gap-2 text-gray-400 opacity-80">
                              {m.has_transcript && <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Trans</span>}
                              {m.has_minutes && <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Min</span>}
                              {m.has_agenda && <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-blue-400" /> Agd</span>}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3 flex-shrink-0 w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t border-white/5 sm:border-0 justify-end">
                        {m.has_audio && !m.finalized_at && (
                          <button
                            onClick={() => togglePlayer(m.id)}
                            title={playingId === m.id ? "Close player" : "Play recording"}
                            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
                              playingId === m.id
                                ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                                : "bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700"
                            }`}
                          >
                            {playingId === m.id ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            <span className="hidden sm:inline">{playingId === m.id ? "Close" : "Listen"}</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleLoad(m)}
                          disabled={loadingId === m.id}
                          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition shadow-lg shadow-indigo-500/20 disabled:shadow-none"
                        >
                          {loadingId === m.id ? "Loading…" : "Load Results"}
                        </button>
                      </div>
                    </div>

                    {/* Inline audio player */}
                    <AnimatePresence>
                      {playingId === m.id && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden bg-gray-950/30 border-t border-white/5"
                        >
                          <div className="px-4 py-3">
                            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                            <audio
                              controls
                              autoPlay
                              src={`${API_URL}/meetings/${m.id}/audio`}
                              className="w-full h-10 rounded-md"
                              style={{ accentColor: "#818cf8" }}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
