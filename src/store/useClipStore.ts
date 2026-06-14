import { create } from "zustand";
import type {
  ClipStore,
  ClipboardItem,
  FilterState,
  ViewMode,
  DisplayMode,
  SortMode,
  ActivePage,
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
  sortTagsByUsage: true,
};

const DEFAULT_SETTINGS: AppSettings = {
  autoLaunch: true,
  maxEntries: 5000,
  pollingInterval: 600,
  paginationEnabled: true,
  pageSize: 10,
  viewMode: "list",
  displayMode: "preview",
  pauseCaptureOption: "never",
  pauseUntil: null,
  globalShortcutEnabled: true,
  globalShortcutKey: "CommandOrControl+Shift+V",
  popupPinned: false,
};

export const useClipStore = create<ClipStore>((set, get) => ({
  // ── Initial State ──────────────────────────────────────────────────────
  clips: [],
  tags: [],
  settings: { ...DEFAULT_SETTINGS },
  searchInputRef: null,
  filterStats: {
    minCharCount: 1,
    maxCharCount: 100,
    tagCounts: {},
    minDate: null,
    maxDate: null,
  },
  viewMode: "list",
  displayMode: "preview",
  sortMode: "newest",
  filters: { ...DEFAULT_FILTERS },
  activePage: "dashboard",
  selectedClipId: null,
  editingClipId: null,
  isLoading: false,
  totalCount: 0,
  currentPage: 1,
  sidebarCounts: { active: 0, favorites: 0, deleted: 0 },
  popupSearchVisible: false,
  popupTagsMenuVisible: false,
  popupSearchValue: "",
  isSearchFocused: false,
  isTagSearchFocused: false,

  // ── Data Actions ───────────────────────────────────────────────────────
  loadClips: async (forceLimit?: number) => {
    const state = get();
    const alreadyHasClips = state.clips.length > 0;
    if (!alreadyHasClips || !state.settings.paginationEnabled) {
      set({ isLoading: true });
    }
    try {
      let options: any;
      if (forceLimit !== undefined) {
        options = forceLimit;
      } else {
        const isFavorite = state.activePage === "favorites" ? true : null;
        const isDeleted = state.activePage === "recycle";

        options = {
          search: state.filters.search,
          tags: state.filters.tags,
          isFavorite,
          isDeleted,
          sortMode: state.sortMode,
          dateFrom: state.filters.dateFrom,
          dateTo: state.filters.dateTo,
          minWordCount: state.filters.minWordCount,
          maxWordCount: state.filters.maxWordCount,
          tagMatchingMode: state.filters.tagMatchingMode,
        };

        if (state.settings.paginationEnabled) {
          const pageSize = state.settings.pageSize || 10;
          const skip = (state.currentPage - 1) * pageSize;
          options.limit = pageSize;
          options.skip = skip;
        }
      }

      console.log("[Store] Fetching clips with options:", options);
      const result = await window.clipAPI.getClips(options);

      if (forceLimit !== undefined) {
        set({
          clips: result || [],
          totalCount: result ? result.length : 0,
          isLoading: false,
        });
      } else {
        const statsOptions = {
          isDeleted: state.activePage === "recycle",
          isFavorite: state.activePage === "favorites" ? true : null,
          search: state.filters.search,
        };
        const stats = await window.clipAPI.getFilterStats(statsOptions);
        set({
          clips: result?.clips || [],
          totalCount: result?.totalCount || 0,
          filterStats: stats || {
            minCharCount: 1,
            maxCharCount: 100,
            tagCounts: {},
            minDate: null,
            maxDate: null,
          },
          isLoading: false,
        });
      }

      // Keep sidebar counts in sync before callers continue with derived checks.
      await get().loadSidebarCounts();
    } catch (err) {
      console.error("[Store] loadClips failed:", err);
      set({ clips: [], totalCount: 0, isLoading: false });
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
      set({
        settings,
        viewMode: settings.viewMode ?? "list",
        displayMode: settings.displayMode ?? "preview",
      });
    } catch (err) {
      console.error("[Store] loadSettings failed:", err);
    }
  },

  loadUIState: async () => {
    try {
      const state = await window.clipAPI.getUIState();
      if (state) {
        const isPopup =
          typeof window !== "undefined" &&
          window.location.search.includes("popup=true");
        let activePage = state.activePage ?? "dashboard";
        if (
          isPopup &&
          !["dashboard", "favorites", "recycle"].includes(activePage)
        ) {
          activePage = "dashboard";
        }
        const loadedFilters = state.filters
          ? { ...DEFAULT_FILTERS, ...state.filters }
          : { ...DEFAULT_FILTERS };
        const hasSearch = !!(
          loadedFilters.search && loadedFilters.search.trim().length > 0
        );
        set({
          activePage,
          selectedClipId: state.selectedClipId ?? null,
          sortMode: state.sortMode ?? "newest",
          filters: loadedFilters,
          currentPage: 1,
          popupSearchValue: loadedFilters.search || "",
          popupSearchVisible: hasSearch,
        });
      }
    } catch (err) {
      console.error("[Store] loadUIState failed:", err);
    }
  },

  loadSidebarCounts: async () => {
    try {
      const counts = await window.clipAPI.getCounts();
      if (counts) {
        set({ sidebarCounts: counts });
      }
    } catch (err) {
      console.error("[Store] loadSidebarCounts failed:", err);
    }
  },

  addClipFromMain: (item: ClipboardItem) => {
    const state = get();
    const isPopup =
      typeof window !== "undefined" &&
      window.location.search.includes("popup=true");
    console.log(
      `[Store] addClipFromMain isPopup=${isPopup} activePage=${state.activePage} currentPage=${state.currentPage} item=${item.id}`,
    );
    const hasFiltersActive =
      state.filters.search.trim().length > 0 ||
      state.filters.tags.length > 0 ||
      state.filters.isFavorite !== null ||
      state.filters.dateFrom !== null ||
      state.filters.dateTo !== null;

    if (
      hasFiltersActive ||
      state.activePage !== "dashboard" ||
      state.currentPage !== 1
    ) {
      console.log("[Store] addClipFromMain calling loadClips");
      get().loadClips();
    } else {
      console.log("[Store] addClipFromMain prepending item directly");
      set((state) => {
        const filteredClips = state.clips.filter((c) => c.id !== item.id);
        const newClips = state.settings.paginationEnabled
          ? [item, ...filteredClips].slice(0, state.settings.pageSize || 10)
          : [item, ...filteredClips];
        const isDuplicate = state.clips.some((c) => c.id === item.id);
        return {
          clips: newClips,
          totalCount: isDuplicate ? state.totalCount : state.totalCount + 1,
        };
      });
      get().loadSidebarCounts();
    }
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
    set({ editingClipId: null });
    get().loadClips();
  },

  deleteClip: async (id: string) => {
    await window.clipAPI.deleteClip(id);
    get().loadClips();
  },

  permanentDelete: async (id: string) => {
    await window.clipAPI.permanentDelete(id);
    get().loadClips();
  },

  permanentDeleteBulk: async (ids: string[]) => {
    await window.clipAPI.permanentDeleteBulk(ids);
    get().loadClips();
  },

  restoreClip: async (id: string): Promise<boolean> => {
    await window.clipAPI.restoreClip(id);
    get().loadClips();
    return true;
  },

  toggleFavorite: async (id: string) => {
    const clip = get().clips.find((c) => c.id === id);
    if (!clip) return;
    const updated: ClipboardItem = { ...clip, isFavorite: !clip.isFavorite };
    await window.clipAPI.updateClip(updated);
    get().loadClips();
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
    const nextSettings: AppSettings =
      res && typeof res === "object"
        ? (res as AppSettings)
        : { ...get().settings, ...partial };
    set({ settings: nextSettings, currentPage: 1 });
    if (partial.viewMode) set({ viewMode: partial.viewMode });
    if (partial.displayMode) set({ displayMode: partial.displayMode });
    get().loadClips();
  },

  // ── UI Actions ─────────────────────────────────────────────────────────
  setViewMode: (mode: ViewMode) => set({ viewMode: mode }),
  setDisplayMode: (mode: DisplayMode) => set({ displayMode: mode }),
  setSortMode: (mode: SortMode) => {
    set({ sortMode: mode, currentPage: 1 });
    window.clipAPI.updateUIState?.({ sortMode: mode });
    get().loadClips();
  },
  setFilters: (partial: Partial<FilterState>) => {
    set((state) => {
      const next = { ...state.filters, ...partial };
      window.clipAPI.updateUIState?.({ filters: next });
      // Schedule loading to prevent thread blockage
      setTimeout(() => {
        set({ currentPage: 1 });
        get().loadClips();
      }, 0);
      return { filters: next };
    });
  },
  resetFilters: () => {
    set({ filters: { ...DEFAULT_FILTERS }, currentPage: 1 });
    window.clipAPI.updateUIState?.({ filters: { ...DEFAULT_FILTERS } });
    get().loadClips();
  },
  setActivePage: (page: ActivePage) => {
    set({ activePage: page, currentPage: 1 });
    window.clipAPI.updateUIState?.({ activePage: page });
    get().loadClips();
  },
  setSelectedClip: (id: string | null) => {
    set({ selectedClipId: id });
    window.clipAPI.updateUIState?.({ selectedClipId: id });
  },
  setEditingClip: (id: string | null) => set({ editingClipId: id }),
  setSearchInputRef: (ref: React.RefObject<HTMLInputElement> | null) =>
    set({ searchInputRef: ref }),
  setCurrentPage: (page: number) => {
    set({ currentPage: page });
    get().loadClips();
  },
  setPopupSearchVisible: (visible: boolean) =>
    set({ popupSearchVisible: visible }),
  setPopupTagsMenuVisible: (visible: boolean) =>
    set({ popupTagsMenuVisible: visible }),
  setPopupSearchValue: (value: string) => set({ popupSearchValue: value }),
  setIsSearchFocused: (focused: boolean) => set({ isSearchFocused: focused }),
  setIsTagSearchFocused: (focused: boolean) =>
    set({ isTagSearchFocused: focused }),

  toggleTagOnClip: async (clipId: string, tagId: string) => {
    const clip = get().clips.find((c) => c.id === clipId);
    if (!clip) return;
    const newTags = clip.tags.includes(tagId)
      ? clip.tags.filter((t) => t !== tagId)
      : [...clip.tags, tagId];

    const updated = { ...clip, tags: newTags };
    await window.clipAPI.updateClip(updated);
    get().loadClips();
  },
}));

// ─── Derived Selectors ────────────────────────────────────────────────────

export function selectFilteredClips(
  state: ClipStore,
  showDeleted = false,
): ClipboardItem[] {
  // Since clips are already pre-paginated and pre-filtered in the database query,
  // we can simply return the active clips array directly.
  return state.clips;
}

export function selectDeletedClips(state: ClipStore): ClipboardItem[] {
  return state.clips;
}

export function selectFavoriteClips(state: ClipStore): ClipboardItem[] {
  return state.clips;
}
