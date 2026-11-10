import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  AdminConfigurationError,
  createAdminClient,
  resolvePrivilegedWriteClient,
} from '@/lib/supabase/admin';
import {
  assertSameOriginIfPresent,
  MAX_SYNC_BODY_BYTES,
  readJsonBodyWithLimit,
} from '@/lib/security/http';
import { checkSyncRateLimit } from '@/lib/security/rate-limit';
import { isRankedMode, isValidDuration } from '@/lib/typing/metrics';
import { MAX_SYNC_BATCH_SIZE } from '@/lib/typing/sync-client';
import {
  SubmitResultPayloadSchema,
  verifyAndScoreSession,
  type SubmitResultPayload,
} from '@/lib/typing/verifier';
import {
  persistVerifiedResult,
  ResultPersistenceError,
} from '@/lib/typing/persistence';

const SyncItemSchema = z
  .object({
    id: z.string().min(1).max(128).optional(),
    mode: z.string().optional(),
    duration: z.number().optional(),
    seed: z.string().optional(),
    isRanked: z.boolean().optional(),
    telemetry: z.array(z.unknown()).optional(),
    clientRunId: z.string().max(128).optional(),
  })
  .passthrough();

const SyncPayloadSchema = z.object({
  items: z.array(SyncItemSchema).min(1).max(MAX_SYNC_BATCH_SIZE),
});

function buildBatchFingerprint(payload: SubmitResultPayload): string {
  const eventsSig = payload.telemetry
    .map((p) => `${p.t}:${p.y}:${p.i}:${p.k}`)
    .join(';');
  return `${payload.mode}|${payload.duration}|${payload.seed}|${eventsSig}`;
}

