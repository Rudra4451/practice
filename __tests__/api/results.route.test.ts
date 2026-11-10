import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateText } from '@/lib/typing/text-generator';
import {
  resetRecentRunCacheForTests,
  resetRecoveryRateLimitForTests,
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

import { POST } from '@/app/api/results/route';

function makeHumanTelemetry(text: string, count: number, stepMs = 135) {
  let t = 0;
  return Array.from({ length: count }, (_, i) => {
    if (i > 0) t += stepMs + ((i % 5) * 6 - 12);
    return { t, k: text[i], y: 0 as const, i };
  });
}

interface MockResultRow {
  id: string;
  user_id: string;
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

function createResultsRouteSupabaseMock(options: {
  userId: string;
  clientRunIdSupported?: boolean;
  rateLimitLatestRow?: Record<string, unknown> | null;
  priorBestWpm?: number | null;
  priorResults?: MockResultRow[];
  failReplayInsertOnce?: boolean;
}) {
  let activeUserId = options.userId;
  const storedResults: MockResultRow[] = [...(options.priorResults ?? [])];
  if (options.priorBestWpm !== undefined && options.priorBestWpm !== null && storedResults.length === 0) {
    storedResults.push({
      id: 'res-prior-best',
      user_id: options.userId,
      wpm: options.priorBestWpm,
      raw_wpm: options.priorBestWpm,
      accuracy: 98,
      consistency: 92,
      error_count: 0,
      backspace_count: 0,
      mode: 'words',
      duration: 30,
      seed: 'priorseed',
      is_invalidated: false,
      created_at: new Date(Date.now() - 300_000).toISOString(),
    });
  }

  const insertedResults: MockResultRow[] = [];
  const storedReplays = new Map<string, unknown>();
  const streakUpdates: Record<string, unknown>[] = [];
  const streakState = {
    id: 'streak-1',
    current_streak: 0,
    longest_streak: 0,
    last_active_date: new Date().toISOString().split('T')[0],
  };
  const insertedAchievements: Record<string, unknown>[] = [];
  const clientRunIdSupported = options.clientRunIdSupported ?? true;
  let shouldFailReplayOnce = Boolean(options.failReplayInsertOnce);
  let rowSeq = 0;

  const supabase = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: activeUserId } },
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
                if (opts?.head && 'user_id' in filters && 'is_invalidated' in filters) {
                  const userCount = storedResults.filter(
                    (r) => r.user_id === filters.user_id && r.is_invalidated !== true
                  ).length;
                  return Promise.resolve({ count: Math.max(1, userCount), error: null });
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
                if ('seed' in filters && cols.includes('raw_wpm') && cols.includes('consistency')) {
                  const candidates = storedResults
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
                  return Promise.resolve({ data: candidates, error: null });
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
                  const match = storedResults.find(
                    (row) =>
                      row.user_id === filters.user_id &&
                      row.client_run_id === filters.client_run_id
                  );
                  return {
                    data: match ?? null,
                    error: null,
                  };
                }

                if (cols === 'wpm') {
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

                if (options.rateLimitLatestRow !== undefined) {
                  return {
                    data: options.rateLimitLatestRow,
                    error: null,
                  };
                }

                const latestForUser = storedResults
                  .filter((row) => row.user_id === filters.user_id && row.is_invalidated !== true)
                  .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];

                return {
                  data: latestForUser ?? null,
                  error: null,
                };
              }),
            };
            return chain;
          }),
          insert: vi.fn((payload: Record<string, unknown>) => {
            const hasClientRunId = 'client_run_id' in payload;
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => {
                  if (hasClientRunId && !clientRunIdSupported) {
                    return {
                      data: null,
                      error: { code: 'PGRST204', message: "Could not find 'client_run_id' column" },
                    };
                  }
                  rowSeq += 1;
                  const row: MockResultRow = {
                    id: `res-uuid-${rowSeq}`,
                    user_id: String(payload.user_id),
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
                    is_invalidated: false,
                    created_at: new Date().toISOString(),
                  };
                  insertedResults.push(row);
                  storedResults.push(row);
                  return {
                    data: row,
                    error: null,
                  };
                }),
              })),
            };
          }),
          delete: vi.fn(() => ({
            eq: vi.fn((_col: string, id: string) => ({
              select: vi.fn(async () => {
                const idx = storedResults.findIndex((r) => r.id === id);
                if (idx >= 0) storedResults.splice(idx, 1);
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
              if (shouldFailReplayOnce) {
                shouldFailReplayOnce = false;
                return { error: { code: '50000', message: 'simulated transient replay write error' } };
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
                  data: { ...streakState },
                  error: null,
                })),
              })),
            })),
            update: vi.fn((payload: Record<string, unknown>) => {
              streakUpdates.push(payload);
              Object.assign(streakState, payload);
              return { eq: vi.fn(async () => ({ error: null })) };
            }),
          };
        }

      if (table === 'user_achievements') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({ data: [], error: null })),
          })),
          insert: vi.fn(async (payload: Record<string, unknown>) => {
            insertedAchievements.push(payload);
            return { error: null };
          }),
        };
      }

      if (table === 'achievements') {
        return {
          select: vi.fn(async () => ({
            data: [
              {
                id: 'ach-speed-50',
                code: 'SPEED_50',
                name: 'Keyboard Apprentice',
                criteria: { type: 'speed', wpm: 50, accuracy: 90 },
              },
              {
                id: 'ach-streak-1',
                code: 'STREAK_1',
                name: 'First Flame',
                criteria: { type: 'streak', days: 1 },
              },
            ],
            error: null,
          })),
        };
      }

      return {};
    }),
  };

  return {
    supabase,
    storedResults,
    insertedResults,
    storedReplays,
    streakUpdates,
    insertedAchievements,
    setUserId: (nextUserId: string) => {
      activeUserId = nextUserId;
    },
  };
}

