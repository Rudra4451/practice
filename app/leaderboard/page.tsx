import type { Metadata } from 'next';
import React from 'react';
import { Navbar } from '@/components/navbar';
import { LeaderboardClient } from '@/components/leaderboard/leaderboard-client';
import {
  getLeaderboardEntries,
  VALID_DURATIONS,
  VALID_MODES,
  VALID_TIMEFRAMES,
  type LeaderboardDuration,
  type LeaderboardMode,
  type LeaderboardTimeframe,
} from '@/lib/data/leaderboard';

export const metadata: Metadata = {
  title: 'Global Leaderboards',
  description:
    'Verified typing speed rankings across words, quotes, numbers, punctuation, and code modes.',
};

function parseMode(raw?: string): LeaderboardMode {
  return (VALID_MODES as readonly string[]).includes(raw ?? '')
    ? (raw as LeaderboardMode)
    : 'words';
}

function parseDuration(raw?: string): LeaderboardDuration {
  const num = Number(raw);
  return (VALID_DURATIONS as readonly number[]).includes(num)
    ? (num as LeaderboardDuration)
    : 30;
}

function parseTimeframe(raw?: string): LeaderboardTimeframe {
  return (VALID_TIMEFRAMES as readonly string[]).includes(raw ?? '')
    ? (raw as LeaderboardTimeframe)
    : 'all_time';
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await searchParams;
  const mode = parseMode(
    typeof resolvedParams.mode === 'string' ? resolvedParams.mode : undefined
  );
  const duration = parseDuration(
    typeof resolvedParams.duration === 'string' ? resolvedParams.duration : undefined
  );
  const timeframe = parseTimeframe(
    typeof resolvedParams.timeframe === 'string' ? resolvedParams.timeframe : undefined
  );

  const { entries, error } = await getLeaderboardEntries({
    mode,
    duration,
    timeframe,
  });

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />
      <LeaderboardClient
        initialEntries={entries}
        initialMode={mode}
        initialDuration={duration}
        initialTimeframe={timeframe}
        initialError={error}
      />
    </div>
  );
}
