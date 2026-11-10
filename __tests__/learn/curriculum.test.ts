import { describe, expect, it } from 'vitest';
import {
  CURRICULUM_LESSONS,
  computeLessonStars,
  isLessonUnlocked,
  getLessonBySlug,
  getNextLesson,
} from '@/constants/curriculum';
import {
  formatUtcCountdown,
  getDailyChallengeConfig,
} from '@/lib/typing/daily-challenge';
import { RANKED_MODES } from '@/lib/typing/metrics';

describe('Structured Curriculum & Mastery Gates', () => {
  it('defines 12 unique ordered curriculum lessons', () => {
    expect(CURRICULUM_LESSONS).toHaveLength(12);
    const slugs = new Set(CURRICULUM_LESSONS.map((l) => l.slug));
    expect(slugs.size).toBe(12);

    CURRICULUM_LESSONS.forEach((lesson, idx) => {
      expect(lesson.order).toBe(idx + 1);
      expect(lesson.prompt.length).toBeGreaterThanOrEqual(40);
      expect(lesson.minAccuracy).toBeGreaterThanOrEqual(90);
    });
  });

  it('grants 0 stars below minAccuracy regardless of WPM and scales 1-3 stars cleanly', () => {
    const lesson = CURRICULUM_LESSONS[0]; // targetWpm 25, minAccuracy 92

    expect(computeLessonStars(95, 91.9, lesson)).toBe(0);
    expect(computeLessonStars(20, 92, lesson)).toBe(1);
    expect(computeLessonStars(26, 94, lesson)).toBe(2);
    expect(computeLessonStars(30, 97, lesson)).toBe(3);
  });

  it('gates sequential module unlocks behind completed prerequisite lessons', () => {
    const first = CURRICULUM_LESSONS[0];
    const second = CURRICULUM_LESSONS[1];

    expect(isLessonUnlocked(first, {})).toBe(true);
    expect(isLessonUnlocked(second, {})).toBe(false);

    // Failed attempt (below gate) leaves lesson 2 locked
    expect(
      isLessonUnlocked(second, {
        [first.slug]: {
          bestWpm: 40,
          bestAccuracy: 88,
          stars: 0,
          completed: false,
          attempts: 1,
        },
      })
    ).toBe(false);

    // Passed attempt unlocks lesson 2
    expect(
      isLessonUnlocked(second, {
        [first.slug]: {
          bestWpm: 26,
          bestAccuracy: 94,
          stars: 2,
          completed: true,
          attempts: 2,
        },
      })
    ).toBe(true);
  });

  it('resolves slugs and next lesson links accurately', () => {
    expect(getLessonBySlug('home-row-foundations')?.order).toBe(1);
    expect(getNextLesson('home-row-foundations')?.order).toBe(2);
    expect(getNextLesson(CURRICULUM_LESSONS[CURRICULUM_LESSONS.length - 1].slug)).toBeUndefined();
  });
});

describe('Daily UTC Challenge Determinism', () => {
  it('generates identical config for identical UTC dates and valid verifier fields', () => {
    const a = getDailyChallengeConfig(new Date('2026-11-10T02:15:00Z'));
    const b = getDailyChallengeConfig(new Date('2026-11-10T23:55:00Z'));

    expect(a).toEqual(b);
    expect(a.utcDate).toBe('2026-11-10');
    expect(a.seed).toBe('daily-2026-11-10');
    expect((RANKED_MODES as readonly string[]).includes(a.mode)).toBe(true);
    expect([30, 60]).toContain(a.duration);
  });

  it('formats countdown cleanly as HH:MM:SS', () => {
    expect(formatUtcCountdown(3661)).toBe('01:01:01');
    expect(formatUtcCountdown(0)).toBe('00:00:00');
  });
});

