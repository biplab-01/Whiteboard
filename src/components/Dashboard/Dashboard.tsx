import { useEffect, useState } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { NotebookGrid } from './NotebookGrid';
import { ImportDocsModal } from './ImportDocsModal';

export const Dashboard = () => {
  const { user } = useAuthStore();
  const { fetchLibrary, isDarkMode } = useBoardStore();
  
  // View states: 'all' | 'unfiled' | folderId
  const [currentView, setCurrentView] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    if (user) {
      fetchLibrary(user.id);
    }
  }, [user, fetchLibrary]);

  return (
    <div className={`w-full h-screen flex flex-col font-sans overflow-hidden transition-colors duration-200 ${
      isDarkMode ? 'bg-[#151623] bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#151623] to-teal-900/20 text-gray-200' : 'bg-gray-50 text-gray-800'
    }`}>
      <TopBar 
        searchQuery={searchQuery} 
        setSearchQuery={setSearchQuery} 
        onOpenImportModal={() => setShowImportModal(true)} 
      />
      <div className="flex flex-1 overflow-hidden pt-4">
        <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
        <main className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">
          <NotebookGrid 
            currentView={currentView} 
            searchQuery={searchQuery} 
            onOpenImportModal={() => setShowImportModal(true)} 
          />
        </main>
      </div>

      <ImportDocsModal 
        isOpen={showImportModal} 
        onClose={() => setShowImportModal(false)} 
        initialFolderId={currentView === 'all' || currentView === 'unfiled' ? null : currentView}
      />
    </div>
  );
};
