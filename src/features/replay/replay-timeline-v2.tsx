'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, FastForward, ChevronLeft, ChevronRight, Bookmark } from 'lucide-react';
import { KeycapCard, KeycapButton } from '@/design-system';

export interface ReplayFrame {
  t: number;
  k: string;
  y: number;
  i: number;
}

export interface ReplayTimelineV2Props {
  targetText: string;
  telemetry: ReplayFrame[];
  onClose?: () => void;
}

export const ReplayTimelineV2: React.FC<ReplayTimelineV2Props> = ({
  targetText,
  telemetry,
  onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1); // 0.5x, 1x, 1.5x, 2x, 4x
  const [currentTime, setCurrentTime] = useState(0);
  const [bookmarks, setBookmarks] = useState<number[]>([]);

  const totalDuration = telemetry.length > 0 ? telemetry[telemetry.length - 1].t : 0;
  const requestRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | null>(null);

  // Compute state at current time
  const getReplayStateAt = useCallback(
    (ms: number) => {
      let input = '';
      let idx = 0;
      let errors = 0;

      const activeEvents = telemetry.filter((e) => e.t <= ms);
      activeEvents.forEach((e) => {
        if (e.y === 0) {
          input += e.k;
          idx++;
          if (e.k !== targetText[e.i]) errors++;
        } else if (e.y === 1) {
          input = input.slice(0, -1);
          idx = Math.max(0, idx - 1);
        }
      });

      const currentWpm = Math.round((input.length / 5) / (Math.max(1, ms) / 60000));
      return { input, idx, errors, currentWpm };
    },
    [telemetry, targetText]
  );

  const stateAtCurrentTime = getReplayStateAt(currentTime);

  const animateRef = useRef<(time: number) => void>(() => {});

  useEffect(() => {
    animateRef.current = (time: number) => {
      if (!isPlaying) return;
      if (previousTimeRef.current !== null) {
        const delta = time - previousTimeRef.current;
        setCurrentTime((prev) => {
          const next = prev + delta * speed;
          if (next >= totalDuration) {
            setIsPlaying(false);
            return totalDuration;
          }
          return next;
        });
      }
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame((t) => animateRef.current(t));
    };
  });

  useEffect(() => {
    if (isPlaying) {
      previousTimeRef.current = null;
      requestRef.current = requestAnimationFrame((t) => animateRef.current(t));
    } else if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying]);

  const handleFrameStep = (direction: 'prev' | 'next') => {
    setIsPlaying(false);
    if (direction === 'prev') {
      const prevEvents = telemetry.filter((e) => e.t < currentTime);
      setCurrentTime(prevEvents.length > 0 ? prevEvents[prevEvents.length - 1].t : 0);
    } else {
      const nextEvent = telemetry.find((e) => e.t > currentTime);
      setCurrentTime(nextEvent ? nextEvent.t : totalDuration);
    }
  };

  const addBookmark = () => {
    if (!bookmarks.includes(currentTime)) {
      setBookmarks([...bookmarks, currentTime].sort((a, b) => a - b));
    }
  };

  return (
    <KeycapCard elevation="lg" className="w-full flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <div className="flex flex-col">
          <span className="font-display text-base font-bold text-text-primary uppercase tracking-wider">
            Layered Replay Timeline Engine v2 (ADR-011)
          </span>
          <span className="text-xs text-text-tertiary">
            7-Layer Composable Keystroke Reproduction
          </span>
        </div>
        {onClose && (
          <KeycapButton variant="secondary" size="sm" onClick={onClose}>
            Exit Replay
          </KeycapButton>
        )}
      </div>

      {/* Layer 1 & 2: Cursor & Typed Text Display Viewport */}
      <div className="relative p-6 bg-background border border-border/60 rounded-[18px] min-h-[140px] font-mono text-xl md:text-2xl leading-relaxed select-none">
        {targetText.split('').map((char, i) => {
          const isTyped = i < stateAtCurrentTime.idx;
          const isActive = i === stateAtCurrentTime.idx;
          const typedChar = stateAtCurrentTime.input[i];
          const isCorrect = typedChar === char;

          let charClass = 'text-text-tertiary';
          if (isTyped) {
            charClass = isCorrect ? 'text-text-primary' : 'text-error bg-error/20 rounded';
          }

          return (
            <span key={i} className={`relative ${charClass}`}>
              {isActive && (
                <span className="absolute -left-[1px] top-[10%] h-[80%] w-[2.5px] bg-accent rounded-full animate-caret shadow-[0_0_8px_var(--accent)]" />
              )}
              {char}
            </span>
          );
        })}
      </div>

      {/* 7-Layer Interactive Timeline Control Bar */}
      <div className="flex flex-col gap-4">
        {/* Layer 4 & 5: Live Metrics Indicators */}
        <div className="flex items-center justify-between text-xs font-mono font-bold">
          <div className="flex items-center gap-3">
            <span className="text-accent">Layer 4 (WPM): {stateAtCurrentTime.currentWpm}</span>
            <span className="text-error">Layer 3 (Errors): {stateAtCurrentTime.errors}</span>
          </div>
          <span className="text-text-tertiary font-bold">
            {(currentTime / 1000).toFixed(1)}s / {(totalDuration / 1000).toFixed(1)}s
          </span>
        </div>

        {/* Scrubbing Slider with Layer 7 Milestone Bookmarks */}
        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={totalDuration}
            value={currentTime}
            onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
            className="w-full h-2 bg-surface-accent rounded-lg appearance-none cursor-pointer accent-accent"
          />
          {bookmarks.map((bm, i) => (
            <div
              key={i}
              className="absolute top-0 w-2 h-2 bg-accent-secondary rounded-full -translate-x-1/2 cursor-pointer"
              style={{ left: `${(bm / Math.max(1, totalDuration)) * 100}%` }}
              onClick={() => setCurrentTime(bm)}
              title={`Bookmark at ${(bm / 1000).toFixed(1)}s`}
            />
          ))}
        </div>

        {/* Transport Controls */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <KeycapButton
              variant="accent"
              size="sm"
              onClick={() => {
                if (currentTime >= totalDuration) setCurrentTime(0);
                setIsPlaying(!isPlaying);
              }}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </KeycapButton>

            <KeycapButton
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsPlaying(false);
                setCurrentTime(0);
              }}
            >
              <RotateCcw className="w-4 h-4" />
            </KeycapButton>

            {/* Frame Stepping Keys */}
            <KeycapButton variant="secondary" size="sm" onClick={() => handleFrameStep('prev')}>
              <ChevronLeft className="w-4 h-4" />
            </KeycapButton>
            <KeycapButton variant="secondary" size="sm" onClick={() => handleFrameStep('next')}>
              <ChevronRight className="w-4 h-4" />
            </KeycapButton>

            {/* Bookmark */}
            <KeycapButton variant="secondary" size="sm" onClick={addBookmark}>
              <Bookmark className="w-4 h-4" />
            </KeycapButton>
          </div>

          {/* Speed Selector */}
          <KeycapButton
            variant="secondary"
            size="sm"
            onClick={() => {
              const speeds = [0.5, 1, 1.5, 2, 4];
              const nextIdx = (speeds.indexOf(speed) + 1) % speeds.length;
              setSpeed(speeds[nextIdx]);
            }}
          >
            <FastForward className="w-3.5 h-3.5" />
            <span className="font-mono">{speed}x</span>
          </KeycapButton>
        </div>
      </div>
    </KeycapCard>
  );
};
