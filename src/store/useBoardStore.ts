import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import { getIdbItem, setIdbItem, initIdbStorage, getUserStorageKey } from '../lib/idbStorage';
import { useAuthStore } from './useAuthStore';

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
  subscript?: boolean;
  superscript?: boolean;
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
  UNSYNCED_NOTEBOOKS: 'nova_unsynced_notebooks',
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
  unsyncedNotebookIds: string[];
  activeNotebookId: string | null;
  activeUserId: string | null;
  loading: boolean;
  isSyncing: boolean;
  syncStatusText: string | null;
  syncProgress: number;
  isAlreadySyncedModalOpen: boolean;
  setIsAlreadySyncedModalOpen: (open: boolean) => void;

  // Library Actions
  fetchLibrary: (userId: string) => Promise<void>;
  syncAllNotebooks: (userId: string) => Promise<void>;
  checkSyncStatus: (userId?: string) => Promise<void>;
  triggerSyncOrShowModal: (userId?: string) => Promise<void>;
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
  switchPage: (id: string) => Promise<void>;
  updatePageData: (id: string, canvasData: string | any, explicitBg?: Partial<BgSettings>) => Promise<void>;
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

  // Tool Tray Auto-Hide (like Windows taskbar)
  isToolbarAutoHide: boolean;
  toggleToolbarAutoHide: () => void;
  setToolbarAutoHide: (autoHide: boolean) => void;
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
    STORAGE_KEYS.UNSYNCED_NOTEBOOKS,
  ]);
}

