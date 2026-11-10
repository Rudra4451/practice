import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  evaluateAndUnlockAchievements,
  persistVerifiedResult,
  ResultPersistenceError,
  updateDailyStreakForUser,
} from '@/lib/typing/persistence';
import type { VerifiedSessionOutcome } from '@/lib/typing/verifier';

function buildVerifiedOutcome(overrides?: Partial<VerifiedSessionOutcome>): VerifiedSessionOutcome {
  return {
    ok: true,
    mode: 'words',
    configuredDuration: 30,
    seed: 'persistseed123',
    clientRunId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    targetText: 'sample target text',
    result: {
      wpm: 88,
      rawWpm: 92,
      accuracy: 97.5,
      consistency: 91,
      errorCount: 1,
      backspaceCount: 2,
      duration: 30,
      elapsedSeconds: 30,
      totalInputKeystrokes: 100,
      correctInputKeystrokes: 98,
      timeline: [{ second: 1, wpm: 88, rawWpm: 92 }],
      keySpeeds: {},
      errorKeys: {},
      bigramSpeeds: {},
      telemetry: [
        { t: 0, k: 's', i: 0, y: 0 },
        { t: 140, k: 'a', i: 1, y: 0 },
      ],
    },
    ...overrides,
  };
}

type StoredRow = {
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
};

