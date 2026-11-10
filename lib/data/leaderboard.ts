import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export const VALID_MODES = ['words', 'quotes', 'numbers', 'punctuation', 'code'] as const;
export const VALID_DURATIONS = [15, 30, 60, 120] as const;
export const VALID_TIMEFRAMES = ['daily', 'weekly', 'all_time'] as const;

export type LeaderboardMode = (typeof VALID_MODES)[number];
export type LeaderboardDuration = (typeof VALID_DURATIONS)[number];
export type LeaderboardTimeframe = (typeof VALID_TIMEFRAMES)[number];

export interface LeaderboardProfile {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface LeaderboardEntry {
  id: string;
  wpm: number;
  accuracy: number;
  consistency: number;
  mode: string;
  duration: number;
  created_at: string;
  profiles: LeaderboardProfile;
}

interface RawLeaderboardRow {
  id: string;
  user_id: string | null;
  wpm: number;
  accuracy: number;
  consistency: number;
  mode: string;
  duration: number;
  created_at: string;
  profiles?: LeaderboardProfile | LeaderboardProfile[] | null;
  username?: string;
  display_name?: string | null;
  avatar_url?: string | null;
}

function getCutoffIso(timeframe: LeaderboardTimeframe): string | null {
  const now = Date.now();
  if (timeframe === 'daily') {
    return new Date(now - 24 * 60 * 60 * 1000).toISOString();
  }
  if (timeframe === 'weekly') {
    return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  }
  return null;
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

export const getLeaderboardEntries = cache(
  async (params: {
    mode: LeaderboardMode;
    duration: LeaderboardDuration;
    timeframe: LeaderboardTimeframe;
  }): Promise<{ entries: LeaderboardEntry[]; error: string | null }> => {
    const { mode, duration, timeframe } = params;
    const cutoffIso = getCutoffIso(timeframe);
    const supabase = await createClient();

    let viewQuery = supabase
      .from('leaderboard_view')
      .select(
        'id, user_id, wpm, accuracy, consistency, mode, duration, created_at, username, display_name, avatar_url'
      )
      .eq('mode', mode)
      .eq('duration', duration)
      .not('user_id', 'is', null);

    if (cutoffIso) {
      viewQuery = viewQuery.gte('created_at', cutoffIso);
    }

    const { data: viewData, error: viewError } = await viewQuery
      .order('wpm', { ascending: false })
      .order('accuracy', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(100);

    let data: RawLeaderboardRow[] | null = viewData as RawLeaderboardRow[] | null;

    if (viewError) {
      const isRelationMissing =
        viewError.code === 'PGRST205' ||
        viewError.message?.toLowerCase().includes('could not find the table') ||
        viewError.message?.toLowerCase().includes('does not exist');

      if (!isRelationMissing) {
        console.error('Leaderboard view query error:', viewError);
        return { entries: [], error: 'Failed to load leaderboard' };
      }

      // Live production schema currently lacks leaderboard_view; keep test_results fallback active
      // until the database hardening migration applies cleanly.
      const runFallbackQuery = async (filterRankedColumn: boolean) => {
        let query = supabase
          .from('test_results')
          .select(
            `
            id,
            user_id,
            wpm,
            accuracy,
            consistency,
            mode,
            duration,
            created_at,
            profiles (
              username,
              display_name,
              avatar_url
            )
          `
          )
          .eq('mode', mode)
          .eq('duration', duration)
          .eq('is_invalidated', false)
          .not('user_id', 'is', null);

        if (filterRankedColumn) {
          query = query.eq('is_ranked', true);
        }
        if (cutoffIso) {
          query = query.gte('created_at', cutoffIso);
        }

        return query
          .order('wpm', { ascending: false })
          .order('accuracy', { ascending: false })
          .order('created_at', { ascending: true })
          .limit(300);
      };

      let { data: fallbackData, error: fallbackError } = await runFallbackQuery(true);
      if (fallbackError && isMissingIsRankedColumnError(fallbackError)) {
        const retryResult = await runFallbackQuery(false);
        fallbackData = retryResult.data;
        fallbackError = retryResult.error;
      }

      if (fallbackError) {
        console.error('Leaderboard fallback query error:', fallbackError);
        return { entries: [], error: 'Failed to load leaderboard' };
      }

      data = fallbackData as unknown as RawLeaderboardRow[] | null;
    }

    // Enforce one highest-WPM verified entry per authenticated user.
    const topScoresMap = new Map<string, LeaderboardEntry>();

    for (const item of data ?? []) {
      if (!item.user_id) continue;
      if (topScoresMap.has(item.user_id)) continue;

      const joinedProfile = Array.isArray(item.profiles)
        ? item.profiles[0]
        : item.profiles;

      topScoresMap.set(item.user_id, {
        id: item.id,
        wpm: item.wpm,
        accuracy: item.accuracy,
        consistency: item.consistency,
        mode: item.mode,
        duration: item.duration,
        created_at: item.created_at,
        profiles: {
          username: item.username ?? joinedProfile?.username ?? 'anonymous',
          display_name: item.display_name ?? joinedProfile?.display_name ?? null,
          avatar_url: item.avatar_url ?? joinedProfile?.avatar_url ?? null,
        },
      });
    }

    return {
      entries: Array.from(topScoresMap.values()).slice(0, 100),
      error: null,
    };
  }
);

