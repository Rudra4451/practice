import type { Metadata } from 'next';
import { HomeLanding } from '@/components/home/home-landing';

export const metadata: Metadata = {
  title: 'TyProX | Every Keystroke Makes You Better',
  description:
    'Deliberate typing mastery platform featuring progressive curriculum lessons, server-verified leaderboards, daily UTC challenges, and keystroke telemetry analytics.',
  alternates: {
    canonical: '/',
  },
};

export default function HomePage() {
  return <HomeLanding />;
}
