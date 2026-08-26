import { useEffect, useState } from 'react';
import { useAuthStore } from './store/useAuthStore';
import { useBoardStore } from './store/useBoardStore';
import { useRealtimeSync } from './hooks/useRealtimeSync';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard/Dashboard';
import { Board } from './components/Board';
import { Toolbar } from './components/Toolbar';
import { BackgroundSettings } from './components/BackgroundSettings';
import { PageManager } from './components/PageManager';
import { PropertiesPanel } from './components/PropertiesPanel';
import { TextPropertiesPanel } from './components/TextPropertiesPanel';
import { ZoomControls } from './components/ZoomControls';
import { ExportModal } from './components/ExportModal';
import { GraphingCalculator } from './components/GraphingCalculator';
import { NotebookTitle } from './components/NotebookTitle';
import { Moon, Sun, ArrowLeft } from 'lucide-react';

function App() {
  const { loading, initialize, showAuthModal, setShowAuthModal } = useAuthStore();
  const { activeNotebookId, closeNotebook, isDarkMode, toggleTheme, setCurrentTool } = useBoardStore();
  const [showCalculator, setShowCalculator] = useState(false);

  // Initialize Realtime Multi-Device Sync Subscriptions
  useRealtimeSync();


  useEffect(() => {
    const handleOpenCalc = () => setShowCalculator(true);
    window.addEventListener('open-calculator', handleOpenCalc);
    return () => window.removeEventListener('open-calculator', handleOpenCalc);
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input or contenteditable
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) {
        return;
      }
      
      const key = e.key.toLowerCase();
      
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      
      if (isCtrlOrMeta) {
        if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            window.dispatchEvent(new CustomEvent('board-redo'));
          } else {
            window.dispatchEvent(new CustomEvent('board-undo'));
          }
        } else if (key === 'y') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('board-redo'));
        }
      } else {
        switch (key) {
          case 'v': setCurrentTool('select'); break;
          case 'p': setCurrentTool('pen'); break;
          case 'h': setCurrentTool('highlighter'); break;
          case 'e': setCurrentTool('eraser'); break;
          case 'r': setCurrentTool('rectangle'); break;
          case 'c': setCurrentTool('circle'); break;
          case 'l': setCurrentTool('line'); break;
          case 't': setCurrentTool('text'); break;
          case ' ': setCurrentTool('pan'); e.preventDefault(); break; // prevent scroll
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) return;
      if (e.key === ' ') {
        setCurrentTool('select');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [setCurrentTool]);

  if (loading) {
    return <div className="h-screen flex items-center justify-center bg-gray-50">Loading...</div>;
  }

  const isBoardOpen = Boolean(activeNotebookId && activeNotebookId !== 'null' && activeNotebookId !== 'undefined');

  if (!isBoardOpen) {
    return (
      <>
        <Dashboard />
        {showAuthModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="relative bg-[#1a1c29] border border-gray-700/80 rounded-2xl shadow-2xl p-6 md:p-8 max-w-md w-full backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
              <button 
                onClick={() => setShowAuthModal(false)}
                className="absolute top-5 right-5 text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors text-sm"
              >
                ✕
              </button>
              <Auth />
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className={`w-full h-screen relative font-sans ${isDarkMode ? 'dark bg-[#121212]' : 'bg-gray-100'}`}>
      
      {/* Board is the core canvas taking full screen */}
      <Board />

      {/* UI Overlays */}
      <BackgroundSettings />
      <PageManager />
      <Toolbar />
      <PropertiesPanel />
      <TextPropertiesPanel />
      <ZoomControls />
      <ExportModal />
      <GraphingCalculator isOpen={showCalculator} onClose={() => setShowCalculator(false)} />

      {/* Top Center: Notebook Title Editor */}
      <NotebookTitle />

      {/* Back to Dashboard Button */}
      <button 
        onClick={() => {
          window.dispatchEvent(new CustomEvent('save-canvas-state'));
          setTimeout(() => {
            closeNotebook();
          }, 30);
        }}
        className={`fixed top-6 left-6 px-3.5 py-2.5 rounded-xl shadow-md border backdrop-blur-md transition-all z-20 flex items-center gap-2 text-sm font-medium ${
          isDarkMode ? 'bg-gray-800/80 border-gray-700 text-gray-200 hover:bg-gray-700' : 'bg-white/80 border-gray-200 text-gray-700 hover:bg-gray-50'
        }`}
        title="Back to Library"
      >
        <ArrowLeft size={18} /> <span className="pr-0.5">Library</span>
      </button>

      {/* Theme Toggle */}
      <button 
        onClick={toggleTheme}
        className={`fixed bottom-6 right-6 p-3 rounded-full shadow-lg border backdrop-blur-md transition-all z-20 ${
          isDarkMode ? 'bg-gray-800/80 border-gray-700 text-yellow-400 hover:bg-gray-700' : 'bg-white/80 border-gray-200 text-blue-900 hover:bg-gray-100'
        }`}
        title="Toggle Theme"
      >
        {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
      </button>

      {/* Global CSS for some specific overrides if needed */}
      <style>{`
        .custom-color-picker-wrapper .react-colorful {
          width: 100%;
          height: 120px;
        }
      `}</style>
    </div>
  );
}

export default App;
