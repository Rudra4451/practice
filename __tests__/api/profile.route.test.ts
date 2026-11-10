import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetProfileRateLimitForTests } from '@/lib/security/rate-limit';

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

import { PATCH } from '@/app/api/profile/route';

function createProfileDbMock(options?: {
  userId?: string;
  currentUsername?: string;
  updateError?: { code?: string; message?: string } | null;
}) {
  const capturedUpdates: Record<string, unknown>[] = [];
  const client = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: options?.userId === null ? null : { id: options?.userId ?? 'u1' } },
        error: null,
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: options?.currentUsername
              ? {
                  id: options?.userId ?? 'u1',
                  username: options.currentUsername,
                  display_name: 'Old Name',
                  avatar_url: null,
                  theme: 'dark',
                  font_family: 'jetbrains-mono',
                  created_at: '2026-01-01T00:00:00Z',
                  updated_at: '2026-01-01T00:00:00Z',
                }
              : null,
            error: null,
          })),
        })),
      })),
      update: vi.fn((fields: Record<string, unknown>) => {
        capturedUpdates.push(fields);
        return {
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: options?.updateError ? null : { id: options?.userId ?? 'u1', ...fields },
                error: options?.updateError ?? null,
              })),
            })),
          })),
        };
      }),
    })),
  };

  return { client, capturedUpdates };
}

describe('PATCH /api/profile', () => {
  beforeEach(() => {
    resetProfileRateLimitForTests();
    createClientMock.mockReset();
    createAdminClientMock.mockReset();
    createAdminClientMock.mockReturnValue(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: null }, error: null })) },
    });

    const res = await PATCH(
      new Request('http://localhost:3000/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'Rudra' }),
      })
    );

    expect(res.status).toBe(401);
  });

  it('rejects reserved, malformed, short, and temporary auto-generated usernames with 400', async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } }, error: null })) },
    });

    for (const invalidUsername of [
      'ab',
      'admin',
      'root',
      'typrox',
      'api',
      'dashboard',
      'u',
      'null',
      'bad-name!',
      'user_1234abcd',
      'user_1234abcd_deadbeef',
    ]) {
      const res = await PATCH(
        new Request('http://localhost:3000/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: invalidUsername }),
        })
      );
      expect(res.status, `expected 400 for ${invalidUsername}`).toBe(400);
    }

    const emptyBodyRes = await PATCH(
      new Request('http://localhost:3000/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    );
    expect(emptyBodyRes.status).toBe(400);
  });

  it('enforces one-time custom handle immutability (403 USERNAME_LOCKED)', async () => {
    const dbMock = createProfileDbMock({
      userId: 'u1',
      currentUsername: 'permanent_handle',
    });
    createClientMock.mockResolvedValue(dbMock.client);

    const res = await PATCH(
      new Request('http://localhost:3000/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'different_handle' }),
      })
    );

    expect(res.status).toBe(403);
    const json = (await res.json()) as { code?: string };
    expect(json.code).toBe('USERNAME_LOCKED');
    expect(dbMock.capturedUpdates).toHaveLength(0);
  });

  it('fails closed in production (503) for username onboarding when admin creds are missing, while allowing normal preference updates via SSR', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const ssrMock = createProfileDbMock({
      userId: 'u-prod',
      currentUsername: 'user_1234abcd',
    });
    createClientMock.mockResolvedValue(ssrMock.client);
    createAdminClientMock.mockReturnValue(null);

    const onboardingBlocked = await PATCH(
      new Request('http://localhost:3000/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'rudra_typist' }),
      })
    );
    expect(onboardingBlocked.status).toBe(503);
    const blockedJson = (await onboardingBlocked.json()) as { code?: string };
    expect(blockedJson.code).toBe('ADMIN_CONFIG_MISSING');
    expect(ssrMock.capturedUpdates).toHaveLength(0);

    // Non-username preference update still succeeds cleanly using caller SSR client
    const prefOk = await PATCH(
      new Request('http://localhost:3000/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'Rudra Display', theme: 'light' }),
      })
    );
    expect(prefOk.status).toBe(200);
    expect(ssrMock.capturedUpdates[0].display_name).toBe('Rudra Display');
    expect(ssrMock.capturedUpdates[0].username).toBeUndefined();
  });

  it('returns 409 conflict cleanly on duplicate username constraint violation', async () => {
    const dbMock = createProfileDbMock({
      userId: 'u1',
      currentUsername: 'user_1234abcd',
      updateError: { code: '23505', message: 'duplicate key value violates unique constraint' },
    });
    createClientMock.mockResolvedValue(dbMock.client);
    createAdminClientMock.mockReturnValue(dbMock.client);

    const res = await PATCH(
      new Request('http://localhost:3000/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'taken_user' }),
      })
    );
    expect(res.status).toBe(409);
  });

  it('normalizes and updates temporary username via admin client, displayName, theme, and font_family cleanly when valid', async () => {
    const ssrMock = createProfileDbMock({ userId: 'u1' });
    const adminMock = createProfileDbMock({
      userId: 'u1',
      currentUsername: 'user_1234abcd_99ffaa11',
    });
    createClientMock.mockResolvedValue(ssrMock.client);
    createAdminClientMock.mockReturnValue(adminMock.client);

    const res = await PATCH(
      new Request('http://localhost:3000/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: '  Rudra_Typist  ',
          displayName: 'Rudra Pratap',
          theme: 'dark',
          font_family: 'jetbrains-mono',
        }),
      })
    );

    expect(res.status).toBe(200);
    expect(ssrMock.capturedUpdates).toHaveLength(0);
    expect(adminMock.capturedUpdates[0].username).toBe('rudra_typist');
    expect(adminMock.capturedUpdates[0].font_family).toBe('jetbrains-mono');
  });

  it('rejects cross-origin mutations (403), oversized JSON (413), and bursts >20/min (429)', async () => {
    const crossOrigin = await PATCH(
      new Request('http://localhost:3000/api/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://evil.example',
        },
        body: JSON.stringify({ theme: 'light' }),
      })
    );
    expect(crossOrigin.status).toBe(403);

    const dbMock = createProfileDbMock({ userId: 'u-burst' });
    createClientMock.mockResolvedValue(dbMock.client);

    const oversized = await PATCH(
      new Request('http://localhost:3000/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'x'.repeat(20 * 1024) }),
      })
    );
    expect(oversized.status).toBe(413);

    for (let i = 0; i < 20; i += 1) {
      const okRes = await PATCH(
        new Request('http://localhost:3000/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme: i % 2 === 0 ? 'light' : 'dark' }),
        })
      );
      expect(okRes.status).toBe(200);
    }

    const throttled = await PATCH(
      new Request('http://localhost:3000/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: 'dark' }),
      })
    );
    expect(throttled.status).toBe(429);
    expect(throttled.headers.get('Retry-After')).toBeTruthy();
  });
});
