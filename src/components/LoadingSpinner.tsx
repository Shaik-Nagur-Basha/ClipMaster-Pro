import React from "react";

// ─── Full-Page Spinner ────────────────────────────────────────────────────────
// Context-aware: each page supplies its own label, subtitle, and icon.
export interface FullPageSpinnerProps {
  /** Short status verb — shown uppercase with wide tracking */
  label?: string;
  /** One-line description of what is loading */
  subtitle?: string;
  /** Small emoji or symbol rendered above the spinner */
  icon?: string;
}

export const FullPageSpinner: React.FC<FullPageSpinnerProps> = ({
  label = "Loading",
  subtitle,
}) => (
  <div className="min-h-full flex-1 flex flex-col items-center justify-center bg-[#020617] relative overflow-hidden select-none">
    {/* Background Glows */}
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] bg-blue-500/10 blur-[110px] rounded-full pointer-events-none" />
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] bg-purple-500/10 blur-[80px] rounded-full pointer-events-none" />

    <div className="relative flex flex-col items-center gap-0">

      {/* Advanced Spinner */}
      <div className="relative w-20 h-20 mb-7">
        {/* Pulsing Core */}
        <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse" />
        {/* Outer Ring */}
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 border-r-blue-500/40 animate-spin" />
        {/* Middle Ring */}
        <div className="absolute inset-2 rounded-full border border-transparent border-b-purple-500 border-l-purple-500/20 animate-[spin_2s_linear_infinite_reverse]" />
        {/* Inner Ring */}
        <div className="absolute inset-4 rounded-full border border-white/10" />
        {/* Central Point */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_12px_rgba(255,255,255,0.8)]" />
        </div>
      </div>

      {/* Status Text */}
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-[10px] font-black text-white uppercase tracking-[0.4em] drop-shadow-md">
          {label}
        </p>
        {subtitle && (
          <p className="text-[10px] text-slate-500 font-medium tracking-wide max-w-[180px] leading-relaxed">
            {subtitle}
          </p>
        )}
        <div className="flex items-center justify-center gap-1.5 mt-0.5">
          <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" />
        </div>
      </div>
    </div>

    {/* App watermark */}
    <div className="absolute bottom-8 flex flex-col items-center gap-1">
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-br from-blue-500 to-purple-500" />
        <p className="text-[8px] font-bold text-slate-700 uppercase tracking-[0.5em]">
          ClipMaster Pro
        </p>
      </div>
    </div>
  </div>
);

// ─── Clip Card Skeleton ───────────────────────────────────────────────────────
// Context-aware: pass a label to show which section's clips are loading.
const ClipCardSkeleton: React.FC<{ index: number }> = ({ index }) => (
  <div
    className="rounded-xl bg-surface-800 border border-gray-700/40 overflow-hidden"
    style={{ opacity: Math.max(0.15, 1 - index * 0.15) }}
  >
    {/* Card top bar */}
    <div className="flex items-center justify-between px-4 pt-3.5 pb-2 border-b border-gray-700/30">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-gray-700 animate-pulse" />
        <div className="h-2.5 w-24 rounded bg-gray-700/70 animate-pulse" />
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-10 rounded bg-gray-700/50 animate-pulse" />
        <div className="h-2 w-10 rounded bg-gray-700/50 animate-pulse" />
        <div className="h-2 w-10 rounded bg-gray-700/50 animate-pulse" />
      </div>
    </div>

    {/* Card content lines */}
    <div className="px-4 py-3 space-y-2">
      <div
        className="h-2.5 rounded bg-gray-700/60 animate-pulse"
        style={{ width: `${75 + ((index * 13) % 20)}%` }}
      />
      <div
        className="h-2.5 rounded bg-gray-700/40 animate-pulse"
        style={{ width: `${50 + ((index * 17) % 30)}%` }}
      />
      <div
        className="h-2.5 rounded bg-gray-700/25 animate-pulse"
        style={{ width: `${30 + ((index * 11) % 25)}%` }}
      />
    </div>

    {/* Card footer bar */}
    <div className="flex items-center justify-between px-4 pb-3.5 pt-1">
      <div className="flex items-center gap-1.5">
        <div className="h-4 w-12 rounded-full bg-gray-700/50 animate-pulse" />
        <div className="h-4 w-16 rounded-full bg-gray-700/40 animate-pulse" />
      </div>
      <div className="h-4 w-16 rounded bg-gray-700/40 animate-pulse" />
    </div>
  </div>
);

export interface ClipSkeletonProps {
  count?: number;
  /** Contextual hint label shown above the cards e.g. "Loading clipboard history…" */
  hint?: string;
}

export const ClipSkeleton: React.FC<ClipSkeletonProps> = ({
  count = 5,
  hint,
}) => (
  <div className="px-6 py-4 space-y-4">
    {hint && (
      <div className="flex items-center gap-2 pb-1">
        <div className="flex gap-0.5">
          <span className="w-1 h-1 bg-blue-500/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1 h-1 bg-blue-500/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1 h-1 bg-blue-500/60 rounded-full animate-bounce" />
        </div>
        <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">
          {hint}
        </span>
      </div>
    )}
    {Array.from({ length: count }).map((_, i) => (
      <ClipCardSkeleton key={i} index={i} />
    ))}
  </div>
);
