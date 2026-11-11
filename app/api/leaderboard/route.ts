import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getLeaderboardEntries,
  VALID_DURATIONS,
  VALID_MODES,
  VALID_TIMEFRAMES,
} from '@/lib/data/leaderboard';

const LeaderboardQuerySchema = z.object({
  mode: z.enum(VALID_MODES).default('words'),
  duration: z.coerce
    .number()
    .int()
    .refine((d): d is (typeof VALID_DURATIONS)[number] =>
      (VALID_DURATIONS as readonly number[]).includes(d)
    )
    .default(30),
  timeframe: z.enum(VALID_TIMEFRAMES).default('all_time'),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = LeaderboardQuerySchema.safeParse({
      mode: searchParams.get('mode') ?? undefined,
      duration: searchParams.get('duration') ?? undefined,
      timeframe: searchParams.get('timeframe') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid leaderboard filter parameters' },
        { status: 400 }
      );
    }

    const { entries, error } = await getLeaderboardEntries(parsed.data);

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ data: entries });
  } catch (err) {
    console.error('Leaderboard GET Exception:', err);
    return NextResponse.json({ error: 'Failed to load leaderboard' }, { status: 500 });
  }
}
