'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';

export interface LineSeriesData {
  second: number;
  wpm: number;
  rawWpm: number;
}

export interface BlueprintLineChartProps {
  data: LineSeriesData[];
  height?: number;
  className?: string;
}

export const BlueprintLineChart: React.FC<BlueprintLineChartProps> = ({
  data,
  height = 220,
  className = '',
}) => {
  const [hoverPoint, setHoverPoint] = useState<LineSeriesData | null>(null);

  if (!data || data.length === 0) {
    return (
      <div style={{ height }} className="w-full flex items-center justify-center text-text-tertiary text-xs font-mono font-bold uppercase tracking-widest">
        No Telemetry Recorded
      </div>
    );
  }

  const padding = { top: 20, right: 30, bottom: 30, left: 40 };
  const width = 800; // viewBox width

  const maxWpm = Math.max(120, ...data.map((d) => Math.max(d.wpm, d.rawWpm)));
  const maxSecond = Math.max(1, data[data.length - 1].second);

  const getX = (second: number) => padding.left + ((second - 1) / Math.max(1, maxSecond - 1)) * (width - padding.left - padding.right);
  const getY = (wpm: number) => height - padding.bottom - (wpm / maxWpm) * (height - padding.top - padding.bottom);

  // Generate SVG path d strings
  const wpmPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(d.second)} ${getY(d.wpm)}`).join(' ');
  const rawWpmPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(d.second)} ${getY(d.rawWpm)}`).join(' ');

  return (
    <div className={`relative w-full overflow-hidden ${className}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible select-none"
      >
        {/* Blueprint Grid Lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = padding.top + ratio * (height - padding.top - padding.bottom);
          const val = Math.round(maxWpm * (1 - ratio));
          return (
            <g key={i}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="var(--border)"
                strokeDasharray="4 4"
                strokeWidth="1"
                opacity="0.4"
              />
              <text
                x={padding.left - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-text-tertiary text-[10px] font-mono font-bold"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* X Axis Time Labels */}
        {data.filter((_, idx) => idx % Math.ceil(data.length / 6) === 0).map((d) => (
          <text
            key={d.second}
            x={getX(d.second)}
            y={height - 8}
            textAnchor="middle"
            className="fill-text-tertiary text-[10px] font-mono font-bold"
          >
            {d.second}s
          </text>
        ))}

        {/* Raw WPM Path (Dashed Accent) */}
        <motion.path
          d={rawWpmPath}
          fill="none"
          stroke="var(--text-tertiary)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          opacity="0.6"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />

        {/* Net WPM Path (Solid Accent Glow) */}
        <motion.path
          d={wpmPath}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="3"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />

        {/* Interactive Data Points */}
        {data.map((d) => (
          <circle
            key={d.second}
            cx={getX(d.second)}
            cy={getY(d.wpm)}
            r={hoverPoint?.second === d.second ? 6 : 3}
            className="fill-accent cursor-pointer transition-all duration-140"
            onMouseEnter={() => setHoverPoint(d)}
            onMouseLeave={() => setHoverPoint(null)}
          />
        ))}
      </svg>

      {/* Blueprint Hover Tooltip */}
      {hoverPoint && (
        <div
          className="absolute z-20 px-3 py-1.5 bg-surface border border-accent/40 rounded-lg shadow-lg text-xs font-mono font-bold text-text-primary pointer-events-none transition-all duration-140"
          style={{
            left: `${((hoverPoint.second - 1) / Math.max(1, maxSecond - 1)) * 80 + 10}%`,
            top: '10px',
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-accent">{hoverPoint.wpm} WPM</span>
            <span className="text-text-tertiary">{hoverPoint.rawWpm} Raw</span>
            <span className="text-text-secondary">@{hoverPoint.second}s</span>
          </div>
        </div>
      )}
    </div>
  );
};
