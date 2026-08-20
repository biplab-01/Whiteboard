import { useBoardStore } from '../../store/useBoardStore';
import { NotebookCard } from './NotebookCard';
import { Plus } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

interface NotebookGridProps {
  currentView: string;
  searchQuery: string;
}

export const NotebookGrid = ({ currentView, searchQuery }: NotebookGridProps) => {
  const { notebooks, folders, createNotebook, isDarkMode, openNotebook } = useBoardStore();
  const { user } = useAuthStore();

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
      <div className="flex items-center gap-3 mb-6 mt-2">
        {currentView !== 'all' && currentView !== 'unfiled' && <div className="text-yellow-500"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-1.22-1.8A2 2 0 0 0 7.53 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg></div>}
        <h2 className="text-xl font-bold">{viewTitle}</h2>
        <span className="text-sm opacity-50">{filteredNotebooks.length}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
        {/* Create New Card */}
        <button 
          onClick={handleCreateInView}
          className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed aspect-[4/3] transition-colors ${
            isDarkMode ? 'border-white/10 hover:border-white/20 hover:bg-[#1a1c29]/50 text-gray-400 hover:text-gray-200' : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50 text-gray-500 hover:text-indigo-600'
          }`}
        >
          <Plus size={32} className="mb-2" />
          <span className="font-medium">New notebook</span>
        </button>

        {filteredNotebooks.map(notebook => (
          <NotebookCard key={notebook.id} notebook={notebook} />
        ))}
      </div>
    </div>
  );
};
