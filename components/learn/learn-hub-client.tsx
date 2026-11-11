'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { BookOpen, Star, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { useUserStore } from '@/stores/user-store';
import { useHydrated } from '@/lib/hooks/use-hydrated';
import {
  CURRICULUM_LESSONS,
  CURRICULUM_TRACKS,
  isLessonUnlocked,
} from '@/constants/curriculum';

export function LearnHubClient() {
  const hydrated = useHydrated();
  const { lessonProgress } = useUserStore();

  const activeProgress = useMemo(
    () => (hydrated ? (lessonProgress ?? {}) : {}),
    [hydrated, lessonProgress]
  );

  const summary = useMemo(() => {
    let completedCount = 0;
    let totalStars = 0;

    for (const lesson of CURRICULUM_LESSONS) {
      const rec = activeProgress[lesson.slug];
      if (rec?.completed) completedCount += 1;
      if (rec?.stars) totalStars += Math.min(3, rec.stars);
    }

    return {
      completedCount,
      totalLessons: CURRICULUM_LESSONS.length,
      totalStars,
      maxStars: CURRICULUM_LESSONS.length * 3,
      pct: Math.round((completedCount / CURRICULUM_LESSONS.length) * 100),
    };
  }, [activeProgress]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-6 py-10 flex flex-col gap-10">
        {/* Curriculum Overview Card */}
        <div className="p-6 md:p-8 bg-surface border border-border rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col gap-2 max-w-xl">
            <div className="flex items-center gap-2 text-accent-ink">
              <BookOpen className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-widest">
                Guided Curriculum
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-text-primary font-display">
              Structured Touch-Typing Path
            </h1>
            <p className="text-sm text-text-secondary leading-relaxed">
              Master one skill family at a time. Complete each lesson at 92%+ accuracy to unlock the next module cleanly.
            </p>
          </div>

          <div className="p-5 bg-surface-accent/50 border border-border rounded-xl min-w-[240px] flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
              <span className="text-text-secondary">Course Mastery</span>
              <span className="text-text-primary font-mono tabular-nums">
                {summary.completedCount} / {summary.totalLessons} Passed
              </span>
            </div>
            <div className="w-full h-2.5 bg-background border border-border rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300"
                style={{ width: `${summary.pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-text-secondary">Stars Earned</span>
              <span className="text-warning font-bold inline-flex items-center gap-1 tabular-nums">
                <Star className="w-3.5 h-3.5 fill-current" />
                {summary.totalStars} / {summary.maxStars}
              </span>
            </div>
          </div>
        </div>

        {/* Grouped Track Sections */}
        {CURRICULUM_TRACKS.map((track) => {
          const trackLessons = CURRICULUM_LESSONS.filter((l) => l.track === track);
          return (
            <section key={track} className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-xl font-bold font-display text-text-primary tracking-tight">
                  {track} Track
                </h2>
                <span className="text-xs font-mono font-semibold text-text-secondary">
                  {trackLessons.length} Modules
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {trackLessons.map((lesson) => {
                  const rec = activeProgress[lesson.slug];
                  const unlocked = isLessonUnlocked(lesson, activeProgress);
                  const stars = rec?.stars ?? 0;

                  return (
                    <div
                      key={lesson.slug}
                      className={`p-6 rounded-2xl border flex flex-col justify-between gap-5 transition-all ${
                        unlocked
                          ? 'bg-surface border-border shadow-xs hover:border-accent/45'
                          : 'bg-surface-accent/35 border-border/70 opacity-75'
                      }`}
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-mono font-bold uppercase tracking-wider text-text-secondary">
                            Lesson {String(lesson.order).padStart(2, '0')}
                          </span>
                          <div className="flex items-center gap-1" aria-label={`${stars} of 3 stars`}>
                            {[1, 2, 3].map((slot) => (
                              <Star
                                key={slot}
                                className={`w-4 h-4 ${
                                  slot <= stars
                                    ? 'text-warning fill-current'
                                    : 'text-border'
                                }`}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold font-display text-text-primary">
                            {lesson.title}
                          </h3>
                          {rec?.completed && (
                            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                          )}
                        </div>

                        <p className="text-xs text-text-secondary leading-relaxed">
                          {lesson.summary}
                        </p>

                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {lesson.focusKeys.slice(0, 6).map((fk) => (
                            <kbd
                              key={fk}
                              className="px-2 py-0.5 bg-background border border-border rounded font-mono text-[11px] font-bold text-text-primary"
                            >
                              {fk}
                            </kbd>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 pt-4 border-t border-border">
                        <div className="flex items-center justify-between text-xs font-mono text-text-secondary">
                          <span>Target: {lesson.targetWpm} WPM</span>
                          <span>Gate: {lesson.minAccuracy}% Acc</span>
                        </div>

                        {rec && rec.attempts > 0 && (
                          <div className="text-xs font-mono text-text-primary font-semibold">
                            Best: {rec.bestWpm} WPM · {rec.bestAccuracy}%
                          </div>
                        )}

                        {unlocked ? (
                          <Link
                            href={`/learn/${lesson.slug}`}
                            className="w-full py-2.5 px-4 min-h-[44px] bg-accent text-accent-foreground rounded-xl text-xs font-black uppercase tracking-wider inline-flex items-center justify-center gap-2 hover:brightness-105 transition-all"
                          >
                            <span>{rec?.completed ? 'Practice Again' : 'Start Lesson'}</span>
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        ) : (
                          <div className="w-full py-2.5 px-4 min-h-[44px] bg-background border border-border rounded-xl text-xs font-bold uppercase tracking-wider text-text-secondary inline-flex items-center justify-center gap-2">
                            <Lock className="w-3.5 h-3.5" />
                            <span>Pass Lesson {lesson.order - 1} to Unlock</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}

