import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_GUEST_SYNC_RETRIES,
  useUserStore,
  type GuestResult,
} from '@/stores/user-store';
import {
  getHeldRejectedGuestRunsCount,
  getInvalidDurationGuestRunsCount,
  getSyncableGuestRunsCount,
  isSyncableGuestResult,
  syncGuestHistoryBatches,
} from '@/lib/typing/sync-client';

function makeGuestRun(index: number, overrides?: Partial<GuestResult>): GuestResult {
  const numHex = index.toString(16).padStart(12, '0');
  const uuid = `00000000-0000-4000-8000-${numHex}`;
  return {
    id: uuid,
    clientRunId: uuid,
    wpm: 75,
    raw_wpm: 80,
    accuracy: 96,
    consistency: 89,
    error_count: 1,
    backspace_count: 1,
    mode: 'words',
    duration: 30,
    seed: `seed_${index}`,
    isRanked: true,
    telemetry: [
      { t: 0, k: 'a', y: 0, i: 0 },
      { t: 140, k: 'b', y: 0, i: 1 },
    ],
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('Guest history telemetry retention, chunked sync (>30), non-looping rejections, and transient failure handling', () => {
  beforeEach(() => {
    useUserStore.setState({
      session: null,
      profile: null,
      guestHistory: [],
      lessonProgress: {},
      dailyCompletions: {},
    });
  });

  it('retains telemetry on >30 guest runs and chunks sequential sync requests safely', async () => {
    for (let i = 1; i <= 65; i += 1) {
      useUserStore.getState().addGuestResult(makeGuestRun(i));
    }
    const unrankedDrill = makeGuestRun(999, { mode: 'drill', isRanked: false });
    const legacyNoTelemetry = makeGuestRun(998, { telemetry: undefined });
    useUserStore.getState().addGuestResult(unrankedDrill);
    useUserStore.getState().addGuestResult(legacyNoTelemetry);

    const history = useUserStore.getState().guestHistory;
    expect(history).toHaveLength(67);
    expect(
      history.every((item) => item.id === legacyNoTelemetry.id || Boolean(item.telemetry?.length))
    ).toBe(true);
    expect(getSyncableGuestRunsCount(history)).toBe(65);

    const chunkLengths: number[] = [];
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const parsed = JSON.parse(String(init?.body)) as {
        items: Array<{ clientRunId?: string; id?: string }>;
      };
      chunkLengths.push(parsed.items.length);
      const ids = parsed.items.map((item) => item.clientRunId ?? item.id ?? '');
      return new Response(
        JSON.stringify({
          success: true,
          syncedCount: ids.length,
          duplicateCount: 0,
          skippedLegacyCount: 0,
          skippedUnrankedCount: 0,
          rejectedCount: 0,
          failedCount: 0,
          syncedIds: ids,
          duplicateIds: [],
          skippedLegacyIds: [],
          skippedUnrankedIds: [],
          rejectedIds: [],
          failedIds: [],
          unlocked: ['Bronze Fingers'],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const summary = await syncGuestHistoryBatches(useUserStore.getState().guestHistory, {
      removePersistedIds: (ids) => useUserStore.getState().removeGuestResults(ids),
      markRejectedIds: (ids, reasons) =>
        useUserStore.getState().markGuestResultsRejected(ids, reasons),
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(chunkLengths).toEqual([30, 30, 5]);
    expect(summary.batchesAttempted).toBe(3);
    expect(summary.syncedCount).toBe(65);
    expect(summary.skippedUnrankedCount).toBe(1);
    expect(summary.skippedLegacyCount).toBe(1);
    expect(summary.interrupted).toBe(false);
    expect(summary.failureCategory).toBe('none');

    const remainingIds = useUserStore.getState().guestHistory.map((item) => item.id);
    expect(remainingIds).toHaveLength(2);
    expect(remainingIds).toContain(unrankedDrill.id);
    expect(remainingIds).toContain(legacyNoTelemetry.id);
  });

  it('excludes legacy invalid-duration guest runs from auto-sync without deleting data or telemetry', async () => {
    const legacy12s = makeGuestRun(101, { duration: 12 });
    const legacy45s = makeGuestRun(102, { duration: 45 });
    const legacy0s = makeGuestRun(103, { duration: 0 });
    useUserStore.getState().addGuestResult(legacy12s);
    useUserStore.getState().addGuestResult(legacy45s);
    useUserStore.getState().addGuestResult(legacy0s);

    const history = useUserStore.getState().guestHistory;
    expect(isSyncableGuestResult(legacy12s)).toBe(false);
    expect(getSyncableGuestRunsCount(history)).toBe(0);
    expect(getInvalidDurationGuestRunsCount(history)).toBe(3);

    const fetchMock = vi.fn();
    const summary = await syncGuestHistoryBatches(history, {
      removePersistedIds: (ids) => useUserStore.getState().removeGuestResults(ids),
      markRejectedIds: (ids, reasons) =>
        useUserStore.getState().markGuestResultsRejected(ids, reasons),
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(summary.batchesAttempted).toBe(0);
    expect(summary.skippedInvalidDurationCount).toBe(3);
    expect(useUserStore.getState().guestHistory).toHaveLength(3);
    expect(
      useUserStore.getState().guestHistory.every((item) => (item.telemetry?.length ?? 0) > 0)
    ).toBe(true);
  });

  it('halts infinite retry loops on rejectedIds and outer HTTP 400 while preserving telemetry and supporting explicit Retry Held Runs', async () => {
    const goodRun1 = makeGuestRun(1);
    const badRun = makeGuestRun(2);
    const goodRun2 = makeGuestRun(3);
    useUserStore.getState().addGuestResult(goodRun1);
    useUserStore.getState().addGuestResult(badRun);
    useUserStore.getState().addGuestResult(goodRun2);

    // Mixed 200: 2 synced, 1 rejected
    const mixedFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          success: true,
          syncedCount: 2,
          rejectedCount: 1,
          failedCount: 0,
          syncedIds: [goodRun1.clientRunId, goodRun2.clientRunId],
          rejectedIds: [badRun.clientRunId],
          rejectedReasons: {
            [String(badRun.clientRunId)]: 'Keystroke cadence failed verification.',
          },
          failedIds: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const firstSummary = await syncGuestHistoryBatches(useUserStore.getState().guestHistory, {
      removePersistedIds: (ids) => useUserStore.getState().removeGuestResults(ids),
      markRejectedIds: (ids, reasons) =>
        useUserStore.getState().markGuestResultsRejected(ids, reasons),
      fetchImpl: mixedFetch as unknown as typeof fetch,
    });

    expect(firstSummary.syncedCount).toBe(2);
    expect(firstSummary.rejectedCount).toBe(1);
    expect(firstSummary.failureCategory).toBe('permanent_rejected');
    expect(firstSummary.interrupted).toBe(false);

    const heldHistory = useUserStore.getState().guestHistory;
    expect(heldHistory).toHaveLength(1);
    expect(heldHistory[0].syncStatus).toBe('rejected');
    expect(heldHistory[0].syncRejectionReason).toBe('Keystroke cadence failed verification.');
    expect(heldHistory[0].telemetry).toHaveLength(2);
    expect(getSyncableGuestRunsCount(heldHistory)).toBe(0);
    expect(getHeldRejectedGuestRunsCount(heldHistory)).toBe(1);

    // Repeating sync must NOT hit network again (zero loop)
    const noopFetch = vi.fn();
    const secondSummary = await syncGuestHistoryBatches(heldHistory, {
      removePersistedIds: (ids) => useUserStore.getState().removeGuestResults(ids),
      markRejectedIds: (ids, reasons) =>
        useUserStore.getState().markGuestResultsRejected(ids, reasons),
      fetchImpl: noopFetch as unknown as typeof fetch,
    });
    expect(noopFetch).not.toHaveBeenCalled();
    expect(secondSummary.heldRejectedCount).toBe(1);

    // Explicit Retry Held Runs re-enables sync eligibility cleanly
    useUserStore.getState().retryRejectedGuestResults();
    expect(getSyncableGuestRunsCount(useUserStore.getState().guestHistory)).toBe(1);
    expect(getHeldRejectedGuestRunsCount(useUserStore.getState().guestHistory)).toBe(0);

    // Outer HTTP 400 rejection also marks item held and stops cleanly
    const http400Fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: 'Submitted runs failed verification.',
          rejectedCount: 1,
          rejectedIds: [badRun.clientRunId],
          rejectedReasons: { [String(badRun.clientRunId)]: 'Invalid seed.' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const http400Summary = await syncGuestHistoryBatches(useUserStore.getState().guestHistory, {
      removePersistedIds: (ids) => useUserStore.getState().removeGuestResults(ids),
      markRejectedIds: (ids, reasons) =>
        useUserStore.getState().markGuestResultsRejected(ids, reasons),
      fetchImpl: http400Fetch as unknown as typeof fetch,
    });

    expect(http400Summary.interrupted).toBe(true);
    expect(http400Summary.temporaryFailure).toBe(false);
    expect(http400Summary.failureCategory).toBe('permanent_rejected');
    expect(getSyncableGuestRunsCount(useUserStore.getState().guestHistory)).toBe(0);
    expect(getHeldRejectedGuestRunsCount(useUserStore.getState().guestHistory)).toBe(1);
  });

  it('handles actual HTTP 429, 207 partial failure, 500 server error, and network errors without deleting or permanently rejecting pending runs', async () => {
    for (let i = 1; i <= 40; i += 1) {
      useUserStore.getState().addGuestResult(makeGuestRun(i));
    }

    let callNum = 0;
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      callNum += 1;
      const parsed = JSON.parse(String(init?.body)) as {
        items: Array<{ clientRunId?: string; id?: string }>;
      };
      const ids = parsed.items.map((item) => item.clientRunId ?? item.id ?? '');

      if (callNum === 1) {
        return new Response(
          JSON.stringify({
            success: true,
            syncedCount: ids.length,
            syncedIds: ids,
            duplicateIds: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (callNum === 2) {
        // Explicit HTTP 429 rate-limit response with Retry-After header
        return new Response(
          JSON.stringify({
            error: 'Sync rate limit exceeded. Please wait 45s before retrying.',
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '45',
            },
          }
        );
      }

      if (callNum === 3) {
        // HTTP 207 partial failure: 4 succeed, 6 fail transiently
        const succeeded = ids.slice(0, 4);
        const failed = ids.slice(4);
        return new Response(
          JSON.stringify({
            success: false,
            partialFailure: true,
            error: 'Some guest runs failed to persist cleanly.',
            syncedCount: succeeded.length,
            failedCount: failed.length,
            syncedIds: succeeded,
            duplicateIds: [],
            failedIds: failed,
          }),
          { status: 207, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (callNum === 4) {
        // HTTP 500 transient DB outage
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to persist guest runs cleanly.',
            failedCount: ids.length,
            failedIds: ids,
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (callNum === 5) {
        throw new TypeError('Failed to fetch');
      }

      // Call 6: final recovery succeeds
      return new Response(
        JSON.stringify({
          success: true,
          syncedCount: ids.length,
          syncedIds: ids,
          duplicateIds: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const opts = {
      removePersistedIds: (ids: string[]) => useUserStore.getState().removeGuestResults(ids),
      markRejectedIds: (ids: string[], reasons?: Record<string, string>) =>
        useUserStore.getState().markGuestResultsRejected(ids, reasons),
      fetchImpl: fetchMock as unknown as typeof fetch,
    };

    // Call 1 (30 synced) + Call 2 (429 hit) -> 10 remain pending
    const rateLimited = await syncGuestHistoryBatches(useUserStore.getState().guestHistory, opts);
    expect(rateLimited.interrupted).toBe(true);
    expect(rateLimited.temporaryFailure).toBe(true);
    expect(rateLimited.failureCategory).toBe('rate_limited');
    expect(rateLimited.retryAfterSeconds).toBe(45);
    expect(rateLimited.syncedCount).toBe(30);
    expect(useUserStore.getState().guestHistory).toHaveLength(10);
    expect(getHeldRejectedGuestRunsCount(useUserStore.getState().guestHistory)).toBe(0);

    // Call 3 (207 partial: 4 synced, 6 failed) -> 6 remain pending
    const partial = await syncGuestHistoryBatches(useUserStore.getState().guestHistory, opts);
    expect(partial.interrupted).toBe(true);
    expect(partial.temporaryFailure).toBe(true);
    expect(partial.failureCategory).toBe('partial_failure');
    expect(partial.syncedCount).toBe(4);
    expect(partial.failedCount).toBe(6);
    expect(useUserStore.getState().guestHistory).toHaveLength(6);
    expect(getHeldRejectedGuestRunsCount(useUserStore.getState().guestHistory)).toBe(0);

    // Call 4 (500 server error) -> 6 remain pending cleanly
    const serverErr = await syncGuestHistoryBatches(useUserStore.getState().guestHistory, opts);
    expect(serverErr.interrupted).toBe(true);
    expect(serverErr.temporaryFailure).toBe(true);
    expect(serverErr.failureCategory).toBe('server_error');
    expect(useUserStore.getState().guestHistory).toHaveLength(6);
    expect(getHeldRejectedGuestRunsCount(useUserStore.getState().guestHistory)).toBe(0);

    // Call 5 (network exception) -> 6 remain pending cleanly
    const netErr = await syncGuestHistoryBatches(useUserStore.getState().guestHistory, opts);
    expect(netErr.interrupted).toBe(true);
    expect(netErr.temporaryFailure).toBe(true);
    expect(netErr.failureCategory).toBe('network_error');
    expect(netErr.errorMessage).toBe('Failed to fetch');
    expect(useUserStore.getState().guestHistory).toHaveLength(6);
    expect(getHeldRejectedGuestRunsCount(useUserStore.getState().guestHistory)).toBe(0);

    // Call 6 (recovery) -> all remaining 6 synced cleanly
    const finalOk = await syncGuestHistoryBatches(useUserStore.getState().guestHistory, opts);
    expect(finalOk.interrupted).toBe(false);
    expect(finalOk.temporaryFailure).toBe(false);
    expect(finalOk.failureCategory).toBe('none');
    expect(finalOk.syncedCount).toBe(6);
    expect(useUserStore.getState().guestHistory).toHaveLength(0);
  });

  it('auto-holds pending runs after MAX_GUEST_SYNC_RETRIES transient failures, supports markGuestResultsSynced/Held, honors maxBatches, and handles HTTP 409', async () => {
    const flaky = makeGuestRun(501);
    const alreadySynced = makeGuestRun(502, { syncStatus: 'synced' });
    const explicitlyHeld = makeGuestRun(503);
    useUserStore.getState().addGuestResult(flaky);
    useUserStore.getState().addGuestResult(alreadySynced);
    useUserStore.getState().addGuestResult(explicitlyHeld);

    expect(MAX_GUEST_SYNC_RETRIES).toBe(3);
    expect(getSyncableGuestRunsCount(useUserStore.getState().guestHistory)).toBe(2);

    // markGuestResultsHeld transitions item to 'held' cleanly
    useUserStore.getState().markGuestResultsHeld([String(explicitlyHeld.clientRunId)], {
      [String(explicitlyHeld.clientRunId)]: 'Manually paused.',
    });
    expect(getSyncableGuestRunsCount(useUserStore.getState().guestHistory)).toBe(1);
    expect(getHeldRejectedGuestRunsCount(useUserStore.getState().guestHistory)).toBe(1);

    // 3 consecutive transient failures move flaky from 'pending' -> 'held' while keeping telemetry
    const fetch500 = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'Upstream DB busy' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const opts = {
      removePersistedIds: (ids: string[]) => useUserStore.getState().removeGuestResults(ids),
      markRejectedIds: (ids: string[], reasons?: Record<string, string>) =>
        useUserStore.getState().markGuestResultsRejected(ids, reasons),
      recordTransientFailureIds: (ids: string[], reason?: string) =>
        useUserStore.getState().recordGuestSyncFailures(ids, reason),
      fetchImpl: fetch500 as unknown as typeof fetch,
    };

    await syncGuestHistoryBatches(useUserStore.getState().guestHistory, opts);
    expect(useUserStore.getState().guestHistory.find((r) => r.id === flaky.id)?.syncStatus).toBe('pending');
    expect(useUserStore.getState().guestHistory.find((r) => r.id === flaky.id)?.syncAttemptCount).toBe(1);

    await syncGuestHistoryBatches(useUserStore.getState().guestHistory, opts);
    expect(useUserStore.getState().guestHistory.find((r) => r.id === flaky.id)?.syncAttemptCount).toBe(2);

    await syncGuestHistoryBatches(useUserStore.getState().guestHistory, opts);
    const heldAfter3 = useUserStore.getState().guestHistory.find((r) => r.id === flaky.id);
    expect(heldAfter3?.syncStatus).toBe('held');
    expect(heldAfter3?.syncAttemptCount).toBe(3);
    expect(heldAfter3?.syncRejectionReason).toBe('Upstream DB busy');
    expect(heldAfter3?.telemetry).toHaveLength(2);
    expect(getSyncableGuestRunsCount(useUserStore.getState().guestHistory)).toBe(0);
    expect(getHeldRejectedGuestRunsCount(useUserStore.getState().guestHistory)).toBe(2);

    // retryRejectedGuestResults resets both 'held' items back to 'pending'
    useUserStore.getState().retryRejectedGuestResults();
    expect(getSyncableGuestRunsCount(useUserStore.getState().guestHistory)).toBe(2);
    expect(getHeldRejectedGuestRunsCount(useUserStore.getState().guestHistory)).toBe(0);

    // markGuestResultsSynced marks completed run 'synced' and excludes from syncable count
    useUserStore.getState().markGuestResultsSynced([String(explicitlyHeld.clientRunId)]);
    expect(useUserStore.getState().guestHistory.find((r) => r.id === explicitlyHeld.id)?.syncStatus).toBe('synced');
    expect(getSyncableGuestRunsCount(useUserStore.getState().guestHistory)).toBe(1);

    // HTTP 409 conflict marks remaining pending run 'rejected' without retrying loop
    const fetch409 = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: 'Run was invalidated.',
          code: 'RESULT_INVALIDATED',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      )
    );
    const conflictSummary = await syncGuestHistoryBatches(useUserStore.getState().guestHistory, {
      ...opts,
      fetchImpl: fetch409 as unknown as typeof fetch,
    });
    expect(conflictSummary.interrupted).toBe(true);
    expect(conflictSummary.temporaryFailure).toBe(false);
    expect(conflictSummary.failureCategory).toBe('permanent_rejected');
    expect(useUserStore.getState().guestHistory.find((r) => r.id === flaky.id)?.syncStatus).toBe('rejected');

    // maxBatches cap protects large histories against runaway sync loops
    useUserStore.setState({ guestHistory: [] });
    for (let i = 1; i <= 65; i += 1) {
      useUserStore.getState().addGuestResult(makeGuestRun(i));
    }
    const cappedFetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const parsed = JSON.parse(String(init?.body)) as { items: Array<{ clientRunId?: string; id?: string }> };
      const ids = parsed.items.map((item) => item.clientRunId ?? item.id ?? '');
      return new Response(
        JSON.stringify({
          success: true,
          syncedCount: ids.length,
          syncedIds: ids,
          duplicateIds: [],
          rejectedIds: [],
          failedIds: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const cappedSummary = await syncGuestHistoryBatches(useUserStore.getState().guestHistory, {
      removePersistedIds: (ids) => useUserStore.getState().removeGuestResults(ids),
      fetchImpl: cappedFetch as unknown as typeof fetch,
      maxBatches: 2,
    });
    expect(cappedSummary.batchesAttempted).toBe(2);
    expect(cappedSummary.syncedCount).toBe(60);
    expect(cappedSummary.interrupted).toBe(true);
    expect(cappedSummary.failureCategory).toBe('partial_failure');
    expect(useUserStore.getState().guestHistory).toHaveLength(5);
  });
});
