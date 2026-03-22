import { useEffect, useState } from "react";
import { Mic, Upload, Clock, Activity, Cpu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import useRecorder from "./hooks/useRecorder";
import RecordingControls from "./components/RecordingControls";
import UploadShortcuts from "./components/UploadShortcuts";
import OutputPanels from "./components/OutputPanels";
import PipelineChecklist from "./components/PipelineChecklist";
import RecoveryBanner from "./components/RecoveryBanner";
import MeetingHistory from "./components/MeetingHistory";
import ProfileSelector from "./components/ProfileSelector";

export default function App() {
  const [selectedProfileId, setSelectedProfileId] = useState("general");
  const [useLocalLlm, setUseLocalLlm] = useState(false);
  const [activeTab, setActiveTab] = useState("record");

  const {
    isRecording,
    isPaused,
    elapsedFormatted,
    savedChunks,
    status,
    transcript,
    minutes,
    minutesAiGenerated,
    isFinalized,
    jobId,
    pipelineSteps,
    pipelineMessage,
    startRecording,
    stopRecording,
    togglePause,
    setAgendaFile,
    uploadAudioFile,
    uploadTranscriptFile,
    loadMeeting,
    saveMinutes,
    finalizeMinutes,
    clearMeeting,
    canvasRef,
    clearCanvas,
    recoverableSession,
    recoverSession,
    discardSession,
  } = useRecorder();

  // Initialize the waveform canvas background on mount
  useEffect(() => {
    clearCanvas();
  }, [clearCanvas]);

  const tabs = [
    { id: "record", label: "Record", icon: Mic },
    { id: "upload", label: "Upload", icon: Upload },
    { id: "history", label: "History", icon: Clock },
  ];

  const isOutputView = Boolean(transcript || minutes);

  if (isOutputView) {
    return (
      <div className="bg-gray-950 text-gray-100 min-h-screen flex flex-col font-sans selection:bg-indigo-500/30">
        <main className="flex-1 w-full flex flex-col relative h-screen">
          <OutputPanels
            transcript={transcript || ""}
            minutes={minutes || ""}
            minutesAiGenerated={minutesAiGenerated}
            isFinalized={isFinalized}
            jobId={jobId}
            onSaveMinutes={saveMinutes}
            onFinalizeMinutes={finalizeMinutes}
            onClose={clearMeeting}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="bg-gray-950 text-gray-100 min-h-screen flex flex-col font-sans selection:bg-indigo-500/30">
      {/* ─── Header ─── */}
      <header className="bg-gray-900/80 backdrop-blur-md border-b border-white/5 px-6 py-4 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
              <Activity className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Meeting Minutes
              </h1>
              <p className="text-xs text-gray-400 mt-0.5 font-medium">
                Record, transcribe, and summarize
              </p>
            </div>
          </div>
          
          <div className="flex bg-gray-950/50 p-1.5 rounded-xl border border-white/5 shadow-inner">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 relative ${
                    isActive
                      ? "text-white"
                      : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="active-tab"
                      className="absolute inset-0 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/25"
                      initial={false}
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 space-y-8 relative">
        <RecoveryBanner
          session={recoverableSession}
          onRecover={recoverSession}
          onDiscard={discardSession}
        />

        {/* Global Pipeline Checklist */}
        {(pipelineMessage || pipelineSteps.some(s => s.status !== "idle")) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8"
          >
            <PipelineChecklist steps={pipelineSteps} message={pipelineMessage} />
          </motion.div>
        )}

        <div className="text-sm text-gray-500 text-center font-medium">{status}</div>

        <ProfileSelector
          selectedProfileId={selectedProfileId}
          onSelectProfile={setSelectedProfileId}
        />

        {/* Local LLM Toggle */}
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-3 bg-gray-900/60 backdrop-blur-sm px-5 py-3 rounded-xl border border-white/5">
            <Cpu className={`w-4 h-4 transition-colors ${useLocalLlm ? 'text-violet-400' : 'text-gray-500'}`} />
            <button
              id="local-llm-toggle"
              type="button"
              role="switch"
              aria-checked={useLocalLlm}
              onClick={() => setUseLocalLlm((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 ${
                useLocalLlm ? 'bg-violet-600' : 'bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${
                  useLocalLlm ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <div className="flex flex-col">
              <span className={`text-sm font-medium transition-colors ${useLocalLlm ? 'text-white' : 'text-gray-400'}`}>
                Use Local LLM
              </span>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                Zero Cost · High Privacy
              </span>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="mt-8 relative min-h-[400px]">
          <AnimatePresence mode="wait">
            {activeTab === "record" && (
              <motion.div
                key="record"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="space-y-8 absolute inset-x-0 top-0"
              >
                <RecordingControls
                  isRecording={isRecording}
                  isPaused={isPaused}
                  elapsedFormatted={elapsedFormatted}
                  savedChunks={savedChunks}
                  canvasRef={canvasRef}
                  onStart={() => startRecording(selectedProfileId, useLocalLlm)}
                  onStop={stopRecording}
                  onTogglePause={togglePause}
                  onAgendaChange={setAgendaFile}
                />
              </motion.div>
            )}

            {activeTab === "upload" && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="space-y-8 absolute inset-x-0 top-0"
              >
                <UploadShortcuts
                  isRecording={isRecording}
                  useLocalLlm={useLocalLlm}
                  onUploadAudio={(file) => uploadAudioFile(file, selectedProfileId, useLocalLlm)}
                  onUploadTranscript={(file, agenda) =>
                    uploadTranscriptFile(file, agenda, selectedProfileId, useLocalLlm)
                  }
                />
              </motion.div>
            )}

            {activeTab === "history" && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="space-y-8 absolute inset-x-0 top-0"
              >
                <MeetingHistory onLoad={loadMeeting} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* ─── Footer ─── */}
      <footer className="text-center text-xs text-gray-500 py-6 border-t border-white/5 mt-auto bg-gray-900/30">
        Meeting Minutes Generator &copy; {new Date().getFullYear()} — Generic mode by default. Customize with meeting profiles.
      </footer>
    </div>
  );
}
