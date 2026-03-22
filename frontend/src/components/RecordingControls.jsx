/**
 * RecordingControls — Record / Pause / Stop buttons, live status indicator,
 * "Off the Record" banner, agenda file input, and the waveform canvas.
 */
import { Mic, Square, Save, FileText, Activity, Pause, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function RecordingControls({
  isRecording,
  isPaused,
  elapsedFormatted,
  savedChunks,
  canvasRef,
  onStart,
  onStop,
  onTogglePause,
  onAgendaChange,
}) {
  return (
    <section className="bg-gray-900/40 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* ─── OFF THE RECORD Banner ─── */}
      <AnimatePresence>
        {isPaused && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="relative z-20 overflow-hidden"
          >
            <div className="flex items-center justify-center gap-3 bg-amber-500/15 border border-amber-500/30 rounded-xl px-6 py-4 shadow-lg shadow-amber-500/10">
              <span className="paused-pulse w-3 h-3 rounded-full bg-amber-400 block" />
              <span className="text-amber-300 font-bold text-base tracking-wide">
                ⏸️ OFF THE RECORD — Audio capture suspended.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-3 mb-8 relative z-10">
        <div className={`p-2 border rounded-lg transition-colors duration-300 ${
          isPaused
            ? "bg-amber-500/10 border-amber-500/20"
            : "bg-rose-500/10 border-rose-500/20"
        }`}>
          <Mic className={`w-5 h-5 transition-colors duration-300 ${
            isPaused ? "text-amber-400" : "text-rose-400"
          }`} />
        </div>
        <h2 className="text-xl font-semibold text-white tracking-tight">Record Meeting</h2>
      </div>

      <div className="flex flex-col md:flex-row md:items-end gap-6 relative z-10">
        {/* Record / Pause / Stop buttons */}
        <div className="flex flex-wrap gap-4">
          <motion.button
            whileHover={{ scale: isRecording ? 1 : 1.02 }}
            whileTap={{ scale: isRecording ? 1 : 0.98 }}
            onClick={onStart}
            disabled={isRecording}
            className="group relative flex items-center justify-center gap-2.5 bg-rose-600 hover:bg-rose-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-xl transition-colors shadow-lg shadow-rose-500/20 disabled:shadow-none min-w-[140px]"
          >
            {isRecording ? (
              <span className={`w-3 h-3 rounded-full block ${
                isPaused ? "paused-pulse bg-amber-400" : "recording-pulse bg-rose-400"
              }`} />
            ) : (
              <Mic className="w-4 h-4" />
            )}
            Start Record
          </motion.button>

          {/* Off the Record / Resume toggle */}
          <motion.button
            whileHover={{ scale: !isRecording ? 1 : 1.02 }}
            whileTap={{ scale: !isRecording ? 1 : 0.98 }}
            onClick={onTogglePause}
            disabled={!isRecording}
            id="off-the-record-btn"
            className={`flex items-center justify-center gap-2.5 font-medium px-6 py-3 rounded-xl transition-all min-w-[180px] border ${
              !isRecording
                ? "bg-gray-900/50 text-gray-600 cursor-not-allowed border-transparent"
                : isPaused
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/30 shadow-lg shadow-emerald-500/20"
                  : "bg-amber-600 hover:bg-amber-500 text-white border-amber-500/30 shadow-lg shadow-amber-500/20"
            }`}
          >
            {isPaused ? (
              <>
                <Play className="w-4 h-4" />
                Resume
              </>
            ) : (
              <>
                <Pause className="w-4 h-4" />
                Off the Record
              </>
            )}
          </motion.button>

          <motion.button
            whileHover={{ scale: !isRecording ? 1 : 1.02 }}
            whileTap={{ scale: !isRecording ? 1 : 0.98 }}
            onClick={onStop}
            disabled={!isRecording}
            className="flex items-center justify-center gap-2.5 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900/50 disabled:text-gray-600 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-xl transition-colors border border-white/5 disabled:border-transparent min-w-[120px]"
          >
            <Square className="w-4 h-4" />
            Stop
          </motion.button>
        </div>

        {/* Live recording indicator */}
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex flex-wrap items-center gap-3 text-sm font-medium py-2 px-4 rounded-xl border transition-colors duration-300 ${
              isPaused
                ? "bg-amber-950/40 border-amber-500/20"
                : "bg-black/40 border-white/5"
            }`}
          >
            <div className={`flex items-center gap-2.5 transition-colors duration-300 ${
              isPaused ? "text-amber-400" : "text-rose-400"
            }`}>
              <span className={`w-2 h-2 rounded-full inline-block ${
                isPaused
                  ? "paused-pulse bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]"
                  : "recording-pulse bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]"
              }`} />
              {isPaused ? "PAUSED" : "Recording…"}
              <span className={`tabular-nums font-mono px-2 py-0.5 rounded transition-colors duration-300 ${
                isPaused
                  ? "bg-amber-500/10 text-amber-300"
                  : "bg-rose-500/10 text-rose-300"
              }`}>{elapsedFormatted}</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-gray-700" />
            <div
              className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded"
              title="Audio chunks saved to local storage (IndexedDB)"
            >
              <Save className="w-3.5 h-3.5 opacity-80" />
              <span className="tabular-nums font-mono">{savedChunks}</span>
              <span className="text-emerald-500/70 text-xs uppercase tracking-wider">chunks</span>
            </div>
          </motion.div>
        )}

        {/* Agenda file upload */}
        <div className="ml-auto w-full md:w-auto mt-4 md:mt-0">
          <label className="flex items-center gap-2 text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
            <FileText className="w-3.5 h-3.5" />
            Agenda Document (optional)
          </label>
          <div className="relative group">
            <input
              type="file"
              accept=".txt,.pdf,.md,.docx"
              onChange={(e) => onAgendaChange(e.target.files[0] || null)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800/40 border border-gray-700 rounded-xl group-hover:bg-gray-700 group-hover:border-indigo-500/50 transition-all text-sm text-gray-300 min-w-[240px]">
              <span className="truncate max-w-[150px]">Choose an agenda file...</span>
              <span className="bg-white/5 border border-white/10 px-2 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider text-gray-400">Browse</span>
            </div>
          </div>
        </div>
      </div>

      {/* Waveform canvas */}
      <div className="mt-8 relative z-10">
        <label className="flex items-center gap-2 text-xs font-medium text-gray-400 mb-3 uppercase tracking-wide">
          <Activity className="w-3.5 h-3.5" /> Live Audio Monitor
        </label>
        <div className={`p-1 rounded-xl border shadow-inner transition-colors duration-300 ${
          isPaused
            ? "bg-amber-950/30 border-amber-500/10"
            : "bg-gray-950/80 border-white/5"
        }`}>
          <canvas
            ref={canvasRef}
            className={`w-full h-24 rounded-lg transition-opacity duration-300 ${
              isPaused ? "opacity-40" : "opacity-80"
            }`}
          />
        </div>
      </div>
    </section>
  );
}
