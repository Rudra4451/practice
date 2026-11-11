import { describe, expect, it } from 'vitest';
import { generateText } from '@/lib/typing/text-generator';
import { verifyAndScoreSession } from '@/lib/typing/verifier';

function simulateHumanTelemetry(
  targetText: string,
  count: number,
  stepMs = 135
) {
  const events = [];
  let t = 0;
  for (let i = 0; i < count; i += 1) {
    // Include organic keystroke jitter so autotyper constant-delta check passes
    const jitter = (i % 5) * 6 - 12;
    if (i > 0) t += stepMs + jitter;
    events.push({
      t,
      k: targetText[i],
      y: 0 as const,
      i,
    });
  }
  return events;
}

describe('lib/typing/verifier', () => {
  it('accepts legitimate telemetry and recomputes authoritative metrics server-side', () => {
    const seed = 'deadbeef1234';
    const mode = 'words' as const;
    const duration = 30 as const;
    const target = generateText(seed, mode, duration);
    const telemetry = simulateHumanTelemetry(target, 150, 125); // 150 chars in ~18.6s over 30s test -> (150/5)/0.5 = 60 WPM

    const outcome = verifyAndScoreSession({ mode, duration, seed, telemetry });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.wpm).toBe(60);
      expect(outcome.result.rawWpm).toBe(60);
      expect(outcome.result.accuracy).toBe(100);
      expect(outcome.result.duration).toBe(30);
    }
  });

  it('scores 1-char 60s idle telemetry at 0 WPM instead of 200 WPM', () => {
    const seed = 'idleexploit12';
    const target = generateText(seed, 'words', 60);
    const outcome = verifyAndScoreSession({
      mode: 'words',
      duration: 60,
      seed,
      telemetry: [{ t: 0, k: target[0], y: 0, i: 0 }],
    });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.wpm).toBe(0);
      expect(outcome.result.duration).toBe(60);
    }
  });

  it('rejects empty telemetry', () => {
    const outcome = verifyAndScoreSession({
      mode: 'words',
      duration: 30,
      seed: 'abcdef123456',
      telemetry: [],
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.status).toBe(400);
  });

  it('rejects cursor progression tampering', () => {
    const seed = 'tampercursor1';
    const target = generateText(seed, 'words', 15);
    const outcome = verifyAndScoreSession({
      mode: 'words',
      duration: 15,
      seed,
      telemetry: [
        { t: 0, k: target[0], y: 0, i: 0 },
        { t: 140, k: target[5], y: 0, i: 5 }, // Skips indices 1..4
      ],
    });
    expect(outcome.ok).toBe(false);
  });

  it('rejects non-monotonic timestamps', () => {
    const seed = 'timetravel12';
    const target = generateText(seed, 'words', 15);
    const outcome = verifyAndScoreSession({
      mode: 'words',
      duration: 15,
      seed,
      telemetry: [
        { t: 200, k: target[0], y: 0, i: 0 },
        { t: 100, k: target[1], y: 0, i: 1 },
      ],
    });
    expect(outcome.ok).toBe(false);
  });

  it('rejects constant-cadence robotic autotipers and inhuman bursts', () => {
    const seed = 'botcadence12';
    const target = generateText(seed, 'words', 30);

    // Constant exact 120ms intervals over 25 chars
    const constantBot = target.slice(0, 25).split('').map((k, idx) => ({
      t: idx * 120,
      k,
      y: 0 as const,
      i: idx,
    }));
    expect(
      verifyAndScoreSession({ mode: 'words', duration: 30, seed, telemetry: constantBot }).ok
    ).toBe(false);

    // 18-char macro burst in 5ms intervals with varied jitter <20ms avg
    const burstBot = target.slice(0, 18).split('').map((k, idx) => ({
      t: idx * 8 + (idx % 3),
      k,
      y: 0 as const,
      i: idx,
    }));
      expect(verifyAndScoreSession({ mode: 'words', duration: 30, seed, telemetry: burstBot }).ok).toBe(false);
  });

  it('preserves configuredDuration across all ranked brackets including early text_complete and propagates clientRunId', () => {
    const clientRunId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

    // Early text completion on 15s code (< 15s while staying <= 260 WPM human ceiling)
    const earlySeed = 'earlybracket12';
    const earlyTarget = generateText(earlySeed, 'code', 30);
    // Use 54ms/char (~222 WPM <= 260 WPM) which completes 30s code (~500 chars) in ~27s < 30s
    const earlyStepMs = Math.max(48, Math.floor((27_500) / Math.max(1, earlyTarget.length - 1)));
    const earlyTelemetry = simulateHumanTelemetry(earlyTarget, earlyTarget.length, earlyStepMs);

    const earlyOutcome = verifyAndScoreSession({
      mode: 'code',
      duration: 30,
      seed: earlySeed,
      clientRunId,
      telemetry: earlyTelemetry,
    });

    expect(earlyOutcome.ok).toBe(true);
    if (earlyOutcome.ok) {
      expect(earlyOutcome.configuredDuration).toBe(30);
      expect(earlyOutcome.clientRunId).toBe(clientRunId);
      expect(earlyOutcome.result.duration).toBe(30);
      expect(earlyOutcome.result.elapsedSeconds).toBeLessThan(30);
      expect(earlyOutcome.result.wpm).toBeGreaterThan(0);
    }

    // All canonical durations (15, 30, 60, 120) verify cleanly and keep configuredDuration
    for (const bracket of [15, 30, 60, 120] as const) {
      const seed = `bracket_${bracket}_seed`;
      const target = generateText(seed, 'words', bracket);
      const telemetry = simulateHumanTelemetry(target, Math.min(80, target.length), 130);
      const outcome = verifyAndScoreSession({
        mode: 'words',
        duration: bracket,
        seed,
        clientRunId,
        telemetry,
      });
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.configuredDuration).toBe(bracket);
        expect(outcome.result.duration).toBe(bracket);
      }
    }
  });
});

