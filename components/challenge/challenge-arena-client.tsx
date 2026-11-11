'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTypingStore } from '@/stores/typing-store';
import { useUserStore } from '@/stores/user-store';
import { TypingContainer } from '@/components/typing/typing-container';
import { Button } from '@/components/ui/button';
import type { ChallengeLinkDetails } from '@/lib/data/challenge';
import {
  normalizeBracketDuration,
  type RankedMode,
  type ValidDuration,
} from '@/lib/typing/metrics';
import { Trophy, ArrowRight, Play, Sparkles, AlertCircle } from 'lucide-react';

interface ChallengeSubmitOutcome {
  ok: boolean;
  error?: string;
}

const inFlightChallengeSubmissions = new Map<string, Promise<ChallengeSubmitOutcome>>();
const recordedGuestChallengeRuns = new Set<string>();

function submitChallengeRunOnce(payload: {
  mode: RankedMode;
  duration: ValidDuration;
  seed: string;
  clientRunId: string;
  telemetry: Array<{ t: number; k: string; i: number; y: 0 | 1 }>;
}): Promise<ChallengeSubmitOutcome> {
  const existing = inFlightChallengeSubmissions.get(payload.clientRunId);
  if (existing) return existing;

  const request = fetch('/api/results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(async (res): Promise<ChallengeSubmitOutcome> => {
      if (res.ok) {
        return { ok: true };
      }
      inFlightChallengeSubmissions.delete(payload.clientRunId);
      let message = 'Could not save verified challenge run.';
      try {
        const json = (await res.json()) as { error?: string };
        if (json.error) message = json.error;
      } catch {
        // Ignore parse error on non-JSON failure responses
      }
      return { ok: false, error: message };
    })
    .catch((): ChallengeSubmitOutcome => {
      inFlightChallengeSubmissions.delete(payload.clientRunId);
      return { ok: false, error: 'Network error while saving challenge run.' };
    });

  inFlightChallengeSubmissions.set(payload.clientRunId, request);
  return request;
}

