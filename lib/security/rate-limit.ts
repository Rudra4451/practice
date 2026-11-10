import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CompressedTelemetryPoint } from '@/lib/typing/metrics';
import type { PersistVerifiedResultOutput } from '@/lib/typing/persistence';

export interface SubmissionCooldownResult {
  allowed: boolean;
  retryAfterSeconds: number;
  invalidated?: boolean;
  conflict?: boolean;
  latestRow: {
    id: string;
    seed: string;
    mode: string;
    duration: number;
    wpm: number;
    raw_wpm: number;
    accuracy: number;
    consistency: number;
    error_count: number;
    backspace_count: number;
    is_invalidated?: boolean;
    created_at: string;
  } | null;
}

export interface SyncRateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface RecoveryBudgetResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface CachedRunEntry {
  expiresAt: number;
  payloadDigest: string;
  payload: PersistVerifiedResultOutput;
}

const DEFAULT_COOLDOWN_MS = 8000;
const SYNC_WINDOW_MS = 60_000;
const MAX_SYNC_REQUESTS_PER_WINDOW = 5;
const MAX_SYNC_ITEMS_PER_WINDOW = 120;
const DB_SYNC_CEILING_WINDOW_MS = 10 * 60 * 1000;
const DB_SYNC_MAX_RESULTS_IN_WINDOW = 150;

const RECOVERY_WINDOW_MS = 60_000;
const MAX_RECOVERY_ATTEMPTS_PER_RUN = 6;
const MAX_RECOVERY_ATTEMPTS_PER_USER = 20;

const MUTATION_WINDOW_MS = 60_000;
const MAX_CHALLENGE_CREATES_PER_WINDOW = 20;
const MAX_PROFILE_UPDATES_PER_WINDOW = 20;

const RECENT_RUN_TTL_MS = 5 * 60 * 1000;

interface SyncWindowEntry {
  ts: number;
  items: number;
}

const syncWindowCache = new Map<string, SyncWindowEntry[]>();
const recoveryRunWindowCache = new Map<string, number[]>();
const recoveryUserWindowCache = new Map<string, number[]>();
const challengeWindowCache = new Map<string, number[]>();
const profileUpdateWindowCache = new Map<string, number[]>();
const recentRunCache = new Map<string, CachedRunEntry>();

export function resetSyncRateLimitForTests(): void {
  syncWindowCache.clear();
}

export function resetRecoveryRateLimitForTests(): void {
  recoveryRunWindowCache.clear();
  recoveryUserWindowCache.clear();
}

export function resetChallengeRateLimitForTests(): void {
  challengeWindowCache.clear();
}

export function resetProfileRateLimitForTests(): void {
  profileUpdateWindowCache.clear();
}

export function resetRecentRunCacheForTests(): void {
  recentRunCache.clear();
}

export function buildVerifiedPayloadDigest(
  mode: string,
  duration: number,
  seed: string,
  telemetry: CompressedTelemetryPoint[]
): string {
  const eventsSig = telemetry.map((p) => `${p.t}:${p.y}:${p.i}:${p.k}`).join(';');
  return `${mode}|${duration}|${seed}|${eventsSig}`;
}

function pruneRunCache(now: number): void {
  if (recentRunCache.size < 400) return;
  for (const [key, entry] of recentRunCache.entries()) {
    if (entry.expiresAt <= now) {
      recentRunCache.delete(key);
    }
  }
}

export function getCachedRunEntry(userId: string, clientRunId: string): CachedRunEntry | null {
  const key = `${userId}:${clientRunId}`;
  const entry = recentRunCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    recentRunCache.delete(key);
    return null;
  }
  return entry;
}

export function setCachedRunEntry(
  userId: string,
  clientRunId: string,
  payloadDigest: string,
  payload: PersistVerifiedResultOutput
): void {
  const now = Date.now();
  pruneRunCache(now);
  recentRunCache.set(`${userId}:${clientRunId}`, {
    expiresAt: now + RECENT_RUN_TTL_MS,
    payloadDigest,
    payload,
  });
}

export function deleteCachedRunEntry(userId: string, clientRunId: string): void {
  recentRunCache.delete(`${userId}:${clientRunId}`);
}

function pruneSyncWindowCache(now: number): void {
  if (syncWindowCache.size < 500) return;
  const cutoff = now - SYNC_WINDOW_MS;
  for (const [key, entries] of syncWindowCache.entries()) {
    const active = entries.filter((entry) => entry.ts > cutoff);
    if (active.length === 0) {
      syncWindowCache.delete(key);
    } else {
      syncWindowCache.set(key, active);
    }
  }
}

