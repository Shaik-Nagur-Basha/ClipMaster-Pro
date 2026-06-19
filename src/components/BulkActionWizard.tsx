import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Dialog from "./Dialog";
import {
  IconCheck,
  IconTag,
  IconStar,
  IconTrash,
} from "./Icons";
import type { Tag, ScopeFilter } from "../types";
import { useClipStore } from "../store/useClipStore";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BulkActionType =
  | "move-to-recycle"
  | "restore-from-recycle"
  | "move-to-favourites"
  | "attach-tags";

export interface BulkActionWizardProps {
  isOpen: boolean;
  onClose: () => void;
  /** Which action to perform */
  actionType: BulkActionType;
}

type WizardStatus = "config" | "progress" | "done" | "error";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_SCOPE_FILTER: ScopeFilter = {
  favourites: null,
  recycle: null,
  havingTags: null,
  specificTags: [],
  specificTagsMode: null,
};

// Which Level-2 dimension toggles are available per action
// (the fixed dimension of each action is omitted)
type DimKey = "favourites" | "recycle" | "havingTags";

interface DimConfig {
  key: DimKey;
  label: string;
  yesLabel: string;
  noLabel: string;
  yesColor: ChipColor;
  noColor: ChipColor;
}

type ChipColor = "brand" | "star" | "rose" | "emerald" | "violet";

const DIM_FAVOURITES: DimConfig = {
  key: "favourites",
  label: "Favourites",
  yesLabel: "Only Favourites",
  noLabel: "Not Favourites",
  yesColor: "star",
  noColor: "brand",
};
const DIM_RECYCLE: DimConfig = {
  key: "recycle",
  label: "Recycle Bin",
  yesLabel: "In Recycle Bin",
  noLabel: "Not In Recycle Bin",
  yesColor: "rose",
  noColor: "emerald",
};
const DIM_TAGS: DimConfig = {
  key: "havingTags",
  label: "Tags",
  yesLabel: "Having Tags",
  noLabel: "No Tags",
  yesColor: "violet",
  noColor: "brand",
};

function getDimsForAction(actionType: BulkActionType): DimConfig[] {
  switch (actionType) {
    // Fixed: Recycle=No → free: Fav, Tags
    case "move-to-recycle":      return [DIM_FAVOURITES, DIM_TAGS];
    // Fixed: Recycle=Yes → free: Fav, Tags
    case "restore-from-recycle": return [DIM_FAVOURITES, DIM_TAGS];
    // Fixed: Fav=No → free: Recycle, Tags
    case "move-to-favourites":   return [DIM_RECYCLE, DIM_TAGS];
    // No fixed dim → free: Fav, Recycle, Tags (all 3)
    case "attach-tags":          return [DIM_FAVOURITES, DIM_RECYCLE, DIM_TAGS];
  }
}

function getActionMeta(actionType: BulkActionType) {
  switch (actionType) {
    case "move-to-recycle":
      return {
        title: "Move to Recycle Bin",
        subtitle: "Choose which active clips to soft-delete.",
        icon: <IconTrash size={16} className="text-rose-400" />,
        accentClass: "bg-rose-500 hover:bg-rose-600 shadow-rose-500/20",
        progressLabel: "Moving clips to recycle bin…",
        doneLabel: "Moved to Recycle Bin",
        doneColor: "text-rose-400",
        doneBg: "bg-rose-500/10 border-rose-500/25",
      };
    case "restore-from-recycle":
      return {
        title: "Restore From Recycle Bin",
        subtitle: "Choose which deleted clips to restore.",
        icon: (
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-emerald-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
          </svg>
        ),
        accentClass: "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20",
        progressLabel: "Restoring clips…",
        doneLabel: "Clips Restored",
        doneColor: "text-emerald-400",
        doneBg: "bg-emerald-500/10 border-emerald-500/25",
      };
    case "move-to-favourites":
      return {
        title: "Move to Favourites",
        subtitle: "Choose which non-favourite clips to mark as favourite.",
        icon: <IconStar size={16} className="text-amber-400" />,
        accentClass: "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20",
        progressLabel: "Marking clips as favourite…",
        doneLabel: "Marked as Favourite",
        doneColor: "text-amber-400",
        doneBg: "bg-amber-500/10 border-amber-500/25",
      };
    case "attach-tags":
      return {
        title: "Attach Tags",
        subtitle: "Choose clips and tags to attach.",
        icon: <IconTag size={16} className="text-brand-400" />,
        accentClass: "bg-brand-500 hover:bg-brand-600 shadow-brand-500/20",
        progressLabel: "Attaching tags to clips…",
        doneLabel: "Tags Attached",
        doneColor: "text-brand-400",
        doneBg: "bg-brand-500/10 border-brand-500/25",
      };
  }
}

