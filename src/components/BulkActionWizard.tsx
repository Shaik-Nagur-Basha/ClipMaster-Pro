import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Dialog from "./Dialog";
import {
  IconCheck,
  IconTag,
  IconStar,
  IconTrash,
  IconSearch,
  IconX,
  IconArrowUp,
  IconArrowDown,
} from "./Icons";
import type { Tag, ScopeFilter } from "../types";
import { useClipStore } from "../store/useClipStore";
import FormattedContent from "./FormattedContent";
import TagBadge from "./TagBadge";

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
  // Show specific tags section ONLY when "Having Tags" is explicitly selected
  return sf.havingTags === "yes";
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

  // Level 3 specific tags sub-filter (for selection)
  if (sf.specificTags.length > 0 && sf.specificTagsMode) {
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
  dateTo?: string,
  minDateBound?: string,
  maxDateBound?: string
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

  const isDefaultDateFrom = !dateFrom || dateFrom === minDateBound;
  const isDefaultDateTo = !dateTo || dateTo === maxDateBound;

  if (!isDefaultDateFrom && !isDefaultDateTo) {
    parts.push(`created between ${dateFrom} and ${dateTo}`);
  } else if (!isDefaultDateFrom) {
    parts.push(`created after ${dateFrom}`);
  } else if (!isDefaultDateTo) {
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

  // Specific tags sub-filter
  if (sf.specificTags.length > 0 && sf.specificTagsMode) {
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
// Now rendered via TagBadge (matches FilterPanel styling exactly)

const ModalScrollButtons: React.FC<{
  containerRef: React.RefObject<HTMLDivElement>;
}> = ({ containerRef }) => {
  const [showTopButton, setShowTopButton] = useState(false);
  const [showBottomButton, setShowBottomButton] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtTop = scrollTop < 20;
      const isAtBottom = scrollTop + clientHeight > scrollHeight - 20;

      setShowTopButton(!isAtTop);
      setShowBottomButton(!isAtBottom);
    };

    container.addEventListener("scroll", handleScroll);
    const timer = setTimeout(handleScroll, 100);

    return () => {
      container.removeEventListener("scroll", handleScroll);
      clearTimeout(timer);
    };
  }, [containerRef]);

  const scrollToTop = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="absolute right-3 bottom-3 flex flex-col gap-2 pointer-events-none z-50">
      <AnimatePresence>
        {showTopButton && (
          <motion.button
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.4 }}
            onClick={scrollToTop}
            className="pointer-events-auto w-7 h-7 rounded-md bg-black/80 hover:bg-black/95 text-gray-400 hover:text-brand-300 flex items-center justify-center transition-all duration-150 border border-white/10 backdrop-blur-sm cursor-pointer"
          >
            <IconArrowUp size={12} />
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showBottomButton && (
          <motion.button
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.4 }}
            onClick={scrollToBottom}
            className="pointer-events-auto w-7 h-7 rounded-md bg-black/80 hover:bg-black/95 text-gray-400 hover:text-brand-300 flex items-center justify-center transition-all duration-150 border border-white/10 backdrop-blur-sm cursor-pointer"
          >
            <IconArrowDown size={12} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

