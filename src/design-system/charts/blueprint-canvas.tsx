'use client';

import React from 'react';

export interface BlueprintCanvasProps {
  width?: number;
  height?: number;
  viewBox?: string;
  className?: string;
  children: React.ReactNode;
}

export const BlueprintCanvas: React.FC<BlueprintCanvasProps> = ({
  width = 800,
  height = 240,
  viewBox,
  className = '',
  children,
}) => {
  return (
    <svg
      viewBox={viewBox || `0 0 ${width} ${height}`}
      className={`w-full h-auto overflow-visible select-none ${className}`}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
};
