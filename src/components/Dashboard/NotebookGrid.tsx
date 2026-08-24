import { useBoardStore } from '../../store/useBoardStore';
import { NotebookCard } from './NotebookCard';
import { Plus, FileUp } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

interface NotebookGridProps {
  currentView: string;
  searchQuery: string;
  onOpenImportModal: () => void;
}

export const NotebookGrid = ({ currentView, searchQuery, onOpenImportModal }: NotebookGridProps) => {
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
