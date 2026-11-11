import { isRankedMode, isValidDuration } from '@/lib/typing/metrics';
import type { GuestResult } from '@/stores/user-store';

export const MAX_SYNC_BATCH_SIZE = 30;
export const SYNC_CHUNK_SIZE = MAX_SYNC_BATCH_SIZE;
export const DEFAULT_MAX_SYNC_BATCHES = 10;

export type SyncFailureCategory =
  | 'none'
  | 'permanent_rejected'
  | 'rate_limited'
  | 'partial_failure'
  | 'server_error'
  | 'network_error';

export interface SyncApiResponseBody {
  success?: boolean;
  partialFailure?: boolean;
  error?: string;
  syncedCount?: number;
  duplicateCount?: number;
  skippedLegacyCount?: number;
  skippedUnrankedCount?: number;
  rejectedCount?: number;
  failedCount?: number;
  syncedIds?: string[];
  duplicateIds?: string[];
  skippedLegacyIds?: string[];
  skippedUnrankedIds?: string[];
  rejectedIds?: string[];
  rejectedReasons?: Record<string, string>;
  failedIds?: string[];
  unlocked?: string[];
}

export interface SyncGuestHistorySummary {
  syncedCount: number;
  duplicateCount: number;
  skippedLegacyCount: number;
  skippedUnrankedCount: number;
  skippedInvalidDurationCount: number;
  heldRejectedCount: number;
  rejectedCount: number;
  failedCount: number;
  rejectedIds: string[];
  failedIds: string[];
  unlocked: string[];
  batchesAttempted: number;
  interrupted: boolean;
  temporaryFailure: boolean;
  failureCategory: SyncFailureCategory;
  retryAfterSeconds: number | null;
  errorMessage: string | null;
}

export function isSyncableGuestResult(item: GuestResult): boolean {
  const status = item.syncStatus ?? 'pending';
  return (
    status === 'pending' &&
    item.isRanked !== false &&
    isRankedMode(item.mode) &&
    isValidDuration(item.duration) &&
    Array.isArray(item.telemetry) &&
    item.telemetry.length > 0
  );
}

export function getSyncableGuestRunsCount(history: GuestResult[]): number {
  let count = 0;
  for (const item of history) {
    if (isSyncableGuestResult(item)) count += 1;
  }
  return count;
}

export function getHeldRejectedGuestRunsCount(history: GuestResult[]): number {
  let count = 0;
  for (const item of history) {
    if (item.syncStatus === 'rejected' || item.syncStatus === 'held') count += 1;
  }
  return count;
}

export function getInvalidDurationGuestRunsCount(history: GuestResult[]): number {
  let count = 0;
  for (const item of history) {
    const status = item.syncStatus ?? 'pending';
    if (
      status === 'pending' &&
      item.isRanked !== false &&
      isRankedMode(item.mode) &&
      Array.isArray(item.telemetry) &&
      item.telemetry.length > 0 &&
      !isValidDuration(item.duration)
    ) {
      count += 1;
    }
  }
  return count;
}

