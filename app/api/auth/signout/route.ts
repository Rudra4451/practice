import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOriginIfPresent } from '@/lib/security/http';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const originError = assertSameOriginIfPresent(request);
  if (originError) return originError;

  try {
    const supabase = await createClient();
    await supabase.auth.signOut();

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
      // ignore cookie cleanup fallback errors
    }
    return NextResponse.json({ success: false, error: 'Sign-out failed' }, { status: 500 });
  }
}
