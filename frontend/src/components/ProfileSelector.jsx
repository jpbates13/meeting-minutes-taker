import { useEffect, useMemo, useState } from "react";
import { createProfile, fetchProfiles, updateProfile } from "../api/profiles";
import { Settings2, Plus, Edit2, Check, X, Building, Tag, Sparkles, SlidersHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const TONE_OPTIONS = ["formal", "neutral", "concise"];

export default function ProfileSelector({
  selectedProfileId,
  onSelectProfile,
}) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formMode, setFormMode] = useState(null);

  const [name, setName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [meetingType, setMeetingType] = useState("");
  const [tone, setTone] = useState("formal");
  const [customInstructions, setCustomInstructions] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadProfiles() {
      setLoading(true);
      setError("");
      try {
        const items = await fetchProfiles();
        if (cancelled) return;
        setProfiles(items);
        if (!selectedProfileId && items.length > 0) {
          onSelectProfile(items[0].id);
        }
      } catch (err) {
        if (!cancelled) setError("Could not load meeting profiles.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProfiles();
    return () => {
      cancelled = true;
    };
  }, [onSelectProfile, selectedProfileId]);

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId) || null,
    [profiles, selectedProfileId],
  );

  function resetForm() {
    setName("");
    setOrganizationName("");
    setMeetingType("");
    setTone("formal");
    setCustomInstructions("");
  }

  function startCreate() {
    setFormMode((prev) => (prev === "create" ? null : "create"));
    setError("");
    resetForm();
  }

  function startEdit() {
    if (!selectedProfile) return;
    if (formMode === "edit") {
      setFormMode(null);
      setError("");
      return;
    }

    setFormMode("edit");
    setError("");
    setName(selectedProfile.name || "");
    setOrganizationName(selectedProfile.organization_name || "");
    setMeetingType(selectedProfile.meeting_type || "");
    setTone(selectedProfile.tone || "formal");
    setCustomInstructions(selectedProfile.custom_instructions || "");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError("");
    try {
      const payload = {
        name,
        organization_name: organizationName,
        meeting_type: meetingType,
        tone,
        custom_instructions: customInstructions,
      };

      if (formMode === "edit" && selectedProfile) {
        const updated = await updateProfile(selectedProfile.id, payload);
        setProfiles((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p)),
        );
        onSelectProfile(updated.id);
      } else {
        const created = await createProfile(payload);
        setProfiles((prev) => [...prev, created]);
        onSelectProfile(created.id);
      }

      setFormMode(null);
      resetForm();
    } catch (err) {
      setError(
        formMode === "edit"
          ? "Could not update profile."
          : "Could not create profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-white/10 p-6 md:p-8 shadow-2xl relative mb-8 overflow-hidden">
      <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -mr-10 -mt-10" />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-xl">
            <Settings2 className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white tracking-tight">Meeting Profile</h2>
            <p className="text-sm font-medium text-gray-400 mt-0.5">
              Customize AI handling and instructions
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="flex-1 sm:w-64">
            <select
              value={selectedProfileId || "general"}
              onChange={(e) => {
                onSelectProfile(e.target.value);
                setFormMode(null);
              }}
              className="w-full bg-gray-800/80 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-100 hover:border-purple-500/50 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors appearance-none cursor-pointer shadow-inner"
              style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={startCreate}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl transition-all border ${
                formMode === "create" 
                  ? "bg-gray-800 text-gray-300 border-white/10" 
                  : "bg-purple-600/20 text-purple-300 border-purple-500/30 hover:bg-purple-600/30"
              }`}
            >
              {formMode === "create" ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {formMode === "create" ? "Cancel" : "New"}
            </button>
            <button
              onClick={startEdit}
              disabled={!selectedProfile || selectedProfileId === "general"}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl transition-all border disabled:opacity-50 disabled:cursor-not-allowed ${
                formMode === "edit"
                  ? "bg-gray-800 text-gray-300 border-white/10"
                  : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
              }`}
            >
              {formMode === "edit" ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
              {formMode === "edit" ? "Cancel" : "Edit"}
            </button>
          </div>
        </div>
      </div>

      {loading && <p className="text-sm text-purple-400 mt-4 animate-pulse relative z-10">Loading profiles...</p>}
      {error && <p className="text-sm text-rose-400 mt-4 font-medium relative z-10">{error}</p>}

      <AnimatePresence>
        {!formMode && selectedProfile && selectedProfileId !== "general" && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden relative z-10"
          >
            <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-white/5 text-xs font-semibold">
              {selectedProfile.organization_name && (
                <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-lg text-gray-300">
                  <Building className="w-3.5 h-3.5 text-blue-400" /> {selectedProfile.organization_name}
                </span>
              )}
              {selectedProfile.meeting_type && (
                <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-lg text-gray-300">
                  <Tag className="w-3.5 h-3.5 text-amber-400" /> {selectedProfile.meeting_type}
                </span>
              )}
              {selectedProfile.tone && (
                <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-lg text-gray-300 capitalize">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> {selectedProfile.tone}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {formMode && (
          <motion.form 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit} 
            className="grid gap-5 sm:grid-cols-2 mt-6 pt-6 border-t border-white/5 relative z-10"
          >
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">
                Profile Name <span className="text-rose-400">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={80}
                className="w-full bg-gray-950/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors shadow-inner"
                placeholder="e.g. Quarterly Board Meeting"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">
                <Building className="w-3.5 h-3.5" /> Organization
              </label>
              <input
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                maxLength={120}
                className="w-full bg-gray-950/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors shadow-inner"
                placeholder="e.g. Acme Corp"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">
                <Tag className="w-3.5 h-3.5" /> Meeting Type
              </label>
              <input
                value={meetingType}
                onChange={(e) => setMeetingType(e.target.value)}
                maxLength={80}
                className="w-full bg-gray-950/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors shadow-inner"
                placeholder="e.g. Brainstorming, Daily Standup"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" /> Tone
              </label>
              <div className="flex flex-wrap gap-3">
                {TONE_OPTIONS.map((option) => (
                  <label key={option} className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${tone === option ? 'bg-purple-600/20 border-purple-500 text-purple-300' : 'bg-gray-950/50 border-white/10 text-gray-400 hover:border-white/20'}`}>
                    <input
                      type="radio"
                      name="tone"
                      value={option}
                      checked={tone === option}
                      onChange={(e) => setTone(e.target.value)}
                      className="sr-only"
                    />
                    <span className="text-sm font-semibold capitalize">{option}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">
                <SlidersHorizontal className="w-3.5 h-3.5" /> Custom Instructions
              </label>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                rows={3}
                maxLength={2000}
                className="w-full bg-gray-950/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors shadow-inner resize-y custom-scrollbar"
                placeholder="Optional LLM guidance, vocabulary, custom terminology, or formatting preferences..."
              />
            </div>

            <div className="sm:col-span-2 flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => setFormMode(null)}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-300 hover:bg-white/5 transition-colors border border-transparent"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors shadow-lg shadow-purple-600/20 disabled:shadow-none"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : <Check className="w-4 h-4" />}
                {saving
                  ? "Saving..."
                  : formMode === "edit"
                    ? "Save Changes"
                    : "Create Profile"}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </section>
  );
}
