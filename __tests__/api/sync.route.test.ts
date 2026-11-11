import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateText } from '@/lib/typing/text-generator';
import {
  resetRecentRunCacheForTests,
  resetRecoveryRateLimitForTests,
  resetSyncRateLimitForTests,
} from '@/lib/security/rate-limit';

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

import { POST } from '@/app/api/results/sync/route';

function makeHumanTelemetry(text: string, count: number, stepMs = 135) {
  let t = 0;
  return Array.from({ length: count }, (_, i) => {
    if (i > 0) t += stepMs + ((i % 5) * 6 - 12);
    return { t, k: text[i], y: 0 as const, i };
  });
}

function createSyncMockSupabase(options?: {
  userId?: string;
  recentDbCount?: number;
  failReplayOnSeed?: string;
  failReplayOnce?: boolean;
}) {
  let activeUserId = options?.userId;
  const insertedResults: Array<Record<string, unknown>> = [];
  const storedReplays = new Map<string, unknown>();
  const deletedIds: string[] = [];
  const deleteAttempts: string[] = [];
  let failOnceActive = Boolean(options?.failReplayOnce);
  let rowSeq = 0;

  const supabase = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: activeUserId ? { id: activeUserId } : null },
        error: null,
      })),
    },
    from: vi.fn((table: string) => {
      if (table === 'test_results') {
        return {
          select: vi.fn((cols: string, opts?: { count?: string; head?: boolean }) => {
            const filters: Record<string, unknown> = {};
            let neqId: string | undefined;
            const chain = {
              eq: vi.fn((col: string, val: unknown) => {
                filters[col] = val;
                if (
                  opts?.head &&
                  !('gte_called' in filters) &&
                  'user_id' in filters &&
                  'is_invalidated' in filters &&
                  cols === 'id'
                ) {
                  const userCount = insertedResults.filter(
                    (row) => row.user_id === filters.user_id
                  ).length;
                  return Object.assign(
                    Promise.resolve({ count: Math.max(1, userCount), error: null }),
                    {
                      gte: vi.fn(async () => ({
                        count: options?.recentDbCount ?? 0,
                        error: null,
                      })),
                    }
                  );
                }
                return chain;
              }),
              neq: vi.fn((col: string, val: unknown) => {
                if (col === 'id') {
                  neqId = String(val);
                }
                return chain;
              }),
              gte: vi.fn(async () => ({
                count: options?.recentDbCount ?? 0,
                error: null,
              })),
              order: vi.fn(() => chain),
              limit: vi.fn(() => {
                if (cols.includes('raw_wpm') && cols.includes('consistency')) {
                  const matches = insertedResults
                    .filter(
                      (row) =>
                        row.user_id === filters.user_id &&
                        row.seed === filters.seed &&
                        row.mode === filters.mode &&
                        row.duration === filters.duration
                    )
                    .sort((a, b) => {
                      const invDiff =
                        (a.is_invalidated === true ? 1 : 0) -
                        (b.is_invalidated === true ? 1 : 0);
                      if (invDiff !== 0) return invDiff;
                      return (
                        Date.parse(String(b.created_at)) -
                        Date.parse(String(a.created_at))
                      );
                    });
                  return Promise.resolve({ data: matches, error: null });
                }
                return chain;
              }),
              maybeSingle: vi.fn(async () => {
                if (cols.includes('client_run_id')) {
                  const match = insertedResults.find(
                    (row) =>
                      row.user_id === filters.user_id &&
                      row.client_run_id === filters.client_run_id
                  );
                  return { data: match ?? null, error: null };
                }
                if (cols === 'wpm') {
                  const matchingPrior = insertedResults
                    .filter(
                      (row) =>
                        row.user_id === filters.user_id &&
                        row.mode === filters.mode &&
                        row.duration === filters.duration &&
                        row.is_invalidated !== true &&
                        (neqId === undefined || row.id !== neqId)
                    )
                    .sort((a, b) => Number(b.wpm) - Number(a.wpm));
                  return {
                    data: matchingPrior.length > 0 ? { wpm: Number(matchingPrior[0].wpm) } : null,
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
                rowSeq += 1;
                const row = {
                  id: `res-sync-${rowSeq}`,
                  created_at: new Date().toISOString(),
                  ...payload,
                };
                insertedResults.push(row);
                return { data: row, error: null };
              }),
            })),
          })),
          delete: vi.fn(() => ({
            eq: vi.fn((_col: string, id: string) => ({
              select: vi.fn(async () => {
                deleteAttempts.push(id);
                deletedIds.push(id);
                const idx = insertedResults.findIndex((r) => r.id === id);
                if (idx >= 0) insertedResults.splice(idx, 1);
                return { data: idx >= 0 ? [{ id }] : [], error: null };
              }),
            })),
          })),
        };
      }

      if (table === 'replays') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async (_col: string, ids: string[]) => ({
              data: ids
                .filter((id) => storedReplays.has(id))
                .map((id) => ({ test_result_id: id, telemetry: storedReplays.get(id) })),
              error: null,
            })),
            eq: vi.fn((_col: string, id: string) => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: storedReplays.has(id)
                    ? { id: `rep-${id}`, telemetry: storedReplays.get(id) }
                    : null,
                  error: null,
                })),
              })),
            })),
          })),
          insert: vi.fn(async (payload: Record<string, unknown>) => {
            const parentRow = insertedResults.find((r) => r.id === payload.test_result_id);
            if (options?.failReplayOnSeed && parentRow?.seed === options.failReplayOnSeed) {
              if (!options.failReplayOnce || failOnceActive) {
                failOnceActive = false;
                return { error: { code: '50000', message: 'simulated replay storage failure' } };
              }
            }
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
                data: {
                  id: 'streak-1',
                  current_streak: 1,
                  longest_streak: 1,
                  last_active_date: new Date().toISOString().split('T')[0],
                },
                error: null,
              })),
            })),
          })),
          insert: vi.fn(async () => ({ error: null })),
          update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        };
      }

      if (table === 'user_achievements') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({ data: [], error: null })),
          })),
          insert: vi.fn(async () => ({ error: null })),
        };
      }

      if (table === 'achievements') {
        return {
          select: vi.fn(async () => ({ data: [], error: null })),
        };
      }

      return {};
    }),
  };

  return {
    supabase,
    insertedResults,
    storedReplays,
    deletedIds,
    deleteAttempts,
    setUserId: (nextUserId: string) => {
      activeUserId = nextUserId;
    },
  };
}

