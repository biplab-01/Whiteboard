import { Book, Folder as FolderIcon, Inbox, Plus } from 'lucide-react';
import { useBoardStore } from '../../store/useBoardStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useState } from 'react';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

export const Sidebar = ({ currentView, setCurrentView }: SidebarProps) => {
  const { folders, notebooks, createFolder, isDarkMode } = useBoardStore();
  const { user } = useAuthStore();
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

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

  const navItemClass = (id: string) => `flex items-center justify-between w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
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
              <button key={folder.id} onClick={() => setCurrentView(folder.id)} className={navItemClass(folder.id)}>
                <span className="flex items-center gap-2"><FolderIcon size={16} /> {folder.name}</span>
                <span className="text-xs opacity-60">{count}</span>
              </button>
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
    </aside>
  );
};
