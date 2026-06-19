import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Dialog from "./Dialog";
import { useClipStore } from "../store/useClipStore";
import FormattedContent from "./FormattedContent";
import TagBadge from "./TagBadge";
import {
  IconCheck,
  IconTag,
  IconSettings,
  IconLayers,
  IconAlertCircle,
  IconRefresh,
  IconShield,
  IconZap,
  IconSearch,
  IconX,
  IconArrowUp,
  IconArrowDown
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

const CustomSelect: React.FC<{
  value: any;
  onChange: (v: any) => void;
  options: { label: string; caption?: string; value: any; icon?: React.ReactNode }[];
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  className?: string;
  disabled?: boolean;
}> = ({ value, onChange, options, isOpen, setIsOpen, className = "", disabled = false }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const currentOption = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, setIsOpen]);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-3 h-10 w-full px-4 rounded-xl transition-all duration-200 cursor-pointer border ${
          disabled
            ? "bg-surface-900/50 border-gray-800 text-gray-600 cursor-not-allowed"
            : isOpen
            ? "bg-surface-700 border-brand-500/30 text-brand-400 shadow-lg shadow-brand-500/5"
            : "bg-surface-900 border-gray-700/50 text-gray-400 hover:border-gray-500 hover:text-gray-200"
        }`}
      >
        <span className="text-[12px] font-medium whitespace-nowrap overflow-hidden text-ellipsis">
          {currentOption.label}
        </span>
        <svg
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`opacity-40 transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180 text-brand-400" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            className="absolute top-full left-0 right-0 mt-1.5 z-[1001] w-full bg-surface-800 border border-white/10 rounded-xl p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between my-0.5 px-4 py-2 rounded-lg text-left transition-all duration-150 cursor-pointer ${
                  value === opt.value
                    ? "bg-brand-500/10 text-brand-400 font-semibold"
                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                }`}
              >
                <span className="text-[12px]">{opt.label}</span>
                {value === opt.value && <IconCheck size={14} className="text-brand-400 shrink-0" />}
              </button>
            ))}
          </motion.div>
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

export const ImportWizard: React.FC<ImportWizardProps> = ({ isOpen, onClose }) => {
  const previewListRef = React.useRef<HTMLDivElement>(null);
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

  // Search filter states for tag selection lists
  const [specificTagsSearch, setSpecificTagsSearch] = useState("");
  const [backupTagsSearch, setBackupTagsSearch] = useState("");

  // Phase 2 addition states
  const [showPreviewList, setShowPreviewList] = useState(false);
  const [textSearchPreviewClips, setTextSearchPreviewClips] = useState<any[]>([]);
  const [textSearchPreviewCount, setTextSearchPreviewCount] = useState<number>(0);
  const [previewLimit, setPreviewLimit] = useState<number>(3);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Custom Select Dropdown open states
  const [clipConflictOpen, setClipConflictOpen] = useState(false);
  const [tagConflictOpen, setTagConflictOpen] = useState(false);
  const [l2FavoriteOpen, setL2FavoriteOpen] = useState(false);
  const [l2RecycleOpen, setL2RecycleOpen] = useState(false);
  const [l2TaggedOpen, setL2TaggedOpen] = useState(false);
  const [l2SpecificTagsModeOpen, setL2SpecificTagsModeOpen] = useState(false);

  // Memoized dynamic date bounds from backup file clips based on current category and text query
  const dynamicDateBounds = useMemo(() => {
    if (!parsedData || !parsedData.clips) return { min: "", max: "" };
    const matchedClips = parsedData.clips.filter((clip) => {
      // 1. Text filter
      if (textFilter.trim()) {
        const text = clip.text || "";
        if (!text.toLowerCase().includes(textFilter.toLowerCase())) {
          return false;
        }
      }
      // 2. Favorites
      const fav = level1Scope === "favorites" ? "yes" : l2Favorite;
      if (fav === "yes" && !clip.isFavorite) return false;
      if (fav === "no" && clip.isFavorite) return false;

      // 3. Recycle Bin
      const rec = level1Scope === "deleted" ? "yes" : l2Recycle;
      if (rec === "yes" && !clip.isDeleted) return false;
      if (rec === "no" && clip.isDeleted) return false;

      // 4. Tags Presence
      const tag = level1Scope === "tagged" ? "yes" : l2Tagged;
      const hasTags = clip.tags && clip.tags.length > 0;
      if (tag === "yes" && !hasTags) return false;
      if (tag === "no" && hasTags) return false;

      // 5. Specific Tags
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

    const timestamps = matchedClips
      .map((c: any) => c.timestamp)
      .filter(Boolean)
      .map((t: string) => new Date(t).getTime());
    if (timestamps.length === 0) return { min: "", max: "" };
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    return {
      min: new Date(minTime).toISOString().split("T")[0],
      max: new Date(maxTime).toISOString().split("T")[0],
    };
  }, [
    parsedData,
    textFilter,
    level1Scope,
    l2Favorite,
    l2Recycle,
    l2Tagged,
    l2SpecificTagsMode,
    l2SpecificTags,
  ]);

  const prevBoundsRef = React.useRef({ min: "", max: "" });
  // Pre-fill date ranges with computed min/max bounds when bounds change
  useEffect(() => {
    if (isOpen) {
      const oldMin = prevBoundsRef.current.min;
      const oldMax = prevBoundsRef.current.max;
      setDateFrom((prev) => (prev === oldMin || !prev ? dynamicDateBounds.min : prev));
      setDateTo((prev) => (prev === oldMax || !prev ? dynamicDateBounds.max : prev));
      prevBoundsRef.current = dynamicDateBounds;
    }
  }, [dynamicDateBounds, isOpen]);

  // Clear date ranges when sub-filters or scope changes
  useEffect(() => {
    if (isOpen) {
      setDateFrom("");
      setDateTo("");
      setShowPreviewList(false);
      setPreviewLimit(3);
    }
  }, [level1Scope, l2Favorite, l2Recycle, l2Tagged, l2SpecificTagsMode, l2SpecificTags, isOpen]);

  // Reset Phase 2 states on wizard open
  useEffect(() => {
    if (isOpen) {
      setShowPreviewList(false);
      setTextSearchPreviewClips([]);
      setTextSearchPreviewCount(0);
      setClipConflictOpen(false);
      setTagConflictOpen(false);
      setL2FavoriteOpen(false);
      setL2RecycleOpen(false);
      setL2TaggedOpen(false);
      setL2SpecificTagsModeOpen(false);
      setPreviewLimit(3);
    }
  }, [isOpen]);

  // Query 1-3 instant matches specifically for the text filter
  useEffect(() => {
    if (!isOpen || !parsedData || !textFilter.trim()) {
      setTextSearchPreviewClips([]);
      setTextSearchPreviewCount(0);
      return;
    }
    const matched = parsedData.clips.filter((clip) => {
      const text = clip.text || "";
      return text.toLowerCase().includes(textFilter.toLowerCase());
    });
    setTextSearchPreviewClips(matched.slice(0, 3));
    setTextSearchPreviewCount(matched.length);
  }, [isOpen, parsedData, textFilter]);

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

  // Per-tag clip counts from the backup file
  const parsedTagCounts = useMemo(() => {
    if (!parsedData) return {} as Record<string, number>;
    const counts: Record<string, number> = {};
    (parsedData.clips || []).forEach((clip: any) => {
      if (clip.tags && Array.isArray(clip.tags)) {
        clip.tags.forEach((tagId: string) => {
          counts[tagId] = (counts[tagId] ?? 0) + 1;
        });
      }
    });
    return counts;
  }, [parsedData]);

  // Tags from the backup sorted by clip count desc, only those with ≥1 clip
  const sortedImportTags = useMemo(() => {
    if (!parsedData?.tags) return [];
    return [...parsedData.tags]
      .filter((t: any) => (parsedTagCounts[t.id] ?? 0) >= 1)
      .sort((a: any, b: any) => (parsedTagCounts[b.id] ?? 0) - (parsedTagCounts[a.id] ?? 0));
  }, [parsedData, parsedTagCounts]);

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
    setSpecificTagsSearch("");
    setBackupTagsSearch("");
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

  const isAnyFilterActive = useMemo(() => {
    return (
      level1Scope !== "all" ||
      l2Favorite !== "all" ||
      l2Recycle !== "all" ||
      l2Tagged !== "all" ||
      l2SpecificTagsMode !== "disabled" ||
      l2SpecificTags.size > 0 ||
      textFilter.trim() !== "" ||
      (dateFrom !== "" && dateFrom !== dynamicDateBounds.min) ||
      (dateTo !== "" && dateTo !== dynamicDateBounds.max)
    );
  }, [
    level1Scope,
    l2Favorite,
    l2Recycle,
    l2Tagged,
    l2SpecificTagsMode,
    l2SpecificTags,
    textFilter,
    dateFrom,
    dateTo,
    dynamicDateBounds,
  ]);

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={status === "progress" ? () => {} : handleClose}
        title={
          <span className="flex items-center gap-2">
            <IconZap className="w-4 h-4 text-brand-400 shrink-0" />
            Advanced Data Import System
          </span>
        }
        headerActionRight={
          <div className="flex items-center gap-2">
            {isAnyFilterActive && (
              <button
                type="button"
                onClick={() => {
                  setLevel1Scope("all");
                  setL2Favorite("all");
                  setL2Recycle("all");
                  setL2Tagged("all");
                  setL2SpecificTagsMode("disabled");
                  setL2SpecificTags(new Set());
                  setTextFilter("");
                  setDateFrom(dynamicDateBounds.min);
                  setDateTo(dynamicDateBounds.max);
                }}
                className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-colors px-2.5 py-0.5 rounded-md cursor-pointer"
              >
                Clear All
              </button>
            )}
            {status === "clips-config" && filteredClips.length !== null && (
              <button
                type="button"
                onClick={() => setShowPreviewList(true)}
                className="text-[11px] font-semibold text-brand-300 bg-brand-500/10 border border-brand-500/20 hover:bg-brand-500/20 transition-colors px-2.5 py-0.5 rounded-md font-mono cursor-pointer"
              >
                {filteredClips.length} clips
              </button>
            )}
          </div>
        }
      maxWidth="max-w-2xl"
      contentClassName="hide-scrollbar"
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
              </div>

              {/* CONFLICT RESOLUTION & TEXT / DATE FILTERS */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Conflict Resolution (Clips)
                  </label>
                  <CustomSelect
                    value={clipConflict}
                    onChange={setClipConflict}
                    options={[
                      { value: "keep-existing", label: "Skip duplicate items" },
                      { value: "keep-new", label: "Overwrite duplicate items" }
                    ]}
                    isOpen={clipConflictOpen}
                    setIsOpen={setClipConflictOpen}
                  />
                </div>

                <div className="space-y-1.5 relative">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Text-wise Filter
                  </label>
                  <div className="relative flex items-center group w-full">
                    <div className="absolute left-3 text-gray-655 group-focus-within:text-brand-400 transition-colors pointer-events-none duration-150">
                      <IconSearch size={14} />
                    </div>
                    <input
                      type="text"
                      placeholder="Search query in backup clips..."
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

                  {/* Text Search matches popover dropdown */}
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
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                    }}
                    min={dynamicDateBounds.min || undefined}
                    max={dateTo || dynamicDateBounds.max || undefined}
                    className="w-full max-w-[110px] bg-surface-900 border-0 outline-none rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Date To
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                    }}
                    min={dateFrom || dynamicDateBounds.min || undefined}
                    max={dynamicDateBounds.max || undefined}
                    className="w-full max-w-[110px] bg-surface-900 border-0 outline-none rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* BASE CATEGORY SCOPE */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Select Base Category Scope
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

              {/* REFINE OPTIONS FOR SELECTED SCOPE */}
              {level1Scope !== "all" && (
                <div className="bg-surface-900/40 border border-gray-800 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Refinement Sub-Filters
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-6 gap-y-3">
                    {/* Favorites Sub-filter */}
                    <div className="space-y-1.5 w-[160px]">
                      <label className="text-[9px] font-bold text-gray-500 uppercase">Favorites Filter</label>
                      <CustomSelect
                        disabled={level1Scope === "favorites"}
                        value={l2Favorite}
                        onChange={setL2Favorite}
                        options={[
                          { value: "all", label: "Keep All" },
                          { value: "yes", label: "Only Favorites" },
                          { value: "no", label: "Exclude Favorites" }
                        ]}
                        isOpen={l2FavoriteOpen}
                        setIsOpen={setL2FavoriteOpen}
                      />
                    </div>

                    {/* Recycle Bin Sub-filter */}
                    <div className="space-y-1.5 w-[160px]">
                      <label className="text-[9px] font-bold text-gray-500 uppercase">Recycle Bin Filter</label>
                      <CustomSelect
                        disabled={level1Scope === "active" || level1Scope === "deleted"}
                        value={l2Recycle}
                        onChange={setL2Recycle}
                        options={[
                          { value: "all", label: "Keep All" },
                          { value: "yes", label: "Only Recycle Bin" },
                          { value: "no", label: "Exclude Recycle Bin" }
                        ]}
                        isOpen={l2RecycleOpen}
                        setIsOpen={setL2RecycleOpen}
                      />
                    </div>

                    {/* Tags Presence Sub-filter */}
                    <div className="space-y-1.5 w-[160px]">
                      <label className="text-[9px] font-bold text-gray-500 uppercase">Tags Presence</label>
                      <CustomSelect
                        disabled={level1Scope === "tagged"}
                        value={l2Tagged}
                        onChange={setL2Tagged}
                        options={[
                          { value: "all", label: "Keep All" },
                          { value: "yes", label: "Only Having Tags" },
                          { value: "no", label: "Exclude Having Tags" }
                        ]}
                        isOpen={l2TaggedOpen}
                        setIsOpen={setL2TaggedOpen}
                      />
                    </div>
                  </div>

                  {/* Specific Tags Inclusion / Exclusion */}
                  {sortedImportTags.length > 0 && (
                    <div className="space-y-3 border-t border-gray-800 pt-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                            Specific Tags Selection
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

                      <div className="flex gap-2 items-center">
                        <span className="text-[9px] font-bold text-gray-500 uppercase">Mode:</span>
                        <div className="w-[200px]">
                          <CustomSelect
                            value={l2SpecificTagsMode}
                            onChange={setL2SpecificTagsMode}
                            options={[
                              { value: "disabled", label: "Disable tag filter" },
                              { value: "include", label: "Include selection" },
                              { value: "exclude", label: "Exclude selection" }
                            ]}
                            isOpen={l2SpecificTagsModeOpen}
                            setIsOpen={setL2SpecificTagsModeOpen}
                          />
                        </div>
                      </div>

                      {l2SpecificTagsMode !== "disabled" && (
                        <div className="flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto pr-1 dialog-scrollbar">
                          {sortedImportTags
                            .filter((t: any) => t.name.toLowerCase().includes(specificTagsSearch.toLowerCase()))
                            .map((tag: any) => (
                              <TagBadge
                                key={tag.id}
                                tag={tag}
                                size="sm"
                                active={l2SpecificTags.has(tag.id)}
                                count={parsedTagCounts[tag.id]}
                                onClick={() => handleToggleL2SpecificTag(tag.id)}
                              />
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}


              {/* ── Active combination summary ────────────────────────────── */}
              <div className="px-3 py-2.5 rounded-lg bg-surface-900/60 border border-white/5 space-y-1">
                <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider block">
                  Import target
                </span>
                <span className="text-[11px] text-gray-300 leading-relaxed block">
                  {combinationNote}
                </span>
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
              </div>

              {/* Conflict resolution */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Tag Conflict Resolution
                </label>
                <CustomSelect
                  value={tagConflict}
                  onChange={setTagConflict}
                  options={[
                    { value: "keep-existing", label: "Skip duplicate tags" },
                    { value: "keep-new", label: "Overwrite duplicate tags" }
                  ]}
                  isOpen={tagConflictOpen}
                  setIsOpen={setTagConflictOpen}
                />
              </div>

              {/* Tags Selector list */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 uppercase">
                  <span>Backup Tags List</span>
                  <span>
                    Selected: {selectedTags.size} of {parsedData.tags.length}
                  </span>
                </div>

                {/* Dashboard styled tag search */}
                <div className="relative flex items-center group w-full mb-2">
                  <div className="absolute left-3 text-gray-655 group-focus-within:text-brand-400 transition-colors pointer-events-none duration-150">
                    <IconSearch size={14} />
                  </div>
                  <input
                    type="text"
                    placeholder="Search backup tags..."
                    value={backupTagsSearch}
                    onChange={(e) => setBackupTagsSearch(e.target.value)}
                    className="w-full bg-transparent border-0 border-b border-gray-600 hover:border-gray-500 focus:border-brand-500 focus:ring-0 focus:outline-none pl-9 pr-9 py-1.5 text-xs text-white/85 placeholder-gray-600 transition-colors duration-150"
                  />
                  {backupTagsSearch && (
                    <button
                      type="button"
                      onClick={() => setBackupTagsSearch("")}
                      className="absolute right-2 p-1 text-gray-600 hover:text-gray-400 transition-colors duration-150"
                      title="Clear search"
                    >
                      <IconX size={12} />
                    </button>
                  )}
                </div>

                <div className="max-h-60 overflow-y-auto border border-gray-800 bg-surface-900/50 rounded-xl divide-y divide-gray-800">
                  {parsedData.tags
                    .filter((t) => t.name.toLowerCase().includes(backupTagsSearch.toLowerCase()))
                    .map((tag) => {
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

    {/* Filtered clips preview Dialog */}
    <Dialog
      isOpen={showPreviewList}
      onClose={() => setShowPreviewList(false)}
      title={
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-white uppercase tracking-widest">
            Preview ({filteredClips.length > 3 ? `3 of ${filteredClips.length}` : filteredClips.length})
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
          {filteredClips.slice(0, 3).map((c, i) => {
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
                          // Note: since this is parsedData from backup, tags are in parsedData.tags
                          const tagObj = parsedData?.tags?.find((t) => t.id === tid);
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
  </>
);
};
