'use client';

import React from 'react';
import { KeycapCard } from '@/design-system';

export interface WeakKeysWidgetProps {
  errorKeys: Record<string, number>;
  keySpeeds: Record<string, number>;
}

export const WeakKeysWidget: React.FC<WeakKeysWidgetProps> = ({ errorKeys, keySpeeds }) => {
  const topErrors = Object.entries(errorKeys)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const slowestKeys = Object.entries(keySpeeds)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <KeycapCard elevation="md" className="w-full flex flex-col gap-4">
      <div className="border-b border-border/40 pb-3">
        <span className="font-display text-sm font-bold text-text-primary uppercase tracking-wider">
          Bottleneck Diagnostics (Weak Keys)
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Most Errored Keys */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-text-tertiary">
            Top Error Keys
          </span>
          {topErrors.length === 0 ? (
            <span className="text-xs text-success font-mono">Zero Key Mistakes!</span>
          ) : (
            <div className="flex flex-wrap gap-2">
              {topErrors.map(([key, count]) => (
                <div
                  key={key}
                  className="px-3 py-1.5 bg-error/10 border border-error/30 rounded-lg text-xs font-mono font-bold text-error flex items-center gap-2"
                >
                  <span>&apos;{key}&apos;</span>
                  <span className="text-[10px] opacity-80">{count}x</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Slowest Keys */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-text-tertiary">
            Slowest Key Intervals
          </span>
          {slowestKeys.length === 0 ? (
            <span className="text-xs text-text-tertiary font-mono">No latency bottlenecks</span>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slowestKeys.map(([key, time]) => (
                <div
                  key={key}
                  className="px-3 py-1.5 bg-surface-accent border border-border/60 rounded-lg text-xs font-mono font-bold text-text-primary flex items-center gap-2"
                >
                  <span>&apos;{key}&apos;</span>
                  <span className="text-[10px] text-text-tertiary">{time}ms</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </KeycapCard>
  );
};
