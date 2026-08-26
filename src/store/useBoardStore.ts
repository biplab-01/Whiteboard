import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import { getIdbItem, setIdbItem, initIdbStorage, getUserStorageKey } from '../lib/idbStorage';

type FolderRow = Database['public']['Tables']['folders']['Row'];
type NotebookRow = Database['public']['Tables']['notebooks']['Row'];
type PageRow = Database['public']['Tables']['pages']['Row'];

export type ToolType = 'select' | 'pan' | 'pen' | 'highlighter' | 'eraser' | 'rectangle' | 'circle' | 'triangle' | 'line' | 'arrow' | 'diamond' | 'star' | 'text';
export type PageBackgroundType = 'solid' | 'gradient' | 'none';
export type PageSizeType = 'a4' | 'letter' | 'legal' | 'a3' | 'a5' | 'tabloid' | 'square';
export type PageOrientationType = 'portrait' | 'landscape';

export const PAGE_SIZES: Record<PageSizeType, { width: number; height: number; label: string; description: string }> = {
  a4: { width: 794, height: 1123, label: 'A4', description: '210 × 297 mm (Standard Document)' },
  letter: { width: 816, height: 1056, label: 'US Letter', description: '8.5 × 11 in (US Standard)' },
  legal: { width: 816, height: 1344, label: 'US Legal', description: '8.5 × 14 in (Legal Document)' },
  a3: { width: 1123, height: 1587, label: 'A3', description: '297 × 420 mm (Large Canvas)' },
  a5: { width: 559, height: 794, label: 'A5', description: '148 × 210 mm (Journal/Notes)' },
  tabloid: { width: 1056, height: 1632, label: 'Tabloid', description: '11 × 17 in (Poster/Ledger)' },
  square: { width: 900, height: 900, label: 'Square', description: '900 × 900 px (Social/Canvas)' },
};

export const getPageDimensions = (size: PageSizeType = 'a4', orientation: PageOrientationType = 'portrait') => {
  const base = PAGE_SIZES[size] || PAGE_SIZES.a4;
  if (orientation === 'landscape') {
    return {
      width: Math.max(base.width, base.height),
      height: Math.min(base.width, base.height),
      label: `${base.label} Landscape`,
    };
  }
  return {
    width: Math.min(base.width, base.height),
    height: Math.max(base.width, base.height),
    label: `${base.label} Portrait`,
  };
};

export interface TextFormat {
  fontFamily: string;
  fontSize: number;
  fill: string;
  textBackgroundColor: string;
  fontWeight: string;
  fontStyle: string;
  underline: boolean;
  linethrough?: boolean;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
}

export interface ShapeFormat {
  type: string;
  stroke: string;
  strokeWidth: number;
  fill: string;
  opacity: number;
}

export interface BgSettings {
  bgType: PageBackgroundType;
  bgColor: string;
  isRuled: boolean;
  ruleColor: string;
  pageSize?: PageSizeType;
  pageOrientation?: PageOrientationType;
  [key: string]: any;
}


export const DEFAULT_BG_SETTINGS: BgSettings = {
  bgType: 'solid',
  bgColor: '#ffffff',
  isRuled: false,
  ruleColor: '#e5e7eb',
  pageSize: 'a4',
  pageOrientation: 'portrait',
};

// UUID generation utility (RFC 4122 v4)
export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const isValidUUID = (id: string | null | undefined): boolean => {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
};

// Unique Client / Tab Session ID to prevent echo loops in realtime subscriptions
export const CLIENT_SESSION_ID = generateUUID();

// Storage keys
export const STORAGE_KEYS = {
  FOLDERS: 'nova_folders',
  NOTEBOOKS: 'nova_notebooks',
  PAGES: 'nova_pages',
  BG_SETTINGS: 'nova_bg_settings',
  PAGE_BG_SETTINGS: 'nova_page_bg_settings',
};

// Extract background and document dimensions from a PageRow object or canvas_data
export const extractBgSettingsFromPage = (page?: PageRow | null): BgSettings => {
  if (!page || !page.canvas_data) return { ...DEFAULT_BG_SETTINGS };

  let data = page.canvas_data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return { ...DEFAULT_BG_SETTINGS };
    }
  }

  if (data && typeof data === 'object' && 'backgroundSettings' in data && data.backgroundSettings) {
    const bs = data.backgroundSettings as any;
    return {
      bgType: bs.bgType || DEFAULT_BG_SETTINGS.bgType,
      bgColor: bs.bgColor || DEFAULT_BG_SETTINGS.bgColor,
      isRuled: typeof bs.isRuled === 'boolean' ? bs.isRuled : DEFAULT_BG_SETTINGS.isRuled,
      ruleColor: bs.ruleColor || DEFAULT_BG_SETTINGS.ruleColor,
      pageSize: bs.pageSize || DEFAULT_BG_SETTINGS.pageSize,
      pageOrientation: bs.pageOrientation || DEFAULT_BG_SETTINGS.pageOrientation,
    };
  }

  return { ...DEFAULT_BG_SETTINGS };
};

export const getPageBackgroundSettings = (pageId?: string | null): BgSettings => {
  if (!pageId) return { ...DEFAULT_BG_SETTINGS };
  const page = useBoardStore.getState().pages.find((p) => p.id === pageId);
  return extractBgSettingsFromPage(page);
};

export interface BoardState {
  // Library Data
  folders: FolderRow[];
  notebooks: NotebookRow[];
  activeNotebookId: string | null;
  activeUserId: string | null;
  loading: boolean;
  isSyncing: boolean;
  syncStatusText: string | null;

