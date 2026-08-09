import { VersionedTelemetryPayload } from './types';

/**
 * Serializes and parses versioned telemetry payloads (ADR-005)
 */
export function serializeTelemetryPayload(payload: VersionedTelemetryPayload): string {
  return JSON.stringify({
    ...payload,
    version: 1, // Enforce version: 1 header
  });
}

export function parseTelemetryPayload(raw: string | object): VersionedTelemetryPayload | null {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!data || typeof data !== 'object') return null;

    // Check version header
    const version = data.version || 1;

    if (version === 1) {
      return {
        version: 1,
        duration: Number(data.duration) || 0,
        mode: String(data.mode || 'words'),
        seed: String(data.seed || ''),
        wpm: Number(data.wpm) || 0,
        rawWpm: Number(data.rawWpm) || 0,
        accuracy: Number(data.accuracy) || 100,
        consistency: Number(data.consistency) || 100,
        errorCount: Number(data.errorCount) || 0,
        backspaceCount: Number(data.backspaceCount) || 0,
        attributes: data.attributes || {
          reactionTime: 0,
          precision: 100,
          consistency: 100,
          rhythm: 100,
          acceleration: 0,
        },
        dna: data.dna || { alphabetSpeeds: {}, bigramSpeeds: {}, errorFrequencies: {} },
        timeline: Array.isArray(data.timeline) ? data.timeline : [],
        telemetry: Array.isArray(data.telemetry) ? data.telemetry : [],
      };
    }

    // Future version migrations can be handled here without breaking version 1
    return null;
  } catch (err) {
    console.error('Telemetry deserialization error:', err);
    return null;
  }
}
