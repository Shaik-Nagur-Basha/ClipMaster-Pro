import { create } from "zustand";
import type {
  ClipStore,
  ClipboardItem,
  FilterState,
  ViewMode,
  DisplayMode,
  SortMode,
  ActivePage,
  SyncState,
  Tag,
  AppSettings,
} from "../types";

const DEFAULT_FILTERS: FilterState = {
  search: "",
  tags: [],
  isFavorite: null,
  lengthFilter: "all",
  dateFrom: null,
  dateTo: null,
  minWordCount: null,
  maxWordCount: null,
  tagMatchingMode: "or",
  sortTagsByUsage: false,
};

const DEFAULT_SETTINGS: AppSettings = {
  autoLaunch: false,
  mongoEnabled: false,
  mongoUri: null,
  atlasEnabled: false,
  atlasUri: null,
  maxEntries: 5000,
  pollingInterval: 600,
  paginationEnabled: true,
  pageSize: 10,
  viewMode: "list",
  displayMode: "preview",
  lastLocalSyncedAt: null,
  lastCloudSyncedAt: null,
  latestSyncedAt: null,
  pauseCaptureOption: "never",
  pauseUntil: null,
};

const DEFAULT_SYNC_STATE: SyncState = {
  localMongo: "idle",
  atlas: "idle",
  lastLocalSyncedAt: null,
  lastCloudSyncedAt: null,
  latestSyncedAt: null,
};

