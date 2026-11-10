export const RANKED_MODES = ['words', 'quotes', 'numbers', 'punctuation', 'code'] as const;
export type RankedMode = (typeof RANKED_MODES)[number];
export type TypingMode = RankedMode | 'drill' | 'lesson' | 'daily';

export const VALID_DURATIONS = [15, 30, 60, 120] as const;
export type ValidDuration = (typeof VALID_DURATIONS)[number];

export function isRankedMode(mode: string): mode is RankedMode {
  return (RANKED_MODES as readonly string[]).includes(mode);
}

export function isValidDuration(duration: number): duration is ValidDuration {
  return (VALID_DURATIONS as readonly number[]).includes(duration);
}

export function normalizeBracketDuration(seconds: number): ValidDuration {
  if (isValidDuration(seconds)) return seconds;
  if (!Number.isFinite(seconds) || seconds <= 15) return 15;
  return VALID_DURATIONS.find((v) => v >= seconds) ?? VALID_DURATIONS[VALID_DURATIONS.length - 1];
}

export type CompletionReason = 'timer' | 'text_complete';

export interface KeystrokeInputEvent {
  key: string;
  time: number; // high-resolution timestamp in ms
  index: number;
  expectedKey: string;
  type: 'input' | 'delete';
}

export interface CompressedTelemetryPoint {
  t: number; // relative elapsed time since first keystroke (ms)
  k: string; // character or 'Backspace'
  y: 0 | 1; // 0 = input, 1 = delete
  i: number; // target text index
}

export interface TimelinePoint {
  second: number;
  wpm: number;
  rawWpm: number;
}

export interface TypingSessionResult {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
  errorCount: number;
  backspaceCount: number;
  /** Canonical configured test duration bracket in seconds (e.g. 15, 30, 60, 120). */
  duration: number;
  /** Actual elapsed typing time in seconds used as the WPM timing denominator. */
  elapsedSeconds: number;
  totalInputKeystrokes: number;
  correctInputKeystrokes: number;
  timeline: TimelinePoint[];
  keySpeeds: Record<string, number>;
  errorKeys: Record<string, number>;
  bigramSpeeds: Record<string, number>;
  telemetry: CompressedTelemetryPoint[];
}

export interface LiveMetricsSnapshot {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  correctBufferChars: number;
  totalInputKeystrokes: number;
  correctInputKeystrokes: number;
  uncorrectedErrors: number;
  backspaceCount: number;
}

export function roundAccuracy(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}

export function computeAccuracyPercent(correctInputs: number, totalInputs: number): number {
  if (totalInputs <= 0) return 100;
  return roundAccuracy((correctInputs / totalInputs) * 100);
}

export function computeWpmFromChars(charCount: number, elapsedMs: number): number {
  if (elapsedMs <= 0 || charCount <= 0) return 0;
  const elapsedMins = elapsedMs / 60000;
  return Math.max(0, Math.round(charCount / 5 / elapsedMins));
}

export function createMetricsTracker() {
  const correctMap = new Map<number, boolean>();
  let correctBufferChars = 0;
  let uncorrectedErrors = 0;
  let totalInputKeystrokes = 0;
  let correctInputKeystrokes = 0;
  let backspaceCount = 0;

  return {
    apply(event: Pick<KeystrokeInputEvent, 'type' | 'index' | 'key' | 'expectedKey'>) {
      if (event.type === 'delete') {
        backspaceCount += 1;
        const prev = correctMap.get(event.index);
        if (prev === true) {
          correctBufferChars -= 1;
        } else if (prev === false) {
          uncorrectedErrors -= 1;
        }
        correctMap.delete(event.index);
        return;
      }

      totalInputKeystrokes += 1;
      const prev = correctMap.get(event.index);
      if (prev === true) {
        correctBufferChars -= 1;
      } else if (prev === false) {
        uncorrectedErrors -= 1;
      }

      const isCorrect = event.key === event.expectedKey;
      if (isCorrect) {
        correctInputKeystrokes += 1;
        correctBufferChars += 1;
      } else {
        uncorrectedErrors += 1;
      }
      correctMap.set(event.index, isCorrect);
    },

    snapshot(elapsedMsSinceFirstKey: number): LiveMetricsSnapshot {
      const liveMs = Math.max(500, elapsedMsSinceFirstKey);
      return {
        wpm: computeWpmFromChars(correctBufferChars, liveMs),
        rawWpm: computeWpmFromChars(totalInputKeystrokes, liveMs),
        accuracy: computeAccuracyPercent(correctInputKeystrokes, totalInputKeystrokes),
        correctBufferChars,
        totalInputKeystrokes,
        correctInputKeystrokes,
        uncorrectedErrors,
        backspaceCount,
      };
    },
  };
}

