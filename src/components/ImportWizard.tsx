import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Dialog from "./Dialog";
import { useClipStore } from "../store/useClipStore";
import {
  IconCheck,
  IconDatabase,
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

type ImportStatus = "config" | "progress" | "summary" | "error";

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

  // Subscribe to progress updates
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

  const handleClose = async () => {
    // Reload database records so the UI is updated immediately on closure
    if (summary && summary.success) {
      const store = useClipStore.getState();
      await Promise.all([
        store.loadClips(),
        store.loadTags(),
        store.loadSettings()
      ]);
    }
    
    // Reset wizard
    setStatus("config");
    setProgressStep("preparing");
    setProgressPercent(0);
    setErrorMessage("");
    setSummary(null);
    onClose();
  };

  const handleStartImport = async () => {
    setStatus("progress");
    setProgressPercent(0);
    setProgressStep("preparing");
    setErrorMessage("");

    try {
      if (!window.clipAPI?.selectAndImportFile) {
        throw new Error(
          "Import System API not initialized. Please restart ClipMaster Pro to load the import functions."
        );
      }
      
      const result = await window.clipAPI.selectAndImportFile();
      
      if (!result.success && result.error === "Import cancelled by user.") {
        setStatus("config");
        return;
      }

      setSummary(result);
      
      if (result.success) {
        setStatus("summary");
      } else {
        setErrorMessage(result.error || "Ingestion failed.");
        setStatus("error");
      }
    } catch (err: any) {
      console.error("Import error:", err);
      setErrorMessage(err.message || "An error occurred during data import.");
      setStatus("error");
    }
  };

  const getStepLabel = (step: string): string => {
    switch (step) {
      case "preparing":
        return "Preparing files";
      case "processing":
        return "Analyzing & parsing JSON data";
      case "generating":
        return "Sanitizing & inserting records";
      case "complete":
        return "Import complete";
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
          <svg className="w-4 h-4 text-brand-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Data Import System
        </span>
      }
      maxWidth="max-w-xl"
    >
      <div className="space-y-6">
        <AnimatePresence mode="wait">
          {/* CONFIGURATION STEP */}
          {status === "config" && (
            <motion.div
              key="config"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2 py-2">
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-400 mx-auto mb-3">
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </div>
                <h4 className="text-sm font-bold text-white">Import Backup File</h4>
                <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
                  Select a ClipMaster Pro backup file in **JSON** or **ZIP** format to restore your clipboard entries, tags, and settings.
                </p>
              </div>

              {/* Informative instructions */}
              <div className="bg-surface-900/40 border border-gray-700/50 rounded-xl p-4 space-y-3.5 text-xs text-gray-400">
                <div className="flex gap-3">
                  <IconShield size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-gray-200 block">Conflict Resolution (Keep Existing)</span>
                    If a clip or tag name already exists in your local database, the import system will skip it to prevent duplication. Your existing data remains fully untouched.
                  </div>
                </div>
                <div className="flex gap-3">
                  <IconZap size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-gray-200 block">Data Sanitization</span>
                    Corrupted properties, null values, or empty strings are automatically repaired, cleaned, or safely filtered out.
                  </div>
                </div>
              </div>

              {/* Proceed Action */}
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-700 bg-surface-800 text-gray-300 hover:bg-surface-700 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <IconX size={14} />
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleStartImport}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-brand-500/20 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Select File
                </button>
              </div>
            </motion.div>
          )}

          {/* PROGRESS STEP */}
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
                  Please wait, parsing files and updating database structures.
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

          {/* SUMMARY STEP */}
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
                <p className="text-xs text-gray-500">Your backup package has been successfully imported.</p>
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
                    Duplicate entries or properties matching existing names/contents were skipped to preserve your data.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStatus("config")}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-700 bg-surface-800 text-gray-300 hover:bg-surface-700 text-xs font-semibold tracking-wide transition-colors cursor-pointer flex items-center justify-center gap-2"
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

          {/* ERROR STEP */}
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