export const useClipStore = create<ClipStore>((set, get) => ({
  // ── Initial State ──────────────────────────────────────────────────────
  clips: [],
  tags: [],
  settings: { ...DEFAULT_SETTINGS },
  searchInputRef: null,
  viewMode: "list",
  displayMode: "preview",
  sortMode: "newest",
  filters: { ...DEFAULT_FILTERS },
  activePage: "dashboard",
  selectedClipId: null,
  editingClipId: null,
  mongoConnected: false,
  atlasConnected: false,
  syncState: { ...DEFAULT_SYNC_STATE },
  isLoading: false,

  // ── Data Actions ───────────────────────────────────────────────────────
  loadClips: async (limit?: number) => {
    const alreadyHasClips = get().clips.length > 0;
    // Only show the loading skeleton when we have no clips yet (first load).
    // Background refreshes (e.g. the full history load after the fast 200-clip start)
    // should silently update the store without causing a loading flash.
    if (!alreadyHasClips) {
      set({ isLoading: true });
    }
    try {
      console.log(`[Store] Fetching clips (limit=${limit}) from window.clipAPI...`);
      const clips = await window.clipAPI.getClips(limit);
      console.log(
        `[Store] loadClips success: received ${clips?.length ?? 0} clips`,
      );
      set({ clips: clips || [], isLoading: false });
    } catch (err) {
      console.error("[Store] loadClips failed:", err);
      set({ clips: [], isLoading: false });
    }
  },

  loadTags: async () => {
    try {
      const tags = await window.clipAPI.getTags();
      set({ tags });
    } catch (err) {
      console.error("[Store] loadTags failed:", err);
    }
  },

  loadSettings: async () => {
    try {
      const raw = await window.clipAPI.getSettings();
      const settings: AppSettings = { ...DEFAULT_SETTINGS, ...raw };
      console.log("[Store] loadSettings →", Object.keys(settings).join(", "));
      const ss = await window.clipAPI.getSyncState();
      set((state) => ({
        settings,
        viewMode: settings.viewMode ?? "list",
        displayMode: settings.displayMode ?? "preview",
        syncState: {
          ...state.syncState,
          ...ss,
          lastLocalSyncedAt: settings.lastLocalSyncedAt || ss.lastLocalSyncedAt,
          lastCloudSyncedAt: settings.lastCloudSyncedAt || ss.lastCloudSyncedAt,
          latestSyncedAt: settings.latestSyncedAt || ss.latestSyncedAt,
        },
      }));
    } catch (err) {
      console.error("[Store] loadSettings failed:", err);
    }
  },

  loadUIState: async () => {
    try {
      const state = await window.clipAPI.getUIState();
      if (state) {
        set({
          activePage: state.activePage ?? "dashboard",
          selectedClipId: state.selectedClipId ?? null,
          sortMode: state.sortMode ?? "newest",
          filters: state.filters ? { ...DEFAULT_FILTERS, ...state.filters } : { ...DEFAULT_FILTERS }
        });
      }
    } catch (err) {
      console.error("[Store] loadUIState failed:", err);
    }
  },

  addClipFromMain: (item: ClipboardItem) => {
    set((state) => {
      if (state.clips.some((c) => c.id === item.id)) return state;
      return { clips: [item, ...state.clips] };
    });
  },

  updateClip: async (item: ClipboardItem) => {
    const trimmedText = item.text.trim();
    const updated: ClipboardItem = {
      ...item,
      text: trimmedText,
      updatedAt: new Date().toISOString(),
      charCount: trimmedText.length,
      wordCount: trimmedText.length > 0 ? trimmedText.split(/\s+/).length : 0,
    };

    await window.clipAPI.updateClip(updated);
    set((state) => ({
      clips: state.clips.map((c) => (c.id === updated.id ? updated : c)),
      editingClipId: null,
    }));
  },

  deleteClip: async (id: string) => {
    await window.clipAPI.deleteClip(id);
    set((state) => ({
      clips: state.clips.map((c) =>
        c.id === id
          ? { ...c, isDeleted: true, deletedAt: new Date().toISOString() }
          : c,
      ),
    }));
  },

  permanentDelete: async (id: string) => {
    await window.clipAPI.permanentDelete(id);
    set((state) => ({ clips: state.clips.filter((c) => c.id !== id) }));
  },

  permanentDeleteBulk: async (ids: string[]) => {
    await window.clipAPI.permanentDeleteBulk(ids);
    const idSet = new Set(ids);
    set((state) => ({ clips: state.clips.filter((c) => !idSet.has(c.id)) }));
  },

  restoreClip: async (id: string): Promise<boolean> => {
    await window.clipAPI.restoreClip(id);
    set((state) => ({
      clips: state.clips.map((c) =>
        c.id === id ? { ...c, isDeleted: false, deletedAt: undefined } : c,
      ),
    }));
    return true;
  },

  toggleFavorite: async (id: string) => {
    const clip = get().clips.find((c) => c.id === id);
    if (!clip) return;
    const updated: ClipboardItem = { ...clip, isFavorite: !clip.isFavorite };
    await window.clipAPI.updateClip(updated);
    set((state) => ({
      clips: state.clips.map((c) => (c.id === id ? updated : c)),
    }));
  },

  copyToClipboard: async (text: string) => {
    await window.clipAPI.copyToClipboard(text);
  },

  saveTags: async (tags: Tag[]) => {
    await window.clipAPI.saveTags(tags);
    set({ tags });
  },

  saveSettings: async (partial: Partial<AppSettings>) => {
    if ("pauseCaptureOption" in partial) {
      const option = partial.pauseCaptureOption;
      if (option === "15mins") {
        partial.pauseUntil = Date.now() + 15 * 60 * 1000;
      } else if (option === "30mins") {
        partial.pauseUntil = Date.now() + 30 * 60 * 1000;
      } else if (option === "1hour") {
        partial.pauseUntil = Date.now() + 60 * 60 * 1000;
      } else {
        partial.pauseUntil = null;
      }
    }

    const res = await window.clipAPI.saveSettings(
      partial as unknown as Record<string, unknown>,
    );
    const nextSettings: AppSettings = (res && typeof res === "object")
      ? (res as AppSettings)
      : { ...get().settings, ...partial };
    set({ settings: nextSettings });
    if (partial.viewMode) set({ viewMode: partial.viewMode });
    if (partial.displayMode) set({ displayMode: partial.displayMode });
  },

  // ── UI Actions ─────────────────────────────────────────────────────────
  setViewMode: (mode: ViewMode) => set({ viewMode: mode }),
  setDisplayMode: (mode: DisplayMode) => set({ displayMode: mode }),
  setSortMode: (mode: SortMode) => {
    set({ sortMode: mode });
    window.clipAPI.updateUIState?.({ sortMode: mode });
  },
  setFilters: (partial: Partial<FilterState>) =>
    set((state) => {
      const next = { ...state.filters, ...partial };
      window.clipAPI.updateUIState?.({ filters: next });
      return { filters: next };
    }),
  resetFilters: () => {
    set({ filters: { ...DEFAULT_FILTERS } });
    window.clipAPI.updateUIState?.({ filters: { ...DEFAULT_FILTERS } });
  },
  setActivePage: (page: ActivePage) => {
    set({ activePage: page });
    window.clipAPI.updateUIState?.({ activePage: page });
  },
  setSelectedClip: (id: string | null) => {
    set({ selectedClipId: id });
    window.clipAPI.updateUIState?.({ selectedClipId: id });
  },
  setEditingClip: (id: string | null) => set({ editingClipId: id }),
  setSearchInputRef: (ref: React.RefObject<HTMLInputElement> | null) =>
    set({ searchInputRef: ref }),
  setMongoConnected: (v: boolean) => set({ mongoConnected: v }),
  setAtlasConnected: (v: boolean) => {
    if (get().atlasConnected !== v) {
      set({ atlasConnected: v });
    }
  },
  setSyncState: (patch: Partial<SyncState>) => {
    const state = get();
    const next = { ...state.syncState, ...patch };
    const toPersist: Partial<AppSettings> = {};

    if (patch.lastLocalSyncedAt !== undefined)
      toPersist.lastLocalSyncedAt = patch.lastLocalSyncedAt;
    if (patch.lastCloudSyncedAt !== undefined)
      toPersist.lastCloudSyncedAt = patch.lastCloudSyncedAt;
    if (patch.latestSyncedAt !== undefined)
      toPersist.latestSyncedAt = patch.latestSyncedAt;

    if (Object.keys(toPersist).length > 0) {
      state.saveSettings(toPersist);
    }
    set({ syncState: next });
  },

  toggleTagOnClip: async (clipId: string, tagId: string) => {
    const clip = get().clips.find((c) => c.id === clipId);
    if (!clip) return;
    const newTags = clip.tags.includes(tagId)
      ? clip.tags.filter((t) => t !== tagId)
      : [...clip.tags, tagId];

    const updated = { ...clip, tags: newTags };
    await window.clipAPI.updateClip(updated);
    set((state) => ({
      clips: state.clips.map((c) => (c.id === clipId ? updated : c)),
    }));
  },
}));

