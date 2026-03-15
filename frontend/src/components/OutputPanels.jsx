import { API_URL } from "../config";
import { useEffect, useRef, useState } from "react";
import { FileText, Download, CheckCircle2, FileCode2, Edit3, X, Save, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatInline(text) {
  return text
    .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded-md bg-gray-800/80 border border-gray-700 text-indigo-300 font-mono text-[0.85em]">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em class="text-gray-300 italic">$1</em>');
}

function markdownToHtml(markdownText) {
  const lines = markdownText.split("\n");
  const html = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      html.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      html.push("</ol>");
      inOl = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      closeLists();
      html.push('<div class="h-4"></div>');
      continue;
    }

    const escaped = formatInline(escapeHtml(line));

    if (line.startsWith("### ")) {
      closeLists();
      html.push(`<h3 class="text-base font-semibold text-white mt-6 mb-3 flex items-center gap-2"><div class="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>${formatInline(escapeHtml(line.slice(4)))}</h3>`);
      continue;
    }

    if (line.startsWith("## ")) {
      closeLists();
      html.push(`<h2 class="text-lg font-bold text-white mt-8 mb-4 border-b border-gray-800 pb-2">${formatInline(escapeHtml(line.slice(3)))}</h2>`);
      continue;
    }

    if (line.startsWith("# ")) {
      closeLists();
      html.push(`<h1 class="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 mt-8 mb-6">${formatInline(escapeHtml(line.slice(2)))}</h1>`);
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      if (inOl) {
        html.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        html.push('<ul class="list-none pl-2 space-y-2 text-gray-300 my-4">');
        inUl = true;
      }
      html.push(`<li class="flex items-start gap-3"><span class="text-indigo-400 mt-1 flex-shrink-0">•</span><span>${formatInline(escapeHtml(line.slice(2)))}</span></li>`);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      if (inUl) {
        html.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        html.push('<ol class="list-decimal pl-6 space-y-2 text-gray-300 marker:text-indigo-400 marker:font-medium my-4">');
        inOl = true;
      }
      html.push(`<li class="pl-1">${escaped.replace(/^\d+\.\s+/, "")}</li>`);
      continue;
    }

    closeLists();
    html.push(`<p class="text-gray-300 leading-relaxed">${escaped}</p>`);
  }

  closeLists();
  return html.join("\n");
}

