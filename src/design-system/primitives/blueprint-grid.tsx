'use client';

import React from 'react';

export interface BlueprintGridProps {
  opacity?: number;
  gridSize?: number;
  className?: string;
}

export const BlueprintGrid: React.FC<BlueprintGridProps> = ({
  opacity = 0.04,
  gridSize = 24,
  className = '',
}) => {
  return (
    <div
      className={`absolute inset-0 pointer-events-none z-0 ${className}`}
      style={{
        opacity,
        backgroundImage: `linear-gradient(to right, var(--text-primary) 1px, transparent 1px), linear-gradient(to bottom, var(--text-primary) 1px, transparent 1px)`,
        backgroundSize: `${gridSize}px ${gridSize}px`,
      }}
      aria-hidden="true"
    />
  );
};
