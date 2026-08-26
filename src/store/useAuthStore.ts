import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useBoardStore } from './useBoardStore';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
  initialize: () => Promise<void>;
  signInWithEmail: (email: string) => void;
  signOut: () => Promise<void>;
}

const getGuestUser = (): User => {
  let guestId = localStorage.getItem('nova_guest_id');
  if (!guestId) {
    guestId = `guest_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('nova_guest_id', guestId);
  }
  return {
    id: guestId,
    app_metadata: { provider: 'anonymous' },
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    is_anonymous: true,
  } as unknown as User;
};


export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  showAuthModal: false,
  setShowAuthModal: (show) => set({ showAuthModal: show }),

  signInWithEmail: (_email: string) => {
    // Kept for interface compatibility
  },

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        set({ session, user: session.user, loading: false });
        useBoardStore.setState({ activeUserId: session.user.id });
      } else {
        const guest = getGuestUser();
        set({ user: guest, session: null, loading: false });
        useBoardStore.setState({ activeUserId: guest.id });
      }
    } catch (err) {
      console.warn('Supabase auth session error:', err);
      const guest = getGuestUser();
      set({ user: guest, session: null, loading: false });
      useBoardStore.setState({ activeUserId: guest.id });
    }

    try {
      supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          set({ session, user: session.user, loading: false });
          useBoardStore.setState({ activeUserId: session.user.id });
        } else {
          const guest = getGuestUser();
          set({ session: null, user: guest, loading: false });
          useBoardStore.setState({ activeUserId: guest.id });
        }
      });
    } catch (e) {
      console.warn('Supabase auth listener error:', e);
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Sign out error:', e);
    }
    const newGuest = `guest_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('nova_guest_id', newGuest);
    const guestUser = getGuestUser();
    set({
      user: guestUser,
      session: null,
      loading: false
    });
    useBoardStore.getState().closeNotebook();
    useBoardStore.getState().fetchLibrary(guestUser.id);
  }
}));