function pruneTimestampMap(cache: Map<string, number[]>, cutoff: number): void {
  if (cache.size < 500) return;
  for (const [key, entries] of cache.entries()) {
    const active = entries.filter((ts) => ts > cutoff);
    if (active.length === 0) {
      cache.delete(key);
    } else {
      cache.set(key, active);
    }
  }
}

function isMissingClientRunIdColumnError(
  error: { code?: string | null; message?: string | null } | null | undefined
): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  const msg = (error.message ?? '').toLowerCase();
  return (
    code === 'PGRST204' ||
    code === '42703' ||
    (msg.includes('client_run_id') && (msg.includes('column') || msg.includes('schema cache')))
  );
}

/**
 * Enforces a bounded sliding-window recovery/idempotent-retry budget per `(userId, runKey)`
 * and per `userId` so legitimate recovery succeeds even after newer runs, without creating an
 * unthrottled endpoint DoS vector. Note: process-local memory limits protect single runtime
 * instances cleanly alongside DB query bounds; multi-instance distributed rate limiting
 * requires an external shared store (e.g. Redis).
 */
export function checkClientRunRecoveryBudget(
  userId: string,
  runKey: string
): RecoveryBudgetResult {
  const now = Date.now();
  const cutoff = now - RECOVERY_WINDOW_MS;
  const scopedRunKey = `${userId}:${runKey}`;

  const activeRunAttempts = (recoveryRunWindowCache.get(scopedRunKey) ?? []).filter(
    (ts) => ts > cutoff
  );
  const activeUserAttempts = (recoveryUserWindowCache.get(userId) ?? []).filter(
    (ts) => ts > cutoff
  );

  if (
    activeRunAttempts.length >= MAX_RECOVERY_ATTEMPTS_PER_RUN ||
    activeUserAttempts.length >= MAX_RECOVERY_ATTEMPTS_PER_USER
  ) {
    const oldestTs = Math.min(
      activeRunAttempts[0] ?? now,
      activeUserAttempts[0] ?? now
    );
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldestTs + RECOVERY_WINDOW_MS - now) / 1000)
    );
    recoveryRunWindowCache.set(scopedRunKey, activeRunAttempts);
    recoveryUserWindowCache.set(userId, activeUserAttempts);
    return { allowed: false, retryAfterSeconds };
  }

  pruneTimestampMap(recoveryRunWindowCache, cutoff);
  pruneTimestampMap(recoveryUserWindowCache, cutoff);
  recoveryRunWindowCache.set(scopedRunKey, [...activeRunAttempts, now]);
  recoveryUserWindowCache.set(userId, [...activeUserAttempts, now]);
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Checks whether the submitted result is:
 * 1. An existing `clientRunId` retry/orphan-recovery (checking invalidation, payload parity,
 *    and bounded recovery budget so a newer distinct Run B cannot block Run A recovery with 429), OR
 * 2. A recent identical signature retry within 45s (bounded by recovery budget), OR
 * 3. Within the minimum cooldown window between distinct submissions (`8000ms`).
 */
export async function checkResultSubmissionRateLimit(
  supabase: SupabaseClient,
  userId: string,
  options: {
    seed: string;
    mode: string;
    duration?: number;
    wpm: number;
    accuracy: number;
    clientRunId?: string;
    cooldownMs?: number;
  }
): Promise<SubmissionCooldownResult> {
  const cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;

  if (options.clientRunId) {
    const { data: byClientId, error: clientLookupError } = await supabase
      .from('test_results')
      .select(
        'id, seed, mode, duration, wpm, raw_wpm, accuracy, consistency, error_count, backspace_count, client_run_id, is_invalidated, created_at'
      )
      .eq('user_id', userId)
      .eq('client_run_id', options.clientRunId)
      .maybeSingle();

    if (clientLookupError) {
      if (!isMissingClientRunIdColumnError(clientLookupError)) {
        throw new Error('Failed to check client run rate limit recovery state.');
      }
    } else if (byClientId) {
      if (byClientId.is_invalidated === true) {
        return {
          allowed: false,
          retryAfterSeconds: 0,
          invalidated: true,
          conflict: false,
          latestRow: null,
        };
      }

      if (
        byClientId.mode !== options.mode ||
        (options.duration !== undefined && byClientId.duration !== options.duration) ||
        byClientId.seed !== options.seed
      ) {
        return {
          allowed: false,
          retryAfterSeconds: 0,
          invalidated: false,
          conflict: true,
          latestRow: null,
        };
      }

      const recoveryBudget = checkClientRunRecoveryBudget(userId, options.clientRunId);
      if (!recoveryBudget.allowed) {
        return {
          allowed: false,
          retryAfterSeconds: recoveryBudget.retryAfterSeconds,
          latestRow: null,
        };
      }

      return {
        allowed: true,
        retryAfterSeconds: 0,
        latestRow: byClientId,
      };
    }
  }

  const { data: latestRow, error } = await supabase
    .from('test_results')
    .select(
      'id, seed, mode, duration, wpm, raw_wpm, accuracy, consistency, error_count, backspace_count, created_at'
    )
    .eq('user_id', userId)
    .eq('is_invalidated', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error('Failed to check result submission rate limit.');
  }

  if (!latestRow) {
    return { allowed: true, retryAfterSeconds: 0, latestRow: null };
  }

  const ageMs = Math.max(0, Date.now() - new Date(latestRow.created_at).getTime());

  // Treat identical seed/mode/duration/score within 45s as a bounded idempotent/recovery retry
  if (
    ageMs < 45_000 &&
    latestRow.seed === options.seed &&
    latestRow.mode === options.mode &&
    (options.duration === undefined || latestRow.duration === options.duration) &&
    Math.abs(latestRow.wpm - options.wpm) < 0.01 &&
    Math.abs(latestRow.accuracy - options.accuracy) < 0.1
  ) {
    const recoveryKey = options.clientRunId ?? `${options.mode}:${options.seed}`;
    const recoveryBudget = checkClientRunRecoveryBudget(userId, recoveryKey);
    if (!recoveryBudget.allowed) {
      return {
        allowed: false,
        retryAfterSeconds: recoveryBudget.retryAfterSeconds,
        latestRow: null,
      };
    }
    return { allowed: true, retryAfterSeconds: 0, latestRow };
  }

  if (ageMs < cooldownMs) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((cooldownMs - ageMs) / 1000)),
      latestRow: null,
    };
  }

  return { allowed: true, retryAfterSeconds: 0, latestRow: null };
}

