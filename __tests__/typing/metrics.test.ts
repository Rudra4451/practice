import { describe, expect, it } from 'vitest';
import {
  VALID_DURATIONS,
  computeAccuracyPercent,
  computeConsistencyFromBuckets,
  createMetricsTracker,
  evaluateFinalSession,
  isRankedMode,
  normalizeBracketDuration,
  type KeystrokeInputEvent,
} from '@/lib/typing/metrics';

function buildSequentialEvents(
  target: string,
  intervalMs: number,
  startOffset = 0
): KeystrokeInputEvent[] {
  return target.split('').map((char, idx) => ({
    key: char,
    expectedKey: char,
    index: idx,
    time: startOffset + idx * intervalMs,
    type: 'input' as const,
  }));
}

describe('lib/typing/metrics', () => {
  it('Case A: prevents 1-char 60s idle exploit and computes 0 WPM across full 60s duration', () => {
    const events: KeystrokeInputEvent[] = [
      { key: 't', expectedKey: 't', index: 0, time: 1000, type: 'input' },
    ];

    const summary = evaluateFinalSession(events, {
      durationLimit: 60,
      reason: 'timer',
      endTime: 61_000,
    });

    expect(summary).not.toBeNull();
    expect(summary!.duration).toBe(60);
    expect(summary!.wpm).toBe(0);
    expect(summary!.rawWpm).toBe(0);
    expect(summary!.accuracy).toBe(100);
    expect(summary!.errorCount).toBe(0);
  });

  it('Case B: preserves backspaced mistakes in Raw WPM and Accuracy while computing clean Net WPM', () => {
    const events: KeystrokeInputEvent[] = [];
    let t = 0;

    // Type 120 net buffer chars plus 30 backspaced chars (15 wrong + 15 right retyped):
    // K_total = 150, K_correct = 135 (90.0% accuracy), final C_buffer = 120 chars.
    let cursor = 0;
    for (let i = 0; i < 15; i += 1) {
      events.push({ key: 'a', expectedKey: 'a', index: cursor, time: (t += 120), type: 'input' });
      events.push({ key: 'x', expectedKey: 'a', index: cursor + 1, time: (t += 120), type: 'input' });
      events.push({ key: 'Backspace', expectedKey: '', index: cursor + 1, time: (t += 120), type: 'delete' });
      events.push({ key: 'Backspace', expectedKey: '', index: cursor, time: (t += 120), type: 'delete' });
      events.push({ key: 'a', expectedKey: 'a', index: cursor, time: (t += 120), type: 'input' });
      cursor += 1;
    }

    while (cursor < 120) {
      events.push({ key: 'a', expectedKey: 'a', index: cursor, time: (t += 150), type: 'input' });
      cursor += 1;
    }

    const summary = evaluateFinalSession(events, {
      durationLimit: 30,
      reason: 'timer',
      endTime: 30_000,
    });

    expect(summary).not.toBeNull();
    expect(summary!.duration).toBe(30);
    expect(summary!.wpm).toBe(48); // (120 / 5) / 0.5 = 48
    expect(summary!.rawWpm).toBe(60); // (150 / 5) / 0.5 = 60
    expect(summary!.accuracy).toBe(90); // 135 / 150 = 90.0%
    expect(summary!.errorCount).toBe(0);
    expect(summary!.backspaceCount).toBe(30);
  });

  it('Case C: measures actual elapsed seconds for WPM on early completion while keeping configured duration bracket', () => {
    const text = 'a'.repeat(180);
    const events = buildSequentialEvents(text, 100); // 0..17900ms
    const summary = evaluateFinalSession(events, {
      durationLimit: 60,
      reason: 'text_complete',
      endTime: 18_000,
    });

    expect(summary).not.toBeNull();
    expect(summary!.duration).toBe(60);
    expect(summary!.elapsedSeconds).toBe(18);
    expect(summary!.wpm).toBe(120); // (180 / 5) / (18/60) = 120
    expect(summary!.rawWpm).toBe(120);
    expect(summary!.accuracy).toBe(100);
  });

  it('preserves canonical bracket across all supported test durations on early completion and normalizes brackets cleanly', () => {
    for (const bracket of VALID_DURATIONS) {
      const text = 'a'.repeat(60);
      const events = buildSequentialEvents(text, 100);
      const summary = evaluateFinalSession(events, {
        durationLimit: bracket,
        reason: 'text_complete',
        endTime: 6_000,
      });

      expect(summary).not.toBeNull();
      expect(summary!.duration).toBe(bracket);
      expect(summary!.elapsedSeconds).toBe(6);
      expect(summary!.wpm).toBe(120);
    }

    expect(normalizeBracketDuration(10)).toBe(15);
    expect(normalizeBracketDuration(15)).toBe(15);
    expect(normalizeBracketDuration(22)).toBe(30);
    expect(normalizeBracketDuration(45)).toBe(60);
    expect(normalizeBracketDuration(95)).toBe(120);
    expect(normalizeBracketDuration(180)).toBe(120);
    expect(isRankedMode('words')).toBe(true);
    expect(isRankedMode('drill')).toBe(false);
    expect(isRankedMode('lesson')).toBe(false);
    expect(isRankedMode('daily')).toBe(false);
  });

  it('prevents consistency from collapsing to 0 on a single short pause', () => {
    const buckets = [
      96, 96, 96, 96, 96, 96, 96, 96, 96, 96,
      0, 0,
      96, 96, 96, 96, 96, 96, 96, 96,
    ];
    const consistency = computeConsistencyFromBuckets(buckets, []);
    expect(consistency).toBeGreaterThan(50);
    expect(consistency).toBeLessThan(80);
  });

  it('tracks O(1) incremental live snapshot accurately and clamps initial 500ms floor', () => {
    const tracker = createMetricsTracker();
    tracker.apply({ type: 'input', index: 0, key: 't', expectedKey: 't' });
    const earlySnap = tracker.snapshot(5); // 5ms shouldn't flash 600 WPM
    expect(earlySnap.wpm).toBeLessThanOrEqual(40);
    expect(computeAccuracyPercent(0, 0)).toBe(100);
  });

  it('evaluates 2,500 keystrokes across 120s linearly under 30ms', () => {
    const text = 'typing test performance check '.repeat(84).slice(0, 2500);
    const events = buildSequentialEvents(text, 48); // ~120s at 250 WPM
    const start = performance.now();
    const summary = evaluateFinalSession(events, {
      durationLimit: 120,
      reason: 'timer',
      endTime: 120_000,
    });
    const elapsed = performance.now() - start;

    expect(summary).not.toBeNull();
    expect(summary!.timeline).toHaveLength(120);
    expect(elapsed).toBeLessThan(30);
  });
});
