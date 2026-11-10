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
  MAX_SMALL_JSON_BODY_BYTES,
  readJsonBodyWithLimit,
} from '@/lib/security/http';
import { checkChallengeRateLimit } from '@/lib/security/rate-limit';
import { isRankedMode, normalizeBracketDuration } from '@/lib/typing/metrics';

const CreateChallengeSchema = z.object({
  testResultId: z.string().uuid('Invalid verified test result ID.'),
});

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
        { error: 'Authentication required to create a verified challenge link.' },
        { status: 401 }
      );
    }

    const bodyResult = await readJsonBodyWithLimit(request, MAX_SMALL_JSON_BODY_BYTES);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const parsed = CreateChallengeSchema.safeParse(bodyResult.data);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid challenge request.' }, { status: 400 });
    }

    const rateLimit = checkChallengeRateLimit(user.id);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many challenge link requests. Please wait ${rateLimit.retryAfterSeconds}s before creating another.`,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    const { client: writeClient } = resolvePrivilegedWriteClient(
      supabase,
      'POST /api/challenges',
      createAdminClient()
    );

    // Fetch authoritative score row owned by caller (never trust client-sent WPM)
    const { data: resultRow, error: fetchError } = await writeClient
      .from('test_results')
      .select('id, user_id, wpm, accuracy, mode, duration, seed, is_invalidated')
      .eq('id', parsed.data.testResultId)
      .maybeSingle();

    if (fetchError || !resultRow) {
      return NextResponse.json(
        { error: 'Verified test result not found.' },
        { status: 404 }
      );
    }

    if (resultRow.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: you can only create challenges from your own results.' },
        { status: 403 }
      );
    }

    if (resultRow.is_invalidated) {
      return NextResponse.json(
        { error: 'Invalidated runs cannot generate challenge links.' },
        { status: 400 }
      );
    }

    if (!isRankedMode(resultRow.mode)) {
      return NextResponse.json(
        { error: 'Only ranked typing modes support verified 1v1 challenge links.' },
        { status: 400 }
      );
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const challengeDuration = normalizeBracketDuration(resultRow.duration);

    const { data: link, error: insertError } = await writeClient
      .from('challenge_links')
      .insert({
        creator_id: user.id,
        creator_wpm: resultRow.wpm,
        creator_accuracy: resultRow.accuracy,
        mode: resultRow.mode,
        duration: challengeDuration,
        seed: resultRow.seed,
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (insertError || !link) {
      console.error('Challenge create error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create challenge link.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        id: link.id,
        url: `/challenge/${link.id}`,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof AdminConfigurationError) {
      return NextResponse.json(
        {
          error: 'Challenge link creation is temporarily unavailable due to missing server credentials.',
          code: err.code,
        },
        { status: err.status }
      );
    }
    console.error('Challenges POST Exception:', err);
    return NextResponse.json(
      { error: 'Failed to create challenge link.' },
      { status: 500 }
    );
  }
}