export function computeConsistencyFromBuckets(perSecondRawWpms: number[], intervals: number[]): number {
  if (perSecondRawWpms.length >= 3) {
    const mean = perSecondRawWpms.reduce((a, b) => a + b, 0) / perSecondRawWpms.length;
    if (mean <= 0) return 0;
    const variance =
      perSecondRawWpms.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / perSecondRawWpms.length;
    const stdDev = Math.sqrt(variance);
    const rsd = stdDev / mean;
    return Math.max(0, Math.min(100, Math.round(100 * (1 - rsd))));
  }

  if (intervals.length > 2) {
    const capped = intervals.map((d) => Math.min(d, 2500));
    const mean = capped.reduce((a, b) => a + b, 0) / capped.length;
    if (mean <= 0) return 100;
    const variance = capped.reduce((acc, d) => acc + Math.pow(d - mean, 2), 0) / capped.length;
    const stdDev = Math.sqrt(variance);
    const rsd = stdDev / mean;
    return Math.max(0, Math.min(100, Math.round(100 * (1 - rsd))));
  }

  return 100;
}

export function evaluateFinalSession(
  rawEvents: KeystrokeInputEvent[],
  options: {
    durationLimit: number;
    reason: CompletionReason;
    endTime?: number;
  }
): TypingSessionResult | null {
  if (rawEvents.length === 0) return null;

  const events = [...rawEvents].sort((a, b) => a.time - b.time);
  const firstInput = events.find((e) => e.type === 'input');
  const startTime = firstInput ? firstInput.time : events[0].time;

  const lastEventTime = events[events.length - 1].time;
  const endTime =
    options.endTime !== undefined && options.endTime >= startTime ? options.endTime : lastEventTime;

  const totalElapsedMs =
    options.reason === 'timer'
      ? Math.max(1000, options.durationLimit * 1000)
      : Math.max(1000, endTime - startTime);

  const durationSecs = Math.max(1, Math.round(totalElapsedMs / 1000));
  const configuredDurationSecs =
    Number.isFinite(options.durationLimit) && options.durationLimit > 0
      ? Math.round(options.durationLimit)
      : durationSecs;

  const tracker = createMetricsTracker();
  const timeline: TimelinePoint[] = [];
  const perSecondInputs: number[] = [];

  const errorKeys: Record<string, number> = {};
  const slowKeys: Record<string, number[]> = {};
  const bigramTransitions: Record<string, number[]> = {};
  const correctIntervals: number[] = [];

  let cursorEventIdx = 0;
  let lastAppliedEvent: KeystrokeInputEvent | null = null;
  let prevCorrectInputTime: number | null = null;

  // O(N + S) forward sweep across second buckets s = 1..durationSecs
  for (let s = 1; s <= durationSecs; s += 1) {
    const cutoff = startTime + s * 1000;
    let inputsInThisSecond = 0;

    while (cursorEventIdx < events.length && events[cursorEventIdx].time <= cutoff) {
      const ev = events[cursorEventIdx];
      tracker.apply(ev);

      if (ev.type === 'input') {
        inputsInThisSecond += 1;

        if (ev.key !== ev.expectedKey) {
          errorKeys[ev.expectedKey] = (errorKeys[ev.expectedKey] || 0) + 1;
        } else {
          if (prevCorrectInputTime !== null) {
            const delta = ev.time - prevCorrectInputTime;
            if (delta >= 0) {
              correctIntervals.push(delta);
            }
          }
          prevCorrectInputTime = ev.time;

          if (
            lastAppliedEvent &&
            lastAppliedEvent.type === 'input' &&
            lastAppliedEvent.key === lastAppliedEvent.expectedKey
          ) {
            const diff = ev.time - lastAppliedEvent.time;
            if (diff > 0 && diff < 2500) {
              if (!slowKeys[ev.key]) slowKeys[ev.key] = [];
              slowKeys[ev.key].push(diff);

              const bigram = (lastAppliedEvent.key + ev.key).toLowerCase();
              if (bigram.length === 2 && /^[a-z]{2}$/.test(bigram)) {
                if (!bigramTransitions[bigram]) bigramTransitions[bigram] = [];
                bigramTransitions[bigram].push(diff);
              }
            }
          }
        }
      }

      lastAppliedEvent = ev;
      cursorEventIdx += 1;
    }

    perSecondInputs.push(inputsInThisSecond * 12);

    const cumSnap = tracker.snapshot(s * 1000);
    timeline.push({
      second: s,
      wpm: cumSnap.wpm,
      rawWpm: cumSnap.rawWpm,
    });
  }

  // Drain any events whose timestamp slightly exceeded durationSecs * 1000 (e.g. timer precision jitter)
  while (cursorEventIdx < events.length) {
    const ev = events[cursorEventIdx];
    tracker.apply(ev);
    if (ev.type === 'input') {
      if (ev.key !== ev.expectedKey) {
        errorKeys[ev.expectedKey] = (errorKeys[ev.expectedKey] || 0) + 1;
      } else if (
        lastAppliedEvent &&
        lastAppliedEvent.type === 'input' &&
        lastAppliedEvent.key === lastAppliedEvent.expectedKey
      ) {
        const diff = ev.time - lastAppliedEvent.time;
        if (diff > 0 && diff < 2500) {
          if (!slowKeys[ev.key]) slowKeys[ev.key] = [];
          slowKeys[ev.key].push(diff);

          const bigram = (lastAppliedEvent.key + ev.key).toLowerCase();
          if (bigram.length === 2 && /^[a-z]{2}$/.test(bigram)) {
            if (!bigramTransitions[bigram]) bigramTransitions[bigram] = [];
            bigramTransitions[bigram].push(diff);
          }
        }
      }
    }
    lastAppliedEvent = ev;
    cursorEventIdx += 1;
  }

  const finalSnap = tracker.snapshot(totalElapsedMs);
  const wpm = computeWpmFromChars(finalSnap.correctBufferChars, totalElapsedMs);
  const rawWpm = computeWpmFromChars(finalSnap.totalInputKeystrokes, totalElapsedMs);
  const consistency = computeConsistencyFromBuckets(perSecondInputs, correctIntervals);

  const keySpeeds: Record<string, number> = {};
  for (const [k, times] of Object.entries(slowKeys)) {
    keySpeeds[k] = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  }

  const bigramSpeeds: Record<string, number> = {};
  for (const [b, times] of Object.entries(bigramTransitions)) {
    bigramSpeeds[b] = Math.round(times.reduce((a, c) => a + c, 0) / times.length);
  }

  const telemetry: CompressedTelemetryPoint[] = events.map((ev) => ({
    t: Math.max(0, Math.round(ev.time - startTime)),
    k: ev.key,
    y: ev.type === 'input' ? 0 : 1,
    i: ev.index,
  }));

  return {
    wpm,
    rawWpm,
    accuracy: finalSnap.accuracy,
    consistency,
    errorCount: finalSnap.uncorrectedErrors,
    backspaceCount: finalSnap.backspaceCount,
    duration: configuredDurationSecs,
    elapsedSeconds: durationSecs,
    totalInputKeystrokes: finalSnap.totalInputKeystrokes,
    correctInputKeystrokes: finalSnap.correctInputKeystrokes,
    timeline,
    keySpeeds,
    errorKeys,
    bigramSpeeds,
    telemetry,
  };
}

