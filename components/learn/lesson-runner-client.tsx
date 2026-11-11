'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Keyboard,
  Lock,
  RefreshCw,
  Star,
  AlertCircle,
} from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { TextDisplay } from '@/components/typing/text-display';
import { playKeystrokeSound } from '@/lib/audio/keystroke-sound';
import { useUserStore } from '@/stores/user-store';
import { useHydrated } from '@/lib/hooks/use-hydrated';
import {
  computeLessonStars,
  CURRICULUM_LESSONS,
  isLessonUnlocked,
  type CurriculumLesson,
} from '@/constants/curriculum';
import {
  createMetricsTracker,
  evaluateFinalSession,
  type KeystrokeInputEvent,
  type TypingSessionResult,
} from '@/lib/typing/metrics';

interface LessonRunnerClientProps {
  lesson: CurriculumLesson;
  nextLesson: CurriculumLesson | null;
}

const SENTINEL = '\u200B';

export function LessonRunnerClient({ lesson, nextLesson }: LessonRunnerClientProps) {
  const hydrated = useHydrated();
  const { lessonProgress, recordLessonAttempt, preferences } = useUserStore();
  const unlocked = isLessonUnlocked(lesson, hydrated ? (lessonProgress ?? {}) : {});
  const prerequisite =
    lesson.order > 1
      ? CURRICULUM_LESSONS.find((item) => item.order === lesson.order - 1) ?? null
      : null;

  const [status, setStatus] = useState<'idle' | 'running' | 'completed'>('idle');
  const [userInput, setUserInput] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [liveWpm, setLiveWpm] = useState(0);
  const [liveAccuracy, setLiveAccuracy] = useState(100);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [finalOutcome, setFinalOutcome] = useState<{
    result: TypingSessionResult;
    stars: 0 | 1 | 2 | 3;
    passed: boolean;
  } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const eventsRef = useRef<KeystrokeInputEvent[]>([]);
  const trackerRef = useRef(createMetricsTracker());
  const startTimeRef = useRef<number | null>(null);
  const isComposingRef = useRef(false);
  const handledKeyDownBackspaceRef = useRef(false);

  const restoreSentinel = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.value = SENTINEL;
    try {
      ta.setSelectionRange(1, 1);
    } catch {
      // Ignore selection error when element unavailable
    }
  }, []);

  const forceFocus = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.focus({ preventScroll: true });
      restoreSentinel();
      setIsFocused(true);
    }
  }, [restoreSentinel]);

  const restartLesson = useCallback(() => {
    eventsRef.current = [];
    trackerRef.current = createMetricsTracker();
    startTimeRef.current = null;
    setStatus('idle');
    setUserInput('');
    setCurrentIndex(0);
    setLiveWpm(0);
    setLiveAccuracy(100);
    setElapsedSecs(0);
    setFinalOutcome(null);
    restoreSentinel();
  }, [restoreSentinel]);

  useEffect(() => {
    restoreSentinel();
  }, [restoreSentinel]);

  // Live metrics ticker while running
  useEffect(() => {
    if (status !== 'running') return;

    const timer = setInterval(() => {
      if (startTimeRef.current === null) return;
      const now = performance.now();
      const elapsedMs = now - startTimeRef.current;
      const snap = trackerRef.current.snapshot(elapsedMs);
      setLiveWpm(snap.wpm);
      setLiveAccuracy(snap.accuracy);
      setElapsedSecs(Math.floor(elapsedMs / 1000));
    }, 250);

    return () => clearInterval(timer);
  }, [status]);

  const applyBackspace = useCallback(() => {
    if (status !== 'running' || currentIndex <= 0) return;

    const now = performance.now();
    const deleteIdx = currentIndex - 1;
    const ev: KeystrokeInputEvent = {
      key: 'Backspace',
      time: now,
      index: deleteIdx,
      expectedKey: '',
      type: 'delete',
    };
    eventsRef.current.push(ev);
    trackerRef.current.apply(ev);

    if (startTimeRef.current !== null) {
      const snap = trackerRef.current.snapshot(now - startTimeRef.current);
      setLiveWpm(snap.wpm);
      setLiveAccuracy(snap.accuracy);
    }

    setUserInput((prev) => prev.slice(0, -1));
    setCurrentIndex(deleteIdx);
  }, [status, currentIndex]);

  const commitText = useCallback(
    (rawText: string) => {
      const cleaned = rawText.replace(/\u200B/g, '');
      if (!cleaned || status === 'completed') return;

      let localInput = userInput;
      let localIndex = currentIndex;

      for (const ch of cleaned) {
        if (ch === '\r' || ch === '\n') continue;
        if (localIndex >= lesson.prompt.length) break;

        const now = performance.now();
        if (startTimeRef.current === null) {
          startTimeRef.current = now;
          setStatus('running');
        }

        const expected = lesson.prompt[localIndex];
        const ev: KeystrokeInputEvent = {
          key: ch,
          time: now,
          index: localIndex,
          expectedKey: expected,
          type: 'input',
        };
        eventsRef.current.push(ev);
        trackerRef.current.apply(ev);

        playKeystrokeSound(preferences.volume, ch !== expected);

        localInput += ch;
        localIndex += 1;

        if (localIndex >= lesson.prompt.length) {
          const evaluated = evaluateFinalSession(eventsRef.current, {
            durationLimit: 180,
            reason: 'text_complete',
            endTime: now,
          });
          setUserInput(localInput);
          setCurrentIndex(localIndex);
          setStatus('completed');

          if (evaluated) {
            const stars = computeLessonStars(evaluated.wpm, evaluated.accuracy, lesson);
            const passed = evaluated.accuracy >= lesson.minAccuracy;
            setLiveWpm(evaluated.wpm);
            setLiveAccuracy(evaluated.accuracy);
            setFinalOutcome({ result: evaluated, stars, passed });
            recordLessonAttempt(lesson.slug, {
              wpm: evaluated.wpm,
              accuracy: evaluated.accuracy,
              stars,
              completed: passed,
            });
          }
          return;
        }
      }

      if (startTimeRef.current !== null) {
        const snap = trackerRef.current.snapshot(performance.now() - startTimeRef.current);
        setLiveWpm(snap.wpm);
        setLiveAccuracy(snap.accuracy);
      }

      setUserInput(localInput);
      setCurrentIndex(localIndex);
    },
    [status, userInput, currentIndex, lesson, preferences.volume, recordLessonAttempt]
  );

  // Global keyboard Escape + printable focus shortcut
  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        restartLesson();
        requestAnimationFrame(() => forceFocus());
        return;
      }

      if (status === 'completed' || !unlocked) return;
      if (
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        document.activeElement !== textareaRef.current &&
        !(e.target instanceof Element && e.target.closest('button, a, input, select, textarea'))
      ) {
        forceFocus();
      }
    };

    window.addEventListener('keydown', onGlobalKey);
    return () => window.removeEventListener('keydown', onGlobalKey);
  }, [restartLesson, forceFocus, status, unlocked]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 md:px-6 py-10 flex flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
          <div className="flex flex-col gap-1">
            <Link
              href="/learn"
              className="text-xs font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary inline-flex items-center gap-1.5 mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>All Curriculum Lessons</span>
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-2.5 py-0.5 rounded-full bg-accent/10 border border-accent/25 text-accent-ink font-mono text-xs font-bold uppercase">
                {lesson.track} · #{lesson.order}
              </span>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-text-primary font-display">
                {lesson.title}
              </h1>
            </div>
            <p className="text-sm text-text-secondary mt-1">{lesson.summary}</p>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono bg-surface border border-border rounded-xl px-4 py-2.5">
            <span className="text-text-secondary">Target: {lesson.targetWpm} WPM</span>
            <span className="text-border">|</span>
            <span className="text-accent-ink font-bold">Pass Gate: {lesson.minAccuracy}% Acc</span>
          </div>
        </div>

        {!unlocked ? (
          <div className="p-8 bg-surface border border-border rounded-2xl flex flex-col items-center text-center gap-5 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-surface-accent border border-border flex items-center justify-center text-text-secondary">
              <Lock className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-2 max-w-md">
              <h2 className="text-xl font-bold font-display text-text-primary">
                Lesson Locked
              </h2>
              <p className="text-sm text-text-secondary leading-relaxed">
                Complete{' '}
                <span className="font-semibold text-text-primary">
                  {prerequisite?.title ?? `Lesson ${lesson.order - 1}`}
                </span>{' '}
                with at least {lesson.minAccuracy}% accuracy to unlock this module.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {prerequisite && (
                <Button href={`/learn/${prerequisite.slug}`} variant="primary">
                  Go to {prerequisite.title}
                </Button>
              )}
              <Button href="/learn" variant="secondary">
                Back to Curriculum
              </Button>
            </div>
          </div>
        ) : status === 'completed' && finalOutcome ? (
          <div className="p-8 bg-surface border border-border rounded-2xl flex flex-col gap-6 shadow-md animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
              <div className="flex items-start gap-3">
                {finalOutcome.passed ? (
                  <CheckCircle2 className="w-7 h-7 text-success shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-7 h-7 text-error shrink-0 mt-0.5" />
                )}
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl font-black font-display text-text-primary">
                    {finalOutcome.passed ? 'Lesson Passed' : 'Accuracy Gate Not Met'}
                  </h2>
                  <p className="text-sm text-text-secondary">
                    {finalOutcome.passed
                      ? nextLesson
                        ? `Unlocked ${nextLesson.title}. Keep building your rhythm.`
                        : 'You passed all curriculum modules cleanly.'
                      : `Achieve at least ${lesson.minAccuracy}% accuracy (scored ${finalOutcome.result.accuracy}%) to unlock the next lesson.`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 px-4 py-2 bg-surface-accent/50 border border-border rounded-xl">
                {[1, 2, 3].map((slot) => (
                  <Star
                    key={slot}
                    className={`w-5 h-5 ${
                      slot <= finalOutcome.stars ? 'text-warning fill-current' : 'text-border'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-background border border-border rounded-xl flex flex-col">
                <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                  Net WPM
                </span>
                <span className="text-3xl font-black font-mono text-accent-ink mt-1 tabular-nums">
                  {finalOutcome.result.wpm}
                </span>
              </div>
              <div className="p-4 bg-background border border-border rounded-xl flex flex-col">
                <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                  Accuracy
                </span>
                <span
                  className={`text-3xl font-black font-mono mt-1 tabular-nums ${
                    finalOutcome.passed ? 'text-success' : 'text-error'
                  }`}
                >
                  {finalOutcome.result.accuracy}%
                </span>
              </div>
              <div className="p-4 bg-background border border-border rounded-xl flex flex-col">
                <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                  Consistency
                </span>
                <span className="text-3xl font-black font-mono text-text-primary mt-1 tabular-nums">
                  {finalOutcome.result.consistency}%
                </span>
              </div>
              <div className="p-4 bg-background border border-border rounded-xl flex flex-col">
                <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                  Backspaces
                </span>
                <span className="text-3xl font-black font-mono text-text-primary mt-1 tabular-nums">
                  {finalOutcome.result.backspaceCount}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                onClick={() => {
                  restartLesson();
                  requestAnimationFrame(() => forceFocus());
                }}
                variant={finalOutcome.passed && nextLesson ? 'secondary' : 'primary'}
              >
                <RefreshCw className="w-4 h-4" />
                <span>{finalOutcome.passed ? 'Practice Again' : 'Retry Lesson'}</span>
              </Button>

              {finalOutcome.passed && nextLesson && (
                <Button href={`/learn/${nextLesson.slug}`} variant="primary">
                  <span>Next: {nextLesson.title}</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}

              <Button href="/learn" variant="ghost" className="border border-border">
                Back to Curriculum
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Live Lesson Metrics */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-surface border border-border rounded-xl flex flex-col items-center text-center">
                <span className="text-2xl font-black font-mono text-accent-ink tabular-nums">
                  {status === 'running' ? liveWpm : '--'}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary mt-1">
                  Live WPM
                </span>
              </div>
              <div className="p-4 bg-surface border border-border rounded-xl flex flex-col items-center text-center">
                <span className="text-2xl font-black font-mono text-text-primary tabular-nums">
                  {liveAccuracy}%
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary mt-1">
                  Accuracy
                </span>
              </div>
              <div className="p-4 bg-surface border border-border rounded-xl flex flex-col items-center text-center">
                <span className="text-2xl font-black font-mono text-text-primary tabular-nums">
                  {currentIndex} / {lesson.prompt.length}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary mt-1">
                  Progress ({elapsedSecs}s)
                </span>
              </div>
            </div>

            {/* Interactive Prompt Container */}
            <div
              onClick={forceFocus}
              className={`relative p-8 md:p-10 bg-surface border rounded-2xl cursor-pointer min-h-[210px] flex items-center transition-all ${
                isFocused
                  ? 'border-accent/60 shadow-glow'
                  : 'border-border hover:border-text-secondary/40'
              }`}
            >
              <textarea
                ref={textareaRef}
                defaultValue={SENTINEL}
                onPaste={(e) => e.preventDefault()}
                onBeforeInput={(e) => {
                  const native = e.nativeEvent as unknown as InputEvent | undefined;
                  if (native?.inputType === 'deleteContentBackward') {
                    if (!handledKeyDownBackspaceRef.current) {
                      e.preventDefault();
                      applyBackspace();
                      restoreSentinel();
                    }
                  } else if (
                    native?.inputType === 'insertLineBreak' ||
                    native?.inputType === 'insertParagraph' ||
                    native?.inputType === 'insertFromPaste'
                  ) {
                    e.preventDefault();
                  }
                }}
                onCompositionStart={() => {
                  isComposingRef.current = true;
                }}
                onCompositionEnd={(e) => {
                  isComposingRef.current = false;
                  commitText(e.data || e.currentTarget.value);
                  restoreSentinel();
                }}
                onChange={(e) => {
                  if (isComposingRef.current) return;
                  const val = e.target.value;
                  if (!val.includes(SENTINEL)) {
                    if (!handledKeyDownBackspaceRef.current) {
                      applyBackspace();
                    }
                    restoreSentinel();
                    return;
                  }
                  commitText(val);
                  restoreSentinel();
                }}
                onKeyDown={(e) => {
                  if (isComposingRef.current) return;
                  if (e.key === 'Backspace') {
                    e.preventDefault();
                    handledKeyDownBackspaceRef.current = true;
                    applyBackspace();
                    restoreSentinel();
                    queueMicrotask(() => {
                      handledKeyDownBackspaceRef.current = false;
                    });
                  } else if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    restartLesson();
                    forceFocus();
                  }
                }}
                onFocus={() => {
                  restoreSentinel();
                  setIsFocused(true);
                }}
                onBlur={() => setIsFocused(false)}
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                aria-label="Lesson typing input area"
                className="absolute inset-0 w-full h-full opacity-0 pointer-events-none resize-none outline-none"
              />

              {!isFocused && (
                <div className="absolute inset-x-0 bottom-5 z-20 flex items-center justify-center pointer-events-none">
                  <div className="flex items-center gap-2 px-4 py-2 bg-background/95 border border-border text-xs font-semibold text-text-primary uppercase tracking-wider shadow-md rounded-xl">
                    <Keyboard className="w-3.5 h-3.5 text-accent-ink" />
                    <span>Click or type to start lesson</span>
                  </div>
                </div>
              )}

              <div className={`w-full transition-opacity ${!isFocused ? 'opacity-45' : 'opacity-100'}`}>
                <TextDisplay
                  targetText={lesson.prompt}
                  userInput={userInput}
                  currentIndex={currentIndex}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-text-secondary">
              <span>Unranked practice · Does not submit to competitive leaderboards</span>
              <Button
                variant="ghost"
                onClick={() => {
                  restartLesson();
                  requestAnimationFrame(() => forceFocus());
                }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Restart Lesson</span>
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

