import React, { useEffect } from 'react';
import { CheckCircle2, Cloud, Sparkles, X, RefreshCw, ShieldCheck } from 'lucide-react';
import { useBoardStore } from '../store/useBoardStore';
import { useAuthStore } from '../store/useAuthStore';

export const AlreadySyncedModal: React.FC = () => {
  const { 
    isAlreadySyncedModalOpen, 
    setIsAlreadySyncedModalOpen, 
    notebooks, 
    isDarkMode, 
    syncAllNotebooks, 
    isSyncing 
  } = useBoardStore();
  const { user } = useAuthStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAlreadySyncedModalOpen) {
        setIsAlreadySyncedModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAlreadySyncedModalOpen, setIsAlreadySyncedModalOpen]);

  if (!isAlreadySyncedModalOpen) return null;

  const handleForceRecheck = async () => {
    setIsAlreadySyncedModalOpen(false);
    if (user?.id) {
      await syncAllNotebooks(user.id);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={() => setIsAlreadySyncedModalOpen(false)}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-md p-6 sm:p-7 rounded-3xl shadow-2xl border animate-in zoom-in-95 duration-200 overflow-hidden ${
          isDarkMode 
            ? 'bg-[#1a1c29]/95 border-emerald-500/30 text-white shadow-emerald-950/20' 
            : 'bg-white border-emerald-200 text-gray-900 shadow-emerald-500/10'
        }`}
      >
        {/* Ambient background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close button */}
        <button
          onClick={() => setIsAlreadySyncedModalOpen(false)}
          className={`absolute top-4 right-4 p-2 rounded-xl transition-colors ${
            isDarkMode 
              ? 'text-gray-400 hover:text-white hover:bg-white/10' 
              : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
          }`}
          title="Close"
        >
          <X size={18} />
        </button>

        {/* Icon Header with pulse ring */}
        <div className="flex flex-col items-center text-center mt-2 mb-5">
          <div className="relative mb-3.5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <CheckCircle2 size={32} className="text-white" strokeWidth={2.5} />
            </div>
            <div className="absolute -inset-1 rounded-2xl bg-emerald-400/20 blur-sm -z-10 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 items-center justify-center text-[9px] text-white">
                <Sparkles size={9} />
              </span>
            </span>
          </div>

          <h3 className="text-xl font-bold tracking-tight mb-1 flex items-center gap-2">
            Already Synced!
          </h3>
          <p className="text-xs sm:text-sm text-gray-400 max-w-xs leading-relaxed">
            Every notebook and drawing is fully backed up and up to date with your cloud account.
          </p>
        </div>

        {/* Status Metrics Box */}
        <div className={`rounded-2xl p-4 mb-6 border ${
          isDarkMode ? 'bg-white/5 border-white/10' : 'bg-emerald-50/50 border-emerald-100'
        }`}>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="p-2.5 rounded-xl bg-black/10 dark:bg-white/5">
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider block mb-0.5">
                Total Notebooks
              </span>
              <span className="text-base font-bold text-emerald-400 flex items-center justify-center gap-1.5">
                <Cloud size={16} /> {notebooks.length}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-black/10 dark:bg-white/5">
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider block mb-0.5">
                Cloud Backup
              </span>
              <span className="text-base font-bold text-teal-400 flex items-center justify-center gap-1.5">
                <ShieldCheck size={16} /> 100% Synced
              </span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-white/5 text-center text-xs text-gray-400">
            Connected as <span className="font-semibold text-gray-300">{user?.email || 'Logged in user'}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <button
            onClick={() => setIsAlreadySyncedModalOpen(false)}
            className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold text-xs transition-all shadow-md shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            Got it
          </button>
          <button
            disabled={isSyncing}
            onClick={handleForceRecheck}
            className={`w-full sm:w-auto py-2.5 px-3.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              isDarkMode 
                ? 'border-gray-700 hover:bg-white/5 text-gray-300 hover:text-white' 
                : 'border-gray-200 hover:bg-gray-50 text-gray-600 hover:text-gray-900'
            }`}
            title="Force a full scan and sync with Supabase cloud"
          >
            <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
            <span>Force Re-check</span>
          </button>
        </div>
      </div>
    </div>
  );
};
