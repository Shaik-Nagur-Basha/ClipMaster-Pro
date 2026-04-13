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
};

const DEFAULT_SETTINGS: AppSettings = {
  autoLaunch: false,
  mongoEnabled: false,
  mongoUri: null,
  atlasEnabled: false,
  atlasUri: null,
  maxEntries: 5000,
  pollingInterval: 600,
  viewMode: "list",
  displayMode: "preview",
  lastLocalSyncedAt: null,
  lastCloudSyncedAt: null,
  latestSyncedAt: null,
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
  loadClips: async () => {
    set({ isLoading: true });
    try {
      console.log("[Store] Fetching clips from window.clipAPI...");
      const clips = await window.clipAPI.getClips();
      console.log(
        `[Store] loadClips success: received ${clips?.length ?? 0} clips`,
      );
      if (clips && clips.length > 0) {
        console.log(
          "[Store] First clip sample:",
          clips[0].text.substring(0, 50),
        );
      }
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

  addClipFromMain: (item: ClipboardItem) => {
    set((state) => {
      if (state.clips.some((c) => c.id === item.id)) return state;
      return { clips: [item, ...state.clips] };
    });
  },

  updateClip: async (item: ClipboardItem) => {
    await window.clipAPI.updateClip(item);
    set((state) => ({
      clips: state.clips.map((c) => (c.id === item.id ? item : c)),
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
    const newSettings: AppSettings = { ...get().settings, ...partial };
    await window.clipAPI.saveSettings(
      newSettings as unknown as Record<string, unknown>,
    );
    set({ settings: newSettings });
    if (partial.viewMode) set({ viewMode: partial.viewMode });
    if (partial.displayMode) set({ displayMode: partial.displayMode });
  },

  // ── UI Actions ─────────────────────────────────────────────────────────
  setViewMode: (mode: ViewMode) => set({ viewMode: mode }),
  setDisplayMode: (mode: DisplayMode) => set({ displayMode: mode }),
  setSortMode: (mode: SortMode) => set({ sortMode: mode }),
  setFilters: (partial: Partial<FilterState>) =>
    set((state) => ({ filters: { ...state.filters, ...partial } })),
  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),
  setActivePage: (page: ActivePage) => set({ activePage: page }),
  setSelectedClip: (id: string | null) => set({ selectedClipId: id }),
  setEditingClip: (id: string | null) => set({ editingClipId: id }),
  setMongoConnected: (v: boolean) => set({ mongoConnected: v }),
  setAtlasConnected: (v: boolean) => {
    if (!v) {
      // Clear persistent sync time on disconnect
      get().saveSettings({ lastCloudSyncedAt: null });
      set((state) => ({
        atlasConnected: false,
        syncState: { ...state.syncState, lastCloudSyncedAt: null },
      }));
    } else {
      set({ atlasConnected: true });
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

  if (tags.length > 0)
    result = result.filter((c) => tags.every((t) => c.tags.includes(t)));

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
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
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
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
}
