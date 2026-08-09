// TyProX Intelligence Layer Types (Sprint 2 - ADR-008 through ADR-014)

export type SkillNodeKey =
  | 'reaction'
  | 'precision'
  | 'consistency'
  | 'rhythm'
  | 'acceleration'
  | 'focus'
  | 'endurance'
  | 'fingerIndependence'
  | 'errorRecovery'
  | 'confidence'
  | 'learningVelocity'
  | 'speedCeiling';

export interface SkillGraphNode {
  key: SkillNodeKey;
  label: string;
  value: number; // 0-100 score
}

export interface SkillGraphEdge {
  from: SkillNodeKey;
  to: SkillNodeKey;
  weight: number; // Influence weight (0.0 to 1.0)
}

export interface KnowledgeGraph {
  nodes: Record<SkillNodeKey, SkillGraphNode>;
  edges: SkillGraphEdge[];
}

export interface TelemetryV2Event {
  t: number;            // Keydown relative timestamp (ms)
  u?: number;           // Keyup relative timestamp (ms)
  k: string;            // Key character
  y: number;            // 0 = input, 1 = delete
  i: number;            // Target character index
  finger?: string;      // Touch-typing finger ('L1'-'L4', 'R1'-'R4', 'Thumb')
  hand?: 'left' | 'right';
  holdDuration?: number; // ms
  flightTime?: number;   // ms from previous keyup
}

export interface DetailedSessionAnalysis {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
  rhythm: number;
  reactionTimeMs: number;
  holdDurationAvgMs: number;
  flightTimeAvgMs: number;
  idleCount: number;
  burstPeakWpm: number;
  leftHandRatio: number;
  rightHandRatio: number;
  fingerSpeeds: Record<string, number>;
  weakFrequencies: Record<string, number>;
  digraphLatencies: Record<string, number>;
  trigraphLatencies: Record<string, number>;
  fatigueDecayPercent: number;
  errorRecoveryMs: number;
}

export interface TypingDNAV2Snapshot {
  version: 2;
  timestamp: string;
  fingerHeatmap: Record<string, number>;
  handBalance: { left: number; right: number };
  weakFingers: Array<{ finger: string; latencyMs: number }>;
  fastestKeys: Array<{ key: string; latencyMs: number }>;
  slowestKeys: Array<{ key: string; latencyMs: number }>;
  fastestDigraphs: Array<{ bigram: string; latencyMs: number }>;
  weakestDigraphs: Array<{ bigram: string; latencyMs: number }>;
  weakestTrigraphs: Array<{ trigram: string; latencyMs: number }>;
  fatigueDecay: number;
  recoverySpeedMs: number;
  confidenceScore: number;
}

export interface CompiledDrill {
  id: string;
  title: string;
  category: 'english' | 'symbols' | 'react' | 'typescript' | 'python' | 'sql' | 'markdown';
  passageText: string;
  difficultyRating: number; // 1-100
  targetFingers: string[];
  targetDigraphs: string[];
  expectedDurationSecs: number;
  repeatabilityScore: number; // 1-100
  estimatedImprovement: string;
}

export interface PracticeRecommendation {
  type: 'warmup' | 'accuracy' | 'speed' | 'weak_finger' | 'symbols' | 'code' | 'endurance' | 'recovery';
  title: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  drill: CompiledDrill;
}

export interface TelemetryForecast {
  wpm7DayForecast: number;
  wpm30DayForecast: number;
  plateauRisk: boolean;
  estimatedDaysToNextMilestone: number;
  confidenceInterval: { lower: number; upper: number };
}

export interface PersonalBenchmark {
  metric: string;
  currentValue: number;
  previousWeekAvg: number;
  previousMonthAvg: number;
  personalBest: number;
  rollingAvg10: number;
  percentImprovement: number;
}
