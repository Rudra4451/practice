'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, FastForward } from 'lucide-react';
import { TextDisplay } from './text-display';
import { KeystrokeTelemetry } from '@/stores/typing-store';

interface ReplayPlayerProps {
  targetText: string;
  telemetry: KeystrokeTelemetry[];
  onClose?: () => void;
}

export const ReplayPlayer: React.FC<ReplayPlayerProps> = ({
  targetText,
  telemetry,
  onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 1.5x, 2x
  const [currentTime, setCurrentTime] = useState(0); // in ms
  const [replayInput, setReplayInput] = useState('');
  const [replayIndex, setReplayIndex] = useState(0);

  const requestRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false); // stable ref to avoid stale closure in rAF
  const totalDuration = telemetry.length > 0 ? telemetry[telemetry.length - 1].t : 0;

  // Resolve typed text state for a given timestamp
  const getReplayStateAt = useCallback((ms: number) => {
    let input = '';
    let idx = 0;
    
    // Sort events by timestamp
    const activeEvents = telemetry.filter((e) => e.t <= ms);
    
    activeEvents.forEach((event) => {
      if (event.y === 0) {
        // Input character
        input += event.k;
        idx++;
      } else if (event.y === 1) {
        // Delete/Backspace character
        input = input.slice(0, -1);
        idx = Math.max(0, idx - 1);
      }
    });

    return { input, idx };
  }, [telemetry]);

  // Handle animation frame update loop — reads isPlayingRef to avoid stale closure
  const animate = useCallback((time: number) => {
    if (!isPlayingRef.current) return; // bail if paused between frames

    if (previousTimeRef.current !== null) {
      const delta = time - previousTimeRef.current;
      setCurrentTime((prev) => {
        const next = prev + delta * playbackSpeed;
        if (next >= totalDuration) {
          isPlayingRef.current = false;
          setIsPlaying(false);
          return totalDuration;
        }
        return next;
      });
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  }, [playbackSpeed, totalDuration]);

  // Sync animation loops with isPlaying state changes
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (isPlaying) {
      previousTimeRef.current = null;
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    }
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
  }, [isPlaying, animate]);

  // Update input displays as current playback time updates
  useEffect(() => {
    const { input, idx } = getReplayStateAt(currentTime);
    setReplayInput(input);
    setReplayIndex(idx);
  }, [currentTime, getReplayStateAt]);

  const togglePlay = () => {
    if (currentTime >= totalDuration) {
      setCurrentTime(0);
    }
    setIsPlaying(!isPlaying);
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
    setCurrentTime(val);
  };

  return (
    <div className="w-full flex flex-col gap-6 p-6 bg-surface border border-border rounded-2xl shadow-lg transition-all duration-300">
      {/* Replay Header */}
      <div className="flex items-center justify-between border-b border-border/10 pb-4">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-text-primary uppercase tracking-wider">Replay Viewer</span>
          <span className="text-xs text-text-secondary">Watch a keystroke reproduction of this test run</span>
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="text-xs font-medium text-text-secondary hover:text-text-primary px-3 py-1.5 bg-background border border-border/50 rounded-lg"
            >
              Exit Replay
            </button>
          )}
        </div>
      </div>

      {/* Typing Container Frame (Read-only text display) */}
      <div className="relative p-8 bg-background border border-border/50 rounded-xl min-h-[140px] flex items-center">
        <TextDisplay
          targetText={targetText}
          userInput={replayInput}
          currentIndex={replayIndex}
        />
      </div>

      {/* Replay HUD Control Panel */}
      <div className="flex flex-col gap-4">
        {/* Progress Slider */}
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-text-secondary w-12 text-right">
            {(currentTime / 1000).toFixed(1)}s
          </span>
          <input
            type="range"
            min={0}
            max={totalDuration}
            value={currentTime}
            onChange={handleProgressChange}
            className="flex-1 h-1.5 bg-border/40 hover:bg-border/60 rounded-lg appearance-none cursor-pointer accent-accent"
          />
          <span className="font-mono text-xs text-text-secondary w-12 text-left">
            {(totalDuration / 1000).toFixed(1)}s
          </span>
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="p-2 bg-accent hover:bg-accent/90 text-white rounded-lg transition-all hover:scale-105 shadow-sm"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            </button>

            {/* Restart */}
            <button
              onClick={handleRestart}
              className="p-2 bg-surface hover:bg-surface-hover border border-border text-text-primary rounded-lg transition-all"
              aria-label="Restart replay"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Speed selection */}
            <button
              onClick={handleSpeedToggle}
              className="flex items-center gap-1 px-3 py-2 bg-surface hover:bg-surface-hover border border-border text-text-primary text-xs font-semibold rounded-lg transition-all font-mono"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>{playbackSpeed}x</span>
            </button>
          </div>

          <div className="text-xs text-text-secondary font-medium">
            {replayIndex} / {targetText.length} keys reproduced
          </div>
        </div>
      </div>
    </div>
  );
};
