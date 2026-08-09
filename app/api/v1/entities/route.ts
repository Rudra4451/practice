import { NextResponse } from 'next/server';
import { z } from 'zod';

const entityQuerySchema = z.object({
  type: z.enum([
    'user',
    'profile',
    'session',
    'replay',
    'text_pack',
    'challenge',
    'club',
    'achievement',
    'badge',
    'drill',
    'event',
    'notification',
  ]).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = entityQuerySchema.safeParse({
      type: searchParams.get('type') || undefined,
      limit: searchParams.get('limit') || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid entity query params.', details: parsed.error }, { status: 400 });
    }

    return NextResponse.json({
      apiVersion: 'v1',
      entityType: parsed.data.type || 'all',
      entities: [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
