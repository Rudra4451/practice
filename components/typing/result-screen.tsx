'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useTypingStore } from '@/stores/typing-store';
import { useUserStore } from '@/stores/user-store';
import { useToastStore } from '@/stores/toast-store';
import { normalizeBracketDuration } from '@/lib/typing/metrics';
import { ReplayPlayer } from './replay-player';
import { CatCompanion } from './cat-companion';
import { RefreshCw, Play, Share2, Award, TrendingUp, Target, AlertCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { motion } from 'framer-motion';

const ResultChart = dynamic(() => import('./result-chart'), {
  ssr: false,
  loading: () => (
    <div className="h-[200px] flex items-center justify-center text-text-secondary uppercase tracking-widest text-xs font-bold font-mono">
      Loading Chart...
    </div>
  ),
});

interface SubmissionRecord {
  runId: string;
  status: 'saved' | 'error';
  errorMessage?: string;
  savedResultId: string | null;
  unlocked: string[];
  isPersonalBest: boolean;
  previousBestWpm: number | null;
  streakDays: number;
}

const inFlightSubmissions = new Map<string, Promise<SubmissionRecord>>();
const recordedGuestRuns = new Set<string>();

function submitRankedResultOnce(payload: {
  clientRunId: string;
  mode: string;
  duration: number;
  seed: string;
  telemetry: Array<{ t: number; k: string; i: number; y: 0 | 1 }>;
}): Promise<SubmissionRecord> {
  const existing = inFlightSubmissions.get(payload.clientRunId);
  if (existing) {
    return existing;
  }

  const request = fetch('/api/results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(async (res): Promise<SubmissionRecord> => {
      let data: {
        success?: boolean;
        error?: string;
        result?: { id?: string };
        unlocked?: string[];
        isPersonalBest?: boolean;
        previousBestWpm?: number | null;
        streakDays?: number;
      } = {};
      try {
        data = (await res.json()) as typeof data;
      } catch {
        data = {};
      }

      if (!res.ok || !data.success) {
        inFlightSubmissions.delete(payload.clientRunId);
        return {
          runId: payload.clientRunId,
          status: 'error',
          errorMessage: data.error || 'Could not save verified test result.',
          savedResultId: null,
          unlocked: [],
          isPersonalBest: false,
          previousBestWpm: null,
          streakDays: 1,
        };
      }

      return {
        runId: payload.clientRunId,
        status: 'saved',
        savedResultId: data.result?.id ?? null,
        unlocked: data.unlocked ?? [],
        isPersonalBest: Boolean(data.isPersonalBest),
        previousBestWpm:
          typeof data.previousBestWpm === 'number' ? data.previousBestWpm : null,
        streakDays: typeof data.streakDays === 'number' ? data.streakDays : 1,
      };
    })
    .catch((err): SubmissionRecord => {
      inFlightSubmissions.delete(payload.clientRunId);
      logger.error('Error submitting test score', { category: 'api', error: err });
      return {
        runId: payload.clientRunId,
        status: 'error',
        errorMessage: 'Network error while saving verified result.',
        savedResultId: null,
        unlocked: [],
        isPersonalBest: false,
        previousBestWpm: null,
        streakDays: 1,
      };
    });

  if (inFlightSubmissions.size >= 100) {
    const oldestKey = inFlightSubmissions.keys().next().value;
    if (oldestKey) inFlightSubmissions.delete(oldestKey);
  }
  inFlightSubmissions.set(payload.clientRunId, request);
  return request;
}

