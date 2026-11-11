'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  Keyboard,
  Sparkles,
  BarChart2,
  Zap,
  ShieldAlert,
  Target,
  Activity,
  LogIn,
} from 'lucide-react';
import { useUserStore } from '@/stores/user-store';
import { useHydrated } from '@/lib/hooks/use-hydrated';
import { createClient, isSupabaseRealtimeEnabled } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { Navbar } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import {
  KEYBOARD_ROWS,
  analyzeReplaySessions,
  type ReplaySessionInput,
} from '@/lib/typing/replay-analyzer';
import type { CompressedTelemetryPoint } from '@/lib/typing/metrics';

interface FetchedResultMeta {
  id: string;
  mode: string;
  duration: number;
  seed: string;
}

interface FetchedReplayRow {
  test_result_id: string;
  telemetry: unknown;
}

async function fetchCloudTelemetrySessions(userId: string): Promise<ReplaySessionInput[]> {
  const supabase = createClient();

  const { data: results, error: resultsErr } = await supabase
    .from('test_results')
    .select('id, mode, duration, seed')
    .eq('user_id', userId)
    .eq('is_invalidated', false)
    .order('created_at', { ascending: false })
    .limit(15);

  if (resultsErr || !results || results.length === 0) {
    return [];
  }

  const typedResults = results as FetchedResultMeta[];
  const metaById = new Map<string, FetchedResultMeta>();
  for (const item of typedResults) {
    metaById.set(item.id, item);
  }

  const testIds = typedResults.map((r) => r.id);
  const { data: replays, error: replaysErr } = await supabase
    .from('replays')
    .select('test_result_id, telemetry')
    .in('test_result_id', testIds);

  if (replaysErr || !replays || replays.length === 0) {
    return [];
  }

  const typedReplays = replays as FetchedReplayRow[];
  return typedReplays.map((rep) => {
    const meta = metaById.get(rep.test_result_id);
    return {
      telemetry: Array.isArray(rep.telemetry)
        ? (rep.telemetry as CompressedTelemetryPoint[])
        : [],
      mode: meta?.mode ?? null,
      duration: meta?.duration ?? null,
      seed: meta?.seed ?? null,
    };
  });
}

