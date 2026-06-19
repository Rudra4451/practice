'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUserStore } from '@/stores/user-store';
import { Sun, Moon, Zap, User, Menu, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
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
    const supabase = createClient();
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: activeSession } }) => {
      setSession(activeSession);
      if (activeSession?.user) {
        // Fetch profile
        supabase
          .from('profiles')
          .select('*')
          .eq('id', activeSession.user.id)
          .single()
          .then(({ data: profileData }) => {
            if (profileData) setProfile(profileData);
          });
      }
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        if (currentSession?.user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentSession.user.id)
            .single();
          if (profileData) setProfile(profileData);
        } else {
          setProfile(null);
          // If on a protected route, redirect to home page immediately
          const currentPath = window.location.pathname;
          if (currentPath.startsWith('/dashboard') || currentPath.startsWith('/profile')) {
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
    try {
      await signOut();
      showToast('Successfully signed out.');
    } catch (error) {
      console.error('Error signing out:', error);
      showToast('Unable to sign out. Please try again.', 'error');
    } finally {
      // Clear local states & redirect
      setSession(null);
      setProfile(null);
      router.push('/');
      router.refresh();
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-background border-b-3 border-border">
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        
        {/* Left Side: Brand Logo (TyProX Chevron X Monogram) */}
        <Link href="/" className="flex items-center gap-3 group">
          <svg className="w-7 h-7 flex-shrink-0 text-text-primary transition-transform duration-150 group-hover:scale-105" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M25 20L60 50L25 80" stroke="currentColor" strokeWidth="14" strokeLinecap="square" strokeLinejoin="miter" />
            <path d="M75 20L40 50L75 80" stroke="var(--accent)" strokeWidth="14" strokeLinecap="square" strokeLinejoin="miter" />
          </svg>
          <span className="font-sans font-bold text-lg md:text-xl tracking-tighter uppercase text-text-primary">
            TyProX
          </span>
        </Link>

        {/* Center: Desktop Menu (Grid layout items) */}
        <nav className="hidden md:flex items-center h-full text-xs font-bold uppercase tracking-wider border-l-2 border-border">
          <Link
            href="/typing"
            className={`h-full px-6 flex items-center border-r-2 border-border transition-colors duration-150 ${
              isActive('/typing')
                ? 'text-accent bg-surface-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-accent'
            }`}
          >
            Practice
          </Link>
          <Link
            href="/leaderboard"
            className={`h-full px-6 flex items-center border-r-2 border-border transition-colors duration-150 ${
              isActive('/leaderboard')
                ? 'text-accent bg-surface-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-accent'
            }`}
          >
            Leaderboards
          </Link>
          <Link
            href="/dashboard"
            className={`h-full px-6 flex items-center border-r-2 border-border transition-colors duration-150 ${
              isActive('/dashboard')
                ? 'text-accent bg-surface-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-accent'
            }`}
          >
            Dashboard
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
            className={`pb-2 border-b-2 border-border/10 transition-colors duration-150 ${
              isActive('/typing') ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Practice
          </Link>
          <Link
            href="/leaderboard"
            onClick={() => setMobileMenuOpen(false)}
            className={`pb-2 border-b-2 border-border/10 transition-colors duration-150 ${
              isActive('/leaderboard') ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Leaderboards
          </Link>
          <Link
            href="/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className={`pb-2 border-b-2 border-border/10 transition-colors duration-150 ${
              isActive('/dashboard') ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Dashboard
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
