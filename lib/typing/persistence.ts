import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';
import type { CompressedTelemetryPoint } from '@/lib/typing/metrics';
import type { VerifiedSessionOutcome } from '@/lib/typing/verifier';

interface AchievementRow {
  id: string;
  code: string;
  name: string;
  criteria: unknown;
}

interface AchievementCriteria {
  type?: string;
  wpm?: number;
  accuracy?: number;
  days?: number;
  count?: number;
}

export interface PersistedTestResultRow {
  id: string;
  user_id: string | null;
  wpm: number;
  raw_wpm: number;
  accuracy: number;
  consistency: number;
  error_count: number;
  backspace_count: number;
  mode: string;
  duration: number;
  seed: string;
  client_run_id?: string | null;
  is_invalidated?: boolean;
  created_at: string;
}

export interface PersistVerifiedResultOptions {
  clientRunId?: string;
  deduplicateBySignature?: boolean;
  isPrivilegedClient?: boolean;
}

export type ResultPersistenceFailureReason =
  | 'replay_insert_failed'
  | 'result_insert_failed'
  | 'atomic_rpc_failed'
  | 'recovery_failed'
  | 'result_invalidated'
  | 'client_run_id_conflict';

export interface ResultPersistenceFailureDetails {
  orphanResultId?: string;
  rollbackAttempted: boolean;
  rollbackSucceeded: boolean;
  recoverable: boolean;
  reason: ResultPersistenceFailureReason;
}

export class ResultPersistenceError extends Error {
  readonly orphanResultId?: string;
  readonly rollbackAttempted: boolean;
  readonly rollbackSucceeded: boolean;
  readonly recoverable: boolean;
  readonly reason: ResultPersistenceFailureReason;

  constructor(message: string, details: ResultPersistenceFailureDetails) {
    super(message);
    this.name = 'ResultPersistenceError';
    this.orphanResultId = details.orphanResultId;
    this.rollbackAttempted = details.rollbackAttempted;
    this.rollbackSucceeded = details.rollbackSucceeded;
    this.recoverable = details.recoverable;
    this.reason = details.reason;
  }
}

export interface PersistVerifiedResultOutput {
  result: PersistedTestResultRow;
  unlocked: string[];
  previousBestWpm: number | null;
  isPersonalBest: boolean;
  streakDays: number;
  deduplicated?: boolean;
  recoveredPartialWrite?: boolean;
}

interface PostgrestErrorLike {
  code?: string | null;
  message?: string | null;
}

function isMissingClientRunIdColumnError(error: PostgrestErrorLike | null | undefined): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  const msg = (error.message ?? '').toLowerCase();
  return (
    code === 'PGRST204' ||
    code === '42703' ||
    (msg.includes('client_run_id') && (msg.includes('column') || msg.includes('schema cache')))
  );
}

function isMissingAtomicRpcError(error: PostgrestErrorLike | null | undefined): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  const msg = (error.message ?? '').toLowerCase();
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    (msg.includes('submit_verified_result') &&
      (msg.includes('does not exist') ||
        msg.includes('could not find') ||
        msg.includes('schema cache')))
  );
}

function isResultInvalidatedRpcError(error: PostgrestErrorLike | null | undefined): boolean {
  if (!error) return false;
  return (error.message ?? '').toUpperCase().includes('RESULT_INVALIDATED');
}

function isClientRunIdConflictRpcError(error: PostgrestErrorLike | null | undefined): boolean {
  if (!error) return false;
  return (error.message ?? '').toUpperCase().includes('CLIENT_RUN_ID_CONFLICT');
}

