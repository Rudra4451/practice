'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { formatUtcDate } from '@/lib/utils/format-date';
import { Trophy, ShieldAlert, ArrowRight, RefreshCw } from 'lucide-react';
import type {
  LeaderboardDuration,
  LeaderboardEntry,
  LeaderboardMode,
  LeaderboardTimeframe,
} from '@/lib/data/leaderboard';

export function getRankTier(wpm: number) {
  if (wpm >= 140) {
    return {
      name: 'Grandmaster',
      color: 'text-error bg-error/10 border border-error/30 font-semibold',
    };
  }
  if (wpm >= 120) {
    return {
      name: 'Master',
      color: 'text-accent-ink bg-accent/10 border border-accent/30 font-semibold',
    };
  }
  if (wpm >= 100) {
    return {
      name: 'Diamond',
      color: 'text-warning bg-warning/10 border border-warning/30 font-semibold',
    };
  }
  if (wpm >= 80) {
    return {
      name: 'Platinum',
      color: 'text-text-primary bg-surface border border-border font-semibold',
    };
  }
  if (wpm >= 60) {
    return {
      name: 'Gold',
      color: 'text-success bg-success/10 border border-success/30 font-semibold',
    };
  }
  if (wpm >= 40) {
    return {
      name: 'Silver',
      color: 'text-text-secondary bg-surface-accent border border-border font-semibold',
    };
  }
  return {
    name: 'Bronze',
    color: 'text-text-secondary bg-surface border border-border font-semibold',
  };
}

const TIMEFRAME_OPTIONS: Array<{ id: LeaderboardTimeframe; label: string }> = [
  { id: 'daily', label: 'Daily (24h)' },
  { id: 'weekly', label: 'Weekly (7d)' },
  { id: 'all_time', label: 'All Time' },
];

const MODE_OPTIONS: LeaderboardMode[] = [
  'words',
  'quotes',
  'numbers',
  'punctuation',
  'code',
];

const DURATION_OPTIONS: LeaderboardDuration[] = [15, 30, 60, 120];

const RANK_TIER_GUIDE = [
  { name: 'Grandmaster', limit: '140+ WPM', badgeClass: 'bg-error/10 text-error border-error/30' },
  { name: 'Master', limit: '120-139 WPM', badgeClass: 'bg-accent/10 text-accent-ink border-accent/30' },
  { name: 'Diamond', limit: '100-119 WPM', badgeClass: 'bg-warning/10 text-warning border-warning/30' },
  { name: 'Platinum', limit: '80-99 WPM', badgeClass: 'bg-surface-accent text-text-primary border-border' },
  { name: 'Gold', limit: '60-79 WPM', badgeClass: 'bg-success/10 text-success border-success/30' },
  { name: 'Silver', limit: '40-59 WPM', badgeClass: 'bg-surface-accent text-text-secondary border-border' },
];

interface LeaderboardClientProps {
  initialEntries: LeaderboardEntry[];
  initialMode: LeaderboardMode;
  initialDuration: LeaderboardDuration;
  initialTimeframe: LeaderboardTimeframe;
  initialError: string | null;
}

