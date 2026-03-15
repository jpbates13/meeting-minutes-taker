import { CheckCircle2, Loader2, Circle, Activity } from "lucide-react";
import { motion } from "framer-motion";

/**
 * PipelineChecklist — shows the audio-processing pipeline as a vertical
 * checklist with live status indicators.
 */

// ── Component ─────────────────────────────────────────────────────────

export default function PipelineChecklist({ steps, message }) {
  if (!steps || steps.every((s) => s.status === "pending")) return null;

  return (
    <section className="bg-gray-900/60 backdrop-blur-xl rounded-2xl border border-indigo-500/20 p-6 md:p-8 shadow-2xl relative overflow-hidden mb-8">
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      
      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
          <Activity className="w-5 h-5 text-indigo-400" />
        </div>
        <h2 className="text-xl font-semibold text-white tracking-tight">Processing Pipeline</h2>
      </div>

      <ul className="space-y-4 relative z-10">
        {steps.map((step, idx) => (
          <motion.li 
            key={step.id} 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={`flex items-center gap-4 ${
              step.status === "completed" ? "opacity-60" : "opacity-100"
            }`}
          >
            {/* Status icon */}
            <div className="flex-shrink-0 flex items-center justify-center w-6 h-6">
              {step.status === "completed" && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              {step.status === "active" && <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />}
              {step.status === "pending" && <Circle className="w-3.5 h-3.5 text-gray-600" />}
            </div>

            {/* Label */}
            <span
              className={`text-[15px] ${
                step.status === "completed"
                  ? "text-gray-400 line-through decoration-gray-600"
                  : step.status === "active"
                    ? "text-white font-semibold"
                    : "text-gray-500 font-medium"
              }`}
            >
              {step.label}
            </span>
          </motion.li>
        ))}
      </ul>

      {/* Live detail message from backend */}
      {message && (
        <motion.div 
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl relative z-10 flex items-start gap-3"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 flex-shrink-0 animate-pulse" />
          <p className="text-sm font-medium text-indigo-200/80 leading-relaxed font-mono">{message}</p>
        </motion.div>
      )}
    </section>
  );
}
