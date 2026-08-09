import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
    
    // Force delete all supabase cookies just to be absolutely sure
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    for (const cookie of allCookies) {
      if (cookie.name.startsWith('sb-')) {
        cookieStore.delete(cookie.name);
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Server SignOut Exception:', err);
    try {
      const cookieStore = await cookies();
      const allCookies = cookieStore.getAll();
      for (const cookie of allCookies) {
        if (cookie.name.startsWith('sb-')) {
          cookieStore.delete(cookie.name);
        }
      }
    } catch {
      // ignore
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
