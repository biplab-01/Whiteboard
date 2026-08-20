import React from 'react';
import { useBoardStore } from '../store/useBoardStore';
import { useAuthStore } from '../store/useAuthStore';
import { Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

export const PageManager: React.FC = () => {
  const { pages, currentPageId, addPage, removePage, switchPage, isDarkMode } = useBoardStore();
  const { user } = useAuthStore();

  const currentIndex = pages.findIndex(p => p.id === currentPageId);
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === pages.length - 1;

  const handlePrev = () => {
    if (!isFirst) {
      window.dispatchEvent(new CustomEvent('save-canvas-state'));
      switchPage(pages[currentIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (!isLast) {
      window.dispatchEvent(new CustomEvent('save-canvas-state'));
      switchPage(pages[currentIndex + 1].id);
    }
  };

  const handleAddPage = () => {
    if (user) {
      window.dispatchEvent(new CustomEvent('save-canvas-state'));
      addPage(user.id);
    }
  };

  return (
    <div className={`fixed top-6 right-6 z-10 flex items-center gap-2 p-2 rounded-xl shadow-lg border backdrop-blur-md ${
      isDarkMode ? 'bg-gray-800/80 border-gray-700 text-white' : 'bg-white/80 border-gray-200 text-gray-800'
    }`}>
      <button 
        onClick={handlePrev} 
        disabled={isFirst}
        className={`p-2 rounded-lg transition-colors ${isFirst ? 'opacity-30 cursor-not-allowed' : (isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100')}`}
      >
        <ChevronLeft size={20} />
      </button>

      <div className="flex items-center gap-2 px-2 font-medium">
        <span className="text-sm">
          Page {currentIndex + 1} of {pages.length}
        </span>
      </div>

      <button 
        onClick={handleNext} 
        disabled={isLast}
        className={`p-2 rounded-lg transition-colors ${isLast ? 'opacity-30 cursor-not-allowed' : (isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100')}`}
      >
        <ChevronRight size={20} />
      </button>

      <div className={`w-px h-6 mx-1 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`}></div>

      <button 
        onClick={handleAddPage}
        title="Add New Page"
        className={`p-2 rounded-lg transition-colors text-blue-500 ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-blue-50'}`}
      >
        <Plus size={20} />
      </button>

      {pages.length > 1 && (
        <button 
          onClick={() => { if (currentPageId) removePage(currentPageId); }}
          title="Delete Current Page"
          className={`p-2 rounded-lg transition-colors text-red-500 ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-red-50'}`}
        >
          <Trash2 size={20} />
        </button>
      )}
    </div>
  );
};
