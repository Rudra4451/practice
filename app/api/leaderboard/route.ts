import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get('mode') || 'words';
    const duration = parseInt(searchParams.get('duration') || '30', 10);
    const timeframe = searchParams.get('timeframe') || 'all_time';

    const supabase = await createClient();

    let query = supabase
      .from('test_results')
      .select('id, wpm, accuracy, consistency, mode, duration, created_at, profiles(username, display_name, avatar_url)')
      .eq('is_invalidated', false)
      .eq('mode', mode)
      .eq('duration', duration);

    // Apply timeframe filters
    if (timeframe === 'daily') {
      const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      query = query.gt('created_at', past24h);
    } else if (timeframe === 'weekly') {
      const past7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gt('created_at', past7d);
    }

    const { data, error } = await query
      .order('wpm', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Leaderboard database query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Leaderboard route error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
