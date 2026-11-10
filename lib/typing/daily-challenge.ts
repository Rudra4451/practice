import { cyrb128, mulberry32 } from '@/lib/typing/text-generator';
import type { RankedMode } from '@/lib/typing/metrics';

export interface DailyChallengeConfig {
  utcDate: string;
  seed: string;
  mode: RankedMode;
  duration: 30 | 60;
  label: string;
}

const DAILY_MODE_POOL: readonly RankedMode[] = ['words', 'quotes', 'punctuation', 'code'];
const DAILY_DURATION_POOL: readonly (30 | 60)[] = [30, 60];

export function formatUtcDateString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function getDailyChallengeConfig(date: Date = new Date()): DailyChallengeConfig {
  const utcDate = formatUtcDateString(date);
  const seed = `daily-${utcDate}`;
  const hash = cyrb128(seed)[0];
  const rand = mulberry32(hash);

  const mode = DAILY_MODE_POOL[Math.floor(rand() * DAILY_MODE_POOL.length)];
  const duration = DAILY_DURATION_POOL[Math.floor(rand() * DAILY_DURATION_POOL.length)];

  const modeTitle = mode.charAt(0).toUpperCase() + mode.slice(1);

  return {
    utcDate,
    seed,
    mode,
    duration,
    label: `${modeTitle} · ${duration}s`,
  };
}

export function getSecondsUntilNextUtcMidnight(now: Date = new Date()): number {
  const nextMidnightMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0
  );
  return Math.max(0, Math.floor((nextMidnightMs - now.getTime()) / 1000));
}

export function formatUtcCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  return [hours, minutes, seconds]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}

