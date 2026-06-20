import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
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
  } catch (err: any) {
    console.error('Server SignOut Exception:', err);
    try {
      const cookieStore = await cookies();
      const allCookies = cookieStore.getAll();
      for (const cookie of allCookies) {
        if (cookie.name.startsWith('sb-')) {
          cookieStore.delete(cookie.name);
        }
      }
    } catch (e) {
      // ignore
    }
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
