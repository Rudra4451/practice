'use client';

import React, { useEffect } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ErrorPage({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled route error:', error);
  }, [error]);

  const handleRetry = () => {
    if (unstable_retry) {
      unstable_retry();
    } else if (reset) {
      reset();
    }
  };

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col items-center justify-center px-4 py-16 text-center gap-6">
      <div className="w-12 h-12 rounded-2xl bg-error/10 border border-error/30 flex items-center justify-center text-error">
        <AlertCircle className="w-6 h-6" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-2 max-w-md">
        <h1 className="text-2xl font-bold font-display tracking-tight text-text-primary">
          Something Went Wrong
        </h1>
        <p className="text-sm text-text-secondary leading-relaxed">
          An unexpected error interrupted rendering for this view. Your local practice history remains safe.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={handleRetry} variant="primary">
          <RotateCcw className="w-4 h-4" />
          <span>Try Again</span>
        </Button>
        <Button href="/" variant="secondary">
          Home
        </Button>
      </div>
    </div>
  );
}

