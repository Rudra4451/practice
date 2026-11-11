'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTypingStore } from '@/stores/typing-store';
import { useUserStore } from '@/stores/user-store';
import { playKeystrokeSound } from '@/lib/audio/keystroke-sound';
import { createClient } from '@/lib/supabase/client';
import { TextDisplay } from './text-display';
import { RefreshCw, Keyboard, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SENTINEL = '\u200B';

function isInteractiveElement(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'button, a, input, select, textarea, [role="button"], [role="dialog"], [contenteditable="true"]'
    )
  );
}

interface TypingContainerProps {
  hideConfigBar?: boolean;
  onRestartOverride?: () => void;
}

export const TypingContainer: React.FC<TypingContainerProps> = ({
  hideConfigBar = false,
  onRestartOverride,
}) => {
  const {
    targetText,
    userInput,
    currentIndex,
    status,
    timeLeft,
    duration,
    mode,
    targets,
    isRankedRun,
    wpm,
    accuracy,
    combo,
    startTest,
    startTestWithConfig,
    handleInput,
    handleBackspace,
    resetTest,
  } = useTypingStore();

  const { session, guestHistory, preferences } = useUserStore();
  const [streakDays, setStreakDays] = useState(0);
  const [isFocused, setIsFocused] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);
  const handledKeyDownBackspaceRef = useRef(false);

  const restoreSentinel = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.value = SENTINEL;
    try {
      ta.setSelectionRange(1, 1);
    } catch {
      // Ignore selection errors when element is hidden/detached
    }
  }, []);

  // Ensure initial test text is generated once when mounted directly without URL config
  useEffect(() => {
    if (!useTypingStore.getState().targetText) {
      startTest();
    }
    restoreSentinel();
  }, [startTest, restoreSentinel]);

  // Fetch or compute active streak cleanly inside async callback
  useEffect(() => {
    let cancelled = false;

    async function loadStreak() {
      if (session?.user) {
        try {
          const supabase = createClient();
          const { data: streakData } = await supabase
            .from('streaks')
            .select('current_streak')
            .eq('user_id', session.user.id)
            .maybeSingle();
          if (!cancelled && streakData) {
            setStreakDays(streakData.current_streak);
          }
        } catch (err) {
          console.error('Error fetching streak:', err);
        }
      } else if (!cancelled) {
        setStreakDays(guestHistory.length > 0 ? 1 : 0);
      }
    }

    loadStreak();
    return () => {
      cancelled = true;
    };
  }, [session, guestHistory.length]);

  const forceFocus = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.focus({ preventScroll: true });
      restoreSentinel();
      setIsFocused(true);
    }
  }, [restoreSentinel]);

  const handleContainerClick = useCallback(() => {
    forceFocus();
  }, [forceFocus]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  const handleFocus = useCallback(() => {
    restoreSentinel();
    setIsFocused(true);
  }, [restoreSentinel]);

  const commitInsertedText = useCallback(
    (rawText: string) => {
      const cleaned = rawText.replace(/\u200B/g, '');
      if (!cleaned) return;

      for (const ch of cleaned) {
        if (ch === '\r' || ch === '\n') continue;
        const snapshot = useTypingStore.getState();
        const expected = snapshot.targetText[snapshot.currentIndex];
        handleInput(ch);
        if (expected !== undefined) {
          playKeystrokeSound(preferences.volume, ch !== expected);
        }
      }
    },
    [handleInput, preferences.volume]
  );

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(
    (e: React.CompositionEvent<HTMLTextAreaElement>) => {
      isComposingRef.current = false;
      const committed = e.data || e.currentTarget.value;
      commitInsertedText(committed);
      restoreSentinel();
    },
    [commitInsertedText, restoreSentinel]
  );

  const handleBeforeInput = useCallback(
    (e: React.FormEvent<HTMLTextAreaElement>) => {
      const nativeEvent = e.nativeEvent as unknown as InputEvent | undefined;
      if (!nativeEvent) return;

      if (nativeEvent.inputType === 'deleteContentBackward') {
        if (!handledKeyDownBackspaceRef.current) {
          e.preventDefault();
          handleBackspace();
          restoreSentinel();
        }
      } else if (
        nativeEvent.inputType === 'insertLineBreak' ||
        nativeEvent.inputType === 'insertParagraph' ||
        nativeEvent.inputType === 'insertFromPaste'
      ) {
        e.preventDefault();
      }
    },
    [handleBackspace, restoreSentinel]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (isComposingRef.current) return;

      const value = e.target.value;

      // Mobile virtual keyboards (e.g., Android Gboard) delete the sentinel on Backspace
      if (!value.includes(SENTINEL)) {
        if (!handledKeyDownBackspaceRef.current) {
          handleBackspace();
        }
        restoreSentinel();
        return;
      }

      commitInsertedText(value);
      restoreSentinel();
    },
    [commitInsertedText, handleBackspace, restoreSentinel]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (isComposingRef.current) return;

      if (e.key === 'Backspace') {
        e.preventDefault();
        handledKeyDownBackspaceRef.current = true;
        handleBackspace();
        restoreSentinel();
        queueMicrotask(() => {
          handledKeyDownBackspaceRef.current = false;
        });
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (onRestartOverride) {
          onRestartOverride();
        } else {
          resetTest();
        }
        restoreSentinel();
        forceFocus();
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
      }
    },
    [handleBackspace, resetTest, onRestartOverride, restoreSentinel, forceFocus]
  );

  // Global Escape + printable autofocus while respecting buttons, links, and open modals
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]')) {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        if (onRestartOverride) {
          onRestartOverride();
        } else {
          resetTest();
        }
        requestAnimationFrame(() => forceFocus());
        return;
      }

      if (status === 'completed') return;

      if (
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        document.activeElement !== textareaRef.current &&
        !isInteractiveElement(e.target) &&
        !isInteractiveElement(document.activeElement)
      ) {
        forceFocus();
      }
    };

    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [resetTest, onRestartOverride, forceFocus, status]);

  const durationOptions = [15, 30, 60, 120];
  const modeOptions: Array<'words' | 'quotes' | 'numbers' | 'punctuation' | 'code'> = [
    'words',
    'quotes',
    'numbers',
    'punctuation',
    'code',
  ];

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-8 px-4 relative overflow-x-clip">
      {/* Subtle ambient feedback glow behind typing viewport */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[90vw] rounded-[100%] pointer-events-none transition-all duration-700 ease-out"
        style={{
          width: status === 'running' ? `${Math.min(800, 400 + wpm * 4)}px` : '600px',
          height: status === 'running' ? `${Math.min(400, 200 + wpm * 2)}px` : '300px',
          background: `radial-gradient(circle, var(--accent) 0%, transparent 70%)`,
          opacity: status === 'running' ? Math.min(0.08, 0.02 + wpm * 0.0005) : 0.02,
          filter: `blur(${status === 'running' ? '140px' : '120px'})`,
        }}
      />

      {/* Active Drill / Practice Pill Banner */}
      {!isRankedRun && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-surface/80 border border-accent/40 rounded-xl text-xs">
          <div className="flex items-center gap-2 text-text-primary font-semibold">
            <Target className="w-4 h-4 text-accent-ink" />
            <span>
              {mode === 'drill' ? 'Targeted Practice Drill' : 'Structured Practice'} (Unranked)
            </span>
            {targets.length > 0 && (
              <span className="font-mono text-accent-ink uppercase">
                Focus: {targets.join(', ')}
              </span>
            )}
          </div>
          <Link
            href="/dashboard/performance-lab"
            className="text-text-secondary hover:text-text-primary underline underline-offset-4"
          >
            Back to Performance Lab
          </Link>
        </div>
      )}

      {/* Top Configuration Bar (stays in document flow to prevent layout shift on first keystroke) */}
      {!hideConfigBar && (
        <div
          className={`flex flex-col sm:flex-row items-center justify-between gap-4 p-2 bg-surface/50 backdrop-blur-md border border-border/80 rounded-2xl shadow-sm transition-opacity duration-300 relative z-10 ${
            status !== 'idle' ? 'opacity-25 pointer-events-none' : 'opacity-100'
          }`}
        >
        <div className="flex flex-wrap items-center justify-center gap-1 p-1 bg-surface-accent/40 rounded-xl max-w-full">
          {modeOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                startTestWithConfig({ mode: opt, duration, targets: [] });
              }}
              className={`relative px-3 sm:px-4 py-2 min-h-[38px] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer rounded-lg z-10 ${
                mode === opt
                  ? 'text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {mode === opt && (
                <div className="absolute inset-0 bg-surface rounded-lg shadow-sm border border-border/60 -z-10" />
              )}
              {opt}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1 p-1 bg-surface-accent/40 rounded-xl max-w-full">
          {durationOptions.map((time) => (
            <button
              key={time}
              type="button"
              onClick={() => {
                startTestWithConfig({ mode, duration: time, targets });
              }}
              className={`relative px-3 sm:px-4 py-2 min-h-[38px] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer rounded-lg z-10 ${
                duration === time
                  ? 'text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {duration === time && (
                <div className="absolute inset-0 bg-surface rounded-lg shadow-sm border border-border/60 -z-10" />
              )}
              {time}s
            </button>
          ))}
        </div>
        </div>
      )}

      {/* Real-time stats strip (stays visible during run for live timer, WPM & accuracy feedback) */}
      <div
        className={`grid grid-cols-2 md:grid-cols-5 gap-4 font-sans transition-opacity duration-300 relative z-10 ${
          status === 'idle' ? 'opacity-70' : 'opacity-100'
        }`}
      >
        {[
          { label: 'Remaining', value: status === 'running' ? `${timeLeft}s` : `${duration}s` },
          { label: 'WPM', value: status === 'running' ? wpm : '--', highlight: true },
          { label: 'Accuracy', value: status === 'running' ? `${accuracy}%` : '--%' },
          { label: 'Combo', value: status === 'running' ? combo : '--' },
          { label: 'Active Streak', value: `${streakDays} Day${streakDays !== 1 ? 's' : ''}` },
        ].map((stat, i) => (
          <div
            key={i}
            className="flex flex-col items-center justify-center p-4 bg-surface/60 backdrop-blur-sm border border-border/80 rounded-2xl text-center shadow-xs"
          >
            <span
              className={`text-3xl font-bold font-mono leading-none tabular-nums ${
                stat.highlight ? 'text-accent-ink' : 'text-text-primary'
              }`}
            >
              {stat.value}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-text-secondary mt-2">
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      {/* Main Typing Viewport */}
      <div
        ref={containerRef}
        onClick={handleContainerClick}
        className={`relative p-8 md:p-12 bg-surface/30 backdrop-blur-md border rounded-3xl transition-all duration-300 cursor-pointer min-h-[260px] flex items-center shadow-sm z-10 ${
          isFocused
            ? 'border-accent/40 bg-surface/60 shadow-glow'
            : 'border-border/60 hover:border-border hover:bg-surface/50'
        }`}
      >
        {isFocused && (
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
        )}

        {/* Hidden sentinel textarea capturing desktop, mobile swipe, autocorrect & IME input */}
        <textarea
          ref={textareaRef}
          defaultValue={SENTINEL}
          onBeforeInput={handleBeforeInput}
          onPaste={(e) => e.preventDefault()}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={handleFocus}
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="absolute inset-0 w-full h-full opacity-0 cursor-default resize-none overflow-hidden outline-none pointer-events-none"
          aria-label="Typing input area"
          tabIndex={0}
        />

        {!isFocused && status !== 'completed' && (
          <div className="absolute inset-x-0 bottom-6 z-20 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 px-4 py-2 bg-background/90 backdrop-blur-md border border-border/80 text-xs font-semibold text-text-primary uppercase tracking-widest shadow-lg rounded-xl animate-pulse">
              <Keyboard className="w-3.5 h-3.5 text-accent" />
              <span>Click or press any key to focus</span>
            </div>
          </div>
        )}

        <div
          className={`w-full transition-all duration-300 ${
            !isFocused && status !== 'completed' ? 'blur-[1px] opacity-40' : ''
          }`}
        >
          <TextDisplay
            targetText={targetText}
            userInput={userInput}
            currentIndex={currentIndex}
          />
        </div>
      </div>

      {/* Control Row */}
      <div
        className={`flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-widest text-text-tertiary relative z-10 transition-all duration-700 ease-in-out ${
          status === 'running'
            ? 'opacity-0 translate-y-4 pointer-events-none'
            : 'opacity-100 translate-y-0'
        }`}
      >
        <div className="flex items-center gap-2 opacity-60">
          <kbd className="px-2 py-1 bg-surface-accent border border-border/60 text-text-secondary font-mono rounded shadow-xs">
            Esc
          </kbd>
          <span>to restart</span>
        </div>

        <Button
          onClick={() => {
            if (onRestartOverride) {
              onRestartOverride();
            } else {
              resetTest();
            }
            requestAnimationFrame(() => forceFocus());
          }}
          variant="ghost"
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Restart Test</span>
        </Button>
      </div>
    </div>
  );
};
