import { describe, expect, it } from 'vitest';
import { analyzeReplaySessions } from '@/lib/typing/replay-analyzer';
import { generateText } from '@/lib/typing/text-generator';
import type { CompressedTelemetryPoint } from '@/lib/typing/metrics';

describe('analyzeReplaySessions', () => {
  it('reconstructs seeded target text, captures corrected mismatch errors, computes finger loads and slow bigrams', () => {
    const seed = 'lab-analyzer-seed';
    const mode = 'words';
    const duration = 30;
    const expectedText = generateText(seed, mode, duration);

    // Deliberately mistype characters 0 and 1, backspace once, and type steady bigrams
    const telemetry: CompressedTelemetryPoint[] = [
      { t: 0, k: expectedText[0] === 'x' ? 'z' : 'x', y: 0, i: 0 }, // error at i=0
      { t: 90, k: 'Backspace', y: 1, i: 0 },
      { t: 180, k: expectedText[0], y: 0, i: 0 },
      { t: 280, k: expectedText[1], y: 0, i: 1 },
      { t: 420, k: expectedText[2] === 'q' ? 'w' : 'q', y: 0, i: 2 }, // uncorrected error at i=2
      { t: 540, k: expectedText[3], y: 0, i: 3 },
      // Repeated 'th' bigram across subsequent inputs (using unaligned indices on non-matching chars)
      { t: 700, k: 't', y: 0, i: 4 },
      { t: 1050, k: 'h', y: 0, i: 5 },
      { t: 1200, k: 't', y: 0, i: 6 },
      { t: 1650, k: 'h', y: 0, i: 7 },
    ];

    const result = analyzeReplaySessions([{ telemetry, seed, mode, duration }]);

    expect(result.totalSessions).toBe(1);
    expect(result.totalKeystrokes).toBe(9);
    expect(result.handDistribution.left + result.handDistribution.right).toBe(100);

    const fingerHitsSum = result.fingerLoads.reduce((sum, f) => sum + f.hits, 0);
    expect(fingerHitsSum).toBe(9);

    // Expected characters at index 0 and 2 were both missed and tracked
    const expectedZero = expectedText[0].toLowerCase();
    const expectedTwo = expectedText[2].toLowerCase();
    const weakMap = new Map(result.weakKeys.map((w) => [w.key, w]));

    expect(weakMap.get(expectedZero)?.errors).toBeGreaterThanOrEqual(1);
    if (expectedTwo !== expectedZero) {
      expect(weakMap.get(expectedTwo)?.errors).toBeGreaterThanOrEqual(1);
    }

    // Backspace breaks incorrect sequence cleanly; valid bigrams have positive avgMs
    for (const bigram of result.slowBigrams) {
      expect(bigram.bigram).toMatch(/^[a-z]{2}$/);
      expect(bigram.avgMs).toBeGreaterThan(0);
      expect(bigram.count).toBeGreaterThanOrEqual(1);
    }
  });

  it('falls back safely to delete-based error attribution when seed is absent', () => {
    const telemetry: CompressedTelemetryPoint[] = [
      { t: 0, k: 'q', y: 0, i: 0 },
      { t: 100, k: 'Backspace', y: 1, i: 0 },
      { t: 200, k: 'a', y: 0, i: 0 },
      { t: 310, k: 's', y: 0, i: 1 },
    ];

    const result = analyzeReplaySessions([{ telemetry }]);

    expect(result.totalSessions).toBe(1);
    expect(result.weakKeys).toHaveLength(1);
    expect(result.weakKeys[0].key).toBe('q');
    expect(result.weakKeys[0].errors).toBe(1);
  });

  it('returns balanced defaults for empty session lists', () => {
    const result = analyzeReplaySessions([]);

    expect(result.totalSessions).toBe(0);
    expect(result.totalKeystrokes).toBe(0);
    expect(result.handDistribution).toEqual({ left: 50, right: 50 });
    expect(result.weakKeys).toEqual([]);
    expect(result.slowBigrams).toEqual([]);
  });
});

