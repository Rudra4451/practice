import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get('mode') || 'words';
    const duration = parseInt(searchParams.get('duration') || '30', 10);
    const timeframe = searchParams.get('timeframe') || 'all_time';

    const supabase = await createClient();

    const isDemo = searchParams.get('demo') === 'true' || searchParams.get('demo') !== null;
    if (isDemo) {
      // Pre-seeded high quality leaderboard entries representing active master typists
      const baseMockData = [
        { name: 'speed_demon', wpm: 154, acc: 99.1, tier: 'Grandmaster' },
        { name: 'racer_x', wpm: 147, acc: 98.4, tier: 'Grandmaster' },
        { name: 'key_ninja', wpm: 141, acc: 97.9, tier: 'Grandmaster' },
        { name: 'rudra_practice', wpm: 135, acc: 99.0, tier: 'Master' },
        { name: 'hyper_typer', wpm: 128, acc: 96.5, tier: 'Master' },
        { name: 'key_slayer', wpm: 119, acc: 97.1, tier: 'Diamond' },
        { name: 'matrix_flow', wpm: 112, acc: 96.0, tier: 'Diamond' },
        { name: 'swift_keys', wpm: 104, acc: 96.8, tier: 'Diamond' }
      ];

      // Mutate mock scores based on filters to look live
      const mutatedMockData = baseMockData.map((item, idx) => {
        let speedOffset = 0;
        if (timeframe === 'weekly') speedOffset = -2;
        if (timeframe === 'daily') speedOffset = -5;
        if (mode === 'quotes') speedOffset -= 8;
        if (mode === 'code') speedOffset -= 15;
        
        const finalWpm = Math.max(40, item.wpm + speedOffset);
        
        return {
          id: `mock-${idx}`,
          wpm: finalWpm,
          accuracy: item.acc,
          consistency: 94 + (idx % 3),
          mode,
          duration,
          created_at: new Date(Date.now() - idx * 3600000).toISOString(),
          profiles: {
            username: item.name,
            display_name: item.name === 'rudra_practice' ? 'Rudra Pratap Swain' : item.name.replace('_', ' '),
            avatar_url: null
          }
        };
      });

      return NextResponse.json({ data: mutatedMockData.sort((a, b) => b.wpm - a.wpm) });
    }

    // 1. Attempt to fetch from leaderboard_view (distinct highest runs per user)
    let viewQuery = supabase
      .from('leaderboard_view')
      .select('id, wpm, accuracy, consistency, mode, duration, created_at, profiles(username, display_name, avatar_url)')
      .eq('mode', mode)
      .eq('duration', duration);

    // Apply timeframe filters
    if (timeframe === 'daily') {
      const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      viewQuery = viewQuery.gt('created_at', past24h);
    } else if (timeframe === 'weekly') {
      const past7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      viewQuery = viewQuery.gt('created_at', past7d);
    }

    const { data: viewData, error: viewError } = await viewQuery
      .order('wpm', { ascending: false })
      .limit(50);

    // Check if view exists and query succeeded
    if (!viewError) {
      return NextResponse.json({ data: viewData });
    }

    // PostgREST/PostgreSQL error checking if the view/table doesn't exist
    const isRelationMissing = 
      viewError.code === '42P01' || 
      viewError.message?.includes('does not exist') ||
      viewError.message?.includes('schema cache') ||
      viewError.message?.includes('Could not find the table');
    if (!isRelationMissing) {
      console.error('Leaderboard database query error:', viewError);
      return NextResponse.json({ error: viewError.message }, { status: 500 });
    }

    console.warn('leaderboard_view relation does not exist; falling back to in-memory deduplication.');

    // 2. Fallback Logic: Query test_results and deduplicate in memory
    let fallbackQuery = supabase
      .from('test_results')
      .select('id, wpm, accuracy, consistency, mode, duration, created_at, user_id, profiles(username, display_name, avatar_url)')
      .eq('is_invalidated', false)
      .eq('mode', mode)
      .eq('duration', duration);

    if (timeframe === 'daily') {
      const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      fallbackQuery = fallbackQuery.gt('created_at', past24h);
    } else if (timeframe === 'weekly') {
      const past7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      fallbackQuery = fallbackQuery.gt('created_at', past7d);
    }

    // Fetch top 500 rows ordered by WPM DESC
    const { data: fallbackData, error: fallbackError } = await fallbackQuery
      .order('wpm', { ascending: false })
      .limit(500);

    if (fallbackError) {
      console.error('Leaderboard fallback query error:', fallbackError);
      return NextResponse.json({ error: fallbackError.message }, { status: 500 });
    }

    // Deduplicate in memory keeping only the highest score per user
    const seenUsers = new Set<string>();
    const deduplicatedData: Array<Record<string, unknown>> = [];

    for (const entry of (fallbackData || [])) {
      const userId = entry.user_id || 'anonymous';
      if (!seenUsers.has(userId)) {
        seenUsers.add(userId);
        deduplicatedData.push(entry);
      }

      if (deduplicatedData.length >= 50) {
        break;
      }
    }

    return NextResponse.json({ data: deduplicatedData });

  } catch (error: unknown) {
    console.error('Leaderboard route error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