export const useBoardStore = create<BoardState>((set, get) => ({
  folders: [],
  notebooks: [],
  unsyncedNotebookIds: [],
  activeNotebookId: null,
  activeUserId: null,
  pages: [],
  currentPageId: null,
  loading: false,
  isSyncing: false,
  syncStatusText: null,
  syncProgress: 0,
  isAlreadySyncedModalOpen: false,
  setIsAlreadySyncedModalOpen: (open: boolean) => set({ isAlreadySyncedModalOpen: open }),

  bgType: DEFAULT_BG_SETTINGS.bgType,
  bgColor: DEFAULT_BG_SETTINGS.bgColor,
  isRuled: DEFAULT_BG_SETTINGS.isRuled,
  ruleColor: DEFAULT_BG_SETTINGS.ruleColor,
  pageSize: DEFAULT_BG_SETTINGS.pageSize || 'a4',
  pageOrientation: DEFAULT_BG_SETTINGS.pageOrientation || 'portrait',

  fetchLibrary: async (userId: string) => {
    set({ activeUserId: userId, isSyncing: false, syncStatusText: null, syncProgress: 0 });

    const foldersKey = getUserStorageKey(userId, STORAGE_KEYS.FOLDERS);
    const notebooksKey = getUserStorageKey(userId, STORAGE_KEYS.NOTEBOOKS);
    const unsyncedKey = getUserStorageKey(userId, STORAGE_KEYS.UNSYNCED_NOTEBOOKS);

    // Immediate local state hydration from user-scoped cache
    const cachedFolders = (await getIdbItem<FolderRow[]>(foldersKey, [])) || [];
    const cachedNotebooks = (await getIdbItem<NotebookRow[]>(notebooksKey, [])) || [];
    const cachedUnsynced = (await getIdbItem<string[]>(unsyncedKey, [])) || [];
    set({ folders: cachedFolders, notebooks: cachedNotebooks, unsyncedNotebookIds: cachedUnsynced });

    if (isValidUUID(userId)) {
      get().checkSyncStatus(userId);
    } else {
      set({ unsyncedNotebookIds: cachedNotebooks.map((n) => n.id) });
    }
  },

  checkSyncStatus: async (userId?: string) => {
    const uid = userId || get().activeUserId;
    if (!uid || !isValidUUID(uid)) {
      const allIds = get().notebooks.map((n) => n.id);
      set({ unsyncedNotebookIds: allIds });
      return;
    }

    try {
      const pagesKey = getUserStorageKey(uid, STORAGE_KEYS.PAGES);
      const localPages = (await getIdbItem<PageRow[]>(pagesKey, [])) || [];
      const localNotebooks = get().notebooks;

      // Query metadata only (lightweight & very fast)
      const [remoteNbRes, remotePagesRes] = await Promise.all([
        supabase.from('notebooks').select('id, name, folder_id, updated_at, created_at').eq('user_id', uid),
        supabase.from('pages').select('id, notebook_id, updated_at, created_at').eq('user_id', uid),
      ]);

      if (remoteNbRes.error || remotePagesRes.error) return;

      const remoteNbMap = new Map((remoteNbRes.data || []).map((n) => [n.id, n]));
      const remotePagesMap = new Map((remotePagesRes.data || []).map((p) => [p.id, p]));

      // Group local pages by notebook_id
      const localPagesByNb = new Map<string, PageRow[]>();
      localPages.forEach((p) => {
        if (!p.notebook_id) return;
        const list = localPagesByNb.get(p.notebook_id) || [];
        list.push(p);
        localPagesByNb.set(p.notebook_id, list);
      });

      // Group remote pages by notebook_id
      const remotePagesByNb = new Map<string, any[]>();
      (remotePagesRes.data || []).forEach((p) => {
        if (!p.notebook_id) return;
        const list = remotePagesByNb.get(p.notebook_id) || [];
        list.push(p);
        remotePagesByNb.set(p.notebook_id, list);
      });

      const unsynced = new Set<string>();

      for (const nb of localNotebooks) {
        const remoteNb = remoteNbMap.get(nb.id);
        if (!remoteNb) {
          unsynced.add(nb.id);
          continue;
        }

        const localTime = new Date(nb.updated_at || nb.created_at || 0).getTime();
        const remoteTime = new Date(remoteNb.updated_at || remoteNb.created_at || 0).getTime();
        if (localTime > remoteTime + 500 || remoteNb.name !== nb.name || remoteNb.folder_id !== nb.folder_id) {
          unsynced.add(nb.id);
          continue;
        }

        const nbPages = localPagesByNb.get(nb.id) || [];
        const remNbPages = remotePagesByNb.get(nb.id) || [];

        let pagesSynced = true;
        if (nbPages.length !== remNbPages.length) {
          pagesSynced = false;
        } else {
          for (const lp of nbPages) {
            const rp = remotePagesMap.get(lp.id);
            if (!rp) {
              pagesSynced = false;
              break;
            }
            const lpTime = new Date(lp.updated_at || lp.created_at || 0).getTime();
            const rpTime = new Date(rp.updated_at || rp.created_at || 0).getTime();
            if (Math.abs(lpTime - rpTime) > 500) {
              pagesSynced = false;
              break;
            }
          }
        }

        if (!pagesSynced) {
          unsynced.add(nb.id);
        }
      }

      const unsyncedList = Array.from(unsynced);
      set({ unsyncedNotebookIds: unsyncedList });
      const unsyncedKey = getUserStorageKey(uid, STORAGE_KEYS.UNSYNCED_NOTEBOOKS);
      await setIdbItem(unsyncedKey, unsyncedList);
    } catch (e) {
      console.warn('checkSyncStatus error:', e);
    }
  },

  triggerSyncOrShowModal: async (userId?: string) => {
    const uid = userId || get().activeUserId;
    if (!uid || !isValidUUID(uid)) {
      useAuthStore.getState().setShowAuthModal(true);
      return;
    }

    const { unsyncedNotebookIds, notebooks, isSyncing, syncAllNotebooks } = get();
    if (isSyncing) return;

    const currentNotebookIds = new Set(notebooks.map((n) => n.id));
    const activeUnsynced = unsyncedNotebookIds.filter((id) => currentNotebookIds.has(id));

    if (activeUnsynced.length === 0) {
      // Everything is already backed up and synced!
      set({ isAlreadySyncedModalOpen: true });
      return;
    }

    await syncAllNotebooks(uid);
  },

  syncAllNotebooks: async (userId: string) => {
    const isAuthUser = isValidUUID(userId);
    set({ isSyncing: true, syncProgress: 5, syncStatusText: 'Checking cloud updates (5%)...' });

    if (!isAuthUser) {
      set({ isSyncing: false, syncProgress: 0, syncStatusText: 'Local storage (Sign in to sync)' });
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
      const validPages = localPages.filter((p) => p.notebook_id && isValidUUID(p.notebook_id));

      // 1. Fetch remote metadata only (omit canvas_data to keep network transfer fast & lightweight)
      set({ syncProgress: 12, syncStatusText: 'Checking cloud records (12%)...' });
      const [foldersRes, notebooksRes, remotePagesMetaRes] = await Promise.all([
        supabase.from('folders').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
        supabase.from('notebooks').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase
          .from('pages')
          .select('id, notebook_id, user_id, name, order_index, created_at, updated_at')
          .eq('user_id', userId)
          .order('order_index', { ascending: true }),
      ]);

      if (foldersRes.error) throw foldersRes.error;
      if (notebooksRes.error) throw notebooksRes.error;
      if (remotePagesMetaRes.error) throw remotePagesMetaRes.error;

      const remoteFolders = foldersRes.data || [];
      const remoteNotebooks = notebooksRes.data || [];
      const remotePagesMeta = remotePagesMetaRes.data || [];

      const remoteFolderMap = new Map(remoteFolders.map((f) => [f.id, f]));
      const remoteNotebookMap = new Map(remoteNotebooks.map((nb) => [nb.id, nb]));
      const remotePageMetaMap = new Map(remotePagesMeta.map((p) => [p.id, p]));

      const localPageMap = new Map(validPages.map((p) => [p.id, p]));

      // 2. Identify dirty/new local records to push to cloud
      // Folders to push
      const foldersToPush = localFolders.filter((f) => {
        const remote = remoteFolderMap.get(f.id);
        if (!remote) return true;
        return remote.name !== f.name;
      });

      // Notebooks to push: new OR local updated_at > remote updated_at OR folder changed
      const notebooksToPush = localNotebooks.filter((nb) => {
        const remote = remoteNotebookMap.get(nb.id);
        if (!remote) return true;
        const localTime = new Date(nb.updated_at || nb.created_at || 0).getTime();
        const remoteTime = new Date(remote.updated_at || remote.created_at || 0).getTime();
        return localTime > remoteTime + 500 || remote.name !== nb.name || remote.folder_id !== nb.folder_id;
      });

      // Pages to push: only new pages OR pages modified locally after cloud version
      const pagesToPush = validPages.filter((p) => {
        const remote = remotePageMetaMap.get(p.id);
        if (!remote) return true;
        const localTime = new Date(p.updated_at || p.created_at || 0).getTime();
        const remoteTime = new Date(remote.updated_at || remote.created_at || 0).getTime();
        // Allow a 500ms grace window to avoid microsecond rounding diffs
        return localTime > remoteTime + 500;
      });

      // 3. Identify remote pages to download: new in cloud or cloud updated_at is newer
      const pageIdsToDownload: string[] = [];
      for (const remoteP of remotePagesMeta) {
        const localP = localPageMap.get(remoteP.id);
        if (!localP) {
          pageIdsToDownload.push(remoteP.id);
        } else {
          const localTime = new Date(localP.updated_at || localP.created_at || 0).getTime();
          const remoteTime = new Date(remoteP.updated_at || remoteP.created_at || 0).getTime();
          if (remoteTime > localTime + 500) {
            pageIdsToDownload.push(remoteP.id);
          }
        }
      }

      const totalPushUnits = foldersToPush.length + notebooksToPush.length + pagesToPush.length;
      let completedUnits = 0;
      const totalUnits = Math.max(1, totalPushUnits + (pageIdsToDownload.length > 0 ? 5 : 1));

      // Push Folders (incremental)
      for (const f of foldersToPush) {
        await supabase.from('folders').upsert({
          id: f.id,
          name: f.name,
          user_id: userId,
          created_at: f.created_at || new Date().toISOString(),
        });
        completedUnits++;
        const pct = Math.min(85, Math.round(15 + (completedUnits / totalUnits) * 70));
        set({ syncProgress: pct, syncStatusText: `Syncing folders (${completedUnits}/${totalPushUnits})...` });
      }

      // Push Notebooks (incremental)
      for (const nb of notebooksToPush) {
        await supabase.from('notebooks').upsert({
          id: nb.id,
          name: nb.name,
          folder_id: nb.folder_id,
          user_id: userId,
          created_at: nb.created_at || new Date().toISOString(),
          updated_at: nb.updated_at || new Date().toISOString(),
        });
        completedUnits++;
        const pct = Math.min(85, Math.round(15 + (completedUnits / totalUnits) * 70));
        set({ syncProgress: pct, syncStatusText: `Syncing notebooks (${completedUnits}/${totalPushUnits})...` });
      }

      // Push Pages (incremental in batches of 5)
      const BATCH_SIZE = 5;
      for (let i = 0; i < pagesToPush.length; i += BATCH_SIZE) {
        const batch = pagesToPush.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map((p) => {
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
        completedUnits += batch.length;
        const currentCount = Math.min(i + BATCH_SIZE, pagesToPush.length);
        const pct = Math.min(85, Math.round(15 + (completedUnits / totalUnits) * 70));
        set({ syncProgress: pct, syncStatusText: `Syncing new/modified pages ${currentCount}/${pagesToPush.length} (${pct}%)...` });
      }

      // 4. Download only new/modified pages from Supabase
      let freshlyDownloadedPages: PageRow[] = [];
      if (pageIdsToDownload.length > 0) {
        set({ syncProgress: 88, syncStatusText: `Downloading ${pageIdsToDownload.length} cloud update(s)...` });
        const DOWNLOAD_BATCH = 20;
        for (let i = 0; i < pageIdsToDownload.length; i += DOWNLOAD_BATCH) {
          const idsBatch = pageIdsToDownload.slice(i, i + DOWNLOAD_BATCH);
          const dlRes = await supabase.from('pages').select('*').in('id', idsBatch);
          if (dlRes.data) {
            freshlyDownloadedPages.push(...dlRes.data);
          }
        }
      }

      // 5. Merge remote and local records
      const foldersMap = new Map<string, FolderRow>();
      remoteFolders.forEach((f) => foldersMap.set(f.id, f));
      localFolders.forEach((f) => foldersMap.set(f.id, f));
      const mergedFolders = Array.from(foldersMap.values());

      const notebooksMap = new Map<string, NotebookRow>();
      remoteNotebooks.forEach((n) => notebooksMap.set(n.id, n));
      localNotebooks.forEach((n) => {
        const remote = notebooksMap.get(n.id);
        if (!remote) {
          notebooksMap.set(n.id, n);
        } else {
          const localTime = new Date(n.updated_at || n.created_at || 0).getTime();
          const remoteTime = new Date(remote.updated_at || remote.created_at || 0).getTime();
          if (localTime >= remoteTime) {
            notebooksMap.set(n.id, n);
          }
        }
      });
      const mergedNotebooks = Array.from(notebooksMap.values());

      // Pages: keep existing local pages, apply freshly downloaded newer pages
      const pagesMap = new Map<string, PageRow>();
      localPages.forEach((p) => pagesMap.set(p.id, p));
      freshlyDownloadedPages.forEach((p) => pagesMap.set(p.id, p));
      const mergedPages = Array.from(pagesMap.values());

      const pushedCount = foldersToPush.length + notebooksToPush.length + pagesToPush.length;
      const pulledCount = pageIdsToDownload.length;

      let statusMsg = `Synced 100% (${mergedNotebooks.length} notebooks)`;
      if (pushedCount === 0 && pulledCount === 0) {
        statusMsg = 'All notebooks are up to date';
      } else if (pushedCount > 0 && pulledCount === 0) {
        statusMsg = `Uploaded ${pushedCount} item${pushedCount > 1 ? 's' : ''} to cloud`;
      } else if (pushedCount === 0 && pulledCount > 0) {
        statusMsg = `Downloaded ${pulledCount} update${pulledCount > 1 ? 's' : ''}`;
      } else {
        statusMsg = `Synced (${pushedCount} uploaded, ${pulledCount} downloaded)`;
      }

      const unsyncedKey = getUserStorageKey(userId, STORAGE_KEYS.UNSYNCED_NOTEBOOKS);

      set({
        folders: mergedFolders,
        notebooks: mergedNotebooks,
        unsyncedNotebookIds: [],
        isSyncing: false,
        syncProgress: 100,
        syncStatusText: statusMsg,
      });

      // If active notebook is open, refresh active pages if any updates were downloaded
      const { activeNotebookId } = get();
      if (activeNotebookId && freshlyDownloadedPages.some((p) => p.notebook_id === activeNotebookId)) {
        const activePages = mergedPages
          .filter((p) => p.notebook_id === activeNotebookId)
          .sort((a, b) => a.order_index - b.order_index);
        set({ pages: activePages });
      }

      await Promise.all([
        setIdbItem(foldersKey, mergedFolders),
        setIdbItem(notebooksKey, mergedNotebooks),
        setIdbItem(pagesKey, mergedPages),
        setIdbItem(unsyncedKey, []),
      ]);

      setTimeout(() => set({ syncStatusText: null, syncProgress: 0 }), 3500);
    } catch (err) {
      console.warn('Sync all notebooks error:', err);
      set({ isSyncing: false, syncProgress: 0, syncStatusText: 'Sync failed (offline)' });
      setTimeout(() => set({ syncStatusText: null }), 3500);
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

    if (activeUserId && isValidUUID(activeUserId) && isValidUUID(folderId)) {
      try {
        await supabase.from('folders').delete().eq('id', folderId);
      } catch (e) {
        console.warn('Error deleting folder from cloud:', e);
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
    const updatedUnsynced = Array.from(new Set([...get().unsyncedNotebookIds, notebookId]));
    set({ notebooks: updatedNotebooks, activeUserId: userId, unsyncedNotebookIds: updatedUnsynced });

    const notebooksKey = getUserStorageKey(userId, STORAGE_KEYS.NOTEBOOKS);
    const unsyncedKey = getUserStorageKey(userId, STORAGE_KEYS.UNSYNCED_NOTEBOOKS);
    await Promise.all([
      setIdbItem(notebooksKey, updatedNotebooks),
      setIdbItem(unsyncedKey, updatedUnsynced),
    ]);

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
    const updatedUnsynced = Array.from(new Set([...get().unsyncedNotebookIds, notebookId]));
    set({ notebooks: updatedNotebooks, activeUserId: userId, unsyncedNotebookIds: updatedUnsynced });

    const notebooksKey = getUserStorageKey(userId, STORAGE_KEYS.NOTEBOOKS);
    const unsyncedKey = getUserStorageKey(userId, STORAGE_KEYS.UNSYNCED_NOTEBOOKS);
    await Promise.all([
      setIdbItem(notebooksKey, updatedNotebooks),
      setIdbItem(unsyncedKey, updatedUnsynced),
    ]);

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
    const updatedUnsynced = Array.from(new Set([...get().unsyncedNotebookIds, id]));
    set({ notebooks: updated, unsyncedNotebookIds: updatedUnsynced });

    const notebooksKey = getUserStorageKey(activeUserId, STORAGE_KEYS.NOTEBOOKS);
    const unsyncedKey = getUserStorageKey(activeUserId, STORAGE_KEYS.UNSYNCED_NOTEBOOKS);
    await Promise.all([
      setIdbItem(notebooksKey, updated),
      setIdbItem(unsyncedKey, updatedUnsynced),
    ]);
  },

  deleteNotebook: async (id: string) => {
    const { notebooks, activeNotebookId, activeUserId } = get();
    const updated = notebooks.filter((n) => n.id !== id);
    const updatedUnsynced = get().unsyncedNotebookIds.filter((nid) => nid !== id);
    set({ notebooks: updated, unsyncedNotebookIds: updatedUnsynced });

    if (activeNotebookId === id) {
      set({ activeNotebookId: null, pages: [], currentPageId: null });
    }

    const notebooksKey = getUserStorageKey(activeUserId, STORAGE_KEYS.NOTEBOOKS);
    const pagesKey = getUserStorageKey(activeUserId, STORAGE_KEYS.PAGES);
    const unsyncedKey = getUserStorageKey(activeUserId, STORAGE_KEYS.UNSYNCED_NOTEBOOKS);

    const allPages = (await getIdbItem<PageRow[]>(pagesKey, [])) || [];
    const prunedPages = allPages.filter((p) => p.notebook_id !== id);

    await Promise.all([
      setIdbItem(notebooksKey, updated),
      setIdbItem(pagesKey, prunedPages),
      setIdbItem(unsyncedKey, updatedUnsynced),
    ]);

    if (activeUserId && isValidUUID(activeUserId) && isValidUUID(id)) {
      try {
        await supabase.from('pages').delete().eq('notebook_id', id);
        await supabase.from('notebooks').delete().eq('id', id);
      } catch (e) {
        console.warn('Error deleting notebook from cloud:', e);
      }
    }
  },

  moveNotebook: async (notebookId: string, folderId: string | null) => {
    const validFolderId = folderId && isValidUUID(folderId) ? folderId : null;
    const { notebooks, activeUserId } = get();

    const updated = notebooks.map((n) => (n.id === notebookId ? { ...n, folder_id: validFolderId } : n));
    const updatedUnsynced = Array.from(new Set([...get().unsyncedNotebookIds, notebookId]));
    set({ notebooks: updated, unsyncedNotebookIds: updatedUnsynced });

    const notebooksKey = getUserStorageKey(activeUserId, STORAGE_KEYS.NOTEBOOKS);
    const unsyncedKey = getUserStorageKey(activeUserId, STORAGE_KEYS.UNSYNCED_NOTEBOOKS);
    await Promise.all([
      setIdbItem(notebooksKey, updated),
      setIdbItem(unsyncedKey, updatedUnsynced),
    ]);
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
        let cd = newRow.canvas_data;
        if (typeof cd === 'string') {
          try {
            cd = JSON.parse(cd);
          } catch {}
        }
        const isSelf = cd && (cd as any)._clientId === CLIENT_SESSION_ID;
        if (isSelf) {
          return;
        }

        const updatedPages = pages.map((p) => (p.id === newRow.id ? (newRow as PageRow) : p));
        set({ pages: updatedPages });

        getIdbItem<PageRow[]>(pagesKey, []).then((allPages) => {
          const safePages = allPages || [];
          const updatedAll = safePages.map((p) => (p.id === newRow.id ? (newRow as PageRow) : p));
          setIdbItem(pagesKey, updatedAll);
        });

        if (newRow.id === currentPageId) {
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
    const updatedUnsynced = Array.from(new Set([...get().unsyncedNotebookIds, activeNotebookId]));
    set({ pages: updatedPages, currentPageId: newPage.id, unsyncedNotebookIds: updatedUnsynced });

    const pagesKey = getUserStorageKey(userId, STORAGE_KEYS.PAGES);
    const unsyncedKey = getUserStorageKey(userId, STORAGE_KEYS.UNSYNCED_NOTEBOOKS);
    const allPages = (await getIdbItem<PageRow[]>(pagesKey, [])) || [];
    await Promise.all([
      setIdbItem(pagesKey, [...allPages, newPage]),
      setIdbItem(unsyncedKey, updatedUnsynced),
    ]);
  },

  removePage: async (id: string) => {
    const { pages, currentPageId, activeUserId, activeNotebookId } = get();
    if (pages.length <= 1) return; // Retain at least 1 page

    const newPages = pages.filter((p) => p.id !== id);
    const newCurrentPageId = currentPageId === id ? newPages[newPages.length - 1].id : currentPageId;

    const updatedUnsynced = activeNotebookId ? Array.from(new Set([...get().unsyncedNotebookIds, activeNotebookId])) : get().unsyncedNotebookIds;
    set({ pages: newPages, currentPageId: newCurrentPageId, unsyncedNotebookIds: updatedUnsynced });

    const pagesKey = getUserStorageKey(activeUserId, STORAGE_KEYS.PAGES);
    const unsyncedKey = getUserStorageKey(activeUserId, STORAGE_KEYS.UNSYNCED_NOTEBOOKS);
    const allPages = (await getIdbItem<PageRow[]>(pagesKey, [])) || [];
    await Promise.all([
      setIdbItem(pagesKey, allPages.filter((p) => p.id !== id)),
      setIdbItem(unsyncedKey, updatedUnsynced),
    ]);

    if (activeUserId && isValidUUID(activeUserId) && isValidUUID(id)) {
      try {
        await supabase.from('pages').delete().eq('id', id);
      } catch (e) {
        console.warn('Error deleting page from cloud:', e);
      }
    }
  },

  switchPage: async (id: string) => {
    const { pages } = get();
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

  updatePageData: async (id: string, canvasData: string | any, explicitBg?: Partial<BgSettings>) => {
    const { bgType, bgColor, isRuled, ruleColor, pageSize, pageOrientation, activeUserId, pages, currentPageId } = get();
    
    // Determine background settings: if explicitBg given, apply it; otherwise if current active page, use active store settings; otherwise retain page's own settings!
    const targetPage = pages.find((p) => p.id === id);
    const targetExistingBg = extractBgSettingsFromPage(targetPage);

    const currentBg: BgSettings = {
      bgType: explicitBg?.bgType ?? (id === currentPageId ? bgType : targetExistingBg.bgType),
      bgColor: explicitBg?.bgColor ?? (id === currentPageId ? bgColor : targetExistingBg.bgColor),
      isRuled: explicitBg?.isRuled ?? (id === currentPageId ? isRuled : targetExistingBg.isRuled),
      ruleColor: explicitBg?.ruleColor ?? (id === currentPageId ? ruleColor : targetExistingBg.ruleColor),
      pageSize: explicitBg?.pageSize ?? (id === currentPageId ? pageSize : targetExistingBg.pageSize),
      pageOrientation: explicitBg?.pageOrientation ?? (id === currentPageId ? pageOrientation : targetExistingBg.pageOrientation),
    };

    let formattedData: any;
    if (typeof canvasData === 'string' && canvasData.trim()) {
      try {
        formattedData = JSON.parse(canvasData);
      } catch {
        formattedData = { objects: [] };
      }
    } else if (canvasData && typeof canvasData === 'object') {
      formattedData = { ...canvasData };
    } else {
      formattedData = { objects: [] };
    }

    formattedData.backgroundSettings = currentBg;
    formattedData._clientId = CLIENT_SESSION_ID;
    formattedData._clientTimestamp = Date.now();

    const now = new Date().toISOString();
    const updatedPages = get().pages.map((p) => (p.id === id ? { ...p, canvas_data: formattedData, updated_at: now } : p));
    
    // Instant synchronous in-memory store update (0ms UI latency)
    const pageObj = get().pages.find((p) => p.id === id);
    const targetNbId = pageObj?.notebook_id || get().activeNotebookId;
    const updatedUnsynced = targetNbId 
      ? Array.from(new Set([...get().unsyncedNotebookIds, targetNbId]))
      : get().unsyncedNotebookIds;

    set({ pages: updatedPages, unsyncedNotebookIds: updatedUnsynced });

    // Debounce IndexedDB persistent storage write so page transitions are lightning fast
    if (pageSaveTimers[id]) {
      clearTimeout(pageSaveTimers[id]);
    }
    pageSaveTimers[id] = setTimeout(async () => {
      delete pageSaveTimers[id];
      try {
        const pagesKey = getUserStorageKey(activeUserId, STORAGE_KEYS.PAGES);
        const unsyncedKey = getUserStorageKey(activeUserId, STORAGE_KEYS.UNSYNCED_NOTEBOOKS);
        const allPages = (await getIdbItem<PageRow[]>(pagesKey, [])) || [];
        const updatedAllPages = allPages.map((p) => (p.id === id ? { ...p, canvas_data: formattedData, updated_at: now } : p));
        if (!updatedAllPages.some((p) => p.id === id)) {
          const pToAdd = updatedPages.find((p) => p.id === id);
          if (pToAdd) updatedAllPages.push(pToAdd);
        }
        await Promise.all([
          setIdbItem(pagesKey, updatedAllPages),
          setIdbItem(unsyncedKey, updatedUnsynced),
        ]);
      } catch (e) {
        console.warn('Background page save error:', e);
      }
    }, 150);
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
    const updatedUnsynced = Array.from(new Set([...get().unsyncedNotebookIds, activeNotebookId]));
    set({
      pages: combined,
      currentPageId: firstNewPageId,
      bgType: defaultBg.bgType,
      bgColor: defaultBg.bgColor,
      isRuled: defaultBg.isRuled,
      ruleColor: defaultBg.ruleColor,
      pageSize: defaultBg.pageSize || 'a4',
      pageOrientation: defaultBg.pageOrientation || 'portrait',
      unsyncedNotebookIds: updatedUnsynced,
    });

    const pagesKey = getUserStorageKey(userId, STORAGE_KEYS.PAGES);
    const unsyncedKey = getUserStorageKey(userId, STORAGE_KEYS.UNSYNCED_NOTEBOOKS);
    const allPages = (await getIdbItem<PageRow[]>(pagesKey, [])) || [];
    const otherNotebookPages = allPages.filter((p) => p.notebook_id !== activeNotebookId);
    await Promise.all([
      setIdbItem(pagesKey, [...otherNotebookPages, ...combined]),
      setIdbItem(unsyncedKey, updatedUnsynced),
    ]);
  },

  setBgType: (type) => {
    set({ bgType: type });
    const { currentPageId, pages } = get();
    if (currentPageId) {
      const curPage = pages.find((p) => p.id === currentPageId);
      const rawData = curPage?.canvas_data || { objects: [] };
      get().updatePageData(currentPageId, rawData, { bgType: type });
    }
  },

  setBgColor: (color) => {
    set({ bgColor: color });
    const { currentPageId, pages } = get();
    if (currentPageId) {
      const curPage = pages.find((p) => p.id === currentPageId);
      const rawData = curPage?.canvas_data || { objects: [] };
      get().updatePageData(currentPageId, rawData, { bgColor: color });
    }
  },

  setIsRuled: (ruled) => {
    set({ isRuled: ruled });
    const { currentPageId, pages } = get();
    if (currentPageId) {
      const curPage = pages.find((p) => p.id === currentPageId);
      const rawData = curPage?.canvas_data || { objects: [] };
      get().updatePageData(currentPageId, rawData, { isRuled: ruled });
    }
  },

  setRuleColor: (color) => {
    set({ ruleColor: color });
    const { currentPageId, pages } = get();
    if (currentPageId) {
      const curPage = pages.find((p) => p.id === currentPageId);
      const rawData = curPage?.canvas_data || { objects: [] };
      get().updatePageData(currentPageId, rawData, { ruleColor: color });
    }
  },

  setPageSize: (size) => {
    set({ pageSize: size });
    const { currentPageId, pages } = get();
    if (currentPageId) {
      const curPage = pages.find((p) => p.id === currentPageId);
      const rawData = curPage?.canvas_data || { objects: [] };
      get().updatePageData(currentPageId, rawData, { pageSize: size });
    }
  },

  setPageOrientation: (orientation) => {
    set({ pageOrientation: orientation });
    const { currentPageId, pages } = get();
    if (currentPageId) {
      const curPage = pages.find((p) => p.id === currentPageId);
      const rawData = curPage?.canvas_data || { objects: [] };
      get().updatePageData(currentPageId, rawData, { pageOrientation: orientation });
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

  isToolbarAutoHide: typeof window !== 'undefined' ? localStorage.getItem('nova_toolbar_autohide') === 'true' : false,
  toggleToolbarAutoHide: () => set((state) => {
    const next = !state.isToolbarAutoHide;
    if (typeof window !== 'undefined') {
      localStorage.setItem('nova_toolbar_autohide', String(next));
    }
    return { isToolbarAutoHide: next };
  }),
  setToolbarAutoHide: (autoHide) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nova_toolbar_autohide', String(autoHide));
    }
    set({ isToolbarAutoHide: autoHide });
  },
}));
