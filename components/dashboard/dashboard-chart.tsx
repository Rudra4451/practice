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

interface DashboardChartProps {
  chartData: Array<{ index: number; wpm: number }>;
}

export default function DashboardChart({ chartData }: DashboardChartProps) {
  if (!chartData || chartData.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="0" stroke="var(--border)" opacity={0.15} vertical={false} />
        <XAxis dataKey="index" stroke="var(--text-secondary)" fontSize={11} tickLine={true} axisLine={true} />
        <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={true} axisLine={true} />
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
          name="Speed (WPM)"
          stroke="var(--accent)"
          strokeWidth={3}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
