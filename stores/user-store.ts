import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Session } from '@supabase/supabase-js';

export interface UserPreferences {
  theme: 'light' | 'dark';
  font_family: string;
  volume: number;
}

export interface UserProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  theme: string;
  font_family: string;
  created_at: string;
}

export interface GuestResult {
  id: string;
  wpm: number;
  raw_wpm: number;
  accuracy: number;
  consistency: number;
  error_count: number;
  backspace_count: number;
  mode: string;
  duration: number;
  seed: string;
  created_at: string;
}

export interface AppSession {
  user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  };
  access_token?: string;
  expires_at?: number;
  [key: string]: unknown;
}

export type UserSession = Session | AppSession | null;

interface UserState {
  session: UserSession;
  profile: UserProfile | null;
  preferences: UserPreferences;
  guestHistory: GuestResult[];
  setSession: (session: UserSession) => void;
  setProfile: (profile: UserProfile | null) => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  addGuestResult: (result: GuestResult) => void;
  clearGuestHistory: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      session: null,
      profile: null,
      preferences: {
        theme: 'light',
        font_family: 'ibm-plex-mono',
        volume: 0.5,
      },
      guestHistory: [],

      setSession: (session) => set({ session }),
      
      setProfile: (profile) => set({ profile }),
      
      updatePreferences: (prefs) => {
        const currentPrefs = get().preferences;
        const newPrefs = { ...currentPrefs, ...prefs };
        
        // Dynamically toggle html dark class
        if (newPrefs.theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        
        set({ preferences: newPrefs });
      },

      addGuestResult: (result) => {
        const currentHistory = get().guestHistory;
        set({ guestHistory: [result, ...currentHistory].slice(0, 100) }); // Keep last 100 runs
      },

      clearGuestHistory: () => set({ guestHistory: [] }),
    }),
    {
      name: 'user-store',
      partialize: (state) => ({
        preferences: state.preferences,
        guestHistory: state.guestHistory,
      }),
    }
  )
);