function createPersistenceSupabaseMock(config?: {
  clientRunIdSupported?: boolean;
  initialResults?: StoredRow[];
  initialReplays?: Array<{ test_result_id: string; telemetry: unknown }>;
  existingByClientId?: Record<string, unknown> | null;
  priorBestError?: { code?: string; message?: string } | null;
  signatureCandidates?: Array<Record<string, unknown>>;
  candidateReplays?: Array<{ test_result_id: string; telemetry: unknown }>;
  uniqueRaceOnInsert?: boolean;
  racedRow?: Record<string, unknown> | null;
  replayInsertError?: { code?: string; message?: string } | null;
  rollbackDeleteMode?: 'deleted' | 'rls_blocked_empty' | 'rls_error';
  rollbackDeleteError?: { code?: string; message?: string } | null;
  streakRow?: {
    id: string;
    current_streak: number;
    longest_streak: number;
    last_active_date: string | null;
  } | null;
  streakInsertError?: { code?: string; message?: string } | null;
  streakUpdateError?: { code?: string; message?: string } | null;
  replayInsertRaceTelemetry?: unknown;
  countError?: { code?: string; message?: string } | null;
  achievementInsertError?: { code?: string; message?: string } | null;
  achievementsCatalog?: Array<{ id: string; code: string; name: string; criteria: unknown }>;
  rpcImpl?: (fnName: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
}) {
  const storedResults: StoredRow[] = [...(config?.initialResults ?? [])];
  const insertedResults: Array<Record<string, unknown>> = [];
  const deletedResultIds: string[] = [];
  const rollbackDeleteAttempts: string[] = [];
  const storedReplays = new Map<string, unknown>();
  for (const r of config?.initialReplays ?? []) {
    storedReplays.set(r.test_result_id, r.telemetry);
  }
  const insertedReplays: Array<Record<string, unknown>> = [];
  const streakUpdates: Array<Record<string, unknown>> = [];
  const insertedAchievements: Array<Record<string, unknown>> = [];
  const clientRunIdSupported = config?.clientRunIdSupported ?? true;
  let existingReplayFetched = false;
  let nextReplayFails = Boolean(config?.replayInsertError);
  let rowSeq = 0;

  const supabase = {
    rpc: config?.rpcImpl ? vi.fn(config.rpcImpl) : undefined,
    from: vi.fn((table: string) => {
      if (table === 'test_results') {
        return {
          select: vi.fn((cols: string, opts?: { count?: string; head?: boolean }) => {
            const filters: Record<string, unknown> = {};
            let neqId: string | undefined;
            const chain = {
              eq: vi.fn((col: string, val: unknown) => {
                filters[col] = val;
                if (opts?.head && 'user_id' in filters && 'is_invalidated' in filters) {
                  const userCount = storedResults.filter(
                    (row) => row.user_id === filters.user_id && row.is_invalidated !== true
                  ).length;
                  return Promise.resolve({
                    count: Math.max(1, userCount),
                    error: config?.countError ?? null,
                  });
                }
                return chain;
              }),
              neq: vi.fn((col: string, val: unknown) => {
                if (col === 'id') {
                  neqId = String(val);
                }
                return chain;
              }),
              order: vi.fn(() => chain),
              limit: vi.fn(() => {
                if (cols.includes('raw_wpm') && cols.includes('consistency')) {
                  if (config?.signatureCandidates) {
                    return Promise.resolve({
                      data: config.signatureCandidates,
                      error: null,
                    });
                  }
                  const matches = storedResults
                    .filter(
                      (row) =>
                        row.user_id === filters.user_id &&
                        row.seed === filters.seed &&
                        row.mode === filters.mode &&
                        row.duration === filters.duration &&
                        row.wpm === filters.wpm &&
                        row.accuracy === filters.accuracy
                    )
                    .sort((a, b) => {
                      const invDiff = (a.is_invalidated ? 1 : 0) - (b.is_invalidated ? 1 : 0);
                      if (invDiff !== 0) return invDiff;
                      return Date.parse(b.created_at) - Date.parse(a.created_at);
                    });
                  return Promise.resolve({ data: matches, error: null });
                }
                return chain;
              }),
              maybeSingle: vi.fn(async () => {
                if (cols.includes('client_run_id')) {
                  if (!clientRunIdSupported) {
                    return {
                      data: null,
                      error: { code: 'PGRST204', message: "Could not find 'client_run_id' column" },
                    };
                  }
                  if (config?.racedRow && insertedResults.length === 0 && config?.uniqueRaceOnInsert) {
                    return { data: config.racedRow, error: null };
                  }
                  if (config?.existingByClientId !== undefined) {
                    return {
                      data: config.existingByClientId,
                      error: null,
                    };
                  }
                  const match = storedResults.find(
                    (row) =>
                      row.user_id === filters.user_id &&
                      row.client_run_id === filters.client_run_id
                  );
                  return { data: match ?? null, error: null };
                }
                if (cols === 'wpm') {
                  if (config?.priorBestError) {
                    return { data: null, error: config.priorBestError };
                  }
                  const matchingPrior = storedResults
                    .filter(
                      (row) =>
                        row.user_id === filters.user_id &&
                        row.mode === filters.mode &&
                        row.duration === filters.duration &&
                        row.is_invalidated !== true &&
                        (neqId === undefined || row.id !== neqId)
                    )
                    .sort((a, b) => b.wpm - a.wpm);
                  return {
                    data: matchingPrior.length > 0 ? { wpm: matchingPrior[0].wpm } : null,
                    error: null,
                  };
                }
                return { data: null, error: null };
              }),
            };
            return chain;
          }),
          insert: vi.fn((payload: Record<string, unknown>) => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => {
                if ('client_run_id' in payload && !clientRunIdSupported) {
                  return {
                    data: null,
                    error: { code: 'PGRST204', message: "Could not find 'client_run_id' column" },
                  };
                }
                if (config?.uniqueRaceOnInsert) {
                  return {
                    data: null,
                    error: { code: '23505', message: 'duplicate key value violates unique constraint' },
                  };
                }
                rowSeq += 1;
                const row: StoredRow = {
                  id: `res-new-${rowSeq}`,
                  user_id: (payload.user_id as string | null) ?? null,
                  wpm: Number(payload.wpm),
                  raw_wpm: Number(payload.raw_wpm),
                  accuracy: Number(payload.accuracy),
                  consistency: Number(payload.consistency),
                  error_count: Number(payload.error_count),
                  backspace_count: Number(payload.backspace_count),
                  mode: String(payload.mode),
                  duration: Number(payload.duration),
                  seed: String(payload.seed),
                  client_run_id:
                    typeof payload.client_run_id === 'string' ? payload.client_run_id : undefined,
                  is_invalidated: Boolean(payload.is_invalidated),
                  created_at: new Date().toISOString(),
                };
                insertedResults.push(payload);
                storedResults.push(row);
                return {
                  data: row,
                  error: null,
                };
              }),
            })),
          })),
          delete: vi.fn(() => ({
            eq: vi.fn((_col: string, id: string) => {
              rollbackDeleteAttempts.push(id);
              const executeDelete = async () => {
                const mode = config?.rollbackDeleteMode ?? 'deleted';
                if (mode === 'rls_error' || config?.rollbackDeleteError) {
                  return {
                    data: null,
                    error: config?.rollbackDeleteError ?? {
                      code: '42501',
                      message: 'permission denied for table test_results',
                    },
                  };
                }
                if (mode === 'rls_blocked_empty') {
                  // Simulate Postgres RLS allowing DELETE query syntax but deleting 0 rows silently
                  return {
                    data: [],
                    error: null,
                  };
                }
                deletedResultIds.push(id);
                const idx = storedResults.findIndex((r) => r.id === id);
                if (idx >= 0) storedResults.splice(idx, 1);
                return {
                  data: [{ id }],
                  error: null,
                };
              };
              return {
                select: vi.fn(() => executeDelete()),
              };
            }),
          })),
        };
      }

      if (table === 'replays') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async (_col: string, ids: string[]) => {
              if (config?.candidateReplays !== undefined) {
                return { data: config.candidateReplays, error: null };
              }
              return {
                data: ids
                  .filter((id) => storedReplays.has(id))
                  .map((id) => ({ test_result_id: id, telemetry: storedReplays.get(id) })),
                error: null,
              };
            }),
              eq: vi.fn((_col: string, id: string) => ({
                limit: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => {
                    existingReplayFetched = true;
                    const candidateMatch = config?.candidateReplays?.find(
                      (c) => c.test_result_id === id
                    );
                    const telemetry = storedReplays.get(id) ?? candidateMatch?.telemetry;
                    const exists = Boolean(candidateMatch) || storedReplays.has(id);
                    return {
                      data: exists
                        ? {
                            id: `rep-${id}`,
                            ...(telemetry !== undefined ? { telemetry } : {}),
                          }
                        : null,
                      error: null,
                    };
                  }),
                })),
              })),
            })),
            insert: vi.fn(async (payload: Record<string, unknown>) => {
              if (nextReplayFails) {
                if (
                  config?.replayInsertError?.code === '23505' &&
                  config?.replayInsertRaceTelemetry !== undefined
                ) {
                  storedReplays.set(
                    String(payload.test_result_id),
                    config.replayInsertRaceTelemetry
                  );
                }
                return { error: config?.replayInsertError ?? { code: '50000', message: 'disk full' } };
              }
              insertedReplays.push(payload);
              storedReplays.set(String(payload.test_result_id), payload.telemetry);
              return { error: null };
            }),
          };
        }

      if (table === 'streaks') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data:
                  config?.streakRow === undefined
                    ? {
                        id: 'streak-1',
                        current_streak: 0,
                        longest_streak: 0,
                        last_active_date: null,
                      }
                    : config.streakRow,
                error: null,
              })),
            })),
          })),
          insert: vi.fn(async () => ({ error: config?.streakInsertError ?? null })),
          update: vi.fn((payload: Record<string, unknown>) => {
            streakUpdates.push(payload);
            return { eq: vi.fn(async () => ({ error: config?.streakUpdateError ?? null })) };
          }),
        };
      }

      if (table === 'user_achievements') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({ data: [], error: null })),
          })),
          insert: vi.fn(async (payload: Record<string, unknown>) => {
            if (config?.achievementInsertError) {
              return { error: config.achievementInsertError };
            }
            insertedAchievements.push(payload);
            return { error: null };
          }),
        };
      }

      if (table === 'achievements') {
        return {
          select: vi.fn(async () => ({
            data: config?.achievementsCatalog ?? [],
            error: null,
          })),
        };
      }

      return {};
    }),
  } as unknown as SupabaseClient<Database>;

  return {
    supabase,
    storedResults,
    insertedResults,
    deletedResultIds,
    rollbackDeleteAttempts,
    insertedReplays,
    storedReplays,
    streakUpdates,
    insertedAchievements,
    wasReplayChecked: () => existingReplayFetched,
    setReplayFail: (shouldFail: boolean) => {
      nextReplayFails = shouldFail;
    },
  };
}

