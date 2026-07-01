'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useUserStore } from '@/stores/user-store';
import { Navbar } from '@/components/navbar';
import { createClient } from '@/lib/supabase/client';
import { Calendar, Zap, Award, LineChart as ChartIcon, CheckCircle, Database, LogIn, Clock, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { useToastStore } from '@/stores/toast-store';
import { motion } from 'framer-motion';

const DashboardChart = dynamic(() => import('@/components/dashboard/dashboard-chart'), {
  ssr: false,
  loading: () => <div className="h-[220px] flex items-center justify-center text-text-secondary uppercase tracking-widest text-xs font-bold font-mono">Loading Chart...</div>
});

export default function Dashboard() {
  const { session, profile, setProfile, guestHistory, clearGuestHistory } = useUserStore();
  const { showToast } = useToastStore();
  
  const [history, setHistory] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    bestWpm: 0,
    avgWpm: 0,
    avgAccuracy: 0,
    testsCompleted: 0,
    totalTimeSecs: 0,
  });
  const [streak, setStreak] = useState({ current: 0, longest: 0 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [historyMode, setHistoryMode] = useState<string>('all');
  const [historyDuration, setHistoryDuration] = useState<string>('all');
  const [historySort, setHistorySort] = useState<string>('latest');

  // Edit Profile and Refresh States
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Format total practice time
  const formatTotalTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${seconds % 60}s`;
  };

  // Load either authenticated DB history or Local Guest history
  const loadDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) {
      setRefreshing(true);
    }
    
    const isDemo = typeof window !== 'undefined' && (localStorage.getItem('typrox_demo') === 'true' || window.location.search.includes('demo=true'));
    if (isDemo && localStorage.getItem('typrox_demo_logged_in') === 'true') {
      const mockRuns = [
        { id: '1', wpm: 135, raw_wpm: 139, accuracy: 99, consistency: 96, error_count: 1, backspace_count: 2, duration: 30, mode: 'words', created_at: new Date().toISOString() },
        { id: '2', wpm: 129, raw_wpm: 132, accuracy: 98, consistency: 95, error_count: 2, backspace_count: 3, duration: 30, mode: 'words', created_at: new Date(Date.now() - 86400000).toISOString() },
        { id: '3', wpm: 123, raw_wpm: 128, accuracy: 97, consistency: 96, error_count: 2, backspace_count: 2, duration: 60, mode: 'quotes', created_at: new Date(Date.now() - 172800000).toISOString() },
        { id: '4', wpm: 118, raw_wpm: 120, accuracy: 99, consistency: 98, error_count: 1, backspace_count: 1, duration: 15, mode: 'code', created_at: new Date(Date.now() - 259200000).toISOString() },
        { id: '5', wpm: 115, raw_wpm: 122, accuracy: 96, consistency: 94, error_count: 3, backspace_count: 4, duration: 30, mode: 'punctuation', created_at: new Date(Date.now() - 345600000).toISOString() }
      ];
      
      // Generate pre-populated 15 runs trending upwards
      const fullHistory = [...mockRuns];
      for (let i = 6; i <= 15; i++) {
        fullHistory.push({
          id: String(i),
          wpm: Math.max(40, 115 - (i - 5) * 4 + Math.round(Math.random() * 6)),
          raw_wpm: Math.max(45, 120 - (i - 5) * 4),
          accuracy: 94 + Math.round(Math.random() * 4),
          consistency: 89 + Math.round(Math.random() * 5),
          error_count: Math.round(Math.random() * 3),
          backspace_count: Math.round(Math.random() * 4),
          duration: 30,
          mode: 'words',
          created_at: new Date(Date.now() - i * 86400000).toISOString()
        });
      }
      setHistory(fullHistory);
      setStreak({ current: 18, longest: 25 });
      setLastUpdated(new Date().toLocaleTimeString());
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (session?.user) {
      try {
        const supabase = createClient();
        
        // 1. Fetch DB results
        const { data: dbResults, error } = await supabase
          .from('test_results')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('is_invalidated', false)
          .order('created_at', { ascending: false });

        if (!error && dbResults) {
          setHistory(dbResults);
        }

        // 2. Fetch Streaks
        const { data: streakData } = await supabase
          .from('streaks')
          .select('current_streak, longest_streak')
          .eq('user_id', session.user.id)
          .single();
        if (streakData) {
          setStreak({
            current: streakData.current_streak,
            longest: streakData.longest_streak,
          });
        }
      } catch (err) {
        logger.error('Failed to load user streak', { category: 'supabase', error: err });
      }
    } else {
      // Fallback to local guest history
      setHistory(
        guestHistory.map((h) => ({
          id: h.id,
          wpm: h.wpm,
          raw_wpm: h.raw_wpm,
          accuracy: h.accuracy,
          consistency: h.consistency,
          error_count: h.error_count,
          backspace_count: h.backspace_count,
          duration: h.duration,
          mode: h.mode,
          created_at: h.created_at,
        }))
      );
      
      // Mock guest streak
      setStreak({
        current: guestHistory.length > 0 ? 1 : 0,
        longest: guestHistory.length > 0 ? 1 : 0,
      });
    }
    
    setLastUpdated(new Date().toLocaleTimeString());
    setLoading(false);
    setRefreshing(false);
  }, [session, guestHistory]);

  // Load initial data
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Supabase Realtime subscription
  useEffect(() => {
    if (!session?.user) return;

    let channel: any = null;
    let supabaseInstance: any = null;

    try {
      supabaseInstance = createClient();
      channel = supabaseInstance
        .channel(`dashboard-test-results-${session.user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'test_results',
            filter: `user_id=eq.${session.user.id}`,
          },
          () => {
            loadDashboardData(true);
          }
        )
        .subscribe();
    } catch (err) {
      console.error("Failed to subscribe to dashboard realtime changes:", err);
    }

    return () => {
      if (supabaseInstance && channel) {
        try {
          supabaseInstance.removeChannel(channel);
        } catch (err) {
          console.error("Error removing realtime channel:", err);
        }
      }
    };
  }, [session, loadDashboardData]);

  // Set default display name when profile loads
  useEffect(() => {
    if (profile?.display_name) {
      setNewDisplayName(profile.display_name);
    } else if (profile?.username) {
      setNewDisplayName(profile.username);
    }
  }, [profile]);

  // Handle display name update
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !newDisplayName.trim()) return;
    setUpdatingProfile(true);

    const isDemo = typeof window !== 'undefined' && (localStorage.getItem('typrox_demo') === 'true' || window.location.search.includes('demo=true'));
    if (isDemo && profile) {
      setProfile({
        id: profile.id,
        username: profile.username,
        display_name: newDisplayName.trim(),
        avatar_url: profile.avatar_url,
        theme: profile.theme,
        font_family: profile.font_family,
        created_at: profile.created_at,
      });
      showToast('Profile updated successfully! (Demo Mode)');
      setIsEditingProfile(false);
      setUpdatingProfile(false);
      return;
    }

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ displayName: newDisplayName.trim() }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to update profile');
      }

      if (json.success && json.profile && profile) {
        setProfile({
          id: profile.id,
          username: profile.username,
          display_name: json.profile.display_name,
          avatar_url: profile.avatar_url,
          theme: profile.theme,
          font_family: profile.font_family,
          created_at: profile.created_at,
        });
        showToast('Profile updated successfully!');
        setIsEditingProfile(false);
      }
    } catch (err: any) {
      showToast(err.message || 'An error occurred while updating profile.');
      logger.error('Profile update failed', { category: 'api', error: err });
    } finally {
      setUpdatingProfile(false);
    }
  };

  // Aggregate statistics calculations
  useEffect(() => {
    if (history.length === 0) {
      setStats({
        bestWpm: 0,
        avgWpm: 0,
        avgAccuracy: 0,
        testsCompleted: 0,
        totalTimeSecs: 0,
      });
      return;
    }

    const wpmList = history.map((h) => h.wpm);
    const bestWpm = Math.max(...wpmList);
    const avgWpm = Math.round(wpmList.reduce((a, b) => a + b, 0) / history.length);
    const avgAccuracy = Math.round(history.map((h) => h.accuracy).reduce((a, b) => a + b, 0) / history.length);
    const totalTimeSecs = history.reduce((a, b) => a + b.duration, 0);

    setStats({
      bestWpm,
      avgWpm,
      avgAccuracy,
      testsCompleted: history.length,
      totalTimeSecs,
    });
  }, [history]);

  // Sync guest history to authenticated database post-login
  const handleSyncHistory = async () => {
    if (!session || guestHistory.length === 0) return;
    setSyncing(true);

    const isDemo = typeof window !== 'undefined' && (localStorage.getItem('typrox_demo') === 'true' || window.location.search.includes('demo=true'));
    if (isDemo) {
      clearGuestHistory();
      setSyncSuccess(true);
      showToast('Guest history synced successfully! (Demo Mode)');
      setSyncing(false);
      return;
    }
    
    try {
      const supabase = createClient();
      
      const payload = guestHistory.map((g) => ({
        user_id: session.user.id,
        wpm: g.wpm,
        raw_wpm: g.raw_wpm,
        accuracy: g.accuracy,
        consistency: g.consistency,
        error_count: g.error_count,
        backspace_count: g.backspace_count,
        mode: g.mode,
        duration: g.duration,
        seed: g.seed,
        created_at: g.created_at,
      }));

      const { error } = await supabase.from('test_results').insert(payload);
      if (error) throw error;
      
      clearGuestHistory();
      setSyncSuccess(true);
      
      // Reload page data
      const { data: dbResults } = await supabase
        .from('test_results')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      if (dbResults) setHistory(dbResults);

    } catch (err) {
      logger.error('Failed to sync guest data', { category: 'api', error: err });
    } finally {
      setSyncing(false);
    }
  };

  const chartData = [...history]
    .reverse()
    .slice(-30) // Show last 30 runs in chronological order
    .map((item, index) => ({
      index: index + 1,
      wpm: item.wpm,
      accuracy: item.accuracy,
    }));

  const filteredHistory = [...history]
    .filter((run) => {
      const matchesMode = historyMode === 'all' || run.mode === historyMode;
      const matchesDuration = historyDuration === 'all' || run.duration === parseInt(historyDuration, 10);
      return matchesMode && matchesDuration;
    })
    .sort((a, b) => {
      if (historySort === 'latest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (historySort === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (historySort === 'highest_wpm') {
        return b.wpm - a.wpm;
      }
      if (historySort === 'highest_accuracy') {
        return b.accuracy - a.accuracy;
      }
      return 0;
    });

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-6 py-10 flex flex-col gap-8">
        
        {/* Sync panel indicator for logging users with local buffers */}
        {session && guestHistory.length > 0 && (
          <div className="p-5 bg-accent/5 border border-accent/25 text-text-primary rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-2.5">
              <Database className="w-5 h-5 text-accent" />
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase tracking-wider">Local runs detected</span>
                <span className="text-xs uppercase font-bold opacity-80 mt-0.5">You have {guestHistory.length} local practice tests to sync.</span>
              </div>
            </div>
            <Button
              onClick={handleSyncHistory}
              disabled={syncing}
              variant="primary"
              className="px-4 py-2"
            >
              {syncing ? 'Syncing...' : 'Sync History'}
            </Button>
          </div>
        )}

        {/* Guest Warning Card */}
        {!session && (
          <div className="p-6 bg-surface border border-border flex flex-col sm:flex-row items-center justify-between gap-4 relative rounded-xl shadow-sm">
            <div className="flex flex-col gap-1 text-center sm:text-left">
              <h2 className="text-sm font-bold uppercase tracking-wider text-text-primary">Guest Session Active</h2>
              <p className="text-xs font-bold uppercase tracking-wider text-text-secondary mt-0.5">Your runs are saved locally. Sign in to persist results, unlock leaderboards, and track long-term progress.</p>
            </div>
            <Button
              href="/login"
              variant="primary"
              className="px-4 py-2"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Connect Profile</span>
            </Button>
          </div>
        )}

        {/* Main Title Header & Profile Action */}
        <div className="flex flex-col gap-4 border-b border-border/80 pb-6 mb-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl md:text-5xl font-extrabold uppercase tracking-tight text-text-primary flex items-center gap-3 font-sans">
                <span>{session ? (profile?.display_name || profile?.username || 'Dashboard') : 'Dashboard'}</span>
                {session && (
                  <span className="text-[10px] md:text-xs font-mono font-bold text-text-secondary bg-surface-accent border border-border px-2 py-0.5 uppercase tracking-wider rounded-md">
                    @{profile?.username}
                  </span>
                )}
              </h1>
              <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                {session ? 'Your personal performance record' : 'Local session — sign in to sync across devices'}
              </p>
            </div>

            {session && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditingProfile(!isEditingProfile)}
                  className="px-4 py-2 border border-border bg-surface hover:bg-surface-accent text-text-primary text-xs font-bold uppercase tracking-widest transition-all cursor-pointer rounded-lg shadow-xs hover:shadow-sm active:scale-[0.98]"
                >
                  {isEditingProfile ? 'Cancel' : 'Edit Profile'}
                </button>
                <button
                  onClick={() => loadDashboardData()}
                  className="p-2.5 border border-border bg-surface hover:bg-surface-accent text-text-primary transition-all cursor-pointer rounded-lg shadow-xs hover:shadow-sm active:scale-[0.98]"
                  title="Refresh Data"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}
          </div>

          {/* Edit Profile Form */}
          {session && isEditingProfile && (
            <form onSubmit={handleUpdateProfile} className="mt-2 p-5 bg-surface border border-border flex flex-col sm:flex-row sm:items-end gap-4 max-w-2xl rounded-xl shadow-md animate-fade-in">
              <div className="flex-1 flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-text-primary">Display Name</label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="Enter display name"
                  className="w-full bg-background text-text-primary border border-border rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider outline-none focus:border-accent focus:ring-1 focus:ring-accent/15"
                  maxLength={50}
                  required
                />
              </div>
              <div className="flex-1 flex flex-col gap-2 opacity-65">
                <label className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                  <span>Username</span>
                  <span className="text-[10px] text-rose-500">(Locked)</span>
                </label>
                <div className="w-full bg-surface-accent text-text-secondary border border-border/80 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider select-none flex items-center justify-between">
                  <span>@{profile?.username}</span>
                  <span>🔒</span>
                </div>
              </div>
              <button
                type="submit"
                disabled={updatingProfile}
                className="px-6 py-2.5 bg-accent border-transparent text-white hover:bg-accent/90 text-xs font-bold uppercase tracking-widest transition-all cursor-pointer rounded-lg shadow-sm shadow-accent/15 disabled:opacity-50"
              >
                {updatingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          )}

          {/* Last updated timestamp indicator */}
          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-text-secondary/70">
            <span>Source: {session ? 'Cloud Database' : 'Local Storage'}</span>
            {lastUpdated && <span>Last Updated: {lastUpdated}</span>}
          </div>
        </div>

        {/* Stats Bento Grid */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, staggerChildren: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4"
        >
          <motion.div className="col-span-2 p-6 bg-accent/10 border border-accent/20 rounded-2xl flex flex-col justify-between min-h-[140px] shadow-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-accent z-10">Peak Performance</span>
            <span className="text-4xl md:text-5xl font-black font-mono mt-2 text-text-primary z-10">{stats.bestWpm} <span className="text-lg opacity-50">WPM</span></span>
          </motion.div>
          <motion.div className="col-span-2 md:col-span-1 p-6 bg-surface/40 backdrop-blur-md border border-border/60 rounded-2xl flex flex-col justify-between min-h-[140px] shadow-xs">
            <span className="text-xs font-bold uppercase tracking-widest text-text-secondary">Average Speed</span>
            <span className="text-3xl font-black font-mono mt-2 text-text-primary">{stats.avgWpm} <span className="text-sm opacity-50">WPM</span></span>
          </motion.div>
          <motion.div className="col-span-2 md:col-span-1 p-6 bg-surface/40 backdrop-blur-md border border-border/60 rounded-2xl flex flex-col justify-between min-h-[140px] shadow-xs">
            <span className="text-xs font-bold uppercase tracking-widest text-text-secondary">Accuracy</span>
            <span className="text-3xl font-black font-mono mt-2 text-accent-secondary">{stats.avgAccuracy}%</span>
          </motion.div>
          <motion.div className="col-span-2 md:col-span-1 p-6 bg-surface/40 backdrop-blur-md border border-border/60 rounded-2xl flex flex-col justify-between min-h-[140px] shadow-xs">
            <span className="text-xs font-bold uppercase tracking-widest text-text-secondary">Active Streak</span>
            <div className="flex items-center gap-2 mt-2 text-text-primary font-mono font-black text-3xl">
              <Zap className="w-6 h-6 text-warning fill-current drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
              <span>{streak.current}</span>
            </div>
          </motion.div>
          <motion.div className="col-span-2 md:col-span-1 p-6 bg-surface/40 backdrop-blur-md border border-border/60 rounded-2xl flex flex-col justify-between min-h-[140px] shadow-xs">
            <span className="text-xs font-bold uppercase tracking-widest text-text-secondary">Time Practiced</span>
            <div className="flex items-center gap-2 mt-2 text-text-primary font-mono font-black text-xl">
              <Clock className="w-5 h-5 text-accent opacity-80" />
              <span>{formatTotalTime(stats.totalTimeSecs)}</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Recharts Progress Graph & Recent Runs (Bento Layer 2) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-4 font-sans"
        >
          <div className="lg:col-span-2 p-6 bg-surface border border-border flex flex-col min-h-[300px] rounded-xl shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/80 pb-4 mb-4">
              <ChartIcon className="w-4 h-4 text-accent" />
              <span className="text-sm font-bold uppercase tracking-wider text-text-primary">Speed Trend · Last 30 Tests</span>
            </div>

            {chartData.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
                <span className="text-2xl">⌨️</span>
                <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">No data yet — complete a test to start your chart.</span>
              </div>
            ) : (
              <div className="flex-1 w-full h-[220px]">
                <DashboardChart chartData={chartData} />
              </div>
            )}
          </div>

          {/* Recent list block */}
          <div className="p-6 bg-surface border border-border flex flex-col gap-4 rounded-xl shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/80 pb-4">
              <Clock className="w-4 h-4 text-accent" />
              <span className="text-sm font-bold uppercase tracking-wider text-text-primary">Recent Runs</span>
            </div>

            {history.length === 0 ? (
              <div className="flex flex-col items-center gap-2 text-center py-12">
                <span className="text-2xl">⌨️</span>
                <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">No runs yet — head to Practice to get started.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-h-[220px] overflow-y-auto pr-1">
                {history.slice(0, 5).map((run, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3.5 bg-surface-accent/40 border border-border/80 text-xs font-bold uppercase tracking-wider rounded-lg hover:border-accent/30 transition-colors duration-200">
                    <div className="flex flex-col">
                      <span className="text-text-primary font-mono text-sm font-black">{run.wpm} WPM</span>
                      <span className="text-xs text-text-secondary uppercase mt-0.5">{run.mode} ({run.duration}s)</span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-text-primary font-mono">{run.accuracy}% Acc</span>
                      <span className="text-xs text-text-secondary/80 mt-0.5">
                        {new Date(run.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Complete History Log (Bento Layer 3) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="p-6 bg-surface/40 backdrop-blur-md border border-border/60 flex flex-col gap-6 rounded-2xl shadow-sm"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
            <div className="flex items-center gap-2.5">
              <Database className="w-5 h-5 text-accent" />
              <div className="flex flex-col">
                <span className="text-sm font-black uppercase tracking-wider text-text-primary">Complete History Log</span>
                <span className="text-xs uppercase font-bold text-text-secondary mt-0.5">{history.length} total runs recorded</span>
              </div>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-text-secondary">Sort:</span>
              <select
                value={historySort}
                onChange={(e) => setHistorySort(e.target.value)}
                className="bg-background text-text-primary border border-border px-3 py-1.5 text-xs font-bold uppercase tracking-wider outline-none cursor-pointer hover:bg-surface-accent transition-colors rounded-lg shadow-xs"
              >
                <option value="latest">Latest First</option>
                <option value="oldest">Oldest First</option>
                <option value="highest_wpm">Highest Speed</option>
                <option value="highest_accuracy">Highest Accuracy</option>
              </select>
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-3 bg-surface-accent/30 border border-border rounded-xl">
            {/* Mode Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none whitespace-nowrap">
              <span className="text-xs font-bold uppercase tracking-widest text-text-secondary mr-1">Mode:</span>
              {['all', 'words', 'quotes', 'numbers', 'punctuation', 'code'].map((m) => (
                <button
                  key={m}
                  onClick={() => setHistoryMode(m)}
                  className={`px-3 py-1.5 border text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer rounded-lg ${
                    historyMode === m
                      ? 'bg-accent text-white border-transparent shadow-xs'
                      : 'text-text-secondary border-transparent hover:border-border hover:text-text-primary'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Duration Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none whitespace-nowrap">
              <span className="text-xs font-bold uppercase tracking-widest text-text-secondary mr-1">Duration:</span>
              {['all', '15', '30', '60', '120'].map((d) => (
                <button
                  key={d}
                  onClick={() => setHistoryDuration(d)}
                  className={`px-3 py-1.5 border text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer rounded-lg ${
                    historyDuration === d
                      ? 'bg-accent text-white border-transparent shadow-xs'
                      : 'text-text-secondary border-transparent hover:border-border hover:text-text-primary'
                  }`}
                >
                  {d === 'all' ? 'all' : `${d}s`}
                </button>
              ))}
            </div>
          </div>

          {/* Table container */}
          {filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center gap-2 text-center py-12 bg-background border border-border rounded-xl">
              <span className="text-2xl">⌨️</span>
              <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">No runs match the selected filters.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <div className="flex md:hidden items-center justify-end gap-1 text-[9px] font-black uppercase tracking-wider text-text-secondary/80 select-none pb-1 animate-pulse">
                <span>← swipe table to see details →</span>
              </div>
              <div className="overflow-x-auto border border-border max-h-[350px] overflow-y-auto rounded-xl shadow-xs bg-surface">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border text-[10px] uppercase font-bold text-text-primary tracking-widest bg-surface-accent sticky top-0 z-10">
                      <th className="py-2.5 px-3 w-10 text-center bg-surface-accent">#</th>
                      <th className="py-2.5 px-4 text-right bg-surface-accent">Speed</th>
                      <th className="py-2.5 px-4 text-right bg-surface-accent">Raw</th>
                      <th className="py-2.5 px-4 text-right bg-surface-accent">Accuracy</th>
                      <th className="py-2.5 px-4 text-right bg-surface-accent">Consistency</th>
                      <th className="py-2.5 px-4 text-center bg-surface-accent">Errors</th>
                      <th className="py-2.5 px-4 bg-surface-accent">Mode</th>
                      <th className="py-2.5 px-4 bg-surface-accent">Duration</th>
                      <th className="py-2.5 px-4 text-right bg-surface-accent">Date</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                    {filteredHistory.map((run, idx) => {
                      const number = idx + 1;
                      return (
                        <tr
                          key={run.id || idx}
                          className="border-b border-border/40 hover:bg-surface-accent/25 text-text-secondary hover:text-text-primary transition-colors duration-200"
                        >
                          <td className="py-3 px-3 text-center text-text-secondary/65 font-mono font-bold text-[10px]">
                            {number}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-black text-accent">
                            {run.wpm} WPM
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-text-secondary/80">
                            {run.raw_wpm ? `${run.raw_wpm} WPM` : '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-text-primary">
                            {run.accuracy}%
                          </td>
                          <td className="py-3 px-4 text-right font-mono">
                            {run.consistency ? `${run.consistency}%` : '—'}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-text-secondary/80 text-[10px]">
                            {run.error_count !== undefined ? (
                              <span>{run.error_count} <span className="text-text-secondary/40">({run.backspace_count || 0} ⌫)</span></span>
                            ) : '—'}
                          </td>
                          <td className="py-3 px-4 text-text-primary text-[10px] tracking-widest font-black">
                            {run.mode}
                          </td>
                          <td className="py-3 px-4 text-text-primary text-[10px] tracking-widest font-black">
                            {run.duration}s
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-[10px] text-text-secondary/65">
                            {new Date(run.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