describe('POST /api/results', () => {
  beforeEach(() => {
    resetRecentRunCacheForTests();
    resetRecoveryRateLimitForTests();
    vi.stubEnv('NODE_ENV', 'test');
    createClientMock.mockReset();
    createAdminClientMock.mockReset();
    createAdminClientMock.mockReturnValue(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: null }, error: null })) },
    });

    const res = await POST(
      new Request('http://localhost:3000/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'words', duration: 30, seed: 'abc123', telemetry: [] }),
      })
    );

    expect(res.status).toBe(401);
  });

  it('rejects forged empty telemetry payload with 400', async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: 'user-123' } },
          error: null,
        })),
      },
    });

    const res = await POST(
      new Request('http://localhost:3000/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wpm: 350,
          mode: 'words',
          duration: 30,
          seed: 'forgedseed12',
          telemetry: [],
        }),
      })
    );

    expect(res.status).toBe(400);
  });

  it('ignores client-spoofed WPM, initializes Day-1 streak to 1, persists client_run_id, and deduplicates retries cleanly', async () => {
    const seed = 'realtest1234';
    const target = generateText(seed, 'words', 30);
    const telemetry = makeHumanTelemetry(target, 150, 125); // 60 WPM over 30s

    const mock = createResultsRouteSupabaseMock({
      userId: 'user-1',
      priorBestWpm: 55,
      clientRunIdSupported: true,
    });
    createClientMock.mockResolvedValue(mock.supabase);

    const clientRunId = '11111111-1111-4111-8111-111111111111';
    const res = await POST(
      new Request('http://localhost:3000/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wpm: 250, // Spoofed by attacker — MUST be ignored
          accuracy: 100,
          mode: 'words',
          duration: 30,
          seed,
          clientRunId,
          telemetry,
        }),
      })
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      result: { wpm: number; duration: number };
      isPersonalBest: boolean;
      previousBestWpm: number;
      streakDays: number;
      unlocked: string[];
    };

    expect(json.success).toBe(true);
    expect(mock.insertedResults[0].wpm).toBe(60); // Server derived, NOT 250
    expect(mock.insertedResults[0].client_run_id).toBe(clientRunId);
    expect(mock.insertedResults[0].duration).toBe(30);
    expect(mock.streakUpdates[0].current_streak).toBe(1);
    expect(json.streakDays).toBe(1);
    expect(json.previousBestWpm).toBe(55);
    expect(json.isPersonalBest).toBe(true);
    expect(json.unlocked).toContain('Keyboard Apprentice');
    expect(json.unlocked).toContain('First Flame');
    expect(mock.insertedAchievements).toHaveLength(2);

    // Retry with same clientRunId deduplicates cleanly without calling DB insert twice
    const retryRes = await POST(
      new Request('http://localhost:3000/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'words',
          duration: 30,
          seed,
          clientRunId,
          telemetry,
        }),
      })
    );
    expect(retryRes.status).toBe(200);
    const retryJson = (await retryRes.json()) as { deduplicated?: boolean };
    expect(retryJson.deduplicated).toBe(true);
    expect(mock.insertedResults).toHaveLength(1);
  });

  it('recovers missing replay, streak, achievements, and true PB on <45s retry after SSR partial write (both clientRunId and pre-migration PGRST204)', async () => {
    const seed = 'retryrecovery12';
    const target = generateText(seed, 'words', 30);
    const telemetry = makeHumanTelemetry(target, 150, 125); // 60 WPM

    // Case 1: schema supports client_run_id, SSR client cannot rollback orphan when replay write fails
    const mock = createResultsRouteSupabaseMock({
      userId: 'user-recover-sub45',
      priorBestWpm: 52,
      clientRunIdSupported: true,
      failReplayInsertOnce: true,
    });
    createClientMock.mockResolvedValue(mock.supabase);

    const runId = 'aaaaaaaa-1111-4111-8111-111111111111';
    const failedRes = await POST(
      new Request('http://localhost:3000/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'words',
          duration: 30,
          seed,
          clientRunId: runId,
          telemetry,
        }),
      })
    );

    expect(failedRes.status).toBe(500);
    const failJson = (await failedRes.json()) as { error: string; recoverable?: boolean };
    expect(failJson.recoverable).toBe(true);
    expect(mock.insertedResults).toHaveLength(1);
    expect(mock.storedReplays.size).toBe(0);

    // Retry within 45s MUST NOT short-circuit: recovers replay + streak + achievements + real PB
    const retryRes = await POST(
      new Request('http://localhost:3000/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'words',
          duration: 30,
          seed,
          clientRunId: runId,
          telemetry,
        }),
      })
    );

    expect(retryRes.status).toBe(200);
    const retryJson = (await retryRes.json()) as {
      deduplicated?: boolean;
      recoveredPartialWrite?: boolean;
      previousBestWpm: number | null;
      isPersonalBest: boolean;
      streakDays: number;
      unlocked: string[];
    };
    expect(retryJson.deduplicated).toBe(true);
    expect(retryJson.recoveredPartialWrite).toBe(true);
    expect(retryJson.previousBestWpm).toBe(52);
    expect(retryJson.isPersonalBest).toBe(true);
    expect(retryJson.streakDays).toBe(1);
    expect(retryJson.unlocked).toContain('Keyboard Apprentice');
    expect(mock.insertedResults).toHaveLength(1);
    expect(mock.storedReplays.size).toBe(1);

    // Case 2: pre-migration schema without client_run_id (PGRST204) also recovers <45s via signature
    const preMigSeed = 'premigrecover1';
    const preMigTarget = generateText(preMigSeed, 'words', 30);
    const preMigTelemetry = makeHumanTelemetry(preMigTarget, 150, 125);
    const preMigMock = createResultsRouteSupabaseMock({
      userId: 'user-recover-premig',
      priorBestWpm: 75,
      clientRunIdSupported: false,
      failReplayInsertOnce: true,
    });
    createClientMock.mockResolvedValue(preMigMock.supabase);

    const runIdPreMig = 'bbbbbbbb-2222-4222-8222-222222222222';
    const failPreMig = await POST(
      new Request('http://localhost:3000/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'words',
          duration: 30,
          seed: preMigSeed,
          clientRunId: runIdPreMig,
          telemetry: preMigTelemetry,
        }),
      })
    );
    expect(failPreMig.status).toBe(500);

    const recoverPreMig = await POST(
      new Request('http://localhost:3000/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'words',
          duration: 30,
          seed: preMigSeed,
          clientRunId: runIdPreMig,
          telemetry: preMigTelemetry,
        }),
      })
    );
    expect(recoverPreMig.status).toBe(200);
    const recoverJson = (await recoverPreMig.json()) as {
      deduplicated?: boolean;
      recoveredPartialWrite?: boolean;
      previousBestWpm: number | null;
      isPersonalBest: boolean;
      streakDays: number;
    };
    expect(recoverJson.deduplicated).toBe(true);
    expect(recoverJson.recoveredPartialWrite).toBe(true);
    expect(recoverJson.previousBestWpm).toBe(75);
    expect(recoverJson.isPersonalBest).toBe(false);
    expect(recoverJson.streakDays).toBe(1);
    expect(preMigMock.insertedResults).toHaveLength(1);
    expect(preMigMock.storedReplays.size).toBe(1);
  });

  it('deduplicates pre-migration retries >= 45s later via signature check without duplicate DB inserts', async () => {
    const seed = 'after45dedup12';
    const target = generateText(seed, 'words', 30);
    const telemetry = makeHumanTelemetry(target, 150, 125);

    const mock = createResultsRouteSupabaseMock({
      userId: 'user-after45',
      clientRunIdSupported: false,
    });
    createClientMock.mockResolvedValue(mock.supabase);

    const firstRes = await POST(
      new Request('http://localhost:3000/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'words',
          duration: 30,
          seed,
          clientRunId: 'cccccccc-3333-4333-8333-333333333333',
          telemetry,
        }),
      })
    );
    expect(firstRes.status).toBe(200);
    expect(mock.insertedResults).toHaveLength(1);

    // Simulate > 45 seconds elapsed + client cold retry (different clientRunId / cold recentRunCache)
    mock.storedResults[mock.storedResults.length - 1].created_at = new Date(
      Date.now() - 60_000
    ).toISOString();

    const lateRetry = await POST(
      new Request('http://localhost:3000/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'words',
          duration: 30,
          seed,
          clientRunId: 'dddddddd-4444-4444-8444-444444444444',
          telemetry,
        }),
      })
    );
    expect(lateRetry.status).toBe(200);
    const lateJson = (await lateRetry.json()) as { deduplicated?: boolean };
    expect(lateJson.deduplicated).toBe(true);
    expect(mock.insertedResults).toHaveLength(1);
  });

  it('persists canonical bracket duration on early text_complete and gracefully handles missing client_run_id column', async () => {
    const seed = 'earlycode1234';
    const target = generateText(seed, 'code', 15);
    const telemetry = makeHumanTelemetry(target, target.length, 55);

    const mock = createResultsRouteSupabaseMock({
      userId: 'user-early-code',
      clientRunIdSupported: false,
      priorBestWpm: null,
    });
    createClientMock.mockResolvedValue(mock.supabase);

    const res = await POST(
      new Request('http://localhost:3000/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'code',
          duration: 15,
          seed,
          clientRunId: '22222222-2222-4222-8222-222222222222',
          telemetry,
        }),
      })
    );

    expect(res.status).toBe(200);
    expect(mock.insertedResults).toHaveLength(1);
    expect(mock.insertedResults[0].duration).toBe(15);
    expect(mock.insertedResults[0].client_run_id).toBeUndefined();
  });

  it('isolates identical clientRunId cleanly per authenticated user', async () => {
    const seed = 'crossuser1234';
    const target = generateText(seed, 'words', 30);
    const telemetry = makeHumanTelemetry(target, 150, 125);
    const sharedClientRunId = 'eeeeeeee-5555-4555-8555-555555555555';

    const mock = createResultsRouteSupabaseMock({
      userId: 'user-alpha',
      clientRunIdSupported: true,
    });
    createClientMock.mockResolvedValue(mock.supabase);

    const resA = await POST(
      new Request('http://localhost:3000/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'words',
          duration: 30,
          seed,
          clientRunId: sharedClientRunId,
          telemetry,
        }),
      })
    );
    expect(resA.status).toBe(200);

    mock.setUserId('user-beta');
    const resB = await POST(
      new Request('http://localhost:3000/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'words',
          duration: 30,
          seed,
          clientRunId: sharedClientRunId,
          telemetry,
        }),
      })
    );
    expect(resB.status).toBe(200);
    const jsonB = (await resB.json()) as {
      deduplicated?: boolean;
      result: { user_id: string };
    };
    expect(jsonB.deduplicated).toBeUndefined();
    expect(jsonB.result.user_id).toBe('user-beta');
    expect(mock.insertedResults).toHaveLength(2);
  });

  it('enforces cooldown 429 on rapid distinct submissions', async () => {
    const seed = 'rapidseed123';
    const target = generateText(seed, 'words', 15);
    const telemetry = makeHumanTelemetry(target, 50, 140);

    const mock = createResultsRouteSupabaseMock({
      userId: 'user-rapid',
      rateLimitLatestRow: {
        id: 'prev-1',
        seed: 'different_seed',
        mode: 'words',
        duration: 15,
        wpm: 80,
        raw_wpm: 80,
        accuracy: 98,
        consistency: 90,
        error_count: 0,
        backspace_count: 0,
        created_at: new Date(Date.now() - 1000).toISOString(),
      },
    });
    createClientMock.mockResolvedValue(mock.supabase);

    const res = await POST(
      new Request('http://localhost:3000/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'words', duration: 15, seed, telemetry }),
      })
    );

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });

  it('recovers Run A even after a newer Run B completed within 8s, while bounding recovery attempts with 429', async () => {
    const seedA = 'recoverrunA12';
    const seedB = 'newerrunB1234';
    const telemetryA = makeHumanTelemetry(generateText(seedA, 'words', 15), 55, 130);
    const telemetryB = makeHumanTelemetry(generateText(seedB, 'words', 15), 55, 135);
    const runIdA = '12121212-1212-4121-8121-121212121212';
    const runIdB = '34343434-3434-4343-8343-343434343434';

    const mock = createResultsRouteSupabaseMock({
      userId: 'user-interleaved-recovery',
      clientRunIdSupported: true,
      failReplayInsertOnce: true,
    });
    createClientMock.mockResolvedValue(mock.supabase);

    // Run A creates test_results row and fails replay insert -> recoverable 500
    const failA = await POST(
      new Request('http://localhost:3000/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'words',
          duration: 15,
          seed: seedA,
          clientRunId: runIdA,
          telemetry: telemetryA,
        }),
      })
    );
    expect(failA.status).toBe(500);

    // Age Run A's timestamp past 8s cooldown so Run B can submit cleanly and become latestRow
    mock.storedResults[mock.storedResults.length - 1].created_at = new Date(
      Date.now() - 12_000
    ).toISOString();

    const okB = await POST(
      new Request('http://localhost:3000/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'words',
          duration: 15,
          seed: seedB,
          clientRunId: runIdB,
          telemetry: telemetryB,
        }),
      })
    );
    expect(okB.status).toBe(200);

    // Immediately retry Run A (<1s after Run B!) -> must NOT be blocked by Run B's 8s latestRow cooldown
    const recoverA = await POST(
      new Request('http://localhost:3000/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'words',
          duration: 15,
          seed: seedA,
          clientRunId: runIdA,
          telemetry: telemetryA,
        }),
      })
    );
    expect(recoverA.status).toBe(200);
    const recoverJson = (await recoverA.json()) as {
      deduplicated?: boolean;
      recoveredPartialWrite?: boolean;
    };
    expect(recoverJson.deduplicated).toBe(true);
    expect(recoverJson.recoveredPartialWrite).toBe(true);

    // Spamming same Run A recovery past the bounded per-run budget hits 429 + Retry-After
    let limitedStatus = 200;
    let retryHeader: string | null = null;
    for (let i = 0; i < 8; i += 1) {
      const spamRes = await POST(
        new Request('http://localhost:3000/api/results', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'words',
            duration: 15,
            seed: seedA,
            clientRunId: runIdA,
            telemetry: telemetryA,
          }),
        })
      );
      if (spamRes.status === 429) {
        limitedStatus = spamRes.status;
        retryHeader = spamRes.headers.get('Retry-After');
        break;
      }
    }
    expect(limitedStatus).toBe(429);
    expect(retryHeader).toBeTruthy();
  });

  it('returns empty unlocked, recoveredPartialWrite=false, and zero extra streak mutations on both hot and cold duplicate retries', async () => {
    const seed = 'colddupretry1';
    const telemetry = makeHumanTelemetry(generateText(seed, 'words', 30), 150, 125);
    const runId = '56565656-5656-4565-8565-565656565656';

    const mock = createResultsRouteSupabaseMock({
      userId: 'user-cold-dup',
      clientRunIdSupported: true,
    });
    createClientMock.mockResolvedValue(mock.supabase);

    const first = await POST(
      new Request('http://localhost:3000/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'words',
          duration: 30,
          seed,
          clientRunId: runId,
          telemetry,
        }),
      })
    );
    expect(first.status).toBe(200);
    expect(mock.streakUpdates).toHaveLength(1);

    // Hot cache retry
    const hotRetry = await POST(
      new Request('http://localhost:3000/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'words',
          duration: 30,
          seed,
          clientRunId: runId,
          telemetry,
        }),
      })
    );
    expect(hotRetry.status).toBe(200);
    const hotJson = (await hotRetry.json()) as {
      deduplicated?: boolean;
      recoveredPartialWrite?: boolean;
      unlocked: string[];
    };
    expect(hotJson.deduplicated).toBe(true);
    expect(hotJson.recoveredPartialWrite).toBe(false);
    expect(hotJson.unlocked).toEqual([]);

    // Cold cache-miss retry across instances
    resetRecentRunCacheForTests();
    const coldRetry = await POST(
      new Request('http://localhost:3000/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'words',
          duration: 30,
          seed,
          clientRunId: runId,
          telemetry,
        }),
      })
    );
    expect(coldRetry.status).toBe(200);
    const coldJson = (await coldRetry.json()) as {
      deduplicated?: boolean;
      recoveredPartialWrite?: boolean;
      unlocked: string[];
    };
    expect(coldJson.deduplicated).toBe(true);
    expect(coldJson.recoveredPartialWrite).toBe(false);
    expect(coldJson.unlocked).toEqual([]);
    expect(mock.streakUpdates).toHaveLength(1);
  });

  it('rejects conflicting clientRunId payload with 409 and rejects invalidated runs even when cached', async () => {
    const seed = 'conflictinv12';
    const target = generateText(seed, 'words', 15);
    const telemetry = makeHumanTelemetry(target, 55, 130);
    const runId = '78787878-7878-4787-8787-787878787878';

    const mock = createResultsRouteSupabaseMock({
      userId: 'user-conflict-inv',
      clientRunIdSupported: true,
    });
    createClientMock.mockResolvedValue(mock.supabase);

    const first = await POST(
      new Request('http://localhost:3000/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'words',
          duration: 15,
          seed,
          clientRunId: runId,
          telemetry,
        }),
      })
    );
    expect(first.status).toBe(200);

    // Different seed reusing same clientRunId -> 409 CLIENT_RUN_ID_CONFLICT
    const otherSeed = 'differentseed9';
    const otherTelemetry = makeHumanTelemetry(generateText(otherSeed, 'words', 15), 55, 130);
    const conflictRes = await POST(
      new Request('http://localhost:3000/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'words',
          duration: 15,
          seed: otherSeed,
          clientRunId: runId,
          telemetry: otherTelemetry,
        }),
      })
    );
    expect(conflictRes.status).toBe(409);
    const conflictJson = (await conflictRes.json()) as { code?: string };
    expect(conflictJson.code).toBe('CLIENT_RUN_ID_CONFLICT');

    // Invalidate stored result in DB, then replay exact original payload -> 409 RESULT_INVALIDATED despite warm cache
    mock.storedResults[mock.storedResults.length - 1].is_invalidated = true;
    const invRes = await POST(
      new Request('http://localhost:3000/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'words',
          duration: 15,
          seed,
          clientRunId: runId,
          telemetry,
        }),
      })
    );
    expect(invRes.status).toBe(409);
    const invJson = (await invRes.json()) as { code?: string };
    expect(invJson.code).toBe('RESULT_INVALIDATED');
  });

  it('fails closed with 503 ADMIN_CONFIG_MISSING in production when service-role key is missing', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    createAdminClientMock.mockReturnValue(null);

    const seed = 'prodfailclose';
    const telemetry = makeHumanTelemetry(generateText(seed, 'words', 15), 55, 130);
    const mock = createResultsRouteSupabaseMock({ userId: 'user-prod' });
    createClientMock.mockResolvedValue(mock.supabase);

    const res = await POST(
      new Request('http://localhost:3000/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'words',
          duration: 15,
          seed,
          telemetry,
        }),
      })
    );

    expect(res.status).toBe(503);
    const json = (await res.json()) as { code?: string };
    expect(json.code).toBe('ADMIN_CONFIG_MISSING');
    expect(mock.insertedResults).toHaveLength(0);
  });

  it('rejects cross-origin POST (403) and oversized payload bodies (413)', async () => {
    const crossOrigin = await POST(
      new Request('http://localhost:3000/api/results', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://evil.example',
        },
        body: JSON.stringify({}),
      })
    );
    expect(crossOrigin.status).toBe(403);

    const mock = createResultsRouteSupabaseMock({ userId: 'user-size' });
    createClientMock.mockResolvedValue(mock.supabase);

    const oversized = await POST(
      new Request('http://localhost:3000/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pad: 'a'.repeat(530 * 1024) }),
      })
    );
    expect(oversized.status).toBe(413);
  });
});
