'use client';

import React, { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTypingStore } from '@/stores/typing-store';
import { Navbar } from '@/components/navbar';
import { TypingContainer } from '@/components/typing/typing-container';
import { ResultScreen } from '@/components/typing/result-screen';

function TypingArena() {
  const { status, setMode, setDuration, setSeed, startTest } = useTypingStore();
  const searchParams = useSearchParams();

  // Load URL query parameters on initiation
  useEffect(() => {
    const urlSeed = searchParams.get('seed');
    const urlMode = searchParams.get('mode');
    const urlDuration = searchParams.get('duration');

    let changed = false;

    if (urlSeed) {
      setSeed(urlSeed);
      changed = true;
    }
    if (urlMode) {
      setMode(urlMode as any);
      changed = true;
    }
    if (urlDuration) {
      setDuration(parseInt(urlDuration, 10));
      changed = true;
    }

    if (changed) {
      startTest();
    }
  }, [searchParams, setMode, setDuration, setSeed, startTest]);

  return (
    <main className="flex-1 flex flex-col items-center justify-center py-12 md:py-20 bg-background text-text-primary">
      {status === 'completed' ? <ResultScreen /> : <TypingContainer />}
    </main>
  );
}

export default function TypingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />
      <Suspense fallback={
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 bg-accent animate-spin" />
        </div>
      }>
        <TypingArena />
      </Suspense>
    </div>
  );
}