const PreviewLimitDropdown: React.FC<{
  value: number;
  onChange: (v: number) => void;
}> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <div className="flex items-center gap-1.5 normal-case font-normal">
        <span className="text-gray-500 font-medium text-[10px]">Show:</span>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="bg-black/95 border border-gray-700 text-gray-300 rounded-md px-2 py-0.5 hover:bg-surface-800 hover:text-white transition-colors focus:outline-none cursor-pointer text-[10px] font-semibold flex items-center gap-1 min-w-[32px] justify-center"
        >
          {value}
          <span className="text-gray-500 text-[8px]">▼</span>
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.1 }}
            className="absolute left-1/2 -translate-x-1/2 z-50 min-w-[40px] bg-surface-800 border border-gray-700 rounded-md shadow-lg p-1 flex flex-col gap-1 top-full mt-1"
          >
            {[3, 5, 10].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                }}
                className={`w-full text-center px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                  value === opt
                    ? "bg-brand-500/20 text-brand-400 border border-brand-500/30"
                    : "text-gray-400 hover:bg-surface-700 hover:text-white border border-transparent"
                }`}
              >
                {opt}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

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
  const previewListRef = React.useRef<HTMLDivElement>(null);

  // Dialog and Preview States
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [matchingClips, setMatchingClips] = useState<any[]>([]);
  const [attachTagsSearch, setAttachTagsSearch] = useState("");
  const [specificTagsSearch, setSpecificTagsSearch] = useState("");
  const [minDateBound, setMinDateBound] = useState("");
  const [maxDateBound, setMaxDateBound] = useState("");
  const [textSearchPreviewCount, setTextSearchPreviewCount] = useState(0);
  const [textSearchPreviewClips, setTextSearchPreviewClips] = useState<any[]>([]);
  const [previewLimit, setPreviewLimit] = useState<number>(3);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const meta = getActionMeta(actionType);
  const dims = getDimsForAction(actionType);
  const showSpecificTags = specificTagsApplicable(actionType, sf);

  // tagPickerClips: fetched WITHOUT specificTags filter so the tag list stays stable
  // regardless of which specific tags are currently selected.
  const [tagPickerClips, setTagPickerClips] = useState<any[]>([]);

  // Compute per-tag clip counts from tagPickerClips (ignores specificTags selection)
  const liveTagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    tagPickerClips.forEach((clip: any) => {
      if (clip.tags && Array.isArray(clip.tags)) {
        clip.tags.forEach((tagId: string) => {
          counts[tagId] = (counts[tagId] ?? 0) + 1;
        });
      }
    });
    return counts;
  }, [tagPickerClips]);

  // Tags sorted by live count descending, only those with ≥1 clip in current context
  const liveTagsSorted = useMemo(() => {
    return [...tags]
      .filter((t) => (liveTagCounts[t.id] ?? 0) >= 1)
      .sort((a, b) => (liveTagCounts[b.id] ?? 0) - (liveTagCounts[a.id] ?? 0));
  }, [tags, liveTagCounts]);

  // Unfiltered base clips for the current action type (to compute stable tag counts & order)
  const [baseActionClips, setBaseActionClips] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setBaseActionClips([]);
      return;
    }
    let active = true;
    const fetchBaseClips = async () => {
      try {
        const query = buildGetClipsQuery(actionType, DEFAULT_SCOPE_FILTER, "", "", "");
        const res = await window.clipAPI.getClips(query);
        const clips = res?.clips ?? (Array.isArray(res) ? res : []);
        if (active) setBaseActionClips(clips);
      } catch (err) {
        console.error(err);
      }
    };
    fetchBaseClips();
    return () => { active = false; };
  }, [isOpen, actionType]);

  // Compute stable per-tag clip counts from baseActionClips (ignores user-applied filters)
  const baseTagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    baseActionClips.forEach((clip: any) => {
      if (clip.tags && Array.isArray(clip.tags)) {
        clip.tags.forEach((tagId: string) => {
          counts[tagId] = (counts[tagId] ?? 0) + 1;
        });
      }
    });
    return counts;
  }, [baseActionClips]);

  // All system tags sorted by base count descending
  const allTagsSortedByBaseCount = useMemo(() => {
    return [...tags]
      .sort((a, b) => (baseTagCounts[b.id] ?? 0) - (baseTagCounts[a.id] ?? 0));
  }, [tags, baseTagCounts]);

  // Clear date ranges when sub-filters change so they can be re-calculated with new defaults
  useEffect(() => {
    if (isOpen) {
      setDateFrom("");
      setDateTo("");
    }
  }, [sf, actionType]);

  // Reset state when wizard opens/actionType changes
  useEffect(() => {
    if (isOpen) {
      setSf(DEFAULT_SCOPE_FILTER);
      setAttachTagIds([]);
      setTextFilter("");
      setDateFrom("");
      setDateTo("");
      setMatchingCount(null);
      setMatchingClips([]);
      setStatus("config");
      setProgress(0);
      setAffectedCount(0);
      setErrorMsg("");
      setShowPreviewDialog(false);
      setShowConfirmDialog(false);
      setAttachTagsSearch("");
      setSpecificTagsSearch("");
      setMinDateBound("");
      setMaxDateBound("");
      setTextSearchPreviewCount(0);
      setPreviewLimit(3);
      setTextSearchPreviewClips([]);
    }
  }, [isOpen, actionType]);

  // Fetch dynamic bounds for date picker — based on base context only, NOT specific tags or dates
  useEffect(() => {
    if (!isOpen) {
      setMinDateBound("");
      setMaxDateBound("");
      return;
    }
    let active = true;
    const fetchBounds = async () => {
      try {
        // Strip specificTags so bounds don't narrow when tags are selected
        const sfForBounds = { ...sf, specificTags: [], specificTagsMode: null };
        const query = buildGetClipsQuery(actionType, sfForBounds, textFilter, "", "");
        const res = await window.clipAPI.getClips(query);
        const clips = res?.clips ?? (Array.isArray(res) ? res : []);
        if (active) {
          const timestamps = clips
            .map((c: any) => c.timestamp || c.createdAt)
            .filter(Boolean)
            .map((t: string) => new Date(t).getTime());
          if (timestamps.length > 0) {
            const minTime = Math.min(...timestamps);
            const maxTime = Math.max(...timestamps);
            const minStr = new Date(minTime).toISOString().split("T")[0];
            const maxStr = new Date(maxTime).toISOString().split("T")[0];
            const oldMin = minDateBound;
            const oldMax = maxDateBound;
            setMinDateBound(minStr);
            setMaxDateBound(maxStr);
            setDateFrom((prev) => (prev === oldMin || !prev ? minStr : prev));
            setDateTo((prev) => (prev === oldMax || !prev ? maxStr : prev));
          } else {
            setMinDateBound("");
            setMaxDateBound("");
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchBounds();
    return () => {
      active = false;
    };
  // Exclude specificTags from deps — tag selection must NOT change date bounds
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, actionType, sf.favourites, sf.recycle, sf.havingTags, textFilter, minDateBound, maxDateBound]);

  // Fetch text search preview clips (1-3 clips) toggled right below text search input
  useEffect(() => {
    if (!isOpen || !textFilter.trim()) {
      setTextSearchPreviewClips([]);
      setTextSearchPreviewCount(0);
      return;
    }
    let active = true;
    const fetchTextPreview = async () => {
      try {
        const query = buildGetClipsQuery(actionType, sf, textFilter, "", "");
        const res = await window.clipAPI.getClips(query);
        const clips = res?.clips ?? (Array.isArray(res) ? res : []);
        if (active) {
          setTextSearchPreviewClips(clips.slice(0, 3));
          setTextSearchPreviewCount(clips.length);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchTextPreview();
    return () => {
      active = false;
    };
  }, [isOpen, actionType, sf, textFilter]);

  // Reset count immediately when sf changes so UI reflects change
  useEffect(() => {
    if (isOpen) {
      setMatchingCount(null);
      setMatchingClips([]);
    }
  }, [sf]);

  // Fetch tag picker clips WITHOUT specificTags or date filters
  // Tag availability should not change when tags are selected or dates are adjusted
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const fetchPickerClips = async () => {
      try {
        // No specificTags, no date filters — show all tags for the base action context
        const sfForPicker = { ...sf, specificTags: [], specificTagsMode: null };
        const query = buildGetClipsQuery(actionType, sfForPicker, textFilter, "", "");
        const res = await window.clipAPI.getClips(query);
        const clips = res?.clips ?? (Array.isArray(res) ? res : []);
        if (active) setTagPickerClips(clips);
      } catch (err) {
        console.error(err);
      }
    };
    fetchPickerClips();
    return () => { active = false; };
  // No date deps, no specificTags deps — tag list must remain stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, actionType, sf.favourites, sf.recycle, sf.havingTags, textFilter]);

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
          setMatchingClips(clips);
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
    if (dateFrom && dateFrom !== minDateBound) count++;
    if (dateTo && dateTo !== maxDateBound) count++;
    return count;
  }, [sf, textFilter, dateFrom, dateTo, minDateBound, maxDateBound]);

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

  const combinationLabel = buildCombinationLabel(actionType, sf, textFilter, dateFrom, dateTo, minDateBound, maxDateBound);

  return (
    <>
      <Dialog
      isOpen={isOpen}
      onClose={status === "progress" ? () => {} : handleClose}
      title={
        <span className="flex items-center gap-2">
          <span className="text-brand-400 shrink-0">{meta.icon}</span>
          <span className="flex flex-col">
            <span className="text-sm font-bold text-white tracking-wide">{meta.title}</span>
            <span className="text-[10px] text-gray-500 font-normal normal-case">{meta.subtitle}</span>
          </span>
        </span>
      }
      headerActionRight={
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setSf(DEFAULT_SCOPE_FILTER);
                setTextFilter("");
                setDateFrom(minDateBound);
                setDateTo(maxDateBound);
              }}
              className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-colors px-2.5 py-0.5 rounded-md cursor-pointer"
            >
              Clear All
            </button>
          )}
          {matchingCount !== null && (
            <button
              type="button"
              onClick={() => setShowPreviewDialog(true)}
              className="text-[11px] font-semibold text-brand-300 bg-brand-500/10 border border-brand-500/20 hover:bg-brand-500/20 transition-colors px-2.5 py-0.5 rounded-md font-mono cursor-pointer"
            >
              {matchingCount} clips
            </button>
          )}
        </div>
      }
      maxWidth="max-w-xl"
      overflowVisible={false}
      contentClassName="hide-scrollbar"
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
              {/* ── For attach-tags: pick which tags to attach ── */}
              {actionType === "attach-tags" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                        Tags to Attach
                      </span>
                    </div>
                    
                    {/* Dashboard styled tag search inline opposite to title */}
                    <div className="relative flex items-center group max-w-[200px] w-full">
                      <div className="absolute left-3 text-gray-655 group-focus-within:text-brand-400 transition-colors pointer-events-none duration-150">
                        <IconSearch size={12} />
                      </div>
                      <input
                        type="text"
                        placeholder="Search tags..."
                        value={attachTagsSearch}
                        onChange={(e) => setAttachTagsSearch(e.target.value)}
                        className="w-full bg-transparent border-0 border-b border-gray-600 hover:border-gray-500 focus:border-brand-500 focus:ring-0 focus:outline-none pl-8 pr-8 py-1 text-[11px] text-white/85 placeholder-gray-600 transition-colors duration-150"
                      />
                      {attachTagsSearch && (
                        <button
                          type="button"
                          onClick={() => setAttachTagsSearch("")}
                          className="absolute right-2 p-1 text-gray-600 hover:text-gray-400 transition-colors duration-150"
                          title="Clear search"
                        >
                          <IconX size={10} />
                        </button>
                      )}
                    </div>
                  </div>

                  {allTagsSortedByBaseCount.length === 0 ? (
                    <p className="text-[11px] text-gray-600 pl-1">
                      No tags available.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto dialog-scrollbar">
                      {allTagsSortedByBaseCount
                        .filter((t) => t.name.toLowerCase().includes(attachTagsSearch.toLowerCase()))
                        .map((tag) => (
                          <TagBadge
                            key={tag.id}
                            tag={tag}
                            size="sm"
                            active={attachTagIds.includes(tag.id)}
                            count={baseTagCounts[tag.id]}
                            onClick={() => toggleAttachTag(tag.id)}
                          />
                        ))}
                    </div>
                  )}
                  {attachTagIds.length === 0 ? (
                    <p className="text-[10px] text-rose-400/70 pl-1">Select at least one tag to attach.</p>
                  ) : (
                    <div className="flex items-center justify-between text-[10px] text-gray-500">
                      <span>{attachTagIds.length} tag(s) selected</span>
                      <span className="hover:text-rose-400 transition-colors cursor-pointer" onClick={() => setAttachTagIds([])}>
                        Clear selection
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* ── Sub-filters (Dimension toggles + Text & Date Filters) ── */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      {actionType === "attach-tags" ? "Which Clips" : "Sub-filters"}
                    </span>
                    {activeFilterCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-md bg-brand-500/20 text-brand-300 text-[9px] font-bold">
                        {activeFilterCount} active
                      </span>
                    )}
                  </div>
                </div>

                {/* Text & Date Filters */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1.5 relative">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium pl-0.5">
                      Search Text
                    </span>
                    <div className="relative flex items-center group w-full">
                      <div className="absolute left-3 text-gray-650 group-focus-within:text-brand-400 transition-colors pointer-events-none duration-150">
                        <IconSearch size={14} />
                      </div>
                      <input
                        type="text"
                        placeholder="Search query in clips..."
                        value={textFilter}
                        onChange={(e) => setTextFilter(e.target.value)}
                        onFocus={() => setIsSearchFocused(true)}
                        onBlur={() => setIsSearchFocused(false)}
                        className="w-full bg-transparent border-0 border-b border-gray-600 hover:border-gray-500 focus:border-brand-500 focus:ring-0 focus:outline-none pl-9 pr-9 py-1.5 text-xs text-white/85 placeholder-gray-600 transition-colors duration-150"
                      />
                      {textFilter && (
                        <button
                          type="button"
                          onClick={() => setTextFilter("")}
                          className="absolute right-2 p-1 text-gray-600 hover:text-gray-400 transition-colors duration-150"
                          title="Clear search"
                        >
                          <IconX size={12} />
                        </button>
                      )}
                    </div>

                    {/* Text Search Instant Matches Dropdown below the input */}
                    <AnimatePresence>
                      {isSearchFocused && textFilter.trim() && textSearchPreviewCount > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          className="absolute top-full left-0 right-0 z-50 mt-1 bg-surface-900 border border-white/10 rounded-lg p-2.5 shadow-2xl space-y-1.5 max-h-[160px] overflow-y-auto hide-scrollbar"
                        >
                          <div className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider flex justify-between">
                            <span>Text matches</span>
                            <span className="font-mono text-brand-400">{textSearchPreviewCount} clips</span>
                          </div>
                          <div className="space-y-1">
                            {textSearchPreviewClips.map((c, i) => (
                              <div key={c.id || i} className="px-2 py-1 bg-surface-900/60 rounded text-[10px] text-gray-300 font-mono truncate border border-white/5">
                                {c.text || "(empty)"}
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium pl-0.5">
                        Date From
                      </span>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => {
                          setDateFrom(e.target.value);
                        }}
                        min={minDateBound || undefined}
                        max={dateTo || maxDateBound || undefined}
                        className="w-full max-w-[110px] bg-surface-900 border-0 outline-none rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium pl-0.5">
                        Date To
                      </span>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => {
                          setDateTo(e.target.value);
                        }}
                        min={dateFrom || minDateBound || undefined}
                        max={maxDateBound || undefined}
                        className="w-full max-w-[110px] bg-surface-900 border-0 outline-none rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Dimension toggles - row wise */}
                <div className="flex flex-wrap justify-between gap-y-3">
                  {dims.map((dim) => (
                    <div key={dim.key} className="space-y-1.5">
                      <span className="text-[10px] text-gray-600 uppercase tracking-wider font-medium pl-0.5 block">
                        {dim.label}
                      </span>
                      <div className="flex items-center gap-1.5">
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

              {/* ── Specific tags sub-filter ── */}
              {showSpecificTags && tags.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                        Specific Tags
                      </span>
                    </div>

                    {/* Tag Search Input opposite to title */}
                    <div className="relative flex items-center group max-w-[200px] w-full">
                      <div className="absolute left-3 text-gray-600 group-focus-within:text-brand-400 transition-colors pointer-events-none duration-150">
                        <IconSearch size={12} />
                      </div>
                      <input
                        type="text"
                        placeholder="Search tags..."
                        value={specificTagsSearch}
                        onChange={(e) => setSpecificTagsSearch(e.target.value)}
                        className="w-full bg-transparent border-0 border-b border-gray-600 hover:border-gray-500 focus:border-brand-500 focus:ring-0 focus:outline-none pl-8 pr-8 py-1 text-[11px] text-white/85 placeholder-gray-600 transition-colors duration-150"
                      />
                      {specificTagsSearch && (
                        <button
                          type="button"
                          onClick={() => setSpecificTagsSearch("")}
                          className="absolute right-2 p-1 text-gray-600 hover:text-gray-400 transition-colors duration-150"
                          title="Clear search"
                        >
                          <IconX size={10} />
                        </button>
                      )}
                    </div>
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

                    <div className="flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto dialog-scrollbar">
                    {liveTagsSorted
                      .filter((t) => t.name.toLowerCase().includes(specificTagsSearch.toLowerCase()))
                      .map((tag) => (
                        <TagBadge
                          key={tag.id}
                          tag={tag}
                          size="sm"
                          active={sf.specificTags.includes(tag.id)}
                          count={liveTagCounts[tag.id]}
                          onClick={() => toggleSpecificTag(tag.id)}
                        />
                      ))}
                  </div>

                  {sf.specificTags.length === 0 ? (
                    <p className="text-[10px] text-gray-600 pl-0.5">
                      Select tag(s) then choose include or exclude mode.
                    </p>
                  ) : (
                    <div className="flex items-center justify-between text-[10px] text-gray-500">
                      <span>{sf.specificTags.length} tag(s) selected</span>
                      <span className="hover:text-rose-400 transition-colors cursor-pointer" onClick={() => setSf((p) => ({ ...p, specificTags: [], specificTagsMode: null }))}>
                        Clear tags
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* ── Active combination summary ────────────────────────────── */}
              <div className="flex flex-col gap-1 p-2 rounded-lg bg-indigo-950/30 text-[10.5px]">
                <div className="flex items-center gap-1.5 text-gray-400">
                  <span className="shrink-0 px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 font-bold uppercase text-[9px] tracking-wider">Target</span>
                  <span className="text-gray-300 font-medium truncate" title={combinationLabel}>{combinationLabel}</span>
                </div>
                {actionType === "attach-tags" && attachTagIds.length > 0 && (
                  <div className="flex items-center gap-1.5 text-gray-400 border-t border-indigo-500/10 pt-1 mt-0.5">
                    <span className="shrink-0 px-1.5 py-0.5 rounded bg-brand-500/15 text-brand-400 font-bold uppercase text-[9px] tracking-wider">Attach</span>
                    <span className="text-gray-300 truncate" title={attachTagIds.map((id) => tags.find((t) => t.id === id)?.name ?? id).join(", ")}>
                      {attachTagIds.map((id) => tags.find((t) => t.id === id)?.name ?? id).join(", ")}
                    </span>
                  </div>
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
                  onClick={() => setShowConfirmDialog(true)}
                  className={`flex-1 px-4 py-2.5 rounded-xl text-white text-xs font-bold uppercase tracking-wider shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${meta.accentClass}`}
                >
                  Execute Action
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

    {/* Filtered clips preview Dialog */}
    <Dialog
      isOpen={showPreviewDialog}
      onClose={() => setShowPreviewDialog(false)}
      title={
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-white uppercase tracking-widest">
            Preview ({matchingCount && matchingCount > 3 ? `3 of ${matchingCount}` : matchingCount})
          </span>
        </div>
      }
      maxWidth="max-w-md"
      paddingClassName="px-4 py-4"
    >
      <div className="relative space-y-4 w-full h-[350px]">
        <div
          ref={previewListRef}
          className="w-full h-full overflow-y-auto space-y-2 hide-scrollbar-thumb pr-1 pt-1"
        >
          {matchingClips.slice(0, 3).map((c, i) => {
            const wordCount = c.text ? c.text.trim().split(/\s+/).filter(Boolean).length : 0;
            const charCount = c.text ? c.text.length : 0;
            const formatPreviewDate = (ts: any) => {
              if (!ts) return "";
              const d = new Date(ts);
              const day = String(d.getDate()).padStart(2, "0");
              const month = String(d.getMonth() + 1).padStart(2, "0");
              const year = d.getFullYear();
              const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
              return `${day}-${month}-${year}, ${time}`;
            };
            return (
              <div
                key={c.id || i}
                className="w-full p-3 bg-surface-900/60 rounded-xl border border-white/5 space-y-2 hover:bg-surface-900/90 transition-colors"
              >
                <FormattedContent content={c.text} displayMode="preview" className="text-gray-300 min-h-0 text-[11px]" />
                <div className="flex items-center justify-between select-none border-t border-white/5 pt-1.5 text-[9px] text-gray-500 font-mono">
                  <div className="flex items-center gap-2">
                    <span>{wordCount}w</span>
                    <span>{charCount}ch</span>
                    {c.tags && c.tags.length > 0 && (
                      <div className="flex items-center gap-1 ml-2">
                        <span>tags:</span>
                        {c.tags.map((tid: string) => {
                          const tagObj = tags.find((t) => t.id === tid);
                          if (!tagObj) return null;
                          return (
                            <span key={tid} className="px-1.5 py-0.5 rounded text-[8px] font-bold" style={{ backgroundColor: tagObj.color + "20", color: tagObj.color }}>
                              {tagObj.name}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {c.timestamp && (
                    <span>{formatPreviewDate(c.timestamp)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Dialog>

    {/* Confirmation Dialog */}
    <Dialog
      isOpen={showConfirmDialog}
      onClose={() => setShowConfirmDialog(false)}
      title={
        <span className="flex items-center gap-2">
          <span className="text-amber-400 shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </span>
          <span className="text-sm font-bold text-white">Confirm Action</span>
        </span>
      }
      maxWidth="max-w-md"
    >
      <div className="space-y-4">

        {/* Action identity row */}
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-900/70">
          <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${meta.doneBg} border`}>
            <span className={meta.doneColor}>{meta.icon}</span>
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-white">{meta.title}</p>
            <p className="text-[11px] text-gray-500 mt-0.5 truncate">{meta.subtitle}</p>
          </div>
          {matchingCount !== null && (
            <div className="ml-auto shrink-0 flex flex-col items-end">
              <span className="text-[22px] font-black text-white font-mono leading-none">{matchingCount}</span>
              <span className="text-[9px] text-gray-500 uppercase tracking-wider">clip{matchingCount !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>

        {/* Filter summary */}
        <div className="rounded-xl bg-surface-900/40 border border-white/5 px-3.5 py-2.5 space-y-2">
          <p className="text-[9px] text-gray-600 uppercase tracking-wider font-bold">Scope</p>
          <p className="text-[11px] text-gray-300 leading-relaxed">{combinationLabel}</p>

          {/* Tags to attach */}
          {actionType === "attach-tags" && attachTagIds.length > 0 && (
            <div className="pt-2 border-t border-white/5">
              <p className="text-[9px] text-gray-600 uppercase tracking-wider font-bold mb-1.5">Tags to Attach</p>
              <div className="flex flex-wrap gap-1">
                {attachTagIds.map((id) => {
                  const t = tags.find((tg) => tg.id === id);
                  if (!t) return null;
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border"
                      style={{ backgroundColor: t.color + "20", borderColor: t.color + "50", color: t.color }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                      {t.name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Specific tags filter */}
          {sf.specificTags.length > 0 && sf.specificTagsMode && (
            <div className="pt-2 border-t border-white/5">
              <p className="text-[9px] text-gray-600 uppercase tracking-wider font-bold mb-1.5">
                {sf.specificTagsMode === "include" ? "Matching Tags" : "Excluding Tags"}
              </p>
              <div className="flex flex-wrap gap-1">
                {sf.specificTags.map((id) => {
                  const t = tags.find((tg) => tg.id === id);
                  if (!t) return null;
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border"
                      style={{ backgroundColor: t.color + "20", borderColor: t.color + "50", color: t.color }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                      {t.name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Warning note */}
        <p className="text-[11px] text-amber-400/70 leading-relaxed pl-0.5">
          ⚠ Modifying <span className="font-bold text-amber-400">{matchingCount ?? "…"}</span> clip{matchingCount !== 1 ? "s" : ""}. Cannot be undone.
        </p>

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={() => setShowConfirmDialog(false)}
            className="flex-1 py-2.5 rounded-xl bg-surface-800 hover:bg-surface-750 border border-white/8 text-gray-300 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              setShowConfirmDialog(false);
              handleExecute();
            }}
            className={`flex-1 py-2.5 rounded-xl text-white text-xs font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-lg ${meta.accentClass}`}
          >
            Confirm & Execute
          </button>
        </div>
      </div>
    </Dialog>
    </>
  );
};