// ─── Specific Tags applicability ──────────────────────────────────────────────

function specificTagsApplicable(actionType: BulkActionType, sf: ScopeFilter): boolean {
  // For "attach-tags": Level 3 tag picker = target tags to ATTACH (always visible)
  if (actionType === "attach-tags") return true;
  // For "move-to-recycle" / "restore-from-recycle" / "move-to-favourites":
  // Specific Tags picker for sub-filter is only shown when havingTags ≠ "no"
  return sf.havingTags !== "no";
}

// ─── Build filter query for getClips ─────────────────────────────────────────

function buildGetClipsQuery(
  actionType: BulkActionType,
  sf: ScopeFilter,
  textFilter?: string,
  dateFrom?: string,
  dateTo?: string
) {
  const base: any = { limit: 100000 };

  // Level 0 filters: Text Wise & Date Range
  if (textFilter && textFilter.trim()) {
    base.search = textFilter.trim();
  }
  if (dateFrom) {
    base.dateFrom = dateFrom;
  }
  if (dateTo) {
    base.dateTo = dateTo;
  }

  // Fixed dimension per action
  switch (actionType) {
    case "move-to-recycle":
      base.isDeleted = false;
      break;
    case "restore-from-recycle":
      base.isDeleted = true;
      break;
    case "move-to-favourites":
      base.isFavorite = false;
      base.isDeleted = false;
      break;
    case "attach-tags":
      // no fixed filter — all clips eligible
      break;
  }

  // Level 2 sub-filters
  if (sf.favourites === "yes") base.isFavorite = true;
  else if (sf.favourites === "no") base.isFavorite = false;

  if (sf.recycle === "yes") base.isDeleted = true;
  else if (sf.recycle === "no") base.isDeleted = false;

  if (sf.havingTags === "yes") base.hasTags = true;
  else if (sf.havingTags === "no") base.hasTags = false;

  // Level 3 specific tags sub-filter (for selection, not for attach-tags action)
  if (actionType !== "attach-tags" && sf.specificTags.length > 0 && sf.specificTagsMode) {
    if (sf.specificTagsMode === "include") base.includeTags = sf.specificTags;
    else base.excludeTags = sf.specificTags;
  }

  return base;
}

// ─── Combination label ────────────────────────────────────────────────────────

function buildCombinationLabel(
  actionType: BulkActionType,
  sf: ScopeFilter,
  textFilter?: string,
  dateFrom?: string,
  dateTo?: string
): string {
  const bases: Record<BulkActionType, string> = {
    "move-to-recycle": "Active (non-deleted) clips",
    "restore-from-recycle": "Deleted (recycle bin) clips",
    "move-to-favourites": "Non-favourite active clips",
    "attach-tags": "All clips",
  };
  const base = bases[actionType];
  const parts: string[] = [];

  if (textFilter && textFilter.trim()) {
    parts.push(`matching text "${textFilter.trim()}"`);
  }
  if (dateFrom && dateTo) {
    parts.push(`created between ${dateFrom} and ${dateTo}`);
  } else if (dateFrom) {
    parts.push(`created after ${dateFrom}`);
  } else if (dateTo) {
    parts.push(`created before ${dateTo}`);
  }

  // Fav (only relevant if not fixed by action)
  if (actionType !== "move-to-favourites") {
    if (sf.favourites === "yes") parts.push("that are favorited");
    else if (sf.favourites === "no") parts.push("that are NOT favorited");
  }
  // Recycle (only relevant if not fixed by action)
  if (actionType !== "move-to-recycle" && actionType !== "restore-from-recycle") {
    if (sf.recycle === "yes") parts.push("in the recycle bin");
    else if (sf.recycle === "no") parts.push("NOT in the recycle bin");
  }
  // Tags
  if (sf.havingTags === "yes") parts.push("having at least one tag");
  else if (sf.havingTags === "no") parts.push("having NO tags");

  // Specific tags sub-filter (only non-attach actions)
  if (actionType !== "attach-tags" && sf.specificTags.length > 0 && sf.specificTagsMode) {
    const n = sf.specificTags.length;
    if (sf.specificTagsMode === "include") parts.push(`matching ${n} specific tag${n > 1 ? "s" : ""}`);
    else parts.push(`NOT matching ${n} specific tag${n > 1 ? "s" : ""}`);
  }

  return parts.length === 0 ? base : `${base} ${parts.join(", ")}`;
}

