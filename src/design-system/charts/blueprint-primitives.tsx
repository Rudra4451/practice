'use client';

import React from 'react';
import { motion } from 'framer-motion';

export interface BlueprintAxisProps {
  ticks: Array<{ x: number; y: number; label: string }>;
  orientation: 'horizontal' | 'vertical';
}

export const BlueprintAxis: React.FC<BlueprintAxisProps> = ({ ticks, orientation }) => {
  return (
    <g className="blueprint-axis">
      {ticks.map((t, i) => (
        <text
          key={i}
          x={t.x}
          y={t.y}
          textAnchor={orientation === 'horizontal' ? 'middle' : 'end'}
          className="fill-text-tertiary text-[10px] font-mono font-bold"
        >
          {t.label}
        </text>
      ))}
    </g>
  );
};

export interface BlueprintSeriesProps {
  pathData: string;
  color?: string;
  strokeWidth?: number;
  isDashed?: boolean;
}

export const BlueprintSeries: React.FC<BlueprintSeriesProps> = ({
  pathData,
  color = 'var(--accent)',
  strokeWidth = 2.5,
  isDashed = false,
}) => {
  return (
    <motion.path
      d={pathData}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeDasharray={isDashed ? '4 3' : 'none'}
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    />
  );
};

export interface BlueprintCursorProps {
  x: number;
  height: number;
}

export const BlueprintCursor: React.FC<BlueprintCursorProps> = ({ x, height }) => {
  return (
    <line
      x1={x}
      y1={0}
      x2={x}
      y2={height}
      stroke="var(--accent)"
      strokeWidth="1.5"
      strokeDasharray="2 2"
      opacity="0.8"
    />
  );
};