function checkSlidingWindowQuota(
  cache: Map<string, number[]>,
  key: string,
  maxRequests: number,
  windowMs: number
): RecoveryBudgetResult {
  const now = Date.now();
  const cutoff = now - windowMs;
  const active = (cache.get(key) ?? []).filter((ts) => ts > cutoff);

  if (active.length >= maxRequests) {
    const oldestTs = active[0] ?? now;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldestTs + windowMs - now) / 1000));
    cache.set(key, active);
    return { allowed: false, retryAfterSeconds };
  }

  pruneTimestampMap(cache, cutoff);
  cache.set(key, [...active, now]);
  return { allowed: true, retryAfterSeconds: 0 };
}

export function checkChallengeRateLimit(userId: string): RecoveryBudgetResult {
  return checkSlidingWindowQuota(
    challengeWindowCache,
    userId,
    MAX_CHALLENGE_CREATES_PER_WINDOW,
    MUTATION_WINDOW_MS
  );
}

export function checkProfileUpdateRateLimit(userId: string): RecoveryBudgetResult {
  return checkSlidingWindowQuota(
    profileUpdateWindowCache,
    userId,
    MAX_PROFILE_UPDATES_PER_WINDOW,
    MUTATION_WINDOW_MS
  );
}

/**
 * Enforces sliding-window request/item throttling and a 10-minute database
 * write ceiling for guest history batch synchronization.
 */
export async function checkSyncRateLimit(
  supabase: SupabaseClient,
  userId: string,
  options: { itemCount: number }
): Promise<SyncRateLimitResult> {
  const now = Date.now();
  const windowCutoff = now - SYNC_WINDOW_MS;
  const normalizedItems = Math.max(0, options.itemCount);
  const activeEntries = (syncWindowCache.get(userId) ?? []).filter(
    (entry) => entry.ts > windowCutoff
  );

  const recentItemTotal = activeEntries.reduce((sum, entry) => sum + entry.items, 0);

  if (
    activeEntries.length >= MAX_SYNC_REQUESTS_PER_WINDOW ||
    (normalizedItems > 0 && recentItemTotal + normalizedItems > MAX_SYNC_ITEMS_PER_WINDOW)
  ) {
    const oldestTs = activeEntries[0]?.ts ?? now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldestTs + SYNC_WINDOW_MS - now) / 1000)
    );
    syncWindowCache.set(userId, activeEntries);
    return { allowed: false, retryAfterSeconds };
  }

  if (normalizedItems > 0) {
    const dbCutoffIso = new Date(now - DB_SYNC_CEILING_WINDOW_MS).toISOString();
    const { count, error } = await supabase
      .from('test_results')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_invalidated', false)
      .gte('created_at', dbCutoffIso);

    if (error) {
      throw new Error('Failed to verify sync write rate quota.');
    }

    if ((count ?? 0) >= DB_SYNC_MAX_RESULTS_IN_WINDOW) {
      return { allowed: false, retryAfterSeconds: 60 };
    }
  }

  pruneSyncWindowCache(now);
  syncWindowCache.set(userId, [...activeEntries, { ts: now, items: normalizedItems }]);
  return { allowed: true, retryAfterSeconds: 0 };
}
