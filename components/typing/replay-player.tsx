'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, RotateCcw, FastForward } from 'lucide-react';
import { TextDisplay } from './text-display';
import type { KeystrokeTelemetry } from '@/stores/typing-store';

interface ReplayPlayerProps {
  targetText: string;
  telemetry: KeystrokeTelemetry[];
  onClose?: () => void;
}

interface ReplayCheckpoint {
  t: number;
  input: string;
  idx: number;
}

export const ReplayPlayer: React.FC<ReplayPlayerProps> = ({
  targetText,
  telemetry,
  onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);

  const requestRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | null>(null);

  // Precompute sorted replay checkpoints once per telemetry payload (O(N))
  const { checkpoints, totalDuration } = useMemo(() => {
    if (telemetry.length === 0) {
      return { checkpoints: [] as ReplayCheckpoint[], totalDuration: 0 };
    }

    const sorted = [...telemetry].sort((a, b) => a.t - b.t);
    const steps: ReplayCheckpoint[] = [];
    let runningInput = '';
    let runningIdx = 0;

    for (const event of sorted) {
      if (event.y === 0) {
        runningInput += event.k;
        runningIdx += 1;
      } else {
        runningInput = runningInput.slice(0, -1);
        runningIdx = Math.max(0, runningIdx - 1);
      }
      steps.push({
        t: event.t,
        input: runningInput,
        idx: runningIdx,
      });
    }

    return {
      checkpoints: steps,
      totalDuration: sorted[sorted.length - 1].t,
    };
  }, [telemetry]);

  // Binary search checkpoint matching currentTime (O(log N) per frame, zero effect state mutations)
  const { replayInput, replayIndex } = useMemo(() => {
    if (checkpoints.length === 0 || currentTime < checkpoints[0].t) {
      return { replayInput: '', replayIndex: 0 };
    }

    let low = 0;
    let high = checkpoints.length - 1;
    let best = 0;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (checkpoints[mid].t <= currentTime) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return {
      replayInput: checkpoints[best].input,
      replayIndex: checkpoints[best].idx,
    };
  }, [checkpoints, currentTime]);

  // Clean requestAnimationFrame playback loop
  useEffect(() => {
    if (!isPlaying) {
      previousTimeRef.current = null;
      return;
    }

    let active = true;

    const step = (time: number) => {
      if (!active) return;

      if (previousTimeRef.current !== null) {
        const delta = time - previousTimeRef.current;
        setCurrentTime((prev) => {
          const next = prev + delta * playbackSpeed;
          if (next >= totalDuration) {
            active = false;
            setIsPlaying(false);
            return totalDuration;
          }
          return next;
        });
      }

      previousTimeRef.current = time;
      if (active) {
        requestRef.current = requestAnimationFrame(step);
      }
    };

    requestRef.current = requestAnimationFrame(step);

    return () => {
      active = false;
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
  }, [isPlaying, playbackSpeed, totalDuration]);

  const togglePlay = () => {
    if (totalDuration === 0) return;
    if (currentTime >= totalDuration) {
      setCurrentTime(0);
    }
    setIsPlaying((prev) => !prev);
  };

  const handleRestart = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSpeedToggle = () => {
    const speeds = [1, 1.5, 2, 4];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    setPlaybackSpeed(speeds[nextIdx]);
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!Number.isNaN(val)) {
      setCurrentTime(val);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 p-6 bg-surface border border-border rounded-2xl shadow-lg transition-all duration-300">
      <div className="flex items-center justify-between border-b border-border/60 pb-4">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-text-primary uppercase tracking-wider">
            Replay Viewer
          </span>
          <span className="text-xs text-text-secondary">
            Watch a keystroke reproduction of this test run
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-text-secondary hover:text-text-primary px-3 py-2 min-h-[38px] bg-background border border-border rounded-lg cursor-pointer transition-colors"
          >
            Exit Replay
          </button>
        )}
      </div>

      <div className="relative p-6 md:p-8 bg-background border border-border rounded-xl min-h-[140px] flex items-center">
        <TextDisplay
          targetText={targetText}
          userInput={replayInput}
          currentIndex={replayIndex}
        />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-text-secondary w-12 text-right tabular-nums">
            {(currentTime / 1000).toFixed(1)}s
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(totalDuration, 1)}
            value={Math.min(currentTime, Math.max(totalDuration, 1))}
            onChange={handleProgressChange}
            aria-label="Replay timeline scrubber"
            className="flex-1 h-2 bg-border hover:bg-text-tertiary rounded-lg appearance-none cursor-pointer accent-accent"
          />
          <span className="font-mono text-xs text-text-secondary w-12 text-left tabular-nums">
            {(totalDuration / 1000).toFixed(1)}s
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              disabled={totalDuration === 0}
              className="p-2.5 min-w-[40px] min-h-[40px] flex items-center justify-center bg-accent hover:brightness-105 text-accent-foreground rounded-lg transition-all shadow-sm cursor-pointer disabled:opacity-50"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
            </button>

            <button
              type="button"
              onClick={handleRestart}
              className="p-2.5 min-w-[40px] min-h-[40px] flex items-center justify-center bg-surface hover:bg-surface-accent border border-border text-text-primary rounded-lg transition-colors cursor-pointer"
              aria-label="Restart replay"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleSpeedToggle}
              className="flex items-center gap-1.5 px-3 py-2 min-h-[40px] bg-surface hover:bg-surface-accent border border-border text-text-primary text-xs font-semibold rounded-lg transition-colors font-mono cursor-pointer"
              aria-label="Toggle playback speed"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>{playbackSpeed}x</span>
            </button>
          </div>

          <div className="text-xs text-text-secondary font-medium tabular-nums">
            {replayIndex} / {targetText.length} keys reproduced
          </div>
        </div>
      </div>
    </div>
  );
};