export default function OutputPanels({
  transcript,
  minutes,
  minutesAiGenerated = false,
  jobId,
  onSaveMinutes,
  onClose,
}) {
  const [isEditingMinutes, setIsEditingMinutes] = useState(false);
  const [draftMinutes, setDraftMinutes] = useState(minutes);
  const [isSavingMinutes, setIsSavingMinutes] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [editorTab, setEditorTab] = useState("write");
  const minutesEditorRef = useRef(null);

  useEffect(() => {
    if (!isEditingMinutes) {
      setDraftMinutes(minutes);
    }
  }, [minutes, isEditingMinutes]);

  useEffect(() => {
    if (!isEditingMinutes) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isEditingMinutes]);
  
  const handleExportTranscript = async () => {
    if (!jobId) return;
    try {
      const response = await fetch(`${API_URL}/meetings/${jobId}/export/transcript`);
      if (!response.ok) throw new Error(`Export failed: ${response.statusText}`);
      
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'transcript.pdf';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename=(.+)/);
        if (filenameMatch) filename = filenameMatch[1];
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export transcript:', error);
      alert('Failed to export transcript. Please try again.');
    }
  };

  const handleExportMinutes = async () => {
    if (!jobId) return;
    try {
      const response = await fetch(`${API_URL}/meetings/${jobId}/export/minutes`);
      if (!response.ok) throw new Error(`Export failed: ${response.statusText}`);
      
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'minutes.pdf';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename=(.+)/);
        if (filenameMatch) filename = filenameMatch[1];
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export minutes:', error);
      alert('Failed to export minutes. Please try again.');
    }
  };

  const startMinutesEdit = () => {
    setDraftMinutes(minutes);
    setSaveError("");
    setEditorTab("write");
    setIsEditingMinutes(true);
  };

  const cancelMinutesEdit = () => {
    setDraftMinutes(minutes);
    setSaveError("");
    setIsEditingMinutes(false);
  };

  const handleSaveMinutes = async () => {
    if (!jobId || !onSaveMinutes) return;

    setIsSavingMinutes(true);
    setSaveError("");
    try {
      await onSaveMinutes(draftMinutes);
      setIsEditingMinutes(false);
    } catch (error) {
      console.error("Failed to save minutes:", error);
      setSaveError("Failed to save minutes. Please try again.");
    } finally {
      setIsSavingMinutes(false);
    }
  };

  const applyMarkdownWrap = (prefix, suffix = "", placeholder = "text") => {
    const el = minutesEditorRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = draftMinutes.slice(start, end) || placeholder;
    const next = draftMinutes.slice(0, start) + prefix + selected + suffix + draftMinutes.slice(end);

    setDraftMinutes(next);

    requestAnimationFrame(() => {
      const cursorStart = start + prefix.length;
      const cursorEnd = cursorStart + selected.length;
      el.focus();
      el.setSelectionRange(cursorStart, cursorEnd);
    });
  };

  const applyMarkdownLinePrefix = (prefix) => {
    const el = minutesEditorRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = draftMinutes.slice(start, end);
    const replacement = selected ? selected.split("\n").map((line) => `${prefix}${line}`).join("\n") : `${prefix}`;

    const next = draftMinutes.slice(0, start) + replacement + draftMinutes.slice(end);
    setDraftMinutes(next);

    requestAnimationFrame(() => {
      const cursor = start + replacement.length;
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col h-full w-full bg-gray-950 absolute inset-0 z-50"
    >
      {/* ── TOP NAVIGATION BAR ── */}
      <header className="flex-shrink-0 bg-gray-900/80 backdrop-blur-md border-b border-white/5 px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 z-40 relative shadow-xl shadow-black/20">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 pointer-events-none" />
        <div className="flex items-center gap-4 w-full sm:w-auto relative z-10">
          <button 
            onClick={onClose} 
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg transition-colors border border-white/5 font-semibold text-sm group"
          >
            <ArrowLeft className="w-4 h-4 text-indigo-400 group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </button>
          <div className="hidden sm:block h-6 w-px bg-white/10" />
          <h1 className="text-lg font-bold text-white tracking-tight hidden sm:block">Meeting Results</h1>
        </div>
      </header>

      {/* ── TWO-COLUMN CONTENT AREA ── */}
      <div className="flex-1 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row p-4 sm:p-6 pb-24 lg:pb-6 gap-6 relative z-10 w-full max-w-[1400px] mx-auto">
        
        {/* ── TRANSCRIPT PANEL ── */}
        <section className="min-h-[500px] lg:min-h-0 lg:flex-1 flex flex-col bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none -mr-32 -mt-32" />
          
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 relative z-10 bg-gray-900/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <FileCode2 className="text-blue-400 w-5 h-5" />
              </div>
              <h2 className="text-xl font-semibold text-white tracking-tight">Transcript</h2>
            </div>
            
            {jobId && (
              <button
                onClick={handleExportTranscript}
                disabled={!transcript || !transcript.trim()}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed group/btn"
                title="Export PDF"
              >
                <Download className="w-4 h-4 text-blue-400 group-hover/btn:scale-110 transition-transform" />
                <span className="hidden sm:inline">Export PDF</span>
              </button>
             )}
          </div>
          
          <div className="relative flex-1 bg-gray-950/50 shadow-inner overflow-hidden flex flex-col">
            <textarea
              readOnly
              value={transcript}
              placeholder="Transcript will appear here…"
              className="flex-1 w-full h-full bg-transparent p-6 text-[13.5px] leading-relaxed text-gray-300 placeholder-gray-600 resize-none outline-none font-mono custom-scrollbar"
            />
          </div>
        </section>

        {/* ── MINUTES PANEL ── */}
        <section className="min-h-[500px] lg:min-h-0 lg:flex-1 flex flex-col bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl overflow-hidden relative group">
          <div className="absolute top-0 left-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none -ml-32 -mt-32" />

          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 relative z-10 bg-gray-900/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <FileText className="text-purple-400 w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
                  Meeting Minutes
                  {minutes && minutes.trim() && !minutesAiGenerated && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" title="Human reviewed" />
                  )}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {jobId && (
                <>
                  <button
                    onClick={startMinutesEdit}
                    disabled={!minutes || !minutes.trim()}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed group/btn"
                    title="Edit Minutes"
                  >
                    <Edit3 className="w-4 h-4 text-purple-400 group-hover/btn:scale-110 transition-transform" />
                    <span className="hidden sm:inline">Edit</span>
                  </button>
                  <button
                    onClick={handleExportMinutes}
                    disabled={!minutes || !minutes.trim()}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed group/btn"
                    title="Export PDF"
                  >
                    <Download className="w-4 h-4 text-emerald-400 group-hover/btn:scale-110 transition-transform" />
                    <span className="hidden sm:inline">Export PDF</span>
                  </button>
                </>
              )}
            </div>
          </div>
          
          <div className="bg-gray-950/30 flex-shrink-0">
            {minutes && minutes.trim() && minutesAiGenerated && (
              <div className="px-6 py-3 border-b border-white/5">
                <div className="text-xs font-medium text-amber-300/80 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-lg flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0 animate-pulse" />
                  <div>
                    AI-generated draft. <button onClick={startMinutesEdit} className="underline hover:text-amber-200">Edit and save</button> to mark as human-reviewed.
                    {saveError && <div className="text-red-400 mt-1">{saveError}</div>}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="relative flex-1 bg-gray-950/50 shadow-inner overflow-y-auto p-6 md:p-8 custom-scrollbar">
            {minutes && minutes.trim() ? (
              <div 
                className="prose prose-invert prose-sm max-w-none text-gray-300"
                dangerouslySetInnerHTML={{ __html: markdownToHtml(minutes) }} 
              />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-500 italic pb-10">
                Minutes will appear here…
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── FULL SCREEN EDITOR SUPERIMPOSED ── */}
      <AnimatePresence>
        {isEditingMinutes && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md"
          >
            <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden w-full max-w-6xl h-[90vh]">
              {/* Header */}
              <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between gap-4 bg-gray-950/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                    <Edit3 className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white tracking-tight">
                      Edit Minutes
                    </h3>
                    <p className="text-xs font-medium text-gray-400">
                      Press <kbd className="font-sans px-1 py-0.5 bg-white/10 rounded text-gray-300 mx-1">Ctrl/Cmd + S</kbd> to save
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={cancelMinutesEdit}
                    disabled={isSavingMinutes}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors border border-white/5 disabled:opacity-50"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveMinutes}
                    disabled={isSavingMinutes}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors shadow-lg shadow-purple-500/20 disabled:opacity-50"
                  >
                    {isSavingMinutes ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {isSavingMinutes ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>

              {/* Toolbar */}
              <div className="px-6 py-3 border-b border-white/5 flex flex-wrap items-center gap-2 bg-gray-900/50">
                <button onClick={() => applyMarkdownWrap("# ", "", "Heading")} className="px-3 py-1.5 text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/5 rounded-md text-gray-300 transition-colors">H1</button>
                <button onClick={() => applyMarkdownWrap("## ", "", "Section")} className="px-3 py-1.5 text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/5 rounded-md text-gray-300 transition-colors">H2</button>
                <div className="w-px h-5 bg-white/10 mx-1" />
                <button onClick={() => applyMarkdownWrap("**", "**", "bold")} className="px-3 py-1.5 text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/5 rounded-md text-gray-300 transition-colors">B</button>
                <button onClick={() => applyMarkdownWrap("*", "*", "italic")} className="px-3 py-1.5 text-xs italic bg-white/5 hover:bg-white/10 border border-white/5 rounded-md text-gray-300 transition-colors">I</button>
                <div className="w-px h-5 bg-white/10 mx-1" />
                <button onClick={() => applyMarkdownLinePrefix("- ")} className="px-3 py-1.5 text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/5 rounded-md text-gray-300 transition-colors flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-gray-400 rounded-full"/>List</button>
                <button onClick={() => applyMarkdownLinePrefix("1. ")} className="px-3 py-1.5 text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/5 rounded-md text-gray-300 transition-colors">1. List</button>
                <div className="w-px h-5 bg-white/10 mx-1" />
                <button onClick={() => applyMarkdownWrap("`", "`", "code")} className="px-3 py-1.5 text-xs font-mono font-medium bg-white/5 hover:bg-white/10 border border-white/5 rounded-md text-gray-300 transition-colors">&lt;/&gt;</button>

                <div className="ml-auto flex items-center p-1 bg-black/40 rounded-lg border border-white/5">
                  <button
                    onClick={() => setEditorTab("write")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      editorTab === "write" ? "bg-gray-800 text-white shadow-sm" : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    Write Draft
                  </button>
                  <button
                    onClick={() => setEditorTab("preview")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      editorTab === "preview" ? "bg-gray-800 text-white shadow-sm" : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    Preview
                  </button>
                </div>
              </div>

              {/* Editor Workspace */}
              <div className="flex-1 min-h-0 bg-gray-950 overflow-hidden relative">
                <AnimatePresence mode="wait">
                  {editorTab === "write" ? (
                    <motion.div
                      key="write"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 p-6 sm:p-8 overflow-hidden"
                    >
                      <textarea
                        ref={minutesEditorRef}
                        value={draftMinutes}
                        onChange={(e) => setDraftMinutes(e.target.value)}
                        onKeyDown={(e) => {
                          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
                            e.preventDefault();
                            if (!isSavingMinutes) handleSaveMinutes();
                          }
                        }}
                        className="w-full h-full bg-transparent text-[15px] leading-relaxed text-gray-200 placeholder-gray-600 resize-none outline-none font-mono custom-scrollbar"
                        placeholder="Edit your meeting minutes here using Markdown..."
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="preview"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 p-8 sm:p-12 overflow-y-auto custom-scrollbar bg-gray-950 flex justify-center"
                    >
                      <div 
                        className="prose prose-invert max-w-3xl w-full"
                        dangerouslySetInnerHTML={{ __html: markdownToHtml(draftMinutes) }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