function parseAtomicRpcOutput(raw: Json): PersistVerifiedResultOutput | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, Json | undefined>;
  const rowRaw = record.result;
  if (!rowRaw || typeof rowRaw !== 'object' || Array.isArray(rowRaw)) {
    return null;
  }
  const r = rowRaw as Record<string, Json | undefined>;
  if (
    typeof r.id !== 'string' ||
    typeof r.wpm !== 'number' ||
    typeof r.raw_wpm !== 'number' ||
    typeof r.accuracy !== 'number' ||
    typeof r.consistency !== 'number' ||
    typeof r.error_count !== 'number' ||
    typeof r.backspace_count !== 'number' ||
    typeof r.mode !== 'string' ||
    typeof r.duration !== 'number' ||
    typeof r.seed !== 'string' ||
    typeof r.created_at !== 'string'
  ) {
    return null;
  }

  const result: PersistedTestResultRow = {
    id: r.id,
    user_id: typeof r.user_id === 'string' ? r.user_id : null,
    wpm: r.wpm,
    raw_wpm: r.raw_wpm,
    accuracy: r.accuracy,
    consistency: r.consistency,
    error_count: r.error_count,
    backspace_count: r.backspace_count,
    mode: r.mode,
    duration: r.duration,
    seed: r.seed,
    client_run_id: typeof r.client_run_id === 'string' ? r.client_run_id : null,
    created_at: r.created_at,
  };

  const unlocked = Array.isArray(record.unlocked)
    ? record.unlocked.filter((item): item is string => typeof item === 'string')
    : [];
  const previousBestWpm =
    typeof record.previousBestWpm === 'number' ? record.previousBestWpm : null;
  const isPersonalBest = Boolean(record.isPersonalBest);
  const streakDays = typeof record.streakDays === 'number' ? record.streakDays : 0;
  const deduplicated = Boolean(record.deduplicated);
  const recoveredPartialWrite = Boolean(record.recoveredPartialWrite);

  return {
    result,
    unlocked,
    previousBestWpm,
    isPersonalBest,
    streakDays,
    ...(deduplicated ? { deduplicated: true } : {}),
    ...(deduplicated ? { recoveredPartialWrite } : recoveredPartialWrite ? { recoveredPartialWrite: true } : {}),
  };
}

function isUniqueViolationError(error: PostgrestErrorLike | null | undefined): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  const msg = (error.message ?? '').toLowerCase();
  return code === '23505' || msg.includes('duplicate key');
}

function areTelemetriesEqual(
  candidate: unknown,
  expected: CompressedTelemetryPoint[]
): boolean {
  if (!Array.isArray(candidate) || candidate.length !== expected.length) {
    return false;
  }
  for (let i = 0; i < expected.length; i += 1) {
    const a = candidate[i] as Partial<CompressedTelemetryPoint> | null | undefined;
    const b = expected[i];
    if (!a || a.t !== b.t || a.k !== b.k || a.y !== b.y || a.i !== b.i) {
      return false;
    }
  }
  return true;
}

function getTodayUtcDate(referenceDate = new Date()): string {
  return referenceDate.toISOString().split('T')[0];
}

function parseUtcReferenceDate(isoString: string | null | undefined): Date {
  if (!isoString) return new Date();
  const parsedMs = Date.parse(isoString);
  return Number.isFinite(parsedMs) ? new Date(parsedMs) : new Date();
}

function daysBetweenUtcDates(earlierIsoDate: string, laterIsoDate: string): number {
  const d1 = Date.parse(`${earlierIsoDate}T00:00:00Z`);
  const d2 = Date.parse(`${laterIsoDate}T00:00:00Z`);
  if (!Number.isFinite(d1) || !Number.isFinite(d2)) return 999;
  return Math.round((d2 - d1) / 86_400_000);
}

/**
 * Reads a user's current streak count without mutating `streaks` or `last_active_date`.
 * Used on pure deduplicated retries so no streak or daily activity mutation can occur.
 */
export async function readDailyStreakForUser(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<number> {
  const { data: streakRow, error } = await supabase
    .from('streaks')
    .select('current_streak')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error('Failed to load user streak record.');
  }

  return streakRow?.current_streak ?? 0;
}

