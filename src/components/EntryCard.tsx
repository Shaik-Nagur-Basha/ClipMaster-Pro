import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useClipStore } from "../store/useClipStore";
import TagBadge from "./TagBadge";
import Dialog from "./Dialog";
import FormattedContent from "./FormattedContent";
import type { ClipboardItem, Tag } from "../types";
import {
  IconCopy,
  IconStar,
  IconStarFilled,
  IconTag,
  IconEdit,
  IconTrash,
  IconRestore,
  IconX,
  IconCheck,
  IconSearch,
} from "./Icons";

interface Props {
  item: ClipboardItem;
  displayMode: "preview" | "full";
  viewMode: "list";
}

const EntryCard = React.forwardRef<HTMLDivElement, Props>(
  ({ item, displayMode, viewMode }, ref) => {
    const {
      tags,
      updateClip,
      deleteClip,
      toggleFavorite,
      copyToClipboard,
      editingClipId,
      setEditingClip,
      toggleTagOnClip,
      restoreClip,
      permanentDelete,
    } = useClipStore();
    const [editText, setEditText] = useState(item.text);
    const [copied, setCopied] = useState(false);
    const [showTagPicker, setShowTagPicker] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [tagSearchFilter, setTagSearchFilter] = useState("");

    const isEditing = editingClipId === item.id;
    const tagObjects = tags.filter((t) => item.tags.includes(t.id));

    const displayText =
      displayMode === "preview" && item.text.length > 120
        ? item.text.slice(0, 120) + "…"
        : item.text;

    const timeAgo = useCallback(() => {
      const diff = Date.now() - new Date(item.timestamp).getTime();
      const mins = Math.floor(diff / 60000);
      const hrs = Math.floor(mins / 60);
      const days = Math.floor(hrs / 24);
      if (days > 0) return `${days}d ago`;
      if (hrs > 0) return `${hrs}h ago`;
      if (mins > 0) return `${mins}m ago`;
      return "just now";
    }, [item.timestamp]);

    const handleCopy = async () => {
      await copyToClipboard(item.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    };

    const handleSaveEdit = async () => {
      if (editText.trim() && editText !== item.text) {
        await updateClip({ ...item, text: editText.trim() });
      }
      setIsEditDialogOpen(false);
      setEditingClip(null);
    };

    const handleCancelEdit = () => {
      setEditText(item.text);
      setIsEditDialogOpen(false);
      setEditingClip(null);
    };

    const openEditDialog = () => {
      setEditText(item.text);
      setIsEditDialogOpen(true);
    };

    const handleCreateTag = async () => {
      if (!tagSearchFilter.trim()) return;

      // Check if tag with this name already exists
      const exists = tags.some(
        (t) => t.name.toLowerCase() === tagSearchFilter.toLowerCase(),
      );
      if (exists) return;

      // Generate a simple ID and pick a random color
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
      const newTag: Tag = {
        id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: tagSearchFilter.trim(),
        color: colors[Math.floor(Math.random() * colors.length)],
      };

      // Add the new tag and save
      const updatedTags = [...tags, newTag];
      await useClipStore.getState().saveTags(updatedTags);

      // Automatically toggle this tag on the current clip
      await toggleTagOnClip(item.id, newTag.id);

      // Clear the search filter
      setTagSearchFilter("");
    };

    return (
      <motion.div
        ref={ref}
        layout
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.15 }}
        className={`group flex flex-col py-2 px-4 border-b transition-colors ${
          item.isFavorite
            ? "border-accent-500/20 bg-surface-900/30"
            : "border-gray-700/20 hover:bg-surface-900/20"
        }`}
      >
        {/* Main row - content and controls */}
        <div className="flex items-start gap-3 min-h-[40px]">
          {/* Favorite indicator star */}
          {item.isFavorite && (
            <IconStarFilled
              size={16}
              className="text-accent-500 mt-1 flex-shrink-0"
            />
          )}

          {/* Content area */}
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            {/* Main text - formatted content */}
            <FormattedContent
              content={displayText}
              displayMode={displayMode}
              className={`transition-colors ${
                item.isFavorite
                  ? "text-accent-100 font-medium"
                  : "text-gray-300"
              }`}
            />

            {/* Meta info row - time, count, tags */}
            <div className="flex items-center flex-wrap">
              <span
                className={`text-[10px] mr-3 ${
                  item.isFavorite ? "text-accent-400" : "text-gray-500"
                }`}
              >
                {timeAgo()}
              </span>
              <div
                className={`text-[10px] mr-3 ${
                  item.isFavorite ? "text-accent-300/60" : "text-gray-600"
                }`}
              >
                <span className="font-mono">
                  {item.charCount ?? item.text.length}C
                </span>
                {item.wordCount && <span className="mx-1.5">•</span>}
                {item.wordCount && (
                  <span className="font-mono">{item.wordCount}W</span>
                )}
              </div>
              {tagObjects.length > 0 &&
                tagObjects.map((t) => (
                  <div key={t.id} className="mr-1">
                    <TagBadge tag={t} size="sm" />
                  </div>
                ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <ActionBtn
              icon={copied ? IconCheck : IconCopy}
              label="Copy"
              onClick={handleCopy}
              active={copied}
            />
            {item.isDeleted ? (
              <>
                <ActionBtn
                  icon={IconRestore}
                  label="Restore"
                  onClick={() => restoreClip(item.id)}
                />
                <ActionBtn
                  icon={IconX}
                  label="Delete Forever"
                  onClick={() => permanentDelete(item.id)}
                  danger
                />
              </>
            ) : (
              <>
                <ActionBtn
                  icon={IconTag}
                  label="Tags"
                  onClick={() => setShowTagPicker(!showTagPicker)}
                  active={showTagPicker}
                />
                <ActionBtn
                  icon={IconEdit}
                  label="Edit"
                  onClick={openEditDialog}
                />
                <ActionBtn
                  icon={item.isFavorite ? IconStarFilled : IconStar}
                  label="Favorite"
                  onClick={() => toggleFavorite(item.id)}
                  active={item.isFavorite}
                />
                <ActionBtn
                  icon={IconTrash}
                  label="Delete"
                  onClick={() => deleteClip(item.id)}
                  danger
                />
              </>
            )}
          </div>
        </div>

        {/* Tag Picker Popover */}
        <AnimatePresence>
          {showTagPicker && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 ml-5 bg-surface-800/50 rounded-lg p-2 border border-gray-700/30"
            >
              {/* Header with label and search input */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">
                  Select Tags
                </div>

                {/* Tag Search Input */}
                <div className="relative flex items-center group w-48">
                  <div className="absolute left-2 text-gray-600 group-focus-within:text-gray-400 transition-colors pointer-events-none duration-150">
                    <IconSearch size={14} />
                  </div>
                  <input
                    type="text"
                    placeholder="Search tags…"
                    value={tagSearchFilter}
                    onChange={(e) => setTagSearchFilter(e.target.value)}
                    style={{
                      boxShadow: "none",
                      outline: "none",
                      border: "none",
                      borderBottom: "1px solid #4b5563",
                    }}
                    className="w-full bg-transparent hover:border-b hover:border-gray-600 focus:border-b focus:border-gray-500 pl-7 pr-7 py-1.5 text-[12px] text-white/85 placeholder-gray-600 transition-colors duration-150"
                  />
                  {tagSearchFilter && (
                    <button
                      onClick={() => setTagSearchFilter("")}
                      className="absolute right-1 p-0.5 text-gray-600 hover:text-gray-400 transition-colors duration-150"
                      title="Clear search"
                    >
                      <IconX size={12} />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {tags.length === 0 ? (
                  <p className="text-[10px] text-gray-600">No tags defined</p>
                ) : (
                  <>
                    {tags
                      .filter((tag) =>
                        tag.name
                          .toLowerCase()
                          .includes(tagSearchFilter.toLowerCase()),
                      )
                      .map((tag) => {
                        const isSelected = item.tags.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            onClick={() => toggleTagOnClip(item.id, tag.id)}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] transition-all ${
                              isSelected
                                ? "bg-surface-700 text-white"
                                : "hover:bg-surface-700/60 text-gray-500 hover:text-gray-300"
                            }`}
                          >
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: tag.color }}
                            />
                            <span className="truncate max-w-[100px] ">
                              {tag.name}
                            </span>
                            {isSelected && (
                              <IconCheck size={12} className="text-brand-400" />
                            )}
                          </button>
                        );
                      })}

                    {/* Create New Tag Button */}
                    {tagSearchFilter.trim() &&
                      !tags.some(
                        (t) =>
                          t.name.toLowerCase() ===
                          tagSearchFilter.toLowerCase(),
                      ) && (
                        <button
                          onClick={handleCreateTag}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] transition-all bg-brand-500/15 text-brand-400 border border-brand-500/40 hover:bg-brand-500/25 hover:border-brand-500/60"
                        >
                          <span className="text-sm leading-none">+</span>
                          <span className="truncate">
                            Create "{tagSearchFilter}"
                          </span>
                        </button>
                      )}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit Dialog */}
        <Dialog
          isOpen={isEditDialogOpen}
          onClose={handleCancelEdit}
          title="Edit Clipboard Entry"
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4">
            <textarea
              autoFocus
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full min-h-[200px] max-h-[400px] bg-surface-900 text-gray-100 text-[13px] rounded-lg p-3 resize-y outline-none border border-gray-700 focus:border-brand-500 font-mono leading-relaxed transition-colors"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey))
                  handleSaveEdit();
                if (e.key === "Escape") handleCancelEdit();
              }}
              placeholder="Edit your clipboard content here…"
            />

            <div className="flex items-center justify-between text-[11px] text-gray-500">
              <span>{editText.length} characters</span>
              <span className="text-gray-600">
                Ctrl+Enter to save • Esc to cancel
              </span>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCancelEdit}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-300 hover:bg-white/5 bg-transparent transition-all text-sm font-bold uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editText.trim() || editText === item.text}
                className="flex-1 px-4 py-2.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-bold uppercase tracking-wider"
              >
                Save Changes
              </button>
            </div>
          </div>
        </Dialog>
      </motion.div>
    );
  },
);

EntryCard.displayName = "EntryCard";

// ─── Action Button ────────────────────────────────────────────────────────
interface ActionBtnProps {
  icon: React.FC<{ size?: number; className?: string }>;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}

const ActionBtn: React.FC<ActionBtnProps> = ({
  icon: Icon,
  label,
  onClick,
  active,
  danger,
}) => (
  <button
    title={label}
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    className={`size-7 rounded-md flex items-center justify-center transition-all duration-150 active:scale-75 ${
      danger
        ? "hover:bg-red-500/10 text-gray-500 hover:text-red-400"
        : active
          ? "bg-brand-500/15 text-brand-400 border border-brand-500/20 shadow-sm"
          : "hover:bg-gray-800 text-gray-500 hover:text-gray-200"
    }`}
  >
    <Icon size={15} />
  </button>
);

export default EntryCard;
