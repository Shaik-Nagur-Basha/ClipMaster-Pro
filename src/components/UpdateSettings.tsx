import React, { useEffect, useState, useRef } from "react";
import { useUpdateStore } from "../store/useUpdateStore";
import {
  IconRefresh,
  IconChevronDown,
  IconCheck,
  IconAlertCircle,
  IconInfo,
  IconClock,
} from "./Icons";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import Dialog from "./Dialog";

// Helper to format date
const formatDate = (dateString: string) => {
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (e) {
    return dateString;
  }
};

// Helper for semver comparison
const cleanVer = (v: string) => v.replace(/^v/, "").trim();
const semverCompare = (v1: string, v2: string) => {
  if (!v1 || !v2) return 0;
  const p1 = cleanVer(v1).split(".").map(Number);
  const p2 = cleanVer(v2).split(".").map(Number);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
};

interface UpdateSettingsProps {
  hideHeader?: boolean;
}

export const UpdateSettings: React.FC<UpdateSettingsProps> = ({ hideHeader = false }) => {
  const {
    availableReleases,
    currentVersion,
    targetRelease,
    downloadProgress,
    updateStatus,
    errorMessage,
    fetchReleases,
    setTargetRelease,
    triggerUpdate,
    cancelUpdate,
    resetProgress,
  } = useUpdateStore();

  const [isOpen, setIsOpen] = useState(false);
  const [showReleaseNotes, setShowReleaseNotes] = useState(true);
  const [isPackaged, setIsPackaged] = useState(true);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchReleases();
    window.clipAPI.getAppInfo().then((info) => {
      setIsPackaged(info.isPackaged);
    }).catch(() => {});
  }, [fetchReleases]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const latestRelease = availableReleases[0];
  const isLatestSelected = targetRelease && latestRelease && targetRelease.tag_name === latestRelease.tag_name;

  // Compare versions
  let versionComparison = 0; // 0: same, 1: target is newer, -1: target is older
  if (targetRelease && currentVersion) {
    versionComparison = semverCompare(targetRelease.tag_name, currentVersion);
  }

  const handleUpdateClick = () => {
    if (updateStatus === "downloading") return;
    triggerUpdate();
  };

  if (updateStatus === "checking" && availableReleases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4 bg-surface-800 relative overflow-hidden">
        {/* Background glows */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-32 h-32 bg-blue-500/10 blur-[60px] rounded-full" />
        </div>
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 bg-blue-500/20 blur-lg rounded-full animate-pulse" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 border-r-blue-500/40 animate-spin" />
          <div className="absolute inset-1.5 rounded-full border border-transparent border-b-purple-500 border-l-purple-500/20 animate-[spin_2s_linear_infinite_reverse]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-1 h-1 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
          </div>
        </div>
        <div className="space-y-1.5 text-center relative">
          <span className="text-[9px] font-black text-white uppercase tracking-[0.4em]">Checking Releases</span>
          <div className="flex items-center justify-center gap-1">
            <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={hideHeader ? "" : "space-y-3"}>
      {!hideHeader && (
        <header className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <IconRefresh size={14} className="text-gray-500" />
            <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-gray-500">
              Application Updates
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowInfoDialog(true)}
            className="inline-flex items-center justify-center rounded-full border border-gray-700 bg-surface-800 p-1.5 text-gray-400 transition hover:border-white/20 hover:text-white hover:bg-white/10 cursor-pointer"
            title="Show updates info"
          >
            <IconInfo size={12} />
          </button>
        </header>
      )}

      <div className={`p-5 rounded-xl bg-surface-800 transition-colors duration-300 space-y-4 ${hideHeader ? "" : "border border-gray-700 hover:border-gray-600"}`}>
        {/* Versions Info Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface-900/50 border border-gray-700/30 p-3 rounded-lg flex flex-col">
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Installed Version</span>
            <span className="text-[14px] font-bold text-gray-300 mt-1">v{currentVersion || "2.0.0"}</span>
          </div>
          <div className="bg-surface-900/50 border border-gray-700/30 p-3 rounded-lg flex flex-col relative overflow-hidden group">
            <div className="absolute right-2 top-2 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Latest Release</span>
            <span className="text-[14px] font-bold text-emerald-400 mt-1">
              {latestRelease ? latestRelease.tag_name : "Checking..."}
            </span>
          </div>
        </div>

        {/* Target Version Selector Dropdown */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase text-gray-500 tracking-wider block">Target Version</label>
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsOpen(!isOpen)}
              disabled={updateStatus === "downloading"}
              className={`w-full flex items-center justify-between h-11 px-4 rounded-lg bg-surface-900 border transition-all duration-200 outline-none text-left ${
                isOpen
                  ? "border-brand-500/50 ring-1 ring-brand-500/20 shadow-lg shadow-brand-500/5"
                  : "border-gray-700 hover:border-gray-600 text-gray-200"
              } disabled:opacity-50`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-white">
                  {targetRelease ? targetRelease.tag_name : "Select version..."}
                </span>
                {isLatestSelected && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold uppercase tracking-wider">
                    Latest Version
                  </span>
                )}
                {!isLatestSelected && targetRelease && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-400 font-medium">
                    Historical
                  </span>
                )}
              </div>
              <IconChevronDown
                size={16}
                className={`opacity-40 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
              />
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ duration: 0.12, ease: "easeOut" }}
                  className="absolute top-full mt-1.5 left-0 right-0 z-[100] bg-surface-800 border border-gray-700/80 rounded-lg shadow-xl max-h-60 overflow-y-auto settings-scrollbar p-1"
                >
                  {availableReleases.map((release, index) => {
                    const isLatest = index === 0;
                    const isSelected = targetRelease?.tag_name === release.tag_name;
                    return (
                      <button
                        key={release.tag_name}
                        onClick={() => {
                          setTargetRelease(release);
                          setIsOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-md my-0.5 text-left transition-all ${
                          isSelected
                            ? "bg-brand-500/10 text-brand-400 border border-brand-500/20"
                            : "text-gray-300 hover:bg-surface-700/50 hover:text-white border border-transparent"
                        }`}
                      >
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[13px]">{release.tag_name}</span>
                            {isLatest && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold uppercase tracking-wider">
                                Latest
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-gray-500 font-medium truncate max-w-xs">{release.name}</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="text-[10px] text-gray-500 flex items-center gap-1">
                            <IconClock size={10} />
                            {formatDate(release.published_at)}
                          </span>
                          {isSelected && <IconCheck size={14} className="text-brand-400 shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Selected Release Detail card */}
        {targetRelease && (
          <div className="p-4 rounded-lg bg-surface-900/40 border border-gray-700/50 space-y-2">
            <div className={`flex items-center justify-between gap-2 ${showReleaseNotes ? 'border-b border-gray-800 pb-2' : ''}`}>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-gray-300 line-clamp-1">{targetRelease.name}</span>
                {versionComparison > 0 && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold uppercase tracking-wider">
                    Upgrade Available
                  </span>
                )}
                {versionComparison === 0 && (
                  <span className="text-[9px] text-nowrap px-2 py-0.5 rounded-full bg-gray-700 border border-gray-600/30 text-gray-400 font-bold uppercase tracking-wider">
                    Currently Installed
                  </span>
                )}
                {versionComparison < 0 && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold uppercase tracking-wider">
                    Downgrade Version
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowReleaseNotes(!showReleaseNotes)}
                className="text-[10px] text-nowrap text-brand-400 hover:text-brand-300 font-semibold focus:outline-none"
              >
                {showReleaseNotes ? "Hide notes" : "Show notes"}
              </button>
            </div>

            {showReleaseNotes && targetRelease.body && (
              <div className="text-xs text-gray-400 max-h-64 overflow-y-auto settings-scrollbar pr-1.5 leading-relaxed pt-1 select-text">
                <ReactMarkdown
                  components={{
                    p: ({ node, ...props }) => <p className="mb-2" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />,
                    li: ({ node, ...props }) => <li className="mb-0.5" {...props} />,
                    a: ({ node, ...props }) => <a className="text-brand-400 underline hover:text-brand-300" target="_blank" rel="noopener noreferrer" {...props} />,
                    code: ({ node, ...props }) => <code className="bg-surface-800 px-1 py-0.5 rounded text-[11px] font-mono text-gray-300" {...props} />,
                    pre: ({ node, ...props }) => <pre className="bg-surface-800 p-2 rounded my-2 overflow-x-auto text-[11px] font-mono text-gray-300" {...props} />
                  }}
                >
                  {targetRelease.body}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* Update progress or notifications */}
        {updateStatus === "downloading" && (
          <div className="space-y-3 p-4 bg-amber-500/5 border border-amber-500/10 rounded-lg">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-amber-400 animate-pulse flex items-center gap-1.5">
                <IconRefresh size={12} className="animate-spin" />
                Downloading update package...
              </span>
              <span className="text-amber-400 tabular-nums">{downloadProgress}%</span>
            </div>
            <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300 ease-out rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={cancelUpdate}
                className="px-3 py-1.5 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 text-[10px] uppercase font-bold tracking-wider transition-colors cursor-pointer"
              >
                Cancel Download
              </button>
            </div>
          </div>
        )}

        {updateStatus === "ready" && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2.5">
            <div className="mt-0.5 p-1 rounded bg-amber-500/10 text-amber-400">
              <IconCheck size={14} />
            </div>
            <div className="space-y-1">
              <h5 className="text-[12px] font-bold text-amber-400">Download Complete</h5>
              <p className="text-[11px] text-gray-400 leading-normal">
                {isPackaged
                  ? "The update was successfully downloaded. Click below to restart and install the version."
                  : "Simulation successful! (In development mode, we skip replacing the binary file to avoid dev environment corruption)."}
              </p>
            </div>
          </div>
        )}

        {updateStatus === "error" && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-start gap-2.5">
            <IconAlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <h5 className="text-[12px] font-bold text-rose-400">Update Failed</h5>
              <p className="text-[11px] text-gray-400 leading-normal break-all">
                {errorMessage || "An unknown error occurred during update."}
              </p>
              <button
                onClick={resetProgress}
                className="text-[10px] text-rose-400 hover:underline font-semibold mt-1.5 block"
              >
                Dismiss & Reset
              </button>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex justify-end gap-3 pt-1">
          <button
            onClick={() => fetchReleases()}
            disabled={updateStatus === "downloading" || updateStatus === "checking"}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-900 border border-gray-700/60 text-[12px] font-medium text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors disabled:opacity-50"
            title="Refresh releases"
          >
            <IconRefresh size={12} className={updateStatus === "checking" ? "animate-spin" : ""} />
            <span>Check API</span>
          </button>

          {updateStatus === "ready" ? (
            isPackaged ? (
              <button
                onClick={handleUpdateClick}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-[12px] font-bold hover:shadow-lg hover:shadow-amber-500/10 active:scale-95 transition-all"
              >
                Restart App & Apply Update
              </button>
            ) : (
              <button
                onClick={resetProgress}
                className="px-4 py-2 rounded-lg bg-surface-700 text-gray-300 text-[12px] font-bold hover:bg-surface-600 active:scale-95 transition-all"
              >
                Reset Simulation
              </button>
            )
          ) : (
            <button
              onClick={handleUpdateClick}
              disabled={
                !targetRelease ||
                updateStatus === "downloading" ||
                updateStatus === "checking"
              }
              className={`px-5 py-2 rounded-lg text-[12px] font-bold transition-all active:scale-95 ${
                updateStatus === "downloading"
                  ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                  : versionComparison === 0
                    ? "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-md shadow-indigo-500/10"
                    : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md shadow-amber-500/10"
              }`}
            >
              {updateStatus === "downloading" ? (
                <span className="flex items-center gap-1.5">
                  <IconRefresh size={12} className="animate-spin" />
                  Downloading...
                </span>
              ) : versionComparison > 0 ? (
                "Update Now"
              ) : versionComparison < 0 ? (
                "Downgrade Version"
              ) : (
                "Reinstall Version"
              )}
            </button>
          )}
        </div>
      </div>
      
      {/* Update Info Dialog */}
      <Dialog
        isOpen={showInfoDialog}
        onClose={() => setShowInfoDialog(false)}
        title="Application Updates Information"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-brand-500/5 border border-brand-500/10 rounded-xl space-y-3">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-white">How updates work:</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                ClipMaster Pro fetches the latest release assets directly from our secure GitHub repository releases.
              </p>
            </div>
            <ul className="text-xs text-gray-400 space-y-2 ml-4 list-disc">
              <li>
                <span className="font-semibold text-gray-200">Installed Version</span> is the currently running build of the application.
              </li>
              <li>
                <span className="font-semibold text-gray-200">Latest Release</span> represents the latest stable release tagged on GitHub.
              </li>
              <li>
                <span className="font-semibold text-gray-200">Release Notes</span> are displayed below the selector to help you inspect new features, bug fixes, or performance enhancements.
              </li>
              <li>
                <span className="font-semibold text-gray-200">Data Safety</span>: Your clipboard history and personalized configurations are fully preserved during updates.
              </li>
              <li>
                <span className="font-semibold text-gray-200">Cancellation</span>: You can cancel the download at any time using the cancel button.
              </li>
            </ul>
          </div>

          <div className="pt-2">
            <button
              onClick={() => setShowInfoDialog(false)}
              className="w-full px-3 py-2 rounded-md bg-brand-500 hover:bg-brand-600 text-white transition-all text-xs font-semibold uppercase tracking-wide cursor-pointer"
            >
              Close Info
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
