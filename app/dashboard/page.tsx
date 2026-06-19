'use client';

import React, { useEffect, useState } from 'react';
import { useUserStore } from '@/stores/user-store';
import { Navbar } from '@/components/navbar';
import { createClient } from '@/lib/supabase/client';
import { Calendar, Zap, Award, LineChart as ChartIcon, CheckCircle, Database, LogIn, Clock, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';

const DashboardChart = dynamic(() => import('@/components/dashboard/dashboard-chart'), {
  ssr: false,
  loading: () => <div className="h-[220px] flex items-center justify-center text-text-secondary uppercase tracking-widest text-xs font-bold font-mono">Loading Chart...</div>
});

export default function Dashboard() {
  const { session, profile, guestHistory, clearGuestHistory } = useUserStore();
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

  // Load either authenticated DB history or Local Guest history
  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
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
            accuracy: h.accuracy,
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
      setLoading(false);
    }

    loadDashboardData();
  }, [session, guestHistory]);

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

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-6 py-10 flex flex-col gap-8">
        
        {/* Sync panel indicator for logging users with local buffers */}
        {session && guestHistory.length > 0 && (
          <div className="p-4 bg-accent border-3 border-border text-background flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Database className="w-5 h-5 text-background" />
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase tracking-wider">Local runs detected</span>
                <span className="text-xs uppercase font-bold opacity-80">You have {guestHistory.length} local practice tests to sync.</span>
              </div>
            </div>
            <Button
              onClick={handleSyncHistory}
              disabled={syncing}
              variant="secondary"
              className="px-4 py-2"
            >
              {syncing ? 'Syncing...' : 'Sync History'}
            </Button>
          </div>
        )}

        {/* Guest Warning Card */}
        {!session && (
          <div className="p-6 bg-surface-accent border-3 border-border flex flex-col sm:flex-row items-center justify-between gap-4 relative">
            {/* Small red Bauhaus square decoration */}
            <div className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-bauhaus-red border-2 border-border" />
            <div className="flex flex-col gap-1 text-center sm:text-left">
              <h2 className="text-sm font-bold uppercase tracking-wider text-text-primary">Guest Session Active</h2>
              <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Your runs are saved locally. Sign in to persist results, unlock leaderboards, and track long-term progress.</p>
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

        {/* Main Title Header */}
        <div className="flex flex-col gap-2 border-b-3 border-border pb-4 mb-2">
          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-text-primary">
            {session ? (profile?.username ? profile.username : 'Dashboard') : 'Dashboard'}
          </h1>
          <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">
            {session ? 'Your personal performance record' : 'Local session — sign in to sync across devices'}
          </p>
        </div>

        {/* Stats Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <div className="p-6 bg-accent border-3 border-border flex flex-col text-background justify-between min-h-[100px]">
            <span className="text-xs font-bold uppercase tracking-widest opacity-85">Top Speed</span>
            <span className="text-2xl md:text-3xl font-black font-mono mt-2">{stats.bestWpm} WPM</span>
          </div>
          <div className="p-6 bg-surface-accent border-3 border-border flex flex-col text-text-primary justify-between min-h-[100px]">
            <span className="text-xs font-bold uppercase tracking-widest text-text-secondary">Average Speed</span>
            <span className="text-2xl md:text-3xl font-black font-mono mt-2">{stats.avgWpm} WPM</span>
          </div>
          <div className="p-6 bg-bauhaus-red border-3 border-border flex flex-col text-white justify-between min-h-[100px]">
            <span className="text-xs font-bold uppercase tracking-widest opacity-85">Accuracy</span>
            <span className="text-2xl md:text-3xl font-black font-mono mt-2">{stats.avgAccuracy}%</span>
          </div>
          <div className="p-6 bg-surface-accent border-3 border-border flex flex-col text-text-primary justify-between min-h-[100px]">
            <span className="text-xs font-bold uppercase tracking-widest text-text-secondary">Tests Run</span>
            <span className="text-2xl md:text-3xl font-black font-mono mt-2">{stats.testsCompleted}</span>
          </div>
          <div className="col-span-2 md:col-span-4 lg:col-span-1 p-6 bg-bauhaus-yellow border-3 border-border text-bauhaus-black flex flex-col justify-between min-h-[100px]">
            <span className="text-xs font-bold uppercase tracking-widest opacity-85">Active Streak</span>
            <div className="flex items-center gap-1.5 mt-2 text-bauhaus-black font-mono font-black text-2xl leading-none">
              <Zap className="w-5 h-5 fill-current" />
              <span>{streak.current} Days</span>
            </div>
          </div>
        </div>

        {/* Recharts Progress Graph & Recent Runs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
          <div className="lg:col-span-2 p-6 bg-surface border-3 border-border flex flex-col min-h-[300px]">
            <div className="flex items-center gap-2 border-b-2 border-border pb-4 mb-4">
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
          <div className="p-6 bg-surface border-3 border-border flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b-2 border-border pb-4">
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
                  <div key={idx} className="flex justify-between items-center p-3 bg-surface-accent border-2 border-border text-xs font-bold uppercase tracking-wider">
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
        </div>
      </main>
    </div>
  );
}