export async function syncGuestHistoryBatches(
  guestHistory: GuestResult[],
  options: {
    removePersistedIds: (ids: string[]) => void;
    markRejectedIds?: (ids: string[], reasons?: Record<string, string>) => void;
    markHeldIds?: (ids: string[], reasons?: Record<string, string>) => void;
    recordTransientFailureIds?: (ids: string[], reason?: string) => void;
    fetchImpl?: typeof fetch;
    batchSize?: number;
    maxBatches?: number;
  }
): Promise<SyncGuestHistorySummary> {
  const fetchFn = options.fetchImpl ?? fetch;
  const chunkSize = Math.max(1, Math.min(SYNC_CHUNK_SIZE, options.batchSize ?? SYNC_CHUNK_SIZE));
  const maxBatches = Math.max(1, options.maxBatches ?? DEFAULT_MAX_SYNC_BATCHES);

  const syncable: GuestResult[] = [];
  let skippedLegacyCount = 0;
  let skippedUnrankedCount = 0;
  let skippedInvalidDurationCount = 0;
  let heldRejectedCount = 0;

  for (const item of guestHistory) {
    const status = item.syncStatus ?? 'pending';
    if (status === 'synced') {
      continue;
    }
    if (status === 'rejected' || status === 'held') {
      heldRejectedCount += 1;
    } else if (item.isRanked === false || !isRankedMode(item.mode)) {
      skippedUnrankedCount += 1;
    } else if (!Array.isArray(item.telemetry) || item.telemetry.length === 0) {
      skippedLegacyCount += 1;
    } else if (!isValidDuration(item.duration)) {
      skippedInvalidDurationCount += 1;
    } else {
      syncable.push(item);
    }
  }

  let syncedCount = 0;
  let duplicateCount = 0;
  let rejectedCount = 0;
  let failedCount = 0;
  let batchesAttempted = 0;
  let interrupted = false;
  let temporaryFailure = false;
  let failureCategory: SyncFailureCategory = 'none';
  let retryAfterSeconds: number | null = null;
  let errorMessage: string | null = null;
  const rejectedIds: string[] = [];
  const failedIds: string[] = [];
  const unlockedSet = new Set<string>();

  for (let offset = 0; offset < syncable.length; offset += chunkSize) {
    if (batchesAttempted >= maxBatches) {
      interrupted = true;
      temporaryFailure = true;
      failureCategory = 'partial_failure';
      errorMessage =
        'Batch limit reached for this sync trigger. Remaining local runs were kept safely.';
      break;
    }

    const chunk = syncable.slice(offset, offset + chunkSize);
    batchesAttempted += 1;
    const chunkKeys = chunk.map((item) => item.clientRunId ?? item.id);

    const payloadItems = chunk.map((item) => ({
      id: item.id,
      ...(item.clientRunId ? { clientRunId: item.clientRunId } : {}),
      mode: item.mode,
      duration: item.duration,
      seed: item.seed,
      isRanked: item.isRanked !== false,
      telemetry: item.telemetry,
    }));

    let response: Response;
    try {
      response = await fetchFn('/api/results/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payloadItems }),
      });
    } catch (networkErr) {
      interrupted = true;
      temporaryFailure = true;
      failureCategory = 'network_error';
      failedCount += chunk.length;
      failedIds.push(...chunkKeys);
      errorMessage =
        networkErr instanceof Error
          ? networkErr.message
          : 'Network error while syncing guest history.';
      options.recordTransientFailureIds?.(chunkKeys, errorMessage);
      break;
    }

    const rawRetryHeader = response.headers?.get?.('Retry-After');
    const parsedRetry = rawRetryHeader ? Number.parseInt(rawRetryHeader, 10) : Number.NaN;
    if (Number.isFinite(parsedRetry) && parsedRetry > 0) {
      retryAfterSeconds = parsedRetry;
    }

    let json: SyncApiResponseBody | null = null;
    try {
      json = (await response.json()) as SyncApiResponseBody;
    } catch {
      json = null;
    }

    const persistedIds = [
      ...(Array.isArray(json?.syncedIds) ? json.syncedIds : []),
      ...(Array.isArray(json?.duplicateIds) ? json.duplicateIds : []),
    ];

    if (persistedIds.length > 0) {
      options.removePersistedIds(persistedIds);
    }

    const batchRejectedIds = Array.isArray(json?.rejectedIds) ? json.rejectedIds : [];
    if (batchRejectedIds.length > 0) {
      options.markRejectedIds?.(batchRejectedIds, json?.rejectedReasons);
      rejectedIds.push(...batchRejectedIds);
    } else if (response.status === 400 || response.status === 409) {
      const persistedSet = new Set(persistedIds);
      const chunkRejectedKeys = chunkKeys.filter((key) => !persistedSet.has(key));
      if (chunkRejectedKeys.length > 0) {
        const reasonText =
          json?.error ?? 'Batch rejected by server validation; paused from automatic sync.';
        const fallbackReasons = Object.fromEntries(
          chunkRejectedKeys.map((key) => [key, reasonText])
        );
        options.markRejectedIds?.(chunkRejectedKeys, fallbackReasons);
        rejectedIds.push(...chunkRejectedKeys);
        if (json?.rejectedCount === undefined) {
          rejectedCount += chunkRejectedKeys.length;
        }
      }
    }

    syncedCount += json?.syncedCount ?? 0;
    duplicateCount += json?.duplicateCount ?? 0;
    skippedLegacyCount += json?.skippedLegacyCount ?? 0;
    skippedUnrankedCount += json?.skippedUnrankedCount ?? 0;
    rejectedCount += json?.rejectedCount ?? 0;
    failedCount += json?.failedCount ?? 0;

    if (Array.isArray(json?.failedIds) && json.failedIds.length > 0) {
      failedIds.push(...json.failedIds);
    }

    if (Array.isArray(json?.unlocked)) {
      for (const name of json.unlocked) {
        unlockedSet.add(name);
      }
    }

    if (response.status === 400 || response.status === 409) {
      interrupted = true;
      temporaryFailure = false;
      failureCategory = 'permanent_rejected';
      errorMessage =
        json?.error ?? 'Submitted local runs failed verification and were paused locally.';
      break;
    }

    if (!response.ok || json?.partialFailure || (json?.failedCount ?? 0) > 0) {
      interrupted = true;
      temporaryFailure = true;
      if (response.status === 429) {
        failureCategory = 'rate_limited';
      } else if (
        response.status === 207 ||
        json?.partialFailure ||
        ((json?.failedCount ?? 0) > 0 &&
          ((json?.syncedCount ?? 0) > 0 || (json?.duplicateCount ?? 0) > 0))
      ) {
        failureCategory = 'partial_failure';
      } else {
        failureCategory = 'server_error';
      }

      errorMessage =
        json?.error ??
        (response.status === 429
          ? 'Rate limit reached. Remaining local runs were kept safely.'
          : 'Failed to sync remaining local runs cleanly.');

      const settledSet = new Set([...persistedIds, ...batchRejectedIds]);
      const transientKeys =
        Array.isArray(json?.failedIds) && json.failedIds.length > 0
          ? json.failedIds
          : chunkKeys.filter((key) => !settledSet.has(key));

      if (transientKeys.length > 0) {
        options.recordTransientFailureIds?.(transientKeys, errorMessage);
      }
      break;
    }
  }

  if (failureCategory === 'none' && rejectedCount > 0) {
    failureCategory = 'permanent_rejected';
  }

  return {
    syncedCount,
    duplicateCount,
    skippedLegacyCount,
    skippedUnrankedCount,
    skippedInvalidDurationCount,
    heldRejectedCount,
    rejectedCount,
    failedCount,
    rejectedIds,
    failedIds,
    unlocked: Array.from(unlockedSet),
    batchesAttempted,
    interrupted,
    temporaryFailure,
    failureCategory,
    retryAfterSeconds,
    errorMessage,
  };
}
