import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { isRankedMode, RANKED_MODES } from '@/lib/typing/metrics';

export interface PublicProfileData {
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    created_at: string;
  };
  stats: {
    bestWpm: number;
    avgWpm: number;
    avgAccuracy: number;
    testsCompleted: number;
    totalTimeSecs: number;
  };
  streak: {
    current: number;
    longest: number;
  } | null;
  achievements: Array<{
    unlocked_at: string;
    name: string;
    description: string;
    icon_path: string;
  }>;
  recentRuns: Array<{
    id: string;
    wpm: number;
    accuracy: number;
    mode: string;
    duration: number;
    created_at: string;
  }>;
}

interface RawProfileResultRow {
  id: string;
  wpm: number;
  accuracy: number;
  mode: string;
  duration: number;
  is_ranked?: boolean | null;
  created_at: string;
}

function escapeIlikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
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

export const getPublicProfileByUsername = cache(
  async (username: string): Promise<PublicProfileData | null> => {
    let decodedUsername: string;
    try {
      decodedUsername = decodeURIComponent(username);
    } catch {
      decodedUsername = username;
    }
    const cleanUsername = decodedUsername.trim().toLowerCase();
    if (!cleanUsername) return null;

    const supabase = await createClient();

    const { data: profileRows, error: profileErr } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, created_at')
      .ilike('username', escapeIlikePattern(cleanUsername))
      .order('created_at', { ascending: true })
      .limit(1);

    const profileData = profileRows?.[0] ?? null;
    if (profileErr || !profileData) {
      return null;
    }

    const fetchProfileResults = async () => {
      let supportsIsRanked = true;
      const primary = await supabase
        .from('test_results')
        .select('id, wpm, accuracy, mode, duration, is_ranked, created_at', {
          count: 'exact',
        })
        .eq('user_id', profileData.id)
        .eq('is_invalidated', false)
        .order('created_at', { ascending: false })
        .limit(200);

      if (primary.error && isMissingIsRankedColumnError(primary.error)) {
        supportsIsRanked = false;
        const legacy = await supabase
          .from('test_results')
          .select('id, wpm, accuracy, mode, duration, created_at', { count: 'exact' })
          .eq('user_id', profileData.id)
          .eq('is_invalidated', false)
          .order('created_at', { ascending: false })
          .limit(200);
        return {
          rows: (legacy.data ?? []) as RawProfileResultRow[],
          count: legacy.count,
          supportsIsRanked,
        };
      }

      return {
        rows: (primary.data ?? []) as RawProfileResultRow[],
        count: primary.count,
        supportsIsRanked,
      };
    };

    const [{ rows, count, supportsIsRanked }, { data: streakData }, { data: userAchievements }] =
      await Promise.all([
        fetchProfileResults(),
        supabase
          .from('streaks')
          .select('current_streak, longest_streak')
          .eq('user_id', profileData.id)
          .maybeSingle(),
        supabase
          .from('user_achievements')
          .select('unlocked_at, achievements(name, description, icon_path)')
          .eq('user_id', profileData.id)
          .order('unlocked_at', { ascending: false }),
      ]);

    const rankedRows = rows.filter(
      (r) => (r.is_ranked ?? true) !== false && isRankedMode(r.mode)
    );
    let bestWpm = rankedRows.length > 0 ? Math.max(...rankedRows.map((r) => r.wpm)) : 0;

    // Preserve authentic lifetime ranked peak when total verified runs exceed the 200-row sample
    if (count !== null && count > rows.length) {
      if (supportsIsRanked) {
        const peakRes = await supabase
          .from('test_results')
          .select('wpm, mode')
          .eq('user_id', profileData.id)
          .eq('is_invalidated', false)
          .eq('is_ranked', true)
          .order('wpm', { ascending: false })
          .limit(1);

        if (!peakRes.error && peakRes.data?.[0] && isRankedMode(peakRes.data[0].mode)) {
          bestWpm = Math.max(bestWpm, peakRes.data[0].wpm);
        }
      } else {
        const peakRes = await supabase
          .from('test_results')
          .select('wpm, mode')
          .eq('user_id', profileData.id)
          .eq('is_invalidated', false)
          .in('mode', [...RANKED_MODES])
          .order('wpm', { ascending: false })
          .limit(1);

        if (!peakRes.error && peakRes.data?.[0]) {
          bestWpm = Math.max(bestWpm, peakRes.data[0].wpm);
        }
      }
    }

    const avgWpm =
      rows.length > 0
        ? Math.round(rows.reduce((sum, r) => sum + r.wpm, 0) / rows.length)
        : 0;
    const avgAccuracy =
      rows.length > 0
        ? Math.round(rows.reduce((sum, r) => sum + r.accuracy, 0) / rows.length)
        : 0;
    const totalTimeSecs = rows.reduce((sum, r) => sum + r.duration, 0);

    const mappedAchievements = (userAchievements ?? []).map((item) => {
      const joined = Array.isArray(item.achievements)
        ? item.achievements[0]
        : item.achievements;
      return {
        unlocked_at: item.unlocked_at,
        name: joined?.name ?? 'Unlocked Badge',
        description: joined?.description ?? 'Milestone earned through verified practice.',
        icon_path: joined?.icon_path ?? '/achievements/default.svg',
      };
    });

    return {
      profile: {
        id: profileData.id,
        username: profileData.username,
        display_name: profileData.display_name,
        avatar_url: profileData.avatar_url,
        created_at: profileData.created_at,
      },
      stats: {
        bestWpm,
        avgWpm,
        avgAccuracy,
        testsCompleted: count ?? rows.length,
        totalTimeSecs,
      },
      streak: streakData
        ? {
            current: streakData.current_streak,
            longest: streakData.longest_streak,
          }
        : null,
      achievements: mappedAchievements,
      recentRuns: rows.slice(0, 8).map((r) => ({
        id: r.id,
        wpm: r.wpm,
        accuracy: r.accuracy,
        mode: r.mode,
        duration: r.duration,
        created_at: r.created_at,
      })),
    };
  }
);
