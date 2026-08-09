'use client';

import React from 'react';
import { KeycapCard } from '@/design-system';
import { BlueprintLineChart, LineSeriesData } from '@/design-system/charts/blueprint-line-chart';

export interface PerformanceTimelineProps {
  timeline: LineSeriesData[];
}

export const PerformanceTimeline: React.FC<PerformanceTimelineProps> = ({ timeline }) => {
  return (
    <KeycapCard elevation="md" className="w-full flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-border/40 pb-3">
        <span className="font-display text-sm font-bold text-text-primary uppercase tracking-wider">
          Performance Timeline (WPM vs Raw WPM)
        </span>
        <div className="flex items-center gap-4 text-xs font-mono font-bold">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1 bg-accent rounded-full" />
            <span className="text-text-primary">Net WPM</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1 bg-text-tertiary rounded-full opacity-60" />
            <span className="text-text-tertiary">Raw WPM</span>
          </div>
        </div>
      </div>
      <BlueprintLineChart data={timeline} height={220} />
    </KeycapCard>
  );
};
