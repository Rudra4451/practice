import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { sanitizeRedirectPath, DEFAULT_AUTH_REDIRECT } from '@/lib/security/redirect';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = sanitizeRedirectPath(
    requestUrl.searchParams.get('next'),
    DEFAULT_AUTH_REDIRECT
  );

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }

    console.error('OAuth code exchange failed:', error.message);
  }

  return NextResponse.redirect(new URL('/login?error=auth-failed', requestUrl.origin));
}
