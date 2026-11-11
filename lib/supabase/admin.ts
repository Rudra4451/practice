import 'server-only';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

let cachedAdminClient: SupabaseClient<Database> | null | undefined;
let hasWarnedMissingServiceRole = false;

export type PrivilegeMode = 'service_role' | 'ssr_dev_fallback';

export type PrivilegedWriteContext =
  | 'POST /api/results'
  | 'POST /api/results/sync'
  | 'POST /api/challenges'
  | 'PATCH /api/profile (username)'
  | (string & {});

export interface ResolvedPrivilegedWriteClient {
  client: SupabaseClient<Database>;
  isPrivilegedClient: boolean;
  privilegeMode: PrivilegeMode;
}

export class AdminConfigurationError extends Error {
  readonly status = 503 as const;
  readonly code = 'ADMIN_CONFIG_MISSING' as const;
  readonly context: string;

  constructor(context: string) {
    super(
      `Server administrative credentials are missing for privileged operation: ${context}.`
    );
    this.name = 'AdminConfigurationError';
    this.context = context;
  }
}

/**
 * Checks whether both NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provisioned.
 */
export function hasServiceRoleConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Explicit privilege contract: unprivileged caller SSR fallback is permitted only
 * in non-production environments (local development and unit tests). Production must
 * always fail closed when administrative credentials are absent.
 */
export function isNonPrivilegedDevFallbackAllowed(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * Logs one explicit operational error (never exposing key values or URLs) when server
 * routes run without SUPABASE_SERVICE_ROLE_KEY.
 */
export function warnMissingServiceRoleOnce(context = 'server writes'): void {
  if (hasWarnedMissingServiceRole || process.env.NODE_ENV === 'test') {
    return;
  }
  hasWarnedMissingServiceRole = true;
  console.error(
    `[TyProX Security] SUPABASE_SERVICE_ROLE_KEY is missing during ${context}. Privileged RLS bypass, atomic submit RPC, and compensating test_results DELETE rollback are unavailable.`
  );
}

/**
 * Returns a server-only Supabase admin client using SUPABASE_SERVICE_ROLE_KEY
 * when provisioned, or `null` if the secret is not configured in this environment.
 */
export function createAdminClient(): SupabaseClient<Database> | null {
  if (cachedAdminClient !== undefined) {
    if (cachedAdminClient === null) {
      warnMissingServiceRoleOnce();
    }
    return cachedAdminClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    warnMissingServiceRoleOnce();
    cachedAdminClient = null;
    return null;
  }

  cachedAdminClient = createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return cachedAdminClient;
}

/**
 * Resolves the Supabase write client for privileged routes:
 * - Returns `{ isPrivilegedClient: true, privilegeMode: 'service_role' }` when `adminClient` exists.
 * - Throws `AdminConfigurationError` (HTTP 503) in production (`NODE_ENV === 'production'`), failing closed.
 * - Never labels an SSR caller client as privileged (`isPrivilegedClient` is strictly `false`).
 */
export function resolvePrivilegedWriteClient(
  ssrClient: SupabaseClient<Database>,
  context: PrivilegedWriteContext,
  adminClient: SupabaseClient<Database> | null = createAdminClient()
): ResolvedPrivilegedWriteClient {
  if (adminClient) {
    return {
      client: adminClient,
      isPrivilegedClient: true,
      privilegeMode: 'service_role',
    };
  }

  warnMissingServiceRoleOnce(context);

  if (!isNonPrivilegedDevFallbackAllowed()) {
    throw new AdminConfigurationError(context);
  }

  return {
    client: ssrClient,
    isPrivilegedClient: false,
    privilegeMode: 'ssr_dev_fallback',
  };
}

export function resetAdminClientCache() {
  cachedAdminClient = undefined;
  hasWarnedMissingServiceRole = false;
}
