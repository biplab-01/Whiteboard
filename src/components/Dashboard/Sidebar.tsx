import { Book, Folder as FolderIcon, Inbox, Plus, Trash2, AlertCircle } from 'lucide-react';
import { useBoardStore } from '../../store/useBoardStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useState } from 'react';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

export const Sidebar = ({ currentView, setCurrentView }: SidebarProps) => {
  const { folders, notebooks, createFolder, deleteFolder, isDarkMode } = useBoardStore();
  const { user } = useAuthStore();
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderToDelete, setFolderToDelete] = useState<{ id: string; name: string } | null>(null);

  const unfiledCount = notebooks.filter(n => !n.folder_id).length;

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      const userId = user?.id || localStorage.getItem('nova_guest_id') || 'guest';
      createFolder(newFolderName.trim(), userId);
      setNewFolderName('');
      setIsCreatingFolder(false);
    }
  };

  const confirmDeleteFolder = async () => {
    if (!folderToDelete) return;
    const id = folderToDelete.id;
    if (currentView === id) {
      setCurrentView('all');
    }
    await deleteFolder(id);
    setFolderToDelete(null);
  };

  const navItemClass = (id: string) => `group flex items-center justify-between w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    currentView === id 
      ? (isDarkMode ? 'bg-indigo-600/20 text-indigo-400' : 'bg-indigo-50 text-indigo-700') 
      : (isDarkMode ? 'text-gray-400 hover:bg-white/5 hover:text-gray-200' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900')
  }`;

  return (
    <aside className={`w-64 flex-shrink-0 flex flex-col pl-4 pr-2 overflow-y-auto custom-scrollbar border-r ${
      isDarkMode ? 'border-gray-800/50' : 'border-gray-200'
    }`}>
      
      <div className={`mb-6 p-2 rounded-xl border ${
        isDarkMode ? 'bg-[#1a1c29]/80 border-white/5' : 'bg-white border-gray-100 shadow-sm'
      }`}>
        <div className="px-3 text-xs font-semibold uppercase tracking-wider mb-2 mt-1 text-gray-500">Library</div>
        <nav className="space-y-1">
          <button onClick={() => setCurrentView('all')} className={navItemClass('all')}>
            <span className="flex items-center gap-2"><Book size={16} /> All notebooks</span>
            <span className="text-xs opacity-60">{notebooks.length}</span>
          </button>
          <button onClick={() => setCurrentView('unfiled')} className={navItemClass('unfiled')}>
            <span className="flex items-center gap-2"><Inbox size={16} /> Unfiled</span>
            <span className="text-xs opacity-60">{unfiledCount}</span>
          </button>
        </nav>

        <div className="px-3 text-xs font-semibold uppercase tracking-wider mt-6 mb-2 flex items-center justify-between text-gray-500">
          Folders
          <button onClick={() => setIsCreatingFolder(true)} className="hover:text-indigo-400 p-1" title="New Folder">
            <Plus size={14} />
          </button>
        </div>
        <nav className="space-y-1">
          {folders.map(folder => {
            const count = notebooks.filter(n => n.folder_id === folder.id).length;
            return (
              <div 
                key={folder.id} 
                className={`group flex items-center justify-between w-full rounded-lg text-sm font-medium transition-colors ${
                  currentView === folder.id 
                    ? (isDarkMode ? 'bg-indigo-600/20 text-indigo-400' : 'bg-indigo-50 text-indigo-700') 
                    : (isDarkMode ? 'text-gray-400 hover:bg-white/5 hover:text-gray-200' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900')
                }`}
              >
                <button 
                  onClick={() => setCurrentView(folder.id)} 
                  className="flex items-center gap-2 flex-1 text-left px-3 py-2 min-w-0"
                >
                  <FolderIcon size={16} className="shrink-0" />
                  <span className="truncate">{folder.name}</span>
                </button>
                <div className="flex items-center gap-1 pr-2">
                  <span className="text-xs opacity-60 group-hover:hidden">{count}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFolderToDelete({ id: folder.id, name: folder.name });
                    }}
                    className="hidden group-hover:flex items-center justify-center p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                    title={`Delete "${folder.name}" folder`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </nav>

        {isCreatingFolder && (
          <form onSubmit={handleCreateFolder} className="mt-2 px-2">
            <input 
              autoFocus
              type="text" 
              placeholder="Folder name..." 
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onBlur={() => setIsCreatingFolder(false)}
              className={`w-full text-sm px-3 py-1.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-900'
              }`}
            />
          </form>
        )}
      </div>

      {/* Cloud Sync Status in Sidebar */}
      <div className={`mt-auto mb-4 p-3 rounded-xl border ${
        isDarkMode ? 'bg-[#1a1c29]/90 border-white/5' : 'bg-white border-gray-200 shadow-sm'
      }`}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Cloud Sync</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
        <p className="text-[11px] opacity-60 mb-2.5 leading-relaxed">
          {user?.id && !user.is_anonymous ? 'All notebooks synchronized across devices.' : 'Using local storage. Sign in to sync.'}
        </p>
        <button
          onClick={() => {
            if (user?.id && !user.is_anonymous) {
              useBoardStore.getState().syncAllNotebooks(user.id);
            } else {
              useAuthStore.getState().setShowAuthModal(true);
            }
          }}
          className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm ${
            user?.id && !user.is_anonymous
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
              : 'bg-amber-600 hover:bg-amber-500 text-white'
          }`}
        >
          {user?.id && !user.is_anonymous ? 'Sync Library Now' : 'Sign in to Sync'}
        </button>
      </div>


      {/* Delete Folder Confirmation Dialog */}
      {folderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div 
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm p-5 rounded-2xl shadow-2xl border animate-in fade-in zoom-in-95 duration-150 ${
              isDarkMode ? 'bg-[#1a1c29] border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl bg-red-500/10 text-red-500">
                <AlertCircle size={22} />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Delete Folder?</h3>
                <p className="text-xs text-gray-400">"{folderToDelete.name}"</p>
              </div>
            </div>
            
            <p className="text-xs text-gray-400 mb-5 leading-relaxed">
              Notebooks inside this folder will be safely moved to <span className="font-medium text-indigo-400">Unfiled</span>.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setFolderToDelete(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteFolder}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-500 text-white transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Trash2 size={13} />
                <span>Delete Folder</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