export default function PerformanceLabPage() {
  const hydrated = useHydrated();
  const { session, guestHistory } = useUserStore();
  const [cloudState, setCloudState] = useState<{
    loadedUserId: string | null;
    sessions: ReplaySessionInput[];
  }>({
    loadedUserId: null,
    sessions: [],
  });

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    let cancelled = false;
    fetchCloudTelemetrySessions(userId)
      .then((sessions) => {
        if (!cancelled) {
          setCloudState({ loadedUserId: userId, sessions });
        }
      })
      .catch((err) => {
        logger.error('Failed to compile Performance Lab telemetry', {
          category: 'supabase',
          error: err,
        });
        if (!cancelled) {
          setCloudState({ loadedUserId: userId, sessions: [] });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  // Scoped Realtime subscription watching the authenticated user's test_results inserts
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || !isSupabaseRealtimeEnabled()) return;

    let channel: RealtimeChannel | null = null;
    const supabase = createClient();

    try {
      channel = supabase
        .channel(`lab-results-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'test_results',
            filter: `user_id=eq.${userId}`,
          },
          () => {
            void fetchCloudTelemetrySessions(userId).then((sessions) => {
              setCloudState({ loadedUserId: userId, sessions });
            });
          }
        )
        .subscribe();
    } catch (err) {
      logger.error('Failed to subscribe to lab realtime updates', {
        category: 'supabase',
        error: err,
      });
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          // Ignore unmount cleanup failures
        }
      }
    };
  }, [session?.user?.id]);

  const guestSessions = useMemo<ReplaySessionInput[]>(
    () =>
      (hydrated ? guestHistory : [])
        .filter((run) => Array.isArray(run.telemetry) && run.telemetry.length > 0)
        .slice(0, 15)
        .map((run) => ({
          telemetry: run.telemetry ?? [],
          mode: run.mode,
          duration: run.duration,
          seed: run.seed,
        })),
    [hydrated, guestHistory]
  );

  const activeSessions = session?.user ? cloudState.sessions : guestSessions;
  const analysis = useMemo(() => analyzeReplaySessions(activeSessions), [activeSessions]);

  const drillTargetsQuery = useMemo(() => {
    return analysis.weakKeys
      .map((item) => item.key.trim().toLowerCase())
      .filter((k) => k.length === 1 && /[a-z0-9]/.test(k))
      .slice(0, 5)
      .join(',');
  }, [analysis.weakKeys]);

  const drillHref = drillTargetsQuery
    ? `/typing?mode=drill&duration=30&targets=${encodeURIComponent(drillTargetsQuery)}`
    : '/typing?mode=drill&duration=30';

  const maxHeatmapHits = useMemo(() => {
    const vals = Object.values(analysis.heatmap);
    return vals.length > 0 ? Math.max(...vals) : 1;
  }, [analysis.heatmap]);

  const maxFingerHits = useMemo(() => {
    const vals = analysis.fingerLoads.map((f) => f.hits);
    return vals.length > 0 ? Math.max(1, ...vals) : 1;
  }, [analysis.fingerLoads]);

  const isLoading = Boolean(session?.user && cloudState.loadedUserId !== session.user.id);
  const hasData = analysis.totalSessions > 0 && analysis.totalKeystrokes > 0;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-6 py-10 flex flex-col gap-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border pb-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2.5 text-accent-ink">
              <Sparkles className="w-6 h-6" />
              <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-text-primary font-display">
                Performance Lab
              </h1>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              Seed-aligned keystroke error diagnostics, finger workload balance, and slow bigrams
            </p>
          </div>

          {hasData && (
            <Link
              href={drillHref}
              className="px-4 py-2.5 min-h-[44px] bg-accent text-accent-foreground rounded-xl text-xs font-black uppercase tracking-wider inline-flex items-center justify-center gap-2 hover:brightness-105 transition-all shadow-sm shrink-0"
            >
              <Target className="w-4 h-4" />
              <span>Practice Weak Keys</span>
            </Link>
          )}
        </div>

        {!session?.user && (
          <div className="p-4 bg-surface border border-border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5 text-xs text-text-secondary font-medium">
              <Activity className="w-4 h-4 text-accent-ink shrink-0" />
              <span>
                {hasData
                  ? `Analyzing ${analysis.totalSessions} recent local guest session${analysis.totalSessions === 1 ? '' : 's'}. Sign in to sync replay diagnostics across devices.`
                  : 'Complete a typing test as a guest or sign in to analyze synced keystroke replays.'}
              </span>
            </div>
            <Link
              href="/login"
              className="text-xs font-bold uppercase tracking-wider text-accent-ink hover:underline inline-flex items-center gap-1.5 shrink-0"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </Link>
          </div>
        )}

        {isLoading ? (
          <div className="min-h-[320px] flex items-center justify-center border border-border rounded-2xl bg-surface">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                Reconstructing keystroke telemetry...
              </span>
            </div>
          </div>
        ) : !hasData ? (
          <div className="p-8 border border-border rounded-2xl bg-surface flex flex-col items-center justify-center text-center gap-6 min-h-[340px] shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center text-accent-ink">
              <Keyboard className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-2 max-w-md">
              <h2 className="text-lg font-black uppercase tracking-wider text-text-primary font-display">
                No Replay Telemetry Yet
              </h2>
              <p className="text-sm text-text-secondary leading-relaxed">
                Complete at least one typing test to unlock keystroke heatmaps, finger workload distribution, slow bigram timing, and weak-key drills.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button href="/typing" variant="primary">
                Start Typing Test
              </Button>
              <Button href="/learn" variant="secondary">
                Browse Curriculum
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Top Diagnostic Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Keyboard Heatmap */}
              <div className="lg:col-span-2 p-6 bg-surface border border-border rounded-2xl flex flex-col shadow-xs gap-6">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
                  <div className="flex items-center gap-2">
                    <Keyboard className="w-4 h-4 text-accent-ink" />
                    <span className="text-xs font-black uppercase tracking-widest text-text-primary">
                      Keystroke Frequency Map
                    </span>
                  </div>
                  <span className="text-xs font-mono text-text-secondary">
                    {analysis.totalSessions} session{analysis.totalSessions === 1 ? '' : 's'} ·{' '}
                    {analysis.totalKeystrokes.toLocaleString('en-US')} keys
                  </span>
                </div>

                <div className="flex flex-col gap-2 max-w-xl mx-auto w-full py-2">
                  {KEYBOARD_ROWS.map((row, rowIdx) => (
                    <div key={rowIdx} className="flex justify-center gap-1 sm:gap-1.5">
                      {row.map((key) => {
                        const count = analysis.heatmap[key] || 0;
                        const ratio = count / maxHeatmapHits;
                        let heatClass = 'bg-background text-text-secondary border-border';
                        if (ratio >= 0.65 && count > 0) {
                          heatClass = 'bg-accent text-accent-foreground border-accent';
                        } else if (ratio >= 0.35 && count > 0) {
                          heatClass = 'bg-accent/40 text-text-primary border-accent/60';
                        } else if (count > 0) {
                          heatClass = 'bg-accent/15 text-text-primary border-accent/30';
                        }

                        return (
                          <div
                            key={key}
                            className={`flex-1 max-w-[44px] h-10 sm:h-11 rounded-lg border flex flex-col items-center justify-center font-mono font-bold select-none text-[11px] sm:text-xs ${heatClass}`}
                          >
                            <span>{key.toUpperCase()}</span>
                            {count > 0 && (
                              <span className="text-[9px] font-normal opacity-80 leading-none mt-0.5 tabular-nums">
                                {count}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  {/* Spacebar row */}
                  <div className="flex justify-center pt-1">
                    <div className="w-48 sm:w-64 h-9 rounded-lg border border-border bg-surface-accent/60 flex items-center justify-center font-mono text-xs font-semibold text-text-secondary">
                      SPACE ({analysis.heatmap[' '] || 0})
                    </div>
                  </div>
                </div>
              </div>

              {/* Hand Balance & Slow Transitions */}
              <div className="flex flex-col gap-6">
                <div className="p-6 bg-surface border border-border rounded-2xl flex flex-col shadow-xs gap-4">
                  <div className="flex items-center gap-2 border-b border-border pb-4">
                    <BarChart2 className="w-4 h-4 text-accent-ink" />
                    <span className="text-xs font-black uppercase tracking-widest text-text-primary">
                      Hands Load Balance
                    </span>
                  </div>

                  <div className="flex items-center justify-around text-center py-1">
                    <div className="flex flex-col">
                      <span className="text-2xl font-bold font-mono text-text-primary tabular-nums">
                        {analysis.handDistribution.left}%
                      </span>
                      <span className="text-xs font-bold uppercase tracking-wider text-text-secondary mt-0.5">
                        Left Hand
                      </span>
                    </div>
                    <div className="w-px h-8 bg-border" />
                    <div className="flex flex-col">
                      <span className="text-2xl font-bold font-mono text-text-primary tabular-nums">
                        {analysis.handDistribution.right}%
                      </span>
                      <span className="text-xs font-bold uppercase tracking-wider text-text-secondary mt-0.5">
                        Right Hand
                      </span>
                    </div>
                  </div>

                  <div className="w-full h-2.5 bg-background border border-border rounded-full overflow-hidden flex">
                    <div
                      className="bg-accent h-full transition-all"
                      style={{ width: `${analysis.handDistribution.left}%` }}
                    />
                    <div
                      className="bg-text-secondary/35 h-full transition-all"
                      style={{ width: `${analysis.handDistribution.right}%` }}
                    />
                  </div>
                </div>

                {/* Slow Bigram Transitions */}
                <div className="p-6 bg-surface border border-border rounded-2xl flex flex-col shadow-xs gap-4 flex-1">
                  <div className="flex items-center gap-2 border-b border-border pb-4">
                    <Zap className="w-4 h-4 text-accent-ink" />
                    <span className="text-xs font-black uppercase tracking-widest text-text-primary">
                      Slowest Key Transitions
                    </span>
                  </div>

                  {analysis.slowBigrams.length === 0 ? (
                    <div className="text-center py-6 text-xs text-text-secondary font-medium">
                      Type longer sequences to detect repeated letter transitions.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {analysis.slowBigrams.map((item) => (
                        <div
                          key={item.bigram}
                          className="flex justify-between items-center p-2.5 bg-background border border-border rounded-lg font-mono text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-text-primary uppercase px-2 py-0.5 bg-surface-accent rounded">
                              {item.bigram}
                            </span>
                            <span className="text-[11px] text-text-secondary">{item.count}x</span>
                          </div>
                          <span className="text-error font-bold tabular-nums">{item.avgMs} ms avg</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Row: Finger Workload Bars + Weak Keys */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Finger Workload Distribution */}
              <div className="p-6 bg-surface border border-border rounded-2xl flex flex-col shadow-xs gap-4">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-accent-ink" />
                    <span className="text-xs font-black uppercase tracking-widest text-text-primary">
                      Finger Workload Distribution
                    </span>
                  </div>
                  <span className="text-xs text-text-secondary font-mono">Share (%)</span>
                </div>

                <div className="flex flex-col gap-3">
                  {analysis.fingerLoads.map((item) => {
                    const widthPct = Math.round((item.hits / maxFingerHits) * 100);
                    return (
                      <div key={item.finger} className="flex flex-col gap-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="font-semibold text-text-primary">{item.finger}</span>
                          <span className="text-text-secondary tabular-nums">
                            {item.hits} ({item.percentage}%)
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-background border border-border rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent rounded-full transition-all duration-300"
                            style={{ width: `${item.hits > 0 ? Math.max(4, widthPct) : 0}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Weak Keys & One-Click Drill */}
              <div className="p-6 bg-surface border border-border rounded-2xl flex flex-col justify-between shadow-xs gap-4">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-accent-ink" />
                      <span className="text-xs font-black uppercase tracking-widest text-text-primary">
                        Top Error Keys
                      </span>
                    </div>
                    <span className="text-xs text-text-secondary font-mono">Error Rate</span>
                  </div>

                  {analysis.weakKeys.length === 0 ? (
                    <div className="text-center py-8 text-sm text-text-secondary font-medium">
                      Zero missed characters recorded across these sessions.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3.5">
                      {analysis.weakKeys.map((item) => (
                        <div key={item.key} className="flex flex-col gap-1.5">
                          <div className="flex justify-between items-center text-xs font-mono">
                            <span className="font-bold text-text-primary">
                              {item.key === ' ' ? 'SPACE' : `"${item.key.toUpperCase()}"`}
                            </span>
                            <span className="text-error font-bold tabular-nums">
                              {item.errors} / {item.attempts} ({item.errorRate}%)
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-background border border-border rounded-full overflow-hidden">
                            <div
                              className="bg-error h-full rounded-full"
                              style={{ width: `${Math.min(100, Math.max(8, Math.round(item.errorRate)))}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {analysis.weakKeys.length > 0 && (
                  <div className="pt-4 border-t border-border flex items-center justify-between gap-4">
                    <span className="text-xs text-text-secondary">
                      Generate a custom 30s drill weighted toward your error keys.
                    </span>
                    <Link
                      href={drillHref}
                      className="px-4 py-2.5 min-h-[42px] bg-accent text-accent-foreground rounded-xl text-xs font-black uppercase tracking-wider inline-flex items-center gap-1.5 hover:brightness-105 transition-all shrink-0"
                    >
                      <Target className="w-3.5 h-3.5" />
                      <span>Drill Now</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
