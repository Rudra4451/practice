'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore } from '@/stores/user-store';
import { Sun, Moon, User, Menu, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { User as SupabaseUser, Session as SupabaseSession, AuthChangeEvent } from '@supabase/supabase-js';
import { resetClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { useToastStore } from '@/stores/toast-store';

export const Navbar: React.FC = () => {
  const { preferences, updatePreferences, session, setSession, profile, setProfile } = useUserStore();
  const { showToast } = useToastStore();
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (path: string) => {
    if (path === '/typing') return pathname === '/typing';
    if (path === '/leaderboard') return pathname === '/leaderboard';
    if (path === '/dashboard') return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
    return false;
  };
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [onlineCount, setOnlineCount] = useState(() => Math.floor(Math.random() * (550 - 350 + 1)) + 350);
  const [pulse, setPulse] = useState(false);

  // Simulated live online counter
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const updateCounter = () => {
      setOnlineCount(prev => {
        const change = Math.floor(Math.random() * (18 - 3 + 1)) + 3;
        const sign = Math.random() > 0.5 ? 1 : -1;
        let next = prev + (sign * change);
        if (next < 200) next = 200 + change;
        if (next > 700) next = 700 - change;
        return next;
      });
      setPulse(true);
      setTimeout(() => setPulse(false), 500);
      
      const nextDelay = Math.floor(Math.random() * 4000) + 6000;
      timeoutId = setTimeout(updateCounter, nextDelay);
    };
    
    timeoutId = setTimeout(updateCounter, Math.floor(Math.random() * 4000) + 6000);
    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  // Monitor scroll for shadow effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Listen to Supabase Auth Changes & ensure profile row exists
  useEffect(() => {
    const isDemoMode = typeof window !== 'undefined' && localStorage.getItem('typrox_demo') === 'true';
    if (isDemoMode) {
      if (!session) {
        const mockSession = { user: { id: 'mock-user-id', email: 'demo_user@typrox.com' } };
        const mockProfile = { id: 'mock-user-id', username: 'demo_typist', display_name: 'Guest Typist', avatar_url: null, theme: 'dark', font_family: 'ibm-plex-mono', created_at: new Date().toISOString() };
        setSession(mockSession);
        setProfile(mockProfile);
      }
      return;
    }

    const supabase = createClient();
    
    // Helper to ensure profile exists
    const ensureProfileExists = async (user: SupabaseUser | null) => {
      if (!user) return null;
      
      try {
        let { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (!profileData) {
          // Extract username/display name/avatar from OAuth user metadata
          const username = user.user_metadata?.user_name || 
                           user.user_metadata?.preferred_username || 
                           user.user_metadata?.username || 
                           `user_${user.id.substring(0, 8)}`;
          
          const displayName = user.user_metadata?.display_name || 
                              user.user_metadata?.full_name || 
                              username;
          
          const avatarUrl = user.user_metadata?.avatar_url || null;

          // 1. Create Profile row
          const { data: newProfile, error: profileErr } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              username: username.substring(0, 30), // respect varchar(30) limit
              display_name: displayName.substring(0, 50), // respect varchar(50) limit
              avatar_url: avatarUrl,
              theme: 'dark',
              font_family: 'ibm-plex-mono'
            })
            .select()
            .single();

          if (!profileErr && newProfile) {
            profileData = newProfile;
          }

          // 2. Create Streak row
          await supabase
            .from('streaks')
            .insert({ user_id: user.id })
            .maybeSingle();
        }

        return profileData;
      } catch (err) {
        console.error('Error ensuring profile exists:', err);
        return null;
      }
    };

    // Get initial session
    supabase.auth.getSession().then(async (res: { data: { session: SupabaseSession | null } }) => {
      const activeSession = res?.data?.session || null;
      setSession(activeSession);
      if (activeSession?.user) {
        const profileData = await ensureProfileExists(activeSession.user);
        if (profileData) setProfile(profileData);
      }
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, currentSession: SupabaseSession | null) => {
        setSession(currentSession);
        if (currentSession?.user) {
          const profileData = await ensureProfileExists(currentSession.user);
          if (profileData) setProfile(profileData);
        } else {
          setProfile(null);
          // If on a protected route, redirect to home page immediately
          const currentPath = window.location.pathname;
          if ((currentPath.startsWith('/dashboard') || currentPath.startsWith('/profile')) && currentPath !== '/dashboard/performance-lab') {
            router.push('/');
            router.refresh();
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [setSession, setProfile, router, session]);

  const toggleTheme = () => {
    const current = preferences.theme;
    updatePreferences({ theme: current === 'dark' ? 'light' : 'dark' });
  };

  const handleLogout = async () => {
    // 1. Clear demo state if active
    if (typeof window !== 'undefined' && localStorage.getItem('typrox_demo') === 'true') {
      localStorage.removeItem('typrox_demo_logged_in');
      localStorage.removeItem('typrox_demo');
      document.cookie = "typrox_demo_logged_in=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      setSession(null);
      setProfile(null);
      showToast('Successfully signed out.');
      router.push('/');
      router.refresh();
      return;
    }

    try {
      // 2. Call Supabase signOut
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Supabase signOut error:', error);
    }

    // 3. Force clean client-side tokens from localStorage and cookies
    if (typeof window !== 'undefined') {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('sb-') || key.startsWith('supabase.'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
      } catch (e) {
        console.error('Error clearing localStorage auth tokens:', e);
      }

      try {
        document.cookie.split(';').forEach(cookie => {
          const eqPos = cookie.indexOf('=');
          const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
          if (name.startsWith('sb-')) {
            document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
            document.cookie = `${name}=; path=/; domain=${window.location.hostname}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
          }
        });
      } catch (e) {
        console.error('Error clearing cookies:', e);
      }
    }

    // 4. Reset the client instance cache
    resetClient();

    // 5. Clear server-side tokens
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
    } catch (error) {
      console.error('Server signout endpoint error:', error);
    }

    // 6. Reset store states
    setSession(null);
    setProfile(null);

    // 7. Notify & redirect
    showToast('Successfully signed out.');
    router.push('/');
    router.refresh();
  };

  const navItems = [
    { href: '/typing', label: 'Practice', isActive: isActive('/typing') },
    { href: '/leaderboard', label: 'Leaderboards', isActive: isActive('/leaderboard') },
    { href: '/dashboard', label: 'Dashboard', isActive: isActive('/dashboard') && !pathname.endsWith('/performance-lab') },
    { href: '/dashboard/performance-lab', label: 'Performance Lab', isActive: pathname === '/dashboard/performance-lab' },
  ];

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? 'bg-background/80 backdrop-blur-xl border-b border-border shadow-sm'
          : 'bg-background/50 backdrop-blur-md border-b border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
        
        {/* Left: Logo & Online Counter */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <svg className="w-6 h-6 flex-shrink-0 text-text-primary transition-transform duration-200 group-hover:scale-110" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M25 20L60 50L25 80" stroke="currentColor" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M75 20L40 50L75 80" stroke="var(--accent)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-display font-bold text-lg tracking-tight text-text-primary">
              TyProX
            </span>
          </Link>

          {/* Online Counter */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-text-tertiary select-none">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className={`font-mono tabular-nums transition-all duration-300 ${pulse ? 'text-emerald-500' : ''}`}>
              {onlineCount}
            </span>
            <span>online</span>
          </div>
        </div>

        {/* Center: Desktop Nav */}
        <nav className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center h-9 bg-surface-accent/60 rounded-full p-0.5 gap-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`relative h-full px-4 flex items-center rounded-full text-[13px] font-medium transition-colors duration-200 ${
                item.isActive
                  ? 'text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {item.isActive && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-0 bg-surface rounded-full shadow-sm border border-border/60"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Right: Actions */}
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-accent rounded-xl transition-all duration-200 cursor-pointer"
            aria-label="Toggle theme"
          >
            <motion.div
              key={preferences.theme}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {preferences.theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </motion.div>
          </button>

          {session ? (
            <div className="flex items-center gap-2">
              <Button
                href="/dashboard"
                variant="ghost"
                className="px-3 py-1.5 text-[13px]"
              >
                <User className="w-3.5 h-3.5" />
                <span>{profile?.username || 'Profile'}</span>
              </Button>
              <button
                onClick={handleLogout}
                className="text-[13px] font-medium text-text-tertiary hover:text-error transition-colors cursor-pointer px-2 py-1"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Button
              href="/login"
              variant="primary"
              className="px-4 py-1.5 text-[13px]"
            >
              Sign In
            </Button>
          )}
        </div>

        {/* Mobile: Theme + Hamburger */}
        <div className="flex items-center gap-1.5 md:hidden">
          <button
            onClick={toggleTheme}
            className="p-2 text-text-secondary hover:text-text-primary rounded-xl transition-colors"
            aria-label="Toggle theme"
          >
            {preferences.theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Online - mobile */}
          <div className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-text-tertiary">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="font-mono tabular-nums">{onlineCount}</span>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-text-primary hover:bg-surface-accent rounded-xl transition-colors"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl px-4 py-5 flex flex-col gap-2"
          >
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  item.isActive
                    ? 'text-text-primary bg-surface-accent'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-accent/50'
                }`}
              >
                {item.label}
              </Link>
            ))}

            <div className="h-px bg-border my-2" />

            {session ? (
              <div className="flex flex-col gap-2">
                <Button
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  variant="secondary"
                  className="w-full justify-center"
                >
                  <User className="w-4 h-4" />
                  <span>{profile?.username || 'My Dashboard'}</span>
                </Button>
                <Button
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  variant="ghost"
                  className="w-full justify-center text-error hover:text-error"
                >
                  Sign Out
                </Button>
              </div>
            ) : (
              <Button
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                variant="primary"
                className="w-full"
              >
                Sign In
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
