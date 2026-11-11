import type { CompressedTelemetryPoint } from '@/lib/typing/metrics';
import { generateText } from '@/lib/typing/text-generator';

export interface ReplaySessionInput {
  telemetry: CompressedTelemetryPoint[];
  seed?: string | null;
  mode?: string | null;
  duration?: number | null;
}

export interface FingerLoadItem {
  finger: string;
  hits: number;
  percentage: number;
}

export interface SlowBigramItem {
  bigram: string;
  avgMs: number;
  count: number;
}

export interface WeakKeyItem {
  key: string;
  errors: number;
  attempts: number;
  errorRate: number;
}

export interface ReplayAnalysisResult {
  totalSessions: number;
  totalKeystrokes: number;
  heatmap: Record<string, number>;
  fingerLoads: FingerLoadItem[];
  handDistribution: {
    left: number;
    right: number;
  };
  slowBigrams: SlowBigramItem[];
  weakKeys: WeakKeyItem[];
}

export const KEYBOARD_ROWS: readonly (readonly string[])[] = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'],
];

export const ORDERED_FINGERS = [
  'Left Pinky',
  'Left Ring',
  'Left Middle',
  'Left Index',
  'Space (Thumb)',
  'Right Index',
  'Right Middle',
  'Right Ring',
  'Right Pinky',
] as const;

export const FINGER_MAP: Record<string, (typeof ORDERED_FINGERS)[number]> = {
  '1': 'Left Pinky',
  '!': 'Left Pinky',
  q: 'Left Pinky',
  a: 'Left Pinky',
  z: 'Left Pinky',
  '`': 'Left Pinky',
  '~': 'Left Pinky',
  '2': 'Left Ring',
  '@': 'Left Ring',
  w: 'Left Ring',
  s: 'Left Ring',
  x: 'Left Ring',
  '3': 'Left Middle',
  '#': 'Left Middle',
  e: 'Left Middle',
  d: 'Left Middle',
  c: 'Left Middle',
  '4': 'Left Index',
  $: 'Left Index',
  '5': 'Left Index',
  '%': 'Left Index',
  r: 'Left Index',
  f: 'Left Index',
  v: 'Left Index',
  t: 'Left Index',
  g: 'Left Index',
  b: 'Left Index',
  ' ': 'Space (Thumb)',
  '6': 'Right Index',
  '^': 'Right Index',
  '7': 'Right Index',
  '&': 'Right Index',
  y: 'Right Index',
  h: 'Right Index',
  n: 'Right Index',
  u: 'Right Index',
  j: 'Right Index',
  m: 'Right Index',
  '8': 'Right Middle',
  '*': 'Right Middle',
  i: 'Right Middle',
  k: 'Right Middle',
  ',': 'Right Middle',
  '<': 'Right Middle',
  '9': 'Right Ring',
  '(': 'Right Ring',
  o: 'Right Ring',
  l: 'Right Ring',
  '.': 'Right Ring',
  '>': 'Right Ring',
  '0': 'Right Pinky',
  ')': 'Right Pinky',
  '-': 'Right Pinky',
  _: 'Right Pinky',
  '=': 'Right Pinky',
  '+': 'Right Pinky',
  p: 'Right Pinky',
  '[': 'Right Pinky',
  '{': 'Right Pinky',
  ']': 'Right Pinky',
  '}': 'Right Pinky',
  '\\': 'Right Pinky',
  '|': 'Right Pinky',
  ';': 'Right Pinky',
  ':': 'Right Pinky',
  "'": 'Right Pinky',
  '"': 'Right Pinky',
  '/': 'Right Pinky',
  '?': 'Right Pinky',
};

const REPLAY_ALIGNABLE_MODES = new Set([
  'words',
  'quotes',
  'numbers',
  'punctuation',
  'code',
  'daily',
]);

