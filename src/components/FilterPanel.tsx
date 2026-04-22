import React, { useState } from "react";
import { useClipStore } from "../store/useClipStore";
import TagBadge from "./TagBadge";
import { IconFilter, IconClock, IconChevronUp, IconChevronDown } from "./Icons";
import RangeSlider from "./RangeSlider";

const FilterPanel: React.FC = () => {
  const { filters, setFilters, resetFilters, tags, clips, activePage } = useClipStore();
  const [dateExpanded, setDateExpanded] = useState(true);

  const isRecycleBin = activePage === "recycle";

  // Calculate min/max character counts from relevant clips (active or deleted)
  let filteredClips = clips.filter((c) =>
    isRecycleBin ? c.isDeleted : !c.isDeleted,
  );

  // Apply search filter
  if (filters.search.trim()) {
    const q = filters.search.toLowerCase();
    filteredClips = filteredClips.filter((c) =>
      c.text.toLowerCase().includes(q),
    );
  }

  // Apply tag filter
  if (filters.tags.length > 0) {
    filteredClips = filteredClips.filter((c) =>
      filters.tags.every((t) => c.tags.includes(t)),
    );
  }

  // Apply favorite filter
  if (filters.isFavorite === true) {
    filteredClips = filteredClips.filter((c) => c.isFavorite);
  }

  // Apply date range filter
  if (filters.dateFrom) {
    filteredClips = filteredClips.filter(
      (c) => new Date(c.timestamp) >= new Date(filters.dateFrom!),
    );
  }
  if (filters.dateTo) {
    filteredClips = filteredClips.filter(
      (c) => new Date(c.timestamp) <= new Date(filters.dateTo! + "T23:59:59"),
    );
  }

  const charCounts = filteredClips.map((c) => c.charCount ?? c.text.length);
  const globalMin = charCounts.length > 0 ? Math.min(...charCounts) : 0;
  let globalMax = charCounts.length > 0 ? Math.max(...charCounts) : 1000;

  // Ensure max is always at least min + 1 to avoid division by zero in RangeSlider
  if (globalMax <= globalMin) {
    globalMax = globalMin + 1;
  }

  const hasActiveFilters =
    filters.search ||
    filters.tags.length > 0 ||
    filters.isFavorite !== null ||
    filters.minWordCount !== null ||
    filters.maxWordCount !== null ||
    filters.dateFrom ||
    filters.dateTo;

  return (
    <div className="space-y-2">
      {/* Header with Unique Filters Design */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-brand-500/10 via-brand-500/5 to-transparent border-brand-500/20 p-3 group">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-brand-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Icon Badge */}
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-500/20 border-brand-500/40 group-hover:bg-brand-500/30 group-hover:border-brand-500/60 transition-all duration-300">
              <IconFilter size={18} className="text-brand-400" />
            </div>

            {/* Text Container */}
            <div className="flex flex-col gap-0.5">
              <h3 className="text-[12px] font-black text-brand-300 uppercase tracking-widest group-hover:text-brand-200 transition-colors">
                Filters
              </h3>
              <p className="text-[8px] text-gray-500 font-semibold tracking-wide">
                Refine Results
              </p>
            </div>
          </div>

          {/* Reset Button */}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="px-3 py-1 rounded-full bg-brand-400/20 border-brand-500/40 text-[9px] text-brand-300 hover:text-brand-100 font-bold uppercase tracking-wider transition-all duration-300 hover:bg-brand-400/30 hover:border-brand-500/60 active:scale-95"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Quick Filter */}
      {/* <div className="space-y-2">
        <p className="text-[11px] text-gray-500 font-semibold flex items-center gap-1.5 uppercase tracking-tight">
          Quick Filter
        </p>
        <button
          onClick={() => setFilters({ isFavorite: filters.isFavorite === true ? null : true })}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-150 text-left active:scale-[0.98] ${
            filters.isFavorite === true
              ? 'bg-accent-500/10 border-accent-500/30 text-accent-400'
              : 'bg-surface-700/50 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
          }`}
        >
          <IconStar size={14} className={filters.isFavorite === true ? 'fill-current' : ''} />
          <span className="text-xs font-medium">Favorites Only</span>
        </button>
      </div> */}

      {/* Length Range */}

      {/* Characters Ranger */}
      <div className="pb-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-tight">
            Character Range
          </p>
          {(filters.minWordCount !== null || filters.maxWordCount !== null) && (
            <button
              onClick={() =>
                setFilters({ minWordCount: null, maxWordCount: null })
              }
              className="text-[10px] text-brand-400 hover:text-brand-300 transition-colors font-medium"
            >
              Reset
            </button>
          )}
        </div>

        {/* Range Sliders */}
        <RangeSlider
          min={globalMin}
          max={globalMax}
          valueMin={filters.minWordCount ?? globalMin}
          valueMax={filters.maxWordCount ?? globalMax}
          onChange={(min, max) =>
            setFilters({ minWordCount: min, maxWordCount: max })
          }
        />
      </div>

      {/* Date Range */}
      <div className="pb-4">
        <button
          onClick={() => setDateExpanded(!dateExpanded)}
          className="flex items-center justify-between w-full text-[11px] text-gray-500 font-semibold uppercase tracking-tight hover:text-gray-300 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <IconClock size={12} />
            Date Range
          </span>
          {dateExpanded ? (
            <IconChevronUp size={14} />
          ) : (
            <IconChevronDown size={14} />
          )}
        </button>
        {dateExpanded && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="grid grid-cols-2 gap-2 ml-2 mt-4">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-medium px-1 cursor-pointer">
                  From
                </label>
                <input
                  type="date"
                  value={filters.dateFrom ?? ""}
                  onChange={(e) =>
                    setFilters({ dateFrom: e.target.value || null })
                  }
                  className="w-full border-0 outline-0 bg-surface-900 text-gray-300 text-[11px] rounded-lg outline-none focus:outline-none focus:ring-0 transition-colors appearance-none cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:saturate-200 [&::-webkit-calendar-picker-indicator]:hue-rotate-[250deg] [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-80 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:transition [&::-webkit-calendar-picker-indicator]:duration-200 [&::-webkit-calendar-picker-indicator]:mr-1.5"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-medium px-1 cursor-pointer">
                  To
                </label>
                <input
                  type="date"
                  value={filters.dateTo ?? ""}
                  onChange={(e) =>
                    setFilters({ dateTo: e.target.value || null })
                  }
                  className="w-full border-0 outline-0 bg-surface-900 text-gray-300 text-[11px] rounded-lg outline-none focus:outline-none focus:ring-0 transition-colors appearance-none cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:saturate-200 [&::-webkit-calendar-picker-indicator]:hue-rotate-[250deg] [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-80 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:transition [&::-webkit-calendar-picker-indicator]:duration-200 [&::-webkit-calendar-picker-indicator]:mr-1.5"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-4 bg-gradient-to-b from-amber-500 to-amber-600 rounded-full" />
            <p className="text-[11px] text-gray-300 font-semibold uppercase tracking-tight">
              Active Tags{" "}
              <span className="text-gray-500/50">
                ({filters.tags.length}/{tags.length})
              </span>
            </p>
          </div>
          <div className="flex flex-wrap ml-2 gap-1.5">
            {tags.map((tag) => (
              <TagBadge
                key={tag.id}
                tag={tag}
                size="sm"
                active={filters.tags.includes(tag.id)}
                onClick={() => {
                  const newTags = filters.tags.includes(tag.id)
                    ? filters.tags.filter((t) => t !== tag.id)
                    : [...filters.tags, tag.id];
                  setFilters({ tags: newTags });
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterPanel;