describe('POST /api/results/sync', () => {
  beforeEach(() => {
    resetSyncRateLimitForTests();
    resetRecoveryRateLimitForTests();
    resetRecentRunCacheForTests();
    vi.stubEnv('NODE_ENV', 'test');
    createClientMock.mockReset();
    createAdminClientMock.mockReset();
    createAdminClientMock.mockReturnValue(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('rejects unauthenticated requests with 401 and batches exceeding 30 with 400', async () => {
    createClientMock.mockResolvedValue(createSyncMockSupabase({ userId: undefined }).supabase);
    const unauth = await POST(
      new Request('http://localhost:3000/api/results/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{}] }),
      })
    );
    expect(unauth.status).toBe(401);

    createClientMock.mockResolvedValue(createSyncMockSupabase({ userId: 'user-overlimit' }).supabase);
    const overLimit = await POST(
      new Request('http://localhost:3000/api/results/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: Array.from({ length: 31 }, () => ({})) }),
      })
    );
    expect(overLimit.status).toBe(400);
  });

  it('deduplicates same clientRunId AND same telemetry with brand new clientRunIds, while blocking unranked modes', async () => {
    const seed = 'syncdedup1234';
    const target = generateText(seed, 'words', 30);
    const telemetry = makeHumanTelemetry(target, 150, 125);

    const mock = createSyncMockSupabase({ userId: 'user-dedup' });
    createClientMock.mockResolvedValue(mock.supabase);

    const runId1 = '11111111-1111-4111-8111-111111111111';
    const runId2SamePayloadNewUuid = '22222222-2222-4222-8222-222222222222';

    const res = await POST(
      new Request('http://localhost:3000/api/results/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            { id: runId1, clientRunId: runId1, mode: 'words', duration: 30, seed, telemetry },
            { id: runId1, clientRunId: runId1, mode: 'words', duration: 30, seed, telemetry },
            {
              id: runId2SamePayloadNewUuid,
              clientRunId: runId2SamePayloadNewUuid,
              mode: 'words',
              duration: 30,
              seed,
              telemetry,
            },
            {
              id: 'drill-run-1',
              mode: 'drill',
              duration: 30,
              seed: 'drillseed123',
              telemetry,
            },
            {
              id: 'flagged-unranked',
              mode: 'words',
              duration: 30,
              seed,
              isRanked: false,
              telemetry,
            },
            {
              id: 'legacy-no-telemetry',
              mode: 'words',
              duration: 30,
              seed,
            },
          ],
        }),
      })
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      syncedCount: number;
      duplicateCount: number;
      skippedUnrankedCount: number;
      skippedLegacyCount: number;
      syncedIds: string[];
      duplicateIds: string[];
      skippedUnrankedIds: string[];
      skippedLegacyIds: string[];
    };

    expect(json.success).toBe(true);
    expect(json.syncedCount).toBe(1);
    expect(json.duplicateCount).toBe(2);
    expect(json.skippedUnrankedCount).toBe(2);
    expect(json.skippedLegacyCount).toBe(1);
    expect(json.syncedIds).toEqual([runId1]);
    expect(json.duplicateIds).toEqual([runId1, runId2SamePayloadNewUuid]);
    expect(json.skippedUnrankedIds).toEqual(['drill-run-1', 'flagged-unranked']);
    expect(json.skippedLegacyIds).toEqual(['legacy-no-telemetry']);
    expect(mock.insertedResults).toHaveLength(1);

    // Cross-request replay with yet another new clientRunId MUST also deduplicate via signature check
    const runId3 = '33333333-3333-4333-8333-333333333333';
    const replayRes = await POST(
      new Request('http://localhost:3000/api/results/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ id: runId3, clientRunId: runId3, mode: 'words', duration: 30, seed, telemetry }],
        }),
      })
    );
    expect(replayRes.status).toBe(200);
    const replayJson = (await replayRes.json()) as {
      syncedCount: number;
      duplicateCount: number;
      duplicateIds: string[];
    };
    expect(replayJson.syncedCount).toBe(0);
    expect(replayJson.duplicateCount).toBe(1);
    expect(replayJson.duplicateIds).toEqual([runId3]);
    expect(mock.insertedResults).toHaveLength(1);
  });

  it('returns 400 when all submitted items fail verification and returns rejectedReasons on mixed batches', async () => {
    const validSeed = 'syncvalidseed1';
    const validTelemetry = makeHumanTelemetry(generateText(validSeed, 'words', 15), 60, 120);
    const mock = createSyncMockSupabase({ userId: 'user-rejected-case' });
    createClientMock.mockResolvedValue(mock.supabase);

    const badDurationId = '77777777-7777-4777-8777-777777777777';
    const badAllRes = await POST(
      new Request('http://localhost:3000/api/results/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              id: badDurationId,
              clientRunId: badDurationId,
              mode: 'words',
              duration: 12,
              seed: validSeed,
              telemetry: validTelemetry,
            },
          ],
        }),
      })
    );
    expect(badAllRes.status).toBe(400);
    const badAllJson = (await badAllRes.json()) as {
      success: boolean;
      rejectedCount: number;
      rejectedIds: string[];
      rejectedReasons: Record<string, string>;
    };
    expect(badAllJson.success).toBe(false);
    expect(badAllJson.rejectedCount).toBe(1);
    expect(badAllJson.rejectedIds).toEqual([badDurationId]);
    expect(badAllJson.rejectedReasons[badDurationId]).toBeTruthy();

    const okId = '88888888-8888-4888-8888-888888888888';
    const badBotId = '99999999-9999-4999-8999-999999999999';
    const botTarget = generateText(validSeed, 'words', 15);
    const botTelemetry = Array.from({ length: 40 }, (_, i) => ({
      t: i * 100, // Uniform 0ms jitter bot cadence -> rejected by verifyAndScoreSession
      k: botTarget[i],
      y: 0 as const,
      i,
    }));
    const mixedRes = await POST(
      new Request('http://localhost:3000/api/results/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              id: okId,
              clientRunId: okId,
              mode: 'words',
              duration: 15,
              seed: validSeed,
              telemetry: validTelemetry,
            },
            {
              id: badBotId,
              clientRunId: badBotId,
              mode: 'words',
              duration: 15,
              seed: validSeed,
              telemetry: botTelemetry,
            },
          ],
        }),
      })
    );
    expect(mixedRes.status).toBe(200);
    const mixedJson = (await mixedRes.json()) as {
      success: boolean;
      syncedIds: string[];
      rejectedIds: string[];
      rejectedReasons: Record<string, string>;
    };
    expect(mixedJson.success).toBe(true);
    expect(mixedJson.syncedIds).toEqual([okId]);
    expect(mixedJson.rejectedIds).toEqual([badBotId]);
    expect(mixedJson.rejectedReasons[badBotId]).toBeTruthy();
  });

  it('enforces sync rate limit (429 + Retry-After) against repeated flooding', async () => {
    const seed = 'floodseed1234';
    const target = generateText(seed, 'words', 15);
    const telemetry = makeHumanTelemetry(target, 60, 120);
    const mock = createSyncMockSupabase({ userId: 'user-flooder' });
    createClientMock.mockResolvedValue(mock.supabase);

    for (let i = 0; i < 5; i += 1) {
      const okRes = await POST(
        new Request('http://localhost:3000/api/results/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: [{ id: `ok-${i}`, mode: 'words', duration: 15, seed, telemetry }],
          }),
        })
      );
      expect(okRes.status).toBe(200);
    }

    const blockedRes = await POST(
      new Request('http://localhost:3000/api/results/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ id: 'blocked-6', mode: 'words', duration: 15, seed, telemetry }],
        }),
      })
    );
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.headers.get('Retry-After')).toBeTruthy();
  });

  it('skips blind DELETE under SSR client (recovering orphan on retry) and executes compensating DELETE when admin client is privileged', async () => {
    const seedOk = 'syncokseed123';
    const seedFail = 'syncfailseed1';
    const okTelemetry = makeHumanTelemetry(generateText(seedOk, 'words', 15), 60, 120);
    const failTelemetry = makeHumanTelemetry(generateText(seedFail, 'words', 15), 60, 120);

    // 1. Privileged admin client runs compensating DELETE cleanly
    const adminMock = createSyncMockSupabase({
      userId: 'user-admin-rollback',
      failReplayOnSeed: seedFail,
    });
    createClientMock.mockResolvedValue(adminMock.supabase);
    createAdminClientMock.mockReturnValue(adminMock.supabase);

    const partialRes = await POST(
      new Request('http://localhost:3000/api/results/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              id: '44444444-4444-4444-8444-444444444444',
              clientRunId: '44444444-4444-4444-8444-444444444444',
              mode: 'words',
              duration: 15,
              seed: seedOk,
              telemetry: okTelemetry,
            },
            {
              id: '55555555-5555-4555-8555-555555555555',
              clientRunId: '55555555-5555-4555-8555-555555555555',
              mode: 'words',
              duration: 15,
              seed: seedFail,
              telemetry: failTelemetry,
            },
          ],
        }),
      })
    );

    expect(partialRes.status).toBe(207);
    const partialJson = (await partialRes.json()) as {
      success: boolean;
      partialFailure: boolean;
      syncedIds: string[];
      failedIds: string[];
    };
    expect(partialJson.success).toBe(false);
    expect(partialJson.partialFailure).toBe(true);
    expect(partialJson.syncedIds).toEqual(['44444444-4444-4444-8444-444444444444']);
    expect(partialJson.failedIds).toEqual(['55555555-5555-4555-8555-555555555555']);
    expect(adminMock.deletedIds).toHaveLength(1);

    // 2. Unprivileged SSR client skips DELETE and recovers the orphan cleanly on subsequent retry
    createAdminClientMock.mockReturnValue(null);
    const ssrMock = createSyncMockSupabase({
      userId: 'user-ssr-retry',
      failReplayOnSeed: seedFail,
      failReplayOnce: true,
    });
    createClientMock.mockResolvedValue(ssrMock.supabase);

    const ssrFailRes = await POST(
      new Request('http://localhost:3000/api/results/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              id: '66666666-6666-4666-8666-666666666666',
              clientRunId: '66666666-6666-4666-8666-666666666666',
              mode: 'words',
              duration: 15,
              seed: seedFail,
              telemetry: failTelemetry,
            },
          ],
        }),
      })
    );
    expect(ssrFailRes.status).toBe(500);
    const ssrFailJson = (await ssrFailRes.json()) as {
      success: boolean;
      failedIds: string[];
    };
    expect(ssrFailJson.success).toBe(false);
    expect(ssrFailJson.failedIds).toEqual(['66666666-6666-4666-8666-666666666666']);
    expect(ssrMock.deleteAttempts).toHaveLength(0);
    expect(ssrMock.insertedResults).toHaveLength(1);

    const ssrRetryRes = await POST(
      new Request('http://localhost:3000/api/results/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              id: '66666666-6666-4666-8666-666666666666',
              clientRunId: '66666666-6666-4666-8666-666666666666',
              mode: 'words',
              duration: 15,
              seed: seedFail,
              telemetry: failTelemetry,
            },
          ],
        }),
      })
    );
    expect(ssrRetryRes.status).toBe(200);
    const ssrRetryJson = (await ssrRetryRes.json()) as {
      duplicateCount: number;
      duplicateIds: string[];
    };
    expect(ssrRetryJson.duplicateCount).toBe(1);
    expect(ssrRetryJson.duplicateIds).toEqual(['66666666-6666-4666-8666-666666666666']);
    expect(ssrMock.insertedResults).toHaveLength(1);
    expect(ssrMock.storedReplays.size).toBe(1);
  });

  it('isolates identical clientRunId across distinct users independently', async () => {
    const seed = 'synccrossuser1';
    const telemetry = makeHumanTelemetry(generateText(seed, 'words', 15), 60, 120);
    const sharedId = 'abababab-1111-4111-8111-111111111111';

    const mock = createSyncMockSupabase({ userId: 'sync-user-a' });
    createClientMock.mockResolvedValue(mock.supabase);

    const resA = await POST(
      new Request('http://localhost:3000/api/results/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ id: sharedId, clientRunId: sharedId, mode: 'words', duration: 15, seed, telemetry }],
        }),
      })
    );
    expect(resA.status).toBe(200);

    mock.setUserId('sync-user-b');
    const resB = await POST(
      new Request('http://localhost:3000/api/results/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ id: sharedId, clientRunId: sharedId, mode: 'words', duration: 15, seed, telemetry }],
        }),
      })
    );
    expect(resB.status).toBe(200);
    const jsonB = (await resB.json()) as { syncedCount: number; syncedIds: string[] };
    expect(jsonB.syncedCount).toBe(1);
    expect(jsonB.syncedIds).toEqual([sharedId]);
    expect(mock.insertedResults).toHaveLength(2);
  });

  it('excludes invalid-duration batches from syncableCandidateCount quota and classifies invalidated/conflicting clientRunIds into rejectedIds', async () => {
    const seedValid = 'syncquotaok12';
    const seedConflict = 'syncconflict2';
    const validTelemetry = makeHumanTelemetry(generateText(seedValid, 'words', 15), 55, 130);
    const conflictTelemetry = makeHumanTelemetry(generateText(seedConflict, 'words', 15), 55, 130);
    const mock = createSyncMockSupabase({ userId: 'user-quota-inv' });
    createClientMock.mockResolvedValue(mock.supabase);

    // 4 batches x 30 invalid-duration (duration: 12) items = 120 items -> MUST NOT exhaust the 120-item quota
    for (let b = 0; b < 4; b += 1) {
      const badItems = Array.from({ length: 30 }, (_, i) => ({
        id: `bad-12s-${b}-${i}`,
        mode: 'words',
        duration: 12,
        seed: seedValid,
        telemetry: validTelemetry,
      }));
      const badRes = await POST(
        new Request('http://localhost:3000/api/results/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: badItems }),
        })
      );
      expect(badRes.status).toBe(400);
    }

    // 5th request with valid 30 items still passes quota cleanly (not 429)
    const validBatch = Array.from({ length: 10 }, (_, i) => ({
      id: `valid-after-bad-${i}`,
      clientRunId: `10101010-0000-4000-8000-00000000000${i}`,
      mode: 'words',
      duration: 15,
      seed: `batchseed${i}`,
      telemetry: makeHumanTelemetry(generateText(`batchseed${i}`, 'words', 15), 55, 130),
    }));
    const validRes = await POST(
      new Request('http://localhost:3000/api/results/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: validBatch }),
      })
    );
    expect(validRes.status).toBe(200);

    // Now test in-batch conflict + DB invalidated classification into rejectedIds (not failedIds)
    resetSyncRateLimitForTests();
    const invSeed = 'invdbseed1234';
    const invTelemetry = makeHumanTelemetry(generateText(invSeed, 'words', 15), 55, 130);
    const invRunId = '21212121-2121-4212-8212-212121212121';
    mock.insertedResults.push({
      id: 'res-sync-inv-db',
      user_id: 'user-quota-inv',
      mode: 'words',
      duration: 15,
      seed: invSeed,
      wpm: 60,
      raw_wpm: 62,
      accuracy: 98,
      consistency: 92,
      error_count: 0,
      backspace_count: 0,
      client_run_id: invRunId,
      is_invalidated: true,
      created_at: new Date().toISOString(),
    });

    const dupConflictingId = '31313131-3131-4313-8313-313131313131';
    const mixedRes = await POST(
      new Request('http://localhost:3000/api/results/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              id: dupConflictingId,
              clientRunId: dupConflictingId,
              mode: 'words',
              duration: 15,
              seed: seedValid,
              telemetry: validTelemetry,
            },
            {
              id: dupConflictingId,
              clientRunId: dupConflictingId,
              mode: 'words',
              duration: 15,
              seed: seedConflict,
              telemetry: conflictTelemetry,
            },
            {
              id: invRunId,
              clientRunId: invRunId,
              mode: 'words',
              duration: 15,
              seed: invSeed,
              telemetry: invTelemetry,
            },
          ],
        }),
      })
    );
    expect(mixedRes.status).toBe(200);
    const mixedJson = (await mixedRes.json()) as {
      syncedIds: string[];
      rejectedIds: string[];
      failedIds: string[];
    };
    expect(mixedJson.syncedIds).toEqual([dupConflictingId]);
    expect(mixedJson.rejectedIds).toEqual([dupConflictingId, invRunId]);
    expect(mixedJson.failedIds).toEqual([]);
  });

  it('fails closed with 503 ADMIN_CONFIG_MISSING in production when service-role key is missing', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    createAdminClientMock.mockReturnValue(null);

    const seed = 'syncprodfail1';
    const telemetry = makeHumanTelemetry(generateText(seed, 'words', 15), 55, 130);
    const mock = createSyncMockSupabase({ userId: 'user-sync-prod' });
    createClientMock.mockResolvedValue(mock.supabase);

    const res = await POST(
      new Request('http://localhost:3000/api/results/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              id: '41414141-4141-4414-8414-414141414141',
              clientRunId: '41414141-4141-4414-8414-414141414141',
              mode: 'words',
              duration: 15,
              seed,
              telemetry,
            },
          ],
        }),
      })
    );

    expect(res.status).toBe(503);
    const json = (await res.json()) as { code?: string };
    expect(json.code).toBe('ADMIN_CONFIG_MISSING');
    expect(mock.insertedResults).toHaveLength(0);
  });

  it('rejects cross-origin sync requests (403) and payloads over 2 MiB (413)', async () => {
    const crossOrigin = await POST(
      new Request('http://localhost:3000/api/results/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://evil.example',
        },
        body: JSON.stringify({ items: [] }),
      })
    );
    expect(crossOrigin.status).toBe(403);

    const mock = createSyncMockSupabase({ userId: 'user-sync-size' });
    createClientMock.mockResolvedValue(mock.supabase);

    const oversized = await POST(
      new Request('http://localhost:3000/api/results/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pad: 'b'.repeat(2_200_000) }),
      })
    );
    expect(oversized.status).toBe(413);
  });
});
