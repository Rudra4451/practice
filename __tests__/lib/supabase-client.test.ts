import { afterEach, describe, expect, it } from 'vitest';
import { isSupabaseRealtimeEnabled } from '@/lib/supabase/client';

describe('isSupabaseRealtimeEnabled', () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  afterEach(() => {
    if (originalUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    }
    if (originalKey === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    }
  });

  it('returns false for placeholder or missing Supabase configuration', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'dummy-ci-anon-key-not-a-real-secret';
    expect(isSupabaseRealtimeEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://your-project-ref.supabase.co';
    expect(isSupabaseRealtimeEnabled()).toBe(false);

    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(isSupabaseRealtimeEnabled()).toBe(false);
  });

  it('returns true when a real Supabase URL and anon key are configured', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcdefghijk.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-value';
    expect(isSupabaseRealtimeEnabled()).toBe(true);
  });
});

