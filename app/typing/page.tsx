'use client';

import React, { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { useTypingStore } from '@/stores/typing-store';
import { RANKED_MODES, VALID_DURATIONS } from '@/lib/typing/metrics';
import { Navbar } from '@/components/navbar';
import { TypingContainer } from '@/components/typing/typing-container';
import { ResultScreen } from '@/components/typing/result-screen';

const ALLOWED_URL_MODES = [...RANKED_MODES, 'drill', 'daily'] as const;

const TypingQuerySchema = z.object({
  mode: z.enum(ALLOWED_URL_MODES).optional(),
  duration: z.coerce
    .number()
    .int()
    .refine((d): d is (typeof VALID_DURATIONS)[number] =>
      (VALID_DURATIONS as readonly number[]).includes(d)
    )
    .optional(),
  seed: z
    .string()
    .trim()
    .min(4)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),
  targets: z.string().max(80).optional(),
});

function TypingArena() {
  const { status, startTestWithConfig } = useTypingStore();
  const searchParams = useSearchParams();

  useEffect(() => {
    const rawParams = {
      mode: searchParams.get('mode') ?? undefined,
      duration: searchParams.get('duration') ?? undefined,
      seed: searchParams.get('seed') ?? undefined,
      targets: searchParams.get('targets') ?? undefined,
    };

    const hasAnyParam = Boolean(
      rawParams.mode || rawParams.duration || rawParams.seed || rawParams.targets
    );

    if (!hasAnyParam) {
      const current = useTypingStore.getState();
      if (!current.targetText || current.seed.startsWith('daily-') || current.mode === 'drill') {
        startTestWithConfig({ mode: 'words', duration: 30, targets: [] });
      }
      return;
    }

    const parsed = TypingQuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      startTestWithConfig({
        mode: 'words',
        duration: 30,
        targets: [],
      });
      return;
    }

    const parsedTargets = parsed.data.targets
      ? parsed.data.targets
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length > 0 && t.length <= 3)
          .slice(0, 10)
      : [];

    startTestWithConfig({
      mode: parsed.data.mode ?? 'words',
      duration: parsed.data.duration ?? 30,
      seed: parsed.data.seed,
      targets: parsedTargets,
    });
  }, [searchParams, startTestWithConfig]);

  return (
    <main className="flex-1 w-full overflow-x-clip flex flex-col items-center justify-center py-12 md:py-20 bg-background text-text-primary">
      {status === 'completed' ? <ResultScreen /> : <TypingContainer />}
    </main>
  );
}

export default function TypingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <TypingArena />
      </Suspense>
    </div>
  );
}
