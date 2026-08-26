import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useBoardStore, isValidUUID } from '../store/useBoardStore';

/**
 * Hook to manage bidirectional Supabase Realtime synchronization across all devices
 * for Library (folders & notebooks) and Active Board Pages.
 */
export const useRealtimeSync = () => {
  const { user } = useAuthStore();
  const { activeNotebookId, handleRealtimeFolderChange, handleRealtimeNotebookChange, handleRealtimePageChange } = useBoardStore();

  const libraryChannelRef = useRef<RealtimeChannel | null>(null);
  const notebookChannelRef = useRef<RealtimeChannel | null>(null);

  // 1. Library-level Realtime Subscription (folders & notebooks for authenticated user)
  useEffect(() => {
    const userId = user?.id;
    if (!userId || !isValidUUID(userId)) {
      if (libraryChannelRef.current) {
        supabase.removeChannel(libraryChannelRef.current);
        libraryChannelRef.current = null;
      }
      return;
    }

    const channelName = `realtime:library:${userId}`;
    const channel = supabase.channel(channelName);

    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'folders',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          handleRealtimeFolderChange(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notebooks',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          handleRealtimeNotebookChange(payload);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Channel connected
        }
      });

    libraryChannelRef.current = channel;

    return () => {
      if (libraryChannelRef.current) {
        supabase.removeChannel(libraryChannelRef.current);
        libraryChannelRef.current = null;
      }
    };
  }, [user?.id, handleRealtimeFolderChange, handleRealtimeNotebookChange]);

  // 2. Active Notebook Realtime Subscription (pages for the active notebook)
  useEffect(() => {
    const userId = user?.id;
    if (!activeNotebookId || !isValidUUID(activeNotebookId) || !userId || !isValidUUID(userId)) {
      if (notebookChannelRef.current) {
        supabase.removeChannel(notebookChannelRef.current);
        notebookChannelRef.current = null;
      }
      return;
    }

    const channelName = `realtime:notebook:${activeNotebookId}`;
    const channel = supabase.channel(channelName);

    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pages',
          filter: `notebook_id=eq.${activeNotebookId}`,
        },
        (payload) => {
          handleRealtimePageChange(payload);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Page channel connected
        }
      });

    notebookChannelRef.current = channel;

    return () => {
      if (notebookChannelRef.current) {
        supabase.removeChannel(notebookChannelRef.current);
        notebookChannelRef.current = null;
      }
    };
  }, [activeNotebookId, user?.id, handleRealtimePageChange]);
};
