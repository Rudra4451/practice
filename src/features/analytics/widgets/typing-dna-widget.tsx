'use client';

import React from 'react';
import { KeycapCard } from '@/design-system';
import { BlueprintRadarChart } from '@/design-system/charts/blueprint-radar-chart';

export interface TypingDNAWidgetProps {
  attributes: {
    reactionTime: number;
    precision: number;
    consistency: number;
    rhythm: number;
    acceleration: number;
  };
}

export const TypingDNAWidget: React.FC<TypingDNAWidgetProps> = ({ attributes }) => {
  return (
    <KeycapCard elevation="md" className="w-full flex flex-col items-center gap-4">
      <div className="w-full border-b border-border/40 pb-3 text-left">
        <span className="font-display text-sm font-bold text-text-primary uppercase tracking-wider">
          Typing DNA (5 Core Attributes)
        </span>
      </div>
      <BlueprintRadarChart attributes={attributes} size={280} />
    </KeycapCard>
  );
};
