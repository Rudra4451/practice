import { createBrowserClient } from '@supabase/ssr';

export const createClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      `Supabase Client Error: Missing environment variables. ` +
      `URL: ${url ? 'present' : 'missing'}, ` +
      `Anon Key: ${anonKey ? 'present' : 'missing'}. ` +
      `Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local.`
    );
  }

  return createBrowserClient(url, anonKey);
};
