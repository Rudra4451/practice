'use client';

import React from 'react';

export default function GlobalError({
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
}) {
  const handleRetry = () => {
    if (unstable_retry) {
      unstable_retry();
    } else if (reset) {
      reset();
    }
  };

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0B0B0C] text-[#F5F5F3] flex flex-col items-center justify-center px-4 text-center gap-4 font-sans">
        <h1 className="text-2xl font-bold tracking-tight">Application Recovery</h1>
        <p className="text-sm text-[#A1A1A1] max-w-md">
          A critical layout error occurred. Reload to restore the application workspace.
        </p>
        <button
          type="button"
          onClick={handleRetry}
          className="px-5 py-2.5 rounded-xl bg-[#FF641F] text-[#0B0B0C] font-semibold text-sm cursor-pointer"
        >
          Reload View
        </button>
      </body>
    </html>
  );
}