export async function updateDailyStreakForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
  referenceDate = new Date()
): Promise<number> {
  const today = getTodayUtcDate(referenceDate);
  const nowIso = new Date().toISOString();

  const { data: initialRow, error: selectError } = await supabase
    .from('streaks')
    .select('id, current_streak, longest_streak, last_active_date')
    .eq('user_id', userId)
    .maybeSingle();

  if (selectError) {
    throw new Error('Failed to load user streak record.');
  }

  let streakRow = initialRow;

  if (!streakRow) {
    const { error: insertError } = await supabase.from('streaks').insert({
      user_id: userId,
      current_streak: 1,
      longest_streak: 1,
      last_active_date: today,
      updated_at: nowIso,
    });

    if (!insertError) {
      return 1;
    }

    if (!isUniqueViolationError(insertError)) {
      throw new Error('Failed to create user streak record.');
    }

    const { data: racedRow, error: retrySelectError } = await supabase
      .from('streaks')
      .select('id, current_streak, longest_streak, last_active_date')
      .eq('user_id', userId)
      .maybeSingle();

    if (retrySelectError || !racedRow) {
      throw new Error('Failed to recover user streak record after concurrent write.');
    }
    streakRow = racedRow;
  }

  let currentStreak = streakRow.current_streak ?? 0;
  let longestStreak = streakRow.longest_streak ?? 0;
  const lastActive = streakRow.last_active_date as string | null;

  // Day-1 fix: handle new users created with default (current_streak = 0, last_active_date = NULL/today)
  // while never moving a future last_active_date backwards.
  if (currentStreak <= 0 || !lastActive) {
    currentStreak = 1;
    longestStreak = Math.max(1, longestStreak);
    const preservedDate = lastActive && lastActive > today ? lastActive : today;
    const { error: updateError } = await supabase
      .from('streaks')
      .update({
        current_streak: currentStreak,
        longest_streak: longestStreak,
        last_active_date: preservedDate,
        updated_at: nowIso,
      })
      .eq('user_id', userId);

    if (updateError) {
      throw new Error('Failed to initialize daily streak.');
    }
    return currentStreak;
  }

  const diffDays = daysBetweenUtcDates(lastActive, today);

  // Same UTC day (diffDays === 0) OR future-date skew (diffDays < 0):
  // Never mutate current_streak or overwrite last_active_date backwards.
  if (diffDays <= 0) {
    return currentStreak;
  }

  if (diffDays === 1) {
    currentStreak += 1;
  } else {
    currentStreak = 1;
  }
  longestStreak = Math.max(currentStreak, longestStreak);

  const { error: updateError } = await supabase
    .from('streaks')
    .update({
      current_streak: currentStreak,
      longest_streak: longestStreak,
      last_active_date: today,
      updated_at: nowIso,
    })
    .eq('user_id', userId);

  if (updateError) {
    throw new Error('Failed to update daily streak.');
  }

  return currentStreak;
}

