'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTypingStore } from '@/stores/typing-store';
import { TextDisplay } from './text-display';
import { RefreshCw, Keyboard } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/stores/user-store';
import { Button } from '@/components/ui/button';

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
    combo,
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

  const handleContainerClick = useCallback(() => {
    forceFocus();
  }, [forceFocus]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length > 0) {
      const char = value.slice(-1);
      handleInput(char);
      // Keep textarea empty so every keystroke is a fresh character event
      e.target.value = '';
    }
  }, [handleInput]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
  }, [handleBackspace, resetTest, forceFocus]);

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

  const autoTypeStartedRef = useRef(false);

  // Stealth Auto-Type for Promo Video demo
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isDemo = localStorage.getItem('typrox_demo') === 'true' || window.location.search.includes('demo=true');
    if (!isDemo || !targetText) return;

    if (status === 'idle') {
      autoTypeStartedRef.current = false;
    }

    if (status !== 'idle' || autoTypeStartedRef.current) return;

    autoTypeStartedRef.current = true;
    forceFocus();

    let idx = 0;
    let currentText = "";
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const typeNext = () => {
      if (!active) return;
      if (idx >= targetText.length) {
        autoTypeStartedRef.current = false;
        return;
      }
      
      // Simulate typo at 's' in 'consistent' (index 44 in the TargetSentence)
      if (idx === 44 && !currentText.endsWith('z')) {
        currentText += 'z';
        handleInput('z');
        
        timer = setTimeout(() => {
          if (!active) return;
          currentText = currentText.slice(0, -1);
          handleBackspace();
          
          timer = setTimeout(() => {
            if (!active) return;
            const char = targetText[idx];
            currentText += char;
            handleInput(char);
            idx++;
            
            const delay = 80 + Math.random() * 30;
            timer = setTimeout(typeNext, delay);
          }, 120);
        }, 180);
      } else {
        const char = targetText[idx];
        currentText += char;
        handleInput(char);
        idx++;
        
        const delay = 80 + Math.random() * 30;
        timer = setTimeout(typeNext, delay);
      }
    };

    // Delay start of auto-typing slightly to show focus state
    timer = setTimeout(typeNext, 2000);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [status, targetText, handleInput, handleBackspace, forceFocus]);

  const durationOptions = [15, 30, 60, 120];
  const modeOptions: Array<'words' | 'quotes' | 'numbers' | 'punctuation' | 'code'> = [
    'words',
    'quotes',
    'numbers',
    'punctuation',
    'code',
  ];

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-8 px-4 relative">
      {/* Reactive ambient glows based on WPM */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[100%] pointer-events-none transition-all duration-700 ease-out" 
        style={{
          width: status === 'running' ? `${Math.min(800, 400 + wpm * 4)}px` : '600px',
          height: status === 'running' ? `${Math.min(400, 200 + wpm * 2)}px` : '300px',
          background: `radial-gradient(circle, var(--accent) 0%, transparent 70%)`,
          opacity: status === 'running' ? Math.min(0.08, 0.02 + wpm * 0.0005) : 0.02,
          filter: `blur(${status === 'running' ? '140px' : '120px'})`
        }} 
      />

      {/* Top Configuration Bar */}
      <div
        className={`flex flex-col sm:flex-row items-center justify-between gap-4 p-2 bg-surface/50 backdrop-blur-md border border-border/80 rounded-2xl shadow-sm transition-all duration-700 ease-in-out relative z-10 ${
          status !== 'idle' ? 'opacity-0 -translate-y-4 pointer-events-none absolute w-full' : 'opacity-100 translate-y-0'
        }`}
      >
        {/* Modes */}
        <div className="flex items-center gap-1 p-1 bg-surface-accent/30 rounded-xl">
          {modeOptions.map((opt) => (
            <button
              key={opt}
              onClick={() => {
                startTestWithConfig({ mode: opt, duration });
              }}
              className={`relative px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer rounded-lg z-10 ${
                mode === opt
                  ? 'text-text-primary'
                  : 'text-text-tertiary hover:text-text-primary'
              }`}
            >
              {mode === opt && (
                <div className="absolute inset-0 bg-surface rounded-lg shadow-sm border border-border/60 -z-10" />
              )}
              {opt}
            </button>
          ))}
        </div>

        {/* Durations */}
        <div className="flex items-center gap-1 p-1 bg-surface-accent/30 rounded-xl">
          {durationOptions.map((time) => (
            <button
              key={time}
              onClick={() => {
                startTestWithConfig({ mode, duration: time });
              }}
              className={`relative px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer rounded-lg z-10 ${
                duration === time
                  ? 'text-text-primary'
                  : 'text-text-tertiary hover:text-text-primary'
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

      {/* Real-time stats (modern glass layout) */}
      <div 
        className={`grid grid-cols-2 md:grid-cols-5 gap-4 font-sans transition-all duration-700 ease-in-out relative z-10 ${
          status === 'idle' ? 'opacity-40 grayscale' : 
          status === 'running' ? 'opacity-0 -translate-y-4 pointer-events-none absolute w-full' : 'opacity-100'
        }`}
      >
        {[
          { label: 'Remaining', value: status === 'running' ? `${timeLeft}s` : `${duration}s`, active: true },
          { label: 'WPM', value: status === 'running' ? wpm : '--', highlight: true },
          { label: 'Accuracy', value: status === 'running' ? `${accuracy}%` : '--%' },
          { label: 'Combo', value: status === 'running' ? combo : '--' },
          { label: 'Active Streak', value: `${streakDays} Day${streakDays !== 1 ? 's' : ''}` }
        ].map((stat, i) => (
          <div key={i} className="flex flex-col items-center justify-center p-4 bg-surface/60 backdrop-blur-sm border border-border/80 rounded-2xl text-center shadow-xs">
            <span className={`text-3xl font-bold font-mono leading-none ${stat.highlight ? 'text-accent' : 'text-text-primary'}`}>
              {stat.value}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-text-tertiary mt-2">{stat.label}</span>
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
        {/* Inner glow on focus */}
        {isFocused && (
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
        )}

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

        {/* Elegant Minimalist Floating Focus Prompt */}
        {!isFocused && status !== 'completed' && (
          <div className="absolute inset-x-0 bottom-6 z-20 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 px-4 py-2 bg-background/90 backdrop-blur-md border border-border/80 text-xs font-semibold text-text-primary uppercase tracking-widest shadow-lg rounded-xl animate-pulse">
              <Keyboard className="w-3.5 h-3.5 text-accent" />
              <span>Click or press any key to focus</span>
            </div>
          </div>
        )}

        {/* Text rendering viewport */}
        <div className={`w-full transition-all duration-300 ${!isFocused && status !== 'completed' ? 'blur-[1px] opacity-40' : ''}`}>
          <TextDisplay
            targetText={targetText}
            userInput={userInput}
            currentIndex={currentIndex}
          />
        </div>
      </div>

      {/* Control Row (Hidden in focus mode) */}
      <div className={`flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-widest text-text-tertiary relative z-10 transition-all duration-700 ease-in-out ${
        status === 'running' ? 'opacity-0 translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0'
      }`}>
        <div className="flex items-center gap-2 opacity-60">
          <kbd className="px-2 py-1 bg-surface-accent border border-border/60 text-text-secondary font-mono rounded shadow-xs">Esc</kbd>
          <span>to restart</span>
        </div>

        <Button
          onClick={() => {
            resetTest();
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
