'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTypingStore } from '@/stores/typing-store';
import { TextDisplay } from './text-display';
import { RefreshCw, Keyboard } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/stores/user-store';

export const TypingContainer: React.FC = () => {
  const {
    targetText,
    userInput,
    currentIndex,
    status,
    timeLeft,
    duration,
    mode,
    wpm,
    accuracy,
    setDuration,
    setMode,
    startTest,
    startTestWithConfig,
    handleInput,
    handleBackspace,
    resetTest,
  } = useTypingStore();

  const { session, guestHistory } = useUserStore();
  const [streakDays, setStreakDays] = useState(0);

  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize test on first mount
  useEffect(() => {
    startTest();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch or calculate user streak
  useEffect(() => {
    async function loadStreak() {
      if (session?.user) {
        try {
          const supabase = createClient();
          const { data: streakData } = await supabase
            .from('streaks')
            .select('current_streak')
            .eq('user_id', session.user.id)
            .single();
          if (streakData) {
            setStreakDays(streakData.current_streak);
          }
        } catch (err) {
          console.error('Error fetching streak:', err);
        }
      } else {
        setStreakDays(guestHistory.length > 0 ? 1 : 0);
      }
    }
    loadStreak();
  }, [session, guestHistory]);

  const forceFocus = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.focus({ preventScroll: true });
      setIsFocused(true);
    }
  }, []);

  const handleContainerClick = () => {
    forceFocus();
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length > 0) {
      const char = value.slice(-1);
      handleInput(char);
      // Keep textarea empty so every keystroke is a fresh character event
      e.target.value = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      handleBackspace();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      resetTest();
      forceFocus();
    }
    // Block Tab from moving focus away
    if (e.key === 'Tab') {
      e.preventDefault();
    }
  };

  // Global Escape + any printable key auto-focuses the textarea
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        resetTest();
        // Focus will happen after resetTest state update
        requestAnimationFrame(() => forceFocus());
        return;
      }

      // If a printable key is pressed and textarea is not focused, focus it
      if (
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        document.activeElement !== textareaRef.current
      ) {
        forceFocus();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [resetTest, forceFocus]);

  const durationOptions = [15, 30, 60, 120];
  const modeOptions: Array<'words' | 'quotes' | 'numbers' | 'punctuation' | 'code'> = [
    'words',
    'quotes',
    'numbers',
    'punctuation',
    'code',
  ];

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 px-4">
      {/* Top Configuration Bar — always rendered but faded during test to prevent layout shift */}
      <div
        className={`flex flex-wrap items-center justify-between gap-4 p-3 bg-surface border-3 border-border transition-all duration-300 ${
          status !== 'idle' ? 'opacity-20 pointer-events-none select-none cursor-default' : ''
        }`}
      >
        {/* Modes */}
        <div className="flex items-center gap-1.5">
          {modeOptions.map((opt) => (
            <button
              key={opt}
              onClick={() => {
                startTestWithConfig({ mode: opt, duration });
              }}
              className={`px-4 py-2 border-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                mode === opt
                  ? 'bg-accent text-background border-border'
                  : 'text-text-secondary border-transparent hover:border-border hover:text-text-primary'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>

        {/* Durations */}
        <div className="flex items-center gap-1.5">
          {durationOptions.map((time) => (
            <button
              key={time}
              onClick={() => {
                startTestWithConfig({ mode, duration: time });
              }}
              className={`px-4 py-2 border-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                duration === time
                  ? 'bg-accent text-background border-border'
                  : 'text-text-secondary border-transparent hover:border-border hover:text-text-primary'
              }`}
            >
              {time}s
            </button>
          ))}
        </div>
      </div>

      {/* Real-time stats (always visible - Bauhaus segmented layout) */}
      <div className="flex items-center gap-0 border-3 border-border bg-surface-accent font-sans select-none">
        <div className="flex-1 flex flex-col items-center justify-center p-4 border-r-3 border-border text-center">
          <span className="text-accent text-3xl font-black font-mono leading-none">
            {status === 'running' ? `${timeLeft}s` : `${duration}s`}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary mt-1">Remaining</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-4 border-r-3 border-border text-center">
          <span className="text-text-primary text-3xl font-black font-mono leading-none">
            {status === 'running' ? wpm : '--'}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary mt-1">WPM</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-4 border-r-3 border-border text-center">
          <span className="text-text-primary text-3xl font-black font-mono leading-none">
            {status === 'running' ? `${accuracy}%` : '--%'}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary mt-1">Accuracy</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <span className="text-text-primary text-3xl font-black font-mono leading-none">
            {streakDays} {streakDays === 1 ? 'Day' : 'Days'}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary mt-1">Active Streak</span>
        </div>
      </div>

      {/* Main Typing Viewport */}
      <div
        ref={containerRef}
        onClick={handleContainerClick}
        className={`relative p-8 bg-surface border-3 transition-all duration-150 cursor-pointer min-h-[220px] flex items-center select-none ${
          isFocused
            ? 'border-accent bg-surface-accent'
            : 'border-border hover:border-border/80'
        }`}
      >
        {/* Hidden input capture textarea */}
        <textarea
          ref={textareaRef}
          value=""
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

        {/* Elegant Minimalist Floating Focus Overlay */}
        {!isFocused && status !== 'completed' && (
          <div className="absolute inset-x-0 bottom-4 z-10 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 px-4 py-2 bg-surface border-2 border-border text-[10px] font-bold text-text-primary uppercase tracking-wider shadow-sm animate-pulse">
              <Keyboard className="w-3.5 h-3.5 text-accent" />
              <span>Click or start typing to focus</span>
            </div>
          </div>
        )}

        {/* Text rendering viewport */}
        <div className={`w-full transition-all duration-200 ${!isFocused && status !== 'completed' ? 'blur-[0.5px] opacity-30' : ''}`}>
          <TextDisplay
            targetText={targetText}
            userInput={userInput}
            currentIndex={currentIndex}
          />
        </div>
      </div>

      {/* Control Row */}
      <div className="flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wider text-text-secondary">
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 bg-surface-accent border-2 border-border text-text-primary font-mono text-xs">Esc</kbd>
          <span>to restart</span>
        </div>

        <button
          onClick={() => {
            resetTest();
            requestAnimationFrame(() => forceFocus());
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white font-bold border-2 border-border hover:bg-error transition-all cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Restart Test</span>
        </button>
      </div>
    </div>
  );
};
