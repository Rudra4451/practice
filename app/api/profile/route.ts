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
import { checkProfileUpdateRateLimit } from '@/lib/security/rate-limit';
import {
  isReservedUsername,
  isTemporaryGeneratedUsername,
  USERNAME_PATTERN,
} from '@/lib/security/username';
import type { Database } from '@/types/database';

const UpdateProfileSchema = z
  .object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(
        USERNAME_PATTERN,
        'Username must be 3-24 lowercase letters, numbers, or underscores.'
      )
      .refine(
        (val) => !isTemporaryGeneratedUsername(val),
        'Please choose a custom username.'
      )
      .refine(
        (val) => !isReservedUsername(val),
        'This username is reserved.'
      )
      .optional(),
    displayName: z
      .string()
      .trim()
      .min(1, 'Display name cannot be empty.')
      .max(50, 'Display name must be 50 characters or less.')
      .optional(),
    theme: z.enum(['light', 'dark']).optional(),
    font_family: z
      .enum(['jetbrains-mono', 'ibm-plex-mono', 'geist-mono'])
      .optional(),
  })
  .refine(
    (data) =>
      data.username !== undefined ||
      data.displayName !== undefined ||
      data.theme !== undefined ||
      data.font_family !== undefined,
    { message: 'At least one profile field must be provided.' }
  );

export async function PATCH(request: Request) {
  const originError = assertSameOriginIfPresent(request);
  if (originError) return originError;

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bodyResult = await readJsonBodyWithLimit(request, MAX_SMALL_JSON_BODY_BYTES);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const parsed = UpdateProfileSchema.safeParse(bodyResult.data);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message ?? 'Invalid profile payload.';
      return NextResponse.json({ error: firstIssue }, { status: 400 });
    }

    const rateLimit = checkProfileUpdateRateLimit(user.id);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many profile update requests. Please wait ${rateLimit.retryAfterSeconds}s before trying again.`,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    let writeClient = supabase;
    const updateFields: Database['public']['Tables']['profiles']['Update'] = {
      updated_at: new Date().toISOString(),
    };

    if (parsed.data.displayName !== undefined) {
      updateFields.display_name = parsed.data.displayName;
    }
    if (parsed.data.theme !== undefined) {
      updateFields.theme = parsed.data.theme;
    }
    if (parsed.data.font_family !== undefined) {
      updateFields.font_family = parsed.data.font_family;
    }

    if (parsed.data.username !== undefined) {
      // Only username transitions require privileged server authority once column grants revoke
      // `profiles.username` from direct `authenticated` client writes (20260624 migration).
      const resolved = resolvePrivilegedWriteClient(
        supabase,
        'PATCH /api/profile (username)',
        createAdminClient()
      );
      writeClient = resolved.client;

      const { data: currentProfile, error: profileLoadError } = await writeClient
        .from('profiles')
        .select('id, username, display_name, avatar_url, theme, font_family, created_at, updated_at')
        .eq('id', user.id)
        .maybeSingle();

      if (profileLoadError) {
        console.error('Profile PATCH load error:', profileLoadError);
        return NextResponse.json({ error: 'Failed to verify current profile handle.' }, { status: 500 });
      }

      const currentUsername = currentProfile?.username?.trim().toLowerCase() ?? '';
      const hasCustomLockedHandle =
        currentUsername.length > 0 && !isTemporaryGeneratedUsername(currentUsername);

      if (hasCustomLockedHandle && parsed.data.username !== currentUsername) {
        return NextResponse.json(
          {
            error: 'Username is locked once set and cannot be changed.',
            code: 'USERNAME_LOCKED',
          },
          { status: 403 }
        );
      }

      if (!currentProfile || isTemporaryGeneratedUsername(currentUsername)) {
        updateFields.username = parsed.data.username;
      } else if (
        updateFields.display_name === undefined &&
        updateFields.theme === undefined &&
        updateFields.font_family === undefined
      ) {
        return NextResponse.json({
          success: true,
          profile: currentProfile,
        });
      }
    }

    const { data, error } = await writeClient
      .from('profiles')
      .update(updateFields)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Username is already taken. Please try another one.' },
          { status: 409 }
        );
      }
      if (error.code === '42501') {
        return NextResponse.json(
          {
            error: 'Username is locked once set and cannot be changed.',
            code: 'USERNAME_LOCKED',
          },
          { status: 403 }
        );
      }
      if (error.code === '23514') {
        return NextResponse.json(
          { error: 'Invalid or reserved username.' },
          { status: 400 }
        );
      }
      console.error('Profile PATCH DB error:', error);
      return NextResponse.json({ error: 'Failed to update profile.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      profile: data,
    });
  } catch (err) {
    if (err instanceof AdminConfigurationError) {
      return NextResponse.json(
        {
          error: 'Username onboarding is temporarily unavailable due to missing server credentials.',
          code: err.code,
        },
        { status: err.status }
      );
    }
    console.error('Profile PATCH Exception:', err);
    return NextResponse.json({ error: 'Failed to update profile.' }, { status: 500 });
  }
}
