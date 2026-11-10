import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  AdminConfigurationError,
  createAdminClient,
  resolvePrivilegedWriteClient,
} from '@/lib/supabase/admin';
import {
  assertSameOriginIfPresent,
  MAX_RESULT_BODY_BYTES,
  readJsonBodyWithLimit,
} from '@/lib/security/http';
import {
  buildVerifiedPayloadDigest,
  checkClientRunRecoveryBudget,
  checkResultSubmissionRateLimit,
  deleteCachedRunEntry,
  getCachedRunEntry,
  setCachedRunEntry,
} from '@/lib/security/rate-limit';
import {
  SubmitResultPayloadSchema,
  verifyAndScoreSession,
} from '@/lib/typing/verifier';
import {
  persistVerifiedResult,
  ResultPersistenceError,
} from '@/lib/typing/persistence';

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
        { error: 'Authentication required to submit ranked results.' },
        { status: 401 }
      );
    }

    const bodyResult = await readJsonBodyWithLimit(request, MAX_RESULT_BODY_BYTES);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }
    const rawBody = bodyResult.data;

    const parsed = SubmitResultPayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload schema.' }, { status: 400 });
    }

    const verified = verifyAndScoreSession(parsed.data);
    if (!verified.ok) {
      return NextResponse.json({ error: verified.error }, { status: verified.status });
    }

    const { client: writeClient, isPrivilegedClient } = resolvePrivilegedWriteClient(
      supabase,
      'POST /api/results',
      createAdminClient()
    );

    const clientRunId = parsed.data.clientRunId;
    const payloadDigest = buildVerifiedPayloadDigest(
      verified.mode,
      verified.configuredDuration,
      verified.seed,
      verified.result.telemetry
    );

    if (clientRunId) {
      const cachedHit = getCachedRunEntry(user.id, clientRunId);
      if (cachedHit) {
        if (cachedHit.payloadDigest !== payloadDigest) {
          return NextResponse.json(
            {
              error: 'Conflicting payload submitted for an existing clientRunId.',
              code: 'CLIENT_RUN_ID_CONFLICT',
            },
            { status: 409 }
          );
        }

        const cacheBudget = checkClientRunRecoveryBudget(user.id, clientRunId);
        if (!cacheBudget.allowed) {
          return NextResponse.json(
            {
              error: `Please wait ${cacheBudget.retryAfterSeconds}s before retrying this submission.`,
            },
            {
              status: 429,
              headers: { 'Retry-After': String(cacheBudget.retryAfterSeconds) },
            }
          );
        }

        // Re-verify invalidation status against DB so invalidated runs are never served from cache
        const { data: liveStatusRow, error: statusError } = await writeClient
          .from('test_results')
          .select('id, client_run_id, is_invalidated')
          .eq('user_id', user.id)
          .eq('client_run_id', clientRunId)
          .maybeSingle();

        if (!statusError && liveStatusRow?.is_invalidated === true) {
          deleteCachedRunEntry(user.id, clientRunId);
          return NextResponse.json(
            {
              error: 'This result has been invalidated and cannot be replayed.',
              code: 'RESULT_INVALIDATED',
            },
            { status: 409 }
          );
        }

        return NextResponse.json({
          success: true,
          ...cachedHit.payload,
          unlocked: [],
          deduplicated: true,
          recoveredPartialWrite: false,
        });
      }
    }

    const rateCheck = await checkResultSubmissionRateLimit(writeClient, user.id, {
      seed: verified.seed,
      mode: verified.mode,
      duration: verified.configuredDuration,
      wpm: verified.result.wpm,
      accuracy: verified.result.accuracy,
      clientRunId,
    });

    if (rateCheck.invalidated) {
      if (clientRunId) deleteCachedRunEntry(user.id, clientRunId);
      return NextResponse.json(
        {
          error: 'This result has been invalidated and cannot be replayed.',
          code: 'RESULT_INVALIDATED',
        },
        { status: 409 }
      );
    }

    if (rateCheck.conflict) {
      return NextResponse.json(
        {
          error: 'Conflicting payload submitted for an existing clientRunId.',
          code: 'CLIENT_RUN_ID_CONFLICT',
        },
        { status: 409 }
      );
    }

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Please wait ${rateCheck.retryAfterSeconds}s before submitting another result.`,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rateCheck.retryAfterSeconds) },
        }
      );
    }

    const persisted = await persistVerifiedResult(writeClient, user.id, verified, {
      clientRunId,
      deduplicateBySignature: true,
      isPrivilegedClient,
    });

    if (clientRunId) {
      setCachedRunEntry(user.id, clientRunId, payloadDigest, persisted);
    }

    return NextResponse.json({
      success: true,
      ...(persisted.deduplicated ? { deduplicated: true } : {}),
      ...persisted,
    });
  } catch (err) {
    if (err instanceof AdminConfigurationError) {
      return NextResponse.json(
        {
          error: 'Ranked result persistence is temporarily unavailable due to missing server credentials.',
          code: err.code,
        },
        { status: err.status }
      );
    }

    if (err instanceof ResultPersistenceError) {
      if (err.reason === 'result_invalidated') {
        return NextResponse.json(
          { error: err.message, code: 'RESULT_INVALIDATED' },
          { status: 409 }
        );
      }
      if (err.reason === 'client_run_id_conflict') {
        return NextResponse.json(
          { error: err.message, code: 'CLIENT_RUN_ID_CONFLICT' },
          { status: 409 }
        );
      }
      console.error('Results POST Persistence Exception:', err);
      return NextResponse.json(
        {
          error: 'Failed to save verified test result.',
          ...(err.recoverable ? { recoverable: true } : {}),
        },
        { status: 500 }
      );
    }

    console.error('Results POST Exception:', err);
    return NextResponse.json(
      { error: 'Failed to save verified test result.' },
      { status: 500 }
    );
  }
}
