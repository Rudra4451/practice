'use client';

import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface ResultChartProps {
  timeline: Array<{ second: number; wpm: number; rawWpm: number }>;
}

export default function ResultChart({ timeline }: ResultChartProps) {
  if (!timeline || timeline.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={timeline}>
        <CartesianGrid strokeDasharray="0" stroke="var(--border)" opacity={0.15} vertical={false} />
        <XAxis
          dataKey="second"
          stroke="var(--text-secondary)"
          fontSize={11}
          tickLine={true}
          axisLine={true}
          label={{ value: 'Seconds', position: 'insideBottom', offset: -5, fontSize: 10, fill: 'var(--text-secondary)', fontWeight: 'bold' }}
        />
        <YAxis
          stroke="var(--text-secondary)"
          fontSize={11}
          tickLine={true}
          axisLine={true}
          label={{ value: 'Words per Minute', angle: -90, position: 'insideLeft', offset: 5, fontSize: 10, fill: 'var(--text-secondary)', fontWeight: 'bold' }}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--surface-accent)',
            border: '2px solid var(--border)',
            borderRadius: '0px',
            fontSize: '12px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
          }}
          itemStyle={{ color: 'var(--text-primary)' }}
        />
        <Line
          type="monotone"
          dataKey="wpm"
          name="Net WPM"
          stroke="var(--accent)"
          strokeWidth={3}
          dot={false}
          activeDot={{ r: 6, strokeWidth: 2, stroke: 'var(--border)' }}
        />
        <Line
          type="monotone"
          dataKey="rawWpm"
          name="Raw WPM"
          stroke="var(--text-secondary)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
