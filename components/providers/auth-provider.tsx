'use client';

import React, { useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useUserStore, type UserProfile } from '@/stores/user-store';

const VALID_FONTS = new Set(['jetbrains-mono', 'ibm-plex-mono', 'geist-mono']);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { preferences, setSession, setProfile, updatePreferences } = useUserStore();

  // Keep <html> dark class and data-typing-font attribute synchronized with store
  useEffect(() => {
    const root = document.documentElement;
    if (preferences.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.dataset.typingFont = VALID_FONTS.has(preferences.font_family)
      ? preferences.font_family
      : 'jetbrains-mono';
  }, [preferences.theme, preferences.font_family]);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    const hydrateProfile = async (userId: string) => {
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, theme, font_family, created_at')
          .eq('id', userId)
          .maybeSingle();

        if (!mounted || !profileData) return;

        const typedProfile: UserProfile = {
          id: profileData.id,
          username: profileData.username,
          display_name: profileData.display_name,
          avatar_url: profileData.avatar_url,
          theme: profileData.theme,
          font_family: profileData.font_family,
          created_at: profileData.created_at,
        };
        setProfile(typedProfile);

        // Apply saved server preferences cleanly on hydration
        const patch: Partial<{ theme: 'light' | 'dark'; font_family: string }> = {};
        if (profileData.theme === 'light' || profileData.theme === 'dark') {
          patch.theme = profileData.theme;
        }
        if (profileData.font_family && VALID_FONTS.has(profileData.font_family)) {
          patch.font_family = profileData.font_family;
        }
        if (Object.keys(patch).length > 0) {
          updatePreferences(patch);
        }
      } catch (err) {
        console.error('Failed to hydrate user profile:', err);
      }
    };

    const bootstrapSession = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();

        if (!mounted) return;

        if (userData?.user) {
          setSession({ user: userData.user } as Session);
          await hydrateProfile(userData.user.id);
        } else {
          setSession(null);
          setProfile(null);
        }
      } catch (err) {
        console.error('Auth bootstrap error:', err);
      }
    };

    void bootstrapSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (!mounted) return;
      if (event === 'INITIAL_SESSION') return;

      if (!currentSession?.user) {
        setSession(null);
        setProfile(null);
        return;
      }

      setSession({ user: currentSession.user } as Session);
      void hydrateProfile(currentSession.user.id);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [setSession, setProfile, updatePreferences]);

  return <>{children}</>;
};

