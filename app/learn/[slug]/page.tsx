import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  CURRICULUM_LESSONS,
  getLessonBySlug,
  getNextLesson,
} from '@/constants/curriculum';
import { LessonRunnerClient } from '@/components/learn/lesson-runner-client';

interface LessonPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return CURRICULUM_LESSONS.map((lesson) => ({ slug: lesson.slug }));
}

export async function generateMetadata({ params }: LessonPageProps): Promise<Metadata> {
  const { slug } = await params;
  const lesson = getLessonBySlug(slug);
  if (!lesson) {
    return { title: 'Lesson Not Found' };
  }

  return {
    title: `${lesson.title} · Curriculum`,
    description: `${lesson.summary} Target speed ${lesson.targetWpm} WPM at ${lesson.minAccuracy}%+ accuracy.`,
    alternates: {
      canonical: `/learn/${lesson.slug}`,
    },
  };
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { slug } = await params;
  const lesson = getLessonBySlug(slug);

  if (!lesson) {
    notFound();
  }

  const nextLesson = getNextLesson(lesson.slug) ?? null;

  return <LessonRunnerClient lesson={lesson} nextLesson={nextLesson} />;
}