export async function evaluateAndUnlockAchievements(
  supabase: SupabaseClient<Database>,
  userId: string,
  stats: {
    wpm: number;
    accuracy: number;
    streakDays: number;
    totalTests?: number;
  }
): Promise<string[]> {
  const [
    { data: currentAchievements, error: currentError },
    { data: allAchievements, error: catalogError },
  ] = await Promise.all([
    supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', userId),
    supabase.from('achievements').select('id, code, name, criteria'),
  ]);

  if (currentError || catalogError) {
    throw new Error('Failed to read user achievement state.');
  }

  if (!allAchievements || allAchievements.length === 0) {
    return [];
  }

  const unlockedIds = new Set(
    (currentAchievements ?? []).map((row: { achievement_id: string }) => row.achievement_id)
  );
  const newlyUnlockedNames: string[] = [];

  for (const ach of allAchievements as AchievementRow[]) {
    if (unlockedIds.has(ach.id)) continue;

    const criteria = (ach.criteria ?? {}) as AchievementCriteria;
    let shouldUnlock = false;

    if (
      criteria.type === 'speed' &&
      typeof criteria.wpm === 'number' &&
      stats.wpm >= criteria.wpm &&
      stats.accuracy >= (typeof criteria.accuracy === 'number' ? criteria.accuracy : 0)
    ) {
      shouldUnlock = true;
    } else if (
      criteria.type === 'streak' &&
      typeof criteria.days === 'number' &&
      stats.streakDays >= criteria.days
    ) {
      shouldUnlock = true;
    } else if (
      criteria.type === 'accuracy' &&
      typeof criteria.accuracy === 'number' &&
      stats.accuracy >= criteria.accuracy
    ) {
      shouldUnlock = true;
    } else if (
      criteria.type === 'tests' &&
      typeof criteria.count === 'number' &&
      typeof stats.totalTests === 'number' &&
      stats.totalTests >= criteria.count
    ) {
      shouldUnlock = true;
    }

    if (shouldUnlock) {
      const { error: insertErr } = await supabase.from('user_achievements').insert({
        user_id: userId,
        achievement_id: ach.id,
      });

      if (insertErr) {
        if (isUniqueViolationError(insertErr)) {
          unlockedIds.add(ach.id);
          continue;
        }
        throw new Error(`Failed to record unlocked achievement (${ach.code}).`);
      }

      newlyUnlockedNames.push(ach.name);
      unlockedIds.add(ach.id);
    }
  }

  return newlyUnlockedNames;
}

async function ensureReplayExistsForRecovery(
  supabase: SupabaseClient<Database>,
  testResultId: string,
  telemetry: CompressedTelemetryPoint[]
): Promise<boolean> {
  const { data: existingReplay, error: fetchError } = await supabase
    .from('replays')
    .select('id, telemetry')
    .eq('test_result_id', testResultId)
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    throw new Error('Failed to verify stored replay state.');
  }

  if (existingReplay) {
    const storedTelemetry = (existingReplay as { id: string; telemetry?: unknown }).telemetry;
    if (storedTelemetry !== undefined && !areTelemetriesEqual(storedTelemetry, telemetry)) {
      throw new ResultPersistenceError(
        'Conflicting telemetry payload submitted for existing clientRunId.',
        {
          rollbackAttempted: false,
          rollbackSucceeded: false,
          recoverable: false,
          reason: 'client_run_id_conflict',
        }
      );
    }
    return false;
  }

  const { error: replayInsertError } = await supabase.from('replays').insert({
    test_result_id: testResultId,
    telemetry: telemetry as unknown as Json,
  });

  if (replayInsertError) {
    if (isUniqueViolationError(replayInsertError)) {
      // Another concurrent worker inserted the replay first. Re-read telemetry to confirm parity,
      // and return false so only the winning worker treats recovery as a streak-qualifying write.
      const { data: winnerReplay, error: winnerFetchError } = await supabase
        .from('replays')
        .select('id, telemetry')
        .eq('test_result_id', testResultId)
        .limit(1)
        .maybeSingle();

      if (winnerFetchError) {
        throw new Error('Failed to verify concurrent replay recovery state.');
      }
      const winnerTelemetry = (winnerReplay as { id?: string; telemetry?: unknown } | null)
        ?.telemetry;
      if (winnerTelemetry !== undefined && !areTelemetriesEqual(winnerTelemetry, telemetry)) {
        throw new ResultPersistenceError(
          'Conflicting telemetry payload submitted for existing clientRunId.',
          {
            rollbackAttempted: false,
            rollbackSucceeded: false,
            recoverable: false,
            reason: 'client_run_id_conflict',
          }
        );
      }
      return false;
    }

    throw new Error('Failed to recover missing replay telemetry.');
  }

  return true;
}