export function analyzeReplaySessions(
  sessions: ReplaySessionInput[]
): ReplayAnalysisResult {
  const heatmap: Record<string, number> = {};
  const fingerCounts: Record<string, number> = {};
  for (const f of ORDERED_FINGERS) {
    fingerCounts[f] = 0;
  }

  const keyAttempts: Record<string, number> = {};
  const keyErrors: Record<string, number> = {};
  const bigramTimes: Record<string, number[]> = {};

  let totalKeystrokes = 0;
  let validSessionCount = 0;

  for (const session of sessions) {
    const rawTelemetry = session.telemetry;
    if (!Array.isArray(rawTelemetry) || rawTelemetry.length === 0) continue;

    validSessionCount += 1;
    const telemetry = [...rawTelemetry].sort((a, b) => a.t - b.t);

    let expectedText: string | null = null;
    if (
      session.seed &&
      session.mode &&
      session.duration &&
      REPLAY_ALIGNABLE_MODES.has(session.mode)
    ) {
      expectedText = generateText(session.seed, session.mode, session.duration);
    }

    let lastInputEvent: CompressedTelemetryPoint | null = null;
    let lastInputWasCorrect = true;

    for (const curr of telemetry) {
      if (curr.y === 0) {
        totalKeystrokes += 1;
        const typedLower = curr.k.toLowerCase();
        const rawExpected =
          expectedText && curr.i >= 0 && curr.i < expectedText.length
            ? expectedText[curr.i]
            : null;
        const trackedKey = (rawExpected ?? curr.k).toLowerCase();

        if (trackedKey.length === 1) {
          keyAttempts[trackedKey] = (keyAttempts[trackedKey] || 0) + 1;
        }

        if (typedLower.length === 1) {
          heatmap[typedLower] = (heatmap[typedLower] || 0) + 1;
        }

        const mappedFinger = FINGER_MAP[typedLower];
        if (mappedFinger) {
          fingerCounts[mappedFinger] = (fingerCounts[mappedFinger] || 0) + 1;
        }

        const isCorrect = rawExpected !== null ? curr.k === rawExpected : true;
        if (rawExpected !== null && !isCorrect && trackedKey.length === 1) {
          keyErrors[trackedKey] = (keyErrors[trackedKey] || 0) + 1;
        }

        if (lastInputEvent && isCorrect && lastInputWasCorrect) {
          const bigram = (lastInputEvent.k + curr.k).toLowerCase();
          if (bigram.length === 2 && /^[a-z]{2}$/.test(bigram)) {
            const delta = curr.t - lastInputEvent.t;
            if (delta > 0 && delta < 1500) {
              if (!bigramTimes[bigram]) bigramTimes[bigram] = [];
              bigramTimes[bigram].push(delta);
            }
          }
        }

        lastInputEvent = curr;
        lastInputWasCorrect = isCorrect;
      } else if (curr.y === 1) {
        // Fallback attribution when session lacked deterministic prompt reconstruction
        if (expectedText === null && lastInputEvent && lastInputEvent.k.length === 1) {
          const deletedKey = lastInputEvent.k.toLowerCase();
          keyErrors[deletedKey] = (keyErrors[deletedKey] || 0) + 1;
        }
        lastInputEvent = null;
        lastInputWasCorrect = false;
      }
    }
  }

  let leftHits = 0;
  let rightHits = 0;
  let totalFingerHits = 0;

  for (const finger of ORDERED_FINGERS) {
    const count = fingerCounts[finger] || 0;
    totalFingerHits += count;
    if (finger.startsWith('Left')) leftHits += count;
    if (finger.startsWith('Right')) rightHits += count;
  }

  const handDenominator = leftHits + rightHits;
  const handDistribution =
    handDenominator > 0
      ? {
          left: Math.round((leftHits / handDenominator) * 100),
          right: Math.round((rightHits / handDenominator) * 100),
        }
      : { left: 50, right: 50 };

  const fingerLoads: FingerLoadItem[] = ORDERED_FINGERS.map((finger) => {
    const hits = fingerCounts[finger] || 0;
    return {
      finger,
      hits,
      percentage: totalFingerHits > 0 ? Math.round((hits / totalFingerHits) * 100) : 0,
    };
  });

  const allBigrams: SlowBigramItem[] = Object.entries(bigramTimes).map(([bigram, times]) => ({
    bigram,
    avgMs: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
    count: times.length,
  }));

  const repeatedBigrams = allBigrams.filter((b) => b.count >= 2);
  const bigramSource = repeatedBigrams.length >= 3 ? repeatedBigrams : allBigrams;
  const slowBigrams = [...bigramSource]
    .sort((a, b) => b.avgMs - a.avgMs || b.count - a.count)
    .slice(0, 6);

  const weakKeys: WeakKeyItem[] = Object.entries(keyErrors)
    .filter(([, errors]) => errors > 0)
    .map(([key, errors]) => {
      const attempts = Math.max(errors, keyAttempts[key] || errors);
      const errorRate = Math.round((errors / attempts) * 1000) / 10;
      return {
        key,
        errors,
        attempts,
        errorRate,
      };
    })
    .sort((a, b) => b.errors - a.errors || b.errorRate - a.errorRate)
    .slice(0, 6);

  return {
    totalSessions: validSessionCount,
    totalKeystrokes,
    heatmap,
    fingerLoads,
    handDistribution,
    slowBigrams,
    weakKeys,
  };
}

