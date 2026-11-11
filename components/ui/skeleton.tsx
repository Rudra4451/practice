import React from 'react';

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-surface-accent/70 border border-border/50 ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
    </div>
  );
}

export function CardSkeleton({ height = 'h-32' }: { height?: string }) {
  return <Skeleton className={`w-full ${height}`} />;
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, idx) => (
        <Skeleton key={idx} className="w-full h-12" />
      ))}
    </div>
  );
}
