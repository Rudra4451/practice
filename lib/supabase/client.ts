import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

let clientInstance: SupabaseClient<Database> | null = null;

export const createClient = (): SupabaseClient<Database> => {
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

  if (!clientInstance) {
    clientInstance = createBrowserClient<Database>(url, anonKey);
  }

  return clientInstance;
};

/**
 * Resets the cached Supabase browser client instance.
 * Call this after signing out so the next createClient() call
 * returns a fresh, unauthenticated client.
 */
export const resetClient = (): void => {
  clientInstance = null;
};
