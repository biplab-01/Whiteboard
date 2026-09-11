import React from 'react';
import { Cloud, Check, RefreshCw, CloudOff, CloudUpload } from 'lucide-react';
import { useBoardStore, isValidUUID } from '../store/useBoardStore';
import { useAuthStore } from '../store/useAuthStore';

interface SyncStatusBadgeProps {
  variant?: 'compact' | 'full';
  className?: string;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({ variant = 'full', className = '' }) => {
  const { 
    isSyncing, 
    syncStatusText, 
    syncProgress, 
    activeUserId, 
    isDarkMode, 
    notebooks, 
    unsyncedNotebookIds, 
    triggerSyncOrShowModal 
  } = useBoardStore();
  const { user, setShowAuthModal } = useAuthStore();

  const isAuth = user?.id && isValidUUID(user.id) && !user.is_anonymous;

  // Calculate active unsynced count for notebooks currently existing in library
  const currentNotebookIds = new Set(notebooks.map((n) => n.id));
  const activeUnsyncedCount = unsyncedNotebookIds.filter((id) => currentNotebookIds.has(id)).length;
  const isAllSynced = isAuth && activeUnsyncedCount === 0;

  const handleManualSync = async () => {
    if (!isAuth) {
      setShowAuthModal(true);
      return;
    }
    await triggerSyncOrShowModal(activeUserId || user?.id);
  };

  if (!isAuth) {
    return (
      <button
        onClick={handleManualSync}
        className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98] ${
          isDarkMode
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/50'
            : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 hover:border-amber-300'
        } ${className}`}
        title="Your notes are stored locally on this device. Click to sign in and enable Realtime Multi-Device Cloud Sync."
      >
        <CloudOff size={14} className="text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
        {variant === 'full' ? (
          <span>
            <span className="font-semibold">Local Storage</span> • <span className="underline decoration-amber-400/50 hover:decoration-amber-400">Sign in to Sync</span>
          </span>
        ) : (
          <span>Local Only</span>
        )}
      </button>
    );
  }

  if (isSyncing) {
    return (
      <div
        className={`relative overflow-hidden flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all shadow-sm ${
          isDarkMode
            ? 'bg-teal-500/15 border-teal-500/40 text-teal-300'
            : 'bg-teal-50 border-teal-200 text-teal-700'
        } ${className}`}
        title="Syncing changes with Supabase cloud..."
      >
        {/* Animated Progress Bar underlay */}
        <div 
          className="absolute left-0 top-0 bottom-0 bg-teal-500/25 transition-all duration-200 ease-out" 
          style={{ width: `${Math.max(5, syncProgress)}%` }} 
        />
        <div className="relative z-10 flex items-center gap-1.5 w-full">
          <RefreshCw size={13} className="animate-spin text-teal-400 shrink-0" />
          <span className="truncate">{syncStatusText || `Syncing ${syncProgress}%...`}</span>
        </div>
      </div>
    );
  }

  // When some notebooks are not synced
  if (!isAllSynced && activeUnsyncedCount > 0) {
    return (
      <button
        onClick={handleManualSync}
        className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98] ${
          isDarkMode
            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25 hover:border-amber-500/60'
            : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100 hover:border-amber-400'
        } ${className}`}
        title={`${activeUnsyncedCount} notebook${activeUnsyncedCount > 1 ? 's' : ''} have unsynced changes. Click to sync now.`}
      >
        <div className="relative flex items-center justify-center">
          <CloudUpload size={14} className="text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping" />
        </div>
        {variant === 'full' ? (
          <span>
            <span className="font-semibold text-amber-400">{activeUnsyncedCount} Not Synced</span>
            <span className="opacity-70 ml-1 group-hover:opacity-100 transition-opacity hidden sm:inline">(Click to Sync)</span>
          </span>
        ) : (
          <span className="font-semibold">{activeUnsyncedCount} Unsynced</span>
        )}
      </button>
    );
  }

  // All notebooks are synced
  return (
    <button
      onClick={handleManualSync}
      className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98] ${
        syncStatusText
          ? isDarkMode
            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          : isDarkMode
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/50'
          : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300'
      } ${className}`}
      title={`All ${notebooks.length} notebooks are backed up and synced to the cloud. Click to sync.`}
    >
      {syncStatusText ? (
        <>
          <Check size={13} className="text-emerald-400 shrink-0" />
          <span>{syncStatusText}</span>
        </>
      ) : (
        <>
          <div className="relative flex items-center justify-center">
            <Cloud size={14} className="text-emerald-400 group-hover:scale-110 transition-transform shrink-0" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          </div>
          {variant === 'full' ? (
            <span>
              <span className="font-semibold text-emerald-400">All Synced</span>
              <span className="opacity-60 ml-1 group-hover:opacity-100 transition-opacity hidden sm:inline">(Click to Sync)</span>
            </span>
          ) : (
            <span>All Synced</span>
          )}
        </>
      )}
    </button>
  );
};
