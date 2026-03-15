/**
 * RecordingControls — Record/Stop buttons, live status indicator, agenda
 * file input, and the waveform canvas.
 */
import { Mic, Square, Save, FileText } from "lucide-react";
import { motion } from "framer-motion";

export default function RecordingControls({
  isRecording,
  elapsedFormatted,
  savedChunks,
  canvasRef,
  onStart,
  onStop,
  onAgendaChange,
}) {
  return (
    <section className="bg-gray-900/40 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="flex items-center gap-3 mb-8 relative z-10">
        <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg">
          <Mic className="text-rose-400 w-5 h-5" />
        </div>
        <h2 className="text-xl font-semibold text-white tracking-tight">Record Meeting</h2>
      </div>

      <div className="flex flex-col md:flex-row md:items-end gap-6 relative z-10">
        {/* Record / Stop buttons */}
        <div className="flex flex-wrap gap-4">
          <motion.button
            whileHover={{ scale: isRecording ? 1 : 1.02 }}
            whileTap={{ scale: isRecording ? 1 : 0.98 }}
            onClick={onStart}
            disabled={isRecording}
            className="group relative flex items-center justify-center gap-2.5 bg-rose-600 hover:bg-rose-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-xl transition-colors shadow-lg shadow-rose-500/20 disabled:shadow-none min-w-[140px]"
          >
            {isRecording ? (
              <span className="recording-pulse w-3 h-3 rounded-full bg-rose-400 block" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
            Start Record
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
            className="flex flex-wrap items-center gap-3 text-sm font-medium bg-black/40 py-2 px-4 rounded-xl border border-white/5"
          >
            <div className="flex items-center gap-2.5 text-rose-400">
              <span className="recording-pulse w-2 h-2 rounded-full bg-rose-500 inline-block shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
              Recording…
              <span className="tabular-nums font-mono bg-rose-500/10 px-2 py-0.5 rounded text-rose-300">{elapsedFormatted}</span>
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
        <div className="p-1 bg-gray-950/80 rounded-xl border border-white/5 shadow-inner">
          <canvas
            ref={canvasRef}
            className="w-full h-24 rounded-lg opacity-80"
          />
        </div>
      </div>
    </section>
  );
}

// Ensure Activity is imported
import { Activity } from "lucide-react";
