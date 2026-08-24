import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import { getIdbItem, setIdbItem, getCachedData, initIdbStorage } from '../lib/idbStorage';

type FolderRow = Database['public']['Tables']['folders']['Row'];
type NotebookRow = Database['public']['Tables']['notebooks']['Row'];
type PageRow = Database['public']['Tables']['pages']['Row'];

export type ToolType = 'select' | 'pan' | 'pen' | 'highlighter' | 'eraser' | 'rectangle' | 'circle' | 'triangle' | 'line' | 'arrow' | 'diamond' | 'star' | 'text';
export type PageBackgroundType = 'solid' | 'gradient';
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
  
  // Library Actions
  fetchLibrary: (userId: string) => Promise<void>;
  createFolder: (name: string, userId: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  createNotebook: (name: string, folderId: string | null, userId: string) => Promise<string>;
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

// Storage keys
export const STORAGE_KEYS = {
  FOLDERS: 'nova_folders',
  NOTEBOOKS: 'nova_notebooks',
  PAGES: 'nova_pages',
  BG_SETTINGS: 'nova_bg_settings',
  PAGE_BG_SETTINGS: 'nova_page_bg_settings',
  ACTIVE_NOTEBOOK: 'nova_active_notebook_id',
};

// Initialize background storage hydration from IndexedDB
if (typeof window !== 'undefined') {
  initIdbStorage([
    STORAGE_KEYS.FOLDERS,
    STORAGE_KEYS.NOTEBOOKS,
    STORAGE_KEYS.PAGES,
    STORAGE_KEYS.PAGE_BG_SETTINGS,
    STORAGE_KEYS.BG_SETTINGS,
    STORAGE_KEYS.ACTIVE_NOTEBOOK
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

const initialActiveNotebook = getLocalData<string | null>(STORAGE_KEYS.ACTIVE_NOTEBOOK, null);
const initialPages = initialActiveNotebook
  ? getLocalData<PageRow[]>(STORAGE_KEYS.PAGES, []).filter(p => p.notebook_id === initialActiveNotebook)
  : [];
const initialCurrentPageId = initialPages[0]?.id || null;
const pageBgMap = getLocalData<Record<string, BgSettings>>(STORAGE_KEYS.PAGE_BG_SETTINGS, {});
const initialBg = (initialCurrentPageId && pageBgMap[initialCurrentPageId]) || getLocalData<BgSettings>(STORAGE_KEYS.BG_SETTINGS, DEFAULT_BG_SETTINGS);

export const useBoardStore = create<BoardState>((set, get) => ({
  folders: getLocalData<FolderRow[]>(STORAGE_KEYS.FOLDERS, []),
  notebooks: getLocalData<NotebookRow[]>(STORAGE_KEYS.NOTEBOOKS, []),
  activeNotebookId: initialActiveNotebook,
  pages: initialPages,
  currentPageId: initialCurrentPageId,
  loading: false,

  bgType: initialBg.bgType,
  bgColor: initialBg.bgColor,
  isRuled: initialBg.isRuled,
  ruleColor: initialBg.ruleColor,
  pageSize: initialBg.pageSize || 'a4',
  pageOrientation: initialBg.pageOrientation || 'portrait',

  fetchLibrary: async (userId) => {
    // Load cached first
    const cachedFolders = getLocalData<FolderRow[]>(STORAGE_KEYS.FOLDERS, []);
    const cachedNotebooks = getLocalData<NotebookRow[]>(STORAGE_KEYS.NOTEBOOKS, []);
    set({ folders: cachedFolders, notebooks: cachedNotebooks });

    try {
      const [foldersRes, notebooksRes] = await Promise.all([
        supabase.from('folders').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
        supabase.from('notebooks').select('*').eq('user_id', userId).order('created_at', { ascending: false })
      ]);
      
      if (foldersRes.data && foldersRes.data.length > 0) {
        set({ folders: foldersRes.data });
        setLocalData(STORAGE_KEYS.FOLDERS, foldersRes.data);
      }
      if (notebooksRes.data && notebooksRes.data.length > 0) {
        set({ notebooks: notebooksRes.data });
        setLocalData(STORAGE_KEYS.NOTEBOOKS, notebooksRes.data);
      }
    } catch (err) {
      console.warn('Supabase fetchLibrary offline, using local data:', err);
    }
  },

  createFolder: async (name, userId) => {
    const newFolder: FolderRow = {
      id: `folder_${Math.random().toString(36).substring(2, 9)}`,
      name,
      user_id: userId,
      created_at: new Date().toISOString()
    };

    const updatedFolders = [...get().folders, newFolder];
    set({ folders: updatedFolders });
    setLocalData(STORAGE_KEYS.FOLDERS, updatedFolders);

    try {
      const res = await supabase.from('folders').insert({ name, user_id: userId }).select().single();
      if (res.data) {
        const synced = updatedFolders.map(f => f.id === newFolder.id ? res.data : f);
        set({ folders: synced });
        setLocalData(STORAGE_KEYS.FOLDERS, synced);
      }
    } catch (err) {
      console.warn('Supabase createFolder offline, kept local:', err);
    }
  },

  deleteFolder: async (folderId) => {
    const updatedFolders = get().folders.filter(f => f.id !== folderId);
    const updatedNotebooks = get().notebooks.map(n => n.folder_id === folderId ? { ...n, folder_id: null } : n);

    set({ folders: updatedFolders, notebooks: updatedNotebooks });
    setLocalData(STORAGE_KEYS.FOLDERS, updatedFolders);
    setLocalData(STORAGE_KEYS.NOTEBOOKS, updatedNotebooks);

    try {
      await supabase.from('notebooks').update({ folder_id: null }).eq('folder_id', folderId);
      await supabase.from('folders').delete().eq('id', folderId);
    } catch (err) {
      console.warn('Supabase deleteFolder offline:', err);
    }
  },

  createNotebook: async (name, folderId, userId) => {
    const newNotebook: NotebookRow = {
      id: `nb_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
      name,
      folder_id: folderId,
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const updatedNotebooks = [newNotebook, ...get().notebooks];
    set({ notebooks: updatedNotebooks });
    setLocalData(STORAGE_KEYS.NOTEBOOKS, updatedNotebooks);

    // Also prepare an initial page for this notebook
    const defaultPage: PageRow = {
      id: `page_${Math.random().toString(36).substring(2, 9)}`,
      notebook_id: newNotebook.id,
      user_id: userId,
      name: 'Page 1',
      order_index: 0,
      canvas_data: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const allPages = getLocalData<PageRow[]>(STORAGE_KEYS.PAGES, []);
    setLocalData(STORAGE_KEYS.PAGES, [...allPages, defaultPage]);

    // Try Supabase in background
    supabase.from('notebooks').insert({ 
      id: newNotebook.id,
      name, 
      folder_id: folderId, 
      user_id: userId 
    }).then(({ error }) => {
      if (error) {
        console.warn('Supabase createNotebook offline, kept local:', error);
      }
    });

    return newNotebook.id;
  },

  renameNotebook: async (id, name) => {
    const cleanName = name.trim() || 'Untitled Notebook';
    const updated = get().notebooks.map(n => n.id === id ? { ...n, name: cleanName, updated_at: new Date().toISOString() } : n);
    set({ notebooks: updated });
    setLocalData(STORAGE_KEYS.NOTEBOOKS, updated);

    try {
      await supabase.from('notebooks').update({ name: cleanName, updated_at: new Date().toISOString() }).eq('id', id);
    } catch (err) {
      console.warn('Supabase renameNotebook offline:', err);
    }
  },

  deleteNotebook: async (id) => {
    const updated = get().notebooks.filter(n => n.id !== id);
    set({ notebooks: updated });
    setLocalData(STORAGE_KEYS.NOTEBOOKS, updated);

    const allPages = getLocalData<PageRow[]>(STORAGE_KEYS.PAGES, []);
    setLocalData(STORAGE_KEYS.PAGES, allPages.filter(p => p.notebook_id !== id));

    try {
      await supabase.from('notebooks').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase deleteNotebook offline:', err);
    }
  },

  moveNotebook: async (notebookId, folderId) => {
    const updated = get().notebooks.map(n => n.id === notebookId ? { ...n, folder_id: folderId } : n);
    set({ notebooks: updated });
    setLocalData(STORAGE_KEYS.NOTEBOOKS, updated);

    try {
      await supabase.from('notebooks').update({ folder_id: folderId }).eq('id', notebookId);
    } catch (err) {
      console.warn('Supabase moveNotebook offline:', err);
    }
  },

  openNotebook: async (id) => {
    set({ loading: true });
    setLocalData(STORAGE_KEYS.ACTIVE_NOTEBOOK, id);
    
    // Look up in local pages (checking IndexedDB cache)
    const allPages = await getIdbItem<PageRow[]>(STORAGE_KEYS.PAGES, getLocalData<PageRow[]>(STORAGE_KEYS.PAGES, []));
    let notebookPages = allPages.filter(p => p.notebook_id === id).sort((a, b) => a.order_index - b.order_index);

    // If no pages exist yet for this notebook, create Page 1
    if (notebookPages.length === 0) {
      const notebook = get().notebooks.find(n => n.id === id);
      const newPage: PageRow = {
        id: `page_${Math.random().toString(36).substring(2, 9)}`,
        notebook_id: id,
        user_id: notebook?.user_id || 'guest',
        name: 'Page 1',
        order_index: 0,
        canvas_data: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      notebookPages = [newPage];
      setLocalData(STORAGE_KEYS.PAGES, [...allPages, newPage]);
    }

    const firstPageId = notebookPages[0]?.id || null;
    const pageBgMap = await getIdbItem<Record<string, BgSettings>>(STORAGE_KEYS.PAGE_BG_SETTINGS, getLocalData<Record<string, BgSettings>>(STORAGE_KEYS.PAGE_BG_SETTINGS, {}));
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

    // Try Supabase in background without destroying newer local pages
    try {
      const res = await supabase.from('pages').select('*').eq('notebook_id', id).order('order_index', { ascending: true });
      if (res.data && res.data.length > 0) {
        const currentLocal = get().pages;
        const mergedPagesMap = new Map<string, PageRow>();
        
        // Remote pages
        res.data.forEach(p => mergedPagesMap.set(p.id, p));
        // Keep local pages if they have canvas_data or do not exist remotely yet
        currentLocal.forEach(p => {
          const remote = mergedPagesMap.get(p.id);
          if (!remote || (p.canvas_data && !remote.canvas_data)) {
            mergedPagesMap.set(p.id, p);
          }
        });
        const mergedPages = Array.from(mergedPagesMap.values()).sort((a, b) => a.order_index - b.order_index);

        const currentActivePageId = get().currentPageId;
        const validActivePageId = mergedPages.some(p => p.id === currentActivePageId) ? currentActivePageId : (mergedPages[0]?.id || null);

        set({ 
          pages: mergedPages,
          currentPageId: validActivePageId,
        });

        // Also sync merged state to IndexedDB
        const freshAllPages = await getIdbItem<PageRow[]>(STORAGE_KEYS.PAGES, getLocalData<PageRow[]>(STORAGE_KEYS.PAGES, []));
        const otherPages = freshAllPages.filter(p => p.notebook_id !== id);
        setLocalData(STORAGE_KEYS.PAGES, [...otherPages, ...mergedPages]);
      }
    } catch (err) {
      console.warn('Supabase openNotebook offline:', err);
    }
  },

  closeNotebook: () => {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_NOTEBOOK);
    set({ activeNotebookId: null, pages: [], currentPageId: null });
  },

  addPage: async (userId) => {
    const { activeNotebookId, pages, bgType, bgColor, isRuled, ruleColor, pageSize, pageOrientation } = get();
    if (!activeNotebookId) return;

    const newPage: PageRow = {
      id: `page_${Math.random().toString(36).substring(2, 9)}`,
      notebook_id: activeNotebookId,
      user_id: userId,
      name: `Page ${pages.length + 1}`,
      order_index: pages.length,
      canvas_data: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Save page background & size settings for new page
    const pageBgMap = await getIdbItem<Record<string, BgSettings>>(STORAGE_KEYS.PAGE_BG_SETTINGS, getLocalData<Record<string, BgSettings>>(STORAGE_KEYS.PAGE_BG_SETTINGS, {}));
    pageBgMap[newPage.id] = { bgType, bgColor, isRuled, ruleColor, pageSize, pageOrientation };
    setLocalData(STORAGE_KEYS.PAGE_BG_SETTINGS, pageBgMap);

    const updatedPages = [...pages, newPage];
    set({ pages: updatedPages, currentPageId: newPage.id });

    const allPages = await getIdbItem<PageRow[]>(STORAGE_KEYS.PAGES, getLocalData<PageRow[]>(STORAGE_KEYS.PAGES, []));
    setLocalData(STORAGE_KEYS.PAGES, [...allPages, newPage]);

    try {
      await supabase.from('pages').insert({
        notebook_id: activeNotebookId,
        user_id: userId,
        name: `Page ${pages.length + 1}`,
        order_index: pages.length
      });
    } catch (err) {
      console.warn('Supabase addPage offline:', err);
    }
  },

  removePage: async (id) => {
    const { pages, currentPageId } = get();
    if (pages.length <= 1) return; // Don't remove last page

    const newPages = pages.filter(p => p.id !== id);
    const newCurrentPageId = currentPageId === id ? newPages[newPages.length - 1].id : currentPageId;
    
    set({ pages: newPages, currentPageId: newCurrentPageId });

    const allPages = await getIdbItem<PageRow[]>(STORAGE_KEYS.PAGES, getLocalData<PageRow[]>(STORAGE_KEYS.PAGES, []));
    setLocalData(STORAGE_KEYS.PAGES, allPages.filter(p => p.id !== id));

    try {
      await supabase.from('pages').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase removePage offline:', err);
    }
  },

  switchPage: async (id, currentCanvasData) => {
    const { currentPageId } = get();
    if (currentPageId && currentCanvasData !== undefined && currentCanvasData !== '') {
      await get().updatePageData(currentPageId, currentCanvasData);
    }
    const pageBgMap = await getIdbItem<Record<string, BgSettings>>(STORAGE_KEYS.PAGE_BG_SETTINGS, getLocalData<Record<string, BgSettings>>(STORAGE_KEYS.PAGE_BG_SETTINGS, {}));
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
    const updatedPages = get().pages.map(p => p.id === id ? { ...p, canvas_data: canvasData as any, updated_at: new Date().toISOString() } : p);
    set({ pages: updatedPages });

    const allPages = await getIdbItem<PageRow[]>(STORAGE_KEYS.PAGES, getLocalData<PageRow[]>(STORAGE_KEYS.PAGES, []));
    const updatedAllPages = allPages.map(p => p.id === id ? { ...p, canvas_data: canvasData as any, updated_at: new Date().toISOString() } : p);
    if (!updatedAllPages.some(p => p.id === id)) {
      const pToAdd = updatedPages.find(p => p.id === id);
      if (pToAdd) updatedAllPages.push(pToAdd);
    }
    setLocalData(STORAGE_KEYS.PAGES, updatedAllPages);

    try {
      await supabase.from('pages').update({ canvas_data: canvasData as any, updated_at: new Date().toISOString() }).eq('id', id);
    } catch (err) {
      // offline save succeeded
    }
  },

  importPdfPages: async (pdfPages, afterPageId, userId) => {
    const { activeNotebookId, pages, bgType, bgColor, isRuled, ruleColor, pageSize, pageOrientation } = get();
    if (!activeNotebookId || pdfPages.length === 0) return;

    const currentIndex = pages.findIndex(p => p.id === afterPageId);
    const insertIndex = currentIndex >= 0 ? currentIndex + 1 : pages.length;

    const now = new Date().toISOString();
    const newCreatedPages: PageRow[] = pdfPages.map((item, idx) => ({
      id: `page_${Math.random().toString(36).substring(2, 9)}_${Date.now()}_${idx}`,
      notebook_id: activeNotebookId,
      user_id: userId,
      name: item.name || `Page ${pages.length + idx + 1}`,
      order_index: insertIndex + idx,
      canvas_data: item.canvasData as any,
      created_at: now,
      updated_at: now,
    }));

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
    const pageBgMap = await getIdbItem<Record<string, BgSettings>>(STORAGE_KEYS.PAGE_BG_SETTINGS, getLocalData<Record<string, BgSettings>>(STORAGE_KEYS.PAGE_BG_SETTINGS, {}));
    newCreatedPages.forEach(p => {
      pageBgMap[p.id] = { bgType, bgColor, isRuled, ruleColor, pageSize, pageOrientation };
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

    const allPages = await getIdbItem<PageRow[]>(STORAGE_KEYS.PAGES, getLocalData<PageRow[]>(STORAGE_KEYS.PAGES, []));
    const otherNotebookPages = allPages.filter(p => p.notebook_id !== activeNotebookId);
    setLocalData(STORAGE_KEYS.PAGES, [...otherNotebookPages, ...combined]);

    // Sync to Supabase in background
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
