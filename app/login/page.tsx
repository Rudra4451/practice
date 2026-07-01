'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/stores/user-store';
import { Navbar } from '@/components/navbar';
import { Mail, Zap, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react';
import { signInWithGoogle, signInWithGithub } from '@/lib/supabase/auth';
import { Button } from '@/components/ui/button';

function LoginCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useUserStore();
  
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (session) {
      router.push('/dashboard');
    }
  }, [session, router]);

  // Load URL errors
  useEffect(() => {
    const err = searchParams.get('error');
    if (err === 'auth-failed') {
      setErrorMsg('Authentication failed. Please check your link or try again.');
    }
  }, [searchParams]);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const isDemo = typeof window !== 'undefined' && (localStorage.getItem('typrox_demo') === 'true' || window.location.search.includes('demo=true'));
    if (isDemo) {
      setTimeout(() => {
        setSuccessMsg('Check your inbox — the magic link is on its way.');
        localStorage.setItem('typrox_demo', 'true');
        localStorage.setItem('typrox_demo_logged_in', 'true');
        document.cookie = "typrox_demo_logged_in=true; path=/; max-age=86400";
        const mockSession = { user: { id: 'mock-user-id', email: 'rudra_practice@typrox.com' } };
        const mockProfile = { id: 'mock-user-id', username: 'rudra_practice', display_name: 'Rudra Pratap Swain', avatar_url: null, theme: 'dark', font_family: 'ibm-plex-mono', created_at: new Date().toISOString() };
        useUserStore.getState().setSession(mockSession);
        useUserStore.getState().setProfile(mockProfile);
        setTimeout(() => {
          router.push('/dashboard?demo=true');
        }, 1000);
      }, 1000);
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
      setSuccessMsg('Check your inbox — the magic link is on its way.');
      setEmail('');
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    setLoading(true);
    setErrorMsg('');

    const isDemo = typeof window !== 'undefined' && (localStorage.getItem('typrox_demo') === 'true' || window.location.search.includes('demo=true'));
    if (isDemo) {
      setTimeout(() => {
        localStorage.setItem('typrox_demo', 'true');
        localStorage.setItem('typrox_demo_logged_in', 'true');
        document.cookie = "typrox_demo_logged_in=true; path=/; max-age=86400";
        const mockSession = { user: { id: 'mock-user-id', email: `${provider}_user@typrox.com` } };
        const mockProfile = { id: 'mock-user-id', username: 'rudra_practice', display_name: 'Rudra Pratap Swain', avatar_url: null, theme: 'dark', font_family: 'ibm-plex-mono', created_at: new Date().toISOString() };
        useUserStore.getState().setSession(mockSession);
        useUserStore.getState().setProfile(mockProfile);
        router.push('/dashboard?demo=true');
      }, 1000);
      return;
    }

    try {
      if (provider === 'google') {
        await signInWithGoogle();
      } else {
        await signInWithGithub();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during provider authentication.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 bg-surface/30 backdrop-blur-md border border-border/60 rounded-2xl relative shadow-xl overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-accent/20 rounded-full blur-[100px]" />
        <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-warning/20 rounded-full blur-[100px]" />
      </div>

      {/* Left Column: Login Form */}
      <div className="p-10 border-b border-border/60 md:border-b-0 md:border-r flex flex-col justify-center gap-6 font-sans relative z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center gap-3 text-center border-b border-border/60 pb-6">
          <svg className="w-10 h-10 flex-shrink-0 text-text-primary drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M25 20L60 50L25 80" stroke="currentColor" strokeWidth="14" strokeLinecap="square" strokeLinejoin="miter" />
            <path d="M75 20L40 50L75 80" stroke="var(--accent)" strokeWidth="14" strokeLinecap="square" strokeLinejoin="miter" className="drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
          </svg>
          <h1 className="text-3xl font-black uppercase tracking-tight text-text-primary">Join TYPROX</h1>
          <div className="text-xs font-bold uppercase tracking-wider text-text-secondary flex flex-wrap justify-center gap-1.5 max-w-xs leading-normal">
            <span>Save records</span>
            <span className="opacity-80">·</span>
            <span>Build streaks</span>
            <span className="opacity-80">·</span>
            <span>Track progress</span>
            <span className="opacity-80">·</span>
            <span>Compete globally</span>
          </div>
        </div>

        {/* Messages */}
        {errorMsg && (
          <div className="p-3 bg-error/15 border-2 border-error text-error text-xs font-bold uppercase tracking-wide flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wide flex items-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Magic Link Form */}
        <form onSubmit={handleMagicLink} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-xs font-bold text-text-secondary uppercase tracking-widest">
              Email Address
            </label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3.5 w-4 h-4 text-text-secondary" />
              <input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="w-full pl-10 pr-4 py-3 bg-surface/50 border border-border/80 focus:border-accent text-sm font-bold transition-all focus:ring-1 focus:ring-accent/20 focus:shadow-[0_0_15px_rgba(99,102,241,0.15)] outline-none text-text-primary rounded-xl"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading || !email}
            variant="primary"
            className="w-full"
          >
            <span>Send Magic Link</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </form>

        {/* Divider */}
        <div className="relative flex items-center justify-center py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/60" />
          </div>
          <span className="relative px-3 bg-transparent backdrop-blur-md text-xs font-bold text-text-secondary uppercase tracking-widest">
            Or Continue With
          </span>
        </div>

        {/* OAuth Buttons */}
        <div className="flex gap-4">
          {/* GitHub */}
          <Button
            onClick={() => handleOAuth('github')}
            disabled={loading}
            variant="secondary"
            className="flex-1"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            <span>GitHub</span>
          </Button>

          {/* Google */}
          <Button
            onClick={() => handleOAuth('google')}
            disabled={loading}
            variant="secondary"
            className="flex-1"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Google</span>
          </Button>
        </div>
      </div>

      {/* Right Column: Premium Value Panel */}
      <div className="p-10 bg-surface-accent/20 flex flex-col justify-between gap-8 font-sans relative z-10 border-l border-border/40">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-accent fill-current drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
            <span className="text-xs font-black uppercase tracking-widest text-text-primary">Join the Community</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-text-primary leading-tight text-left">
            Save Your Records.
          </h2>
          <p className="text-sm text-text-secondary font-semibold leading-relaxed text-left">
            Become a part of the TyProX typing community to build your stats, test your skills, and see where you rank globally.
          </p>

          {/* Value checkmarks */}
          <div className="flex flex-col gap-3.5 text-xs font-bold uppercase tracking-wider text-text-primary text-left">
            {[
              { title: 'Save your records', desc: 'Maintain a complete historical record of every test run' },
              { title: 'Build typing streaks', desc: 'Practice consistently and lock in your daily habit' },
              { title: 'Track your progress', desc: 'Analyze accuracy, key speeds, and progression trends' },
              { title: 'Compete globally', desc: 'Submit verified scores to the official rankings' }
            ].map((item, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="w-5 h-5 bg-accent/20 border border-accent/40 rounded-full flex items-center justify-center text-[10px] text-accent flex-shrink-0 mt-0.5 shadow-[0_0_10px_rgba(99,102,241,0.2)]">✔</div>
                <div className="flex flex-col">
                  <span className="leading-none text-text-primary">{item.title}</span>
                  <span className="text-xs text-text-secondary mt-1 font-semibold normal-case">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mini Mock Stats Grid */}
        <div className="p-5 bg-surface/50 border border-border/60 rounded-xl flex flex-col gap-3 text-left shadow-sm">
          <div className="flex justify-between items-center border-b border-border/40 pb-2">
            <span className="text-xs font-black uppercase tracking-widest text-text-primary">Simulated Profile</span>
            <span className="text-xs font-bold text-accent uppercase tracking-widest flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              Active
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Best Speed', value: '142 WPM' },
              { label: 'Active Streak', value: '18 Days' },
              { label: 'Rank', value: '#48' },
              { label: 'Tests', value: '1,428' }
            ].map((stat, idx) => (
              <div key={idx} className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-text-secondary uppercase tracking-widest">{stat.label}</span>
                <span className="text-sm font-black font-mono text-text-primary">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />
      <main className="flex-1 flex items-center justify-center p-6 bg-background">
        <Suspense fallback={
          <div className="w-8 h-8 bg-accent animate-spin" />
        }>
          <LoginCard />
        </Suspense>
      </main>
    </div>
  );
}
