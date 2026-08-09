import { calculateCoreAttributes, calculateTypingDNA, serializeTelemetryPayload, parseTelemetryPayload, VersionedTelemetryPayload } from '@/telemetry';

/**
 * TyProX Automated Testing Assertion Suite (Phase 6 Quality Gates)
 * Validates critical business logic math, serializations, and formula precision.
 */
export class TelemetryTestSuite {
  public static runAllTests(): { passed: boolean; total: number; failed: number; log: string[] } {
    const log: string[] = [];
    let passed = 0;
    let failed = 0;

    const assert = (condition: boolean, testName: string) => {
      if (condition) {
        passed++;
        log.push(`✓ [PASS] ${testName}`);
      } else {
        failed++;
        log.push(`❌ [FAIL] ${testName}`);
      }
    };

    // Test 1: Empty Telemetry Attributes Assertion
    const emptyAttrs = calculateCoreAttributes([], 30, 100);
    assert(emptyAttrs.precision === 100 && emptyAttrs.consistency === 100, 'Empty Telemetry Core Attributes Baseline');

    // Test 2: Sample Keystroke Core Attributes Calculation
    const mockKeystrokes = [
      { t: 200, k: 't', y: 0, i: 0 },
      { t: 300, k: 'h', y: 0, i: 1 },
      { t: 400, k: 'e', y: 0, i: 2 },
    ];
    const attrs = calculateCoreAttributes(mockKeystrokes, 30, 100);
    assert(attrs.reactionTime === 200 && attrs.precision === 100, 'Core Attributes Math Calculation');

    // Test 3: Typing DNA Heatmap Calculation
    const dna = calculateTypingDNA(mockKeystrokes);
    assert(dna.bigramSpeeds['th'] === 100, 'Typing DNA Bigram Latency Math');

    // Test 4: Serializer Version 1 Protocol Compliance
    const payload: VersionedTelemetryPayload = {
      version: 1,
      duration: 30,
      mode: 'words',
      seed: 'test123',
      wpm: 120,
      rawWpm: 122,
      accuracy: 98,
      consistency: 95,
      errorCount: 1,
      backspaceCount: 1,
      attributes: attrs,
      dna,
      timeline: [{ second: 1, wpm: 120, rawWpm: 122 }],
      telemetry: mockKeystrokes,
    };
    const serialized = serializeTelemetryPayload(payload);
    const parsed = parseTelemetryPayload(serialized);
    assert(parsed !== null && parsed.version === 1 && parsed.wpm === 120, 'Telemetry Version 1 Serializer Roundtrip');

    return {
      passed: failed === 0,
      total: passed + failed,
      failed,
      log,
    };
  }
}
