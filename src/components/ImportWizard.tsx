import React, { useState, useEffect, useMemo, useRef } from "react";
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
  | "preview"
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
  borderless?: boolean;
}> = ({ value, onChange, options, isOpen, setIsOpen, className = "", disabled = false, borderless = false }) => {
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
        className={`inline-flex items-center gap-2.5 h-9 px-3.5 rounded-xl transition-all duration-200 cursor-pointer ${
          disabled
            ? `bg-surface-900/50 text-gray-600 cursor-not-allowed ${borderless ? "border-0" : "border border-gray-800"}`
            : isOpen
            ? `bg-surface-700 text-brand-400 shadow-lg shadow-brand-500/5 ${borderless ? "border-0" : "border border-brand-500/30"}`
            : `bg-surface-900 text-gray-400 hover:text-gray-200 ${borderless ? "border-0" : "border border-gray-700/50 hover:border-gray-500"}`
        }`}
      >
        <span className="text-[12px] font-medium whitespace-nowrap">
          {currentOption.label}
        </span>
        <svg
          width={12}
          height={12}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`opacity-50 transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180 text-brand-400" : ""}`}
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
            className="absolute top-full right-0 mt-1.5 z-[1001] min-w-full w-max bg-surface-800 border border-white/10 rounded-xl p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-8 my-0.5 px-3.5 py-2 rounded-lg text-left transition-all duration-150 cursor-pointer ${
                  value === opt.value
                    ? "bg-brand-500/10 text-brand-400 font-semibold"
                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                }`}
              >
                <span className="text-[12px] whitespace-nowrap">{opt.label}</span>
                {value === opt.value && <IconCheck size={13} className="text-brand-400 shrink-0" />}
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

const colorMap: Record<"brand" | "star" | "rose" | "emerald" | "violet", { on: string; off: string }> = {
  brand:   { on: "bg-brand-500/15 border-brand-500/50 text-brand-300",     off: "bg-surface-900 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200" },
  star:    { on: "bg-amber-500/15 border-amber-500/50 text-amber-300",      off: "bg-surface-900 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200" },
  rose:    { on: "bg-rose-500/15 border-rose-500/50 text-rose-300",         off: "bg-surface-900 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200" },
  emerald: { on: "bg-emerald-500/15 border-emerald-500/50 text-emerald-300", off: "bg-surface-900 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200" },
  violet:  { on: "bg-violet-500/15 border-violet-500/50 text-violet-300",   off: "bg-surface-900 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200" },
};

const ToggleChip: React.FC<{
  label: string;
  active: boolean;
  color: "brand" | "star" | "rose" | "emerald" | "violet";
  disabled?: boolean;
  onClick: () => void;
}> = ({ label, active, color, disabled = false, onClick }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-all duration-150 cursor-pointer ${
      disabled
        ? "bg-surface-950/40 border-white/5 text-gray-600 cursor-not-allowed opacity-50"
        : active
        ? colorMap[color].on
        : colorMap[color].off
    }`}
  >
    {label}
    {active && <IconCheck size={10} className="shrink-0 ml-0.5" />}
  </button>
);

const AttachTagSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  availableTags: { id: string; name: string; color: string }[];
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}> = ({ value, onChange, availableTags, isOpen, setIsOpen }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, setIsOpen]);

  const selectedTag = availableTags.find(t => t.id === value);

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger Button - Without border! */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center max-w-[170px] gap-2 h-8 px-3 rounded-lg transition-all duration-200 cursor-pointer bg-surface-800/40 hover:bg-surface-800 text-gray-400 hover:text-gray-200 border-0"
      >
        {selectedTag ? (
          <span className="flex items-center gap-1.5 text-[11px] truncate font-semibold" style={{ color: selectedTag.color }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: selectedTag.color }} />
            {selectedTag.name}
          </span>
        ) : (
          <span className="text-[11px] text-gray-450 font-medium">No Tag</span>
        )}
        <svg
          width={9}
          height={9}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={`opacity-50 transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            className="absolute top-full right-0 mt-1.5 z-[1001] w-64 bg-surface-800 border border-white/10 rounded-xl p-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] space-y-3"
          >
            {/* Search input */}
            <div className="relative flex items-center group w-full">
              <div className="absolute left-2.5 text-gray-500">
                <IconSearch size={11} />
              </div>
              <input
                type="text"
                placeholder="Search tags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-surface-900 border-0 rounded-lg pl-7 pr-7 py-1 text-[11px] text-white/85 placeholder-gray-600 focus:ring-0 focus:outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 p-1 text-gray-600 hover:text-gray-400"
                >
                  <IconX size={9} />
                </button>
              )}
            </div>

            {/* List of Badges */}
            <div className="flex flex-wrap gap-1.5 max-h-[150px] overflow-y-auto pr-1 dialog-scrollbar">
              {/* "No Tag" option */}
              <span
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                }}
                className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-tight transition-all duration-200 cursor-pointer select-none border active:scale-95 ${
                  value === ""
                    ? "bg-white/10 border-white/20 text-white font-bold opacity-100"
                    : "bg-surface-800/40 border-transparent text-gray-500 opacity-80 hover:opacity-100"
                }`}
              >
                No Tag
                {value === "" && <span className="ml-0.5">✓</span>}
              </span>

              {/* Tag options */}
              {availableTags
                .filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
                .map((tag) => (
                  <TagBadge
                    key={tag.id}
                    tag={tag}
                    size="sm"
                    active={value === tag.id}
                    onClick={() => {
                      onChange(tag.id);
                      setIsOpen(false);
                    }}
                  />
                ))}

              {/* Create New Tag Button */}
              {search.trim() &&
                !availableTags.some(
                  (t) => t.name.toLowerCase() === search.toLowerCase()
                ) && (
                  <button
                    type="button"
                    onClick={async () => {
                      const colors = [
                        "#ff6b6b",
                        "#4ecdc4",
                        "#45b7d1",
                        "#f9ca24",
                        "#6c5ce7",
                        "#a29bfe",
                        "#fd79a8",
                        "#fdcb6e",
                        "#6c7a89",
                        "#00b894",
                      ];
                      const newTag = {
                        id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        name: search.trim(),
                        color: colors[Math.floor(Math.random() * colors.length)],
                        updatedAt: new Date().toISOString(),
                      };
                      const currentTags = useClipStore.getState().tags;
                      const updatedTags = [...currentTags, newTag];
                      await useClipStore.getState().saveTags(updatedTags);
                      await useClipStore.getState().loadTags();
                      onChange(newTag.id);
                      setSearch("");
                      setIsOpen(false);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] transition-all bg-brand-500/15 text-brand-400 border border-brand-500/40 hover:bg-brand-500/25 hover:border-brand-500/60 font-semibold cursor-pointer active:scale-95"
                  >
                    <span>+ Create "{search.trim()}"</span>
                  </button>
                )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const formatSettingKey = (key: string): string => {
  switch (key) {
    case "autoLaunch": return "Auto Launch";
    case "maxEntries": return "Max Entries Limit";
    case "pollingInterval": return "Polling Interval";
    case "paginationEnabled": return "Enable Pagination";
    case "pageSize": return "Page Size";
    case "viewMode": return "Default View Mode";
    case "displayMode": return "Display Mode";
    case "pauseCaptureOption": return "Pause Capture Option";
    default: return key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
  }
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

  // Fetch all local clips to accurately resolve conflicts and duplicates (instead of paginated localClips)
  const [allLocalClips, setAllLocalClips] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      window.clipAPI
        .getClips()
        .then((res) => {
          const clipsArray = Array.isArray(res)
            ? res
            : res && Array.isArray(res.clips)
            ? res.clips
            : [];
          setAllLocalClips(clipsArray);
        })
        .catch((err) => {
          console.error("Failed to load all local clips for import preview", err);
        });
    } else {
      setAllLocalClips([]);
    }
  }, [isOpen]);

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
  // Snapshot of localTags at the time the file was loaded — prevents post-import store updates from resetting selections
  const localTagsSnapshotRef = useRef<{ id: string; name: string }[]>([]);

  // Settings Config State
  const [selectedSettingsKeys, setSelectedSettingsKeys] = useState<Set<string>>(new Set());
  const [settingsConflict, setSettingsConflict] = useState<"keep-existing" | "keep-new">("keep-existing");
  const [settingsConflictOpen, setSettingsConflictOpen] = useState(false);
  const [settingsSearch, setSettingsSearch] = useState("");

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

  // Phase 3 extra actions states
  const [importMakeFavorite, setImportMakeFavorite] = useState(false);
  const [importAttachTag, setImportAttachTag] = useState("");
  const [importAttachTagOpen, setImportAttachTagOpen] = useState(false);

  const availableTagsForAttachment = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string }>();
    // Add local tags
    localTags.forEach((t) => {
      map.set(t.name.toLowerCase().trim(), { id: t.id, name: t.name, color: t.color });
    });
    // Add backup tags
    if (parsedData?.tags) {
      parsedData.tags.forEach((t) => {
        const nameLower = (t.name || "").toLowerCase().trim();
        if (nameLower && !map.has(nameLower)) {
          map.set(nameLower, { id: t.id, name: t.name, color: t.color || "#6366f1" });
        }
      });
    }
    return Array.from(map.values());
  }, [localTags, parsedData?.tags]);

  // Conflict-resolved base list of clips (before scope/text/date filtering)
  // Declared here so dynamicDateBounds and text-search preview can reference it.
  const conflictResolvedBaseClips = useMemo(() => {
    if (!parsedData) return [];
    if (clipConflict === "keep-new") return parsedData.clips || [];
    const localIds = new Set(allLocalClips.map((c: any) => c.id));
    const localTexts = new Set(allLocalClips.map((c: any) => (c.text || "").trim()));
    return (parsedData.clips || []).filter((clip: any) => {
      const id = (clip.id || "").trim();
      const text = (clip.text || "").trim();
      return !localIds.has(id) && !localTexts.has(text);
    });
  }, [parsedData, clipConflict, allLocalClips]);

  // Memoized set of selected tag IDs and names for robust fallback matching (handles UUID/name string discrepancies)
  const selectedTagsSet = useMemo(() => {
    const set = new Set<string>();
    if (!parsedData?.tags || l2SpecificTags.size === 0) return set;
    parsedData.tags.forEach((tag: any) => {
      if (l2SpecificTags.has(tag.id)) {
        set.add(tag.id.toLowerCase().trim());
        if (tag.name) {
          set.add(tag.name.toLowerCase().trim());
        }
      }
    });
    return set;
  }, [l2SpecificTags, parsedData?.tags]);

  // Memoized dynamic date bounds from conflict-resolved clips based on current category and text query
  const dynamicDateBounds = useMemo(() => {
    const matchedClips = conflictResolvedBaseClips.filter((clip) => {
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
        if (!clip.tags || !clip.tags.some((t: string) => l2SpecificTags.has(t) || selectedTagsSet.has(t.toLowerCase().trim()))) {
          return false;
        }
      } else if (l2SpecificTagsMode === "exclude" && l2SpecificTags.size > 0) {
        if (clip.tags && clip.tags.some((t: string) => l2SpecificTags.has(t) || selectedTagsSet.has(t.toLowerCase().trim()))) {
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
    conflictResolvedBaseClips,
    textFilter,
    level1Scope,
    l2Favorite,
    l2Recycle,
    l2Tagged,
    l2SpecificTagsMode,
    l2SpecificTags,
    selectedTagsSet,
  ]);

  // Memoized date bounds for each category scope (respecting textFilter)
  const categoryDateBounds = useMemo(() => {
    const scopes = ["all", "favorites", "tagged", "active", "deleted"] as const;
    const bounds: Record<string, { min: string; max: string }> = {};

    scopes.forEach((sc) => {
      const matched = conflictResolvedBaseClips.filter((clip) => {
        // Text filter
        if (textFilter.trim()) {
          const text = clip.text || "";
          if (!text.toLowerCase().includes(textFilter.toLowerCase())) {
            return false;
          }
        }
        // Base category scope matching
        if (sc === "favorites" && !clip.isFavorite) return false;
        if (sc === "tagged" && (!clip.tags || clip.tags.length === 0)) return false;
        if (sc === "active" && clip.isDeleted) return false;
        if (sc === "deleted" && !clip.isDeleted) return false;

        return true;
      });

      const timestamps = matched
        .map((c: any) => c.timestamp)
        .filter(Boolean)
        .map((t: string) => new Date(t).getTime());

      if (timestamps.length === 0) {
        bounds[sc] = { min: "", max: "" };
      } else {
        const minTime = Math.min(...timestamps);
        const maxTime = Math.max(...timestamps);
        bounds[sc] = {
          min: new Date(minTime).toISOString().split("T")[0],
          max: new Date(maxTime).toISOString().split("T")[0],
        };
      }
    });

    return bounds;
  }, [conflictResolvedBaseClips, textFilter]);

  // Initialize date ranges to overall bounds when backup data is loaded
  useEffect(() => {
    if (isOpen && categoryDateBounds.all) {
      setDateFrom((prev) => prev || categoryDateBounds.all.min);
      setDateTo((prev) => prev || categoryDateBounds.all.max);
    }
  }, [isOpen, categoryDateBounds.all]);

  // Memoized date bounds for date range synchronization (ignores level1Scope and textFilter, but respects sub-filters and specific tags)
  const dateBoundsForSync = useMemo(() => {
    const matchedClips = conflictResolvedBaseClips.filter((clip) => {
      // 1. Favorites sub-filter
      if (l2Favorite === "yes" && !clip.isFavorite) return false;
      if (l2Favorite === "no" && clip.isFavorite) return false;

      // 2. Recycle Bin sub-filter
      if (l2Recycle === "yes" && !clip.isDeleted) return false;
      if (l2Recycle === "no" && clip.isDeleted) return false;

      // 3. Tags Presence sub-filter
      const hasTags = clip.tags && clip.tags.length > 0;
      if (l2Tagged === "yes" && !hasTags) return false;
      if (l2Tagged === "no" && hasTags) return false;

      // 4. Specific Tags
      if (l2SpecificTagsMode === "include" && l2SpecificTags.size > 0) {
        if (!clip.tags || !clip.tags.some((t: string) => l2SpecificTags.has(t) || selectedTagsSet.has(t.toLowerCase().trim()))) {
          return false;
        }
      } else if (l2SpecificTagsMode === "exclude" && l2SpecificTags.size > 0) {
        if (clip.tags && clip.tags.some((t: string) => l2SpecificTags.has(t) || selectedTagsSet.has(t.toLowerCase().trim()))) {
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
    conflictResolvedBaseClips,
    l2Favorite,
    l2Recycle,
    l2Tagged,
    l2SpecificTagsMode,
    l2SpecificTags,
    selectedTagsSet,
  ]);

  // Update date ranges to match dateBoundsForSync when bounds change based on sub-filters/tags
  useEffect(() => {
    if (isOpen) {
      setDateFrom(dateBoundsForSync.min);
      setDateTo(dateBoundsForSync.max);
    }
  }, [dateBoundsForSync, isOpen]);

  // Reset preview lists when scope changes, without altering date range
  useEffect(() => {
    if (isOpen) {
      setShowPreviewList(false);
      setPreviewLimit(3);
    }
  }, [level1Scope, isOpen]);

  // Reset Phase 2 states on wizard open
  useEffect(() => {
    if (isOpen) {
      setShowPreviewList(false);
      setTextSearchPreviewClips([]);
      setTextSearchPreviewCount(0);
      setClipConflictOpen(false);
      setTagConflictOpen(false);
      setSettingsConflictOpen(false);
      setSettingsSearch("");
      setSettingsConflict("keep-existing");
      setL2FavoriteOpen(false);
      setL2RecycleOpen(false);
      setL2TaggedOpen(false);
      setL2SpecificTagsModeOpen(false);
      setPreviewLimit(3);
      setL2Favorite("all");
      setL2Recycle("all");
      setL2Tagged("all");
      setL2SpecificTagsMode("disabled");
      setL2SpecificTags(new Set());
      setLevel1Scope("all");
    }
  }, [isOpen]);

  // Query 1-3 instant matches specifically for the text filter (from conflict-resolved base, filtered by level1Scope)
  useEffect(() => {
    if (!isOpen || !textFilter.trim()) {
      setTextSearchPreviewClips([]);
      setTextSearchPreviewCount(0);
      return;
    }
    const matched = conflictResolvedBaseClips.filter((clip) => {
      // Filter by Level 1 category scope
      if (level1Scope === "favorites" && !clip.isFavorite) return false;
      if (level1Scope === "tagged" && (!clip.tags || clip.tags.length === 0)) return false;
      if (level1Scope === "active" && clip.isDeleted) return false;
      if (level1Scope === "deleted" && !clip.isDeleted) return false;

      const text = clip.text || "";
      return text.toLowerCase().includes(textFilter.toLowerCase());
    });
    setTextSearchPreviewClips(matched.slice(0, 3));
    setTextSearchPreviewCount(matched.length);
  }, [isOpen, conflictResolvedBaseClips, textFilter, level1Scope]);

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

  // Counts of different categories from the conflict-resolved clips, updating with text filter only
  const parsedCounts = useMemo(() => {
    const clips = conflictResolvedBaseClips;
    const filterByText = (clip: any) => {
      // 1. Text filter
      if (textFilter.trim()) {
        const text = clip.text || "";
        if (!text.toLowerCase().includes(textFilter.toLowerCase())) {
          return false;
        }
      }
      return true;
    };

    const filtered = clips.filter(filterByText);

    return {
      all: filtered.length,
      favorites: filtered.filter((c) => c.isFavorite).length,
      tagged: filtered.filter((c) => c.tags && c.tags.length > 0).length,
      active: filtered.filter((c) => !c.isDeleted).length,
      deleted: filtered.filter((c) => c.isDeleted).length,
    };
  }, [conflictResolvedBaseClips, textFilter]);

  // Clips matching current configuration (scope, text) but WITHOUT specific tags or date filters, to compute tag counts
  const clipsForTagCounting = useMemo(() => {
    return conflictResolvedBaseClips.filter((clip) => {
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
      let rec = l2Recycle;
      if (level1Scope === "active") rec = "no";
      else if (level1Scope === "deleted") rec = "yes";
      if (rec === "yes" && !clip.isDeleted) return false;
      if (rec === "no" && clip.isDeleted) return false;

      // 4. Tags Presence
      const tag = level1Scope === "tagged" ? "yes" : l2Tagged;
      const hasTags = clip.tags && clip.tags.length > 0;
      if (tag === "yes" && !hasTags) return false;
      if (tag === "no" && hasTags) return false;

      return true;
    });
  }, [
    conflictResolvedBaseClips,
    textFilter,
    level1Scope,
    l2Favorite,
    l2Recycle,
    l2Tagged,
  ]);

  // Per-tag clip counts from the backup file based on current filtered context (ignoring specific tags selection)
  // Standardizes keys to lowercase trimmed strings for name/id comparison fallback
  const parsedTagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    clipsForTagCounting.forEach((clip: any) => {
      if (clip.tags && Array.isArray(clip.tags)) {
        clip.tags.forEach((t: string) => {
          if (t && typeof t === "string") {
            const key = t.toLowerCase().trim();
            counts[key] = (counts[key] ?? 0) + 1;
            counts[t] = (counts[t] ?? 0) + 1;
          }
        });
      }
    });
    return counts;
  }, [clipsForTagCounting]);

  // Tags from the backup sorted by clip count desc, only showing those with count >= 1
  // Handles lookups using both id and name (case-insensitive) to support different backup schemas
  const sortedImportTags = useMemo(() => {
    if (!parsedData?.tags) return [];
    return [...parsedData.tags]
      .filter((t: any) => {
        const idKey = (t.id || "").toLowerCase().trim();
        const nameKey = (t.name || "").toLowerCase().trim();
        const countId = parsedTagCounts[t.id] ?? parsedTagCounts[idKey] ?? 0;
        const countName = parsedTagCounts[t.name] ?? parsedTagCounts[nameKey] ?? 0;
        return countId >= 1 || countName >= 1;
      })
      .sort((a: any, b: any) => {
        const aSel = l2SpecificTags.has(a.id);
        const bSel = l2SpecificTags.has(b.id);
        if (aSel && !bSel) return -1;
        if (!aSel && bSel) return 1;

        const idKeyA = (a.id || "").toLowerCase().trim();
        const nameKeyA = (a.name || "").toLowerCase().trim();
        const countIdA = parsedTagCounts[a.id] ?? parsedTagCounts[idKeyA] ?? 0;
        const countNameA = parsedTagCounts[a.name] ?? parsedTagCounts[nameKeyA] ?? 0;
        const countA = Math.max(countIdA, countNameA);

        const idKeyB = (b.id || "").toLowerCase().trim();
        const nameKeyB = (b.name || "").toLowerCase().trim();
        const countIdB = parsedTagCounts[b.id] ?? parsedTagCounts[idKeyB] ?? 0;
        const countNameB = parsedTagCounts[b.name] ?? parsedTagCounts[nameKeyB] ?? 0;
        const countB = Math.max(countIdB, countNameB);

        return countB - countA;
      });
  }, [parsedData, parsedTagCounts, l2SpecificTags]);

  // Calculate filtered list of clips (scope + text + date + sub-filters)
  const filteredClips = useMemo(() => {
    return conflictResolvedBaseClips.filter((clip) => {
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
        if (!clip.tags || !clip.tags.some((t: string) => l2SpecificTags.has(t) || selectedTagsSet.has(t.toLowerCase().trim()))) {
          return false;
        }
      } else if (l2SpecificTagsMode === "exclude" && l2SpecificTags.size > 0) {
        if (clip.tags && clip.tags.some((t: string) => l2SpecificTags.has(t) || selectedTagsSet.has(t.toLowerCase().trim()))) {
          return false;
        }
      }

      return true;
    });
  }, [
    conflictResolvedBaseClips,
    textFilter,
    dateFrom,
    dateTo,
    level1Scope,
    l2Favorite,
    l2Recycle,
    l2Tagged,
    l2SpecificTagsMode,
    l2SpecificTags,
    selectedTagsSet,
  ]);

  // Conflict-aware clip list
  const conflictAwareClips = filteredClips;

  // Dynamic date bounds derived from conflict-aware clip list
  const conflictAwareDateBounds = useMemo(() => {
    const timestamps = conflictAwareClips
      .map((c: any) => c.timestamp)
      .filter(Boolean)
      .map((t: string) => new Date(t).getTime());
    if (timestamps.length === 0) return { min: "", max: "" };
    return {
      min: new Date(Math.min(...timestamps)).toISOString().split("T")[0],
      max: new Date(Math.max(...timestamps)).toISOString().split("T")[0],
    };
  }, [conflictAwareClips]);

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

  const toggleL2Favorite = (value: "yes" | "no") => {
    setL2Favorite((prev) => (prev === value ? "all" : value));
  };

  const toggleL2Recycle = (value: "yes" | "no") => {
    setL2Recycle((prev) => (prev === value ? "all" : value));
  };

  const toggleL2Tagged = (value: "yes" | "no") => {
    setL2Tagged((prev) => {
      const next = prev === value ? "all" : value;
      if (next !== "yes" && level1Scope !== "tagged") {
        setL2SpecificTagsMode("disabled");
        setL2SpecificTags(new Set());
      } else if (next === "yes") {
        setL2SpecificTagsMode("include");
      }
      return next;
    });
  };

  // Prepopulate tags checkbox state on conflict resolution or data load
  useEffect(() => {
    if (status === "progress" || status === "summary" || status === "error") return;
    if (!parsedData || !parsedData.tags) return;
    const localTagsLower = new Set(localTags.map((t) => t.name.toLowerCase().trim()));
    const localTagIds = new Set(localTags.map((t) => t.id));

    const initialSelected = new Set<string>();
    parsedData.tags.forEach((t) => {
      const isConflict = localTagIds.has(t.id) || localTagsLower.has(t.name.toLowerCase().trim());
      if (tagConflict === "keep-new" || !isConflict) {
        initialSelected.add(t.id);
      }
    });
    setSelectedTags(initialSelected);
  }, [parsedData, tagConflict, localTags]);

  // Prepopulate settings checkboxes on data load and conflict changes
  useEffect(() => {
    if (status === "progress" || status === "summary" || status === "error") return;
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
    
    const nextSelected = new Set<string>();
    keys.forEach((key) => {
      const backupVal = parsedData.settings[key];
      const localVal = (localSettings as any)[key];
      const isConflict = backupVal !== localVal;
      
      if (settingsConflict === "keep-new") {
        nextSelected.add(key);
      } else if (settingsConflict === "keep-existing") {
        // "Skip duplicates": if backup value and local value are same (duplicate), we skip (uncheck) it.
        // If they are different (conflict), we check it to apply the new setting.
        if (isConflict) {
          nextSelected.add(key);
        }
      }
    });
    setSelectedSettingsKeys(nextSelected);
  }, [parsedData, settingsConflict, localSettings]);

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
    setSettingsConflict("keep-existing");
    setSettingsConflictOpen(false);
    setSettingsSearch("");
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

      // Snapshot localTags BEFORE setting parsedData so the prepopulation useEffect uses pre-import local tags
      localTagsSnapshotRef.current = localTags.map((t) => ({ id: t.id, name: t.name }));

      setParsedData({
        clips: data.clips || [],
        tags: data.tags || [],
        settings: data.settings || null,
      });

      // Reset conflict resolutions to default "keep-existing" (skip duplicates)
      setClipConflict("keep-existing");
      setTagConflict("keep-existing");

      // Proceed to the next step
      setStatus("preview");
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
      if (parsedData?.settings && selectedSettingsKeys.size > 0) {
        settingsToImport = {};
        selectedSettingsKeys.forEach((k) => {
          settingsToImport[k] = parsedData.settings[k];
        });
      }

      // Filter tags array based on checked tags
      let tagsToImport = (parsedData?.tags || []).filter((t) => selectedTags.has(t.id));

      // Process clips to apply the actions (make favorite, attach tag)
      let clipsToImport = [...conflictAwareClips];
      if (importMakeFavorite) {
        clipsToImport = clipsToImport.map(clip => ({
          ...clip,
          isFavorite: true
        }));
      }

      if (importAttachTag) {
        const selectedAttachTagObj = availableTagsForAttachment.find(
          (t) => t.id === importAttachTag || t.name === importAttachTag
        );
        if (selectedAttachTagObj) {
          // If the tag is from the backup and not in local tags or checked tags, add it to tagsToImport
          const isInLocal = localTags.some(
            (t) =>
              t.id === selectedAttachTagObj.id ||
              t.name.toLowerCase().trim() === selectedAttachTagObj.name.toLowerCase().trim()
          );
          const isInImport = tagsToImport.some(
            (t) =>
              t.id === selectedAttachTagObj.id ||
              t.name.toLowerCase().trim() === selectedAttachTagObj.name.toLowerCase().trim()
          );
          if (!isInLocal && !isInImport) {
            const backupTag = parsedData?.tags.find(
              (t) =>
                t.id === selectedAttachTagObj.id ||
                t.name.toLowerCase().trim() === selectedAttachTagObj.name.toLowerCase().trim()
            );
            if (backupTag) {
              tagsToImport.push(backupTag);
            } else {
              tagsToImport.push({
                id: selectedAttachTagObj.id,
                name: selectedAttachTagObj.name,
                color: selectedAttachTagObj.color,
              });
            }
          }

          // Attach to all imported clips
          clipsToImport = clipsToImport.map((clip) => {
            const tags = Array.isArray(clip.tags) ? [...clip.tags] : [];
            // We want to add the ID of the tag. If tag mapping is performed on ID or name,
            // we can use the ID or name. Let's use the ID.
            if (!tags.includes(selectedAttachTagObj.id)) {
              tags.push(selectedAttachTagObj.id);
            }
            return {
              ...clip,
              tags,
            };
          });
        }
      }

      const result = await window.clipAPI.executeCustomImport({
        clips: clipsToImport,
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
      
      if (next.size > 0 && l2SpecificTagsMode === "disabled") {
        setL2SpecificTagsMode("include");
      } else if (next.size === 0) {
        setL2SpecificTagsMode("disabled");
      }
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

  const getSubtitle = () => {
    switch (status) {
      case "clips-config":
        return "Configure Clipboard Clips Import";
      case "tags-config":
        return "Configure Tags Import";
      case "settings-config":
        return "Configure Settings Import";
      case "preview":
        return "Preview Import Contents";
      case "progress":
        return "Importing Backup Data";
      case "summary":
        return "Import Summary";
      default:
        return "";
    }
  };

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={status === "progress" ? () => {} : handleClose}
        title={
          <div className="flex items-center gap-3 text-left">
            <IconZap size={20} className="text-brand-400 shrink-0" />
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white uppercase tracking-widest leading-none">
                Advanced Data Import System
              </span>
              {getSubtitle() && (
                <span className="text-[10px] text-gray-400 font-medium mt-1">
                  {getSubtitle()}
                </span>
              )}
            </div>
          </div>
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
            {status === "clips-config" && (
              <button
                type="button"
                onClick={() => setShowPreviewList(true)}
                className="text-[11px] font-semibold text-brand-300 bg-brand-500/10 border border-brand-500/20 hover:bg-brand-500/20 transition-colors px-2.5 py-0.5 rounded-md font-mono cursor-pointer"
              >
                {conflictAwareClips.length} clips
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

              <div className="bg-surface-900/40 rounded-xl p-4 space-y-3.5 text-xs text-gray-400">
                <div className="flex gap-3">
                  <IconShield size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-gray-200 block">Conflict Resolutions</span>
                    Choose to keep local database items or overwrite them.
                  </div>
                </div>
                <div className="flex gap-3">
                  <IconLayers size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-gray-200 block">Flexible Custom Filters</span>
                    Filter imports by text, date ranges, favorites, tags, or recycle bin.
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

          {/* STEP 1.5: IMPORT PREVIEW DASHBOARD */}
          {status === "preview" && parsedData && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2 py-2">
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-400 mx-auto mb-2">
                  <IconShield className="w-7 h-7 text-brand-400" />
                </div>
                <h4 className="text-sm font-bold text-white">Import Preview</h4>
                <p className="text-xs text-gray-500">
                  Here is a summary of what will be imported or skipped from the backup. Click any card to customize its import filters.
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                {/* Clips Preview Card */}
                <button
                  type="button"
                  onClick={() => setStatus("clips-config")}
                  className="group relative flex flex-col justify-between text-left p-3.5 bg-surface-800/40 hover:bg-surface-800/80 border border-gray-700/50 hover:border-brand-500/40 rounded-xl transition-all duration-200 cursor-pointer shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-brand-500/5 select-none overflow-hidden w-full animate-fade-in shiny-card-effect shiny-delay-1"
                >
                  {/* Accent Line */}
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-brand-500 to-indigo-500 opacity-60 group-hover:opacity-100 transition-opacity" />

                  <div className="flex gap-3 items-center w-full">
                    {/* Left: Icon Badge */}
                    <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 group-hover:scale-105 transition-transform duration-200 shrink-0">
                      <IconLayers size={18} />
                    </div>

                    {/* Right: Metrics & Title */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-1.5">
                        <span className="text-[11px] font-bold text-gray-300 group-hover:text-white transition-colors uppercase tracking-wider truncate">Clips</span>
                        <span className={`text-base font-extrabold font-mono shrink-0 ${conflictAwareClips.length > 0 ? "text-white" : "text-rose-400"}`}>
                          {conflictAwareClips.length > 0 ? `+${conflictAwareClips.length}` : "0"}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500 font-medium truncate mt-0.5">
                        {parsedData.clips.length - conflictAwareClips.length} skipped
                      </div>
                    </div>
                  </div>

                  {/* Action Link */}
                  <div className="mt-3 pt-2.5 border-t border-gray-800/60 flex items-center justify-between text-[9px] font-bold text-brand-400 group-hover:text-brand-300 transition-colors w-full">
                    <span>Configure Filters</span>
                    <svg className="w-3 h-3 transform group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {/* Tags Preview Card */}
                <button
                  type="button"
                  onClick={() => setStatus("tags-config")}
                  className="group relative flex flex-col justify-between text-left p-3.5 bg-surface-800/40 hover:bg-surface-800/80 border border-gray-700/50 hover:border-fuchsia-500/40 rounded-xl transition-all duration-200 cursor-pointer shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-fuchsia-500/5 select-none overflow-hidden w-full animate-fade-in shiny-card-effect shiny-delay-2"
                >
                  {/* Accent Line */}
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-fuchsia-500 to-pink-500 opacity-60 group-hover:opacity-100 transition-opacity" />

                  <div className="flex gap-3 items-center w-full">
                    {/* Left: Icon Badge */}
                    <div className="p-2 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 group-hover:scale-105 transition-transform duration-200 shrink-0">
                      <IconTag size={18} />
                    </div>

                    {/* Right: Metrics & Title */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-1.5">
                        <span className="text-[11px] font-bold text-gray-300 group-hover:text-white transition-colors uppercase tracking-wider truncate">Tags</span>
                        <span className={`text-base font-extrabold font-mono shrink-0 ${selectedTags.size > 0 ? "text-white" : "text-rose-400"}`}>
                          {selectedTags.size > 0 ? `+${selectedTags.size}` : "0"}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500 font-medium truncate mt-0.5">
                        {parsedData.tags.length - selectedTags.size} skipped
                      </div>
                    </div>
                  </div>

                  {/* Action Link */}
                  <div className="mt-3 pt-2.5 border-t border-gray-800/60 flex items-center justify-between text-[9px] font-bold text-fuchsia-400 group-hover:text-fuchsia-300 transition-colors w-full">
                    <span>Configure Tags</span>
                    <svg className="w-3 h-3 transform group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {/* Settings Preview Card */}
                <button
                  type="button"
                  onClick={() => setStatus("settings-config")}
                  className="group relative flex flex-col justify-between text-left p-3.5 bg-surface-800/40 hover:bg-surface-800/80 border border-gray-700/50 hover:border-amber-500/40 rounded-xl transition-all duration-200 cursor-pointer shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-amber-500/5 select-none overflow-hidden w-full animate-fade-in shiny-card-effect shiny-delay-3"
                >
                  {/* Accent Line */}
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-500 to-orange-500 opacity-60 group-hover:opacity-100 transition-opacity" />

                  <div className="flex gap-3 items-center w-full">
                    {/* Left: Icon Badge */}
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 group-hover:scale-105 transition-transform duration-200 shrink-0">
                      <IconSettings size={18} />
                    </div>

                    {/* Right: Metrics & Title */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-1.5">
                        <span className="text-[11px] font-bold text-gray-300 group-hover:text-white transition-colors uppercase tracking-wider truncate">Settings</span>
                        <span className={`text-base font-extrabold font-mono shrink-0 ${selectedSettingsKeys.size > 0 ? "text-white" : "text-rose-400"}`}>
                          {selectedSettingsKeys.size > 0 ? `+${selectedSettingsKeys.size}` : "0"}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500 font-medium truncate mt-0.5">
                        {`${Object.keys(parsedData.settings || {}).filter(k => ["autoLaunch", "maxEntries", "pollingInterval", "paginationEnabled", "pageSize", "viewMode", "displayMode", "pauseCaptureOption"].includes(k)).length - selectedSettingsKeys.size} skipped`}
                      </div>
                    </div>
                  </div>

                  {/* Action Link */}
                  <div className="mt-3 pt-2.5 border-t border-gray-800/60 flex items-center justify-between text-[9px] font-bold text-amber-400 group-hover:text-amber-300 transition-colors w-full">
                    <span>Configure Settings</span>
                    <svg className="w-3 h-3 transform group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              </div>

              {/* Active configuration summary note */}
              <div className="flex flex-col gap-1 p-3 rounded-xl bg-indigo-950/20 text-[10.5px]">
                <div className="flex items-start gap-1.5 text-gray-400">
                  <span className="shrink-0 px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 font-bold uppercase text-[9px] tracking-wider mt-0.5">Active Scope</span>
                  <span className="text-gray-350 font-medium leading-relaxed">{combinationNote}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setParsedData(null);
                    setStatus("config");
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-700 bg-surface-850 text-gray-300 hover:bg-surface-750 text-xs font-semibold tracking-wide transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <IconRefresh size={14} className="text-gray-400" />
                  Choose Different File
                </button>
                <button
                  type="button"
                  onClick={handlePerformImport}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20"
                >
                  <IconCheck size={14} />
                  Run Import Now
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
              <div className="flex flex-nowrap items-center justify-between">
                {/* Grouped Result Actions Category (left side) */}
                <div className="flex items-center gap-2.5 bg-surface-900/30 border-white/5 p-1.5 rounded-xl">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold pl-1.5 shrink-0 select-none">
                    Result Actions:
                  </span>
                  
                  {/* Make Favorite */}
                  <button
                    type="button"
                    onClick={() => setImportMakeFavorite(!importMakeFavorite)}
                    className={`inline-flex items-center text-nowrap gap-1.5 h-8 px-3 rounded-lg transition-all duration-200 cursor-pointer text-[11px] font-medium border-0 ${
                      importMakeFavorite
                        ? "bg-amber-500/10 text-amber-400 font-semibold"
                        : "bg-surface-800/40 hover:bg-surface-800 text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {importMakeFavorite ? "★ Favorited" : "☆ Favorite"}
                  </button>

                  {/* Attach Tag */}
                  <AttachTagSelect
                    value={importAttachTag}
                    onChange={setImportAttachTag}
                    availableTags={availableTagsForAttachment}
                    isOpen={importAttachTagOpen}
                    setIsOpen={setImportAttachTagOpen}
                  />
                </div>

                {/* Conflict Resolution (right side) */}
                <div className="flex flex-nowrap flex-row items-center gap-2">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium shrink-0 select-none">
                    Conflict :
                  </span>
                  <CustomSelect
                    value={clipConflict}
                    onChange={setClipConflict}
                    options={[
                      { value: "keep-existing", label: "Skip duplicates" },
                      { value: "keep-new", label: "Keep duplicates" }
                    ]}
                    isOpen={clipConflictOpen}
                    setIsOpen={setClipConflictOpen}
                    borderless
                  />
                </div>
              </div>

              {/* TEXT FILTER + DATE RANGE — same layout as BulkActions */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3.5">
                  {/* Text-wise Filter */}
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

                  {/* Date Range — nested 2-col sub-grid like BulkActions */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1.5 ml-10">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium pl-0.5">
                        Date From
                      </span>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        min={dynamicDateBounds.min || undefined}
                        max={dateTo || dynamicDateBounds.max || undefined}
                        className="w-full max-w-[110px] bg-surface-900 border-0 outline-none rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5 ml-10">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium pl-0.5">
                        Date To
                      </span>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        min={dateFrom || dynamicDateBounds.min || undefined}
                        max={dynamicDateBounds.max || undefined}
                        className="w-full max-w-[110px] bg-surface-900 border-0 outline-none rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* BASE CATEGORY SCOPE */}
              <div className="space-y-2">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium pl-0.5">
                  Select Base Category Scope
                </span>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { key: "all",       label: "All Clips",  count: parsedCounts.all,      color: "brand"   as const, dot: "bg-brand-400" },
                    { key: "favorites", label: "Favourites", count: parsedCounts.favorites, color: "star"    as const, dot: "bg-amber-400" },
                    { key: "tagged",    label: "Tagged",     count: parsedCounts.tagged,    color: "violet"  as const, dot: "bg-violet-400" },
                    { key: "active",    label: "Not Recycle",count: parsedCounts.active,    color: "emerald" as const, dot: "bg-emerald-400" },
                    { key: "deleted",   label: "Recycle Bin",count: parsedCounts.deleted,   color: "rose"    as const, dot: "bg-rose-400" },
                  ].map((item) => {
                    const active = level1Scope === item.key;
                    const styles = {
                      brand:   { btn: "bg-brand-500/12 border-brand-500/50 shadow-brand-500/10",   label: "text-brand-300",   count: "text-brand-400",   ring: "ring-brand-500/30" },
                      star:    { btn: "bg-amber-500/12 border-amber-500/50 shadow-amber-500/10",   label: "text-amber-300",   count: "text-amber-400",   ring: "ring-amber-500/30" },
                      violet:  { btn: "bg-violet-500/12 border-violet-500/50 shadow-violet-500/10",label: "text-violet-300",  count: "text-violet-400",  ring: "ring-violet-500/30" },
                      emerald: { btn: "bg-emerald-500/12 border-emerald-500/50 shadow-emerald-500/10",label: "text-emerald-300",count: "text-emerald-400",ring: "ring-emerald-500/30" },
                      rose:    { btn: "bg-rose-500/12 border-rose-500/50 shadow-rose-500/10",      label: "text-rose-300",    count: "text-rose-400",    ring: "ring-rose-500/30" },
                    }[item.color];
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setLevel1Scope(item.key as any);
                          if (item.key !== "tagged" && l2Tagged !== "yes") {
                            setL2SpecificTagsMode("disabled");
                            setL2SpecificTags(new Set());
                          } else if (item.key === "tagged") {
                            setL2SpecificTagsMode("include");
                          }
                        }}
                        className={`relative py-2.5 px-2 rounded-xl border flex flex-row items-center justify-center gap-1 transition-all duration-200 cursor-pointer overflow-hidden whitespace-nowrap ${
                          active
                            ? `${styles.btn} shadow-lg ring-1 ${styles.ring}`
                            : "bg-surface-900/40 border-gray-800/80 text-gray-500 hover:bg-surface-900/70 hover:border-gray-700 hover:text-gray-300"
                        }`}
                      >
                        <span className={`text-[9.5px] font-bold uppercase tracking-wide leading-none whitespace-nowrap ${active ? styles.label : "text-gray-500"}`}>
                          {item.label}
                        </span>
                        <span className={`text-[11px] font-extrabold font-mono leading-none tabular-nums whitespace-nowrap ${active ? styles.count : "text-gray-400"}`}>
                          ({item.count})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* REFINE OPTIONS FOR SELECTED SCOPE */}
              {level1Scope !== "all" && (
                <div className="bg-surface-900/40 border border-gray-800 rounded-xl p-4 space-y-4">

                  <div className="flex flex-wrap justify-between gap-y-3">
                    {/* Favorites Sub-filter — hidden when scope is already "favorites" */}
                    {level1Scope !== "favorites" && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium pl-0.5 block">
                          Favorites Filter
                        </span>
                        <div className="flex items-center gap-1.5">
                          <ToggleChip
                            label="Only favourites"
                            active={l2Favorite === "yes"}
                            color="star"
                            onClick={() => toggleL2Favorite("yes")}
                          />
                          <ToggleChip
                            label="Exclude Favourites"
                            active={l2Favorite === "no"}
                            color="brand"
                            onClick={() => toggleL2Favorite("no")}
                          />
                        </div>
                      </div>
                    )}

                    {/* Recycle Bin Sub-filter — hidden when scope already locks recycle state */}
                    {level1Scope !== "active" && level1Scope !== "deleted" && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium pl-0.5 block">
                          Recycle Bin Filter
                        </span>
                        <div className="flex items-center gap-1.5">
                          <ToggleChip
                            label="Only Recycle Bin"
                            active={l2Recycle === "yes"}
                            color="rose"
                            onClick={() => toggleL2Recycle("yes")}
                          />
                          <ToggleChip
                            label="Exclude Recycle Bin"
                            active={l2Recycle === "no"}
                            color="emerald"
                            onClick={() => toggleL2Recycle("no")}
                          />
                        </div>
                      </div>
                    )}

                    {/* Tags Presence Sub-filter — hidden when scope is "tagged" (already implies having tags) */}
                    {level1Scope !== "tagged" && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium pl-0.5 block">
                          Tags Presence
                        </span>
                        <div className="flex items-center gap-1.5">
                          <ToggleChip
                            label="Having Tags"
                            active={l2Tagged === "yes"}
                            color="violet"
                            onClick={() => toggleL2Tagged("yes")}
                          />
                          <ToggleChip
                            label="No Tags"
                            active={l2Tagged === "no"}
                            color="brand"
                            onClick={() => toggleL2Tagged("no")}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Specific Tags Inclusion / Exclusion — only shown when user manually enables Tags Presence sub-filter (l2Tagged=yes).
                      When base scope is "tagged", this panel is intentionally hidden because the scope itself implies tagged. */}
                  {l2Tagged === "yes" && level1Scope !== "tagged" && sortedImportTags.length > 0 && (
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
                      {l2SpecificTags.size > 0 && (
                        <div className="flex gap-1.5 items-center">
                          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium pl-0.5">Mode:</span>
                          <ToggleChip
                            label="From Selection"
                            active={l2SpecificTagsMode === "include"}
                            color="emerald"
                            onClick={() => setL2SpecificTagsMode("include")}
                          />
                          <ToggleChip
                            label="Exclude Selection"
                            active={l2SpecificTagsMode === "exclude"}
                            color="rose"
                            onClick={() => setL2SpecificTagsMode("exclude")}
                          />
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto pr-1 dialog-scrollbar">
                        {sortedImportTags
                          .filter((t: any) => t.name.toLowerCase().includes(specificTagsSearch.toLowerCase()))
                          .map((tag: any) => {
                            const idKey = (tag.id || "").toLowerCase().trim();
                            const nameKey = (tag.name || "").toLowerCase().trim();
                            const tagCount = Math.max(
                              parsedTagCounts[tag.id] ?? 0,
                              parsedTagCounts[idKey] ?? 0,
                              parsedTagCounts[tag.name] ?? 0,
                              parsedTagCounts[nameKey] ?? 0
                            );
                            return (
                              <TagBadge
                                key={tag.id}
                                tag={tag}
                                size="sm"
                                active={l2SpecificTags.has(tag.id)}
                                count={tagCount}
                                onClick={() => handleToggleL2SpecificTag(tag.id)}
                              />
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}


              {/* ── Active combination summary ────────────────────────────── */}
              <div className="flex flex-col gap-1 p-2 rounded-lg bg-indigo-950/30 text-[10.5px]">
                <div className="flex items-center gap-1.5 text-gray-400">
                  <span className="shrink-0 px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 font-bold uppercase text-[9px] tracking-wider">Target</span>
                  <span className="text-gray-300 font-medium truncate" title={combinationNote}>{combinationNote}</span>
                </div>
              </div>

              {/* ACTION FOOTER */}
              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStatus("preview")}
                  className="px-4 py-2 rounded-xl border border-gray-700 bg-surface-850 hover:bg-surface-750 text-gray-300 text-xs font-semibold cursor-pointer"
                >
                  ← Back to Preview
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
              <div className="flex flex-nowrap items-center justify-between">
                {/* Tag search input (left side, replacing selection summary) */}
                <div className="relative flex items-center group max-w-[240px] w-full">
                  <div className="absolute left-3 text-gray-655 group-focus-within:text-brand-400 transition-colors pointer-events-none duration-150">
                    <IconSearch size={14} />
                  </div>
                  <input
                    type="text"
                    placeholder="Search backup tags..."
                    value={backupTagsSearch}
                    onChange={(e) => setBackupTagsSearch(e.target.value)}
                    className="w-full bg-transparent border-0 border-b border-gray-600 hover:border-gray-500 focus:border-brand-500 focus:ring-0 focus:outline-none pl-9 pr-9 py-1 text-xs text-white/85 placeholder-gray-650 transition-colors duration-150"
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

                {/* Tag Conflict Resolution (right side) */}
                <div className="flex flex-nowrap items-center justify-center gap-2">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium shrink-0 select-none">
                    Conflict :
                  </span>
                  <CustomSelect
                    value={tagConflict}
                    onChange={setTagConflict}
                    options={[
                      { value: "keep-existing", label: "Skip duplicates" },
                      { value: "keep-new", label: "Keep duplicates" }
                    ]}
                    isOpen={tagConflictOpen}
                    setIsOpen={setTagConflictOpen}
                    borderless
                  />
                </div>
              </div>

              {/* Backup list container */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] text-gray-500 uppercase tracking-wider font-medium pl-0.5">
                    <span>Backup Tags List</span>
                    <span className="text-brand-400 font-bold font-mono">
                      Selected: {selectedTags.size} of {parsedData.tags.length}
                    </span>
                  </div>
                  <div className="max-h-60 overflow-y-auto pr-1 dialog-scrollbar grid grid-cols-2 gap-2.5">
                    {[...parsedData.tags]
                      .filter((t) => t.name.toLowerCase().includes(backupTagsSearch.toLowerCase()))
                      .sort((a, b) => {
                        const aSel = selectedTags.has(a.id);
                        const bSel = selectedTags.has(b.id);
                        if (aSel && !bSel) return -1;
                        if (!aSel && bSel) return 1;

                        const aMatch = localTags.some(
                          (lt) =>
                            lt.id === a.id || lt.name.toLowerCase().trim() === a.name.toLowerCase().trim()
                        );
                        const bMatch = localTags.some(
                          (lt) =>
                            lt.id === b.id || lt.name.toLowerCase().trim() === b.name.toLowerCase().trim()
                        );
                        if (!aMatch && bMatch) return -1;
                        if (aMatch && !bMatch) return 1;
                        return 0;
                      })
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
                            className={`group flex items-center justify-between p-2.5 rounded-xl border transition-all duration-250 cursor-pointer select-none ${
                              isSelected
                                ? "bg-brand-500/5 border-brand-500/35 hover:bg-brand-500/10 hover:border-brand-500/50 shadow-md shadow-brand-500/5 opacity-100"
                                : "bg-surface-950/20 border-gray-900/60 hover:bg-surface-900/40 hover:border-gray-800 opacity-55 hover:opacity-85"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {/* Custom Checkbox */}
                              <div className={`w-[18px] h-[18px] rounded-full border flex items-center justify-center shrink-0 transition-all duration-200 ${
                                isSelected 
                                  ? "bg-gradient-to-br from-brand-500 to-brand-600 border-brand-400 text-white shadow-[0_0_10px_rgba(99,102,241,0.4)] scale-105" 
                                  : "border-gray-700/80 bg-surface-950/50 text-transparent group-hover:border-brand-500/50 group-hover:bg-surface-900/30 group-hover:scale-102"
                              }`}>
                                <svg 
                                  className={`w-2.5 h-2.5 stroke-white transition-all duration-200 ${
                                    isSelected ? "scale-100 opacity-100 rotate-0" : "scale-50 opacity-0 -rotate-12"
                                  }`} 
                                  viewBox="0 0 24 24" 
                                  fill="none" 
                                  strokeWidth="4" 
                                  strokeLinecap="round" 
                                  strokeLinejoin="round"
                                >
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              </div>
                              <div 
                                className="flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-semibold truncate transition-all duration-150"
                                style={
                                  isSelected ? {
                                    backgroundColor: (tag.color || "#6366f1") + "15",
                                    borderColor: (tag.color || "#6366f1") + "30",
                                    color: tag.color || "#6366f1"
                                  } : {
                                    backgroundColor: "rgba(255,255,255,0.02)",
                                    borderColor: "rgba(255,255,255,0.05)",
                                    color: "#9ca3af"
                                  }
                                }
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full shrink-0 transition-colors"
                                  style={{
                                    backgroundColor: isSelected ? (tag.color || "#6366f1") : "#4b5563"
                                  }}
                                />
                                <span className="truncate">{tag.name}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 transition-opacity duration-150">
                              {localMatch ? (
                                <span className={`text-[8px] border px-1.5 py-0.5 rounded font-bold uppercase tracking-wider transition-colors ${
                                  isSelected 
                                    ? "bg-surface-950/30 text-gray-500 border-white/5 opacity-80" 
                                    : "bg-surface-950/30 text-gray-500 border-white/5 opacity-50"
                                }`}>
                                  Duplicate
                                </span>
                              ) : (
                                <span className={`text-[8px] border px-1.5 py-0.5 rounded font-bold uppercase tracking-wider transition-colors ${
                                  isSelected 
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                    : "bg-surface-950/30 text-gray-500 border-white/5 opacity-50"
                                }`}>
                                  New
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* FOOTER ACTIONS */}
              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStatus("preview")}
                  className="px-4 py-2 rounded-xl border border-gray-700 bg-surface-850 hover:bg-surface-750 text-gray-300 text-xs font-semibold cursor-pointer"
                >
                  ← Back to Preview
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
              <div className="flex flex-nowrap items-center justify-between">
                {/* Settings search input (left side, matching tag search input) */}
                <div className="relative flex items-center group max-w-[240px] w-full">
                  <div className="absolute left-3 text-gray-655 group-focus-within:text-brand-400 transition-colors pointer-events-none duration-150">
                    <IconSearch size={14} />
                  </div>
                  <input
                    type="text"
                    placeholder="Search backup settings..."
                    value={settingsSearch}
                    onChange={(e) => setSettingsSearch(e.target.value)}
                    className="w-full bg-transparent border-0 border-b border-gray-600 hover:border-gray-500 focus:border-brand-500 focus:ring-0 focus:outline-none pl-9 pr-9 py-1 text-xs text-white/85 placeholder-gray-650 transition-colors duration-150"
                  />
                  {settingsSearch && (
                    <button
                      type="button"
                      onClick={() => setSettingsSearch("")}
                      className="absolute right-2 p-1 text-gray-600 hover:text-gray-400 transition-colors duration-150"
                      title="Clear search"
                    >
                      <IconX size={12} />
                    </button>
                  )}
                </div>

                {/* Settings Conflict Resolution (right side, matching tag conflict resolution) */}
                <div className="flex flex-nowrap flex-row items-center justify-center gap-2">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium shrink-0 select-none">
                    Conflict :
                  </span>
                  <CustomSelect
                    value={settingsConflict}
                    onChange={setSettingsConflict}
                    options={[
                      { value: "keep-existing", label: "Skip duplicates" },
                      { value: "keep-new", label: "Keep duplicates" }
                    ]}
                    isOpen={settingsConflictOpen}
                    setIsOpen={setSettingsConflictOpen}
                    borderless
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] text-gray-500 uppercase tracking-wider font-medium pl-0.5">
                    <span>Settings Keys Comparison</span>
                    <span className="text-brand-400 font-bold font-mono">
                      Selected: {selectedSettingsKeys.size} of {
                        Object.keys(parsedData.settings).filter((k) =>
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
                        ).length
                      }
                    </span>
                  </div>

                  <div className="max-h-60 overflow-y-auto pr-1 dialog-scrollbar grid grid-cols-1 gap-2.5">
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
                      .filter((key) => key.toLowerCase().includes(settingsSearch.toLowerCase()))
                      .sort((a, b) => {
                        const aConflict = parsedData.settings[a] !== (localSettings as any)[a];
                        const bConflict = parsedData.settings[b] !== (localSettings as any)[b];
                        if (aConflict && !bConflict) return -1;
                        if (!aConflict && bConflict) return 1;
                        return 0;
                      })
                      .map((key) => {
                        const isSelected = selectedSettingsKeys.has(key);
                        const backupVal = parsedData.settings[key];
                        const localVal = (localSettings as any)[key];
                        const isConflict = backupVal !== localVal;

                        return (
                          <div
                            key={key}
                            onClick={() => handleToggleSettingSelection(key)}
                            className={`group flex items-center justify-between p-2.5 rounded-xl border transition-all duration-250 cursor-pointer select-none ${
                              isSelected
                                ? "bg-brand-500/5 border-brand-500/35 hover:bg-brand-500/10 hover:border-brand-500/50 shadow-md shadow-brand-500/5 opacity-100"
                                : "bg-surface-950/20 border-gray-900/60 hover:bg-surface-900/40 hover:border-gray-800 opacity-55 hover:opacity-85"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {/* Custom Checkbox */}
                              <div className={`w-[18px] h-[18px] rounded-full border flex items-center justify-center shrink-0 transition-all duration-200 ${
                                isSelected 
                                  ? "bg-gradient-to-br from-brand-500 to-brand-600 border-brand-400 text-white shadow-[0_0_10px_rgba(99,102,241,0.4)] scale-105" 
                                  : "border-gray-700/80 bg-surface-950/50 text-transparent group-hover:border-brand-500/50 group-hover:bg-surface-900/30 group-hover:scale-102"
                              }`}>
                                <svg 
                                  className={`w-2.5 h-2.5 stroke-white transition-all duration-200 ${
                                    isSelected ? "scale-100 opacity-100 rotate-0" : "scale-50 opacity-0 -rotate-12"
                                  }`} 
                                  viewBox="0 0 24 24" 
                                  fill="none" 
                                  strokeWidth="4" 
                                  strokeLinecap="round" 
                                  strokeLinejoin="round"
                                >
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              </div>
                              <span className={`font-semibold text-[11px] px-2.5 py-1 rounded-lg border transition-all duration-150 ${
                                isSelected 
                                  ? "bg-surface-950/40 border-white/10 text-white/90" 
                                  : "bg-surface-950/20 border-white/5 text-gray-500"
                                }`}>
                                {formatSettingKey(key)}
                              </span>
                            </div>

                            <div className="flex items-center gap-3.5 text-[10px] font-mono">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider">Local:</span>
                                <span className={`px-2 py-0.5 rounded border ${
                                  isSelected 
                                    ? "bg-surface-950/60 border-white/10 text-gray-300" 
                                    : "bg-surface-950/20 border-transparent text-gray-600"
                                }`}>
                                  {String(localVal)}
                                </span>
                              </div>
                              <svg className={`w-3.5 h-3.5 transition-colors shrink-0 ${isSelected ? "text-brand-500" : "text-gray-750"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                              </svg>
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[9px] font-semibold uppercase tracking-wider ${
                                  isSelected ? "text-brand-400" : "text-gray-600"
                                }`}>Backup:</span>
                                <span className={`px-2 py-0.5 rounded border transition-all ${
                                  isSelected 
                                    ? "bg-brand-500/15 border-brand-500/30 text-brand-350 font-bold" 
                                    : "bg-surface-950/20 border-transparent text-gray-600"
                                }`}>
                                  {String(backupVal)}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0 transition-opacity duration-150 pl-2">
                                {isConflict ? (
                                  <span className={`text-[8px] border px-1.5 py-0.5 rounded font-bold uppercase tracking-wider transition-colors text-nowrap ${
                                    isSelected 
                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                      : "bg-surface-950/30 text-gray-500 border-white/5 opacity-50"
                                  }`}>
                                    New
                                  </span>
                                ) : (
                                  <span className={`text-[8px] border px-1.5 py-0.5 rounded font-bold uppercase tracking-wider transition-colors text-nowrap ${
                                    isSelected 
                                      ? "bg-surface-950/35 border-white/10 text-gray-400" 
                                      : "bg-surface-950/30 text-gray-500 border-white/5 opacity-50"
                                  }`}>
                                    Duplicate
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* FOOTER ACTIONS */}
              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStatus("preview")}
                  className="px-4 py-2 rounded-xl border border-gray-700 bg-surface-850 hover:bg-surface-750 text-gray-300 text-xs font-semibold cursor-pointer"
                >
                  ← Back to Preview
                </button>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={handlePerformImport}
                  className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-605 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-brand-500/20 cursor-pointer transition-all active:scale-95 flex items-center gap-2"
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
              <div className="grid grid-cols-3 gap-3">
                {/* Clips Preview Card */}
                <div
                  className="group relative flex flex-col justify-between text-left p-3.5 bg-surface-800/40 border border-gray-700/50 rounded-xl select-none overflow-hidden w-full animate-fade-in shiny-card-effect shiny-delay-1"
                >
                  {/* Accent Line */}
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-brand-500 to-indigo-500 opacity-80" />

                  <div className="flex gap-3 items-center w-full">
                    {/* Left: Icon Badge */}
                    <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 shrink-0">
                      <IconLayers size={18} />
                    </div>

                    {/* Right: Metrics & Title */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-1.5">
                        <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider truncate">Clips</span>
                        <span className={`text-base font-extrabold font-mono shrink-0 ${summary.importedClips > 0 ? "text-white" : "text-rose-400"}`}>
                          {summary.importedClips > 0 ? `+${summary.importedClips}` : "0"}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500 font-medium truncate mt-0.5">
                        {(parsedData?.clips.length || 0) - summary.importedClips} skipped
                      </div>
                    </div>
                  </div>

                  {/* Action Link */}
                  <div className={`mt-3 pt-2.5 border-t border-gray-800/60 flex items-center justify-between text-[9px] font-bold w-full ${
                    summary.importedClips > 0 ? "text-brand-400" : "text-rose-400"
                  }`}>
                    <span>{summary.importedClips > 0 ? "Imported Successfully" : "No Changes"}</span>
                    {summary.importedClips > 0 ? (
                      <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <IconX size={12} className="text-rose-400" />
                    )}
                  </div>
                </div>

                {/* Tags Preview Card */}
                <div
                  className="group relative flex flex-col justify-between text-left p-3.5 bg-surface-800/40 border border-gray-700/50 rounded-xl select-none overflow-hidden w-full animate-fade-in shiny-card-effect shiny-delay-2"
                >
                  {/* Accent Line */}
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-fuchsia-500 to-pink-500 opacity-80" />

                  <div className="flex gap-3 items-center w-full">
                    {/* Left: Icon Badge */}
                    <div className="p-2 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 shrink-0">
                      <IconTag size={18} />
                    </div>

                    {/* Right: Metrics & Title */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-1.5">
                        <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider truncate">Tags</span>
                        <span className={`text-base font-extrabold font-mono shrink-0 ${selectedTags.size > 0 ? "text-white" : "text-rose-400"}`}>
                          {selectedTags.size > 0 ? `+${selectedTags.size}` : "0"}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500 font-medium truncate mt-0.5">
                        {(parsedData?.tags.length || 0) - selectedTags.size} skipped
                      </div>
                    </div>
                  </div>

                  {/* Action Link */}
                  <div className={`mt-3 pt-2.5 border-t border-gray-800/60 flex items-center justify-between text-[9px] font-bold w-full ${
                    selectedTags.size > 0 ? "text-fuchsia-400" : "text-rose-400"
                  }`}>
                    <span>{selectedTags.size > 0 ? "Tags Imported" : "No Changes"}</span>
                    {selectedTags.size > 0 ? (
                      <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <IconX size={12} className="text-rose-400" />
                    )}
                  </div>
                </div>

                {/* Settings Preview Card */}
                <div
                  className="group relative flex flex-col justify-between text-left p-3.5 bg-surface-800/40 border border-gray-700/50 rounded-xl select-none overflow-hidden w-full animate-fade-in shiny-card-effect shiny-delay-3"
                >
                  {/* Accent Line */}
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-500 to-orange-500 opacity-80" />

                  <div className="flex gap-3 items-center w-full">
                    {/* Left: Icon Badge */}
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                      <IconSettings size={18} />
                    </div>

                    {/* Right: Metrics & Title */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-1.5">
                        <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider truncate">Settings</span>
                        <span className={`text-base font-extrabold font-mono shrink-0 ${selectedSettingsKeys.size > 0 ? "text-white" : "text-rose-400"}`}>
                          {selectedSettingsKeys.size > 0 ? `+${selectedSettingsKeys.size}` : "0"}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500 font-medium truncate mt-0.5">
                        {Object.keys(parsedData?.settings || {}).filter(k => ["autoLaunch", "maxEntries", "pollingInterval", "paginationEnabled", "pageSize", "viewMode", "displayMode", "pauseCaptureOption"].includes(k)).length - selectedSettingsKeys.size} skipped
                      </div>
                    </div>
                  </div>

                  {/* Action Link */}
                  <div className={`mt-3 pt-2.5 border-t border-gray-800/60 flex items-center justify-between text-[9px] font-bold w-full ${
                    selectedSettingsKeys.size > 0 ? "text-amber-400" : "text-rose-400"
                  }`}>
                    <span>{selectedSettingsKeys.size > 0 ? "Settings Applied" : "No Changes"}</span>
                    {selectedSettingsKeys.size > 0 ? (
                      <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <IconX size={12} className="text-rose-400" />
                    )}
                  </div>
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
            Preview ({conflictAwareClips.length > 3 ? `3 of ${conflictAwareClips.length}` : conflictAwareClips.length})
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
          {conflictAwareClips.slice(0, 3).map((c, i) => {
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
                        {(() => {
                          const resolvedTags = c.tags
                            .map((tid: string) => {
                              return parsedData?.tags?.find(
                                (t: any) =>
                                  t.id === tid ||
                                  t.name.toLowerCase().trim() === tid.toLowerCase().trim()
                              ) || localTags.find(
                                (t: any) =>
                                  t.id === tid ||
                                  t.name.toLowerCase().trim() === tid.toLowerCase().trim()
                              );
                            })
                            .filter((t: any): t is any => !!t);

                          const maxVisible = 2;
                          const visibleTags = resolvedTags.slice(0, maxVisible);
                          const remainingCount = resolvedTags.length - maxVisible;
                          const remainingNames = resolvedTags.slice(maxVisible).map((t: any) => t.name).join(", ");

                          return (
                            <>
                              {visibleTags.map((tagObj: any, idx: number) => (
                                <span key={tagObj.id || idx} className="px-1.5 py-0.5 rounded text-[8px] font-bold whitespace-nowrap inline-flex items-center max-w-[80px]" style={{ backgroundColor: tagObj.color + "20", color: tagObj.color }} title={tagObj.name}>
                                  <span className="truncate">{tagObj.name}</span>
                                </span>
                              ))}
                              {remainingCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-white/10 text-gray-400 cursor-help" title={remainingNames}>
                                  +{remainingCount}
                                </span>
                              )}
                            </>
                          );
                        })()}
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
