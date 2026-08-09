'use client';

import React, { useState, useEffect } from 'react';
import { performanceMonitor, SystemMetrics } from './performance-monitor';

export const DebugOverlay: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [metrics, setMetrics] = useState<SystemMetrics>(performanceMonitor.getMetrics());

  // Listen for Ctrl+Shift+D shortcut to toggle debug overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Poll metrics while open
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setMetrics(performanceMonitor.getMetrics());
    }, 500);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[99999] p-4 bg-background/95 border-[1.5px] border-accent/40 rounded-[16px] shadow-2xl font-mono text-xs text-text-primary backdrop-blur-md flex flex-col gap-2 min-w-[220px]">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <span className="font-bold uppercase tracking-wider text-accent">TyProX Dev Debug</span>
        <button
          onClick={() => setIsOpen(false)}
          className="text-text-tertiary hover:text-text-primary text-[10px] uppercase font-bold"
        >
          Close [Esc]
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 py-1">
        <span className="text-text-tertiary">Frame Rate:</span>
        <span className={`font-bold ${metrics.fps < 50 ? 'text-error' : 'text-success'}`}>{metrics.fps} FPS</span>

        <span className="text-text-tertiary">Worker Exec:</span>
        <span className="font-bold text-text-primary">{metrics.workerExecTimeMs} ms</span>

        <span className="text-text-tertiary">Input Latency:</span>
        <span className="font-bold text-text-primary">{metrics.inputLatencyMs} ms</span>

        <span className="text-text-tertiary">JS Heap:</span>
        <span className="font-bold text-text-primary">{metrics.memoryUsageMb || '--'} MB</span>

        <span className="text-text-tertiary">DB Latency:</span>
        <span className="font-bold text-text-primary">{metrics.dbLatencyMs || '--'} ms</span>
      </div>

      <span className="text-[10px] text-text-tertiary/70 pt-1 border-t border-border/40 text-center">
        Toggle: Ctrl + Shift + D
      </span>
    </div>
  );
};