  // Library Actions
  fetchLibrary: (userId: string) => Promise<void>;
  syncAllNotebooks: (userId: string) => Promise<void>;
  createFolder: (name: string, userId: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  createNotebook: (name: string, folderId: string | null, userId: string) => Promise<string>;
  createNotebookWithPages: (name: string, folderId: string | null, userId: string, pages: { canvasData: string; name?: string }[]) => Promise<string>;
  renameNotebook: (id: string, name: string) => Promise<void>;
  deleteNotebook: (id: string) => Promise<void>;
  moveNotebook: (notebookId: string, folderId: string | null) => Promise<void>;
  openNotebook: (id: string) => Promise<void>;
  closeNotebook: () => void;

  // Realtime Cloud Handlers
  handleRealtimeFolderChange: (payload: any) => void;
  handleRealtimeNotebookChange: (payload: any) => void;
  handleRealtimePageChange: (payload: any) => void;

  // Pages (for active notebook)
  pages: PageRow[];
  currentPageId: string | null;
  addPage: (userId: string) => Promise<void>;
  removePage: (id: string) => Promise<void>;
  switchPage: (id: string, currentCanvasData?: string) => Promise<void>;
  updatePageData: (id: string, canvasData: string) => Promise<void>;
  importPdfPages: (pdfPages: { canvasData: string; name: string }[], afterPageId: string | null, userId: string) => Promise<void>;

  // Background & Page Size Settings
  bgType: PageBackgroundType;
  bgColor: string;
  isRuled: boolean;
  ruleColor: string;
  pageSize: PageSizeType;
  pageOrientation: PageOrientationType;
  setBgType: (type: PageBackgroundType) => void;
  setBgColor: (color: string) => void;
  setIsRuled: (ruled: boolean) => void;
  setRuleColor: (color: string) => void;
  setPageSize: (size: PageSizeType) => void;
  setPageOrientation: (orientation: PageOrientationType) => void;

  // Tools & Styling
  currentTool: ToolType;
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  opacity: number;
  eraserMode: 'partial' | 'whole';
  eraserSize: number;
  setCurrentTool: (tool: ToolType) => void;
  setStrokeColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setFillColor: (color: string) => void;
  setOpacity: (opacity: number) => void;
  setEraserMode: (mode: 'partial' | 'whole') => void;
  setEraserSize: (size: number) => void;

  // Text & Shape Formatting
  activeTextFormat: TextFormat | null;
  setActiveTextFormat: (format: TextFormat | null) => void;
  activeShapeFormat: ShapeFormat | null;
  setActiveShapeFormat: (format: ShapeFormat | null) => void;

  // Text Tool Preferences (Persisted across new textboxes)
  lastTextSize: number;
  lastFontFamily: string;
  lastTextColor: string;
  setLastTextSize: (size: number) => void;
  setLastFontFamily: (font: string) => void;
  setLastTextColor: (color: string) => void;

  // History / Undo & Redo
  canUndo: boolean;
  canRedo: boolean;
  setCanUndo: (canUndo: boolean) => void;
  setCanRedo: (canRedo: boolean) => void;
  undo: () => void;
  redo: () => void;

  // Theme
  isDarkMode: boolean;
  toggleTheme: () => void;
}

// Debounced page save timer dictionary
const pageSaveTimers: Record<string, any> = {};

// Background sync hydration at boot
if (typeof window !== 'undefined') {
  initIdbStorage([
    STORAGE_KEYS.FOLDERS,
    STORAGE_KEYS.NOTEBOOKS,
    STORAGE_KEYS.PAGES,
    STORAGE_KEYS.PAGE_BG_SETTINGS,
    STORAGE_KEYS.BG_SETTINGS,
  ]);
}

export const useBoardStore = create<BoardState>((set, get) => ({
  folders: [],
  notebooks: [],
  activeNotebookId: null,
  activeUserId: null,
  pages: [],
  currentPageId: null,
  loading: false,
  isSyncing: false,
  syncStatusText: null,

  bgType: DEFAULT_BG_SETTINGS.bgType,
  bgColor: DEFAULT_BG_SETTINGS.bgColor,
  isRuled: DEFAULT_BG_SETTINGS.isRuled,
  ruleColor: DEFAULT_BG_SETTINGS.ruleColor,
  pageSize: DEFAULT_BG_SETTINGS.pageSize || 'a4',
  pageOrientation: DEFAULT_BG_SETTINGS.pageOrientation || 'portrait',

  fetchLibrary: async (userId: string) => {
    set({ activeUserId: userId, isSyncing: false, syncStatusText: null });

    const foldersKey = getUserStorageKey(userId, STORAGE_KEYS.FOLDERS);
    const notebooksKey = getUserStorageKey(userId, STORAGE_KEYS.NOTEBOOKS);

    // Immediate local state hydration from user-scoped cache
    const cachedFolders = (await getIdbItem<FolderRow[]>(foldersKey, [])) || [];
    const cachedNotebooks = (await getIdbItem<NotebookRow[]>(notebooksKey, [])) || [];
    set({ folders: cachedFolders, notebooks: cachedNotebooks });
  },

  syncAllNotebooks: async (userId: string) => {
    const isAuthUser = isValidUUID(userId);
    set({ isSyncing: true, syncStatusText: 'Syncing all notebooks...' });

    if (!isAuthUser) {
      set({ isSyncing: false, syncStatusText: 'Local storage (Sign in to sync)' });
      setTimeout(() => set({ syncStatusText: null }), 3000);
      return;
    }

    try {
      const foldersKey = getUserStorageKey(userId, STORAGE_KEYS.FOLDERS);
      const notebooksKey = getUserStorageKey(userId, STORAGE_KEYS.NOTEBOOKS);
      const pagesKey = getUserStorageKey(userId, STORAGE_KEYS.PAGES);

      const localFolders = (await getIdbItem<FolderRow[]>(foldersKey, [])) || [];
      const localNotebooks = (await getIdbItem<NotebookRow[]>(notebooksKey, [])) || [];
      const localPages = (await getIdbItem<PageRow[]>(pagesKey, [])) || [];

      // 1. Push local folders to Supabase
      for (const f of localFolders) {
        await supabase.from('folders').upsert({
          id: f.id,
          name: f.name,
          user_id: userId,
          created_at: f.created_at || new Date().toISOString(),
        });
      }

      // 2. Push local notebooks to Supabase
      for (const nb of localNotebooks) {
        await supabase.from('notebooks').upsert({
          id: nb.id,
          name: nb.name,
          folder_id: nb.folder_id,
          user_id: userId,
          created_at: nb.created_at || new Date().toISOString(),
          updated_at: nb.updated_at || new Date().toISOString(),
        });
      }

      // 3. Push local pages to Supabase
      const validPages = localPages.filter((p) => p.notebook_id && isValidUUID(p.notebook_id));
      if (validPages.length > 0) {
        await Promise.all(
          validPages.map((p) => {
            let formattedData = p.canvas_data;
            if (typeof formattedData === 'string') {
              try {
                formattedData = JSON.parse(formattedData);
              } catch {}
            }
            return supabase.from('pages').upsert({
              id: p.id,
              notebook_id: p.notebook_id,
              user_id: userId,
              name: p.name,
              order_index: p.order_index,
              canvas_data: formattedData,
              created_at: p.created_at || new Date().toISOString(),
              updated_at: p.updated_at || new Date().toISOString(),
            });
          })
        );
      }

      // 4. Fetch all remote records from Supabase
      const [foldersRes, notebooksRes, pagesRes] = await Promise.all([
        supabase.from('folders').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
        supabase.from('notebooks').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('pages').select('*').eq('user_id', userId).order('order_index', { ascending: true }),
      ]);

      const remoteFolders = foldersRes.data || [];
      const remoteNotebooks = notebooksRes.data || [];
      const remotePages = pagesRes.data || [];

      // Merge remote and local maps
      const foldersMap = new Map<string, FolderRow>();
      remoteFolders.forEach((f) => foldersMap.set(f.id, f));
      localFolders.forEach((f) => { if (!foldersMap.has(f.id)) foldersMap.set(f.id, f); });
      const mergedFolders = Array.from(foldersMap.values());

      const notebooksMap = new Map<string, NotebookRow>();
      remoteNotebooks.forEach((n) => notebooksMap.set(n.id, n));
      localNotebooks.forEach((n) => { if (!notebooksMap.has(n.id)) notebooksMap.set(n.id, n); });
      const mergedNotebooks = Array.from(notebooksMap.values());

      const pagesMap = new Map<string, PageRow>();
      remotePages.forEach((p) => pagesMap.set(p.id, p));
      localPages.forEach((p) => { if (!pagesMap.has(p.id)) pagesMap.set(p.id, p); });
      const mergedPages = Array.from(pagesMap.values());

      set({
        folders: mergedFolders,
        notebooks: mergedNotebooks,
        isSyncing: false,
        syncStatusText: `Synced all ${mergedNotebooks.length} notebooks`,
      });

      await Promise.all([
        setIdbItem(foldersKey, mergedFolders),
        setIdbItem(notebooksKey, mergedNotebooks),
        setIdbItem(pagesKey, mergedPages),
      ]);

      setTimeout(() => set({ syncStatusText: null }), 3000);
    } catch (err) {
      console.warn('Sync all notebooks error:', err);
      set({ isSyncing: false, syncStatusText: 'Sync failed (offline)' });
      setTimeout(() => set({ syncStatusText: null }), 3000);
    }
  },


  createFolder: async (name: string, userId: string) => {
    const folderId = generateUUID();
    const newFolder: FolderRow = {
      id: folderId,
      name: name.trim() || 'New Folder',
      user_id: userId,
      created_at: new Date().toISOString(),
    };

    const updatedFolders = [...get().folders, newFolder];
    set({ folders: updatedFolders });

    const foldersKey = getUserStorageKey(userId, STORAGE_KEYS.FOLDERS);
    await setIdbItem(foldersKey, updatedFolders);
  },

  deleteFolder: async (folderId: string) => {
    const { folders, notebooks, activeUserId } = get();
    const updatedFolders = folders.filter((f) => f.id !== folderId);
    const updatedNotebooks = notebooks.map((n) => (n.folder_id === folderId ? { ...n, folder_id: null } : n));

    set({ folders: updatedFolders, notebooks: updatedNotebooks });

    const foldersKey = getUserStorageKey(activeUserId, STORAGE_KEYS.FOLDERS);
    const notebooksKey = getUserStorageKey(activeUserId, STORAGE_KEYS.NOTEBOOKS);
    await Promise.all([setIdbItem(foldersKey, updatedFolders), setIdbItem(notebooksKey, updatedNotebooks)]);
  },

  createNotebook: async (name: string, folderId: string | null, userId: string) => {
    const notebookId = generateUUID();
    const validFolderId = folderId && isValidUUID(folderId) ? folderId : null;
    const now = new Date().toISOString();

    const newNotebook: NotebookRow = {
      id: notebookId,
      name: name.trim() || 'Untitled Notebook',
      folder_id: validFolderId,
      user_id: userId,
      created_at: now,
      updated_at: now,
    };

    const updatedNotebooks = [newNotebook, ...get().notebooks];
    set({ notebooks: updatedNotebooks, activeUserId: userId });

    const notebooksKey = getUserStorageKey(userId, STORAGE_KEYS.NOTEBOOKS);
    await setIdbItem(notebooksKey, updatedNotebooks);

    // Prepare default Page 1
    const defaultPageId = generateUUID();
    const defaultBg = { ...DEFAULT_BG_SETTINGS };
    const defaultPage: PageRow = {
      id: defaultPageId,
      notebook_id: notebookId,
      user_id: userId,
      name: 'Page 1',
      order_index: 0,
      canvas_data: {
        objects: [],
        backgroundSettings: defaultBg,
        _clientId: CLIENT_SESSION_ID,
      },
      created_at: now,
      updated_at: now,
    };

    const pagesKey = getUserStorageKey(userId, STORAGE_KEYS.PAGES);
    const allPages = (await getIdbItem<PageRow[]>(pagesKey, [])) || [];
    await setIdbItem(pagesKey, [...allPages, defaultPage]);

    return notebookId;
  },

  createNotebookWithPages: async (name: string, folderId: string | null, userId: string, pages: { canvasData: string; name?: string }[]) => {
    const notebookId = generateUUID();
    const validFolderId = folderId && isValidUUID(folderId) ? folderId : null;
    const now = new Date().toISOString();

    const newNotebook: NotebookRow = {
      id: notebookId,
      name: name.trim() || 'Imported Document',
      folder_id: validFolderId,
      user_id: userId,
      created_at: now,
      updated_at: now,
    };

    const updatedNotebooks = [newNotebook, ...get().notebooks];
    set({ notebooks: updatedNotebooks, activeUserId: userId });

    const notebooksKey = getUserStorageKey(userId, STORAGE_KEYS.NOTEBOOKS);
    await setIdbItem(notebooksKey, updatedNotebooks);

    const defaultBg: BgSettings = {
      bgType: 'none',
      bgColor: 'transparent',
      isRuled: false,
      ruleColor: '#e2e8f0',
      pageSize: 'a4',
      pageOrientation: 'portrait',
    };

    const createdPages: PageRow[] = (pages.length > 0 ? pages : [{ canvasData: '', name: 'Page 1' }]).map((p, idx) => {
      let formattedData: any = p.canvasData;
      if (typeof p.canvasData === 'string' && p.canvasData.trim()) {
        try {
          formattedData = JSON.parse(p.canvasData);
        } catch {
          formattedData = { objects: [] };
        }
      } else if (!formattedData || typeof formattedData !== 'object') {
        formattedData = { objects: [] };
      }
      formattedData.backgroundSettings = defaultBg;
      formattedData._clientId = CLIENT_SESSION_ID;

      return {
        id: generateUUID(),
        notebook_id: notebookId,
        user_id: userId,
        name: p.name || `Page ${idx + 1}`,
        order_index: idx,
        canvas_data: formattedData,
        created_at: now,
        updated_at: now,
      };
    });

    const pagesKey = getUserStorageKey(userId, STORAGE_KEYS.PAGES);
    const allPages = (await getIdbItem<PageRow[]>(pagesKey, [])) || [];
    await setIdbItem(pagesKey, [...allPages, ...createdPages]);

    return notebookId;
  },

  renameNotebook: async (id: string, name: string) => {
    const cleanName = name.trim() || 'Untitled Notebook';
    const now = new Date().toISOString();
    const { notebooks, activeUserId } = get();

    const updated = notebooks.map((n) => (n.id === id ? { ...n, name: cleanName, updated_at: now } : n));
    set({ notebooks: updated });

    const notebooksKey = getUserStorageKey(activeUserId, STORAGE_KEYS.NOTEBOOKS);
    await setIdbItem(notebooksKey, updated);
  },

  deleteNotebook: async (id: string) => {
    const { notebooks, activeNotebookId, activeUserId } = get();
    const updated = notebooks.filter((n) => n.id !== id);
    set({ notebooks: updated });

    if (activeNotebookId === id) {
      set({ activeNotebookId: null, pages: [], currentPageId: null });
    }

    const notebooksKey = getUserStorageKey(activeUserId, STORAGE_KEYS.NOTEBOOKS);
    const pagesKey = getUserStorageKey(activeUserId, STORAGE_KEYS.PAGES);

    const allPages = (await getIdbItem<PageRow[]>(pagesKey, [])) || [];
    const prunedPages = allPages.filter((p) => p.notebook_id !== id);

    await Promise.all([setIdbItem(notebooksKey, updated), setIdbItem(pagesKey, prunedPages)]);
  },

  moveNotebook: async (notebookId: string, folderId: string | null) => {
    const validFolderId = folderId && isValidUUID(folderId) ? folderId : null;
    const { notebooks, activeUserId } = get();

    const updated = notebooks.map((n) => (n.id === notebookId ? { ...n, folder_id: validFolderId } : n));
    set({ notebooks: updated });

    const notebooksKey = getUserStorageKey(activeUserId, STORAGE_KEYS.NOTEBOOKS);
    await setIdbItem(notebooksKey, updated);
  },

  openNotebook: async (id: string, customUserId?: string) => {
    const currentUserId = customUserId || get().activeUserId || localStorage.getItem('nova_guest_id') || 'guest';
    const isAuthUser = isValidUUID(currentUserId);
    const pagesKey = getUserStorageKey(currentUserId, STORAGE_KEYS.PAGES);

    // CRITICAL: Immediately clear stale pages and lock on new notebook ID to prevent any visual or data cross-contamination
    set({
      activeNotebookId: id,
      activeUserId: currentUserId,
      pages: [],
      currentPageId: null,
      loading: true,
    });

    // Step 1: Instant local render from IndexedDB cache
    const cachedAllPages = (await getIdbItem<PageRow[]>(pagesKey, [])) || [];
    let localPages = cachedAllPages.filter((p) => p.notebook_id === id).sort((a, b) => a.order_index - b.order_index);

    if (localPages.length > 0) {
      const firstPage = localPages[0];
      const bg = extractBgSettingsFromPage(firstPage);

      set({
        pages: localPages,
        currentPageId: firstPage.id,
        bgType: bg.bgType,
        bgColor: bg.bgColor,
        isRuled: bg.isRuled,
        ruleColor: bg.ruleColor,
        pageSize: bg.pageSize || 'a4',
        pageOrientation: bg.pageOrientation || 'portrait',
        loading: false,
      });
      return;
    }

    // Step 2: Query authoritative pages from Supabase only if not found locally
    if (isValidUUID(id) && isAuthUser) {
      try {
        const res = await supabase.from('pages').select('*').eq('notebook_id', id).order('order_index', { ascending: true });
        const remotePages = res.data || [];

        if (remotePages.length > 0) {
          if (get().activeNotebookId === id) {
            const firstRemotePage = remotePages[0];
            const bg = extractBgSettingsFromPage(firstRemotePage);

            set({
              pages: remotePages,
              currentPageId: firstRemotePage.id,
              bgType: bg.bgType,
              bgColor: bg.bgColor,
              isRuled: bg.isRuled,
              ruleColor: bg.ruleColor,
              pageSize: bg.pageSize || 'a4',
              pageOrientation: bg.pageOrientation || 'portrait',
              loading: false,
            });
          }

          // Sync user-scoped IDB cache
          const freshAllPages = (await getIdbItem<PageRow[]>(pagesKey, [])) || [];
          const otherPages = freshAllPages.filter((p) => p.notebook_id !== id);
          await setIdbItem(pagesKey, [...otherPages, ...remotePages]);
          return;
        }
      } catch (err) {
        console.warn('Supabase openNotebook fetch error:', err);
      }
    }

    // Step 3: If no pages exist at all for this notebook (brand new notebook or offline), create default Page 1
    if (get().activeNotebookId === id && get().pages.length === 0) {
      const newPageId = generateUUID();
      const now = new Date().toISOString();
      const defaultBg = { ...DEFAULT_BG_SETTINGS };

      const newPage: PageRow = {
        id: newPageId,
        notebook_id: id,
        user_id: currentUserId,
        name: 'Page 1',
        order_index: 0,
        canvas_data: {
          objects: [],
          backgroundSettings: defaultBg,
          _clientId: CLIENT_SESSION_ID,
        },
        created_at: now,
        updated_at: now,
      };

      set({
        pages: [newPage],
        currentPageId: newPageId,
        bgType: defaultBg.bgType,
        bgColor: defaultBg.bgColor,
        isRuled: defaultBg.isRuled,
        ruleColor: defaultBg.ruleColor,
        pageSize: defaultBg.pageSize || 'a4',
        pageOrientation: defaultBg.pageOrientation || 'portrait',
        loading: false,
      });

      const freshAllPages = (await getIdbItem<PageRow[]>(pagesKey, [])) || [];
      const otherPages = freshAllPages.filter((p) => p.notebook_id !== id);
      await setIdbItem(pagesKey, [...otherPages, newPage]);

      if (isAuthUser) {
        try {
          await supabase.from('pages').insert({
            id: newPageId,
            notebook_id: id,
            user_id: currentUserId,
            name: 'Page 1',
            order_index: 0,
            canvas_data: newPage.canvas_data,
            created_at: now,
            updated_at: now,
          });
        } catch (e) {
          console.warn('Error inserting default page:', e);
        }
      }
    } else {
      set({ loading: false });
    }
  },

  closeNotebook: () => {
    // Clear any pending debounced timers
    Object.keys(pageSaveTimers).forEach((key) => {
      clearTimeout(pageSaveTimers[key]);
      delete pageSaveTimers[key];
    });
    set({ activeNotebookId: null, pages: [], currentPageId: null, loading: false });
  },

  // Realtime Handlers for Cloud Events
  handleRealtimeFolderChange: (payload: any) => {
    const { eventType, new: newRow, old: oldRow } = payload;
    const { folders, notebooks, activeUserId } = get();
    const foldersKey = getUserStorageKey(activeUserId, STORAGE_KEYS.FOLDERS);

    if (eventType === 'INSERT' && newRow) {
      if (!folders.some((f) => f.id === newRow.id)) {
        const updated = [...folders, newRow as FolderRow];
        set({ folders: updated });
        setIdbItem(foldersKey, updated);
      }
    } else if (eventType === 'UPDATE' && newRow) {
      const updated = folders.map((f) => (f.id === newRow.id ? (newRow as FolderRow) : f));
      set({ folders: updated });
      setIdbItem(foldersKey, updated);
    } else if (eventType === 'DELETE' && oldRow) {
      const updatedFolders = folders.filter((f) => f.id !== oldRow.id);
      const updatedNotebooks = notebooks.map((n) => (n.folder_id === oldRow.id ? { ...n, folder_id: null } : n));
      set({ folders: updatedFolders, notebooks: updatedNotebooks });
      setIdbItem(foldersKey, updatedFolders);
    }
  },

  handleRealtimeNotebookChange: (payload: any) => {
    const { eventType, new: newRow, old: oldRow } = payload;
    const { notebooks, activeNotebookId, activeUserId } = get();
    const notebooksKey = getUserStorageKey(activeUserId, STORAGE_KEYS.NOTEBOOKS);
    const pagesKey = getUserStorageKey(activeUserId, STORAGE_KEYS.PAGES);

    if (eventType === 'INSERT' && newRow) {
      if (!notebooks.some((n) => n.id === newRow.id)) {
        const updated = [newRow as NotebookRow, ...notebooks];
        set({ notebooks: updated });
        setIdbItem(notebooksKey, updated);
      }
    } else if (eventType === 'UPDATE' && newRow) {
      const updated = notebooks.map((n) => (n.id === newRow.id ? (newRow as NotebookRow) : n));
      set({ notebooks: updated });
      setIdbItem(notebooksKey, updated);
    } else if (eventType === 'DELETE' && oldRow) {
      const updated = notebooks.filter((n) => n.id !== oldRow.id);
      set({ notebooks: updated });
      setIdbItem(notebooksKey, updated);

      // Purge local pages for deleted notebook
      getIdbItem<PageRow[]>(pagesKey, []).then((allPages) => {
        if (allPages) {
          const pruned = allPages.filter((p) => p.notebook_id !== oldRow.id);
          setIdbItem(pagesKey, pruned);
        }
      });

      // If active notebook was deleted on another device, close it
      if (activeNotebookId === oldRow.id) {
        set({ activeNotebookId: null, pages: [], currentPageId: null });
      }
    }
  },

  handleRealtimePageChange: (payload: any) => {
    const { eventType, new: newRow, old: oldRow } = payload;
    const { activeNotebookId, pages, currentPageId, activeUserId } = get();
    const pagesKey = getUserStorageKey(activeUserId, STORAGE_KEYS.PAGES);

    if (eventType === 'INSERT' && newRow) {
      if (newRow.notebook_id === activeNotebookId && !pages.some((p) => p.id === newRow.id)) {
        const updated = [...pages, newRow as PageRow].sort((a, b) => a.order_index - b.order_index);
        set({ pages: updated });

        getIdbItem<PageRow[]>(pagesKey, []).then((allPages) => {
          const safePages = allPages || [];
          if (!safePages.some((p) => p.id === newRow.id)) {
            setIdbItem(pagesKey, [...safePages, newRow as PageRow]);
          }
        });
      }
    } else if (eventType === 'UPDATE' && newRow) {
      if (newRow.notebook_id === activeNotebookId) {
        // Prevent self-echo if this client authored the update
        const isSelf = newRow.canvas_data && (newRow.canvas_data as any)._clientId === CLIENT_SESSION_ID;

        const updatedPages = pages.map((p) => (p.id === newRow.id ? (newRow as PageRow) : p));
        set({ pages: updatedPages });

        getIdbItem<PageRow[]>(pagesKey, []).then((allPages) => {
          const safePages = allPages || [];
          const updatedAll = safePages.map((p) => (p.id === newRow.id ? (newRow as PageRow) : p));
          setIdbItem(pagesKey, updatedAll);
        });

        if (!isSelf && newRow.id === currentPageId) {
          const bg = extractBgSettingsFromPage(newRow as PageRow);
          set({
            bgType: bg.bgType,
            bgColor: bg.bgColor,
            isRuled: bg.isRuled,
            ruleColor: bg.ruleColor,
            pageSize: bg.pageSize || 'a4',
            pageOrientation: bg.pageOrientation || 'portrait',
          });

          // Notify canvas component to update
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('remote-page-update', { detail: newRow }));
          }
        }
      }
    } else if (eventType === 'DELETE' && oldRow) {
      const updatedPages = pages.filter((p) => p.id !== oldRow.id);
      const newCurrentPageId = currentPageId === oldRow.id ? updatedPages[0]?.id || null : currentPageId;

      set({ pages: updatedPages, currentPageId: newCurrentPageId });

      getIdbItem<PageRow[]>(pagesKey, []).then((allPages) => {
        if (allPages) {
          const updatedAll = allPages.filter((p) => p.id !== oldRow.id);
          setIdbItem(pagesKey, updatedAll);
        }
      });
    }
  },

  addPage: async (userId: string) => {
    const { activeNotebookId, pages, bgType, bgColor, isRuled, ruleColor, pageSize, pageOrientation } = get();
    if (!activeNotebookId) return;

    const newPageId = generateUUID();
    const now = new Date().toISOString();
    const currentBg: BgSettings = { bgType, bgColor, isRuled, ruleColor, pageSize, pageOrientation };

    const newPage: PageRow = {
      id: newPageId,
      notebook_id: activeNotebookId,
      user_id: userId,
      name: `Page ${pages.length + 1}`,
      order_index: pages.length,
      canvas_data: {
        objects: [],
        backgroundSettings: currentBg,
        _clientId: CLIENT_SESSION_ID,
      },
      created_at: now,
      updated_at: now,
    };

    const updatedPages = [...pages, newPage];
    set({ pages: updatedPages, currentPageId: newPage.id });

    const pagesKey = getUserStorageKey(userId, STORAGE_KEYS.PAGES);
    const allPages = (await getIdbItem<PageRow[]>(pagesKey, [])) || [];
    await setIdbItem(pagesKey, [...allPages, newPage]);
  },

  removePage: async (id: string) => {
    const { pages, currentPageId, activeUserId } = get();
    if (pages.length <= 1) return; // Retain at least 1 page

    const newPages = pages.filter((p) => p.id !== id);
    const newCurrentPageId = currentPageId === id ? newPages[newPages.length - 1].id : currentPageId;

    set({ pages: newPages, currentPageId: newCurrentPageId });

    const pagesKey = getUserStorageKey(activeUserId, STORAGE_KEYS.PAGES);
    const allPages = (await getIdbItem<PageRow[]>(pagesKey, [])) || [];
    await setIdbItem(pagesKey, allPages.filter((p) => p.id !== id));
  },

  switchPage: async (id: string, currentCanvasData?: string) => {
    const { currentPageId, pages } = get();
    if (currentPageId && currentCanvasData !== undefined && currentCanvasData !== '') {
      await get().updatePageData(currentPageId, currentCanvasData);
    }

    const targetPage = pages.find((p) => p.id === id);
    const bg = extractBgSettingsFromPage(targetPage);

    set({
      currentPageId: id,
      bgType: bg.bgType,
      bgColor: bg.bgColor,
      isRuled: bg.isRuled,
      ruleColor: bg.ruleColor,
      pageSize: bg.pageSize || 'a4',
      pageOrientation: bg.pageOrientation || 'portrait',
    });
  },

  updatePageData: async (id: string, canvasData: string) => {
    const { bgType, bgColor, isRuled, ruleColor, pageSize, pageOrientation, activeUserId } = get();
    const currentBg: BgSettings = { bgType, bgColor, isRuled, ruleColor, pageSize, pageOrientation };

    let formattedData: any;
    if (typeof canvasData === 'string' && canvasData.trim()) {
      try {
        formattedData = JSON.parse(canvasData);
      } catch {
        formattedData = { objects: [] };
      }
    } else if (canvasData && typeof canvasData === 'object') {
      formattedData = canvasData;
    } else {
      formattedData = { objects: [] };
    }

    formattedData.backgroundSettings = currentBg;
    formattedData._clientId = CLIENT_SESSION_ID;
    formattedData._clientTimestamp = Date.now();

    const now = new Date().toISOString();
    const updatedPages = get().pages.map((p) => (p.id === id ? { ...p, canvas_data: formattedData, updated_at: now } : p));
    set({ pages: updatedPages });

    const pagesKey = getUserStorageKey(activeUserId, STORAGE_KEYS.PAGES);
    const allPages = (await getIdbItem<PageRow[]>(pagesKey, [])) || [];
    const updatedAllPages = allPages.map((p) => (p.id === id ? { ...p, canvas_data: formattedData, updated_at: now } : p));
    if (!updatedAllPages.some((p) => p.id === id)) {
      const pToAdd = updatedPages.find((p) => p.id === id);
      if (pToAdd) updatedAllPages.push(pToAdd);
    }
    await setIdbItem(pagesKey, updatedAllPages);
  },

  importPdfPages: async (pdfPages: { canvasData: string; name: string }[], afterPageId: string | null, userId: string) => {
    const { activeNotebookId, pages, pageSize, pageOrientation } = get();
    if (!activeNotebookId || pdfPages.length === 0) return;

    const currentIndex = pages.findIndex((p) => p.id === afterPageId);
    const insertIndex = currentIndex >= 0 ? currentIndex + 1 : pages.length;
    const now = new Date().toISOString();

    const defaultBg: BgSettings = {
      bgType: 'none',
      bgColor: 'transparent',
      isRuled: false,
      ruleColor: '#e2e8f0',
      pageSize,
      pageOrientation,
    };

    const newCreatedPages: PageRow[] = pdfPages.map((item, idx) => {
      let formattedData: any = item.canvasData;
      if (typeof item.canvasData === 'string') {
        try {
          formattedData = JSON.parse(item.canvasData);
        } catch {
          formattedData = { objects: [] };
        }
      }
      if (!formattedData || typeof formattedData !== 'object') {
        formattedData = { objects: [] };
      }
      formattedData.backgroundSettings = defaultBg;
      formattedData._clientId = CLIENT_SESSION_ID;

      return {
        id: generateUUID(),
        notebook_id: activeNotebookId,
        user_id: userId,
        name: item.name || `Page ${pages.length + idx + 1}`,
        order_index: insertIndex + idx,
        canvas_data: formattedData,
        created_at: now,
        updated_at: now,
      };
    });

    const isOnlyBlankPage = pages.length === 1 && (
      !pages[0].canvas_data || 
      (typeof pages[0].canvas_data === 'object' && (!(pages[0].canvas_data as any).objects || (pages[0].canvas_data as any).objects.length === 0)) ||
      (typeof pages[0].canvas_data === 'string' && (pages[0].canvas_data === '{"objects":[]}' || pages[0].canvas_data === ''))
    );

    let combined: PageRow[];
    if (isOnlyBlankPage) {
      combined = newCreatedPages.map((p, idx) => ({
        ...p,
        order_index: idx,
        name: `Page ${idx + 1}`,
      }));
    } else {
      const currentIndex = pages.findIndex((p) => p.id === afterPageId);
      const insertIndex = currentIndex >= 0 ? currentIndex + 1 : pages.length;
      combined = [
        ...pages.slice(0, insertIndex),
        ...newCreatedPages,
        ...pages.slice(insertIndex),
      ].map((p, idx) => ({
        ...p,
        order_index: idx,
        name: `Page ${idx + 1}`,
      }));
    }

    const firstNewPageId = newCreatedPages[0].id;
    set({
      pages: combined,
      currentPageId: firstNewPageId,
      bgType: defaultBg.bgType,
      bgColor: defaultBg.bgColor,
      isRuled: defaultBg.isRuled,
      ruleColor: defaultBg.ruleColor,
      pageSize: defaultBg.pageSize || 'a4',
      pageOrientation: defaultBg.pageOrientation || 'portrait',
    });

    const pagesKey = getUserStorageKey(userId, STORAGE_KEYS.PAGES);
    const allPages = (await getIdbItem<PageRow[]>(pagesKey, [])) || [];
    const otherNotebookPages = allPages.filter((p) => p.notebook_id !== activeNotebookId);
    await setIdbItem(pagesKey, [...otherNotebookPages, ...combined]);
  },

  setBgType: (type) => {
    set({ bgType: type });
    const { currentPageId, pages } = get();
    if (currentPageId) {
      const curPage = pages.find((p) => p.id === currentPageId);
      const rawData = curPage?.canvas_data ? JSON.stringify(curPage.canvas_data) : JSON.stringify({ objects: [] });
      get().updatePageData(currentPageId, rawData);
    }
  },

  setBgColor: (color) => {
    set({ bgColor: color });
    const { currentPageId, pages } = get();
    if (currentPageId) {
      const curPage = pages.find((p) => p.id === currentPageId);
      const rawData = curPage?.canvas_data ? JSON.stringify(curPage.canvas_data) : JSON.stringify({ objects: [] });
      get().updatePageData(currentPageId, rawData);
    }
  },

  setIsRuled: (ruled) => {
    set({ isRuled: ruled });
    const { currentPageId, pages } = get();
    if (currentPageId) {
      const curPage = pages.find((p) => p.id === currentPageId);
      const rawData = curPage?.canvas_data ? JSON.stringify(curPage.canvas_data) : JSON.stringify({ objects: [] });
      get().updatePageData(currentPageId, rawData);
    }
  },

  setRuleColor: (color) => {
    set({ ruleColor: color });
    const { currentPageId, pages } = get();
    if (currentPageId) {
      const curPage = pages.find((p) => p.id === currentPageId);
      const rawData = curPage?.canvas_data ? JSON.stringify(curPage.canvas_data) : JSON.stringify({ objects: [] });
      get().updatePageData(currentPageId, rawData);
    }
  },

  setPageSize: (size) => {
    set({ pageSize: size });
    const { currentPageId, pages } = get();
    if (currentPageId) {
      const curPage = pages.find((p) => p.id === currentPageId);
      const rawData = curPage?.canvas_data ? JSON.stringify(curPage.canvas_data) : JSON.stringify({ objects: [] });
      get().updatePageData(currentPageId, rawData);
    }
  },

  setPageOrientation: (orientation) => {
    set({ pageOrientation: orientation });
    const { currentPageId, pages } = get();
    if (currentPageId) {
      const curPage = pages.find((p) => p.id === currentPageId);
      const rawData = curPage?.canvas_data ? JSON.stringify(curPage.canvas_data) : JSON.stringify({ objects: [] });
      get().updatePageData(currentPageId, rawData);
    }
  },

  currentTool: 'pen',
  strokeColor: '#3b82f6',
  strokeWidth: 3,
  fillColor: 'transparent',
  opacity: 1,
  eraserMode: 'partial',
  eraserSize: 20,
  setCurrentTool: (tool) => set({ currentTool: tool }),
  setStrokeColor: (color) => set({ strokeColor: color }),
  setStrokeWidth: (width) => set({ strokeWidth: width }),
  setFillColor: (color) => set({ fillColor: color }),
  setOpacity: (opacity) => set({ opacity }),
  setEraserMode: (mode) => set({ eraserMode: mode }),
  setEraserSize: (size) => set({ eraserSize: size }),

  activeTextFormat: null,
  setActiveTextFormat: (format) => set({ activeTextFormat: format }),
  activeShapeFormat: null,
  setActiveShapeFormat: (format) => set({ activeShapeFormat: format }),

  lastTextSize: typeof window !== 'undefined' && localStorage.getItem('nova_last_text_size')
    ? Math.max(8, parseInt(localStorage.getItem('nova_last_text_size')!) || 24)
    : 24,
  lastFontFamily: typeof window !== 'undefined' && localStorage.getItem('nova_last_font_family')
    ? localStorage.getItem('nova_last_font_family')!
    : 'Inter',
  lastTextColor: typeof window !== 'undefined' && localStorage.getItem('nova_last_text_color')
    ? localStorage.getItem('nova_last_text_color')!
    : '',

  setLastTextSize: (size: number) => {
    const validSize = Math.max(8, Math.min(240, size));
    set({ lastTextSize: validSize });
    if (typeof window !== 'undefined') {
      localStorage.setItem('nova_last_text_size', validSize.toString());
    }
  },
  setLastFontFamily: (font: string) => {
    set({ lastFontFamily: font });
    if (typeof window !== 'undefined') {
      localStorage.setItem('nova_last_font_family', font);
    }
  },
  setLastTextColor: (color: string) => {
    set({ lastTextColor: color });
    if (typeof window !== 'undefined') {
      localStorage.setItem('nova_last_text_color', color);
    }
  },

  canUndo: false,
  canRedo: false,
  setCanUndo: (canUndo) => set({ canUndo }),
  setCanRedo: (canRedo) => set({ canRedo }),
  undo: () => {
    window.dispatchEvent(new CustomEvent('board-undo'));
  },
  redo: () => {
    window.dispatchEvent(new CustomEvent('board-redo'));
  },

  isDarkMode: true,
  toggleTheme: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
}));
