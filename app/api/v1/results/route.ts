import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const telemetrySchema = z.object({
  t: z.number(),
  k: z.string(),
  y: z.number(),
  i: z.number(),
});

const submitResultSchemaV1 = z.object({
  version: z.literal(1).default(1),
  wpm: z.number().min(0).max(350),
  rawWpm: z.number().min(0).max(350),
  accuracy: z.number().min(0).max(100),
  consistency: z.number().min(0).max(100),
  errorCount: z.number().min(0),
  backspaceCount: z.number().min(0),
  mode: z.enum(['words', 'quotes', 'numbers', 'punctuation', 'code']),
  duration: z.number().min(1).max(300),
  seed: z.string().max(64),
  telemetry: z.array(telemetrySchema).max(10000),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = submitResultSchemaV1.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid v1 payload schema.', details: parsed.error }, { status: 400 });
    }

    const {
      wpm,
      rawWpm,
      accuracy,
      consistency,
      errorCount,
      backspaceCount,
      mode,
      duration,
      seed,
      telemetry,
    } = parsed.data;

    // Timing monotonicity & autotyper stdDev check
    if (telemetry.length > 10) {
      const deltas: number[] = [];
      for (let i = 1; i < telemetry.length; i++) {
        const delta = telemetry[i].t - telemetry[i - 1].t;
        if (delta < 0) {
          return NextResponse.json({ error: 'Cheat detected: timeline anomaly.' }, { status: 400 });
        }
        deltas.push(delta);
      }
      const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      const variance = deltas.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / deltas.length;
      if (Math.sqrt(variance) < 1.5) {
        return NextResponse.json({ error: 'Cheat detected: mechanical regularity.' }, { status: 400 });
      }
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: true, message: 'Unauthenticated run validated.' });
    }

    const { data: dbResult, error: dbErr } = await supabase
      .from('test_results')
      .insert({
        user_id: user.id,
        wpm,
        raw_wpm: rawWpm,
        accuracy,
        consistency,
        error_count: errorCount,
        backspace_count: backspaceCount,
        mode,
        duration,
        seed,
      })
      .select('id')
      .single();

    if (dbErr || !dbResult) {
      return NextResponse.json({ error: 'Database save failed.' }, { status: 500 });
    }

    await supabase.from('replays').insert({
      test_result_id: dbResult.id,
      telemetry,
    });

    return NextResponse.json({
      success: true,
      apiVersion: 'v1',
      resultId: dbResult.id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
