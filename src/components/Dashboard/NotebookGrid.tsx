import { useBoardStore } from '../../store/useBoardStore';
import { NotebookCard } from './NotebookCard';
import { Plus, FileUp, Cloud, RefreshCw, Check, CloudOff } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

interface NotebookGridProps {
  currentView: string;
  searchQuery: string;
  onOpenImportModal: () => void;
}

export const NotebookGrid = ({ currentView, searchQuery, onOpenImportModal }: NotebookGridProps) => {
  const { notebooks, folders, createNotebook, isDarkMode, openNotebook, isSyncing, syncStatusText, syncProgress, syncAllNotebooks } = useBoardStore();
  const { user, setShowAuthModal } = useAuthStore();

  const isAuth = user?.id && !user.is_anonymous;

  let filteredNotebooks = notebooks;
  let viewTitle = 'All notebooks';
  
  if (currentView === 'unfiled') {
    filteredNotebooks = notebooks.filter(n => !n.folder_id);
    viewTitle = 'Unfiled';
  } else if (currentView !== 'all') {
    filteredNotebooks = notebooks.filter(n => n.folder_id === currentView);
    const folder = folders.find(f => f.id === currentView);
    if (folder) viewTitle = folder.name;
  }

  if (searchQuery.trim()) {
    filteredNotebooks = filteredNotebooks.filter(n => n.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }

  const handleCreateInView = async () => {
    const userId = user?.id || localStorage.getItem('nova_guest_id') || 'guest';
    const folderId = (currentView === 'all' || currentView === 'unfiled') ? null : currentView;
    const newId = await createNotebook('Untitled Notebook', folderId, userId);
    if (newId) {
      await openNotebook(newId);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 mt-2">
        <div className="flex items-center gap-3">
          {currentView !== 'all' && currentView !== 'unfiled' && <div className="text-yellow-500"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-1.22-1.8A2 2 0 0 0 7.53 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg></div>}
          <h2 className="text-xl font-bold">{viewTitle}</h2>
          <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-white/5 border border-white/10 text-gray-400">{filteredNotebooks.length}</span>
        </div>

        {/* Sync All Notebooks Button */}
        <div className="flex items-center gap-2">
          <button
            disabled={isSyncing}
            onClick={() => {
              if (isAuth && user?.id) {
                syncAllNotebooks(user.id);
              } else {
                setShowAuthModal(true);
              }
            }}
            className={`relative overflow-hidden flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-sm hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
              isSyncing
                ? 'border-teal-500/50 bg-teal-500/15 text-teal-300'
                : syncStatusText
                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                : isAuth
                ? isDarkMode
                  ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 hover:border-indigo-500/60'
                  : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300'
                : isDarkMode
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/60'
                : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-300'
            }`}
            title={isAuth ? 'Fetch and synchronize all notebooks and drawings from Supabase' : 'Sign in to enable multi-device sync'}
          >
            {isSyncing && (
              <div 
                className="absolute left-0 top-0 bottom-0 bg-teal-500/25 transition-all duration-200 ease-out pointer-events-none" 
                style={{ width: `${Math.max(5, syncProgress)}%` }} 
              />
            )}
            <div className="relative z-10 flex items-center gap-2">
              {isSyncing ? (
                <>
                  <RefreshCw size={14} className="animate-spin text-teal-400" />
                  <span>{syncStatusText || `Syncing ${syncProgress}%...`}</span>
                </>
              ) : syncStatusText ? (
                <>
                  <Check size={14} className="text-emerald-400" />
                  <span>{syncStatusText}</span>
                </>
              ) : isAuth ? (
                <>
                  <Cloud size={14} className="text-indigo-400" />
                  <span>Sync All Notebooks</span>
                </>
              ) : (
                <>
                  <CloudOff size={14} className="text-amber-400" />
                  <span>Local Only • Sign in to Sync</span>
                </>
              )}
            </div>
          </button>
        </div>
      </div>


      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
        {/* Create New Card */}
        <button 
          onClick={handleCreateInView}
          className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed aspect-[4/3] transition-all hover:scale-[1.02] ${
            isDarkMode ? 'border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/5 text-gray-400 hover:text-gray-200' : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50 text-gray-500 hover:text-indigo-600'
          }`}
        >
          <div className="p-2.5 rounded-xl bg-indigo-500/10 mb-2 text-indigo-400">
            <Plus size={24} />
          </div>
          <span className="font-semibold text-sm">New notebook</span>
        </button>

        {/* Import Docs Card */}
        <button 
          onClick={onOpenImportModal}
          className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed aspect-[4/3] transition-all hover:scale-[1.02] ${
            isDarkMode ? 'border-teal-500/20 hover:border-teal-500/60 hover:bg-teal-500/5 text-teal-400/80 hover:text-teal-300' : 'border-teal-300/80 hover:border-teal-500 hover:bg-teal-50/60 text-teal-700'
          }`}
          title="Import multiple PDFs as separate notebooks"
        >
          <div className="p-2.5 rounded-xl bg-teal-500/10 mb-2 text-teal-400">
            <FileUp size={24} />
          </div>
          <span className="font-semibold text-sm">Import Docs</span>
          <span className="text-[11px] opacity-60">Batch PDF to Notes</span>
        </button>

        {filteredNotebooks.map(notebook => (
          <NotebookCard key={notebook.id} notebook={notebook} />
        ))}
      </div>
    </div>
  );
};
