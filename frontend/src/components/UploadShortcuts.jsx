/**
 * UploadShortcuts — two file-upload shortcuts:
 *   1. Upload an existing audio file directly (skips live recording)
 *   2. Upload a plain-text transcript (skips Whisper/Pyannote entirely)
 */
import { useRef } from "react";
import { UploadCloud, FileAudio, FileText, FileCode2 } from "lucide-react";
import { motion } from "framer-motion";

export default function UploadShortcuts({
  isRecording,
  onUploadAudio,
  onUploadTranscript,
}) {
  const transcriptAgendaRef = useRef(null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Audio file upload */}
      <motion.section 
        whileHover={{ y: -2 }}
        className="bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-white/10 p-8 shadow-2xl relative overflow-hidden flex flex-col"
      >
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-3 mb-6 relative z-10">
          <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <FileAudio className="text-emerald-400 w-5 h-5" />
          </div>
          <h2 className="text-xl font-semibold text-white tracking-tight">Upload Audio</h2>
        </div>
        
        <p className="text-sm text-gray-400 mb-6 relative z-10">
          Have an existing recording? Upload an audio file to generate a transcript and meeting minutes.
        </p>

        <div className="relative group mt-auto relative z-10 w-full">
          <input
            type="file"
            accept="audio/*"
            disabled={isRecording}
            onChange={(e) => {
              const file = e.target.files[0];
              if (file) onUploadAudio(file);
              e.target.value = null; // allow re-uploading the same file
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
          />
          <div className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl transition-all ${
            isRecording 
              ? 'border-gray-800 bg-gray-900/50 opacity-50' 
              : 'border-gray-700 bg-gray-800/30 group-hover:bg-emerald-500/5 group-hover:border-emerald-500/50'
          }`}>
            <UploadCloud className={`w-10 h-10 mb-3 ${isRecording ? 'text-gray-600' : 'text-emerald-500'}`} />
            <span className="text-sm font-medium text-gray-300">Click or drag audio file</span>
            <span className="text-xs text-gray-500 mt-1">MP3, WAV, M4A up to 50MB</span>
          </div>
        </div>
      </motion.section>

      {/* Transcript upload */}
      <motion.section 
        whileHover={{ y: -2 }}
        className="bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-white/10 p-8 shadow-2xl relative overflow-hidden flex flex-col"
      >
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center justify-between mb-6 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <FileCode2 className="text-amber-400 w-5 h-5" />
            </div>
            <h2 className="text-xl font-semibold text-white tracking-tight">Upload Transcript</h2>
          </div>
          <span className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-md text-[10px] uppercase font-bold text-gray-400 tracking-wider">
            Shortcut
          </span>
        </div>
        
        <p className="text-sm text-gray-400 mb-6 relative z-10">
          Already have a processed transcript? Upload it as a plain-text file to skip the audio transcription pipeline entirely.
        </p>

        <div className="space-y-4 mt-auto relative z-10 w-full">
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
              <FileText className="w-3.5 h-3.5" /> Agenda (Optional)
            </label>
            <div className="relative group">
              <input
                type="file"
                accept=".txt,.pdf,.md,.docx"
                onChange={(e) => {
                  transcriptAgendaRef.current = e.target.files[0] || null;
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="flex items-center justify-between px-3 py-2.5 bg-gray-800/40 border border-gray-700 rounded-lg group-hover:bg-gray-800 group-hover:border-amber-500/30 transition-all text-sm">
                <span className="text-gray-400 truncate">Select agenda file...</span>
                <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[10px] uppercase font-bold text-gray-400">Browse</span>
              </div>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
              <FileCode2 className="w-3.5 h-3.5" /> Transcript File (.txt)
            </label>
            <div className="relative group">
              <input
                type="file"
                accept=".txt"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) onUploadTranscript(file, transcriptAgendaRef.current);
                  e.target.value = null;
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="flex items-center justify-center gap-2 py-3 bg-amber-600/20 border border-amber-500/30 text-amber-300 rounded-lg group-hover:bg-amber-600/30 transition-all text-sm font-medium">
                <UploadCloud className="w-4 h-4" />
                Select Transcript File
              </div>
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
