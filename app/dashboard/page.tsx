'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { motion } from 'framer-motion';
import { Zap, LineChart as ChartIcon, Database, LogIn, Clock, RefreshCw, BookOpen, Calendar, Sparkles } from 'lucide-react';
import { useUserStore, type GuestResult } from '@/stores/user-store';
import { useToastStore } from '@/stores/toast-store';
import { useHydrated } from '@/lib/hooks/use-hydrated';
import { createClient, isSupabaseRealtimeEnabled } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { isRankedMode, RANKED_MODES } from '@/lib/typing/metrics';
import { formatUtcDate } from '@/lib/utils/format-date';
import {
  getHeldRejectedGuestRunsCount,
  getInvalidDurationGuestRunsCount,
  getSyncableGuestRunsCount,
  syncGuestHistoryBatches,
} from '@/lib/typing/sync-client';
import { Navbar } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import type { Database as DbSchema } from '@/types/database';

const DashboardChart = dynamic(() => import('@/components/dashboard/dashboard-chart'), {
  ssr: false,
  loading: () => (
    <div className="h-[220px] flex items-center justify-center text-text-secondary uppercase tracking-widest text-xs font-bold font-mono">
      Loading Chart...
    </div>
  ),
});

type DbTestResultRow = DbSchema['public']['Tables']['test_results']['Row'];

interface DashboardRun {
  id: string;
  wpm: number;
  raw_wpm: number;
  accuracy: number;
  consistency: number;
  error_count: number;
  backspace_count: number;
  duration: number;
  mode: string;
  is_ranked?: boolean | null;
  created_at: string;
}

function isMissingIsRankedColumnError(
  error: { code?: string | null; message?: string | null } | null | undefined
): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  const msg = (error.message ?? '').toLowerCase();
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    (msg.includes('is_ranked') && (msg.includes('column') || msg.includes('schema cache')))
  );
}

const PAGE_STEP = 50;

function computeGuestStreak(history: GuestResult[]): { current: number; longest: number } {
  if (history.length === 0) return { current: 0, longest: 0 };

  const uniqueDays = Array.from(
    new Set(
      history
        .map((item) => item.created_at.slice(0, 10))
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    )
  ).sort((a, b) => (a > b ? -1 : 1));

  if (uniqueDays.length === 0) return { current: 0, longest: 0 };

  const dayToEpoch = (isoDate: string) => {
    const [y, m, d] = isoDate.split('-').map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  };

  let longest = 1;
  let running = 1;
  for (let i = 1; i < uniqueDays.length; i += 1) {
    if (dayToEpoch(uniqueDays[i - 1]) - dayToEpoch(uniqueDays[i]) === 1) {
      running += 1;
      longest = Math.max(longest, running);
    } else {
      running = 1;
    }
  }

  const todayEpoch = Math.floor(Date.now() / 86400000);
  const latestEpoch = dayToEpoch(uniqueDays[0]);
  if (todayEpoch - latestEpoch > 1) {
    return { current: 0, longest };
  }

  let current = 1;
  for (let i = 1; i < uniqueDays.length; i += 1) {
    if (dayToEpoch(uniqueDays[i - 1]) - dayToEpoch(uniqueDays[i]) === 1) {
      current += 1;
    } else {
      break;
    }
  }

  return { current, longest: Math.max(longest, current) };
}

function formatTotalTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m ${seconds % 60}s`;
}

export default function DashboardPage() {
  const hydrated = useHydrated();
  const {
    session,
    profile,
    setProfile,
    guestHistory,
    removeGuestResults,
    markGuestResultsRejected,
    recordGuestSyncFailures,
    retryRejectedGuestResults,
  } = useUserStore();
  const { showToast } = useToastStore();

  const [dbHistory, setDbHistory] = useState<DashboardRun[]>([]);
  const [dbPeakWpm, setDbPeakWpm] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [pageSize, setPageSize] = useState(PAGE_STEP);
  const [dbStreak, setDbStreak] = useState({ current: 0, longest: 0 });
  const [syncing, setSyncing] = useState(false);
  const [historyMode, setHistoryMode] = useState<string>('all');
  const [historyDuration, setHistoryDuration] = useState<string>('all');
  const [historySort, setHistorySort] = useState<string>('latest');

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');

  const fetchDbSnapshot = useCallback(async (userId: string, limitSize: number) => {
    const supabase = createClient();

    let supportsIsRanked = true;
    const primaryRes = await supabase
      .from('test_results')
      .select(
        'id, wpm, raw_wpm, accuracy, consistency, error_count, backspace_count, duration, mode, is_ranked, created_at'
      )
      .eq('user_id', userId)
      .eq('is_invalidated', false)
      .order('created_at', { ascending: false })
      .limit(limitSize + 1);

    let dbResults = primaryRes.data as
      | Pick<
          DbTestResultRow,
          | 'id'
          | 'wpm'
          | 'raw_wpm'
          | 'accuracy'
          | 'consistency'
          | 'error_count'
          | 'backspace_count'
          | 'duration'
          | 'mode'
          | 'is_ranked'
          | 'created_at'
        >[]
      | null;
    let error = primaryRes.error;

    if (error && isMissingIsRankedColumnError(error)) {
      supportsIsRanked = false;
      const legacyRes = await supabase
        .from('test_results')
        .select(
          'id, wpm, raw_wpm, accuracy, consistency, error_count, backspace_count, duration, mode, created_at'
        )
        .eq('user_id', userId)
        .eq('is_invalidated', false)
        .order('created_at', { ascending: false })
        .limit(limitSize + 1);
      dbResults = legacyRes.data as typeof dbResults;
      error = legacyRes.error;
    }

    const rows = !error && dbResults ? dbResults : null;
    const slicedRows = rows ? rows.slice(0, limitSize) : null;
    const nextHasMore = rows ? rows.length > limitSize : false;

    let lifetimePeakWpm: number | null = null;
    if (nextHasMore && slicedRows) {
      if (supportsIsRanked) {
        const peakRes = await supabase
          .from('test_results')
          .select('wpm, mode')
          .eq('user_id', userId)
          .eq('is_invalidated', false)
          .eq('is_ranked', true)
          .order('wpm', { ascending: false })
          .limit(1);
        const topRow = peakRes.data?.[0];
        if (!peakRes.error && topRow && isRankedMode(topRow.mode)) {
          lifetimePeakWpm = topRow.wpm;
        }
      } else {
        const peakRes = await supabase
          .from('test_results')
          .select('wpm, mode')
          .eq('user_id', userId)
          .eq('is_invalidated', false)
          .in('mode', [...RANKED_MODES])
          .order('wpm', { ascending: false })
          .limit(1);
        const topRow = peakRes.data?.[0];
        if (!peakRes.error && topRow) {
          lifetimePeakWpm = topRow.wpm;
        }
      }
    }

    const { data: streakData } = await supabase
      .from('streaks')
      .select('current_streak, longest_streak')
      .eq('user_id', userId)
      .maybeSingle();

    return {
      rows: slicedRows,
      hasMore: nextHasMore,
      peakWpm: lifetimePeakWpm,
      streak: streakData
        ? { current: streakData.current_streak, longest: streakData.longest_streak }
        : null,
    };
  }, []);

  const loadDbDashboardData = useCallback(async () => {
    if (!session?.user) return;
    setRefreshing(true);
    try {
      const snapshot = await fetchDbSnapshot(session.user.id, pageSize);
      if (snapshot.rows) {
        setDbHistory(snapshot.rows);
        setHasMore(snapshot.hasMore);
        setDbPeakWpm(snapshot.peakWpm);
      }
      if (snapshot.streak) {
        setDbStreak(snapshot.streak);
      }
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      logger.error('Failed to load dashboard data', { category: 'supabase', error: err });
    } finally {
      setRefreshing(false);
    }
  }, [session, pageSize, fetchDbSnapshot]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    let cancelled = false;
    fetchDbSnapshot(userId, pageSize)
      .then((snapshot) => {
        if (cancelled) return;
        if (snapshot.rows) {
          setDbHistory(snapshot.rows);
          setHasMore(snapshot.hasMore);
          setDbPeakWpm(snapshot.peakWpm);
        }
        if (snapshot.streak) {
          setDbStreak(snapshot.streak);
        }
        setLastUpdated(new Date().toLocaleTimeString());
      })
      .catch((err) => {
        logger.error('Failed to load dashboard data', { category: 'supabase', error: err });
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, pageSize, fetchDbSnapshot]);

  // Scoped Realtime subscription for authenticated user results
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || !isSupabaseRealtimeEnabled()) return;

    let channel: RealtimeChannel | null = null;
    const supabase = createClient();

    try {
      channel = supabase
        .channel(`dashboard-test-results-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'test_results',
            filter: `user_id=eq.${userId}`,
          },
          () => {
            void fetchDbSnapshot(userId, pageSize).then((snapshot) => {
              if (snapshot.rows) {
                setDbHistory(snapshot.rows);
                setHasMore(snapshot.hasMore);
                setDbPeakWpm(snapshot.peakWpm);
              }
              if (snapshot.streak) {
                setDbStreak(snapshot.streak);
              }
              setLastUpdated(new Date().toLocaleTimeString());
            });
          }
        )
        .subscribe();
    } catch (err) {
      logger.error('Failed to subscribe to dashboard realtime channel', { category: 'supabase', error: err });
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          // Ignore cleanup errors during unmount
        }
      }
    };
  }, [session?.user?.id, pageSize, fetchDbSnapshot]);

  const effectiveGuestHistory = useMemo(
    () => (hydrated ? guestHistory : []),
    [hydrated, guestHistory]
  );

  const guestRuns = useMemo<DashboardRun[]>(
    () =>
      effectiveGuestHistory.map((h) => ({
        id: h.id,
        wpm: h.wpm,
        raw_wpm: h.raw_wpm,
        accuracy: h.accuracy,
        consistency: h.consistency,
        error_count: h.error_count,
        backspace_count: h.backspace_count,
        duration: h.duration,
        mode: h.mode,
        is_ranked: h.isRanked !== false,
        created_at: h.created_at,
      })),
    [effectiveGuestHistory]
  );

  const history = session?.user ? dbHistory : guestRuns;
  const streak = useMemo(
    () => (session?.user ? dbStreak : computeGuestStreak(effectiveGuestHistory)),
    [session, dbStreak, effectiveGuestHistory]
  );

  const stats = useMemo(() => {
    if (history.length === 0) {
      return {
        bestWpm: 0,
        avgWpm: 0,
        avgAccuracy: 0,
        testsCompleted: 0,
        totalTimeSecs: 0,
      };
    }

    const rankedRuns = history.filter(
      (h) => h.is_ranked !== false && isRankedMode(h.mode)
    );
    const localBestWpm =
      rankedRuns.length > 0 ? Math.max(...rankedRuns.map((h) => h.wpm)) : 0;
    const bestWpm =
      session?.user && dbPeakWpm !== null
        ? Math.max(localBestWpm, dbPeakWpm)
        : localBestWpm;
    const avgWpm = Math.round(history.reduce((sum, h) => sum + h.wpm, 0) / history.length);
    const avgAccuracy = Math.round(
      history.reduce((sum, h) => sum + h.accuracy, 0) / history.length
    );
    const totalTimeSecs = history.reduce((sum, h) => sum + h.duration, 0);

    return {
      bestWpm,
      avgWpm,
      avgAccuracy,
      testsCompleted: history.length,
      totalTimeSecs,
    };
  }, [history, session?.user, dbPeakWpm]);

  const handleToggleEdit = () => {
    if (!isEditingProfile) {
      setNewDisplayName(profile?.display_name || profile?.username || '');
    }
    setIsEditingProfile((prev) => !prev);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !newDisplayName.trim()) return;
    setUpdatingProfile(true);

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: newDisplayName.trim() }),
      });

      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        profile?: { display_name: string | null };
      };
      if (!res.ok) {
        throw new Error(json.error || 'Failed to update profile');
      }

      if (json.success && json.profile && profile) {
        setProfile({
          ...profile,
          display_name: json.profile.display_name,
        });
        showToast('Profile updated successfully.');
        setIsEditingProfile(false);
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'An error occurred while updating profile.');
      logger.error('Profile update failed', { category: 'api', error: err });
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleSyncHistory = async () => {
    if (!session || guestHistory.length === 0) return;
    setSyncing(true);

    try {
      const summary = await syncGuestHistoryBatches(guestHistory, {
        removePersistedIds: removeGuestResults,
        markRejectedIds: markGuestResultsRejected,
        recordTransientFailureIds: recordGuestSyncFailures,
      });

      const persistedTotal = summary.syncedCount + summary.duplicateCount;
      const localRetained =
        summary.skippedLegacyCount +
        summary.skippedUnrankedCount +
        summary.skippedInvalidDurationCount +
        summary.heldRejectedCount +
        summary.rejectedCount +
        summary.failedCount;

      if (summary.failureCategory === 'rate_limited') {
        if (persistedTotal > 0) {
          showToast(
            `Synced ${summary.syncedCount} verified run${summary.syncedCount === 1 ? '' : 's'} (${summary.duplicateCount} duplicate${summary.duplicateCount === 1 ? '' : 's'} linked). Rate limit reached${summary.retryAfterSeconds ? ` (~${summary.retryAfterSeconds}s)` : ''} — remaining local runs kept safely.`
          );
        } else {
          showToast(
            summary.errorMessage || 'Sync rate limit reached. Remaining local runs were kept safely.'
          );
        }
      } else if (summary.interrupted) {
        if (persistedTotal > 0) {
          showToast(
            `Synced ${summary.syncedCount} verified run${summary.syncedCount === 1 ? '' : 's'} (${summary.duplicateCount} duplicate${summary.duplicateCount === 1 ? '' : 's'} linked). Remaining local runs kept safely.`
          );
        } else if (summary.rejectedCount > 0 && !summary.temporaryFailure) {
          showToast(
            `${summary.rejectedCount} local run${summary.rejectedCount === 1 ? '' : 's'} failed verification and ${summary.rejectedCount === 1 ? 'was' : 'were'} paused from auto-sync.`
          );
        } else {
          showToast(summary.errorMessage || 'Failed to sync guest runs.');
        }
      } else if (summary.syncedCount > 0 && localRetained > 0) {
        showToast(
          `Synced ${summary.syncedCount} verified run${summary.syncedCount === 1 ? '' : 's'}. Kept ${localRetained} local-only or paused run${localRetained === 1 ? '' : 's'} safely in browser.`
        );
      } else if (summary.syncedCount > 0) {
        showToast(
          `Synced ${summary.syncedCount} verified run${summary.syncedCount === 1 ? '' : 's'}.`
        );
      } else if (summary.duplicateCount > 0) {
        showToast(
          `Verified ${summary.duplicateCount} already-synced run${summary.duplicateCount === 1 ? '' : 's'}.`
        );
      } else if (summary.rejectedCount > 0) {
        showToast(
          `${summary.rejectedCount} local run${summary.rejectedCount === 1 ? '' : 's'} failed verification and ${summary.rejectedCount === 1 ? 'was' : 'were'} paused from auto-sync.`
        );
      } else {
        showToast('No syncable ranked telemetry runs found; local runs were preserved.');
      }

      if (persistedTotal > 0) {
        await loadDbDashboardData();
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to sync guest runs.');
      logger.error('Failed to sync guest data', { category: 'api', error: err });
    } finally {
      setSyncing(false);
    }
  };

  const handleRetryHeldRuns = () => {
    const heldCount = getHeldRejectedGuestRunsCount(guestHistory);
    if (heldCount === 0) return;
    retryRejectedGuestResults();
    showToast(
      `Re-queued ${heldCount} paused local run${heldCount === 1 ? '' : 's'} for verification.`
    );
  };

  const chartData = useMemo(
    () =>
      [...history]
        .reverse()
        .slice(-30)
        .map((item, index) => ({
          index: index + 1,
          wpm: item.wpm,
          accuracy: item.accuracy,
        })),
    [history]
  );

  const filteredHistory = useMemo(
    () =>
      [...history]
        .filter((run) => {
          const matchesMode = historyMode === 'all' || run.mode === historyMode;
          const matchesDuration =
            historyDuration === 'all' || run.duration === parseInt(historyDuration, 10);
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
        }),
    [history, historyMode, historyDuration, historySort]
  );

  const syncableCount = hydrated ? getSyncableGuestRunsCount(guestHistory) : 0;
  const heldRejectedCount = hydrated ? getHeldRejectedGuestRunsCount(guestHistory) : 0;
  const invalidDurationCount = hydrated ? getInvalidDurationGuestRunsCount(guestHistory) : 0;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-6 py-10 flex flex-col gap-8">
        {session && hydrated && syncableCount > 0 && (
          <div className="p-5 bg-accent/10 border border-accent/30 text-text-primary rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-2.5">
              <Database className="w-5 h-5 text-accent-ink" />
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase tracking-wider">Local runs detected</span>
                <span className="text-xs font-medium text-text-secondary mt-0.5">
                  You have {syncableCount} local ranked run
                  {syncableCount === 1 ? '' : 's'} ready to verify and sync.
                </span>
              </div>
            </div>
            <Button onClick={handleSyncHistory} disabled={syncing} variant="primary" className="px-4 py-2">
              {syncing ? 'Syncing...' : 'Sync History'}
            </Button>
          </div>
        )}

        {session && hydrated && (heldRejectedCount > 0 || invalidDurationCount > 0) && (
          <div
            role="status"
            className="p-5 bg-surface border border-border text-text-primary rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <Database className="w-5 h-5 text-text-secondary shrink-0" />
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase tracking-wider">
                  Local-Only / Paused Runs Preserved
                </span>
                <span className="text-xs font-medium text-text-secondary mt-0.5">
                  {heldRejectedCount > 0 &&
                    `${heldRejectedCount} run${heldRejectedCount === 1 ? '' : 's'} paused locally after verification rejection or repeated retry failures. `}
                  {invalidDurationCount > 0 &&
                    `${invalidDurationCount} legacy run${invalidDurationCount === 1 ? '' : 's'} use non-ranked duration brackets and stay local in browser storage.`}
                </span>
              </div>
            </div>
            {heldRejectedCount > 0 && (
              <Button
                onClick={handleRetryHeldRuns}
                disabled={syncing}
                variant="secondary"
                className="px-4 py-2 shrink-0"
              >
                Retry Held Runs
              </Button>
            )}
          </div>
        )}

        {!session && (
          <div className="p-6 bg-surface border border-border flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl shadow-sm">
            <div className="flex flex-col gap-1 text-center sm:text-left">
              <h2 className="text-sm font-bold uppercase tracking-wider text-text-primary">
                Guest Session Active
              </h2>
              <p className="text-xs font-medium text-text-secondary mt-0.5">
                Runs are saved locally in your browser. Sign in to persist scores, qualify for global leaderboards, and unlock cloud history.
              </p>
            </div>
            <Button href="/login" variant="primary" className="px-5 py-2.5 shrink-0">
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </Button>
          </div>
        )}

        {/* Header & Quick Training Links */}
        <div className="flex flex-col gap-4 border-b border-border pb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl md:text-5xl font-extrabold uppercase tracking-tight text-text-primary flex flex-wrap items-center gap-3 font-display">
                <span>
                  {session ? profile?.display_name || profile?.username || 'Dashboard' : 'Dashboard'}
                </span>
                {session && profile?.username && (
                  <span className="text-xs font-mono font-bold text-text-secondary bg-surface-accent border border-border px-2.5 py-1 uppercase tracking-wider rounded-md">
                    @{profile.username}
                  </span>
                )}
              </h1>
              <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                {session
                  ? 'Your verified performance record'
                  : 'Local guest metrics. Sign in to sync across devices.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/learn"
                className="px-3.5 py-2.5 min-h-[42px] border border-border bg-surface hover:bg-surface-accent text-text-primary text-xs font-bold uppercase tracking-wider rounded-lg inline-flex items-center gap-1.5 transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5 text-accent-ink" />
                <span>Curriculum</span>
              </Link>
              <Link
                href="/daily"
                className="px-3.5 py-2.5 min-h-[42px] border border-border bg-surface hover:bg-surface-accent text-text-primary text-xs font-bold uppercase tracking-wider rounded-lg inline-flex items-center gap-1.5 transition-colors"
              >
                <Calendar className="w-3.5 h-3.5 text-accent-ink" />
                <span>Daily</span>
              </Link>
              <Link
                href="/dashboard/performance-lab"
                className="px-3.5 py-2.5 min-h-[42px] border border-border bg-surface hover:bg-surface-accent text-text-primary text-xs font-bold uppercase tracking-wider rounded-lg inline-flex items-center gap-1.5 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-accent-ink" />
                <span>Lab</span>
              </Link>
              {session && (
                <>
                  <button
                    type="button"
                    onClick={handleToggleEdit}
                    className="px-4 py-2.5 min-h-[42px] border border-border bg-surface hover:bg-surface-accent text-text-primary text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer rounded-lg shadow-xs"
                  >
                    {isEditingProfile ? 'Cancel' : 'Edit Profile'}
                  </button>
                  <button
                    type="button"
                    onClick={() => loadDbDashboardData()}
                    className="p-2.5 min-w-[42px] min-h-[42px] flex items-center justify-center border border-border bg-surface hover:bg-surface-accent text-text-primary transition-colors cursor-pointer rounded-lg shadow-xs"
                    title="Refresh Data"
                    aria-label="Refresh dashboard data"
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  </button>
                </>
              )}
            </div>
          </div>

          {session && isEditingProfile && (
            <form
              onSubmit={handleUpdateProfile}
              className="mt-2 p-5 bg-surface border border-border flex flex-col sm:flex-row sm:items-end gap-4 max-w-2xl rounded-xl shadow-md animate-fade-in"
            >
              <div className="flex-1 flex flex-col gap-2">
                <label htmlFor="display-name-input" className="text-xs font-bold uppercase tracking-wider text-text-primary">
                  Display Name
                </label>
                <input
                  id="display-name-input"
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="Enter display name"
                  className="w-full bg-background text-text-primary border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-xs font-bold uppercase tracking-wider outline-none focus:border-accent"
                  maxLength={50}
                  required
                />
              </div>
              <div className="flex-1 flex flex-col gap-2 opacity-75">
                <span className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                  <span>Username</span>
                  <span className="text-[11px] text-error">(Locked)</span>
                </span>
                <div className="w-full bg-surface-accent text-text-secondary border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-xs font-bold uppercase tracking-wider select-none flex items-center justify-between">
                  <span>@{profile?.username}</span>
                </div>
              </div>
              <button
                type="submit"
                disabled={updatingProfile}
                className="px-6 py-2.5 min-h-[44px] bg-accent text-accent-foreground hover:brightness-105 text-xs font-black uppercase tracking-wider transition-all cursor-pointer rounded-lg shadow-sm disabled:opacity-50"
              >
                {updatingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          )}

          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-text-secondary">
            <span>Source: {session ? 'Cloud Database' : 'Local Storage'}</span>
            {lastUpdated && <span>Last Updated: {lastUpdated}</span>}
          </div>
        </div>

        {/* KPI Bento Grid */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4"
        >
          <div className="col-span-2 p-6 bg-accent/10 border border-accent/25 rounded-2xl flex flex-col justify-between min-h-[140px] shadow-xs">
            <span className="text-xs font-bold uppercase tracking-widest text-accent-ink">
              Peak Performance
            </span>
            <span className="text-4xl md:text-5xl font-black font-mono mt-2 text-text-primary tabular-nums">
              {stats.bestWpm} <span className="text-lg text-text-secondary">WPM</span>
            </span>
          </div>

          <div className="col-span-2 md:col-span-1 p-6 bg-surface border border-border rounded-2xl flex flex-col justify-between min-h-[140px] shadow-xs">
            <span className="text-xs font-bold uppercase tracking-widest text-text-secondary">
              Average Speed
            </span>
            <span className="text-3xl font-black font-mono mt-2 text-text-primary tabular-nums">
              {stats.avgWpm} <span className="text-sm text-text-secondary">WPM</span>
            </span>
          </div>

          <div className="col-span-2 md:col-span-1 p-6 bg-surface border border-border rounded-2xl flex flex-col justify-between min-h-[140px] shadow-xs">
            <span className="text-xs font-bold uppercase tracking-widest text-text-secondary">
              Avg Accuracy
            </span>
            <span className="text-3xl font-black font-mono mt-2 text-success tabular-nums">
              {stats.avgAccuracy}%
            </span>
          </div>

          <div className="col-span-2 md:col-span-1 p-6 bg-surface border border-border rounded-2xl flex flex-col justify-between min-h-[140px] shadow-xs">
            <span className="text-xs font-bold uppercase tracking-widest text-text-secondary">
              Active Streak
            </span>
            <div className="flex items-center gap-2 mt-2 text-text-primary font-mono font-black text-3xl tabular-nums">
              <Zap className="w-6 h-6 text-accent-ink" />
              <span>{streak.current}</span>
            </div>
          </div>

          <div className="col-span-2 md:col-span-1 p-6 bg-surface border border-border rounded-2xl flex flex-col justify-between min-h-[140px] shadow-xs">
            <span className="text-xs font-bold uppercase tracking-widest text-text-secondary">
              Time Practiced
            </span>
            <div className="flex items-center gap-2 mt-2 text-text-primary font-mono font-black text-xl tabular-nums">
              <Clock className="w-5 h-5 text-accent-ink" />
              <span>{formatTotalTime(stats.totalTimeSecs)}</span>
            </div>
          </div>
        </motion.div>

        {/* Chart & Recent List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 font-sans">
          <div className="lg:col-span-2 p-6 bg-surface border border-border flex flex-col min-h-[300px] rounded-xl shadow-sm">
            <div className="flex items-center gap-2 border-b border-border pb-4 mb-4">
              <ChartIcon className="w-4 h-4 text-accent-ink" />
              <span className="text-sm font-bold uppercase tracking-wider text-text-primary">
                Speed Trend · Last 30 Runs
              </span>
            </div>

            {chartData.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-10">
                <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                  No data yet. Complete a test to start your trend chart.
                </span>
                <Button href="/typing" variant="secondary" className="text-xs">
                  Go to Typing Arena
                </Button>
              </div>
            ) : (
              <div className="flex-1 w-full h-[220px]">
                <DashboardChart chartData={chartData} />
              </div>
            )}
          </div>

          <div className="p-6 bg-surface border border-border flex flex-col gap-4 rounded-xl shadow-sm">
            <div className="flex items-center gap-2 border-b border-border pb-4">
              <Clock className="w-4 h-4 text-accent-ink" />
              <span className="text-sm font-bold uppercase tracking-wider text-text-primary">
                Recent Runs
              </span>
            </div>

            {history.length === 0 ? (
              <div className="flex flex-col items-center gap-2 text-center py-12">
                <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                  No runs yet. Head to Practice to record your baseline.
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-h-[220px] overflow-y-auto pr-1">
                {history.slice(0, 5).map((run) => (
                  <div
                    key={run.id}
                    className="flex justify-between items-center p-3.5 bg-surface-accent/50 border border-border text-xs font-bold uppercase tracking-wider rounded-lg"
                  >
                    <div className="flex flex-col">
                      <span className="text-text-primary font-mono text-sm font-black tabular-nums">
                        {run.wpm} WPM
                      </span>
                      <span className="text-xs text-text-secondary uppercase mt-0.5">
                        {run.mode} ({run.duration}s)
                      </span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-text-primary font-mono tabular-nums">{run.accuracy}% Acc</span>
                      <span className="text-xs text-text-secondary mt-0.5">
                        {formatUtcDate(run.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Complete History Log with Bounded Query Pagination */}
        <div className="p-6 bg-surface border border-border flex flex-col gap-6 rounded-2xl shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
            <div className="flex items-center gap-2.5">
              <Database className="w-5 h-5 text-accent-ink" />
              <div className="flex flex-col">
                <span className="text-sm font-black uppercase tracking-wider text-text-primary">
                  Session History Log
                </span>
                <span className="text-xs font-bold text-text-secondary mt-0.5">
                  Showing {history.length} loaded run{history.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="history-sort" className="text-xs font-bold uppercase tracking-widest text-text-secondary">
                Sort:
              </label>
              <select
                id="history-sort"
                value={historySort}
                onChange={(e) => setHistorySort(e.target.value)}
                className="bg-background text-text-primary border border-border px-3 py-2 min-h-[40px] text-xs font-bold uppercase tracking-wider outline-none cursor-pointer hover:bg-surface-accent transition-colors rounded-lg"
              >
                <option value="latest">Latest First</option>
                <option value="oldest">Oldest First</option>
                <option value="highest_wpm">Highest Speed</option>
                <option value="highest_accuracy">Highest Accuracy</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-3 bg-surface-accent/40 border border-border rounded-xl">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none whitespace-nowrap">
              <span className="text-xs font-bold uppercase tracking-widest text-text-secondary mr-1">Mode:</span>
              {['all', 'words', 'quotes', 'numbers', 'punctuation', 'code'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setHistoryMode(m)}
                  className={`px-3 py-2 min-h-[36px] border text-xs font-bold uppercase tracking-wider transition-all cursor-pointer rounded-lg ${
                    historyMode === m
                      ? 'bg-accent text-accent-foreground border-transparent shadow-xs'
                      : 'text-text-secondary border-transparent hover:border-border hover:text-text-primary'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none whitespace-nowrap">
              <span className="text-xs font-bold uppercase tracking-widest text-text-secondary mr-1">
                Duration:
              </span>
              {['all', '15', '30', '60', '120'].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setHistoryDuration(d)}
                  className={`px-3 py-2 min-h-[36px] border text-xs font-bold uppercase tracking-wider transition-all cursor-pointer rounded-lg ${
                    historyDuration === d
                      ? 'bg-accent text-accent-foreground border-transparent shadow-xs'
                      : 'text-text-secondary border-transparent hover:border-border hover:text-text-primary'
                  }`}
                >
                  {d === 'all' ? 'all' : `${d}s`}
                </button>
              ))}
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center gap-2 text-center py-12 bg-background border border-border rounded-xl">
              <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                No runs match the selected filters.
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="overflow-x-auto border border-border max-h-[380px] overflow-y-auto rounded-xl bg-surface">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase font-bold text-text-primary tracking-wider bg-surface-accent sticky top-0 z-10">
                      <th className="py-3 px-3 w-10 text-center bg-surface-accent">#</th>
                      <th className="py-3 px-4 text-right bg-surface-accent">Speed</th>
                      <th className="py-3 px-4 text-right bg-surface-accent">Raw</th>
                      <th className="py-3 px-4 text-right bg-surface-accent">Accuracy</th>
                      <th className="py-3 px-4 text-right bg-surface-accent">Consistency</th>
                      <th className="py-3 px-4 text-center bg-surface-accent">Errors</th>
                      <th className="py-3 px-4 bg-surface-accent">Mode</th>
                      <th className="py-3 px-4 bg-surface-accent">Duration</th>
                      <th className="py-3 px-4 text-right bg-surface-accent">Date</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                    {filteredHistory.map((run, idx) => (
                      <tr
                        key={run.id}
                        className="border-b border-border/50 hover:bg-surface-accent/30 transition-colors"
                      >
                        <td className="py-3 px-3 text-center font-mono font-bold text-text-secondary">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-accent-ink tabular-nums">
                          {run.wpm} WPM
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-text-secondary tabular-nums">
                          {run.raw_wpm ? `${run.raw_wpm} WPM` : '--'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-text-primary tabular-nums">
                          {run.accuracy}%
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          {run.consistency ? `${run.consistency}%` : '--'}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-text-secondary tabular-nums">
                          <span>
                            {run.error_count}{' '}
                            <span className="opacity-70">({run.backspace_count} del)</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-text-primary font-black">{run.mode}</td>
                        <td className="py-3 px-4 text-text-primary font-black">{run.duration}s</td>
                        <td className="py-3 px-4 text-right font-mono text-text-secondary">
                          {formatUtcDate(run.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {session && hasMore && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="secondary"
                    onClick={() => setPageSize((prev) => prev + PAGE_STEP)}
                  >
                    Load More Runs ({PAGE_STEP}+)
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
