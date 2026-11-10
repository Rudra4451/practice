import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetChallengeRateLimitForTests } from '@/lib/security/rate-limit';

const { createClientMock, createAdminClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}));

vi.mock('@/lib/supabase/admin', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supabase/admin')>(
    '@/lib/supabase/admin'
  );
  return {
    ...actual,
    createAdminClient: createAdminClientMock,
  };
});

import { POST } from '@/app/api/challenges/route';

describe('POST /api/challenges', () => {
  beforeEach(() => {
    resetChallengeRateLimitForTests();
    createClientMock.mockReset();
    createAdminClientMock.mockReset();
    createAdminClientMock.mockReturnValue(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('requires authentication', async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: null }, error: null })) },
    });

    const res = await POST(
      new Request('http://localhost:3000/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResultId: '11111111-1111-4111-8111-111111111111' }),
      })
    );

    expect(res.status).toBe(401);
  });

  it('fails closed with 503 ADMIN_CONFIG_MISSING in production when service role key is missing', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fromSpy = vi.fn();

    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-a' } }, error: null })) },
      from: fromSpy,
    });
    createAdminClientMock.mockReturnValue(null);

    const res = await POST(
      new Request('http://localhost:3000/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResultId: '11111111-1111-4111-8111-111111111111' }),
      })
    );

    expect(res.status).toBe(503);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe('ADMIN_CONFIG_MISSING');
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it('forbids creating challenges from another user result', async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-a' } }, error: null })) },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: {
                id: 'res-1',
                user_id: 'user-b',
                wpm: 140,
                accuracy: 99,
                mode: 'words',
                duration: 30,
                seed: 'abc',
                is_invalidated: false,
              },
              error: null,
            })),
          })),
        })),
      })),
    });

    const res = await POST(
      new Request('http://localhost:3000/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResultId: '11111111-1111-4111-8111-111111111111' }),
      })
    );

    expect(res.status).toBe(403);
  });

  it('creates challenge_links using authoritative database metrics', async () => {
    const insertedChallenge: Record<string, unknown>[] = [];
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-a' } }, error: null })) },
      from: vi.fn((table: string) => {
        if (table === 'test_results') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: '11111111-1111-4111-8111-111111111111',
                    user_id: 'user-a',
                    wpm: 94,
                    accuracy: 97.5,
                    mode: 'code',
                    duration: 60,
                    seed: 'beef12345678',
                    is_invalidated: false,
                  },
                  error: null,
                })),
              })),
            })),
          };
        }
        return {
          insert: vi.fn((payload: Record<string, unknown>) => {
            insertedChallenge.push(payload);
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: { id: '22222222-2222-4222-8222-222222222222' },
                  error: null,
                })),
              })),
            };
          }),
        };
      }),
    });

    const res = await POST(
      new Request('http://localhost:3000/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testResultId: '11111111-1111-4111-8111-111111111111',
          creatorWpm: 300,
        }),
      })
    );

    expect(res.status).toBe(201);
    const json = (await res.json()) as { id: string; url: string };
    expect(json.url).toBe('/challenge/22222222-2222-4222-8222-222222222222');
    expect(insertedChallenge[0].creator_wpm).toBe(94);
    expect(insertedChallenge[0].creator_accuracy).toBe(97.5);
    expect(insertedChallenge[0].seed).toBe('beef12345678');
    expect(insertedChallenge[0].duration).toBe(60);
  });

  it('normalizes legacy non-bracket durations and rejects unranked modes cleanly', async () => {
    const insertedChallenge: Record<string, unknown>[] = [];
    let mockMode = 'words';
    let mockDuration = 22;

    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-a' } }, error: null })) },
      from: vi.fn((table: string) => {
        if (table === 'test_results') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: '11111111-1111-4111-8111-111111111111',
                    user_id: 'user-a',
                    wpm: 112,
                    accuracy: 98.4,
                    mode: mockMode,
                    duration: mockDuration,
                    seed: 'beef12345678',
                    is_invalidated: false,
                  },
                  error: null,
                })),
              })),
            })),
          };
        }
        return {
          insert: vi.fn((payload: Record<string, unknown>) => {
            insertedChallenge.push(payload);
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: { id: '33333333-3333-4333-8333-333333333333' },
                  error: null,
                })),
              })),
            };
          }),
        };
      }),
    });

    const normalizedRes = await POST(
      new Request('http://localhost:3000/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResultId: '11111111-1111-4111-8111-111111111111' }),
      })
    );
    expect(normalizedRes.status).toBe(201);
    expect(insertedChallenge[0].duration).toBe(30);

    mockMode = 'drill';
    mockDuration = 30;
    const unrankedRes = await POST(
      new Request('http://localhost:3000/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResultId: '11111111-1111-4111-8111-111111111111' }),
      })
    );
    expect(unrankedRes.status).toBe(400);
  });

  it('enforces 403 cross-origin check, 413 body cap, and 429 per-user rate limit', async () => {
    const crossOrigin = await POST(
      new Request('http://localhost:3000/api/challenges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://evil.example',
        },
        body: JSON.stringify({ testResultId: '11111111-1111-4111-8111-111111111111' }),
      })
    );
    expect(crossOrigin.status).toBe(403);

    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-cap' } }, error: null })) },
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: '11111111-1111-4111-8111-111111111111',
                user_id: 'user-cap',
                wpm: 95,
                accuracy: 98,
                mode: 'words',
                duration: 30,
                seed: 'abc',
                is_invalidated: false,
              },
              error: null,
            }),
          }),
        }),
        insert: () => ({
          select: () => ({
            single: async () => ({
              data: { id: '44444444-4444-4444-8444-444444444444' },
              error: null,
            }),
          }),
        }),
      })),
    });

    const oversize = await POST(
      new Request('http://localhost:3000/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testResultId: '11111111-1111-4111-8111-111111111111',
          padding: 'x'.repeat(20 * 1024),
        }),
      })
    );
    expect(oversize.status).toBe(413);

    for (let i = 0; i < 20; i += 1) {
      const okRes = await POST(
        new Request('http://localhost:3000/api/challenges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ testResultId: '11111111-1111-4111-8111-111111111111' }),
        })
      );
      expect(okRes.status).toBe(201);
    }

    const limited = await POST(
      new Request('http://localhost:3000/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResultId: '11111111-1111-4111-8111-111111111111' }),
      })
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBeTruthy();
  });
});
