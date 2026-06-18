import { createClient as createBrowserClient } from './supabase/client';

export { createClient as createBrowserClient } from './supabase/client';

/**
 * Validates that the public Supabase environment variables are present.
 */
export function validateSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      `Supabase Configuration Error: Environment variables are missing. ` +
      `URL: ${url ? 'present' : 'missing'}, ` +
      `Anon Key: ${anonKey ? 'present' : 'missing'}. ` +
      `Please check your .env.local file.`
    );
  }

  return { url, anonKey };
}

/**
 * Reusable client-side Supabase instance.
 */
export const supabase = typeof window !== 'undefined' ? createBrowserClient() : null;
