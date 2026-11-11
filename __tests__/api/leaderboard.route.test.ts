import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}));

import { GET } from '@/app/api/leaderboard/route';

interface QueryResult {
  data: unknown[] | null;
  error: { code?: string; message: string } | null;
}

function makeChain(result: QueryResult) {
  const chain: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    not: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
  } = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    not: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(async () => result),
  };
  return chain;
}

describe('GET /api/leaderboard', () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it('returns 400 when filter parameters fail Zod validation', async () => {
    const res = await GET(
      new Request('http://localhost:3000/api/leaderboard?mode=hacked&duration=999&timeframe=forever')
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Invalid leaderboard filter parameters');
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('ignores demo=true query params and queries Supabase normally', async () => {
    const viewChain = makeChain({
      data: [
        {
          id: 'row-1',
          user_id: 'user-1',
          wpm: 112,
          accuracy: 98.5,
          consistency: 91,
          mode: 'words',
          duration: 30,
          created_at: '2026-10-20T00:00:00Z',
          username: 'real_typist',
          display_name: 'Real Typist',
          avatar_url: null,
        },
        // Duplicate user should be collapsed to top score only
        {
          id: 'row-2',
          user_id: 'user-1',
          wpm: 98,
          accuracy: 97,
          consistency: 89,
          mode: 'words',
          duration: 30,
          created_at: '2026-10-19T00:00:00Z',
          username: 'real_typist',
          display_name: 'Real Typist',
          avatar_url: null,
        },
        // Null user_id must always be filtered out
        {
          id: 'row-anon',
          user_id: null,
          wpm: 199,
          accuracy: 100,
          consistency: 99,
          mode: 'words',
          duration: 30,
          created_at: '2026-10-20T00:00:00Z',
          username: 'anon',
          display_name: null,
          avatar_url: null,
        },
      ],
      error: null,
    });

    const fromMock = vi.fn(() => viewChain);
    createClientMock.mockResolvedValue({ from: fromMock });

    const res = await GET(
      new Request('http://localhost:3000/api/leaderboard?mode=words&duration=30&timeframe=all_time&demo=true')
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string; wpm: number; profiles: { username: string } }> };
    expect(fromMock).toHaveBeenCalledWith('leaderboard_view');
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe('row-1');
    expect(body.data[0].profiles.username).toBe('real_typist');
  });

  it('falls back safely to test_results when leaderboard_view returns PGRST205', async () => {
    const viewChain = makeChain({
      data: null,
      error: { code: 'PGRST205', message: 'Could not find the table public.leaderboard_view in the schema cache' },
    });
    const fallbackChain = makeChain({
      data: [
        {
          id: 'fallback-1',
          user_id: 'user-2',
          wpm: 105,
          accuracy: 99,
          consistency: 88,
          mode: 'code',
          duration: 60,
          created_at: '2026-10-25T10:00:00Z',
          profiles: { username: 'coder_one', display_name: 'Coder One', avatar_url: null },
        },
      ],
      error: null,
    });

    const fromMock = vi.fn((table: string) => (table === 'leaderboard_view' ? viewChain : fallbackChain));
    createClientMock.mockResolvedValue({ from: fromMock });

    const res = await GET(
      new Request('http://localhost:3000/api/leaderboard?mode=code&duration=60&timeframe=weekly')
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string; profiles: { username: string } }> };
    expect(fromMock).toHaveBeenCalledWith('leaderboard_view');
    expect(fromMock).toHaveBeenCalledWith('test_results');
    expect(fallbackChain.eq).toHaveBeenCalledWith('is_invalidated', false);
    expect(fallbackChain.eq).toHaveBeenCalledWith('is_ranked', true);
    expect(fallbackChain.not).toHaveBeenCalledWith('user_id', 'is', null);
    expect(fallbackChain.gte).toHaveBeenCalled();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].profiles.username).toBe('coder_one');
  });

  it('retries fallback query without is_ranked filter when 42703 is returned on pre-migration schema', async () => {
    const viewChain = makeChain({
      data: null,
      error: { code: 'PGRST205', message: 'Could not find the table public.leaderboard_view in the schema cache' },
    });
    const legacyMissingColumnChain = makeChain({
      data: null,
      error: { code: '42703', message: 'column test_results.is_ranked does not exist' },
    });
    const legacyRetryChain = makeChain({
      data: [
        {
          id: 'legacy-1',
          user_id: 'user-legacy',
          wpm: 99,
          accuracy: 98,
          consistency: 90,
          mode: 'words',
          duration: 30,
          created_at: '2026-06-01T00:00:00Z',
          profiles: { username: 'legacy_one', display_name: null, avatar_url: null },
        },
      ],
      error: null,
    });

    let testResultsCallCount = 0;
    createClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'leaderboard_view') return viewChain;
        testResultsCallCount += 1;
        return testResultsCallCount === 1 ? legacyMissingColumnChain : legacyRetryChain;
      }),
    });

    const res = await GET(
      new Request('http://localhost:3000/api/leaderboard?mode=words&duration=30&timeframe=all_time')
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string }> };
    expect(body.data[0].id).toBe('legacy-1');
    expect(legacyMissingColumnChain.eq).toHaveBeenCalledWith('is_ranked', true);
    expect(legacyRetryChain.eq).not.toHaveBeenCalledWith('is_ranked', true);
  });

  it('masks internal database errors instead of exposing raw messages', async () => {
    const viewChain = makeChain({
      data: null,
      error: { code: '42501', message: 'permission denied for schema internal_secret' },
    });
    const fromMock = vi.fn(() => viewChain);
    createClientMock.mockResolvedValue({ from: fromMock });

    const res = await GET(new Request('http://localhost:3000/api/leaderboard'));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Failed to load leaderboard');
    expect(JSON.stringify(body)).not.toContain('internal_secret');
  });
});

