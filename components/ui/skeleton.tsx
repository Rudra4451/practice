import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div
    className={`relative overflow-hidden bg-surface-accent rounded-lg ${className}`}
    role="status"
    aria-label="Loading"
  >
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-border/30 to-transparent animate-shimmer" />
  </div>
);

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3,
  className = '',
}) => (
  <div className={`flex flex-col gap-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        className={`h-3 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
      />
    ))}
  </div>
);

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`p-6 rounded-2xl border border-border bg-surface ${className}`}>
    <Skeleton className="h-4 w-1/3 mb-4" />
    <Skeleton className="h-8 w-2/3 mb-2" />
    <Skeleton className="h-3 w-1/2" />
  </div>
);
