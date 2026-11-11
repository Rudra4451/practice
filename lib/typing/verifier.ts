import 'server-only';
import { z } from 'zod';
import {
  RANKED_MODES,
  VALID_DURATIONS,
  evaluateFinalSession,
  type KeystrokeInputEvent,
  type RankedMode,
  type TypingSessionResult,
  type ValidDuration,
} from '@/lib/typing/metrics';
import { generateText } from '@/lib/typing/text-generator';

export const TelemetryPointSchema = z.object({
  t: z.number().finite().min(0).max(600_000),
  k: z.string().min(1).max(16),
  y: z.union([z.literal(0), z.literal(1)]),
  i: z.number().int().min(0).max(20_000),
});

export const SubmitResultPayloadSchema = z.object({
  mode: z.enum(RANKED_MODES),
  duration: z
    .number()
    .int()
    .refine((d): d is ValidDuration =>
      (VALID_DURATIONS as readonly number[]).includes(d)
    ),
  seed: z
    .string()
    .trim()
    .min(4)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid seed format'),
  clientRunId: z.string().uuid().optional(),
  telemetry: z.array(TelemetryPointSchema).max(10_000),
});

export type SubmitResultPayload = z.infer<typeof SubmitResultPayloadSchema>;

export interface VerifiedSessionOutcome {
  ok: true;
  mode: RankedMode;
  configuredDuration: ValidDuration;
  seed: string;
  clientRunId?: string;
  targetText: string;
  result: TypingSessionResult;
}

export interface RejectedSessionOutcome {
  ok: false;
  status: 400;
  error: string;
}

export function verifyAndScoreSession(
  payload: SubmitResultPayload
): VerifiedSessionOutcome | RejectedSessionOutcome {
  const { mode, duration, seed, telemetry } = payload;

  if (telemetry.length === 0) {
    return {
      ok: false,
      status: 400,
      error: 'Telemetry is required to verify test results.',
    };
  }

  if (telemetry[0].t > 1000) {
    return {
      ok: false,
      status: 400,
      error: 'Telemetry timeline anomaly detected.',
    };
  }

  const maxAllowedClockMs = (duration + 20) * 1000;
  const targetText = generateText(seed, mode, duration);

  const keystrokes: KeystrokeInputEvent[] = [];
  const inputTimes: number[] = [];
  const deltas: number[] = [];

  let cursor = 0;
  let prevTime = -1;

  for (let idx = 0; idx < telemetry.length; idx += 1) {
    const point = telemetry[idx];

    if (point.t < prevTime || point.t > maxAllowedClockMs) {
      return {
        ok: false,
        status: 400,
        error: 'Timeline order or duration bounds failed verification.',
      };
    }

    if (idx > 0) {
      deltas.push(point.t - prevTime);
    }
    prevTime = point.t;

    if (point.y === 0) {
      if (point.k.length !== 1 || point.k.charCodeAt(0) < 32) {
        return {
          ok: false,
          status: 400,
          error: 'Invalid input character event in telemetry.',
        };
      }

      if (point.i !== cursor || cursor >= targetText.length) {
        return {
          ok: false,
          status: 400,
          error: 'Cursor progression mismatch in telemetry.',
        };
      }

      const expectedKey = targetText[cursor];
      keystrokes.push({
        key: point.k,
        time: point.t,
        index: cursor,
        expectedKey,
        type: 'input',
      });
      inputTimes.push(point.t);
      cursor += 1;
    } else {
      if (point.k !== 'Backspace') {
        return {
          ok: false,
          status: 400,
          error: 'Invalid deletion key in telemetry.',
        };
      }

      if (cursor <= 0 || point.i !== cursor - 1) {
        return {
          ok: false,
          status: 400,
          error: 'Backspace index mismatch in telemetry.',
        };
      }

      cursor -= 1;
      keystrokes.push({
        key: 'Backspace',
        time: point.t,
        index: cursor,
        expectedKey: '',
        type: 'delete',
      });
    }
  }

  // Sliding 15-keystroke burst plausibility check (block sustained >600 WPM macros)
  for (let j = 0; j + 14 < inputTimes.length; j += 1) {
    const avgMsPerChar = (inputTimes[j + 14] - inputTimes[j]) / 14;
    if (avgMsPerChar < 20) {
      return {
        ok: false,
        status: 400,
        error: 'Typing speed burst exceeds physical plausibility threshold.',
      };
    }
  }

  // Constant-cadence autotyper detection when sample size >= 15 intervals
  if (deltas.length >= 15) {
    const meanDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const variance =
      deltas.reduce((acc, d) => acc + Math.pow(d - meanDelta, 2), 0) /
      deltas.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev < 2.0) {
      return {
        ok: false,
        status: 400,
        error: 'Suspicious uniform typing cadence detected.',
      };
    }
  }

  const lastT = telemetry[telemetry.length - 1].t;
  const reason = cursor >= targetText.length ? 'text_complete' : 'timer';

  if (reason === 'text_complete' && lastT < 3000) {
    return {
      ok: false,
      status: 400,
      error: 'Completion duration violates minimum physical typing time.',
    };
  }

  const scored = evaluateFinalSession(keystrokes, {
    durationLimit: duration,
    reason,
    endTime: lastT,
  });

  if (!scored) {
    return {
      ok: false,
      status: 400,
      error: 'Unable to derive verified score from telemetry.',
    };
  }

  if (scored.wpm > 260 || scored.rawWpm > 320) {
    return {
      ok: false,
      status: 400,
      error: 'Recomputed speed exceeds verified human ceiling.',
    };
  }

  return {
    ok: true,
    mode,
    configuredDuration: duration,
    seed,
    clientRunId: payload.clientRunId,
    targetText,
    result: scored,
  };
}