// ─── Derived Selectors ────────────────────────────────────────────────────

export function selectFilteredClips(
  state: ClipStore,
  showDeleted = false,
): ClipboardItem[] {
  const { clips, filters, sortMode } = state;
  const {
    search,
    tags,
    isFavorite,
    minWordCount,
    maxWordCount,
    dateFrom,
    dateTo,
  } = filters;

  let result = clips.filter((c) => !!c.isDeleted === showDeleted);

  if (search.trim()) {
    const q = search.toLowerCase();
    result = result.filter((c) => c.text.toLowerCase().includes(q));
  }

  if (tags.length > 0) {
    const matchMode = filters.tagMatchingMode ?? "or";
    if (matchMode === "and") {
      result = result.filter((c) => tags.every((t) => c.tags.includes(t)));
    } else {
      result = result.filter((c) => tags.some((t) => c.tags.includes(t)));
    }
  }

  if (isFavorite === true) result = result.filter((c) => c.isFavorite);

  if (minWordCount !== null || maxWordCount !== null) {
    result = result.filter((c) => {
      const len = c.charCount ?? c.text.length;
      if (minWordCount !== null && len < minWordCount) return false;
      if (maxWordCount !== null && len > maxWordCount) return false;
      return true;
    });
  }

  if (dateFrom)
    result = result.filter((c) => new Date(c.timestamp) >= new Date(dateFrom));
  if (dateTo)
    result = result.filter(
      (c) => new Date(c.timestamp) <= new Date(dateTo + "T23:59:59"),
    );

  if (sortMode === "newest")
    result.sort(
      (a, b) =>
        new Date(b.updatedAt || b.timestamp).getTime() -
        new Date(a.updatedAt || a.timestamp).getTime(),
    );
  else if (sortMode === "oldest")
    result.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  else if (sortMode === "longest")
    result.sort(
      (a, b) => (b.charCount ?? b.text.length) - (a.charCount ?? a.text.length),
    );
  else if (sortMode === "shortest")
    result.sort(
      (a, b) => (a.charCount ?? a.text.length) - (b.charCount ?? b.text.length),
    );

  return result;
}

export function selectDeletedClips(state: ClipStore): ClipboardItem[] {
  return state.clips
    .filter((c) => c.isDeleted)
    .sort(
      (a, b) =>
        new Date(b.deletedAt ?? b.timestamp).getTime() -
        new Date(a.deletedAt ?? a.timestamp).getTime(),
    );
}

export function selectFavoriteClips(state: ClipStore): ClipboardItem[] {
  return state.clips
    .filter((c) => !c.isDeleted && c.isFavorite)
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.timestamp).getTime() -
        new Date(a.updatedAt || a.timestamp).getTime(),
    );
}
