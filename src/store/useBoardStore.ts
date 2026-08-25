import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import { getIdbItem, setIdbItem, getCachedData, initIdbStorage } from '../lib/idbStorage';

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

export interface BoardState {
  // Library Data
  folders: FolderRow[];
  notebooks: NotebookRow[];
  activeNotebookId: string | null;
  loading: boolean;
  isSyncing: boolean;
  syncStatusText: string | null;
  
  // Library Actions
  fetchLibrary: (userId: string) => Promise<void>;
  createFolder: (name: string, userId: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  createNotebook: (name: string, folderId: string | null, userId: string) => Promise<string>;
  createNotebookWithPages: (name: string, folderId: string | null, userId: string, pages: { canvasData: string; name?: string }[]) => Promise<string>;
  renameNotebook: (id: string, name: string) => Promise<void>;
  deleteNotebook: (id: string) => Promise<void>;
  moveNotebook: (notebookId: string, folderId: string | null) => Promise<void>;
  openNotebook: (id: string) => Promise<void>;
  closeNotebook: () => void;

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

interface BgSettings {
  bgType: PageBackgroundType;
  bgColor: string;
  isRuled: boolean;
  ruleColor: string;
  pageSize?: PageSizeType;
  pageOrientation?: PageOrientationType;
}

const DEFAULT_BG_SETTINGS: BgSettings = {
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

// Helper to extract timestamp from legacy ID if present
const extractTimestampFromId = (id: string): number | null => {
  const parts = id.split('_');
  for (const part of parts) {
    const num = Number(part);
    if (!isNaN(num) && num > 1600000000000 && num < 2500000000000) {
      return num;
    }
  }
  return null;
};

// Storage keys
export const STORAGE_KEYS = {
  FOLDERS: 'nova_folders',
  NOTEBOOKS: 'nova_notebooks',
  PAGES: 'nova_pages',
  BG_SETTINGS: 'nova_bg_settings',
  PAGE_BG_SETTINGS: 'nova_page_bg_settings',
};

// Helper to migrate legacy non-UUID IDs in local storage to valid UUIDs and update foreign keys
const normalizeAndMigrateLocalData = async (userId: string) => {
  const isAuthUser = isValidUUID(userId);
  let rawFolders = (await getIdbItem<FolderRow[]>(STORAGE_KEYS.FOLDERS, [])) || [];
  let rawNotebooks = (await getIdbItem<NotebookRow[]>(STORAGE_KEYS.NOTEBOOKS, [])) || [];
  let rawPages = (await getIdbItem<PageRow[]>(STORAGE_KEYS.PAGES, [])) || [];
  let pageBgMap = (await getIdbItem<Record<string, BgSettings>>(STORAGE_KEYS.PAGE_BG_SETTINGS, {})) || {};

  // Fallbacks to localStorage if IndexedDB returned empty
  if (rawFolders.length === 0) rawFolders = getLocalData<FolderRow[]>(STORAGE_KEYS.FOLDERS, []);
  if (rawNotebooks.length === 0) rawNotebooks = getLocalData<NotebookRow[]>(STORAGE_KEYS.NOTEBOOKS, []);
  if (rawPages.length === 0) rawPages = getLocalData<PageRow[]>(STORAGE_KEYS.PAGES, []);
  if (Object.keys(pageBgMap).length === 0) pageBgMap = getLocalData<Record<string, BgSettings>>(STORAGE_KEYS.PAGE_BG_SETTINGS, {});

  const folderIdMap = new Map<string, string>();
  const notebookIdMap = new Map<string, string>();
  const pageIdMap = new Map<string, string>();

  let hasChanges = false;

  // Migrate folders
  const migratedFolders: FolderRow[] = rawFolders.map(f => {
    let fid = f.id;
    if (!isValidUUID(fid)) {
      fid = generateUUID();
      folderIdMap.set(f.id, fid);
      hasChanges = true;
    }
    return {
      ...f,
      id: fid,
      user_id: isAuthUser ? userId : f.user_id,
    };
  });

  // Migrate notebooks
  const migratedNotebooks: NotebookRow[] = rawNotebooks.map(nb => {
    let nbid = nb.id;
    if (!isValidUUID(nbid)) {
      nbid = generateUUID();
      notebookIdMap.set(nb.id, nbid);
      hasChanges = true;
    }
    let fId = nb.folder_id;
    if (fId && folderIdMap.has(fId)) {
      fId = folderIdMap.get(fId)!;
      hasChanges = true;
    } else if (fId && !isValidUUID(fId)) {
      fId = null;
      hasChanges = true;
    }
    return {
      ...nb,
      id: nbid,
      folder_id: fId,
      user_id: isAuthUser ? userId : nb.user_id,
    };
  });

  const validNotebookIds = new Set(migratedNotebooks.map(n => n.id));

  // Build timestamp to notebook map for legacy notebook/page matching
  const notebookTimestampList = migratedNotebooks.map(nb => {
    const ts = (nb.created_at ? new Date(nb.created_at).getTime() : null) || extractTimestampFromId(nb.id);
    return { id: nb.id, name: nb.name, ts };
  }).filter(item => item.ts !== null) as { id: string; name: string; ts: number }[];

  // Migrate pages
  const migratedPages: PageRow[] = rawPages.map(p => {
    let pid = p.id;
    if (!isValidUUID(pid)) {
      pid = generateUUID();
      pageIdMap.set(p.id, pid);
      hasChanges = true;
    }
    let nbId = p.notebook_id;
    if (notebookIdMap.has(nbId)) {
      nbId = notebookIdMap.get(nbId)!;
      hasChanges = true;
    } else if (!validNotebookIds.has(nbId)) {
      // If notebook_id was an old string, try timestamp proximity matching
      const pageTs = extractTimestampFromId(p.notebook_id) || extractTimestampFromId(p.id) || (p.created_at ? new Date(p.created_at).getTime() : null);
      if (pageTs && notebookTimestampList.length > 0) {
        let closestNb = notebookTimestampList[0];
        let minDiff = Math.abs(pageTs - closestNb.ts);
        for (const n of notebookTimestampList) {
          const diff = Math.abs(pageTs - n.ts);
          if (diff < minDiff) {
            minDiff = diff;
            closestNb = n;
          }
        }
        if (minDiff < 60000) { // within 1 minute
          nbId = closestNb.id;
          hasChanges = true;
        }
      }
      // If still not matched, check if any notebook in migrated list has matching id
      if (!validNotebookIds.has(nbId)) {
        const found = migratedNotebooks.find(n => n.id === nbId);
        if (found) {
          nbId = found.id;
        }
      }
    }
    return {
      ...p,
      id: pid,
      notebook_id: nbId,
      user_id: isAuthUser ? userId : p.user_id,
    };
  });

  // Migrate page background settings map
  const updatedPageBgMap: Record<string, BgSettings> = {};
  for (const [key, val] of Object.entries(pageBgMap)) {
    const newKey = pageIdMap.get(key) || key;
    updatedPageBgMap[newKey] = val;
    if (newKey !== key) hasChanges = true;
  }

  if (hasChanges || isAuthUser) {
    setLocalData(STORAGE_KEYS.FOLDERS, migratedFolders);
    setLocalData(STORAGE_KEYS.NOTEBOOKS, migratedNotebooks);
    setLocalData(STORAGE_KEYS.PAGES, migratedPages);
    setLocalData(STORAGE_KEYS.PAGE_BG_SETTINGS, updatedPageBgMap);
  }

  return {
    folders: migratedFolders,
    notebooks: migratedNotebooks,
    pages: migratedPages,
  };
};

// Initialize background storage hydration from IndexedDB
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('nova_active_notebook_id');
    setIdbItem('nova_active_notebook_id', null);
  } catch {
    // ignore
  }

  initIdbStorage([
    STORAGE_KEYS.FOLDERS,
    STORAGE_KEYS.NOTEBOOKS,
    STORAGE_KEYS.PAGES,
    STORAGE_KEYS.PAGE_BG_SETTINGS,
    STORAGE_KEYS.BG_SETTINGS,
  ]);
}

export const getLocalData = <T>(key: string, defaultVal: T): T => {
  return getCachedData<T>(key, defaultVal);
};

export const setLocalData = <T>(key: string, data: T) => {
  setIdbItem(key, data);
};

export const getPageBackgroundSettings = (pageId?: string | null): BgSettings => {
  if (!pageId) return getLocalData<BgSettings>(STORAGE_KEYS.BG_SETTINGS, DEFAULT_BG_SETTINGS);
  const pageBgMap = getLocalData<Record<string, BgSettings>>(STORAGE_KEYS.PAGE_BG_SETTINGS, {});
  return pageBgMap[pageId] || getLocalData<BgSettings>(STORAGE_KEYS.BG_SETTINGS, DEFAULT_BG_SETTINGS);
};

export const useBoardStore = create<BoardState>((set, get) => ({
  folders: getLocalData<FolderRow[]>(STORAGE_KEYS.FOLDERS, []),
  notebooks: getLocalData<NotebookRow[]>(STORAGE_KEYS.NOTEBOOKS, []),
  activeNotebookId: null,
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

  fetchLibrary: async (userId) => {
    const isAuthUser = isValidUUID(userId);
    set({ isSyncing: true, syncStatusText: 'Syncing with cloud...' });

    // Step 1: Migrate local data if needed & set immediate local state
    const { folders: localFolders, notebooks: localNotebooks, pages: localPages } = await normalizeAndMigrateLocalData(userId);
    set({ folders: localFolders, notebooks: localNotebooks });

    if (!isAuthUser) {
      set({ isSyncing: false, syncStatusText: null });
      return;
    }

    try {
      // Step 2: Fetch authoritative remote folders and notebooks from Supabase
      const [foldersRes, notebooksRes] = await Promise.all([
        supabase.from('folders').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
        supabase.from('notebooks').select('*').eq('user_id', userId).order('created_at', { ascending: false })
      ]);

      let remoteFolders = foldersRes.data || [];
      let remoteNotebooks = notebooksRes.data || [];

      // Case A: First-time Host Onboarding (Supabase is empty, but local has host notebooks)
      if (remoteNotebooks.length === 0 && localNotebooks.length > 0) {
        // Upload initial host folders
        for (const lf of localFolders) {
          const { data: newF } = await supabase.from('folders').insert({
            id: lf.id,
            name: lf.name,
            user_id: userId,
            created_at: lf.created_at || new Date().toISOString()
          }).select().single();
          if (newF) remoteFolders.push(newF);
        }

        // Upload initial host notebooks
        for (const lnb of localNotebooks) {
          const { error: nbErr } = await supabase.from('notebooks').insert({
            id: lnb.id,
            name: lnb.name,
            folder_id: lnb.folder_id,
            user_id: userId,
            created_at: lnb.created_at || new Date().toISOString(),
            updated_at: lnb.updated_at || new Date().toISOString(),
          });
          if (!nbErr) remoteNotebooks.push(lnb);
        }

        // Upload initial host pages in parallel
        const validPagesToUpload = localPages.filter(p => p.notebook_id && isValidUUID(p.notebook_id));
        if (validPagesToUpload.length > 0) {
          await Promise.all(validPagesToUpload.map(p => {
            let formattedData = p.canvas_data;
            if (typeof p.canvas_data === 'string') {
              try { formattedData = JSON.parse(p.canvas_data); } catch {}
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
          }));
        }
      }

      // Case B: Normal Sync / Secondary Device Sync / Cloud Authority
      // Supabase is the single source of truth!
      // If a notebook or folder was deleted on ANY device, remoteNotebooks won't have it,
      // so we strictly use remoteNotebooks & remoteFolders and purge deleted local entries!
      const remoteNotebookIdSet = new Set(remoteNotebooks.map(n => n.id));
      const prunedLocalPages = localPages.filter(p => remoteNotebookIdSet.has(p.notebook_id));

      set({ 
        folders: remoteFolders, 
        notebooks: remoteNotebooks, 
        isSyncing: false, 
        syncStatusText: 'Synced with cloud'
      });

      setLocalData(STORAGE_KEYS.FOLDERS, remoteFolders);
      setLocalData(STORAGE_KEYS.NOTEBOOKS, remoteNotebooks);
      setLocalData(STORAGE_KEYS.PAGES, prunedLocalPages);

      setTimeout(() => {
        set({ syncStatusText: null });
      }, 3000);
    } catch (err) {
      console.warn('Supabase fetchLibrary sync error:', err);
      set({ isSyncing: false, syncStatusText: 'Sync failed (offline)' });
      setTimeout(() => { set({ syncStatusText: null }); }, 3000);
    }
  },

  createFolder: async (name, userId) => {
    const folderId = generateUUID();
    const newFolder: FolderRow = {
      id: folderId,
      name,
      user_id: userId,
      created_at: new Date().toISOString()
    };

    const updatedFolders = [...get().folders, newFolder];
    set({ folders: updatedFolders });
    setLocalData(STORAGE_KEYS.FOLDERS, updatedFolders);

    if (isValidUUID(userId)) {
      try {
        const res = await supabase.from('folders').insert({ id: folderId, name, user_id: userId }).select().single();
        if (res.data) {
          const synced = updatedFolders.map(f => f.id === newFolder.id ? res.data : f);
          set({ folders: synced });
          setLocalData(STORAGE_KEYS.FOLDERS, synced);
        }
      } catch (err) {
        console.warn('Supabase createFolder offline, kept local:', err);
      }
    }
  },

  deleteFolder: async (folderId) => {
    const updatedFolders = get().folders.filter(f => f.id !== folderId);
    const updatedNotebooks = get().notebooks.map(n => n.folder_id === folderId ? { ...n, folder_id: null } : n);

    set({ folders: updatedFolders, notebooks: updatedNotebooks });
    setLocalData(STORAGE_KEYS.FOLDERS, updatedFolders);
    setLocalData(STORAGE_KEYS.NOTEBOOKS, updatedNotebooks);

    if (isValidUUID(folderId)) {
      try {
        await supabase.from('notebooks').update({ folder_id: null }).eq('folder_id', folderId);
        await supabase.from('folders').delete().eq('id', folderId);
      } catch (err) {
        console.warn('Supabase deleteFolder offline:', err);
      }
    }
  },

  createNotebook: async (name, folderId, userId) => {
    const notebookId = generateUUID();
    const validFolderId = (folderId && isValidUUID(folderId)) ? folderId : null;
    const newNotebook: NotebookRow = {
      id: notebookId,
      name,
      folder_id: validFolderId,
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const updatedNotebooks = [newNotebook, ...get().notebooks];
    set({ notebooks: updatedNotebooks });
    setLocalData(STORAGE_KEYS.NOTEBOOKS, updatedNotebooks);

    // Also prepare an initial page for this notebook
    const defaultPageId = generateUUID();
    const defaultPage: PageRow = {
      id: defaultPageId,
      notebook_id: notebookId,
      user_id: userId,
      name: 'Page 1',
      order_index: 0,
      canvas_data: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const allPages = (await getIdbItem<PageRow[]>(STORAGE_KEYS.PAGES, [])) || [];
    setLocalData(STORAGE_KEYS.PAGES, [...allPages, defaultPage]);

    // Try Supabase in background
    if (isValidUUID(userId)) {
      supabase.from('notebooks').insert({ 
        id: notebookId,
        name, 
        folder_id: validFolderId, 
        user_id: userId 
      }).then(async ({ error }) => {
        if (error) {
          console.warn('Supabase createNotebook offline, kept local:', error);
        } else {
          await supabase.from('pages').insert({
            id: defaultPageId,
            notebook_id: notebookId,
            user_id: userId,
            name: 'Page 1',
            order_index: 0,
            canvas_data: null,
          });
        }
      });
    }

    return notebookId;
  },

  createNotebookWithPages: async (name, folderId, userId, pages) => {
    const notebookId = generateUUID();
    const validFolderId = (folderId && isValidUUID(folderId)) ? folderId : null;
    const newNotebook: NotebookRow = {
      id: notebookId,
      name: name.trim() || 'Imported Document',
      folder_id: validFolderId,
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const updatedNotebooks = [newNotebook, ...get().notebooks];
    set({ notebooks: updatedNotebooks });
    setLocalData(STORAGE_KEYS.NOTEBOOKS, updatedNotebooks);

    const now = new Date().toISOString();
    const createdPages: PageRow[] = (pages.length > 0 ? pages : [{ canvasData: null, name: 'Page 1' }]).map((p, idx) => {
      let formattedData: any = p.canvasData;
      if (typeof p.canvasData === 'string') {
        try { formattedData = JSON.parse(p.canvasData); } catch {}
      }
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

    const allPages = (await getIdbItem<PageRow[]>(STORAGE_KEYS.PAGES, [])) || [];
    setLocalData(STORAGE_KEYS.PAGES, [...allPages, ...createdPages]);

    // Save page background settings for all pages
    const pageBgMap = (await getIdbItem<Record<string, BgSettings>>(STORAGE_KEYS.PAGE_BG_SETTINGS, {})) || {};
    createdPages.forEach(p => {
      pageBgMap[p.id] = {
        bgType: 'none',
        bgColor: 'transparent',
        isRuled: false,
        ruleColor: '#e2e8f0',
        pageSize: 'a4',
        pageOrientation: 'portrait'
      };
    });
    setLocalData(STORAGE_KEYS.PAGE_BG_SETTINGS, pageBgMap);

    // Sync to Supabase in background
    if (isValidUUID(userId)) {
      supabase.from('notebooks').insert({ 
        id: notebookId,
        name: newNotebook.name, 
        folder_id: validFolderId, 
        user_id: userId 
      }).then(async ({ error }) => {
        if (error) {
          console.warn('Supabase createNotebookWithPages offline, kept local:', error);
        } else {
          for (const p of createdPages) {
            let formattedData = p.canvas_data;
            if (typeof p.canvas_data === 'string') {
              try { formattedData = JSON.parse(p.canvas_data); } catch {}
            }
            await supabase.from('pages').insert({
              id: p.id,
              notebook_id: notebookId,
              user_id: userId,
              name: p.name,
              order_index: p.order_index,
              canvas_data: formattedData,
            });
          }
        }
      });
    }

    return notebookId;
  },

  renameNotebook: async (id, name) => {
    const cleanName = name.trim() || 'Untitled Notebook';
    const updated = get().notebooks.map(n => n.id === id ? { ...n, name: cleanName, updated_at: new Date().toISOString() } : n);
    set({ notebooks: updated });
    setLocalData(STORAGE_KEYS.NOTEBOOKS, updated);

    if (isValidUUID(id)) {
      try {
        await supabase.from('notebooks').update({ name: cleanName, updated_at: new Date().toISOString() }).eq('id', id);
      } catch (err) {
        console.warn('Supabase renameNotebook offline:', err);
      }
    }
  },

  deleteNotebook: async (id) => {
    const updated = get().notebooks.filter(n => n.id !== id);
    set({ notebooks: updated });
    setLocalData(STORAGE_KEYS.NOTEBOOKS, updated);

    const allPages = (await getIdbItem<PageRow[]>(STORAGE_KEYS.PAGES, [])) || [];
    setLocalData(STORAGE_KEYS.PAGES, allPages.filter(p => p.notebook_id !== id));

    if (isValidUUID(id)) {
      try {
        await supabase.from('pages').delete().eq('notebook_id', id);
        await supabase.from('notebooks').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase deleteNotebook offline:', err);
      }
    }
  },

  moveNotebook: async (notebookId, folderId) => {
    const validFolderId = (folderId && isValidUUID(folderId)) ? folderId : null;
    const updated = get().notebooks.map(n => n.id === notebookId ? { ...n, folder_id: validFolderId } : n);
    set({ notebooks: updated });
    setLocalData(STORAGE_KEYS.NOTEBOOKS, updated);

    if (isValidUUID(notebookId)) {
      try {
        await supabase.from('notebooks').update({ folder_id: validFolderId }).eq('id', notebookId);
      } catch (err) {
        console.warn('Supabase moveNotebook offline:', err);
      }
    }
  },

  openNotebook: async (id) => {
    // Step 1: Instant Local Hydration (0ms wait)
    const cachedPages = getCachedData<PageRow[]>(STORAGE_KEYS.PAGES, []);
    let notebookPages = cachedPages.filter(p => p.notebook_id === id).sort((a, b) => a.order_index - b.order_index);

    if (notebookPages.length === 0) {
      // Check IndexedDB storage if not in memory cache
      const idbPages = (await getIdbItem<PageRow[]>(STORAGE_KEYS.PAGES, [])) || [];
      notebookPages = idbPages.filter(p => p.notebook_id === id).sort((a, b) => a.order_index - b.order_index);
    }

    // If local pages exist, open INSTANTLY
    if (notebookPages.length > 0) {
      const firstPageId = notebookPages[0]?.id || null;
      const pageBgMap = getCachedData<Record<string, BgSettings>>(STORAGE_KEYS.PAGE_BG_SETTINGS, {});
      const savedBg = (firstPageId && pageBgMap[firstPageId]) || getLocalData<BgSettings>(STORAGE_KEYS.BG_SETTINGS, DEFAULT_BG_SETTINGS);

      set({ 
        activeNotebookId: id, 
        pages: notebookPages,
        currentPageId: firstPageId,
        bgType: savedBg.bgType,
        bgColor: savedBg.bgColor,
        isRuled: savedBg.isRuled,
        ruleColor: savedBg.ruleColor,
        pageSize: savedBg.pageSize || 'a4',
        pageOrientation: savedBg.pageOrientation || 'portrait',
        loading: false
      });

      // Background Non-blocking sync with Supabase
      if (isValidUUID(id)) {
        setTimeout(async () => {
          try {
            const res = await supabase.from('pages').select('*').eq('notebook_id', id).order('order_index', { ascending: true });
            const remotePages = res.data || [];
            if (remotePages.length > 0) {
              const currentActive = get().activeNotebookId;
              if (currentActive === id) {
                const localPages = get().pages;
                const hasLocalDrawing = localPages.some(p => p.canvas_data && (typeof p.canvas_data === 'object' ? Object.keys(p.canvas_data).length > 0 : String(p.canvas_data).length > 60));
                if (!hasLocalDrawing && remotePages.some(rp => rp.canvas_data)) {
                  set({ pages: remotePages });
                  const allPages = (await getIdbItem<PageRow[]>(STORAGE_KEYS.PAGES, [])) || [];
                  const otherPages = allPages.filter(p => p.notebook_id !== id);
                  setLocalData(STORAGE_KEYS.PAGES, [...otherPages, ...remotePages]);
                }
              }
            }
          } catch (bgErr) {
            console.warn('Background page sync error:', bgErr);
          }
        }, 100);
      }
      return;
    }

    // Step 2: If NO local pages exist (e.g. fresh device from cloud), fetch from Supabase
    set({ loading: true });
    if (isValidUUID(id)) {
      try {
        const res = await supabase.from('pages').select('*').eq('notebook_id', id).order('order_index', { ascending: true });
        const remotePages = res.data || [];
        if (remotePages.length > 0) {
          notebookPages = remotePages;
        }
      } catch (err) {
        console.warn('Supabase openNotebook fetch error:', err);
      }
    }

    // If still no pages exist, create Page 1
    if (notebookPages.length === 0) {
      const notebook = get().notebooks.find(n => n.id === id);
      const newPageId = generateUUID();
      const newPage: PageRow = {
        id: newPageId,
        notebook_id: id,
        user_id: notebook?.user_id || 'guest',
        name: 'Page 1',
        order_index: 0,
        canvas_data: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      notebookPages = [newPage];

      if (notebook?.user_id && isValidUUID(notebook.user_id)) {
        supabase.from('pages').insert({
          id: newPageId,
          notebook_id: id,
          user_id: notebook.user_id,
          name: 'Page 1',
          order_index: 0,
          canvas_data: null
        }).then();
      }
    }

    const firstPageId = notebookPages[0]?.id || null;
    const pageBgMap = (await getIdbItem<Record<string, BgSettings>>(STORAGE_KEYS.PAGE_BG_SETTINGS, {})) || {};
    const savedBg = (firstPageId && pageBgMap[firstPageId]) || getLocalData<BgSettings>(STORAGE_KEYS.BG_SETTINGS, DEFAULT_BG_SETTINGS);

    set({ 
      activeNotebookId: id, 
      pages: notebookPages,
      currentPageId: firstPageId,
      bgType: savedBg.bgType,
      bgColor: savedBg.bgColor,
      isRuled: savedBg.isRuled,
      ruleColor: savedBg.ruleColor,
      pageSize: savedBg.pageSize || 'a4',
      pageOrientation: savedBg.pageOrientation || 'portrait',
      loading: false
    });

    // Update local cache
    const freshAllPages = (await getIdbItem<PageRow[]>(STORAGE_KEYS.PAGES, [])) || [];
    const otherPages = freshAllPages.filter(p => p.notebook_id !== id);
    setLocalData(STORAGE_KEYS.PAGES, [...otherPages, ...notebookPages]);
  },

  closeNotebook: () => {
    set({ activeNotebookId: null, pages: [], currentPageId: null });
  },

  addPage: async (userId) => {
    const { activeNotebookId, pages, bgType, bgColor, isRuled, ruleColor, pageSize, pageOrientation } = get();
    if (!activeNotebookId) return;

    const newPageId = generateUUID();
    const newPage: PageRow = {
      id: newPageId,
      notebook_id: activeNotebookId,
      user_id: userId,
      name: `Page ${pages.length + 1}`,
      order_index: pages.length,
      canvas_data: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Save page background & size settings for new page
    const pageBgMap = (await getIdbItem<Record<string, BgSettings>>(STORAGE_KEYS.PAGE_BG_SETTINGS, {})) || {};
    pageBgMap[newPage.id] = { bgType, bgColor, isRuled, ruleColor, pageSize, pageOrientation };
    setLocalData(STORAGE_KEYS.PAGE_BG_SETTINGS, pageBgMap);

    const updatedPages = [...pages, newPage];
    set({ pages: updatedPages, currentPageId: newPage.id });

    const allPages = (await getIdbItem<PageRow[]>(STORAGE_KEYS.PAGES, [])) || [];
    setLocalData(STORAGE_KEYS.PAGES, [...allPages, newPage]);

    if (isValidUUID(userId)) {
      try {
        await supabase.from('pages').insert({
          id: newPageId,
          notebook_id: activeNotebookId,
          user_id: userId,
          name: `Page ${pages.length + 1}`,
          order_index: pages.length,
          canvas_data: null
        });
      } catch (err) {
        console.warn('Supabase addPage offline:', err);
      }
    }
  },

  removePage: async (id) => {
    const { pages, currentPageId } = get();
    if (pages.length <= 1) return; // Don't remove last page

    const newPages = pages.filter(p => p.id !== id);
    const newCurrentPageId = currentPageId === id ? newPages[newPages.length - 1].id : currentPageId;
    
    set({ pages: newPages, currentPageId: newCurrentPageId });

    const allPages = (await getIdbItem<PageRow[]>(STORAGE_KEYS.PAGES, [])) || [];
    setLocalData(STORAGE_KEYS.PAGES, allPages.filter(p => p.id !== id));

    if (isValidUUID(id)) {
      try {
        await supabase.from('pages').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase removePage offline:', err);
      }
    }
  },

  switchPage: async (id, currentCanvasData) => {
    const { currentPageId } = get();
    if (currentPageId && currentCanvasData !== undefined && currentCanvasData !== '') {
      await get().updatePageData(currentPageId, currentCanvasData);
    }
    const pageBgMap = (await getIdbItem<Record<string, BgSettings>>(STORAGE_KEYS.PAGE_BG_SETTINGS, {})) || {};
    const savedBg = pageBgMap[id] || getLocalData<BgSettings>(STORAGE_KEYS.BG_SETTINGS, DEFAULT_BG_SETTINGS);
    set({ 
      currentPageId: id,
      bgType: savedBg.bgType,
      bgColor: savedBg.bgColor,
      isRuled: savedBg.isRuled,
      ruleColor: savedBg.ruleColor,
      pageSize: savedBg.pageSize || 'a4',
      pageOrientation: savedBg.pageOrientation || 'portrait',
    });
  },

  updatePageData: async (id, canvasData) => {
    let formattedData: any = canvasData;
    if (typeof canvasData === 'string') {
      try { formattedData = JSON.parse(canvasData); } catch {}
    }
    const updatedPages = get().pages.map(p => p.id === id ? { ...p, canvas_data: formattedData, updated_at: new Date().toISOString() } : p);
    set({ pages: updatedPages });

    const allPages = (await getIdbItem<PageRow[]>(STORAGE_KEYS.PAGES, [])) || [];
    const updatedAllPages = allPages.map(p => p.id === id ? { ...p, canvas_data: formattedData, updated_at: new Date().toISOString() } : p);
    if (!updatedAllPages.some(p => p.id === id)) {
      const pToAdd = updatedPages.find(p => p.id === id);
      if (pToAdd) updatedAllPages.push(pToAdd);
    }
    setLocalData(STORAGE_KEYS.PAGES, updatedAllPages);

    if (isValidUUID(id)) {
      try {
        await supabase.from('pages').update({ canvas_data: formattedData, updated_at: new Date().toISOString() }).eq('id', id);
      } catch (err) {
        // offline save succeeded
      }
    }
  },

  importPdfPages: async (pdfPages, afterPageId, userId) => {
    const { activeNotebookId, pages, pageSize, pageOrientation } = get();
    if (!activeNotebookId || pdfPages.length === 0) return;

    const currentIndex = pages.findIndex(p => p.id === afterPageId);
    const insertIndex = currentIndex >= 0 ? currentIndex + 1 : pages.length;

    const now = new Date().toISOString();
    const newCreatedPages: PageRow[] = pdfPages.map((item, idx) => {
      let formattedData: any = item.canvasData;
      if (typeof item.canvasData === 'string') {
        try { formattedData = JSON.parse(item.canvasData); } catch {}
      }
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

    // Re-index all pages in order
    const combined = [
      ...pages.slice(0, insertIndex),
      ...newCreatedPages,
      ...pages.slice(insertIndex),
    ].map((p, idx) => ({
      ...p,
      order_index: idx,
      name: p.name.startsWith('Page ') ? `Page ${idx + 1}` : p.name,
    }));

    // Save page background & size settings for all new pages
    const pageBgMap = (await getIdbItem<Record<string, BgSettings>>(STORAGE_KEYS.PAGE_BG_SETTINGS, {})) || {};
    newCreatedPages.forEach(p => {
      pageBgMap[p.id] = { 
        bgType: 'none', 
        bgColor: 'transparent', 
        isRuled: false, 
        ruleColor: '#e2e8f0', 
        pageSize, 
        pageOrientation 
      };
    });
    setLocalData(STORAGE_KEYS.PAGE_BG_SETTINGS, pageBgMap);

    // Save active page background settings to match the first new page
    const firstNewPageId = newCreatedPages[0].id;
    const firstSavedBg = pageBgMap[firstNewPageId] || DEFAULT_BG_SETTINGS;

    // Update store state immediately
    set({ 
      pages: combined, 
      currentPageId: firstNewPageId,
      bgType: firstSavedBg.bgType,
      bgColor: firstSavedBg.bgColor,
      isRuled: firstSavedBg.isRuled,
      ruleColor: firstSavedBg.ruleColor,
      pageSize: firstSavedBg.pageSize || 'a4',
      pageOrientation: firstSavedBg.pageOrientation || 'portrait',
    });

    const allPages = (await getIdbItem<PageRow[]>(STORAGE_KEYS.PAGES, [])) || [];
    const otherNotebookPages = allPages.filter(p => p.notebook_id !== activeNotebookId);
    setLocalData(STORAGE_KEYS.PAGES, [...otherNotebookPages, ...combined]);

    // Sync to Supabase in background
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
          });
        }
      } catch (err) {
        console.warn('Supabase importPdfPages offline:', err);
      }
    }
  },

  setBgType: (type) => {
    const { currentPageId, bgColor, isRuled, ruleColor, pageSize, pageOrientation } = get();
    const newSettings = { bgType: type, bgColor, isRuled, ruleColor, pageSize, pageOrientation };
    set({ bgType: type });
    setLocalData(STORAGE_KEYS.BG_SETTINGS, newSettings);
    if (currentPageId) {
      const pageBgMap = getLocalData<Record<string, BgSettings>>(STORAGE_KEYS.PAGE_BG_SETTINGS, {});
      pageBgMap[currentPageId] = newSettings;
      setLocalData(STORAGE_KEYS.PAGE_BG_SETTINGS, pageBgMap);
    }
  },
  setBgColor: (color) => {
    const { currentPageId, bgType, isRuled, ruleColor, pageSize, pageOrientation } = get();
    const newSettings = { bgType, bgColor: color, isRuled, ruleColor, pageSize, pageOrientation };
    set({ bgColor: color });
    setLocalData(STORAGE_KEYS.BG_SETTINGS, newSettings);
    if (currentPageId) {
      const pageBgMap = getLocalData<Record<string, BgSettings>>(STORAGE_KEYS.PAGE_BG_SETTINGS, {});
      pageBgMap[currentPageId] = newSettings;
      setLocalData(STORAGE_KEYS.PAGE_BG_SETTINGS, pageBgMap);
    }
  },
  setIsRuled: (ruled) => {
    const { currentPageId, bgType, bgColor, ruleColor, pageSize, pageOrientation } = get();
    const newSettings = { bgType, bgColor, isRuled: ruled, ruleColor, pageSize, pageOrientation };
    set({ isRuled: ruled });
    setLocalData(STORAGE_KEYS.BG_SETTINGS, newSettings);
    if (currentPageId) {
      const pageBgMap = getLocalData<Record<string, BgSettings>>(STORAGE_KEYS.PAGE_BG_SETTINGS, {});
      pageBgMap[currentPageId] = newSettings;
      setLocalData(STORAGE_KEYS.PAGE_BG_SETTINGS, pageBgMap);
    }
  },
  setRuleColor: (color) => {
    const { currentPageId, bgType, bgColor, isRuled, pageSize, pageOrientation } = get();
    const newSettings = { bgType, bgColor, isRuled, ruleColor: color, pageSize, pageOrientation };
    set({ ruleColor: color });
    setLocalData(STORAGE_KEYS.BG_SETTINGS, newSettings);
    if (currentPageId) {
      const pageBgMap = getLocalData<Record<string, BgSettings>>(STORAGE_KEYS.PAGE_BG_SETTINGS, {});
      pageBgMap[currentPageId] = newSettings;
      setLocalData(STORAGE_KEYS.PAGE_BG_SETTINGS, pageBgMap);
    }
  },
  setPageSize: (size) => {
    const { currentPageId, bgType, bgColor, isRuled, ruleColor, pageOrientation } = get();
    const newSettings = { bgType, bgColor, isRuled, ruleColor, pageSize: size, pageOrientation };
    set({ pageSize: size });
    setLocalData(STORAGE_KEYS.BG_SETTINGS, newSettings);
    if (currentPageId) {
      const pageBgMap = getLocalData<Record<string, BgSettings>>(STORAGE_KEYS.PAGE_BG_SETTINGS, {});
      pageBgMap[currentPageId] = newSettings;
      setLocalData(STORAGE_KEYS.PAGE_BG_SETTINGS, pageBgMap);
    }
  },
  setPageOrientation: (orientation) => {
    const { currentPageId, bgType, bgColor, isRuled, ruleColor, pageSize } = get();
    const newSettings = { bgType, bgColor, isRuled, ruleColor, pageSize, pageOrientation: orientation };
    set({ pageOrientation: orientation });
    setLocalData(STORAGE_KEYS.BG_SETTINGS, newSettings);
    if (currentPageId) {
      const pageBgMap = getLocalData<Record<string, BgSettings>>(STORAGE_KEYS.PAGE_BG_SETTINGS, {});
      pageBgMap[currentPageId] = newSettings;
      setLocalData(STORAGE_KEYS.PAGE_BG_SETTINGS, pageBgMap);
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
