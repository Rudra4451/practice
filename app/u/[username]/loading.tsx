import React from 'react';
import { CardSkeleton, Skeleton } from '@/components/ui/skeleton';

export default function PublicProfileLoading() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="h-14 border-b border-border bg-background/80" />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-12 flex flex-col gap-8">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <CardSkeleton height="h-28" />
          <CardSkeleton height="h-28" />
          <CardSkeleton height="h-28" />
          <CardSkeleton height="h-28" />
        </div>
        <Skeleton className="h-56 w-full rounded-2xl" />
      </main>
    </div>
  );
}

