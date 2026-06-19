import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    environment: {},
    connection: {},
    auth: {},
    tables: {},
    policies: {},
    trigger: {},
  };

  // 1. Environment Variables
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  diagnostics.environment = {
    NEXT_PUBLIC_SUPABASE_URL: url ? `${url.substring(0, 30)}...` : 'MISSING',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: key ? `${key.substring(0, 20)}...` : 'MISSING',
    NODE_ENV: process.env.NODE_ENV,
  };

  if (!url || !key) {
    return NextResponse.json(diagnostics, { status: 500 });
  }

  try {
    const supabase = await createClient();

    // 2. Connection test
    const { data: connTest, error: connErr } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);
    diagnostics.connection = {
      status: connErr ? 'FAILED' : 'OK',
      error: connErr?.message || null,
      errorCode: connErr?.code || null,
      errorHint: connErr?.hint || null,
    };

    // 3. Auth status
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    diagnostics.auth = {
      authenticated: !!user,
      userId: user?.id || null,
      email: user?.email || null,
      provider: user?.app_metadata?.provider || null,
      authError: authErr?.message || null,
    };

    // 4. Table existence and row counts
    const tableNames = ['profiles', 'test_results', 'replays', 'streaks', 'achievements', 'user_achievements', 'daily_challenges', 'challenge_links', 'user_challenge_progress'];
    for (const table of tableNames) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      diagnostics.tables[table] = {
        exists: !error,
        rowCount: count ?? 0,
        error: error?.message || null,
        errorCode: error?.code || null,
      };
    }

    // 5. Check if current user has a profile (if authenticated)
    if (user) {
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      diagnostics.auth.hasProfile = !!profile;
      diagnostics.auth.profileData = profile;
      diagnostics.auth.profileError = profileErr?.message || null;

      // Check if user has a streak row
      const { data: streak, error: streakErr } = await supabase
        .from('streaks')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      diagnostics.auth.hasStreak = !!streak;
      diagnostics.auth.streakError = streakErr?.message || null;
    }

    // 6. Check if the trigger function exists
    // Note: handle_new_user is a TRIGGER function, not an RPC function.
    // It cannot be called via supabase.rpc(). Check Supabase Dashboard > Database > Functions.
    diagnostics.trigger = {
      note: 'handle_new_user is a trigger function on auth.users. Verify it exists in Supabase Dashboard > Database > Functions.',
    };

    // 7. Test insert capability (test_results with null user for guest)
    const { error: insertTest } = await supabase
      .from('test_results')
      .insert({
        user_id: null,
        wpm: 0,
        raw_wpm: 0,
        accuracy: 0,
        consistency: 0,
        error_count: 0,
        backspace_count: 0,
        mode: 'words',
        duration: 1,
        seed: '__debug_test__',
      });
    diagnostics.insertTest = {
      canInsertGuestResult: !insertTest,
      error: insertTest?.message || null,
      errorCode: insertTest?.code || null,
    };

    // Clean up debug row
    if (!insertTest) {
      await supabase
        .from('test_results')
        .delete()
        .eq('seed', '__debug_test__');
    }

    return NextResponse.json(diagnostics);
  } catch (err: any) {
    diagnostics.connection = {
      status: 'EXCEPTION',
      error: err.message,
    };
    return NextResponse.json(diagnostics, { status: 500 });
  }
}
