import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Dialog from "./Dialog";
import { useClipStore } from "../store/useClipStore";
import {
  IconCheck,
  IconTag,
  IconSettings,
  IconLayers,
  IconAlertCircle,
  IconRefresh,
  IconShield,
  IconZap,
  IconX
} from "./Icons";

interface ImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

type ImportStatus =
  | "config"
  | "clips-config"
  | "tags-config"
  | "settings-config"
  | "progress"
  | "summary"
  | "error";

interface ImportSummary {
  success: boolean;
  importedClips: number;
  skippedClips: number;
  importedTags: number;
  skippedTags: number;
  importedSettings: boolean;
  error?: string;
}

export const ImportWizard: React.FC<ImportWizardProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<ImportStatus>("config");
  const [progressStep, setProgressStep] = useState<string>("preparing");
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const [parsedData, setParsedData] = useState<{
    clips: any[];
    tags: any[];
    settings: any;
  } | null>(null);

  // Subscribe to store state
  const localTags = useClipStore((state) => state.tags);
  const localSettings = useClipStore((state) => state.settings);

  // Clips Config State
  const [clipConflict, setClipConflict] = useState<"keep-existing" | "keep-new">("keep-existing");
  const [textFilter, setTextFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [level1Scope, setLevel1Scope] = useState<"all" | "favorites" | "tagged" | "active" | "deleted">("all");

  // Level 2 filter Refinements
  const [l2Favorite, setL2Favorite] = useState<"all" | "yes" | "no">("all");
  const [l2Recycle, setL2Recycle] = useState<"all" | "yes" | "no">("all");
  const [l2Tagged, setL2Tagged] = useState<"all" | "yes" | "no">("all");
  const [l2SpecificTagsMode, setL2SpecificTagsMode] = useState<"disabled" | "include" | "exclude">("disabled");
  const [l2SpecificTags, setL2SpecificTags] = useState<Set<string>>(new Set());

  // Tags Config State
  const [tagConflict, setTagConflict] = useState<"keep-existing" | "keep-new">("keep-existing");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  // Settings Config State
  const [importSettingsEnabled, setImportSettingsEnabled] = useState(true);
  const [selectedSettingsKeys, setSelectedSettingsKeys] = useState<Set<string>>(new Set());

  // Listen to progress
  useEffect(() => {
    if (status === "progress" && window.clipAPI?.onImportProgress) {
      const unsubscribe = window.clipAPI.onImportProgress((p) => {
        setProgressStep(p.step);
        setProgressPercent(p.percent);
      });
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
    return undefined;
  }, [status]);

  // Lock and bind Level 2 states depending on Level 1 scope
  useEffect(() => {
    if (level1Scope === "favorites") {
      setL2Favorite("yes");
    } else if (level1Scope === "tagged") {
      setL2Tagged("yes");
    } else if (level1Scope === "active") {
      setL2Recycle("no");
    } else if (level1Scope === "deleted") {
      setL2Recycle("yes");
    } else {
      setL2Favorite("all");
      setL2Recycle("all");
      setL2Tagged("all");
      setL2SpecificTagsMode("disabled");
    }
  }, [level1Scope]);

  // Counts of different categories from the raw imported file
  const parsedCounts = useMemo(() => {
    if (!parsedData) return { all: 0, favorites: 0, tagged: 0, active: 0, deleted: 0 };
    const clips = parsedData.clips || [];
    return {
      all: clips.length,
      favorites: clips.filter((c) => c.isFavorite).length,
      tagged: clips.filter((c) => c.tags && c.tags.length > 0).length,
      active: clips.filter((c) => !c.isDeleted).length,
      deleted: clips.filter((c) => c.isDeleted).length,
    };
  }, [parsedData]);

  // Calculate filtered list of clips
  const filteredClips = useMemo(() => {
    if (!parsedData) return [];
    return parsedData.clips.filter((clip) => {
      // 1. Text filter
      if (textFilter.trim()) {
        const text = clip.text || "";
        if (!text.toLowerCase().includes(textFilter.toLowerCase())) {
          return false;
        }
      }

      // 2. Date Range
      if (clip.timestamp) {
        if (dateFrom) {
          const fromTime = new Date(dateFrom).getTime();
          const clipTime = new Date(clip.timestamp).getTime();
          if (clipTime < fromTime) return false;
        }
        if (dateTo) {
          const toTime = new Date(dateTo + "T23:59:59").getTime();
          const clipTime = new Date(clip.timestamp).getTime();
          if (clipTime > toTime) return false;
        }
      }

      // 3. Favorites
      const fav = level1Scope === "favorites" ? "yes" : l2Favorite;
      if (fav === "yes" && !clip.isFavorite) return false;
      if (fav === "no" && clip.isFavorite) return false;

      // 4. Recycle Bin
      let rec = l2Recycle;
      if (level1Scope === "active") rec = "no";
      else if (level1Scope === "deleted") rec = "yes";
      if (rec === "yes" && !clip.isDeleted) return false;
      if (rec === "no" && clip.isDeleted) return false;

      // 5. Tags Presence
      const tag = level1Scope === "tagged" ? "yes" : l2Tagged;
      const hasTags = clip.tags && clip.tags.length > 0;
      if (tag === "yes" && !hasTags) return false;
      if (tag === "no" && hasTags) return false;

      // 6. Specific Tags
      if (l2SpecificTagsMode === "include" && l2SpecificTags.size > 0) {
        if (!clip.tags || !clip.tags.some((t: string) => l2SpecificTags.has(t))) {
          return false;
        }
      } else if (l2SpecificTagsMode === "exclude" && l2SpecificTags.size > 0) {
        if (clip.tags && clip.tags.some((t: string) => l2SpecificTags.has(t))) {
          return false;
        }
      }

      return true;
    });
  }, [
    parsedData,
    textFilter,
    dateFrom,
    dateTo,
    level1Scope,
    l2Favorite,
    l2Recycle,
    l2Tagged,
    l2SpecificTagsMode,
    l2SpecificTags,
  ]);

  // Generate description note
  const combinationNote = useMemo(() => {
    const parts: string[] = [];
    if (textFilter.trim()) parts.push(`matching text "${textFilter.trim()}"`);
    if (dateFrom && dateTo) parts.push(`created between ${dateFrom} and ${dateTo}`);
    else if (dateFrom) parts.push(`created after ${dateFrom}`);
    else if (dateTo) parts.push(`created before ${dateTo}`);

    const fav = level1Scope === "favorites" ? "yes" : l2Favorite;
    if (fav === "yes") parts.push("favorites");
    else if (fav === "no") parts.push("non-favorites");

    let rec = l2Recycle;
    if (level1Scope === "active") rec = "no";
    else if (level1Scope === "deleted") rec = "yes";
    if (rec === "yes") parts.push("in recycle bin");
    else if (rec === "no") parts.push("active clips");

    const tag = level1Scope === "tagged" ? "yes" : l2Tagged;
    if (tag === "yes") parts.push("having tags");
    else if (tag === "no") parts.push("without tags");

    if (l2SpecificTagsMode === "include" && l2SpecificTags.size > 0) {
      parts.push(`having specific tags`);
    } else if (l2SpecificTagsMode === "exclude" && l2SpecificTags.size > 0) {
      parts.push(`excluding specific tags`);
    }

    if (parts.length === 0) return "Importing all clips from the backup file.";
    return `Importing clips: ${parts.join(", ")}.`;
  }, [
    textFilter,
    dateFrom,
    dateTo,
    level1Scope,
    l2Favorite,
    l2Recycle,
    l2Tagged,
    l2SpecificTagsMode,
    l2SpecificTags,
  ]);

  // Prepopulate tags checkbox state on conflict resolution or data load
  useEffect(() => {
    if (!parsedData || !parsedData.tags) return;
    const initialSelected = new Set<string>();
    const localTagsLower = new Set(localTags.map((t) => t.name.toLowerCase().trim()));
    const localTagIds = new Set(localTags.map((t) => t.id));

    parsedData.tags.forEach((t) => {
      const isConflict = localTagIds.has(t.id) || localTagsLower.has(t.name.toLowerCase().trim());
      if (tagConflict === "keep-new" || !isConflict) {
        initialSelected.add(t.id);
      }
    });
    setSelectedTags(initialSelected);
  }, [parsedData, tagConflict, localTags]);

  // Prepopulate settings checkboxes on data load
  useEffect(() => {
    if (!parsedData || !parsedData.settings) return;
    const keys = Object.keys(parsedData.settings).filter((k) =>
      [
        "autoLaunch",
        "maxEntries",
        "pollingInterval",
        "paginationEnabled",
        "pageSize",
        "viewMode",
        "displayMode",
        "pauseCaptureOption",
      ].includes(k)
    );
    setSelectedSettingsKeys(new Set(keys));
  }, [parsedData]);

  const handleClose = async () => {
    if (summary && summary.success) {
      const store = useClipStore.getState();
      await Promise.all([store.loadClips(), store.loadTags(), store.loadSettings()]);
    }
    setStatus("config");
    setProgressStep("preparing");
    setProgressPercent(0);
    setErrorMessage("");
    setSummary(null);
    setParsedData(null);
    onClose();
  };

  const handleSelectFile = async () => {
    try {
      if (!window.clipAPI?.selectAndParseImportFile) {
        throw new Error("Select and parse API not loaded.");
      }
      const data = await window.clipAPI.selectAndParseImportFile();
      if (!data.success && data.error === "Import cancelled by user.") {
        return;
      }
      if (!data.success) {
        throw new Error(data.error || "Parsing failed.");
      }

      setParsedData({
        clips: data.clips || [],
        tags: data.tags || [],
        settings: data.settings || null,
      });

      // Proceed to the next step
      setStatus("clips-config");
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Could not read backup file.");
      setStatus("error");
    }
  };

  const handlePerformImport = async () => {
    setStatus("progress");
    setProgressPercent(0);
    setProgressStep("preparing");

    try {
      if (!window.clipAPI?.executeCustomImport) {
        throw new Error("Execute Custom Import API not loaded.");
      }

      // Filter settings object based on checked keys
      let settingsToImport: any = null;
      if (importSettingsEnabled && parsedData?.settings) {
        settingsToImport = {};
        selectedSettingsKeys.forEach((k) => {
          settingsToImport[k] = parsedData.settings[k];
        });
      }

      // Filter tags array based on checked tags
      const tagsToImport = (parsedData?.tags || []).filter((t) => selectedTags.has(t.id));

      const result = await window.clipAPI.executeCustomImport({
        clips: filteredClips,
        tags: tagsToImport,
        settings: settingsToImport,
        clipConflictResolution: clipConflict,
        tagConflictResolution: tagConflict,
      });

      setSummary(result);
      if (result.success) {
        setStatus("summary");
      } else {
        setErrorMessage(result.error || "Import failed.");
        setStatus("error");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Error running custom database import.");
      setStatus("error");
    }
  };

  const handleToggleTagSelection = (tagId: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  };

  const handleToggleSettingSelection = (key: string) => {
    setSelectedSettingsKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleToggleL2SpecificTag = (tagId: string) => {
    setL2SpecificTags((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  };

  const getStepLabel = (step: string): string => {
    switch (step) {
      case "preparing":
        return "Preparing files";
      case "processing":
        return "Analyzing & resolving duplicates";
      case "generating":
        return "Inserting and updating database";
      case "complete":
        return "Custom import complete";
      default:
        return "Importing...";
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={status === "progress" ? () => {} : handleClose}
      title={
        <span className="flex items-center gap-2">
          <IconZap className="w-4 h-4 text-brand-400 shrink-0" />
          Advanced Data Import System
        </span>
      }
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        <AnimatePresence mode="wait">
          {/* STEP 1: FILE INGESTION */}
          {status === "config" && (
            <motion.div
              key="config"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2 py-4">
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-400 mx-auto mb-3">
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </div>
                <h4 className="text-base font-bold text-white">Select Backup File</h4>
                <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                  Provide a ClipMaster Pro backup package in **JSON** or **ZIP** format to initialize the import configuration wizard.
                </p>
              </div>

              <div className="bg-surface-900/40 border border-gray-700/50 rounded-xl p-4 space-y-3.5 text-xs text-gray-400">
                <div className="flex gap-3">
                  <IconShield size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-gray-200 block">Conflict Resolutions</span>
                    You can decide whether to keep your existing local database items or overwrite them with the backup data.
                  </div>
                </div>
                <div className="flex gap-3">
                  <IconLayers size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-gray-200 block">Flexible Custom Filters</span>
                    Search by text, restrict by date ranges, or pick specific types (e.g. only favorites, tags, recycle bin).
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-700 bg-surface-850 text-gray-300 hover:bg-surface-750 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <IconX size={14} />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSelectFile}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-brand-500/20 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Choose File...
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 2: CLIPS FILTER CONFIGURATION */}
          {status === "clips-config" && parsedData && (
            <motion.div
              key="clips-config"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-5"
            >
              <div className="flex items-center justify-between border-b border-gray-700/60 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <IconLayers className="w-4 h-4 text-brand-400" />
                    Configure Clipboard Clips Import
                  </h4>
                  <p className="text-[10px] text-gray-500">Define search query and subset scopes</p>
                </div>
                <span className="text-[10px] bg-brand-500/20 text-brand-300 border border-brand-500/30 px-2.5 py-0.5 rounded-full font-mono font-semibold">
                  Step 1 of 3
                </span>
              </div>

              {/* LEVEL 0: CONFLICT RESOLUTION & TEXT / DATE FILTERS */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Conflict Resolution (Clips)
                  </label>
                  <select
                    value={clipConflict}
                    onChange={(e) => setClipConflict(e.target.value as any)}
                    className="w-full bg-surface-900 border border-gray-700/60 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="keep-existing">Keep Existing Default (Skip backup duplicates)</option>
                    <option value="keep-new">Keep New One's (Overwrite existing matching clips)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Text-wise Filter
                  </label>
                  <input
                    type="text"
                    placeholder="Search query in backup clips..."
                    value={textFilter}
                    onChange={(e) => setTextFilter(e.target.value)}
                    className="w-full bg-surface-900 border border-gray-700/60 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {/* DATE RANGE FILTERS */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Date From
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full bg-surface-900 border border-gray-700/60 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Date To
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full bg-surface-900 border border-gray-700/60 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {/* LEVEL 1: BASE CATEGORY SCOPE */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Select Base Category Scope (Level 1)
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { key: "all", label: "All Clips", count: parsedCounts.all },
                    { key: "favorites", label: "Favorites", count: parsedCounts.favorites },
                    { key: "tagged", label: "Tagged", count: parsedCounts.tagged },
                    { key: "active", label: "Not Recycle", count: parsedCounts.active },
                    { key: "deleted", label: "Recycle Bin", count: parsedCounts.deleted },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setLevel1Scope(item.key as any)}
                      className={`p-2.5 rounded-xl border flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                        level1Scope === item.key
                          ? "bg-brand-500/20 border-brand-500 text-white font-bold"
                          : "bg-surface-900/50 border-gray-800 text-gray-400 hover:bg-surface-900 hover:border-gray-700"
                      }`}
                    >
                      <span className="text-[10px] truncate w-full">{item.label}</span>
                      <span className="text-[11px] font-bold font-mono mt-1">{item.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* LEVEL 2: REFINE OPTIONS FOR SELECTED SCOPE */}
              {level1Scope !== "all" && (
                <div className="bg-surface-900/40 border border-gray-800 rounded-xl p-4 space-y-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block border-b border-gray-800 pb-1.5">
                    Refinement Sub-Filters (Level 2)
                  </span>

                  <div className="grid grid-cols-3 gap-3">
                    {/* Favorites Sub-filter */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-500 uppercase">Favorites Filter</label>
                      <select
                        disabled={level1Scope === "favorites"}
                        value={l2Favorite}
                        onChange={(e) => setL2Favorite(e.target.value as any)}
                        className="w-full bg-surface-800 border border-gray-700 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none"
                      >
                        <option value="all">Keep All</option>
                        <option value="yes">Only Favorites</option>
                        <option value="no">Exclude Favorites</option>
                      </select>
                    </div>

                    {/* Recycle Bin Sub-filter */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-500 uppercase">Recycle Bin Filter</label>
                      <select
                        disabled={level1Scope === "active" || level1Scope === "deleted"}
                        value={l2Recycle}
                        onChange={(e) => setL2Recycle(e.target.value as any)}
                        className="w-full bg-surface-800 border border-gray-700 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none"
                      >
                        <option value="all">Keep All</option>
                        <option value="yes">Only Recycle Bin</option>
                        <option value="no">Exclude Recycle Bin</option>
                      </select>
                    </div>

                    {/* Tags Presence Sub-filter */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-500 uppercase">Tags Presence</label>
                      <select
                        disabled={level1Scope === "tagged"}
                        value={l2Tagged}
                        onChange={(e) => setL2Tagged(e.target.value as any)}
                        className="w-full bg-surface-800 border border-gray-700 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none"
                      >
                        <option value="all">Keep All</option>
                        <option value="yes">Only Having Tags</option>
                        <option value="no">Exclude Having Tags</option>
                      </select>
                    </div>
                  </div>

                  {/* Level 2: Specific Tags Inclusion / Exclusion */}
                  {parsedData.tags && parsedData.tags.length > 0 && (
                    <div className="space-y-2 border-t border-gray-800 pt-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-bold text-gray-500 uppercase">Specific Tags Selection</label>
                        <select
                          value={l2SpecificTagsMode}
                          onChange={(e) => setL2SpecificTagsMode(e.target.value as any)}
                          className="bg-surface-800 border border-gray-700 rounded-lg px-2 py-0.5 text-[10px] text-white focus:outline-none"
                        >
                          <option value="disabled">Ignore specific tags filter</option>
                          <option value="include">Only Include these tags</option>
                          <option value="exclude">Exclude these tags</option>
                        </select>
                      </div>

                      {l2SpecificTagsMode !== "disabled" && (
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-surface-950 rounded-lg border border-gray-800">
                          {parsedData.tags.map((t) => {
                            const isSelected = l2SpecificTags.has(t.id);
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => handleToggleL2SpecificTag(t.id)}
                                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                                  isSelected
                                    ? "bg-brand-500 text-white font-semibold"
                                    : "bg-surface-800 text-gray-400 border border-gray-700/50 hover:bg-surface-700"
                                }`}
                              >
                                {t.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* RESULTS PREVIEW GRID & LIVE COUNT */}
              <div className="bg-surface-900 border border-gray-800/80 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400">
                    Live Counts Match:{" "}
                    <strong className="text-white font-mono">{filteredClips.length}</strong> of{" "}
                    <strong className="text-gray-500 font-mono">{parsedData.clips.length}</strong> clips
                  </span>
                  <span className="text-[10px] text-gray-500 font-medium italic truncate max-w-[320px]">
                    {combinationNote}
                  </span>
                </div>

                {filteredClips.length > 0 && (
                  <div className="space-y-1.5 border-t border-gray-800/60 pt-2">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">
                      Previewing 1-3 of matching clips:
                    </span>
                    <div className="space-y-1">
                      {filteredClips.slice(0, 3).map((c, i) => (
                        <div
                          key={c.id || i}
                          className="px-2.5 py-1.5 bg-surface-950/60 rounded-lg text-[10px] text-gray-300 font-mono border border-gray-800/50 truncate flex justify-between gap-4"
                        >
                          <span className="truncate">{c.text || "(empty)"}</span>
                          <span className="text-gray-500 shrink-0">
                            {c.timestamp ? new Date(c.timestamp).toLocaleDateString() : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ACTION FOOTER */}
              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 rounded-xl border border-gray-700 bg-surface-850 hover:bg-surface-750 text-gray-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => {
                    if (parsedData.tags && parsedData.tags.length > 0) {
                      setStatus("tags-config");
                    } else if (parsedData.settings) {
                      setStatus("settings-config");
                    } else {
                      handlePerformImport();
                    }
                  }}
                  className="px-6 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold uppercase tracking-wider shadow-md shadow-brand-500/10 cursor-pointer transition-all active:scale-95"
                >
                  Next: Tags Setup →
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: TAGS CONFIGURATION & PREVIEW */}
          {status === "tags-config" && parsedData && (
            <motion.div
              key="tags-config"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-5"
            >
              <div className="flex items-center justify-between border-b border-gray-700/60 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <IconTag className="w-4 h-4 text-brand-400" />
                    Configure Tags Import
                  </h4>
                  <p className="text-[10px] text-gray-500">Pick which tags to ingest and how to resolve name conflicts</p>
                </div>
                <span className="text-[10px] bg-brand-500/20 text-brand-300 border border-brand-500/30 px-2.5 py-0.5 rounded-full font-mono font-semibold">
                  Step 2 of 3
                </span>
              </div>

              {/* Conflict resolution */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Tag Conflict Resolution
                </label>
                <select
                  value={tagConflict}
                  onChange={(e) => setTagConflict(e.target.value as any)}
                  className="w-full bg-surface-900 border border-gray-700/60 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="keep-existing">Keep Existing (Preserve local tag colors/names)</option>
                  <option value="keep-new">Keep New One's (Overwrite local color details with backup)</option>
                </select>
              </div>

              {/* Tags Selector list */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 uppercase">
                  <span>Backup Tags List</span>
                  <span>
                    Selected: {selectedTags.size} of {parsedData.tags.length}
                  </span>
                </div>

                <div className="max-h-60 overflow-y-auto border border-gray-800 bg-surface-900/50 rounded-xl divide-y divide-gray-800">
                  {parsedData.tags.map((tag) => {
                    const isSelected = selectedTags.has(tag.id);
                    const localMatch = localTags.find(
                      (lt) =>
                        lt.id === tag.id || lt.name.toLowerCase().trim() === tag.name.toLowerCase().trim()
                    );
                    return (
                      <div
                        key={tag.id}
                        onClick={() => handleToggleTagSelection(tag.id)}
                        className="flex items-center justify-between p-3 hover:bg-surface-800/30 transition-colors cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="rounded border-gray-700 bg-surface-900 text-brand-500 focus:ring-0 cursor-pointer focus:ring-offset-0"
                          />
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/10 shrink-0"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="font-semibold text-white">{tag.name}</span>
                        </div>

                        <div className="flex items-center gap-3">
                          {localMatch ? (
                            <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-bold uppercase">
                              Conflict
                            </span>
                          ) : (
                            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold uppercase">
                              New Tag
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-gray-600 font-semibold">{tag.id.slice(0, 8)}...</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* FOOTER ACTIONS */}
              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStatus("clips-config")}
                  className="px-4 py-2 rounded-xl border border-gray-700 bg-surface-850 hover:bg-surface-750 text-gray-300 text-xs font-semibold cursor-pointer"
                >
                  ← Back to Clips
                </button>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => {
                    if (parsedData.settings) {
                      setStatus("settings-config");
                    } else {
                      handlePerformImport();
                    }
                  }}
                  className="px-6 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold uppercase tracking-wider shadow-md shadow-brand-500/10 cursor-pointer transition-all active:scale-95"
                >
                  Next: Settings Setup →
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 4: SETTINGS PREVIEW & TOGGLE */}
          {status === "settings-config" && parsedData && parsedData.settings && (
            <motion.div
              key="settings-config"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-5"
            >
              <div className="flex items-center justify-between border-b border-gray-700/60 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <IconSettings className="w-4 h-4 text-brand-400" />
                    Configure Settings Import
                  </h4>
                  <p className="text-[10px] text-gray-500">Pick which system settings from backup you want to apply</p>
                </div>
                <span className="text-[10px] bg-brand-500/20 text-brand-300 border border-brand-500/30 px-2.5 py-0.5 rounded-full font-mono font-semibold">
                  Step 3 of 3
                </span>
              </div>

              {/* Master Settings Enable */}
              <div className="flex items-center gap-2 bg-surface-900 border border-gray-800 p-3 rounded-xl">
                <input
                  type="checkbox"
                  id="importSettings"
                  checked={importSettingsEnabled}
                  onChange={(e) => setImportSettingsEnabled(e.target.checked)}
                  className="rounded border-gray-700 bg-surface-900 text-brand-500 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="importSettings" className="text-xs text-white font-bold cursor-pointer">
                  Import application settings from backup file
                </label>
              </div>

              {importSettingsEnabled && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                    Settings Keys Comparison
                  </span>

                  <div className="max-h-60 overflow-y-auto border border-gray-800 bg-surface-900/50 rounded-xl divide-y divide-gray-800 text-xs">
                    {Object.keys(parsedData.settings)
                      .filter((k) =>
                        [
                          "autoLaunch",
                          "maxEntries",
                          "pollingInterval",
                          "paginationEnabled",
                          "pageSize",
                          "viewMode",
                          "displayMode",
                          "pauseCaptureOption",
                        ].includes(k)
                      )
                      .map((key) => {
                        const isSelected = selectedSettingsKeys.has(key);
                        const backupVal = parsedData.settings[key];
                        const localVal = (localSettings as any)[key];

                        return (
                          <div
                            key={key}
                            onClick={() => handleToggleSettingSelection(key)}
                            className="p-3 hover:bg-surface-800/30 transition-colors cursor-pointer flex items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                readOnly
                                className="rounded border-gray-700 bg-surface-900 text-brand-500 focus:ring-0 cursor-pointer"
                              />
                              <span className="font-semibold text-white font-mono">{key}</span>
                            </div>

                            <div className="flex items-center gap-4 text-[10px] font-mono">
                              <div className="text-right">
                                <span className="text-gray-600 block text-[9px] uppercase font-bold">Local</span>
                                <span className="text-gray-400">{String(localVal)}</span>
                              </div>
                              <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                              </svg>
                              <div>
                                <span className="text-brand-500 block text-[9px] uppercase font-bold">Backup</span>
                                <span className="text-brand-400 font-bold">{String(backupVal)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* FOOTER ACTIONS */}
              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (parsedData.tags && parsedData.tags.length > 0) {
                      setStatus("tags-config");
                    } else {
                      setStatus("clips-config");
                    }
                  }}
                  className="px-4 py-2 rounded-xl border border-gray-700 bg-surface-850 hover:bg-surface-750 text-gray-300 text-xs font-semibold cursor-pointer"
                >
                  ← Back
                </button>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={handlePerformImport}
                  className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-650 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-brand-500/20 cursor-pointer transition-all active:scale-95 flex items-center gap-2"
                >
                  <IconCheck size={14} />
                  Run Custom Import
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 5: PROGRESS LOADER */}
          {status === "progress" && (
            <motion.div
              key="progress"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-6 space-y-6"
            >
              <div className="relative flex items-center justify-center w-20 h-20">
                <div className="absolute inset-0 border-[5px] border-brand-500/10 rounded-full" />
                <div className="absolute inset-0 border-[5px] border-t-brand-500 rounded-full animate-spin" />
                <IconRefresh className="w-8 h-8 text-brand-400 animate-spin" />
              </div>

              <div className="text-center space-y-2 w-full max-w-sm">
                <h4 className="text-sm font-bold text-white tracking-wide">
                  {getStepLabel(progressStep)}
                </h4>
                <p className="text-xs text-gray-500">
                  Please wait, applying filters and inserting custom dataset records.
                </p>

                <div className="relative w-full h-2 bg-surface-900 rounded-full overflow-hidden border border-white/5 mt-4">
                  <motion.div
                    className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-brand-500 to-indigo-500"
                    style={{ width: `${progressPercent}%` }}
                    transition={{ ease: "easeInOut" }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-gray-500 pt-1">
                  <span>IMPORTING PROGRESS</span>
                  <span>{progressPercent}%</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 6: SUMMARY STATS */}
          {status === "summary" && summary && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col items-center justify-center text-center space-y-2 py-2">
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-2">
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="text-sm font-bold text-white">Import Complete</h4>
                <p className="text-xs text-gray-500">Your custom configured import has completed successfully.</p>
              </div>

              {/* Summary Stats Grid */}
              <div className="bg-surface-900/40 border border-gray-700/50 rounded-2xl p-5 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {/* Clips stat */}
                  <div className="p-3 bg-surface-800/40 border border-gray-700/30 rounded-xl flex flex-col items-center text-center">
                    <IconLayers size={18} className="text-brand-400 mb-1.5" />
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Clips</span>
                    <span className="text-sm font-bold text-white mt-1">+{summary.importedClips}</span>
                    <span className="text-[9px] text-gray-500 mt-0.5">({summary.skippedClips} skipped)</span>
                  </div>

                  {/* Tags stat */}
                  <div className="p-3 bg-surface-800/40 border border-gray-700/30 rounded-xl flex flex-col items-center text-center">
                    <IconTag size={18} className="text-indigo-400 mb-1.5" />
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Tags</span>
                    <span className="text-sm font-bold text-white mt-1">+{summary.importedTags}</span>
                    <span className="text-[9px] text-gray-500 mt-0.5">({summary.skippedTags} skipped)</span>
                  </div>

                  {/* Settings stat */}
                  <div className="p-3 bg-surface-800/40 border border-gray-700/30 rounded-xl flex flex-col items-center text-center">
                    <IconSettings size={18} className="text-amber-400 mb-1.5" />
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Settings</span>
                    <span className="text-xs font-bold text-white mt-2">
                      {summary.importedSettings ? "Updated" : "Skipped"}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 bg-brand-500/5 border border-brand-500/10 rounded-xl text-center">
                  <p className="text-[11px] text-gray-400">
                    Your clipboard timeline and settings caches have been reloaded dynamically.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStatus("config")}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-700 bg-surface-800 text-gray-300 hover:bg-surface-750 text-xs font-semibold tracking-wide transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <IconRefresh size={14} className="text-gray-400" />
                  Import Another
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <IconCheck size={14} />
                  Finish
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 7: ERROR STEP */}
          {status === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 animate-bounce">
                  <IconAlertCircle size={28} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-rose-400">Import Failed</h4>
                  <p className="text-xs text-gray-500 mt-2 max-w-sm leading-relaxed">{errorMessage}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStatus("config")}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <IconRefresh size={14} />
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-700 bg-surface-800 text-gray-300 hover:bg-surface-700 text-xs font-semibold tracking-wide transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <IconX size={14} />
                  Close Dialog
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Dialog>
  );
};