interface ResultScreenProps {
  retryLabel?: string;
  onRetry?: () => void;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  retryLabel = 'Next Test',
  onRetry,
}) => {
  const {
    targetText,
    result,
    resetTest,
    seed,
    mode,
    duration,
    clientRunId,
    isRankedRun,
  } = useTypingStore();
  const { session, guestHistory, addGuestResult } = useUserStore();
  const { showToast } = useToastStore();

  const [showReplay, setShowReplay] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [submission, setSubmission] = useState<SubmissionRecord | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  // Pre-compute authentic prior guest PB cleanly without mutating state during effect
  const guestPbEvaluation = useMemo(() => {
    if (!result) return { isPb: false, previousBestWpm: null as number | null };
    const priorSameConfig = guestHistory.filter(
      (item) =>
        item.clientRunId !== clientRunId &&
        item.mode === mode &&
        item.duration === result.duration
    );
    if (priorSameConfig.length === 0) {
      return {
        isPb: result.wpm > 0,
        previousBestWpm: null as number | null,
      };
    }
    const maxPrior = Math.max(...priorSameConfig.map((item) => item.wpm));
    return {
      isPb: result.wpm > maxPrior && result.wpm > 0,
      previousBestWpm: maxPrior,
    };
  }, [guestHistory, clientRunId, mode, result]);

  // Single-submit idempotent persistence per completed clientRunId (StrictMode-safe)
  useEffect(() => {
    if (!result || !clientRunId) return;

    let cancelled = false;

    if (session?.user && isRankedRun) {
      const submissionDuration = normalizeBracketDuration(
        result.duration || duration
      );
      submitRankedResultOnce({
        mode,
        duration: submissionDuration,
        seed,
        clientRunId,
        telemetry: result.telemetry,
      }).then((record) => {
        if (!cancelled) {
          setSubmission(record);
        }
      });
    } else if (!recordedGuestRuns.has(clientRunId)) {
      recordedGuestRuns.add(clientRunId);
      addGuestResult({
        id: clientRunId,
        clientRunId,
        wpm: result.wpm,
        raw_wpm: result.rawWpm,
        accuracy: result.accuracy,
        consistency: result.consistency,
        error_count: result.errorCount,
        backspace_count: result.backspaceCount,
        mode,
        duration: result.duration,
        seed,
        isRanked: isRankedRun,
        telemetry: result.telemetry,
        created_at: new Date().toISOString(),
      });
    }

    return () => {
      cancelled = true;
    };
  }, [
    result,
    clientRunId,
    session,
    isRankedRun,
    mode,
    duration,
    seed,
    addGuestResult,
  ]);

  const activeSubmission =
    submission && submission.runId === clientRunId ? submission : null;

  const isSaving = Boolean(
    result && session?.user && isRankedRun && activeSubmission === null
  );

  const isPersonalBest =
    session?.user && isRankedRun
      ? Boolean(activeSubmission?.isPersonalBest)
      : guestPbEvaluation.isPb;

  const unlocked = activeSubmission?.unlocked ?? [];
  const streakDays = activeSubmission?.streakDays ?? (guestHistory.length > 0 ? 1 : 0);

  // Lazy celebratory confetti on true Personal Best or high-speed 100% accuracy (with cleanup + reduced-motion guard)
  useEffect(() => {
    if (!result) return;
    const shouldCelebrate =
      isPersonalBest || (result.accuracy === 100 && result.wpm >= 40);
    if (!shouldCelebrate) return;

    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    let cancelled = false;
    let rafId: number | null = null;

    import('canvas-confetti')
      .then((mod) => {
        if (cancelled) return;
        const fire = mod.default;
        const end = Date.now() + 1800;

        const frame = () => {
          if (cancelled) return;
          fire({
            particleCount: 4,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#FF641F', '#F5F5F3', '#A1A1A1'],
          });
          fire({
            particleCount: 4,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#FF641F', '#F5F5F3', '#A1A1A1'],
          });

          if (Date.now() < end && !cancelled) {
            rafId = requestAnimationFrame(frame);
          }
        };

        rafId = requestAnimationFrame(frame);
      })
      .catch(() => {
        // Ignore confetti module failure gracefully
      });

    return () => {
      cancelled = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [result, isPersonalBest]);

  if (!result) return null;

  const copyTextWithFeedback = async (urlToCopy: string) => {
    try {
      if (
        typeof navigator === 'undefined' ||
        !navigator.clipboard ||
        typeof navigator.clipboard.writeText !== 'function'
      ) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(urlToCopy);
      setCopied(true);
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopied(false);
        copyTimeoutRef.current = null;
      }, 2500);
    } catch {
      showToast('Clipboard access blocked. Please copy the challenge URL manually.', 'error');
    }
  };

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);

    try {
      let savedId = activeSubmission?.savedResultId ?? null;
      if (!savedId && session?.user && isRankedRun && clientRunId) {
        const pending = inFlightSubmissions.get(clientRunId);
        if (pending) {
          const settled = await pending;
          if (settled.runId === clientRunId) {
            savedId = settled.savedResultId;
          }
        }
      }

      if (session?.user && savedId) {
        try {
          const res = await fetch('/api/challenges', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ testResultId: savedId }),
          });

          const data = (await res.json()) as {
            success?: boolean;
            url?: string;
            error?: string;
          };
          if (res.ok && data.success && data.url) {
            const challengeUrl = `${window.location.origin}${data.url}`;
            await copyTextWithFeedback(challengeUrl);
            return;
          }
          showToast(
            data.error ||
              'Could not create verified 1v1 challenge; copied practice link instead.',
            'info'
          );
        } catch (err) {
          logger.error('Failed to create challenge link', { category: 'api', error: err });
          showToast(
            'Could not create verified 1v1 challenge; copied practice link instead.',
            'info'
          );
        }
      }

      const fallbackUrl = `${window.location.origin}/typing?seed=${encodeURIComponent(seed)}&mode=${encodeURIComponent(mode)}&duration=${duration}`;
      await copyTextWithFeedback(fallbackUrl);
    } finally {
      setSharing(false);
    }
  };

  const missedKeys = Object.entries(result.errorKeys)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const drillTargetsQuery = missedKeys
    .map(([k]) => k.trim().toLowerCase())
    .filter((k) => k.length === 1 && /[a-z0-9]/.test(k))
    .join(',');

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-8 px-4 py-6 animate-fade-in">
      {isSaving && (
        <div className="flex items-center gap-2 px-4 py-2.5 border border-border bg-surface rounded-lg text-xs font-bold uppercase tracking-wider text-text-secondary shadow-xs">
          <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <span>Verifying and saving result...</span>
        </div>
      )}

      {activeSubmission?.status === 'error' && session?.user && isRankedRun && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border border-error/40 bg-error/10 text-error rounded-xl text-xs font-semibold"
        >
          <span className="inline-flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{activeSubmission.errorMessage || 'Failed to verify and save score.'}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              if (!clientRunId || !result) return;
              const submissionDuration = normalizeBracketDuration(
                result.duration || duration
              );
              setSubmission(null);
              submitRankedResultOnce({
                mode,
                duration: submissionDuration,
                seed,
                clientRunId,
                telemetry: result.telemetry,
              }).then((record) => {
                setSubmission(record);
              });
            }}
            className="px-3 py-1.5 rounded-lg border border-error/40 bg-surface text-text-primary font-bold uppercase tracking-wider hover:bg-surface-accent transition-colors cursor-pointer"
          >
            Retry Save
          </button>
        </div>
      )}

      {showReplay ? (
        <ReplayPlayer
          targetText={targetText}
          telemetry={result.telemetry}
          onClose={() => setShowReplay(false)}
        />
      ) : (
        <>
          {unlocked.length > 0 && (
            <div className="p-4 bg-accent/10 border border-accent/40 text-text-primary flex items-center gap-3 rounded-xl shadow-xs">
              <Award className="w-5 h-5 text-accent-ink flex-shrink-0" />
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase tracking-wider text-accent-ink">
                  Achievement Unlocked
                </span>
                <span className="text-xs font-semibold mt-0.5 text-text-secondary">
                  {unlocked.join(', ')}
                </span>
              </div>
            </div>
          )}

          {/* Primary KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="p-6 bg-surface/40 border border-border/80 text-text-primary rounded-2xl shadow-sm flex flex-col relative overflow-hidden"
            >
              {isPersonalBest && (
                <div className="absolute top-3 right-3 px-2 py-0.5 bg-accent/15 border border-accent/35 rounded text-[10px] font-bold uppercase tracking-widest text-accent-ink">
                  Personal Best
                </div>
              )}
              <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                Speed
              </span>
              <span className="text-4xl md:text-5xl font-black font-mono mt-2 leading-none text-accent-ink tabular-nums">
                <AnimatedCounter value={result.wpm} duration={1100} />
              </span>
              <span className="text-xs uppercase font-bold mt-1.5 text-text-secondary">
                Net WPM
              </span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-6 bg-surface/40 border border-border/80 text-text-primary rounded-2xl shadow-sm flex flex-col"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                Accuracy
              </span>
              <span className="text-4xl md:text-5xl font-black font-mono mt-2 leading-none text-text-primary tabular-nums">
                <AnimatedCounter value={result.accuracy} duration={1100} suffix="%" />
              </span>
              <span className="text-xs uppercase font-bold mt-1.5 text-text-tertiary">
                Correct keystrokes
              </span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="p-6 bg-surface/40 border border-border/80 flex flex-col text-text-primary rounded-2xl shadow-sm"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                Consistency
              </span>
              <span className="text-4xl md:text-5xl font-black font-mono mt-2 leading-none tabular-nums">
                <AnimatedCounter value={result.consistency} duration={1100} suffix="%" />
              </span>
              <span className="text-xs uppercase font-bold mt-1.5 text-text-tertiary">
                Pacing steadiness
              </span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-6 bg-surface/40 border border-border/80 flex flex-col text-text-primary rounded-2xl shadow-sm"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                Duration
              </span>
              <span className="text-4xl md:text-5xl font-black font-mono mt-2 leading-none tabular-nums">
                <AnimatedCounter
                  value={result.elapsedSeconds ?? result.duration}
                  duration={800}
                  suffix="s"
                />
              </span>
              <span className="text-xs uppercase font-bold mt-1.5 text-text-tertiary">
                {result.elapsedSeconds !== undefined &&
                result.elapsedSeconds !== result.duration
                  ? `Actual time · ${result.duration}s mode`
                  : 'Verified time'}
              </span>
            </motion.div>
          </div>

          <CatCompanion
            wpm={result.wpm}
            accuracy={result.accuracy}
            errorCount={result.errorCount}
            streakDays={streakDays}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
            <div className="lg:col-span-2 p-6 bg-surface border border-border flex flex-col min-h-[300px] rounded-xl shadow-sm">
              <div className="flex items-center gap-2 border-b border-border/80 pb-4 mb-4">
                <TrendingUp className="w-4 h-4 text-accent" />
                <span className="text-sm font-bold uppercase tracking-wider text-text-primary">
                  WPM Speed Evolution
                </span>
              </div>
              <div className="flex-1 w-full h-[200px]">
                <ResultChart timeline={result.timeline} />
              </div>
            </div>

            <div className="p-6 bg-surface border border-border flex flex-col justify-between gap-6 rounded-xl shadow-sm">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b border-border/80 pb-4">
                  <Award className="w-4 h-4 text-accent" />
                  <span className="text-sm font-bold uppercase tracking-wider text-text-primary">
                    Performance Summary
                  </span>
                </div>

                <div className="flex flex-col gap-1.5 text-xs md:text-sm font-bold uppercase tracking-wider">
                  <div className="flex justify-between items-center py-2 border-b border-border/60">
                    <span className="text-text-secondary">Raw speed</span>
                    <span className="text-text-primary font-mono tabular-nums">
                      {result.rawWpm} WPM
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/60">
                    <span className="text-text-secondary">Keystrokes (OK / Total)</span>
                    <span className="text-text-primary font-mono tabular-nums">
                      {result.correctInputKeystrokes} / {result.totalInputKeystrokes}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/60">
                    <span className="text-text-secondary">Uncorrected errors</span>
                    <span
                      className={`font-mono tabular-nums ${
                        result.errorCount > 0 ? 'text-error' : 'text-text-primary'
                      }`}
                    >
                      {result.errorCount}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-text-secondary">Backspaces pressed</span>
                    <span className="text-text-primary font-mono tabular-nums">
                      {result.backspaceCount}
                    </span>
                  </div>
                </div>
              </div>

              {missedKeys.length > 0 && (
                <div className="flex flex-col gap-3 p-4 bg-surface-accent/40 border border-border rounded-xl">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-text-secondary uppercase tracking-widest">
                      Top Weak Keys
                    </span>
                    {drillTargetsQuery && (
                      <Link
                        href={`/typing?mode=drill&duration=30&targets=${encodeURIComponent(
                          drillTargetsQuery
                        )}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-accent-ink hover:underline"
                      >
                        <Target className="w-3.5 h-3.5" />
                        Practice Weakness
                      </Link>
                    )}
                  </div>
                  <div className="flex gap-2.5">
                    {missedKeys.map(([key, count]) => (
                      <div
                        key={key}
                        className="flex-1 flex flex-col items-center p-2 bg-surface border border-border rounded-lg shadow-sm font-mono"
                      >
                        <kbd className="font-mono text-xs font-bold text-text-primary">
                          {key === ' ' ? 'Space' : key}
                        </kbd>
                        <span className="text-xs font-bold text-error mt-0.5">
                          {count}x
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-6 font-sans">
            <Button
              onClick={() => {
                if (onRetry) {
                  onRetry();
                } else {
                  resetTest();
                }
              }}
              variant="primary"
              className="flex-1 min-w-[140px] py-4"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{retryLabel}</span>
            </Button>

            <Button
              onClick={() => setShowReplay(true)}
              variant="secondary"
              className="flex-1 min-w-[140px] py-4 border border-border"
            >
              <Play className="w-4 h-4" />
              <span>Watch Replay</span>
            </Button>

            <Button
              onClick={handleShare}
              disabled={sharing}
              variant="secondary"
              className="flex-1 min-w-[140px] py-4 border border-border"
            >
              <Share2 className="w-4 h-4" />
              <span>
                {sharing ? 'Creating Link...' : copied ? 'Copied Link!' : 'Share Challenge'}
              </span>
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