export const LeaderboardClient: React.FC<LeaderboardClientProps> = ({
  initialEntries,
  initialMode,
  initialDuration,
  initialTimeframe,
  initialError,
}) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>(initialEntries);
  const [mode, setMode] = useState<LeaderboardMode>(initialMode);
  const [duration, setDuration] = useState<LeaderboardDuration>(initialDuration);
  const [timeframe, setTimeframe] = useState<LeaderboardTimeframe>(initialTimeframe);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(Boolean(initialError));
  const isInitialMountRef = useRef(true);

  const fetchLeaderboard = useCallback(
    async (
      targetMode: LeaderboardMode,
      targetDuration: LeaderboardDuration,
      targetTimeframe: LeaderboardTimeframe
    ) => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/leaderboard?mode=${targetMode}&duration=${targetDuration}&timeframe=${targetTimeframe}`
        );
        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}`);
        }
        const json = (await res.json()) as { data?: LeaderboardEntry[] };
        if (Array.isArray(json.data)) {
          setEntries(json.data);
          setFetchError(false);
        } else {
          setFetchError(true);
        }
      } catch (err) {
        console.error('Leaderboard fetch error:', err);
        setFetchError(true);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Refetch and sync query params cleanly when user actively updates filters after hydration
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    const params = new URLSearchParams({
      mode,
      duration: String(duration),
      timeframe,
    });
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `/leaderboard?${params.toString()}`);
    }
    void fetchLeaderboard(mode, duration, timeframe);
  }, [mode, duration, timeframe, fetchLeaderboard]);

  // Realtime subscription to refresh automatically when new verified scores land
  useEffect(() => {
    let supabaseInstance: ReturnType<typeof createClient> | null = null;
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null;

    try {
      supabaseInstance = createClient();
      channel = supabaseInstance
        .channel(`leaderboard-${mode}-${duration}-${timeframe}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'test_results',
          },
          () => {
            void fetchLeaderboard(mode, duration, timeframe);
          }
        )
        .subscribe();
    } catch (err) {
      console.error('Failed to subscribe to leaderboard realtime changes:', err);
    }

    return () => {
      if (supabaseInstance && channel) {
        try {
          void supabaseInstance.removeChannel(channel);
        } catch (err) {
          console.error('Error removing leaderboard realtime channel:', err);
        }
      }
    };
  }, [mode, duration, timeframe, fetchLeaderboard]);

  return (
    <main className="flex-1 max-w-5xl w-full mx-auto px-4 md:px-6 py-10 flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border pb-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 text-accent-ink">
            <Trophy className="w-7 h-7" aria-hidden="true" />
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-text-primary font-display">
              Global Leaderboards
            </h1>
          </div>
          <p className="text-xs font-medium text-text-secondary">
            Every entry is reconstructed and verified server-side from keystroke replay telemetry.
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={() => void fetchLeaderboard(mode, duration, timeframe)}
          disabled={loading}
          className="self-start sm:self-auto min-h-[38px] px-3.5 py-1.5 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-col gap-4 p-5 bg-surface border border-border rounded-2xl shadow-sm">
        {/* Timeframe */}
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
          <span className="w-24 text-xs font-semibold uppercase tracking-wider text-text-secondary shrink-0">
            Timeframe
          </span>
          <div className="overflow-x-auto scrollbar-none">
            <div className="inline-flex bg-surface-accent p-1 rounded-xl gap-1">
              {TIMEFRAME_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTimeframe(opt.id)}
                  aria-pressed={timeframe === opt.id}
                  className={`px-4 py-2 min-h-[38px] text-xs font-semibold transition-all cursor-pointer whitespace-nowrap rounded-lg ${
                    timeframe === opt.id
                      ? 'bg-surface border border-border text-text-primary shadow-xs'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mode */}
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
          <span className="w-24 text-xs font-semibold uppercase tracking-wider text-text-secondary shrink-0">
            Mode
          </span>
          <div className="overflow-x-auto scrollbar-none">
            <div className="inline-flex bg-surface-accent p-1 rounded-xl gap-1">
              {MODE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setMode(opt)}
                  aria-pressed={mode === opt}
                  className={`px-4 py-2 min-h-[38px] text-xs font-semibold capitalize transition-all cursor-pointer whitespace-nowrap rounded-lg ${
                    mode === opt
                      ? 'bg-surface border border-border text-text-primary shadow-xs'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Duration */}
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
          <span className="w-24 text-xs font-semibold uppercase tracking-wider text-text-secondary shrink-0">
            Duration
          </span>
          <div className="overflow-x-auto scrollbar-none">
            <div className="inline-flex bg-surface-accent p-1 rounded-xl gap-1">
              {DURATION_OPTIONS.map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => setDuration(time)}
                  aria-pressed={duration === time}
                  className={`px-4 py-2 min-h-[38px] text-xs font-semibold font-mono transition-all cursor-pointer whitespace-nowrap rounded-lg ${
                    duration === time
                      ? 'bg-surface border border-border text-text-primary shadow-xs'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {time}s
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Results Surface */}
      <div className="p-6 bg-surface border border-border rounded-2xl shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-text-secondary">
            <div className="w-7 h-7 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            <span className="text-xs font-medium">Loading rankings...</span>
          </div>
        ) : fetchError ? (
          <div className="flex flex-col gap-4 py-12 items-center justify-center text-center">
            <ShieldAlert className="w-10 h-10 text-error" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <span className="text-base font-bold text-text-primary">
                Unable to Load Rankings
              </span>
              <span className="text-sm text-text-secondary">
                Please check your connection and retry.
              </span>
            </div>
            <Button
              type="button"
              onClick={() => void fetchLeaderboard(mode, duration, timeframe)}
              variant="secondary"
            >
              Retry
            </Button>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col gap-8">
            <div className="flex items-start sm:items-center gap-3 p-4 rounded-xl border border-border bg-surface-accent">
              <ShieldAlert className="w-5 h-5 text-accent-ink flex-shrink-0 mt-0.5 sm:mt-0" />
              <div className="flex flex-col text-left gap-0.5">
                <span className="text-sm font-semibold text-text-primary">
                  No verified scores recorded in {mode} ({duration}s · {timeframe.replace('_', ' ')}) yet
                </span>
                <span className="text-xs text-text-secondary">
                  Complete a verified run while signed in to claim Rank #1 in this bracket.
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Official Speed Rank Tiers
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {RANK_TIER_GUIDE.map((tier) => (
                  <div
                    key={tier.name}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-background"
                  >
                    <span
                      className={`px-2.5 py-1 rounded-lg border text-xs font-semibold ${tier.badgeClass}`}
                    >
                      {tier.name}
                    </span>
                    <span className="font-mono text-xs font-semibold text-text-secondary tabular-nums">
                      {tier.limit}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center border-t border-border pt-6">
              <Button href="/typing" variant="primary" className="px-7 py-3">
                <span>Start Typing to Qualify</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {/* Top 3 Podium */}
            {entries.length >= 3 && (
              <div className="grid grid-cols-3 gap-3 md:gap-6 items-end pt-6 px-1">
                {/* 2nd Place */}
                <Link
                  href={`/u/${entries[1].profiles.username}`}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-border bg-background hover:border-accent/40 transition-colors text-center"
                >
                  <span className="w-7 h-7 rounded-lg bg-surface-accent border border-border text-text-secondary font-mono font-bold text-xs flex items-center justify-center">
                    2
                  </span>
                  <span className="text-xs font-semibold text-text-primary truncate max-w-full">
                    {entries[1].profiles.display_name || entries[1].profiles.username}
                  </span>
                  <span className="text-lg font-bold font-mono text-accent-ink tabular-nums">
                    {entries[1].wpm} WPM
                  </span>
                </Link>

                {/* 1st Place */}
                <Link
                  href={`/u/${entries[0].profiles.username}`}
                  className="flex flex-col items-center gap-2 p-5 rounded-2xl border border-accent/40 bg-accent/10 hover:border-accent transition-colors text-center shadow-sm"
                >
                  <Trophy className="w-5 h-5 text-warning" aria-hidden="true" />
                  <span className="text-sm font-bold text-text-primary truncate max-w-full">
                    {entries[0].profiles.display_name || entries[0].profiles.username}
                  </span>
                  <span className="text-2xl font-bold font-mono text-accent-ink tabular-nums">
                    {entries[0].wpm} WPM
                  </span>
                </Link>

                {/* 3rd Place */}
                <Link
                  href={`/u/${entries[2].profiles.username}`}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-border bg-background hover:border-accent/40 transition-colors text-center"
                >
                  <span className="w-7 h-7 rounded-lg bg-surface-accent border border-border text-text-secondary font-mono font-bold text-xs flex items-center justify-center">
                    3
                  </span>
                  <span className="text-xs font-semibold text-text-primary truncate max-w-full">
                    {entries[2].profiles.display_name || entries[2].profiles.username}
                  </span>
                  <span className="text-lg font-bold font-mono text-text-primary tabular-nums">
                    {entries[2].wpm} WPM
                  </span>
                </Link>
              </div>
            )}

            {/* Full Rankings Table */}
            <div className="overflow-x-auto rounded-xl border border-border bg-background">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-xs uppercase font-semibold text-text-secondary bg-surface-accent">
                    <th className="py-3 px-3 w-12 text-center">Rank</th>
                    <th className="py-3 px-4">Typist</th>
                    <th className="py-3 px-4">Tier</th>
                    <th className="py-3 px-4 text-right">Speed</th>
                    <th className="py-3 px-4 text-right">Accuracy</th>
                    <th className="py-3 px-4 text-right">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, idx) => {
                    const rank = idx + 1;
                    const username = entry.profiles.username || 'anonymous';
                    const displayName = entry.profiles.display_name || username;
                    const tier = getRankTier(entry.wpm);

                    return (
                      <tr
                        key={entry.id}
                        className="border-b border-border/60 last:border-b-0 text-xs md:text-sm text-text-primary hover:bg-surface-accent/50 transition-colors"
                      >
                        <td className="py-3.5 px-3 text-center font-mono font-bold">
                          {rank <= 3 ? (
                            <span
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs border ${
                                rank === 1
                                  ? 'bg-warning/15 border-warning/40 text-warning'
                                  : 'bg-surface-accent border-border text-text-primary'
                              }`}
                            >
                              {rank}
                            </span>
                          ) : (
                            <span className="text-text-secondary">{rank}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-semibold">
                          <Link
                            href={`/u/${username}`}
                            className="inline-flex items-center gap-2.5 hover:text-accent-ink transition-colors"
                          >
                            <UserAvatar
                              avatarUrl={entry.profiles.avatar_url}
                              alt={`${displayName}'s avatar`}
                              size="sm"
                            />
                            <span>{displayName}</span>
                          </Link>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-lg text-xs whitespace-nowrap ${tier.color}`}
                          >
                            {tier.name}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-accent-ink tabular-nums">
                          {entry.wpm} WPM
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-text-secondary tabular-nums">
                          {entry.accuracy}%
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-text-secondary text-xs whitespace-nowrap">
                          {formatUtcDate(entry.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

