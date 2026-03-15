import { AlertTriangle, Clock, RefreshCw, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

/**
 * RecoveryBanner — shown when the app detects an interrupted recording
 * session in IndexedDB.  Offers the user two actions: recover or discard.
 */
export default function RecoveryBanner({ session, onRecover, onDiscard }) {
  if (!session) return null;

  const age = Date.now() - session.startedAt;
  const mins = Math.floor(age / 60_000);
  const when =
    mins < 1
      ? "just now"
      : mins < 60
        ? `${mins} min ago`
        : `${Math.floor(mins / 60)}h ${mins % 60}m ago`;

  const estimatedDuration = (session.chunkCount * 5) / 60; // ~5 s per chunk

  return (
    <motion.section 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-amber-900/30 backdrop-blur-xl border border-amber-500/30 rounded-2xl p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center gap-5 shadow-2xl relative overflow-hidden mb-6"
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      
      {/* Icon */}
      <div className="p-3 bg-amber-500/20 rounded-xl border border-amber-500/30 flex-shrink-0 relative z-10">
        <AlertTriangle className="w-6 h-6 text-amber-400" />
      </div>

      {/* Message */}
      <div className="flex-1 min-w-0 relative z-10">
        <h3 className="text-amber-100 font-semibold text-lg flex items-center gap-2">
          Unsaved Recording Found
        </h3>
        <div className="flex flex-wrap items-center gap-3 text-amber-300/80 text-sm mt-1.5 font-medium">
          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Started {when}</span>
          <span className="w-1 h-1 rounded-full bg-amber-500/50 hidden sm:block" />
          <span>{session.chunkCount} chunks (~{estimatedDuration.toFixed(1)} min)</span>
          {session.status === "recording" && (
            <>
              <span className="w-1 h-1 rounded-full bg-amber-500/50 hidden sm:block" />
              <span className="text-amber-400">Interrupted</span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 flex-shrink-0 w-full md:w-auto mt-2 md:mt-0 relative z-10 justify-end">
        <button
          onClick={() => onDiscard(session)}
          className="flex items-center gap-2 bg-gray-900/50 hover:bg-gray-800 text-gray-300 font-semibold px-4 py-2.5 rounded-xl border border-white/5 transition-colors text-sm"
        >
          <Trash2 className="w-4 h-4" />
          <span className="hidden sm:inline">Discard</span>
        </button>
        <button
          onClick={() => onRecover(session)}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-amber-900/50 transition-colors border border-amber-500 text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Recover &amp; Upload
        </button>
      </div>
    </motion.section>
  );
}
