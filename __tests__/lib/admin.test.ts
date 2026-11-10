import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  AdminConfigurationError,
  createAdminClient,
  hasServiceRoleConfig,
  isNonPrivilegedDevFallbackAllowed,
  resetAdminClientCache,
  resolvePrivilegedWriteClient,
  warnMissingServiceRoleOnce,
} from '@/lib/supabase/admin';

describe('lib/supabase/admin', () => {
  const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const origServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const origNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    resetAdminClientCache();
  });

  afterEach(() => {
    resetAdminClientCache();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    if (origUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
    }
    if (origServiceKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = origServiceKey;
    }
    if (origNodeEnv !== undefined) {
      vi.stubEnv('NODE_ENV', origNodeEnv);
    }
  });

  it('reports hasServiceRoleConfig accurately without logging secrets and warns once when missing', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(hasServiceRoleConfig()).toBe(false);

    vi.stubEnv('NODE_ENV', 'production');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const client = createAdminClient();
    expect(client).toBeNull();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toMatch(/SUPABASE_SERVICE_ROLE_KEY is missing/i);
    expect(errorSpy.mock.calls[0][0]).not.toMatch(/https:\/\/example\.supabase\.co/i);

    createAdminClient();
    warnMissingServiceRoleOnce('manual check');
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('creates and caches admin client when URL and SUPABASE_SERVICE_ROLE_KEY are provisioned', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-dummy-service-role-token');

    expect(hasServiceRoleConfig()).toBe(true);
    const clientA = createAdminClient();
    const clientB = createAdminClient();
    expect(clientA).not.toBeNull();
    expect(clientB).toBe(clientA);
  });

  it('enforces explicit privilege contract: fails closed in production and never mislabels SSR client in development', () => {
    const fakeSsrClient = { tag: 'ssr' } as unknown as SupabaseClient<Database>;
    const fakeAdminClient = { tag: 'admin' } as unknown as SupabaseClient<Database>;

    vi.stubEnv('NODE_ENV', 'development');
    expect(isNonPrivilegedDevFallbackAllowed()).toBe(true);
    const devResolved = resolvePrivilegedWriteClient(
      fakeSsrClient,
      'POST /api/results',
      null
    );
    expect(devResolved.client).toBe(fakeSsrClient);
    expect(devResolved.isPrivilegedClient).toBe(false);
    expect(devResolved.privilegeMode).toBe('ssr_dev_fallback');

    vi.stubEnv('NODE_ENV', 'production');
    expect(isNonPrivilegedDevFallbackAllowed()).toBe(false);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      resolvePrivilegedWriteClient(fakeSsrClient, 'POST /api/results', null)
    ).toThrow(AdminConfigurationError);

    try {
      resolvePrivilegedWriteClient(fakeSsrClient, 'POST /api/challenges', null);
    } catch (err) {
      expect(err).toBeInstanceOf(AdminConfigurationError);
      expect((err as AdminConfigurationError).status).toBe(503);
      expect((err as AdminConfigurationError).code).toBe('ADMIN_CONFIG_MISSING');
    }

    const prodResolved = resolvePrivilegedWriteClient(
      fakeSsrClient,
      'POST /api/results',
      fakeAdminClient
    );
    expect(prodResolved.client).toBe(fakeAdminClient);
    expect(prodResolved.isPrivilegedClient).toBe(true);
    expect(prodResolved.privilegeMode).toBe('service_role');
  });
});