export async function POST(request: Request) {
  const originError = assertSameOriginIfPresent(request);
  if (originError) return originError;

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required to sync local history.' },
        { status: 401 }
      );
    }

    const bodyResult = await readJsonBodyWithLimit(request, MAX_SYNC_BODY_BYTES);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }
    const rawBody = bodyResult.data;

    const parsed = SyncPayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid guest sync payload.' },
        { status: 400 }
      );
    }

    const { client: writeClient, isPrivilegedClient } = resolvePrivilegedWriteClient(
      supabase,
      'POST /api/results/sync',
      createAdminClient()
    );

    const syncableCandidateCount = parsed.data.items.filter(
      (item) =>
        Array.isArray(item.telemetry) &&
        item.telemetry.length > 0 &&
        item.isRanked !== false &&
        typeof item.mode === 'string' &&
        isRankedMode(item.mode) &&
        typeof item.duration === 'number' &&
        isValidDuration(item.duration)
    ).length;

    const rateLimit = await checkSyncRateLimit(writeClient, user.id, {
      itemCount: syncableCandidateCount,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Sync rate limit exceeded. Please wait ${rateLimit.retryAfterSeconds}s before retrying.`,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    const syncedIds: string[] = [];
    const duplicateIds: string[] = [];
    const skippedLegacyIds: string[] = [];
    const skippedUnrankedIds: string[] = [];
    const rejectedIds: string[] = [];
    const rejectedReasons: Record<string, string> = {};
    const failedIds: string[] = [];
    const unlockedSet = new Set<string>();

    const persistedClientRunFingerprints = new Map<string, string>();
    const persistedFingerprints = new Set<string>();

    for (let idx = 0; idx < parsed.data.items.length; idx += 1) {
      const item = parsed.data.items[idx];
      const itemKey = item.clientRunId ?? item.id ?? `item-${idx}`;

      if (!Array.isArray(item.telemetry) || item.telemetry.length === 0) {
        skippedLegacyIds.push(itemKey);
        continue;
      }

      if (item.isRanked === false || !item.mode || !isRankedMode(item.mode)) {
        skippedUnrankedIds.push(itemKey);
        continue;
      }

      const itemParsed = SubmitResultPayloadSchema.safeParse({
        mode: item.mode,
        duration: item.duration,
        seed: item.seed,
        clientRunId: item.clientRunId,
        telemetry: item.telemetry,
      });

      if (!itemParsed.success) {
        rejectedIds.push(itemKey);
        rejectedReasons[itemKey] = 'Invalid run payload or duration bracket.';
        continue;
      }

      const fingerprint = buildBatchFingerprint(itemParsed.data);
      if (itemParsed.data.clientRunId) {
        const prevFp = persistedClientRunFingerprints.get(itemParsed.data.clientRunId);
        if (prevFp !== undefined) {
          if (prevFp === fingerprint) {
            duplicateIds.push(itemKey);
          } else {
            rejectedIds.push(itemKey);
            rejectedReasons[itemKey] =
              'Conflicting payload submitted for duplicate clientRunId in sync batch.';
          }
          continue;
        }
      }

      if (persistedFingerprints.has(fingerprint)) {
        duplicateIds.push(itemKey);
        continue;
      }

      const verified = verifyAndScoreSession(itemParsed.data);
      if (!verified.ok) {
        rejectedIds.push(itemKey);
        rejectedReasons[itemKey] = verified.error;
        continue;
      }

      try {
        const persisted = await persistVerifiedResult(writeClient, user.id, verified, {
          clientRunId: itemParsed.data.clientRunId,
          deduplicateBySignature: true,
          isPrivilegedClient,
        });

        if (itemParsed.data.clientRunId) {
          persistedClientRunFingerprints.set(itemParsed.data.clientRunId, fingerprint);
        }
        persistedFingerprints.add(fingerprint);

        if (persisted.deduplicated) {
          duplicateIds.push(itemKey);
        } else {
          syncedIds.push(itemKey);
        }

        for (const ach of persisted.unlocked) {
          unlockedSet.add(ach);
        }
      } catch (persistErr) {
        if (
          persistErr instanceof ResultPersistenceError &&
          (persistErr.reason === 'result_invalidated' ||
            persistErr.reason === 'client_run_id_conflict')
        ) {
          rejectedIds.push(itemKey);
          rejectedReasons[itemKey] = persistErr.message;
          continue;
        }
        console.error('Results Sync item persistence failed:', persistErr);
        failedIds.push(itemKey);
      }
    }

    const syncedCount = syncedIds.length;
    const duplicateCount = duplicateIds.length;
    const skippedLegacyCount = skippedLegacyIds.length;
    const skippedUnrankedCount = skippedUnrankedIds.length;
    const rejectedCount = rejectedIds.length;
    const failedCount = failedIds.length;

    const allItemsRejected =
      failedCount === 0 &&
      rejectedCount > 0 &&
      syncedCount === 0 &&
      duplicateCount === 0 &&
      skippedLegacyCount === 0 &&
      skippedUnrankedCount === 0;

    const responseBody = {
      success: failedCount === 0 && !allItemsRejected,
      ...(failedCount > 0 && (syncedCount > 0 || duplicateCount > 0)
        ? { partialFailure: true }
        : {}),
      ...(failedCount > 0
        ? {
            error:
              syncedCount === 0 && duplicateCount === 0
                ? 'Failed to persist guest runs cleanly.'
                : 'Some guest runs failed to persist cleanly.',
          }
        : allItemsRejected
          ? { error: 'Submitted runs failed server verification and were rejected.' }
          : {}),
      syncedCount,
      duplicateCount,
      skippedLegacyCount,
      skippedUnrankedCount,
      rejectedCount,
      failedCount,
      syncedIds,
      duplicateIds,
      skippedLegacyIds,
      skippedUnrankedIds,
      rejectedIds,
      rejectedReasons,
      failedIds,
      unlocked: Array.from(unlockedSet),
    };

    if (failedCount > 0) {
      return NextResponse.json(responseBody, {
        status: syncedCount === 0 && duplicateCount === 0 ? 500 : 207,
      });
    }

    if (allItemsRejected) {
      return NextResponse.json(responseBody, { status: 400 });
    }

    return NextResponse.json(responseBody);
  } catch (err) {
    if (err instanceof AdminConfigurationError) {
      return NextResponse.json(
        {
          error: 'Guest history synchronization is temporarily unavailable due to missing server credentials.',
          code: err.code,
        },
        { status: err.status }
      );
    }
    console.error('Results Sync POST Exception:', err);
    return NextResponse.json(
      { error: 'Failed to sync verified guest history.' },
      { status: 500 }
    );
  }
}
