import { KeystrokeEvent, CoreAttributes } from './types';

/**
 * Calculates the 5 Core Attributes from raw keystroke telemetry stream
 */
export function calculateCoreAttributes(
  keystrokes: KeystrokeEvent[],
  totalDurationSecs: number,
  accuracy: number
): CoreAttributes {
  if (keystrokes.length === 0) {
    return {
      reactionTime: 0,
      precision: 100,
      consistency: 100,
      rhythm: 100,
      acceleration: 0,
    };
  }

  // 1. Reaction Time: Time delta to first keystroke
  const reactionTime = Math.max(0, Math.round(keystrokes[0].t));

  // 2. Precision: Direct accuracy percentage
  const precision = Math.max(0, Math.min(100, Math.round(accuracy)));

  // 3. Consistency (Relative Standard Deviation / RSD)
  const correctKeystrokes = keystrokes.filter((k) => k.y === 0);
  let consistency = 100;

  if (correctKeystrokes.length > 2) {
    const intervals: number[] = [];
    for (let i = 1; i < correctKeystrokes.length; i++) {
      const diff = correctKeystrokes[i].t - correctKeystrokes[i - 1].t;
      if (diff > 0 && diff < 5000) {
        intervals.push(diff);
      }
    }

    if (intervals.length > 1) {
      const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      if (mean > 0) {
        const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length;
        const stdDev = Math.sqrt(variance);
        const rsd = stdDev / mean;
        consistency = Math.max(0, Math.min(100, Math.round(100 * (1 - rsd))));
      }
    }
  }

  // 4. Rhythm Stability Index
  let rhythm = 100;
  if (correctKeystrokes.length > 3) {
    const deltas: number[] = [];
    for (let i = 2; i < correctKeystrokes.length; i++) {
      const interval1 = correctKeystrokes[i - 1].t - correctKeystrokes[i - 2].t;
      const interval2 = correctKeystrokes[i].t - correctKeystrokes[i - 1].t;
      deltas.push(Math.abs(interval2 - interval1));
    }

    if (deltas.length > 0) {
      const meanDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      rhythm = Math.max(0, Math.min(100, Math.round(100 - Math.min(100, meanDelta / 5))));
    }
  }

  // 5. Acceleration: Speed differential across 1st half vs 2nd half
  const midSec = Math.max(1, totalDurationSecs / 2);
  const midMs = midSec * 1000;

  const firstHalfChars = correctKeystrokes.filter((k) => k.t <= midMs).length;
  const secondHalfChars = correctKeystrokes.filter((k) => k.t > midMs).length;

  const firstHalfWpm = (firstHalfChars / 5) / (midSec / 60);
  const secondHalfWpm = (secondHalfChars / 5) / (midSec / 60);
  const acceleration = Math.round(secondHalfWpm - firstHalfWpm);

  return {
    reactionTime,
    precision,
    consistency,
    rhythm,
    acceleration,
  };
}
