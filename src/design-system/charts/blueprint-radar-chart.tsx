'use client';

import React from 'react';
import { motion } from 'framer-motion';

export interface AttributesData {
  reactionTime: number; // 0-100 score equivalent
  precision: number;    // %
  consistency: number;  // %
  rhythm: number;       // %
  acceleration: number; // normalized score
}

export interface BlueprintRadarChartProps {
  attributes: AttributesData;
  size?: number;
  className?: string;
}

export const BlueprintRadarChart: React.FC<BlueprintRadarChartProps> = ({
  attributes,
  size = 280,
  className = '',
}) => {
  const center = size / 2;
  const radius = size * 0.35;

  const labels = [
    { name: 'Precision', value: Math.min(100, Math.max(0, attributes.precision)) },
    { name: 'Consistency', value: Math.min(100, Math.max(0, attributes.consistency)) },
    { name: 'Rhythm', value: Math.min(100, Math.max(0, attributes.rhythm)) },
    { name: 'Acceleration', value: Math.min(100, Math.max(0, 50 + attributes.acceleration * 2)) },
    { name: 'Reaction', value: Math.min(100, Math.max(0, 100 - Math.min(100, attributes.reactionTime / 5))) },
  ];

  const totalPoints = labels.length;

  const getCoordinates = (index: number, valueRatio: number) => {
    const angle = (Math.PI * 2 * index) / totalPoints - Math.PI / 2;
    const x = center + radius * valueRatio * Math.cos(angle);
    const y = center + radius * valueRatio * Math.sin(angle);
    return { x, y };
  };

  const polygonPoints = labels
    .map((l, i) => {
      const { x, y } = getCoordinates(i, l.value / 100);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className={`relative flex flex-col items-center justify-center ${className}`}>
      <svg width={size} height={size} className="overflow-visible select-none">
        {/* Background Concentric Radar Polygons */}
        {[0.25, 0.5, 0.75, 1].map((level) => {
          const points = labels
            .map((_, i) => {
              const { x, y } = getCoordinates(i, level);
              return `${x},${y}`;
            })
            .join(' ');
          return (
            <polygon
              key={level}
              points={points}
              fill="none"
              stroke="var(--border)"
              strokeWidth="1"
              strokeDasharray={level === 1 ? 'none' : '3 3'}
              opacity="0.4"
            />
          );
        })}

        {/* Spoke Rays */}
        {labels.map((_, i) => {
          const { x, y } = getCoordinates(i, 1);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="var(--border)"
              strokeWidth="1"
              opacity="0.3"
            />
          );
        })}

        {/* Active Attributes Radar Polygon */}
        <motion.polygon
          points={polygonPoints}
          fill="rgba(255, 92, 0, 0.15)"
          stroke="var(--accent)"
          strokeWidth="2.5"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />

        {/* Outer Attribute Labels */}
        {labels.map((l, i) => {
          const { x, y } = getCoordinates(i, 1.25);
          return (
            <text
              key={l.name}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-text-primary text-[10px] font-mono font-bold uppercase tracking-wider"
            >
              {l.name} ({Math.round(l.value)})
            </text>
          );
        })}
      </svg>
    </div>
  );
};
