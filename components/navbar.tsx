'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore } from '@/stores/user-store';
import { useToastStore } from '@/stores/toast-store';
import { createClient, resetClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';
import {
  Sun,
  Moon,
  Menu,
  X,
  ChevronDown,
  LayoutDashboard,
  User as UserIcon,
  Settings,
  LogOut,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { preferences, updatePreferences, session, setSession, profile, setProfile } =
    useUserStore();
  const { showToast } = useToastStore();
  const pathname = usePathname() || '/';
  const router = useRouter();

  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdown and mobile drawer on Escape or outside click
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAccountMenuOpen(false);
        setMobileMenuOpen(false);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(e.target as Node)
      ) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const persistThemePreference = (nextTheme: 'light' | 'dark') => {
    updatePreferences({ theme: nextTheme });
    if (session?.user) {
      void fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: nextTheme }),
      }).catch(() => undefined);
    }
  };

  const toggleTheme = () => {
    persistThemePreference(preferences.theme === 'dark' ? 'light' : 'dark');
  };

  const handleLogout = async () => {
    setAccountMenuOpen(false);
    setMobileMenuOpen(false);

    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Supabase signOut error:', error);
    }

    if (typeof window !== 'undefined') {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('sb-') || key.startsWith('supabase.'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
      } catch (e) {
        console.error('Error clearing localStorage auth tokens:', e);
      }
    }

    resetClient();

    try {
      await fetch('/api/auth/signout', { method: 'POST' });
    } catch (error) {
      console.error('Server signout endpoint error:', error);
    }

    setSession(null);
    setProfile(null);
    showToast('Successfully signed out.');
    router.push('/');
    router.refresh();
  };

  const navItems = [
    { href: '/typing', label: 'Practice', isActive: pathname === '/typing' },
    {
      href: '/learn',
      label: 'Learn',
      isActive: pathname === '/learn' || pathname.startsWith('/learn/'),
    },
    { href: '/daily', label: 'Daily', isActive: pathname === '/daily' },
    { href: '/leaderboard', label: 'Leaderboards', isActive: pathname === '/leaderboard' },
    {
      href: '/dashboard',
      label: 'Dashboard',
      isActive: pathname === '/dashboard',
    },
    {
      href: '/dashboard/performance-lab',
      label: 'Lab',
      isActive: pathname === '/dashboard/performance-lab',
    },
  ];

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? 'bg-background/90 backdrop-blur-xl border-b border-border shadow-sm'
          : 'bg-background/70 backdrop-blur-md border-b border-border/40'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-3">
        {/* Left: Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <svg
            className="w-6 h-6 flex-shrink-0 text-text-primary transition-transform duration-200 group-hover:scale-105"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M25 20L60 50L25 80"
              stroke="currentColor"
              strokeWidth="14"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M75 20L40 50L75 80"
              stroke="var(--accent)"
              strokeWidth="14"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="font-display font-bold text-lg tracking-tight text-text-primary">
            TyProX
          </span>
        </Link>

        {/* Center: Desktop Nav */}
        <nav
          aria-label="Primary Navigation"
          className="hidden lg:flex items-center h-9 bg-surface-accent/70 border border-border/60 rounded-full p-0.5 gap-0.5"
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`relative h-full px-3.5 flex items-center rounded-full text-[13px] font-medium transition-colors duration-200 whitespace-nowrap ${
                item.isActive
                  ? 'text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {item.isActive && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-0 bg-surface rounded-full shadow-xs border border-border"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Right: Actions */}
        <div className="hidden lg:flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-accent rounded-xl transition-colors cursor-pointer"
            aria-label={`Switch to ${preferences.theme === 'dark' ? 'light' : 'dark'} theme`}
            title={`Switch to ${preferences.theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {preferences.theme === 'dark' ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          <Link
            href="/profile"
            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${
              pathname === '/profile'
                ? 'bg-surface-accent text-text-primary border border-border'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-accent'
            }`}
            aria-label="Typing Settings"
            title="Typing & Display Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>

          {session ? (
            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                onClick={() => setAccountMenuOpen((prev) => !prev)}
                aria-expanded={accountMenuOpen}
                aria-haspopup="menu"
                className="inline-flex items-center gap-2 px-3 py-1.5 min-h-[38px] rounded-xl bg-surface border border-border text-text-primary hover:bg-surface-accent text-[13px] font-medium transition-colors cursor-pointer"
              >
                <UserAvatar
                  avatarUrl={profile?.avatar_url}
                  alt={profile?.username || 'Account avatar'}
                  size="sm"
                />
                <span className="max-w-[110px] truncate">
                  {profile?.username || 'Account'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-text-secondary" />
              </button>

              {accountMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-52 rounded-2xl bg-surface border border-border shadow-xl p-1.5 flex flex-col gap-0.5 z-50"
                >
                  <Link
                    role="menuitem"
                    href="/dashboard"
                    onClick={() => setAccountMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-text-primary hover:bg-surface-accent transition-colors"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5 text-text-secondary" />
                    <span>Dashboard</span>
                  </Link>
                  {profile?.username && (
                    <Link
                      role="menuitem"
                      href={`/u/${profile.username}`}
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-text-primary hover:bg-surface-accent transition-colors"
                    >
                      <UserIcon className="w-3.5 h-3.5 text-text-secondary" />
                      <span>Public Profile</span>
                    </Link>
                  )}
                  <Link
                    role="menuitem"
                    href="/profile"
                    onClick={() => setAccountMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-text-primary hover:bg-surface-accent transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-text-secondary" />
                    <span>Settings</span>
                  </Link>
                  <div className="h-px bg-border my-1" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-error hover:bg-surface-accent transition-colors cursor-pointer text-left w-full"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Button
              href="/login"
              variant="primary"
              className="min-h-[38px] px-4 py-1.5 text-[13px]"
            >
              Sign In
            </Button>
          )}
        </div>

        {/* Mobile/Tablet: Theme + Drawer Toggle (>= 44px touch targets) */}
        <div className="flex items-center gap-1 lg:hidden">
          <button
            type="button"
            onClick={toggleTheme}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-accent rounded-xl transition-colors cursor-pointer"
            aria-label={`Switch to ${preferences.theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {preferences.theme === 'dark' ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-text-primary hover:bg-surface-accent rounded-xl transition-colors cursor-pointer"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="lg:hidden border-t border-border bg-background/95 backdrop-blur-xl px-4 py-4 flex flex-col gap-1.5"
          >
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`min-h-[44px] px-4 flex items-center rounded-xl text-sm font-medium transition-colors ${
                  item.isActive
                    ? 'text-text-primary bg-surface-accent border border-border'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-accent/60'
                }`}
              >
                {item.label}
              </Link>
            ))}

            <Link
              href="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className={`min-h-[44px] px-4 flex items-center gap-2 rounded-xl text-sm font-medium transition-colors ${
                pathname === '/profile'
                  ? 'text-text-primary bg-surface-accent border border-border'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-accent/60'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </Link>

            <div className="h-px bg-border my-2" />

            {session ? (
              <div className="flex flex-col gap-2">
                {profile?.username && (
                  <Button
                    href={`/u/${profile.username}`}
                    onClick={() => setMobileMenuOpen(false)}
                    variant="secondary"
                    className="w-full min-h-[44px]"
                  >
                    <UserIcon className="w-4 h-4" />
                    <span>Public Profile (u/{profile.username})</span>
                  </Button>
                )}
                <Button
                  onClick={handleLogout}
                  variant="ghost"
                  className="w-full min-h-[44px] text-error hover:text-error"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </Button>
              </div>
            ) : (
              <Button
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                variant="primary"
                className="w-full min-h-[44px]"
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