export const ChallengeArenaClient: React.FC<{ challenge: ChallengeLinkDetails }> = ({
  challenge,
}) => {
  const { status, result, seed, mode, duration, clientRunId, startTestWithConfig, resetTest } =
    useTypingStore();
  const { session, addGuestResult } = useUserStore();

  const [hasStarted, setHasStarted] = useState(false);
  const [persistedRun, setPersistedRun] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const challengeActiveRef = useRef(false);
  const challengeDuration = normalizeBracketDuration(challenge.duration);

  // Clear challenge state when leaving after starting or restarting so /typing generates fresh runs
  useEffect(() => {
    return () => {
      const current = useTypingStore.getState();
      if (challengeActiveRef.current || current.seed === challenge.seed) {
        challengeActiveRef.current = false;
        resetTest();
      }
    };
  }, [challenge.seed, resetTest]);

  // Submit verified challenge completion to backend / guest storage once per clientRunId
  useEffect(() => {
    if (!hasStarted || status !== 'completed' || !result || !clientRunId) {
      return;
    }

    if (seed !== challenge.seed || mode !== challenge.mode || duration !== challengeDuration) {
      return;
    }

    let cancelled = false;

    if (session?.user) {
      submitChallengeRunOnce({
        mode: challenge.mode,
        duration: challengeDuration,
        seed: challenge.seed,
        clientRunId,
        telemetry: result.telemetry,
      }).then((outcome) => {
        if (cancelled) return;
        if (outcome.ok) {
          setPersistedRun(true);
          setSubmitError(null);
        } else {
          setSubmitError(outcome.error ?? 'Failed to verify challenge score.');
        }
      });
    } else if (!recordedGuestChallengeRuns.has(clientRunId)) {
      recordedGuestChallengeRuns.add(clientRunId);
      addGuestResult({
        id: clientRunId,
        clientRunId,
        wpm: result.wpm,
        raw_wpm: result.rawWpm,
        accuracy: result.accuracy,
        consistency: result.consistency,
        error_count: result.errorCount,
        backspace_count: result.backspaceCount,
        mode: challenge.mode,
        duration: challengeDuration,
        seed: challenge.seed,
        isRanked: true,
        telemetry: result.telemetry,
        created_at: new Date().toISOString(),
      });
    }

    return () => {
      cancelled = true;
    };
  }, [
    hasStarted,
    status,
    result,
    seed,
    mode,
    duration,
    challenge,
    challengeDuration,
    clientRunId,
    session,
    addGuestResult,
  ]);

  const handleStartChallenge = useCallback(() => {
    challengeActiveRef.current = true;
    setPersistedRun(false);
    setSubmitError(null);
    startTestWithConfig({
      mode: challenge.mode,
      duration: challengeDuration,
      seed: challenge.seed,
      targets: [],
    });
    setHasStarted(true);
  }, [challenge.mode, challenge.seed, challengeDuration, startTestWithConfig]);

  const creatorName =
    challenge.profiles?.display_name || challenge.profiles?.username || 'Challenger';
  const viewState =
    !hasStarted ? 'lobby' : status === 'completed' && result ? 'comparison' : 'typing';

  return (
    <main className="flex-1 flex flex-col items-center justify-center py-10 px-4">
      {viewState === 'lobby' && (
        <div className="w-full max-w-md p-8 bg-surface border border-border rounded-2xl flex flex-col gap-6 shadow-xl text-center">
          <div className="w-12 h-12 bg-accent/10 border border-accent/30 rounded-xl flex items-center justify-center text-accent-ink mx-auto">
            <Trophy className="w-6 h-6" aria-hidden="true" />
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-xl md:text-2xl font-bold font-display text-text-primary">
              1v1 Challenge Received
            </h1>
            <p className="text-xs text-text-secondary">
              You have been challenged to race{' '}
              <span className="font-semibold text-text-primary">u/{creatorName}</span>{' '}
              on the exact same deterministic prompt ({challenge.mode}).
            </p>
          </div>

          <div className="p-4 bg-background border border-border rounded-xl flex items-center justify-around gap-4 text-xs font-mono">
            <div className="flex flex-col">
              <span className="text-text-secondary font-sans">Target Speed</span>
              <span className="text-xl font-bold text-accent-ink mt-1 tabular-nums">
                {challenge.creator_wpm ?? 0} WPM
              </span>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="flex flex-col">
              <span className="text-text-secondary font-sans">Accuracy</span>
              <span className="text-xl font-bold text-text-primary mt-1 tabular-nums">
                {challenge.creator_accuracy ?? 0}%
              </span>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="flex flex-col">
              <span className="text-text-secondary font-sans">Duration</span>
              <span className="text-xl font-bold text-text-primary mt-1 tabular-nums">
                {challengeDuration}s
              </span>
            </div>
          </div>

          <Button onClick={handleStartChallenge} variant="primary" className="w-full">
            <span>Accept Challenge</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {viewState === 'typing' && (
        <div className="w-full flex flex-col gap-4">
          <div className="text-center text-xs font-bold text-accent-ink uppercase tracking-wider">
            Racing u/{creatorName} ({challenge.creator_wpm ?? 0} WPM target)
          </div>
          <TypingContainer hideConfigBar onRestartOverride={handleStartChallenge} />
        </div>
      )}

      {viewState === 'comparison' && result && (
        <div className="w-full max-w-xl p-8 bg-surface border border-border rounded-2xl flex flex-col gap-8 shadow-xl">
          {(() => {
            const targetWpm = challenge.creator_wpm ?? 0;
            const won = result.wpm > targetWpm;
            const tie = result.wpm === targetWpm;

            return (
              <div
                className={`p-6 border rounded-xl flex flex-col items-center gap-2 text-center ${
                  won
                    ? 'bg-success/10 border-success/30 text-success'
                    : tie
                      ? 'bg-warning/10 border-warning/30 text-warning'
                      : 'bg-error/10 border-error/30 text-error'
                }`}
              >
                <Sparkles className="w-7 h-7" aria-hidden="true" />
                <span className="text-xl font-bold tracking-tight">
                  {won ? 'You Won!' : tie ? "It's a Tie!" : `${creatorName} Won`}
                </span>
                <span className="text-xs text-text-primary">
                  {won
                    ? `You beat u/${creatorName}'s score by ${result.wpm - targetWpm} WPM!`
                    : tie
                      ? 'Identical verified speed achieved.'
                      : `You trailed by ${targetWpm - result.wpm} WPM. Run it back!`}
                </span>
                {persistedRun && (
                  <span className="text-xs font-mono text-text-secondary mt-1">
                    Result verified and saved to your history.
                  </span>
                )}
                {submitError && (
                  <div
                    role="alert"
                    className="mt-2 inline-flex flex-wrap items-center justify-center gap-2 text-xs text-error"
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{submitError}</span>
                    {session?.user && result && clientRunId && (
                      <button
                        type="button"
                        onClick={() => {
                          setSubmitError(null);
                          submitChallengeRunOnce({
                            mode: challenge.mode,
                            duration: challengeDuration,
                            seed: challenge.seed,
                            clientRunId,
                            telemetry: result.telemetry,
                          }).then((outcome) => {
                            if (outcome.ok) {
                              setPersistedRun(true);
                              setSubmitError(null);
                            } else {
                              setSubmitError(outcome.error ?? 'Failed to verify challenge score.');
                            }
                          });
                        }}
                        className="underline font-semibold cursor-pointer hover:opacity-80"
                      >
                        Retry Save
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          <div className="grid grid-cols-2 gap-4 sm:gap-6">
            <div className="p-4 bg-background border border-border rounded-xl flex flex-col gap-2">
              <span className="text-xs font-bold text-text-secondary uppercase tracking-wider truncate">
                u/{creatorName}
              </span>
              <div className="flex flex-col">
                <span className="text-2xl font-bold font-mono text-text-primary tabular-nums">
                  {challenge.creator_wpm ?? 0} WPM
                </span>
                <span className="text-xs text-text-secondary mt-0.5 tabular-nums">
                  {challenge.creator_accuracy ?? 0}% Accuracy
                </span>
              </div>
            </div>

            <div className="p-4 bg-background border border-border rounded-xl flex flex-col gap-2">
              <span className="text-xs font-bold text-accent-ink uppercase tracking-wider">
                You
              </span>
              <div className="flex flex-col">
                <span className="text-2xl font-bold font-mono text-accent-ink tabular-nums">
                  {result.wpm} WPM
                </span>
                <span className="text-xs text-text-secondary mt-0.5 tabular-nums">
                  {result.accuracy}% Accuracy
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-xs md:text-sm border-t border-border pt-4">
            <div className="flex justify-between items-center py-1">
              <span className="text-text-secondary">WPM Speed Difference</span>
              <span
                className={`font-semibold font-mono tabular-nums ${
                  result.wpm >= (challenge.creator_wpm ?? 0) ? 'text-success' : 'text-error'
                }`}
              >
                {result.wpm >= (challenge.creator_wpm ?? 0) ? '+' : ''}
                {result.wpm - (challenge.creator_wpm ?? 0)} WPM
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-text-secondary">Accuracy Difference</span>
              <span
                className={`font-semibold font-mono tabular-nums ${
                  result.accuracy >= (challenge.creator_accuracy ?? 0)
                    ? 'text-success'
                    : 'text-error'
                }`}
              >
                {result.accuracy >= (challenge.creator_accuracy ?? 0) ? '+' : ''}
                {(result.accuracy - (challenge.creator_accuracy ?? 0)).toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 border-t border-border pt-6">
            <Button onClick={handleStartChallenge} variant="primary" className="flex-1">
              <Play className="w-4 h-4 fill-current" />
              <span>Retry Challenge</span>
            </Button>
            <Button href="/typing" variant="secondary" className="flex-1">
              <span>Practice Sandbox</span>
            </Button>
          </div>
        </div>
      )}
    </main>
  );
};

