import React from 'react';
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton';

export default function LeaderboardLoading() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="h-14 border-b border-border bg-background/80" />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 md:px-6 py-10 flex flex-col gap-8">
        <Skeleton className="h-16 w-72" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="p-6 border border-border rounded-2xl bg-surface">
          <TableSkeleton rows={6} />
        </div>
      </main>
    </div>
  );
}

