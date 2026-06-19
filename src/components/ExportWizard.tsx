import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Dialog from "./Dialog";
import {
  IconChevronDown,
  IconCheck,
  IconGrid,
  IconDatabase,
  IconTag,
  IconSettings,
  IconLayers,
  IconInbox,
  IconStar,
  IconTrash,
  IconSave
} from "./Icons";
import type { ExportOptions, ExportSummary, ScopeFilter, Tag } from "../types";
import { useClipStore } from "../store/useClipStore";

interface ExportWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

type ExportStatus = "config" | "progress" | "summary" | "error";

interface DropdownOption {
  value: string;
  label: string;
  desc?: string;
  icon?: React.ReactNode;
}

// ─── Inline SVG icons ────────────────────────────────────────────────────────

const IconJson = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

const IconExcel = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <line x1="15" y1="3" x2="15" y2="21" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="3" y1="15" x2="21" y2="15" />
  </svg>
);

const IconPdf = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

// ─── Custom Dropdown ──────────────────────────────────────────────────────────

const CustomDropdown: React.FC<{
  value: string;
  onChange: (value: any) => void;
  options: DropdownOption[];
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}> = ({ value, onChange, options, isOpen, setIsOpen }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const currentOption = options.find((o) => o.value === value) || options[0];

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
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-3 text-nowrap px-4 py-2 w-fit rounded-xl bg-surface-900 text-left transition-all duration-200 cursor-pointer ${
          isOpen ? "text-white shadow-lg shadow-brand-500/5" : "text-gray-300 hover:text-white"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 pr-4">
          {currentOption.icon && (
            <div className="text-brand-400 shrink-0">{currentOption.icon}</div>
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-[12px] font-medium">{currentOption.label}</span>
            {currentOption.desc && (
              <span className="text-[10px] text-gray-500 truncate mt-0.5">{currentOption.desc}</span>
            )}
          </div>
        </div>
        <IconChevronDown
          size={14}
          className={`text-gray-500 transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180 text-brand-400" : ""}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            className="absolute top-full right-0 mt-1.5 z-[1001] text-nowrap w-fit bg-surface-800 border border-white/10 rounded-xl p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] dialog-scrollbar"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                className={`w-full flex items-center justify-between text-nowrap my-0.5 px-4 py-2 rounded-lg text-left transition-all duration-150 cursor-pointer ${
                  value === opt.value
                    ? "bg-brand-500/10 text-brand-400 font-semibold"
                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-4">
                  {opt.icon && (
                    <div className={`shrink-0 ${value === opt.value ? "text-brand-400" : "text-gray-400"}`}>
                      {opt.icon}
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-[12px]">{opt.label}</span>
                    {opt.desc && (
                      <span className="text-[10px] text-gray-500 mt-0.5 leading-normal">{opt.desc}</span>
                    )}
                  </div>
                </div>
                {value === opt.value && <IconCheck size={14} className="text-brand-400 shrink-0" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Toggle Chip ─────────────────────────────────────────────────────────────

const ToggleChip: React.FC<{
  label: string;
  active: boolean;
  color?: "brand" | "star" | "rose" | "emerald" | "violet";
  icon?: React.ReactNode;
  onClick: () => void;
}> = ({ label, active, color = "brand", icon, onClick }) => {
  const colorMap = {
    brand:   active ? "bg-brand-500/15 border-brand-500/50 text-brand-300"   : "bg-surface-900 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200",
    star:    active ? "bg-amber-500/15 border-amber-500/50 text-amber-300"    : "bg-surface-900 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200",
    rose:    active ? "bg-rose-500/15 border-rose-500/50 text-rose-300"       : "bg-surface-900 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200",
    emerald: active ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300" : "bg-surface-900 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200",
    violet:  active ? "bg-violet-500/15 border-violet-500/50 text-violet-300" : "bg-surface-900 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-all duration-150 cursor-pointer ${colorMap[color]}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {label}
      {active && <IconCheck size={10} className="shrink-0 ml-0.5" />}
    </button>
  );
};

// ─── Scope Sub-filter Panel ───────────────────────────────────────────────────

const DEFAULT_SCOPE_FILTER: ScopeFilter = {
  favourites: null,
  recycle: null,
  havingTags: null,
  specificTags: [],
  specificTagsMode: null,
};

interface DimensionConfig {
  key: "favourites" | "recycle" | "havingTags";
  yesLabel: string;
  noLabel: string;
  yesColor: "brand" | "star" | "rose" | "emerald" | "violet";
  noColor:  "brand" | "star" | "rose" | "emerald" | "violet";
  yesIcon?: React.ReactNode;
  noIcon?:  React.ReactNode;
}

// Which dimensions are available per primary scope (only the ones NOT already fixed)
function getDimensions(scope: string): DimensionConfig[] {
  const fav: DimensionConfig = {
    key: "favourites",
    yesLabel: "Only Favourites",
    noLabel: "Not Favourites",
    yesColor: "star",
    noColor: "brand",
    yesIcon: <IconStar size={11} />,
    noIcon: <IconStar size={11} />,
  };
  const rec: DimensionConfig = {
    key: "recycle",
    yesLabel: "In Recycle Bin",
    noLabel: "Not Recycle Bin",
    yesColor: "rose",
    noColor: "emerald",
    yesIcon: <IconTrash size={11} />,
    noIcon: <IconTrash size={11} />,
  };
  const tags: DimensionConfig = {
    key: "havingTags",
    yesLabel: "Having Tags",
    noLabel: "No Tags",
    yesColor: "violet",
    noColor: "brand",
    yesIcon: <IconTag size={11} />,
    noIcon: <IconTag size={11} />,
  };

  switch (scope) {
    // Fixed: Recycle=No — free: Fav, Tags
    case "clips":     return [fav, tags];
    // Fixed: Fav=Yes  — free: Recycle, Tags
    case "favorites": return [rec, tags];
    // Fixed: Tags=Yes — free: Fav, Recycle (Specific Tags always shown)
    case "tagged":    return [fav, rec];
    // Fixed: Recycle=Yes — free: Fav, Tags
    case "recycle":   return [fav, tags];
    default:          return [];
  }
}

// Specific tags picker is shown when havingTags !== "no"
// AND when scope isn't one where tags are impossible
function specificTagsApplicable(scope: string, sf: ScopeFilter): boolean {
  // For "tagged" scope — tags always exist, always show picker
  if (scope === "tagged") return true;
  // For others — show only when havingTags dimension is "yes" (or not set, leaving possibility open)
  return sf.havingTags !== "no";
}

const ScopeSubFilterPanel: React.FC<{
  scope: string;
  sf: ScopeFilter;
  onChange: (sf: ScopeFilter) => void;
  tags: Tag[];
}> = ({ scope, sf, onChange, tags }) => {
  const dimensions = getDimensions(scope);
  const showSpecificTags = specificTagsApplicable(scope, sf);

  const toggleDimension = (key: keyof Pick<ScopeFilter, "favourites" | "recycle" | "havingTags">, value: "yes" | "no") => {
    const current = sf[key];
    // Clicking the active choice deselects it (sets null)
    const next = current === value ? null : value;
    const updated: ScopeFilter = { ...sf, [key]: next };

    // If havingTags flipped to "no" → clear specific tag selection (N/A)
    if (key === "havingTags" && next === "no") {
      updated.specificTags = [];
      updated.specificTagsMode = null;
    }
    onChange(updated);
  };

  const toggleSpecificTag = (tagId: string) => {
    const already = sf.specificTags.includes(tagId);
    const next = already ? sf.specificTags.filter((t) => t !== tagId) : [...sf.specificTags, tagId];
    // Auto-set mode to "include" if not yet chosen and first tag is being added
    const mode = sf.specificTagsMode ?? (next.length > 0 ? "include" : null);
    onChange({ ...sf, specificTags: next, specificTagsMode: next.length === 0 ? null : mode });
  };

  const setSpecificTagsMode = (mode: "include" | "exclude") => {
    onChange({ ...sf, specificTagsMode: sf.specificTags.length > 0 ? mode : null });
  };

  const clearSpecificTags = () => {
    onChange({ ...sf, specificTags: [], specificTagsMode: null });
  };

  const hasAnything =
    sf.favourites !== null ||
    sf.recycle !== null ||
    sf.havingTags !== null ||
    sf.specificTags.length > 0;

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-400" />
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Level 2 — Sub-filters
          </span>
        </div>
        {hasAnything && (
          <button
            type="button"
            onClick={() => onChange(DEFAULT_SCOPE_FILTER)}
            className="text-[10px] text-gray-500 hover:text-rose-400 transition-colors cursor-pointer"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Dimension toggle rows */}
      {dimensions.map((dim) => (
        <div key={dim.key} className="space-y-1.5">
          <span className="text-[10px] text-gray-600 uppercase tracking-wider font-medium pl-0.5">
            {dim.key === "favourites" ? "Favourites" : dim.key === "recycle" ? "Recycle Bin" : "Tags"}
          </span>
          <div className="flex flex-wrap gap-1.5">
            <ToggleChip
              label={dim.yesLabel}
              active={sf[dim.key] === "yes"}
              color={dim.yesColor}
              icon={dim.yesIcon}
              onClick={() => toggleDimension(dim.key, "yes")}
            />
            <ToggleChip
              label={dim.noLabel}
              active={sf[dim.key] === "no"}
              color={dim.noColor}
              icon={dim.noIcon}
              onClick={() => toggleDimension(dim.key, "no")}
            />
          </div>
        </div>
      ))}

      {/* Specific Tags picker — Level 3 */}
      {showSpecificTags && tags.length > 0 && (
        <div className="space-y-2 pt-1">
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
                onClick={clearSpecificTags}
                className="text-[10px] text-gray-500 hover:text-rose-400 transition-colors cursor-pointer"
              >
                Clear tags
              </button>
            )}
          </div>

          {/* Include / Exclude mode toggle */}
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

          {/* Tag chip grid */}
          <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto pr-1 dialog-scrollbar">
            {tags.map((tag) => {
              const active = sf.specificTags.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleSpecificTag(tag.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all duration-150 cursor-pointer ${
                    active
                      ? "border-brand-500/50 bg-brand-500/10 text-brand-300"
                      : "border-white/8 bg-surface-900 text-gray-400 hover:border-white/20 hover:text-gray-200"
                  }`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                  {active && <IconCheck size={9} className="shrink-0 text-brand-400" />}
                </button>
              );
            })}
          </div>

          {sf.specificTags.length === 0 && (
            <p className="text-[10px] text-gray-600 pl-0.5">
              Select tag(s) above then choose whether to include or exclude them.
            </p>
          )}
        </div>
      )}

      {/* Level 3 combination summary */}
      {hasAnything && (
        <div className="mt-2 px-3 py-2 rounded-lg bg-surface-900/60 border border-white/5">
          <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider block mb-1">
            Active combination
          </span>
          <span className="text-[11px] text-gray-300 leading-relaxed">
            {buildCombinationLabel(scope, sf)}
          </span>
        </div>
      )}
    </div>
  );
};

// ─── Build human-readable combination label ────────────────────────────────

function buildCombinationLabel(scope: string, sf: ScopeFilter): string {
  const scopeBase: Record<string, string> = {
    clips:     "Active (non-deleted) clips",
    favorites: "Favorited clips",
    recycle:   "Deleted (recycle bin) clips",
    tagged:    "Clips with tags",
  };
  const base = scopeBase[scope] ?? "Clips";
  const parts: string[] = [];

  if (scope !== "favorites") {
    if (sf.favourites === "yes") parts.push("that are favorited");
    else if (sf.favourites === "no") parts.push("that are NOT favorited");
  }
  if (scope !== "recycle" && scope !== "clips") {
    if (sf.recycle === "yes") parts.push("in the recycle bin");
    else if (sf.recycle === "no") parts.push("NOT in the recycle bin");
  }
  if (scope !== "tagged") {
    if (sf.havingTags === "yes") parts.push("having at least one tag");
    else if (sf.havingTags === "no") parts.push("having NO tags");
  }
  if (sf.specificTags.length > 0 && sf.specificTagsMode) {
    const n = sf.specificTags.length;
    if (sf.specificTagsMode === "include") parts.push(`matching ${n} specific tag${n > 1 ? "s" : ""}`);
    else parts.push(`NOT matching ${n} specific tag${n > 1 ? "s" : ""}`);
  }

  if (parts.length === 0) return base;
  return `${base} ${parts.join(", ")}`;
}

// ─── Main Export Wizard Component ─────────────────────────────────────────────

export const ExportWizard: React.FC<ExportWizardProps> = ({ isOpen, onClose }) => {
  // Config state
  const [source, setSource] = useState<ExportOptions["source"]>("all");
  const [scope, setScope] = useState<ExportOptions["scope"]>("all");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>(DEFAULT_SCOPE_FILTER);
  const [format, setFormat] = useState<ExportOptions["format"]>("json");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [matchingCount, setMatchingCount] = useState<number | null>(null);

  // Flow & Progress state
  const [status, setStatus] = useState<ExportStatus>("config");
  const [progressStep, setProgressStep] = useState<string>("preparing");
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [summary, setSummary] = useState<ExportSummary | null>(null);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [openDropdown, setOpenDropdown] = useState<"source" | "scope" | "format" | null>(null);
  const [scopeAnimDone, setScopeAnimDone] = useState<boolean>(false);
  const [subFilterAnimDone, setSubFilterAnimDone] = useState<boolean>(false);

  // Tags from store
  const tags = useClipStore((s) => s.tags);

  // Show sub-filter panel when scope is anything except "all"
  const showSubFilter = source === "clips" && scope !== "all";

  useEffect(() => {
    if (source !== "clips") {
      setScopeAnimDone(false);
    }
  }, [source]);

  // Reset sub-filter when scope changes
  useEffect(() => {
    setScopeFilter(DEFAULT_SCOPE_FILTER);
    setSubFilterAnimDone(false);
    if (scope === "all") {
      setSearch("");
      setDateFrom("");
      setDateTo("");
    }
  }, [scope]);

  // Subscribe to progress updates
  useEffect(() => {
    if (status === "progress" && window.clipAPI?.onExportProgress) {
      const unsubscribe = window.clipAPI.onExportProgress((p) => {
        setProgressStep(p.step);
        setProgressPercent(p.percent);
      });
      return () => { if (unsubscribe) unsubscribe(); };
    }
    return undefined;
  }, [status]);

  // Fetch live matching clips count for the export
  useEffect(() => {
    if (!isOpen || source !== "clips") {
      setMatchingCount(null);
      return;
    }

    let active = true;
    const fetchCount = async () => {
      try {
        const query: any = { limit: 100000 };

        // Scope
        if (scope === "clips") {
          query.isDeleted = false;
        } else if (scope === "favorites") {
          query.isFavorite = true;
          query.isDeleted = false;
        } else if (scope === "recycle") {
          query.isDeleted = true;
        } else if (scope === "tagged") {
          query.isDeleted = false;
          query.hasTags = true;
        }

        // Search text & date range (only if scope !== "all")
        if (scope !== "all") {
          if (search.trim()) {
            query.search = search.trim();
          }
          if (dateFrom) query.dateFrom = dateFrom;
          if (dateTo) query.dateTo = dateTo;
        }

        // Sub-filters
        if (scope !== "all") {
          if (scope !== "favorites") {
            if (scopeFilter.favourites === "yes") query.isFavorite = true;
            else if (scopeFilter.favourites === "no") query.isFavorite = false;
          }
          if (scope !== "recycle" && scope !== "clips") {
            if (scopeFilter.recycle === "yes") query.isDeleted = true;
            else if (scopeFilter.recycle === "no") query.isDeleted = false;
          }
          if (scope !== "tagged") {
            if (scopeFilter.havingTags === "yes") query.hasTags = true;
            else if (scopeFilter.havingTags === "no") query.hasTags = false;
          }
          if (scopeFilter.specificTags && scopeFilter.specificTags.length > 0 && scopeFilter.specificTagsMode) {
            if (scopeFilter.specificTagsMode === "include") {
              query.includeTags = scopeFilter.specificTags;
            } else {
              query.excludeTags = scopeFilter.specificTags;
            }
          }
        }

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
  }, [isOpen, source, scope, scopeFilter, search, dateFrom, dateTo]);

  const handleClose = () => {
    if (window.clipAPI?.cleanupExport) {
      window.clipAPI.cleanupExport().catch((err) => console.error("Cleanup error:", err));
    }
    setStatus("config");
    setSource("all");
    setScope("all");
    setScopeFilter(DEFAULT_SCOPE_FILTER);
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setMatchingCount(null);
    setFormat("json");
    setSummary(null);
    setIsSaved(false);
    setOpenDropdown(null);
    setScopeAnimDone(false);
    setSubFilterAnimDone(false);
    onClose();
  };

  const handleStartExport = async () => {
    setStatus("progress");
    setProgressPercent(0);
    setProgressStep("preparing");
    setErrorMessage("");
    setIsSaved(false);
    setOpenDropdown(null);

    try {
      if (!window.clipAPI?.startExport) {
        throw new Error("Export System API not initialized. Please restart ClipMaster Pro to load the new export functions.");
      }
      const opts: ExportOptions = {
        source,
        scope,
        format,
        ...(scope !== "all" ? {
          search,
          dateFrom,
          dateTo,
          scopeFilter,
        } : {}),
      };
      const result = await window.clipAPI.startExport(opts);
      setSummary(result);
      setStatus("summary");
    } catch (err: any) {
      if (err.message === "CANCELLED" || err.message?.includes("CANCELLED")) {
        setStatus("config");
      } else {
        console.error("Export error:", err);
        setErrorMessage(err.message || "An error occurred during export generation.");
        setStatus("error");
      }
    }
  };

  const handleCancel = async () => {
    if (window.clipAPI?.cancelExport) await window.clipAPI.cancelExport();
    setStatus("config");
  };

  const handleDownload = async () => {
    if (!summary) return;
    if (window.clipAPI?.saveExportFile) {
      const success = await window.clipAPI.saveExportFile(summary.tempFilePath, summary.defaultFileName);
      if (success) setIsSaved(true);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getStepLabel = (step: string): string => {
    switch (step) {
      case "preparing":   return "Preparing Data";
      case "processing":  return "Processing Records";
      case "generating":  return "Generating Export Files";
      case "compressing": return "Compressing Files";
      case "complete":    return "Export Complete";
      default:            return "Exporting...";
    }
  };

  // Count active sub-filters for badge
  const activeSubFilters = useMemo(() => {
    if (!showSubFilter) return 0;
    let count = 0;
    if (scopeFilter.favourites !== null) count++;
    if (scopeFilter.recycle !== null) count++;
    if (scopeFilter.havingTags !== null) count++;
    if (scopeFilter.specificTags.length > 0) count++;
    return count;
  }, [showSubFilter, scopeFilter]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={status === "progress" ? () => {} : handleClose}
      title="Data Export System"
      maxWidth="max-w-xl"
      overflowVisible={true}
      contentClassName="!overflow-visible"
    >
      <div className="space-y-6 overflow-visible">
        <AnimatePresence mode="wait">
          {/* ── CONFIGURATION STEP ─────────────────────────────────────── */}
          {status === "config" && (
            <motion.div
              key="config"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Export Source Row */}
              <div className={`flex items-center justify-between rounded-xl bg-surface-800 transition-colors group relative ${
                openDropdown === "source" ? "z-30" : "z-10"
              }`}>
                <div className="min-w-0 space-y-1">
                  <h4 className="text-[13px] font-medium text-gray-200 group-hover:text-white transition-colors flex items-center gap-1.5">
                    <IconDatabase size={14} className="text-brand-400/80 group-hover:text-brand-400 transition-colors" />
                    Export Source
                  </h4>
                  <p className="text-xs text-gray-500 leading-normal">
                    Choose what database items to export.
                  </p>
                </div>
                <div className="shrink-0">
                  <CustomDropdown
                    value={source}
                    onChange={(val) => {
                      setSource(val);
                      if (val !== "clips") setScope("all");
                    }}
                    options={[
                      { value: "all",      label: "All Data",       desc: "Clips, tags, and settings",    icon: <IconGrid size={14} /> },
                      { value: "clips",    label: "Only Clips",     desc: "Clipboard entries database",   icon: <IconDatabase size={14} /> },
                      { value: "tags",     label: "Only Tags",      desc: "Custom tags database",         icon: <IconTag size={14} /> },
                      { value: "settings", label: "Only Settings",  desc: "Application configuration",   icon: <IconSettings size={14} /> },
                    ]}
                    isOpen={openDropdown === "source"}
                    setIsOpen={(open) => setOpenDropdown(open ? "source" : null)}
                  />
                </div>
              </div>

              {/* Clip Export Scope Row (conditional on source=clips) */}
              <AnimatePresence>
                {source === "clips" && (
                  <motion.div
                    key="scope"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    onAnimationComplete={(definition) => {
                      if (definition && (definition as any).height === "auto") {
                        setScopeAnimDone(true);
                      }
                    }}
                    className={`pt-1 ${scopeAnimDone ? "" : "overflow-hidden"}`}
                  >
                    {/* ── Level 1: Primary scope dropdown ─────────────── */}
                    <div className={`flex items-center justify-between rounded-xl bg-surface-800 transition-colors group relative ${
                      openDropdown === "scope" ? "z-30" : "z-10"
                    }`}>
                      <div className="min-w-0 space-y-1">
                        <h4 className="text-[13px] font-medium text-gray-200 group-hover:text-white transition-colors flex items-center gap-1.5">
                          <IconLayers size={14} className="text-brand-400/80 group-hover:text-brand-400 transition-colors" />
                          Clip Export Scope
                          {activeSubFilters > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 rounded-md bg-brand-500/20 text-brand-300 text-[10px] font-bold">
                              +{activeSubFilters} filter{activeSubFilters > 1 ? "s" : ""}
                            </span>
                          )}
                        </h4>
                        <p className="text-xs text-gray-500 leading-normal">
                          Specify the scope of clipboard entries.
                        </p>
                      </div>
                      <div className="shrink-0">
                        <CustomDropdown
                          value={scope}
                          onChange={setScope}
                          options={[
                            { value: "all",       label: "All Clip Data",          desc: "Clips + Favorites + Recycle Bin",           icon: <IconLayers size={14} /> },
                            { value: "clips",     label: "Only Clips",             desc: "Active items only (excluding Recycle Bin)",  icon: <IconInbox size={14} /> },
                            { value: "favorites", label: "Only Favorites",         desc: "Starred/favorite items only",               icon: <IconStar size={14} /> },
                            { value: "recycle",   label: "Only Recycle Bin",       desc: "Soft-deleted items only",                   icon: <IconTrash size={14} /> },
                            { value: "tagged",    label: "Only Clips Having Tags", desc: "Items associated with at least one tag",    icon: <IconTag size={14} /> },
                          ]}
                          isOpen={openDropdown === "scope"}
                          setIsOpen={(open) => setOpenDropdown(open ? "scope" : null)}
                        />
                      </div>
                    </div>

                    {/* ── Level 2 + 3: Sub-filter panel (including Text & Date Filters) ────────────────── */}
                    <AnimatePresence>
                      {showSubFilter && (
                        <motion.div
                          key={`subfilter-${scope}`}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          onAnimationComplete={(definition) => {
                            if (definition && (definition as any).height === "auto") {
                              setSubFilterAnimDone(true);
                            }
                          }}
                          className={`pt-3 ${subFilterAnimDone ? "" : "overflow-hidden"}`}
                        >
                          <div className="rounded-xl border border-white/6 bg-surface-800/50 p-4 space-y-3.5">
                            {/* Text & Date Filters */}
                            <div className="space-y-3 pb-3.5 border-b border-white/5">
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                                  Text & Date Filters
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-3.5">
                                <div className="space-y-1.5">
                                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium pl-0.5">
                                    Search Text
                                  </span>
                                  <input
                                    type="text"
                                    placeholder="Filter by text..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
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
                            </div>

                            <ScopeSubFilterPanel
                              scope={scope}
                              sf={scopeFilter}
                              onChange={setScopeFilter}
                              tags={tags}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Export Format Row */}
              <div className={`flex items-center justify-between rounded-xl bg-surface-800 transition-colors group relative ${
                openDropdown === "format" ? "z-30" : "z-10"
              }`}>
                <div className="min-w-0 space-y-1">
                  <h4 className="text-[13px] font-medium text-gray-200 group-hover:text-white transition-colors flex items-center gap-1.5">
                    <IconSave size={14} className="text-brand-400/80 group-hover:text-brand-400 transition-colors" />
                    Export Format
                  </h4>
                  <p className="text-xs text-gray-500 leading-normal">
                    Select the document or file type to generate.
                  </p>
                </div>
                <div className="shrink-0">
                  <CustomDropdown
                    value={format}
                    onChange={setFormat}
                    options={[
                      { value: "json",  label: "JSON format",        desc: "Readable text structure",     icon: <IconJson size={14} /> },
                      { value: "excel", label: "Excel sheet (.xlsx)", desc: "Spreadsheet columns",        icon: <IconExcel size={14} /> },
                      { value: "pdf",   label: "PDF Report (.pdf)",   desc: "High-compression document",  icon: <IconPdf size={14} /> },
                    ]}
                    isOpen={openDropdown === "format"}
                    setIsOpen={(open) => setOpenDropdown(open ? "format" : null)}
                  />
                </div>
              </div>

              {/* Proceed Action */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-700 bg-surface-800 text-gray-300 hover:bg-surface-700 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStartExport}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-brand-500/20 transition-all active:scale-95 cursor-pointer"
                >
                  Proceed Export {source === "clips" && matchingCount !== null ? `(${matchingCount} clips)` : ""}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── PROGRESS STEP ──────────────────────────────────────────── */}
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
                <svg className="w-8 h-8 text-brand-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20" />
                </svg>
              </div>

              <div className="text-center space-y-2 w-full max-w-sm">
                <h4 className="text-sm font-bold text-white tracking-wide">{getStepLabel(progressStep)}</h4>
                <p className="text-[11px] text-gray-500">Please wait, gathering and converting local databases.</p>
                <div className="relative w-full h-2 bg-surface-900 rounded-full overflow-hidden border border-white/5 mt-4">
                  <motion.div
                    className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-brand-500 to-indigo-500"
                    style={{ width: `${progressPercent}%` }}
                    transition={{ ease: "easeInOut" }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-gray-500 pt-1">
                  <span>SYSTEM PROGRESS</span>
                  <span>{progressPercent}%</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2 rounded-full border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 text-xs font-semibold tracking-wider transition-all cursor-pointer active:scale-95"
              >
                Cancel Export
              </button>
            </motion.div>
          )}

          {/* ── SUMMARY & DOWNLOAD STEP ────────────────────────────────── */}
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
                <h4 className="text-sm font-bold text-white">Export Package Completed</h4>
                <p className="text-xs text-gray-500">Your export package has been successfully compiled.</p>
              </div>

              <div className="bg-surface-900/40 border border-gray-700/50 rounded-2xl p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Total Records</span>
                    <span className="text-sm font-bold text-white mt-1 block">{summary.totalRecords.toLocaleString()} records</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Export Type</span>
                    <span className="text-sm font-bold text-white mt-1 block truncate" title={summary.exportType}>{summary.exportType}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Format</span>
                    <span className="text-sm font-bold text-white mt-1 block">{summary.format}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Final File Size</span>
                    <span className="text-sm font-bold text-white mt-1 block font-mono">{formatBytes(summary.finalFileSize)}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-700/50">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">File Count in ZIP</span>
                  <span className="text-sm font-bold text-white mt-1 block">
                    {summary.fileCount} {summary.fileCount > 1 ? "files (zipped into ZIP package)" : "file"}
                  </span>
                </div>
              </div>

              {isSaved ? (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-emerald-400 text-xs flex items-center gap-3">
                  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>File successfully saved to your chosen location!</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleDownload}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Save File Download
                </button>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStatus("config")}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-700 bg-surface-800 text-gray-300 hover:bg-surface-700 text-xs font-semibold tracking-wide transition-colors cursor-pointer"
                >
                  Export Again
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

          {/* ── ERROR STEP ─────────────────────────────────────────────── */}
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
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-rose-400">Export Execution Failed</h4>
                  <p className="text-xs text-gray-500 mt-2 max-w-sm leading-relaxed">{errorMessage}</p>
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
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-700 bg-surface-800 text-gray-300 hover:bg-surface-700 text-xs font-semibold tracking-wide transition-colors cursor-pointer"
                >
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