async function finalizeRecoveredResult(
  supabase: SupabaseClient<Database>,
  userId: string,
  existingRow: PersistedTestResultRow,
  verified: VerifiedSessionOutcome
): Promise<PersistVerifiedResultOutput> {
  if (existingRow.is_invalidated === true) {
    throw new ResultPersistenceError(
      'This result has been invalidated and cannot be finalized or replayed.',
      {
        rollbackAttempted: false,
        rollbackSucceeded: false,
        recoverable: false,
        reason: 'result_invalidated',
      }
    );
  }

  if (
    existingRow.mode !== verified.mode ||
    existingRow.duration !== verified.configuredDuration ||
    existingRow.seed !== verified.seed
  ) {
    throw new ResultPersistenceError(
      'Conflicting payload submitted for an existing clientRunId.',
      {
        rollbackAttempted: false,
        rollbackSucceeded: false,
        recoverable: false,
        reason: 'client_run_id_conflict',
      }
    );
  }

  const recoveredReplay = await ensureReplayExistsForRecovery(
    supabase,
    existingRow.id,
    verified.result.telemetry
  );

  const priorBestResp = await supabase
    .from('test_results')
    .select('wpm')
    .eq('user_id', userId)
    .eq('mode', existingRow.mode)
    .eq('duration', existingRow.duration)
    .eq('is_invalidated', false)
    .neq('id', existingRow.id)
    .order('wpm', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (priorBestResp.error) {
    throw new Error('Failed to verify prior personal best.');
  }

  const previousBestWpm =
    typeof priorBestResp.data?.wpm === 'number' ? priorBestResp.data.wpm : null;
  const isPersonalBest =
    existingRow.wpm > 0 && (previousBestWpm === null || existingRow.wpm > previousBestWpm);

  // Pure completed duplicate (`recoveredReplay === false`):
  // Read streak read-only without advancing streaks, overwriting last_active_date, or awarding achievements.
  if (!recoveredReplay) {
    const streakDays = await readDailyStreakForUser(supabase, userId);
    return {
      result: existingRow,
      unlocked: [],
      previousBestWpm,
      isPersonalBest,
      streakDays,
      deduplicated: true,
      recoveredPartialWrite: false,
    };
  }

  // Recovered an incomplete orphaned partial write (`recoveredReplay === true`):
  // Qualifies for streak update anchored to the original run UTC date and idempotent achievement check.
  const activityDate = parseUtcReferenceDate(existingRow.created_at);
  const [streakDays, countResp] = await Promise.all([
    updateDailyStreakForUser(supabase, userId, activityDate),
    supabase
      .from('test_results')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_invalidated', false),
  ]);

  if (countResp.error) {
    throw new Error('Failed to read verified test count.');
  }

  const totalTests = countResp.count ?? 1;

  const unlocked = await evaluateAndUnlockAchievements(supabase, userId, {
    wpm: existingRow.wpm,
    accuracy: existingRow.accuracy,
    streakDays,
    totalTests,
  });

  return {
    result: existingRow,
    unlocked,
    previousBestWpm,
    isPersonalBest,
    streakDays,
    deduplicated: true,
    recoveredPartialWrite: true,
  };
}

async function findExistingResultForRun(
  supabase: SupabaseClient<Database>,
  userId: string,
  verified: VerifiedSessionOutcome,
  options: {
    clientRunId?: string;
    deduplicateBySignature?: boolean;
  }
): Promise<{
  existingRow: PersistedTestResultRow | null;
  clientRunIdColumnSupported: boolean;
}> {
  let clientRunIdColumnSupported = true;
  const { clientRunId, deduplicateBySignature } = options;

  if (clientRunId) {
    const { data: byClientId, error: lookupError } = await supabase
      .from('test_results')
      .select(
        'id, user_id, wpm, raw_wpm, accuracy, consistency, error_count, backspace_count, mode, duration, seed, client_run_id, is_invalidated, created_at'
      )
      .eq('user_id', userId)
      .eq('client_run_id', clientRunId)
      .maybeSingle();

    if (!lookupError && byClientId) {
      const typedRow = byClientId as PersistedTestResultRow;
      if (typedRow.is_invalidated === true) {
        throw new ResultPersistenceError(
          'This result has been invalidated and cannot be finalized or replayed.',
          {
            rollbackAttempted: false,
            rollbackSucceeded: false,
            recoverable: false,
            reason: 'result_invalidated',
          }
        );
      }
      return {
        existingRow: typedRow,
        clientRunIdColumnSupported: true,
      };
    }

    if (lookupError) {
      if (isMissingClientRunIdColumnError(lookupError)) {
        clientRunIdColumnSupported = false;
      } else {
        throw new Error('Failed to check client run idempotency.');
      }
    }
  }

  if (deduplicateBySignature) {
    const { mode, configuredDuration, seed, result } = verified;
    const { data: candidates, error: sigError } = await supabase
      .from('test_results')
      .select(
        'id, user_id, wpm, raw_wpm, accuracy, consistency, error_count, backspace_count, mode, duration, seed, is_invalidated, created_at'
      )
      .eq('user_id', userId)
      .eq('seed', seed)
      .eq('mode', mode)
      .eq('duration', configuredDuration)
      .eq('wpm', result.wpm)
      .eq('accuracy', result.accuracy)
      .order('is_invalidated', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(10);

    if (sigError) {
      throw new Error('Failed to verify duplicate run signature.');
    }

    if (candidates && candidates.length > 0) {
      const candidateIds = candidates.map((row) => row.id);
      const { data: candidateReplays, error: replaysError } = await supabase
        .from('replays')
        .select('test_result_id, telemetry')
        .in('test_result_id', candidateIds);

      if (replaysError) {
        throw new Error('Failed to verify duplicate run replay telemetry.');
      }

      const replayByResultId = new Map<string, unknown>();
      for (const replay of candidateReplays ?? []) {
        replayByResultId.set(replay.test_result_id, replay.telemetry);
      }

      const recoveryCutoffMs = Date.now() - 15 * 60 * 1000;
      let matchedInvalidatedSignature = false;

      for (const row of candidates as PersistedTestResultRow[]) {
        const storedTelemetry = replayByResultId.get(row.id);
        const matchesTelemetry =
          Boolean(storedTelemetry) && areTelemetriesEqual(storedTelemetry, result.telemetry);
        const createdAtMs = Date.parse(row.created_at);
        const matchesOrphanSignature =
          !storedTelemetry &&
          Number.isFinite(createdAtMs) &&
          createdAtMs >= recoveryCutoffMs &&
          row.raw_wpm === result.rawWpm &&
          row.consistency === result.consistency &&
          row.error_count === result.errorCount &&
          row.backspace_count === result.backspaceCount;

        if (!matchesTelemetry && !matchesOrphanSignature) {
          continue;
        }

        if (row.is_invalidated === true) {
          matchedInvalidatedSignature = true;
          continue;
        }

        return {
          existingRow: row,
          clientRunIdColumnSupported,
        };
      }

      if (matchedInvalidatedSignature) {
        throw new ResultPersistenceError(
          'Run signature corresponds to an invalidated result and cannot be replayed.',
          {
            rollbackAttempted: false,
            rollbackSucceeded: false,
            recoverable: false,
            reason: 'result_invalidated',
          }
        );
      }
    }
  }

  return {
    existingRow: null,
    clientRunIdColumnSupported,
  };
}

export async function persistVerifiedResult(
  supabase: SupabaseClient<Database>,
  userId: string,
  verified: VerifiedSessionOutcome,
  options?: PersistVerifiedResultOptions
): Promise<PersistVerifiedResultOutput> {
  const { mode, configuredDuration, seed, result } = verified;
  const effectiveClientRunId = options?.clientRunId ?? verified.clientRunId;
  const isPrivilegedClient = Boolean(options?.isPrivilegedClient);

  // Prefer single-transaction Postgres RPC when privileged service_role client + 20260623/20260624 RPC are available
  if (isPrivilegedClient && typeof supabase.rpc === 'function') {
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'submit_verified_result',
      {
        p_user_id: userId,
        p_wpm: result.wpm,
        p_raw_wpm: result.rawWpm,
        p_accuracy: result.accuracy,
        p_consistency: result.consistency,
        p_error_count: result.errorCount,
        p_backspace_count: result.backspaceCount,
        p_mode: mode,
        p_duration: configuredDuration,
        p_seed: seed,
        p_client_run_id: effectiveClientRunId ?? null,
        p_telemetry: result.telemetry as unknown as Json,
        p_deduplicate_by_signature: Boolean(options?.deduplicateBySignature),
      }
    );

    if (!rpcError) {
      const parsedOutput = parseAtomicRpcOutput(rpcData);
      if (parsedOutput) {
        return parsedOutput;
      }
      throw new ResultPersistenceError(
        'Atomic verified result RPC returned an unexpected payload.',
        {
          rollbackAttempted: false,
          rollbackSucceeded: false,
          recoverable: true,
          reason: 'atomic_rpc_failed',
        }
      );
    }

    if (isResultInvalidatedRpcError(rpcError)) {
      throw new ResultPersistenceError(
        'This result has been invalidated and cannot be finalized or replayed.',
        {
          rollbackAttempted: false,
          rollbackSucceeded: false,
          recoverable: false,
          reason: 'result_invalidated',
        }
      );
    }

    if (isClientRunIdConflictRpcError(rpcError)) {
      throw new ResultPersistenceError(
        'Conflicting payload submitted for an existing clientRunId.',
        {
          rollbackAttempted: false,
          rollbackSucceeded: false,
          recoverable: false,
          reason: 'client_run_id_conflict',
        }
      );
    }

    if (!isMissingAtomicRpcError(rpcError)) {
      throw new ResultPersistenceError(
        'Failed to store verified test result atomically.',
        {
          rollbackAttempted: false,
          rollbackSucceeded: false,
          recoverable: true,
          reason: 'atomic_rpc_failed',
        }
      );
    }
  }

  const { existingRow, clientRunIdColumnSupported } = await findExistingResultForRun(
    supabase,
    userId,
    verified,
    {
      clientRunId: effectiveClientRunId,
      deduplicateBySignature: options?.deduplicateBySignature,
    }
  );

  if (existingRow) {
    return finalizeRecoveredResult(supabase, userId, existingRow, verified);
  }

  // Query prior Personal Best using canonical configured duration bracket (valid runs only)
  const { data: priorBestRow, error: priorBestError } = await supabase
    .from('test_results')
    .select('wpm')
    .eq('user_id', userId)
    .eq('mode', mode)
    .eq('duration', configuredDuration)
    .eq('is_invalidated', false)
    .order('wpm', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (priorBestError) {
    throw new Error('Failed to verify prior personal best.');
  }

  const previousBestWpm =
    typeof priorBestRow?.wpm === 'number' ? priorBestRow.wpm : null;
  const isPersonalBest =
    result.wpm > 0 && (previousBestWpm === null || result.wpm > previousBestWpm);

  const baseInsertPayload: Database['public']['Tables']['test_results']['Insert'] = {
    user_id: userId,
    wpm: result.wpm,
    raw_wpm: result.rawWpm,
    accuracy: result.accuracy,
    consistency: result.consistency,
    error_count: result.errorCount,
    backspace_count: result.backspaceCount,
    mode,
    duration: configuredDuration,
    seed,
    is_invalidated: false,
  };

  let dbResult: PersistedTestResultRow | null = null;
  let insertError: PostgrestErrorLike | null = null;

  if (effectiveClientRunId && clientRunIdColumnSupported) {
    const attemptWithClientId = await supabase
      .from('test_results')
      .insert({
        ...baseInsertPayload,
        client_run_id: effectiveClientRunId,
      })
      .select()
      .single();

    if (
      attemptWithClientId.error &&
      isMissingClientRunIdColumnError(attemptWithClientId.error)
    ) {
      // Schema has not yet applied client_run_id column; retry with base live columns cleanly
      const fallbackAttempt = await supabase
        .from('test_results')
        .insert(baseInsertPayload)
        .select()
        .single();
      dbResult = (fallbackAttempt.data as PersistedTestResultRow | null) ?? null;
      insertError = fallbackAttempt.error;
    } else if (
      attemptWithClientId.error &&
      isUniqueViolationError(attemptWithClientId.error)
    ) {
      const { data: racedRow, error: raceFetchError } = await supabase
        .from('test_results')
        .select(
          'id, user_id, wpm, raw_wpm, accuracy, consistency, error_count, backspace_count, mode, duration, seed, client_run_id, is_invalidated, created_at'
        )
        .eq('user_id', userId)
        .eq('client_run_id', effectiveClientRunId)
        .maybeSingle();

      if (raceFetchError || !racedRow) {
        throw new Error('Failed to resolve duplicate verified test result.');
      }

      return finalizeRecoveredResult(
        supabase,
        userId,
        racedRow as PersistedTestResultRow,
        verified
      );
    } else {
      dbResult = (attemptWithClientId.data as PersistedTestResultRow | null) ?? null;
      insertError = attemptWithClientId.error;
    }
  } else {
    const attemptWithoutClientId = await supabase
      .from('test_results')
      .insert(baseInsertPayload)
      .select()
      .single();
    dbResult = (attemptWithoutClientId.data as PersistedTestResultRow | null) ?? null;
    insertError = attemptWithoutClientId.error;
  }

  if (insertError || !dbResult) {
    throw new Error('Failed to store verified test result.');
  }

  const { error: replayError } = await supabase.from('replays').insert({
    test_result_id: dbResult.id,
    telemetry: result.telemetry as unknown as Json,
  });

  if (replayError && !isUniqueViolationError(replayError)) {
    let rollbackAttempted = false;
    let rollbackSucceeded = false;

    if (isPrivilegedClient) {
      // Privileged client attempts explicit compensating DELETE and verifies row count via .select('id')
      rollbackAttempted = true;
      const { data: deletedRows, error: rollbackError } = await supabase
        .from('test_results')
        .delete()
        .eq('id', dbResult.id)
        .select('id');

      if (rollbackError) {
        console.error('Replay rollback cleanup failed:', rollbackError);
      } else if (
        Array.isArray(deletedRows) &&
        deletedRows.some((deleted) => deleted.id === dbResult.id)
      ) {
        rollbackSucceeded = true;
      } else {
        console.error(
          'Replay rollback deleted 0 rows (blocked by RLS or missing row) for orphaned result:',
          dbResult.id
        );
      }
    } else {
      console.error(
        'Replay insert failed under unprivileged SSR client (no DELETE RLS policy); preserving orphan for retry recovery:',
        dbResult.id
      );
    }

    throw new ResultPersistenceError('Failed to store verified replay telemetry.', {
      orphanResultId: rollbackSucceeded ? undefined : dbResult.id,
      rollbackAttempted,
      rollbackSucceeded,
      recoverable: !rollbackSucceeded,
      reason: 'replay_insert_failed',
    });
  }

  const [streakDays, countResp] = await Promise.all([
    updateDailyStreakForUser(supabase, userId),
    supabase
      .from('test_results')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_invalidated', false),
  ]);

  if (countResp.error) {
    throw new Error('Failed to read verified test count.');
  }

  const totalTests = countResp.count ?? 1;

  const unlocked = await evaluateAndUnlockAchievements(supabase, userId, {
    wpm: result.wpm,
    accuracy: result.accuracy,
    streakDays,
    totalTests,
  });

  return {
    result: dbResult,
    unlocked,
    previousBestWpm,
    isPersonalBest,
    streakDays,
  };
}
