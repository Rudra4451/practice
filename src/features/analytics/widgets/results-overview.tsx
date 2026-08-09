'use client';

import React from 'react';
import { KeycapCard } from '@/design-system';

export interface ResultsOverviewProps {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
  errorCount: number;
  backspaceCount: number;
}

export const ResultsOverview: React.FC<ResultsOverviewProps> = ({
  wpm,
  rawWpm,
  accuracy,
  consistency,
  errorCount,
  backspaceCount,
}) => {
  const stats = [
    { label: 'Net WPM', value: wpm, highlight: true },
    { label: 'Raw WPM', value: rawWpm },
    { label: 'Accuracy', value: `${accuracy}%` },
    { label: 'Consistency', value: `${consistency}%` },
    { label: 'Errors', value: errorCount },
    { label: 'Backspaces', value: backspaceCount },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 w-full">
      {stats.map((s, i) => (
        <KeycapCard key={i} elevation="sm" className="flex flex-col items-center justify-center p-4 text-center">
          <span className={`typing-font font-mono text-3xl font-extrabold leading-none ${s.highlight ? 'text-accent' : 'text-text-primary'}`}>
            {s.value}
          </span>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-tertiary mt-2">
            {s.label}
          </span>
        </KeycapCard>
      ))}
    </div>
  );
};
