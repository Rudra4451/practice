import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      return NextResponse.json({
        success: false,
        status: 'misconfigured',
        error: 'Missing environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.'
      }, { status: 500 });
    }

    const supabase = await createClient();
    
    // Test database connection by fetching achievements
    const { data: achievements, error: dbError } = await supabase
      .from('achievements')
      .select('code, name')
      .limit(5);

    if (dbError) {
      return NextResponse.json({
        success: false,
        status: 'db_error',
        error: dbError.message,
        details: dbError
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      status: 'connected',
      environment: {
        url: url,
        hasAnonKey: !!key
      },
      testQuery: {
        table: 'achievements',
        recordCount: achievements?.length || 0,
        records: achievements
      }
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal connection test failure.';
    return NextResponse.json({
      success: false,
      status: 'server_error',
      error: message
    }, { status: 500 });
  }
}
