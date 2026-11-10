'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Calendar, Clock, Trophy } from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { TypingContainer } from '@/components/typing/typing-container';
import { ResultScreen } from '@/components/typing/result-screen';
import { useTypingStore } from '@/stores/typing-store';
import { useUserStore } from '@/stores/user-store';
import { useHydrated } from '@/lib/hooks/use-hydrated';
import {
  formatUtcCountdown,
  getDailyChallengeConfig,
  getSecondsUntilNextUtcMidnight,
} from '@/lib/typing/daily-challenge';

export function DailyChallengeClient() {
  const hydrated = useHydrated();
  const { status, result, startTestWithConfig } = useTypingStore();
  const { dailyCompletions, recordDailyCompletion } = useUserStore();

  const config = useMemo(
    () => (hydrated ? getDailyChallengeConfig() : getDailyChallengeConfig(new Date('2026-01-01T00:00:00Z'))),
    [hydrated]
  );
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const startDailyRun = useCallback(() => {
    if (!hydrated) return;
    startTestWithConfig({
      mode: config.mode,
      duration: config.duration,
      seed: config.seed,
      targets: [],
    });
  }, [hydrated, config.mode, config.duration, config.seed, startTestWithConfig]);

  useEffect(() => {
    startDailyRun();
  }, [startDailyRun]);

  useEffect(() => {
    if (!hydrated) return;
    const interval = setInterval(() => {
      setSecondsLeft(getSecondsUntilNextUtcMidnight());
    }, 1000);
    return () => clearInterval(interval);
  }, [hydrated]);

  useEffect(() => {
    if (hydrated && status === 'completed' && result) {
      recordDailyCompletion(config.utcDate, {
        wpm: result.wpm,
        rawWpm: result.rawWpm,
        accuracy: result.accuracy,
        consistency: result.consistency,
        completedAt: new Date().toISOString(),
      });
    }
  }, [hydrated, status, result, config.utcDate, recordDailyCompletion]);

  const todayBest = hydrated ? (dailyCompletions ?? {})[config.utcDate] ?? null : null;
  const displayCountdown =
    hydrated && secondsLeft !== null
      ? formatUtcCountdown(secondsLeft)
      : hydrated
        ? formatUtcCountdown(getSecondsUntilNextUtcMidnight())
        : '--:--:--';

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 md:px-6 py-10 flex flex-col gap-8">
        {/* Daily Challenge Header Banner */}
        <div className="p-6 bg-surface border border-border rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/25 text-accent-ink text-xs font-bold uppercase tracking-wider">
                <Calendar className="w-3.5 h-3.5" />
                Daily UTC Challenge · {hydrated ? config.utcDate : 'UTC'}
              </span>
              <span className="px-3 py-1 rounded-full bg-surface-accent border border-border font-mono text-xs font-bold text-text-primary uppercase">
                {hydrated ? config.label : 'Loading'}
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-text-primary font-display">
              Shared Global Daily Prompt
            </h1>
            <p className="text-xs font-mono text-text-secondary">
              Seed: <span className="text-text-primary font-semibold">{hydrated ? config.seed : '...'}</span> · Every typist runs this identical prompt sequence today.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
            <div className="px-4 py-3 bg-background border border-border rounded-xl flex items-center gap-3">
              <Clock className="w-4 h-4 text-accent-ink shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                  Next UTC Reset
                </span>
                <span className="font-mono text-sm font-black text-text-primary tabular-nums">
                  {displayCountdown}
                </span>
              </div>
            </div>

            {todayBest && (
              <div className="px-4 py-3 bg-accent/10 border border-accent/25 rounded-xl flex items-center gap-3">
                <Trophy className="w-4 h-4 text-accent-ink shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent-ink">
                    Today&apos;s Best
                  </span>
                  <span className="font-mono text-sm font-black text-text-primary tabular-nums">
                    {todayBest.wpm} WPM · {todayBest.accuracy}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {status === 'completed' ? (
          <ResultScreen retryLabel="Retry Daily Prompt" onRetry={startDailyRun} />
        ) : (
          <TypingContainer hideConfigBar onRestartOverride={startDailyRun} />
        )}
      </main>
    </div>
  );
}
