import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createClientMock, cookiesMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  cookiesMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}));

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}));

import { POST } from '@/app/api/auth/signout/route';

describe('POST /api/auth/signout', () => {
  beforeEach(() => {
    createClientMock.mockReset();
    cookiesMock.mockReset();
  });

  it('signs out cleanly and clears sb- auth cookies', async () => {
    const deleteSpy = vi.fn();
    cookiesMock.mockResolvedValue({
      getAll: () => [
        { name: 'sb-project-auth-token' },
        { name: 'unrelated-cookie' },
      ],
      delete: deleteSpy,
    });
    createClientMock.mockResolvedValue({
      auth: { signOut: vi.fn(async () => ({ error: null })) },
    });

    const res = await POST(
      new Request('http://localhost:3000/api/auth/signout', { method: 'POST' })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(deleteSpy).toHaveBeenCalledWith('sb-project-auth-token');
    expect(deleteSpy).not.toHaveBeenCalledWith('unrelated-cookie');
  });

  it('masks internal error details on sign-out exception', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    cookiesMock.mockResolvedValue({
      getAll: () => [],
      delete: vi.fn(),
    });
    createClientMock.mockRejectedValue(new Error('secret_supabase_internal_dsn_string'));

    const res = await POST(
      new Request('http://localhost:3000/api/auth/signout', { method: 'POST' })
    );
    expect(res.status).toBe(500);
    const json = (await res.json()) as { success: boolean; error: string };
    expect(json.success).toBe(false);
    expect(json.error).toBe('Sign-out failed');
    expect(JSON.stringify(json)).not.toContain('secret_supabase_internal_dsn_string');
  });

  it('rejects cross-origin POST sign-out requests with 403', async () => {
    const res = await POST(
      new Request('http://localhost:3000/api/auth/signout', {
        method: 'POST',
        headers: { Origin: 'https://evil.example' },
      })
    );
    expect(res.status).toBe(403);
    expect(createClientMock).not.toHaveBeenCalled();
  });
});

