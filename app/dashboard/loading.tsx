import React from 'react';
import { CardSkeleton, Skeleton, TableSkeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="h-14 border-b border-border bg-background/80" />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-6 py-10 flex flex-col gap-8">
        <Skeleton className="h-16 w-80" />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <CardSkeleton height="col-span-2 h-36" />
          <CardSkeleton height="col-span-2 md:col-span-1 h-36" />
          <CardSkeleton height="col-span-2 md:col-span-1 h-36" />
          <CardSkeleton height="col-span-2 md:col-span-1 h-36" />
          <CardSkeleton height="col-span-2 md:col-span-1 h-36" />
        </div>
        <div className="p-6 border border-border rounded-2xl bg-surface">
          <TableSkeleton rows={5} />
        </div>
      </main>
    </div>
  );
}

