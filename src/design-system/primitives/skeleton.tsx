'use client';

import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  radius?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  radius = '12px',
  className = '',
  style,
  ...props
}) => {
  return (
    <div
      className={`animate-pulse bg-surface-accent/60 border border-border/40 ${className}`}
      style={{
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
      aria-hidden="true"
      {...props}
    />
  );
};
