import type { Metadata } from 'next';
import { LearnHubClient } from '@/components/learn/learn-hub-client';

export const metadata: Metadata = {
  title: 'Curriculum · Guided Touch-Typing Lessons',
  description:
    'Progressive typing modules spanning Home Row, Top Row, Shifts, Numbers, Punctuation, and TypeScript Developer syntax with 92% accuracy gates.',
  alternates: {
    canonical: '/learn',
  },
};

export default function LearnPage() {
  return <LearnHubClient />;
}