// ─── ToggleChip ───────────────────────────────────────────────────────────────

const colorMap: Record<ChipColor, { on: string; off: string }> = {
  brand:   { on: "bg-brand-500/15 border-brand-500/50 text-brand-300",     off: "bg-surface-900 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200" },
  star:    { on: "bg-amber-500/15 border-amber-500/50 text-amber-300",      off: "bg-surface-900 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200" },
  rose:    { on: "bg-rose-500/15 border-rose-500/50 text-rose-300",         off: "bg-surface-900 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200" },
  emerald: { on: "bg-emerald-500/15 border-emerald-500/50 text-emerald-300", off: "bg-surface-900 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200" },
  violet:  { on: "bg-violet-500/15 border-violet-500/50 text-violet-300",   off: "bg-surface-900 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200" },
};

const ToggleChip: React.FC<{
  label: string;
  active: boolean;
  color: ChipColor;
  onClick: () => void;
}> = ({ label, active, color, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-all duration-150 cursor-pointer ${
      active ? colorMap[color].on : colorMap[color].off
    }`}
  >
    {label}
    {active && <IconCheck size={10} className="shrink-0 ml-0.5" />}
  </button>
);

// ─── Tag chip ─────────────────────────────────────────────────────────────────

const TagChip: React.FC<{
  tag: Tag;
  active: boolean;
  onClick: () => void;
}> = ({ tag, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all duration-150 cursor-pointer ${
      active
        ? "border-brand-500/50 bg-brand-500/10 text-brand-300"
        : "border-white/8 bg-surface-900 text-gray-400 hover:border-white/20 hover:text-gray-200"
    }`}
  >
    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
    {tag.name}
    {active && <IconCheck size={9} className="shrink-0 text-brand-400" />}
  </button>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const BulkActionWizard: React.FC<BulkActionWizardProps> = ({ isOpen, onClose, actionType }) => {
  const tags = useClipStore((s) => s.tags);
  const loadClips = useClipStore((s) => s.loadClips);

  const [sf, setSf] = useState<ScopeFilter>(DEFAULT_SCOPE_FILTER);
  // For attach-tags: which tags to attach (separate from specificTags sub-filter)
  const [attachTagIds, setAttachTagIds] = useState<string[]>([]);
  const [textFilter, setTextFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [matchingCount, setMatchingCount] = useState<number | null>(null);
  const [status, setStatus] = useState<WizardStatus>("config");
  const [progress, setProgress] = useState(0);
  const [affectedCount, setAffectedCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const meta = getActionMeta(actionType);
  const dims = getDimsForAction(actionType);
  const showSpecificTags = specificTagsApplicable(actionType, sf);

  // Reset state when wizard opens/actionType changes
  useEffect(() => {
    if (isOpen) {
      setSf(DEFAULT_SCOPE_FILTER);
      setAttachTagIds([]);
      setTextFilter("");
      setDateFrom("");
      setDateTo("");
      setMatchingCount(null);
      setStatus("config");
      setProgress(0);
      setAffectedCount(0);
      setErrorMsg("");
    }
  }, [isOpen, actionType]);

  // Fetch matching count live preview
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const fetchCount = async () => {
      try {
        const query = buildGetClipsQuery(actionType, sf, textFilter, dateFrom, dateTo);
        const res = await window.clipAPI.getClips(query);
        const clips = res?.clips ?? (Array.isArray(res) ? res : []);
        if (active) {
          setMatchingCount(clips.length);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchCount();
    return () => {
      active = false;
    };
  }, [isOpen, actionType, sf, textFilter, dateFrom, dateTo]);

  const toggleDim = (key: DimKey, value: "yes" | "no") => {
    setSf((prev) => {
      const next = prev[key] === value ? null : value;
      const updated = { ...prev, [key]: next };
      if (key === "havingTags" && next === "no") {
        updated.specificTags = [];
        updated.specificTagsMode = null;
      }
      return updated;
    });
  };

  const toggleSpecificTag = (tagId: string) => {
    setSf((prev) => {
      const already = prev.specificTags.includes(tagId);
      const next = already ? prev.specificTags.filter((t) => t !== tagId) : [...prev.specificTags, tagId];
      const mode = prev.specificTagsMode ?? (next.length > 0 ? "include" : null);
      return { ...prev, specificTags: next, specificTagsMode: next.length === 0 ? null : mode };
    });
  };

  const setSpecificTagsMode = (mode: "include" | "exclude") => {
    setSf((prev) => ({ ...prev, specificTagsMode: prev.specificTags.length > 0 ? mode : null }));
  };

  const toggleAttachTag = (tagId: string) => {
    setAttachTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  // Validation: for attach-tags, at least one tag must be selected
  const canProceed = useMemo(() => {
    if (actionType === "attach-tags" && attachTagIds.length === 0) return false;
    return true;
  }, [actionType, attachTagIds]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (sf.favourites !== null) count++;
    if (sf.recycle !== null) count++;
    if (sf.havingTags !== null) count++;
    if (sf.specificTags.length > 0) count++;
    if (textFilter.trim()) count++;
    if (dateFrom) count++;
    if (dateTo) count++;
    return count;
  }, [sf, textFilter, dateFrom, dateTo]);

  const handleExecute = async () => {
    setStatus("progress");
    setProgress(5);
    setErrorMsg("");

    try {
      // Step 1: Fetch matching clips
      const query = buildGetClipsQuery(actionType, sf, textFilter, dateFrom, dateTo);
      setProgress(20);

      const res = await window.clipAPI.getClips(query);
      const clips = res?.clips ?? (Array.isArray(res) ? res : []);

      if (clips.length === 0) {
        setAffectedCount(0);
        setStatus("done");
        return;
      }

      setProgress(35);
      const total = clips.length;
      let processed = 0;

      // Step 2: Apply action to each clip
      for (const clip of clips) {
        let updated = { ...clip };

        switch (actionType) {
          case "move-to-recycle":
            updated.isDeleted = true;
            updated.deletedAt = new Date().toISOString();
            break;
          case "restore-from-recycle":
            updated.isDeleted = false;
            updated.deletedAt = undefined;
            break;
          case "move-to-favourites":
            updated.isFavorite = true;
            break;
          case "attach-tags": {
            const existingTags = clip.tags ?? [];
            const merged = Array.from(new Set([...existingTags, ...attachTagIds]));
            updated.tags = merged;
            break;
          }
        }

        updated.updatedAt = new Date().toISOString();
        await window.clipAPI.updateClip(updated);
        processed++;
        setProgress(35 + Math.round((processed / total) * 60));
      }

      setProgress(100);
      setAffectedCount(total);
      await loadClips();
      setStatus("done");
    } catch (err: any) {
      console.error("[BulkActionWizard] Error:", err);
      setErrorMsg(err.message || "An unexpected error occurred.");
      setStatus("error");
    }
  };

  const handleClose = () => {
    setStatus("config");
    setSf(DEFAULT_SCOPE_FILTER);
    setAttachTagIds([]);
    setTextFilter("");
    setDateFrom("");
    setDateTo("");
    setMatchingCount(null);
    setProgress(0);
    setAffectedCount(0);
    setErrorMsg("");
    onClose();
  };

  const combinationLabel = buildCombinationLabel(actionType, sf, textFilter, dateFrom, dateTo);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={status === "progress" ? () => {} : handleClose}
      title={meta.title}
      maxWidth="max-w-xl"
      overflowVisible={false}
      contentClassName=""
    >
      <div className="space-y-5">
        <AnimatePresence mode="wait">

          {/* ── CONFIG ─────────────────────────────────────────────────── */}
          {status === "config" && (
            <motion.div
              key="config"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-5"
            >
              {/* Action header */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-800/60 border border-white/6">
                <div className="w-9 h-9 rounded-lg bg-surface-900 border border-white/8 flex items-center justify-center shrink-0">
                  {meta.icon}
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-gray-200">{meta.title}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{meta.subtitle}</p>
                </div>
              </div>

              {/* ── For attach-tags: pick which tags to attach (Level 0) ── */}
              {actionType === "attach-tags" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      Level 0 — Tags to Attach
                    </span>
                    {attachTagIds.length > 0 && (
                      <span className="ml-auto text-[10px] text-gray-500 hover:text-rose-400 transition-colors cursor-pointer" onClick={() => setAttachTagIds([])}>
                        Clear
                      </span>
                    )}
                  </div>
                  {tags.length === 0 ? (
                    <p className="text-[11px] text-gray-600 pl-1">No tags available. Create tags first.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto dialog-scrollbar">
                      {tags.map((tag) => (
                        <TagChip
                          key={tag.id}
                          tag={tag}
                          active={attachTagIds.includes(tag.id)}
                          onClick={() => toggleAttachTag(tag.id)}
                        />
                      ))}
                    </div>
                  )}
                  {attachTagIds.length === 0 && (
                    <p className="text-[10px] text-rose-400/70 pl-1">Select at least one tag to attach.</p>
                  )}
                </div>
              )}

              {/* ── Level 2: Sub-filters (Dimension toggles + Text & Date Filters) ── */}
              <div className="space-y-4 bg-surface-900/40 border border-white/5 p-4 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      {actionType === "attach-tags" ? "Level 1 — Which Clips" : "Level 2 — Sub-filters"}
                    </span>
                    {activeFilterCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-md bg-brand-500/20 text-brand-300 text-[9px] font-bold">
                        {activeFilterCount} active
                      </span>
                    )}
                  </div>
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSf(DEFAULT_SCOPE_FILTER);
                        setTextFilter("");
                        setDateFrom("");
                        setDateTo("");
                      }}
                      className="text-[10px] text-gray-500 hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {/* Text & Date Filters */}
                <div className="grid grid-cols-2 gap-3.5 border-b border-white/5 pb-3.5">
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium pl-0.5">
                      Search Text
                    </span>
                    <input
                      type="text"
                      placeholder="Search query in clips..."
                      value={textFilter}
                      onChange={(e) => setTextFilter(e.target.value)}
                      className="w-full bg-surface-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium pl-0.5">
                        Date From
                      </span>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-full bg-surface-900 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-brand-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium pl-0.5">
                        Date To
                      </span>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-full bg-surface-900 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Dimension toggles */}
                <div className="space-y-3">
                  {dims.map((dim) => (
                    <div key={dim.key} className="space-y-1.5">
                      <span className="text-[10px] text-gray-600 uppercase tracking-wider font-medium pl-0.5">
                        {dim.label}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <ToggleChip
                          label={dim.yesLabel}
                          active={sf[dim.key] === "yes"}
                          color={dim.yesColor}
                          onClick={() => toggleDim(dim.key, "yes")}
                        />
                        <ToggleChip
                          label={dim.noLabel}
                          active={sf[dim.key] === "no"}
                          color={dim.noColor}
                          onClick={() => toggleDim(dim.key, "no")}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Level 3: Specific tags sub-filter (non-attach actions) ─ */}
              {showSpecificTags && actionType !== "attach-tags" && tags.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                        Level 3 — Specific Tags
                      </span>
                    </div>
                    {sf.specificTags.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSf((p) => ({ ...p, specificTags: [], specificTagsMode: null }))}
                        className="text-[10px] text-gray-500 hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        Clear tags
                      </button>
                    )}
                  </div>

                  {sf.specificTags.length > 0 && (
                    <div className="flex gap-1.5">
                      <ToggleChip
                        label="From Selection"
                        active={sf.specificTagsMode === "include"}
                        color="emerald"
                        onClick={() => setSpecificTagsMode("include")}
                      />
                      <ToggleChip
                        label="Exclude Selection"
                        active={sf.specificTagsMode === "exclude"}
                        color="rose"
                        onClick={() => setSpecificTagsMode("exclude")}
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto dialog-scrollbar">
                    {tags.map((tag) => (
                      <TagChip
                        key={tag.id}
                        tag={tag}
                        active={sf.specificTags.includes(tag.id)}
                        onClick={() => toggleSpecificTag(tag.id)}
                      />
                    ))}
                  </div>

                  {sf.specificTags.length === 0 && (
                    <p className="text-[10px] text-gray-600 pl-0.5">
                      Select tag(s) then choose include or exclude mode.
                    </p>
                  )}
                </div>
              )}

              {/* ── Active combination summary ────────────────────────────── */}
              <div className="px-3 py-2.5 rounded-lg bg-surface-900/60 border border-white/5 space-y-1">
                <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider block">
                  Action target
                </span>
                <span className="text-[11px] text-gray-300 leading-relaxed block">
                  {combinationLabel}
                </span>
                {actionType === "attach-tags" && attachTagIds.length > 0 && (
                  <span className="text-[11px] text-brand-300 leading-relaxed block mt-1">
                    → Attach {attachTagIds.length} tag{attachTagIds.length > 1 ? "s" : ""}: {
                      attachTagIds.map((id) => tags.find((t) => t.id === id)?.name ?? id).join(", ")
                    }
                  </span>
                )}
              </div>

              {/* ── Action buttons ──────────────────────────────────────── */}
              <div className="pt-1 flex gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-700 bg-surface-800 text-gray-300 hover:bg-surface-700 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!canProceed}
                  onClick={handleExecute}
                  className={`flex-1 px-4 py-2.5 rounded-xl text-white text-xs font-bold uppercase tracking-wider shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${meta.accentClass}`}
                >
                  Execute Action {matchingCount !== null ? `(${matchingCount} clips)` : ""}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── PROGRESS ───────────────────────────────────────────────── */}
          {status === "progress" && (
            <motion.div
              key="progress"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-6 space-y-5"
            >
              <div className="relative flex items-center justify-center w-16 h-16">
                <div className="absolute inset-0 border-4 border-brand-500/10 rounded-full" />
                <div className="absolute inset-0 border-4 border-t-brand-500 rounded-full animate-spin" />
                <div className="text-brand-400">{meta.icon}</div>
              </div>
              <div className="text-center space-y-1.5 w-full max-w-sm">
                <h4 className="text-sm font-bold text-white">{meta.progressLabel}</h4>
                <p className="text-[11px] text-gray-500">Please wait while records are being updated.</p>
                <div className="relative w-full h-1.5 bg-surface-900 rounded-full overflow-hidden border border-white/5 mt-3">
                  <motion.div
                    className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-brand-500 to-indigo-500"
                    style={{ width: `${progress}%` }}
                    transition={{ ease: "easeInOut" }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-gray-500 pt-0.5">
                  <span>PROCESSING</span>
                  <span>{progress}%</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── DONE ───────────────────────────────────────────────────── */}
          {status === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              <div className={`flex items-center gap-3 p-4 rounded-xl border ${meta.doneBg}`}>
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/5 border border-white/10 shrink-0">
                  <IconCheck size={18} className={meta.doneColor} />
                </div>
                <div>
                  <p className={`text-sm font-bold ${meta.doneColor}`}>{meta.doneLabel}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {affectedCount === 0
                      ? "No clips matched your filter criteria."
                      : `${affectedCount} clip${affectedCount > 1 ? "s" : ""} were successfully updated.`}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStatus("config")}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-700 bg-surface-800 text-gray-300 hover:bg-surface-700 text-xs font-semibold tracking-wide transition-colors cursor-pointer"
                >
                  Run Again
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gray-700 text-white hover:bg-gray-600 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          )}

          {/* ── ERROR ──────────────────────────────────────────────────── */}
          {status === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              <div className="flex flex-col items-center justify-center py-4 text-center space-y-3">
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400">
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-rose-400">Action Failed</h4>
                  <p className="text-xs text-gray-500 mt-1.5 max-w-sm leading-relaxed">{errorMsg}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStatus("config")}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-700 bg-surface-800 text-gray-300 hover:bg-surface-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </Dialog>
  );
};
