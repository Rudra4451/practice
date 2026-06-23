'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUserStore } from '@/stores/user-store';
import { Sun, Moon, Zap, User, Menu, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { resetClient } from '@/lib/supabase/client';
import { signOut } from '@/lib/supabase/auth';
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
  const [onlineCount, setOnlineCount] = useState(429);
  const [pulse, setPulse] = useState(false);

  // Simulated live online counter
  useEffect(() => {
    // Seed random starting count
    setOnlineCount(Math.floor(Math.random() * (550 - 350 + 1)) + 350);
    
    let timeoutId: NodeJS.Timeout;
    const updateCounter = () => {
      setOnlineCount(prev => {
        const change = Math.floor(Math.random() * (18 - 3 + 1)) + 3;
        const sign = Math.random() > 0.5 ? 1 : -1;
        let next = prev + (sign * change);
        // Clamp between 200 and 700
        if (next < 200) next = 200 + change;
        if (next > 700) next = 700 - change;
        return next;
      });
      setPulse(true);
      const pulseTimeout = setTimeout(() => setPulse(false), 500);
      
      const nextDelay = Math.floor(Math.random() * 4000) + 6000; // 6-10 seconds
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

  // Listen to Auth State
  useEffect(() => {
    if (typeof window !== 'undefined' && (localStorage.getItem('typrox_demo') === 'true' || window.location.search.includes('demo=true'))) {
      localStorage.setItem('typrox_demo', 'true');
      if (localStorage.getItem('typrox_demo_logged_in') === 'true') {
        const mockSession = { user: { id: 'mock-user-id', email: 'rudra_practice@typrox.com' } };
        const mockProfile = { id: 'mock-user-id', username: 'rudra_practice', display_name: 'Rudra Pratap Swain', avatar_url: null, theme: 'dark', font_family: 'ibm-plex-mono', created_at: new Date().toISOString() };
        setSession(mockSession);
        setProfile(mockProfile);
        return;
      }
    }

    const supabase = createClient();
    
    // Helper to ensure profile exists
    const ensureProfileExists = async (user: any) => {
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
    supabase.auth.getSession().then(async (res: any) => {
      const activeSession = res?.data?.session || null;
      setSession(activeSession);
      if (activeSession?.user) {
        const profileData = await ensureProfileExists(activeSession.user);
        if (profileData) setProfile(profileData);
      }
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: any, currentSession: any) => {
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
  }, [setSession, setProfile, router]);

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

  return (
    <header className="sticky top-0 z-50 w-full bg-background border-b-3 border-border">
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between relative">
        
        {/* Left Side: Brand Logo & Online Counter */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3 group">
            <svg className="w-7 h-7 flex-shrink-0 text-text-primary transition-transform duration-150 group-hover:scale-105" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M25 20L60 50L25 80" stroke="currentColor" strokeWidth="14" strokeLinecap="square" strokeLinejoin="miter" />
              <path d="M75 20L40 50L75 80" stroke="var(--accent)" strokeWidth="14" strokeLinecap="square" strokeLinejoin="miter" />
            </svg>
            <span className="font-sans font-bold text-lg md:text-xl tracking-tighter uppercase text-text-primary">
              TyProX
            </span>
          </Link>

          {/* Live Online Badge - Desktop */}
          <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 border border-border bg-surface-accent text-[10px] font-black uppercase tracking-wider text-text-secondary select-none">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className={`inline-block transition-all duration-300 ${pulse ? 'scale-110 text-emerald-500 font-bold' : 'scale-100'}`}>
              {onlineCount} Online
            </span>
          </div>

          {/* Live Online Badge - Mobile */}
          <div className="flex lg:hidden items-center gap-1 px-1.5 py-0.5 border border-border bg-surface-accent text-[8px] font-black uppercase tracking-wider text-text-secondary select-none">
            <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
            <span className={`inline-block transition-all duration-300 ${pulse ? 'scale-110 text-emerald-500 font-bold' : 'scale-100'}`}>
              {onlineCount} Live
            </span>
          </div>
        </div>

        {/* Center: Desktop Menu (Floating Neobrutalist Pill) */}
        <nav className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center h-10 border-2 border-border bg-surface shadow-[3px_3px_0px_0px_var(--border)] overflow-hidden text-xs font-bold uppercase tracking-wider">
          <Link
            href="/typing"
            className={`h-full px-5 flex items-center border-r-2 border-border transition-colors duration-150 ${
              isActive('/typing')
                ? 'text-accent bg-surface-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-accent'
            }`}
          >
            Practice
          </Link>
          <Link
            href="/leaderboard"
            className={`h-full px-5 flex items-center border-r-2 border-border transition-colors duration-150 ${
              isActive('/leaderboard')
                ? 'text-accent bg-surface-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-accent'
            }`}
          >
            Leaderboards
          </Link>
          <Link
            href="/dashboard"
            className={`h-full px-5 flex items-center border-r-2 border-border transition-colors duration-150 ${
              isActive('/dashboard') && !pathname.endsWith('/performance-lab')
                ? 'text-accent bg-surface-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-accent'
            }`}
          >
            Dashboard
          </Link>
          <Link
            href="/dashboard/performance-lab"
            className={`h-full px-5 flex items-center transition-colors duration-150 ${
              isActive('/dashboard/performance-lab')
                ? 'text-accent bg-surface-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-accent'
            }`}
          >
            Performance Lab
          </Link>
        </nav>

        {/* Right Side: Options & Auth */}
        <div className="hidden md:flex items-center gap-3">
          {/* Theme switcher */}
          <button
            onClick={toggleTheme}
            className="p-2 text-text-primary hover:bg-accent hover:text-black border-3 border-border transition-all cursor-pointer"
            aria-label="Toggle theme"
          >
            {preferences.theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* User auth layout */}
          {session ? (
            <div className="flex items-center gap-3">
              <Button
                href="/dashboard"
                variant="secondary"
                className="px-4 py-2"
              >
                <User className="w-3.5 h-3.5" />
                <span>{profile?.username || 'Profile'}</span>
              </Button>
              <button
                onClick={handleLogout}
                className="text-xs font-bold uppercase tracking-wider text-text-secondary hover:text-error transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Button
              href="/login"
              variant="primary"
              className="px-5 py-2"
            >
              Sign In
            </Button>
          )}
        </div>

        {/* Mobile Hamburger Trigger */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            onClick={toggleTheme}
            className="p-2 text-text-primary border-3 border-border"
          >
            {preferences.theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-text-primary border-3 border-border"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t-2 border-border bg-background px-6 py-6 flex flex-col gap-4 animate-fade-in text-sm font-bold uppercase tracking-wider">
          <Link
            href="/typing"
            onClick={() => setMobileMenuOpen(false)}
            className={`pb-2 px-3 py-1.5 border-3 transition-all duration-150 ${
              isActive('/typing')
                ? 'text-accent bg-surface-accent border-accent'
                : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-surface-accent/50'
            }`}
          >
            Practice
          </Link>
          <Link
            href="/leaderboard"
            onClick={() => setMobileMenuOpen(false)}
            className={`pb-2 px-3 py-1.5 border-3 transition-all duration-150 ${
              isActive('/leaderboard')
                ? 'text-accent bg-surface-accent border-accent'
                : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-surface-accent/50'
            }`}
          >
            Leaderboards
          </Link>
          <Link
            href="/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className={`pb-2 px-3 py-1.5 border-3 transition-all duration-150 ${
              isActive('/dashboard') && !pathname.endsWith('/performance-lab')
                ? 'text-accent bg-surface-accent border-accent'
                : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-surface-accent/50'
            }`}
          >
            Dashboard
          </Link>
          <Link
            href="/dashboard/performance-lab"
            onClick={() => setMobileMenuOpen(false)}
            className={`pb-2 px-3 py-1.5 border-3 transition-all duration-150 ${
              isActive('/dashboard/performance-lab')
                ? 'text-accent bg-surface-accent border-accent'
                : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-surface-accent/50'
            }`}
          >
            Performance Lab
          </Link>
          {session ? (
            <div className="flex flex-col gap-4 pt-2">
              <Button
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                variant="secondary"
                className="w-full flex justify-center gap-2 px-4 py-2"
              >
                <User className="w-4 h-4" />
                <span>{profile?.username || 'My Dashboard'}</span>
              </Button>
              <Button
                onClick={() => {
                  handleLogout();
                  setMobileMenuOpen(false);
                }}
                variant="danger"
                className="w-full"
              >
                Sign Out
              </Button>
            </div>
          ) : (
            <Button
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              variant="primary"
              className="px-4 py-2.5 w-full"
            >
              Sign In
            </Button>
          )}
        </div>
      )}
    </header>
  );
};