describe('lib/typing/persistence', () => {
  it('persists client_run_id when supported by live schema', async () => {
    const mock = createPersistenceSupabaseMock({ clientRunIdSupported: true });
    const verified = buildVerifiedOutcome();

    const output = await persistVerifiedResult(mock.supabase, 'user-1', verified, {
      clientRunId: verified.clientRunId,
    });

    expect(output.result.client_run_id).toBe(verified.clientRunId);
    expect(output.isPersonalBest).toBe(true);
    expect(output.previousBestWpm).toBeNull();
    expect(mock.insertedResults).toHaveLength(1);
    expect(mock.insertedResults[0].client_run_id).toBe(verified.clientRunId);
    expect(mock.insertedReplays).toHaveLength(1);
  });

  it('falls back cleanly when client_run_id column is missing in active schema (PGRST204)', async () => {
    const mock = createPersistenceSupabaseMock({ clientRunIdSupported: false });
    const verified = buildVerifiedOutcome();

    const output = await persistVerifiedResult(mock.supabase, 'user-1', verified, {
      clientRunId: verified.clientRunId,
    });

    expect(output.result.id).toBe('res-new-1');
    expect(mock.insertedResults).toHaveLength(1);
    expect(mock.insertedResults[0].client_run_id).toBeUndefined();
    expect(mock.insertedReplays).toHaveLength(1);
  });

  it('recovers idempotently on 23505 unique constraint conflict without duplicating replays and computes true PB', async () => {
    const verified = buildVerifiedOutcome();
    const racedRow: StoredRow = {
      id: 'res-raced-1',
      user_id: 'user-1',
      wpm: 88,
      raw_wpm: 92,
      accuracy: 97.5,
      consistency: 91,
      error_count: 1,
      backspace_count: 2,
      mode: 'words',
      duration: 30,
      seed: verified.seed,
      client_run_id: verified.clientRunId,
      created_at: new Date().toISOString(),
    };
    const priorFasterRow: StoredRow = {
      id: 'res-prior-72',
      user_id: 'user-1',
      wpm: 72,
      raw_wpm: 75,
      accuracy: 95,
      consistency: 89,
      error_count: 1,
      backspace_count: 1,
      mode: 'words',
      duration: 30,
      seed: 'oldseed123',
      created_at: new Date(Date.now() - 120_000).toISOString(),
    };

    const mock = createPersistenceSupabaseMock({
      clientRunIdSupported: true,
      uniqueRaceOnInsert: true,
      initialResults: [priorFasterRow, racedRow],
      racedRow,
      candidateReplays: [{ test_result_id: 'res-raced-1', telemetry: verified.result.telemetry }],
    });

    // Simulate race where first pre-insert lookup returns null, then 23505 triggers race fetch
    let selectCount = 0;
    const origFrom = mock.supabase.from as unknown as (table: string) => unknown;
    (mock.supabase as unknown as { from: (t: string) => unknown }).from = vi.fn((table: string) => {
      if (table === 'test_results') {
        const base = origFrom(table) as Record<string, unknown>;
        const origSelect = base.select as (c: string, o?: unknown) => Record<string, unknown>;
        return {
          ...base,
          select: vi.fn((cols: string, opts?: unknown) => {
            const chain = origSelect(cols, opts);
            if (cols.includes('client_run_id')) {
              return {
                ...chain,
                eq: () => ({
                  eq: () => ({
                    maybeSingle: vi.fn(async () => {
                      selectCount += 1;
                      if (selectCount === 1) return { data: null, error: null };
                      return { data: racedRow, error: null };
                    }),
                  }),
                }),
              };
            }
            return chain;
          }),
        };
      }
      return origFrom(table);
    });

    const output = await persistVerifiedResult(mock.supabase, 'user-1', verified, {
      clientRunId: verified.clientRunId,
    });

    expect(output.deduplicated).toBe(true);
    expect(output.result.id).toBe('res-raced-1');
    expect(output.previousBestWpm).toBe(72);
    expect(output.isPersonalBest).toBe(true);
    expect(mock.wasReplayChecked()).toBe(true);
  });

  it('rolls back test_results row via confirmed DELETE when isPrivilegedClient=true and marks unrecoverable', async () => {
    const verified = buildVerifiedOutcome();
    const mock = createPersistenceSupabaseMock({
      replayInsertError: { code: '50000', message: 'disk full' },
      rollbackDeleteMode: 'deleted',
    });

    let caughtError: unknown;
    try {
      await persistVerifiedResult(mock.supabase, 'user-1', verified, {
        clientRunId: verified.clientRunId,
        isPrivilegedClient: true,
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(ResultPersistenceError);
    const err = caughtError as ResultPersistenceError;
    expect(err.reason).toBe('replay_insert_failed');
    expect(err.rollbackAttempted).toBe(true);
    expect(err.rollbackSucceeded).toBe(true);
    expect(err.recoverable).toBe(false);
    expect(err.orphanResultId).toBeUndefined();
    expect(mock.deletedResultIds).toEqual(['res-new-1']);
    expect(mock.storedResults).toHaveLength(0);
  });

  it('detects RLS-blocked silent 0-row DELETE (data: []) and 42501 DELETE error as unrolled recoverable orphans', async () => {
    const verified = buildVerifiedOutcome();

    const silentRlsMock = createPersistenceSupabaseMock({
      replayInsertError: { code: '50000', message: 'disk full' },
      rollbackDeleteMode: 'rls_blocked_empty',
    });

    let caughtSilent: unknown;
    try {
      await persistVerifiedResult(silentRlsMock.supabase, 'user-1', verified, {
        clientRunId: verified.clientRunId,
        isPrivilegedClient: true,
      });
    } catch (err) {
      caughtSilent = err;
    }

    expect(caughtSilent).toBeInstanceOf(ResultPersistenceError);
    const silentErr = caughtSilent as ResultPersistenceError;
    expect(silentErr.rollbackAttempted).toBe(true);
    expect(silentErr.rollbackSucceeded).toBe(false);
    expect(silentErr.recoverable).toBe(true);
    expect(silentErr.orphanResultId).toBe('res-new-1');
    expect(silentRlsMock.rollbackDeleteAttempts).toEqual(['res-new-1']);
    expect(silentRlsMock.storedResults).toHaveLength(1);

    const errorRlsMock = createPersistenceSupabaseMock({
      replayInsertError: { code: '50000', message: 'disk full' },
      rollbackDeleteMode: 'rls_error',
    });

    let caughtPerm: unknown;
    try {
      await persistVerifiedResult(errorRlsMock.supabase, 'user-1', verified, {
        clientRunId: verified.clientRunId,
        isPrivilegedClient: true,
      });
    } catch (err) {
      caughtPerm = err;
    }

    expect(caughtPerm).toBeInstanceOf(ResultPersistenceError);
    const permErr = caughtPerm as ResultPersistenceError;
    expect(permErr.rollbackAttempted).toBe(true);
    expect(permErr.rollbackSucceeded).toBe(false);
    expect(permErr.recoverable).toBe(true);
    expect(permErr.orphanResultId).toBe('res-new-1');
  });

  it('skips blind DELETE under unprivileged SSR client and recovers the orphan replay + PB cleanly on retry', async () => {
    const verified = buildVerifiedOutcome();
    const mock = createPersistenceSupabaseMock({
      initialResults: [
        {
          id: 'res-prev-65',
          user_id: 'user-1',
          wpm: 65,
          raw_wpm: 68,
          accuracy: 95,
          consistency: 88,
          error_count: 1,
          backspace_count: 1,
          mode: 'words',
          duration: 30,
          seed: 'earlierseed',
          created_at: new Date(Date.now() - 300_000).toISOString(),
        },
      ],
      replayInsertError: { code: '50000', message: 'transient replay write failure' },
    });

    let firstErr: unknown;
    try {
      await persistVerifiedResult(mock.supabase, 'user-1', verified, {
        clientRunId: verified.clientRunId,
        deduplicateBySignature: true,
        isPrivilegedClient: false,
      });
    } catch (err) {
      firstErr = err;
    }

    expect(firstErr).toBeInstanceOf(ResultPersistenceError);
    const persistenceErr = firstErr as ResultPersistenceError;
    expect(persistenceErr.rollbackAttempted).toBe(false);
    expect(persistenceErr.rollbackSucceeded).toBe(false);
    expect(persistenceErr.recoverable).toBe(true);
    expect(persistenceErr.orphanResultId).toBe('res-new-1');
    expect(mock.rollbackDeleteAttempts).toHaveLength(0);
    expect(mock.deletedResultIds).toHaveLength(0);
    expect(mock.storedResults).toHaveLength(2);

    // Retry once DB/replay channel recovers
    mock.setReplayFail(false);
    const recovered = await persistVerifiedResult(mock.supabase, 'user-1', verified, {
      clientRunId: verified.clientRunId,
      deduplicateBySignature: true,
      isPrivilegedClient: false,
    });

    expect(recovered.deduplicated).toBe(true);
    expect(recovered.recoveredPartialWrite).toBe(true);
    expect(recovered.result.id).toBe('res-new-1');
    expect(recovered.previousBestWpm).toBe(65);
    expect(recovered.isPersonalBest).toBe(true);
    expect(mock.insertedReplays).toHaveLength(1);
    expect(mock.storedResults).toHaveLength(2);
  });

  it('recovers orphaned partial writes cleanly under pre-client_run_id schema and computes real non-PB vs PB excluding existingRow', async () => {
    const verified = buildVerifiedOutcome();
    const mock = createPersistenceSupabaseMock({
      clientRunIdSupported: false,
      initialResults: [
        {
          id: 'res-faster-95',
          user_id: 'user-1',
          wpm: 95,
          raw_wpm: 98,
          accuracy: 98,
          consistency: 92,
          error_count: 0,
          backspace_count: 0,
          mode: 'words',
          duration: 30,
          seed: 'fasterseed',
          created_at: new Date(Date.now() - 200_000).toISOString(),
        },
        {
          id: 'res-orphan-1',
          user_id: 'user-1',
          wpm: 88,
          raw_wpm: 92,
          accuracy: 97.5,
          consistency: 91,
          error_count: 1,
          backspace_count: 2,
          mode: 'words',
          duration: 30,
          seed: verified.seed,
          created_at: new Date().toISOString(),
        },
      ],
      initialReplays: [],
    });

    const output = await persistVerifiedResult(mock.supabase, 'user-1', verified, {
      deduplicateBySignature: true,
    });

    expect(output.deduplicated).toBe(true);
    expect(output.recoveredPartialWrite).toBe(true);
    expect(output.result.id).toBe('res-orphan-1');
    expect(output.previousBestWpm).toBe(95);
    expect(output.isPersonalBest).toBe(false);
    expect(mock.insertedResults).toHaveLength(0);
    expect(mock.insertedReplays).toHaveLength(1);
    expect(mock.insertedReplays[0].test_result_id).toBe('res-orphan-1');

    // Also verifies priorBestResp errors throw rather than silently defaulting PB
    const errorPbMock = createPersistenceSupabaseMock({
      clientRunIdSupported: true,
      initialResults: [
        {
          id: 'res-orphan-err',
          user_id: 'user-1',
          wpm: 88,
          raw_wpm: 92,
          accuracy: 97.5,
          consistency: 91,
          error_count: 1,
          backspace_count: 2,
          mode: 'words',
          duration: 30,
          seed: verified.seed,
          client_run_id: verified.clientRunId,
          created_at: new Date().toISOString(),
        },
      ],
      priorBestError: { code: '50000', message: 'query failed' },
    });

    await expect(
      persistVerifiedResult(errorPbMock.supabase, 'user-1', verified, {
        clientRunId: verified.clientRunId,
      })
    ).rejects.toThrow(/Failed to verify prior personal best/i);
  });

  it('scopes clientRunId idempotency strictly per user so different users do not collide', async () => {
    const sharedClientRunId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const verified = buildVerifiedOutcome({ clientRunId: sharedClientRunId });
    const mock = createPersistenceSupabaseMock({ clientRunIdSupported: true });

    const resA = await persistVerifiedResult(mock.supabase, 'user-alpha', verified, {
      clientRunId: sharedClientRunId,
    });
    const resB = await persistVerifiedResult(mock.supabase, 'user-beta', verified, {
      clientRunId: sharedClientRunId,
    });
    const retryA = await persistVerifiedResult(mock.supabase, 'user-alpha', verified, {
      clientRunId: sharedClientRunId,
    });

    expect(resA.result.user_id).toBe('user-alpha');
    expect(resB.result.user_id).toBe('user-beta');
    expect(resA.result.id).not.toBe(resB.result.id);
    expect(retryA.deduplicated).toBe(true);
    expect(retryA.result.id).toBe(resA.result.id);
    expect(mock.insertedResults).toHaveLength(2);
  });

  it('uses submit_verified_result RPC when privileged and falls back cleanly only on PGRST202', async () => {
    const verified = buildVerifiedOutcome();

    const atomicPayload = {
      result: {
        id: 'res-rpc-1',
        user_id: 'user-1',
        wpm: 88,
        raw_wpm: 92,
        accuracy: 97.5,
        consistency: 91,
        error_count: 1,
        backspace_count: 2,
        mode: 'words',
        duration: 30,
        seed: verified.seed,
        client_run_id: verified.clientRunId,
        created_at: new Date().toISOString(),
      },
      unlocked: ['Bronze Fingers'],
      previousBestWpm: 70,
      isPersonalBest: true,
      streakDays: 4,
      deduplicated: false,
      recoveredPartialWrite: false,
    };

    const rpcSuccessMock = createPersistenceSupabaseMock({
      rpcImpl: async () => ({ data: atomicPayload, error: null }),
    });

    const rpcOut = await persistVerifiedResult(rpcSuccessMock.supabase, 'user-1', verified, {
      clientRunId: verified.clientRunId,
      isPrivilegedClient: true,
    });
    expect(rpcOut.result.id).toBe('res-rpc-1');
    expect(rpcOut.unlocked).toEqual(['Bronze Fingers']);
    expect(rpcOut.streakDays).toBe(4);
    expect(rpcSuccessMock.insertedResults).toHaveLength(0);

    // PGRST202 falls back cleanly to table-level queries
    const rpcMissingMock = createPersistenceSupabaseMock({
      rpcImpl: async () => ({
        data: null,
        error: { code: 'PGRST202', message: 'Could not find the function public.submit_verified_result' },
      }),
    });
    const fallbackOut = await persistVerifiedResult(rpcMissingMock.supabase, 'user-1', verified, {
      clientRunId: verified.clientRunId,
      isPrivilegedClient: true,
    });
    expect(fallbackOut.result.id).toBe('res-new-1');
    expect(rpcMissingMock.insertedResults).toHaveLength(1);

    // Fatal RPC failure throws ResultPersistenceError without partial table inserts
    const rpcFatalMock = createPersistenceSupabaseMock({
      rpcImpl: async () => ({
        data: null,
        error: { code: '50000', message: 'transaction aborted' },
      }),
    });
    await expect(
      persistVerifiedResult(rpcFatalMock.supabase, 'user-1', verified, {
        clientRunId: verified.clientRunId,
        isPrivilegedClient: true,
      })
    ).rejects.toThrow(ResultPersistenceError);
    expect(rpcFatalMock.insertedResults).toHaveLength(0);
  });

  it('throws on streak write failure and achievement write failure while ignoring 23505 race', async () => {
    const failingStreakMock = createPersistenceSupabaseMock({
      streakRow: null,
      streakInsertError: { code: '42501', message: 'permission denied' },
    });

    await expect(updateDailyStreakForUser(failingStreakMock.supabase, 'user-1')).rejects.toThrow(
      /Failed to create user streak record/i
    );

    const raceAchievementMock = createPersistenceSupabaseMock({
      achievementsCatalog: [
        {
          id: 'ach-1',
          code: 'SPEED_50',
          name: 'Bronze Fingers',
          criteria: { type: 'speed', wpm: 50, accuracy: 90 },
        },
      ],
      achievementInsertError: { code: '23505', message: 'duplicate key' },
    });

    const unlockedOnRace = await evaluateAndUnlockAchievements(
      raceAchievementMock.supabase,
      'user-1',
      { wpm: 80, accuracy: 96, streakDays: 2, totalTests: 5 }
    );
    expect(unlockedOnRace).toEqual([]);

    const fatalAchievementMock = createPersistenceSupabaseMock({
      achievementsCatalog: [
        {
          id: 'ach-1',
          code: 'SPEED_50',
          name: 'Bronze Fingers',
          criteria: { type: 'speed', wpm: 50, accuracy: 90 },
        },
      ],
      achievementInsertError: { code: '50000', message: 'unexpected db failure' },
    });

    await expect(
      evaluateAndUnlockAchievements(fatalAchievementMock.supabase, 'user-1', {
        wpm: 80,
        accuracy: 96,
        streakDays: 2,
        totalTests: 5,
      })
    ).rejects.toThrow(/Failed to record unlocked achievement/i);
  });

  it('does NOT mutate streaks, last_active_date, or unlock achievements on pure completed duplicates across UTC days', async () => {
    const verified = buildVerifiedOutcome();
    const yesterdayUtc = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
    const yesterdayCreatedAt = `${yesterdayUtc}T23:55:00.000Z`;

    const existingRow: StoredRow = {
      id: 'res-prev-day-done',
      user_id: 'user-1',
      wpm: verified.result.wpm,
      raw_wpm: verified.result.rawWpm,
      accuracy: verified.result.accuracy,
      consistency: verified.result.consistency,
      error_count: verified.result.errorCount,
      backspace_count: verified.result.backspaceCount,
      mode: verified.mode,
      duration: verified.configuredDuration,
      seed: verified.seed,
      client_run_id: verified.clientRunId,
      is_invalidated: false,
      created_at: yesterdayCreatedAt,
    };

    const achievementsCatalog = [
      {
        id: 'ach-speed-50',
        code: 'SPEED_50',
        name: 'Keyboard Apprentice',
        criteria: { type: 'speed', wpm: 50, accuracy: 90 },
      },
    ];

    // 1. Retry matched by client_run_id with replay already persisted
    const byClientRunMock = createPersistenceSupabaseMock({
      clientRunIdSupported: true,
      initialResults: [existingRow],
      initialReplays: [{ test_result_id: existingRow.id, telemetry: verified.result.telemetry }],
      streakRow: {
        id: 'streak-existing',
        current_streak: 4,
        longest_streak: 6,
        last_active_date: yesterdayUtc,
      },
      achievementsCatalog,
    });

    const dupOut = await persistVerifiedResult(byClientRunMock.supabase, 'user-1', verified, {
      clientRunId: verified.clientRunId,
    });

    expect(dupOut.deduplicated).toBe(true);
    expect(dupOut.recoveredPartialWrite).toBe(false);
    expect(dupOut.streakDays).toBe(4);
    expect(dupOut.unlocked).toEqual([]);
    expect(byClientRunMock.streakUpdates).toHaveLength(0);
    expect(byClientRunMock.insertedAchievements).toHaveLength(0);

    // 2. Retry matched by pre-migration signature across UTC midnight
    const bySigMock = createPersistenceSupabaseMock({
      clientRunIdSupported: false,
      initialResults: [{ ...existingRow, client_run_id: undefined }],
      initialReplays: [{ test_result_id: existingRow.id, telemetry: verified.result.telemetry }],
      streakRow: {
        id: 'streak-existing',
        current_streak: 4,
        longest_streak: 6,
        last_active_date: yesterdayUtc,
      },
      achievementsCatalog,
    });

    const sigDupOut = await persistVerifiedResult(bySigMock.supabase, 'user-1', verified, {
      deduplicateBySignature: true,
    });

    expect(sigDupOut.deduplicated).toBe(true);
    expect(sigDupOut.recoveredPartialWrite).toBe(false);
    expect(sigDupOut.streakDays).toBe(4);
    expect(sigDupOut.unlocked).toEqual([]);
    expect(bySigMock.streakUpdates).toHaveLength(0);
    expect(bySigMock.insertedAchievements).toHaveLength(0);
  });

  it('anchors orphan recovery streak update to original UTC created_at date and withholds double streak/unlock from concurrent 23505 loser', async () => {
    const verified = buildVerifiedOutcome();
    const originalRunIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const expectedUtcDate = originalRunIso.split('T')[0];
    const dayBeforeDate = new Date(Date.parse(originalRunIso) - 86_400_000)
      .toISOString()
      .split('T')[0];

    const orphanRow: StoredRow = {
      id: 'res-orphan-date',
      user_id: 'user-1',
      wpm: verified.result.wpm,
      raw_wpm: verified.result.rawWpm,
      accuracy: verified.result.accuracy,
      consistency: verified.result.consistency,
      error_count: verified.result.errorCount,
      backspace_count: verified.result.backspaceCount,
      mode: verified.mode,
      duration: verified.configuredDuration,
      seed: verified.seed,
      client_run_id: verified.clientRunId,
      is_invalidated: false,
      created_at: originalRunIso,
    };

    const winnerMock = createPersistenceSupabaseMock({
      clientRunIdSupported: true,
      initialResults: [orphanRow],
      initialReplays: [],
      streakRow: {
        id: 'streak-1',
        current_streak: 2,
        longest_streak: 4,
        last_active_date: dayBeforeDate,
      },
      achievementsCatalog: [
        {
          id: 'ach-speed-50',
          code: 'SPEED_50',
          name: 'Keyboard Apprentice',
          criteria: { type: 'speed', wpm: 50, accuracy: 90 },
        },
      ],
    });

    const winnerOut = await persistVerifiedResult(winnerMock.supabase, 'user-1', verified, {
      clientRunId: verified.clientRunId,
    });

    expect(winnerOut.deduplicated).toBe(true);
    expect(winnerOut.recoveredPartialWrite).toBe(true);
    expect(winnerOut.streakDays).toBe(3);
    expect(winnerOut.unlocked).toEqual(['Keyboard Apprentice']);
    expect(winnerMock.streakUpdates).toHaveLength(1);
    expect(winnerMock.streakUpdates[0].last_active_date).toBe(expectedUtcDate);

    // Concurrent losing worker hits 23505 inserting replay: must NOT advance streak or grant achievements
    const loserMock = createPersistenceSupabaseMock({
      clientRunIdSupported: true,
      initialResults: [orphanRow],
      initialReplays: [],
      replayInsertError: { code: '23505', message: 'duplicate key value violates unique constraint' },
      replayInsertRaceTelemetry: verified.result.telemetry,
      streakRow: {
        id: 'streak-1',
        current_streak: 3,
        longest_streak: 4,
        last_active_date: expectedUtcDate,
      },
      achievementsCatalog: [
        {
          id: 'ach-speed-50',
          code: 'SPEED_50',
          name: 'Keyboard Apprentice',
          criteria: { type: 'speed', wpm: 50, accuracy: 90 },
        },
      ],
    });

    const loserOut = await persistVerifiedResult(loserMock.supabase, 'user-1', verified, {
      clientRunId: verified.clientRunId,
    });

    expect(loserOut.deduplicated).toBe(true);
    expect(loserOut.recoveredPartialWrite).toBe(false);
    expect(loserOut.unlocked).toEqual([]);
    expect(loserMock.streakUpdates).toHaveLength(0);
    expect(loserMock.insertedAchievements).toHaveLength(0);
  });

  it('never moves future last_active_date backwards on streak reads/updates', async () => {
    const today = new Date('2026-06-15T12:00:00.000Z');
    const tomorrowStr = '2026-06-16';

    const futureActiveMock = createPersistenceSupabaseMock({
      streakRow: {
        id: 'streak-future',
        current_streak: 5,
        longest_streak: 7,
        last_active_date: tomorrowStr,
      },
    });
    const keptStreak = await updateDailyStreakForUser(futureActiveMock.supabase, 'user-1', today);
    expect(keptStreak).toBe(5);
    expect(futureActiveMock.streakUpdates).toHaveLength(0);

    const futureZeroMock = createPersistenceSupabaseMock({
      streakRow: {
        id: 'streak-future-zero',
        current_streak: 0,
        longest_streak: 0,
        last_active_date: tomorrowStr,
      },
    });
    const initStreak = await updateDailyStreakForUser(futureZeroMock.supabase, 'user-1', today);
    expect(initStreak).toBe(1);
    expect(futureZeroMock.streakUpdates).toHaveLength(1);
    expect(futureZeroMock.streakUpdates[0].last_active_date).toBe(tomorrowStr);
  });

  it('rejects invalidated results and conflicting clientRunId payloads fail-closed across lookup, signature, race, and RPC paths', async () => {
    const verified = buildVerifiedOutcome();
    const invalidatedRow: StoredRow = {
      id: 'res-invalid-1',
      user_id: 'user-1',
      wpm: verified.result.wpm,
      raw_wpm: verified.result.rawWpm,
      accuracy: verified.result.accuracy,
      consistency: verified.result.consistency,
      error_count: verified.result.errorCount,
      backspace_count: verified.result.backspaceCount,
      mode: verified.mode,
      duration: verified.configuredDuration,
      seed: verified.seed,
      client_run_id: verified.clientRunId,
      is_invalidated: true,
      created_at: new Date().toISOString(),
    };

    // 1. Invalidated row via direct client_run_id lookup
    const invClientMock = createPersistenceSupabaseMock({
      initialResults: [invalidatedRow],
    });
    await expect(
      persistVerifiedResult(invClientMock.supabase, 'user-1', verified, {
        clientRunId: verified.clientRunId,
      })
    ).rejects.toMatchObject({ reason: 'result_invalidated', recoverable: false });
    expect(invClientMock.insertedResults).toHaveLength(0);

    // 2. Invalidated row via pre-migration signature lookup
    const invSigMock = createPersistenceSupabaseMock({
      clientRunIdSupported: false,
      initialResults: [{ ...invalidatedRow, client_run_id: undefined }],
      initialReplays: [{ test_result_id: invalidatedRow.id, telemetry: verified.result.telemetry }],
    });
    await expect(
      persistVerifiedResult(invSigMock.supabase, 'user-1', verified, {
        deduplicateBySignature: true,
      })
    ).rejects.toMatchObject({ reason: 'result_invalidated', recoverable: false });
    expect(invSigMock.insertedResults).toHaveLength(0);

    // 3. RPC RESULT_INVALIDATED & CLIENT_RUN_ID_CONFLICT
    const rpcInvMock = createPersistenceSupabaseMock({
      rpcImpl: async () => ({
        data: null,
        error: { code: 'P0001', message: 'RESULT_INVALIDATED: Run was invalidated' },
      }),
    });
    await expect(
      persistVerifiedResult(rpcInvMock.supabase, 'user-1', verified, {
        clientRunId: verified.clientRunId,
        isPrivilegedClient: true,
      })
    ).rejects.toMatchObject({ reason: 'result_invalidated', recoverable: false });

    const rpcConflictMock = createPersistenceSupabaseMock({
      rpcImpl: async () => ({
        data: null,
        error: { code: 'P0001', message: 'CLIENT_RUN_ID_CONFLICT: Payload mismatch' },
      }),
    });
    await expect(
      persistVerifiedResult(rpcConflictMock.supabase, 'user-1', verified, {
        clientRunId: verified.clientRunId,
        isPrivilegedClient: true,
      })
    ).rejects.toMatchObject({ reason: 'client_run_id_conflict', recoverable: false });

    // 4. Existing client_run_id with mismatched seed or mismatched replay telemetry
    const validExistingRow: StoredRow = {
      ...invalidatedRow,
      id: 'res-valid-existing',
      is_invalidated: false,
      seed: 'differentseed99',
    };
    const seedConflictMock = createPersistenceSupabaseMock({
      initialResults: [validExistingRow],
    });
    await expect(
      persistVerifiedResult(seedConflictMock.supabase, 'user-1', verified, {
        clientRunId: verified.clientRunId,
      })
    ).rejects.toMatchObject({ reason: 'client_run_id_conflict', recoverable: false });

    const telemetryConflictMock = createPersistenceSupabaseMock({
      initialResults: [{ ...invalidatedRow, id: 'res-valid-tel', is_invalidated: false }],
      initialReplays: [
        { test_result_id: 'res-valid-tel', telemetry: [{ t: 0, k: 'x', i: 0, y: 0 }] },
      ],
    });
    await expect(
      persistVerifiedResult(telemetryConflictMock.supabase, 'user-1', verified, {
        clientRunId: verified.clientRunId,
      })
    ).rejects.toMatchObject({ reason: 'client_run_id_conflict', recoverable: false });
  });
});
