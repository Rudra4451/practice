import type { Metadata } from 'next';
import { DailyChallengeClient } from '@/components/daily/daily-challenge-client';

export const metadata: Metadata = {
  title: 'Daily Challenge · Deterministic UTC Arena',
  description:
    'One shared deterministic typing challenge rotated every UTC midnight with server-verified telemetry scoring.',
  alternates: {
    canonical: '/daily',
  },
};

export default function DailyChallengePage() {
  return <DailyChallengeClient />;
}

