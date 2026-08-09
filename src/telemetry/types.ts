// Telemetry Engine Types & Schemas (Telemetry Bible & ADR-005)

export interface KeystrokeEvent {
  t: number; // Relative timestamp (ms) since start
  k: string; // Key character string
  y: number; // Key action: 0 = input, 1 = delete
  i: number; // Target character index
}

export interface CoreAttributes {
  reactionTime: number; // ms to first keypress
  precision: number;    // % accuracy
  consistency: number;  // 0-100% RSD score
  rhythm: number;       // rhythm stability index (0-100)
  acceleration: number; // WPM delta across first/second halves
}

export interface TypingDNAVector {
  alphabetSpeeds: Record<string, number>; // key -> avg interval (ms)
  bigramSpeeds: Record<string, number>;     // bigram -> avg interval (ms)
  errorFrequencies: Record<string, number>; // key -> error count
}

export interface VersionedTelemetryPayload {
  version: 1;
  duration: number;
  mode: string;
  seed: string;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
  errorCount: number;
  backspaceCount: number;
  attributes: CoreAttributes;
  dna: TypingDNAVector;
  timeline: Array<{ second: number; wpm: number; rawWpm: number }>;
  telemetry: KeystrokeEvent[];
}
