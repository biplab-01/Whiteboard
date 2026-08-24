import { Moon, Search, Sun, LogOut, Plus, FileUp } from 'lucide-react';
import { useBoardStore } from '../../store/useBoardStore';
import { useAuthStore } from '../../store/useAuthStore';

interface TopBarProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onOpenImportModal: () => void;
}

export const TopBar = ({ searchQuery, setSearchQuery, onOpenImportModal }: TopBarProps) => {
  const { isDarkMode, toggleTheme, createNotebook, openNotebook } = useBoardStore();
  const { user, signOut, setShowAuthModal } = useAuthStore();
  
  const isAnonymous = user?.is_anonymous || !user?.email;

  const handleNewNotebook = async () => {
    const userId = user?.id || localStorage.getItem('nova_guest_id') || 'guest';
    const newId = await createNotebook('Untitled Notebook', null, userId);
    if (newId) {
      await openNotebook(newId);
    }
  };

  return (
    <header className="h-16 flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        <img 
          src="/logo.png" 
          alt="NovaBoard Logo" 
          className="h-10 w-10 object-contain rounded-xl shadow-md border border-white/10"
        />
        <div>
          <h1 className="font-bold text-base leading-tight tracking-tight flex items-center gap-0.5">
            <span className="text-[#38bdf8]">NOVA</span>
            <span className="text-[#f97316]">BOARD</span>
          </h1>
          <p className="text-[11px] opacity-60">Your notebooks</p>
        </div>
      </div>

      <div className="flex-1 max-w-xl mx-8 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input 
          type="text" 
          placeholder="Search notebooks" 
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className={`w-full pl-10 pr-4 py-2 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
            isDarkMode ? 'bg-gray-800/50 border-gray-700/50 text-gray-200 border hover:bg-gray-800' : 'bg-white border-gray-200 text-gray-900 border hover:bg-gray-50 shadow-sm'
          }`}
        />
      </div>

      <div className="flex items-center gap-3">
        <button 
          onClick={toggleTheme}
          className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-800 text-gray-400 hover:text-yellow-400' : 'hover:bg-gray-200 text-gray-600 hover:text-indigo-600'}`}
        >
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button 
          onClick={onOpenImportModal}
          className="flex items-center gap-1.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white px-3.5 py-2 rounded-lg text-sm font-medium transition-all shadow-md shadow-teal-500/20 hover:scale-[1.02]"
          title="Import multiple PDFs as separate notes"
        >
          <FileUp size={16} /> Import Docs
        </button>
        
        <button 
          onClick={handleNewNotebook}
          className="flex items-center gap-1 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> New notebook
        </button>

        <div className="flex items-center gap-2 pl-4 border-l border-gray-700">
          {isAnonymous ? (
            <>
              <button 
                onClick={() => setShowAuthModal(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                  isDarkMode ? 'border-gray-700 hover:bg-gray-800 text-gray-200' : 'border-gray-200 hover:bg-gray-100 text-gray-800'
                }`}
              >
                <LogOut size={14} className="rotate-180" /> <span className="hidden md:inline">Sign in</span>
              </button>
              <button 
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-600"
              >
                <span className="hidden md:inline">Sign up</span>
              </button>
            </>
          ) : (
            <>
              <span className="text-sm opacity-60 hidden md:block">{user?.email}</span>
              <button 
                onClick={() => signOut()}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isDarkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-200 text-gray-600'
                }`}
              >
                <LogOut size={14} /> <span className="hidden md:inline">Sign out</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
