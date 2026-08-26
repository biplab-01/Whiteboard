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
    const isAuthUser = isValidUUID(userId);
    set({ activeUserId: userId, isSyncing: true, syncStatusText: 'Syncing with cloud...' });

    const foldersKey = getUserStorageKey(userId, STORAGE_KEYS.FOLDERS);
    const notebooksKey = getUserStorageKey(userId, STORAGE_KEYS.NOTEBOOKS);
    const pagesKey = getUserStorageKey(userId, STORAGE_KEYS.PAGES);

    // Step 1: Immediate local state hydration from user-scoped cache
    const cachedFolders = (await getIdbItem<FolderRow[]>(foldersKey, [])) || [];
    const cachedNotebooks = (await getIdbItem<NotebookRow[]>(notebooksKey, [])) || [];
    if (cachedFolders.length > 0 || cachedNotebooks.length > 0) {
      set({ folders: cachedFolders, notebooks: cachedNotebooks });
    }

    if (!isAuthUser) {
      set({ isSyncing: false, syncStatusText: null });
      return;
    }

    try {
      // Step 2: Fetch authoritative remote folders and notebooks from Supabase
      const [foldersRes, notebooksRes] = await Promise.all([
        supabase.from('folders').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
        supabase.from('notebooks').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      ]);

      let remoteFolders = foldersRes.data || [];
      let remoteNotebooks = notebooksRes.data || [];

      // Case A: First-Time User Onboarding / Migration (Remote is empty, but local has previous work)
      if (remoteNotebooks.length === 0 && cachedNotebooks.length > 0) {
        // Upload initial cached folders
        for (const cf of cachedFolders) {
          const { data: newF } = await supabase.from('folders').insert({
            id: cf.id,
            name: cf.name,
            user_id: userId,
            created_at: cf.created_at || new Date().toISOString(),
          }).select().single();
          if (newF) remoteFolders.push(newF);
        }

        // Upload initial cached notebooks
        for (const cnb of cachedNotebooks) {
          const { error: nbErr } = await supabase.from('notebooks').insert({
            id: cnb.id,
            name: cnb.name,
            folder_id: cnb.folder_id,
            user_id: userId,
            created_at: cnb.created_at || new Date().toISOString(),
            updated_at: cnb.updated_at || new Date().toISOString(),
          });
          if (!nbErr) remoteNotebooks.push(cnb);
        }

        // Upload initial cached pages
        const cachedPages = (await getIdbItem<PageRow[]>(pagesKey, [])) || [];
        const validPages = cachedPages.filter((p) => p.notebook_id && isValidUUID(p.notebook_id));
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
      }

      // Case B: Remote Authority & Ghost File Purging
      // Remote Supabase is the single source of truth!
      const remoteNotebookIdSet = new Set(remoteNotebooks.map((n) => n.id));
      const cachedPages = (await getIdbItem<PageRow[]>(pagesKey, [])) || [];
      const prunedPages = cachedPages.filter((p) => remoteNotebookIdSet.has(p.notebook_id));

      set({
        folders: remoteFolders,
        notebooks: remoteNotebooks,
        isSyncing: false,
        syncStatusText: 'Synced with cloud',
      });

      // Update user-scoped cache
      await Promise.all([
        setIdbItem(foldersKey, remoteFolders),
        setIdbItem(notebooksKey, remoteNotebooks),
        setIdbItem(pagesKey, prunedPages),
      ]);

      setTimeout(() => {
        set({ syncStatusText: null });
      }, 2500);
    } catch (err) {
      console.warn('Supabase fetchLibrary sync error:', err);
      set({ isSyncing: false, syncStatusText: 'Sync offline (cached)' });
      setTimeout(() => {
        set({ syncStatusText: null });
      }, 3000);
    }
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

      const [foldersRes, notebooksRes, pagesRes] = await Promise.all([
        supabase.from('folders').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
        supabase.from('notebooks').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('pages').select('*').eq('user_id', userId).order('order_index', { ascending: true }),
      ]);

      const remoteFolders = foldersRes.data || [];
      const remoteNotebooks = notebooksRes.data || [];
      const remotePages = pagesRes.data || [];

      set({
        folders: remoteFolders,
        notebooks: remoteNotebooks,
        isSyncing: false,
        syncStatusText: `Synced all ${remoteNotebooks.length} notebooks`,
      });

      await Promise.all([
        setIdbItem(foldersKey, remoteFolders),
        setIdbItem(notebooksKey, remoteNotebooks),
        setIdbItem(pagesKey, remotePages),
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

    if (isValidUUID(userId)) {
      try {
        await supabase.from('folders').insert({ id: folderId, name: newFolder.name, user_id: userId });
      } catch (err) {
        console.warn('Supabase createFolder error:', err);
      }
    }
  },

  deleteFolder: async (folderId: string) => {
    const { folders, notebooks, activeUserId } = get();
    const updatedFolders = folders.filter((f) => f.id !== folderId);
    const updatedNotebooks = notebooks.map((n) => (n.folder_id === folderId ? { ...n, folder_id: null } : n));

    set({ folders: updatedFolders, notebooks: updatedNotebooks });

    const foldersKey = getUserStorageKey(activeUserId, STORAGE_KEYS.FOLDERS);
    const notebooksKey = getUserStorageKey(activeUserId, STORAGE_KEYS.NOTEBOOKS);
    await Promise.all([setIdbItem(foldersKey, updatedFolders), setIdbItem(notebooksKey, updatedNotebooks)]);

    if (isValidUUID(folderId)) {
      try {
        await supabase.from('notebooks').update({ folder_id: null }).eq('folder_id', folderId);
        await supabase.from('folders').delete().eq('id', folderId);
      } catch (err) {
        console.warn('Supabase deleteFolder error:', err);
      }
    }
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
    set({ notebooks: updatedNotebooks });

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

    // Insert into Supabase
    if (isValidUUID(userId)) {
      try {
        await supabase.from('notebooks').insert({
          id: notebookId,
          name: newNotebook.name,
          folder_id: validFolderId,
          user_id: userId,
          created_at: now,
          updated_at: now,
        });

        await supabase.from('pages').insert({
          id: defaultPageId,
          notebook_id: notebookId,
          user_id: userId,
          name: 'Page 1',
          order_index: 0,
          canvas_data: defaultPage.canvas_data,
          created_at: now,
          updated_at: now,
        });
      } catch (err) {
        console.warn('Supabase createNotebook error:', err);
      }
    }

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
    set({ notebooks: updatedNotebooks });

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

    if (isValidUUID(userId)) {
      try {
        await supabase.from('notebooks').insert({
          id: notebookId,
          name: newNotebook.name,
          folder_id: validFolderId,
          user_id: userId,
          created_at: now,
          updated_at: now,
        });

        for (const p of createdPages) {
          await supabase.from('pages').insert({
            id: p.id,
            notebook_id: notebookId,
            user_id: userId,
            name: p.name,
            order_index: p.order_index,
            canvas_data: p.canvas_data,
            created_at: now,
            updated_at: now,
          });
        }
      } catch (err) {
        console.warn('Supabase createNotebookWithPages error:', err);
      }
    }

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

    if (isValidUUID(id)) {
      try {
        await supabase.from('notebooks').update({ name: cleanName, updated_at: now }).eq('id', id);
      } catch (err) {
        console.warn('Supabase renameNotebook error:', err);
      }
    }
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

    if (isValidUUID(id)) {
      try {
        await supabase.from('pages').delete().eq('notebook_id', id);
        await supabase.from('notebooks').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase deleteNotebook error:', err);
      }
    }
  },

  moveNotebook: async (notebookId: string, folderId: string | null) => {
    const validFolderId = folderId && isValidUUID(folderId) ? folderId : null;
    const { notebooks, activeUserId } = get();

    const updated = notebooks.map((n) => (n.id === notebookId ? { ...n, folder_id: validFolderId } : n));
    set({ notebooks: updated });

    const notebooksKey = getUserStorageKey(activeUserId, STORAGE_KEYS.NOTEBOOKS);
    await setIdbItem(notebooksKey, updated);

    if (isValidUUID(notebookId)) {
      try {
        await supabase.from('notebooks').update({ folder_id: validFolderId }).eq('id', notebookId);
      } catch (err) {
        console.warn('Supabase moveNotebook error:', err);
      }
    }
  },

  openNotebook: async (id: string) => {
    const { activeUserId } = get();
    const pagesKey = getUserStorageKey(activeUserId, STORAGE_KEYS.PAGES);

    // Step 1: Instant local render from IndexedDB cache (0ms delay)
    const cachedAllPages = (await getIdbItem<PageRow[]>(pagesKey, [])) || [];
    let localPages = cachedAllPages.filter((p) => p.notebook_id === id).sort((a, b) => a.order_index - b.order_index);

    if (localPages.length > 0) {
      const firstPage = localPages[0];
      const bg = extractBgSettingsFromPage(firstPage);

      set({
        activeNotebookId: id,
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
    } else {
      set({ activeNotebookId: id, loading: true });
    }

    // Step 2: Query authoritative pages from Supabase
    if (isValidUUID(id)) {
      try {
        const res = await supabase.from('pages').select('*').eq('notebook_id', id).order('order_index', { ascending: true });
        const remotePages = res.data || [];

        if (remotePages.length > 0) {
          // Update store with remote authoritative pages
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

    // Step 3: If no pages exist at all, create default Page 1
    if (get().pages.length === 0) {
      const notebook = get().notebooks.find((n) => n.id === id);
      const newPageId = generateUUID();
      const now = new Date().toISOString();
      const defaultBg = { ...DEFAULT_BG_SETTINGS };

      const newPage: PageRow = {
        id: newPageId,
        notebook_id: id,
        user_id: notebook?.user_id || 'guest',
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
        activeNotebookId: id,
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

      if (notebook?.user_id && isValidUUID(notebook.user_id)) {
        try {
          await supabase.from('pages').insert({
            id: newPageId,
            notebook_id: id,
            user_id: notebook.user_id,
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
    set({ activeNotebookId: null, pages: [], currentPageId: null });
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

    if (isValidUUID(userId)) {
      try {
        await supabase.from('pages').insert({
          id: newPageId,
          notebook_id: activeNotebookId,
          user_id: userId,
          name: newPage.name,
          order_index: newPage.order_index,
          canvas_data: newPage.canvas_data,
          created_at: now,
          updated_at: now,
        });
      } catch (err) {
        console.warn('Supabase addPage error:', err);
      }
    }
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

    if (isValidUUID(id)) {
      try {
        await supabase.from('pages').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase removePage error:', err);
      }
    }
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

    // Debounce cloud write (500ms) to ensure smooth drawing without network saturation
    if (isValidUUID(id) && isValidUUID(activeUserId)) {
      if (pageSaveTimers[id]) {
        clearTimeout(pageSaveTimers[id]);
      }
      set({ isSyncing: true, syncStatusText: 'Saving...' });
      pageSaveTimers[id] = setTimeout(async () => {
        try {
          await supabase.from('pages').update({ canvas_data: formattedData, updated_at: now }).eq('id', id);
          set({ isSyncing: false, syncStatusText: 'Saved' });
          setTimeout(() => {
            if (get().syncStatusText === 'Saved') {
              set({ syncStatusText: null });
            }
          }, 2000);
        } catch (err) {
          console.warn('Supabase updatePageData debounced error:', err);
          set({ isSyncing: false, syncStatusText: null });
        }
      }, 500);
    }
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

    const combined = [
      ...pages.slice(0, insertIndex),
      ...newCreatedPages,
      ...pages.slice(insertIndex),
    ].map((p, idx) => ({
      ...p,
      order_index: idx,
      name: p.name.startsWith('Page ') ? `Page ${idx + 1}` : p.name,
    }));

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

    if (isValidUUID(userId)) {
      try {
        for (const p of newCreatedPages) {
          await supabase.from('pages').insert({
            id: p.id,
            notebook_id: activeNotebookId,
            user_id: userId,
            name: p.name,
            order_index: p.order_index,
            canvas_data: p.canvas_data,
            created_at: now,
            updated_at: now,
          });
        }
      } catch (err) {
        console.warn('Supabase importPdfPages error:', err);
      }
    }
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
