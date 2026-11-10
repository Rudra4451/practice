import type { Metadata } from 'next';
import React from 'react';
import { Navbar } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { ChallengeArenaClient } from '@/components/challenge/challenge-arena-client';
import { getActiveChallengeById } from '@/lib/data/challenge';
import { ShieldAlert } from 'lucide-react';

interface ChallengePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: ChallengePageProps): Promise<Metadata> {
  const { id } = await params;
  const challenge = await getActiveChallengeById(id);

  if (!challenge) {
    return {
      title: 'Challenge Unavailable',
      description: 'This 1v1 typing challenge link has expired or does not exist.',
    };
  }

  const creator =
    challenge.profiles?.display_name || challenge.profiles?.username || 'a TyProX typist';

  return {
    title: `1v1 Challenge vs ${creator}`,
    description: `Race ${creator}'s ${challenge.creator_wpm ?? 0} WPM benchmark in ${challenge.duration}s ${challenge.mode} mode on TyProX.`,
  };
}

export default async function ChallengePage({ params }: ChallengePageProps) {
  const { id } = await params;
  const challenge = await getActiveChallengeById(id);

  if (!challenge) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
          <ShieldAlert className="w-12 h-12 text-error" aria-hidden="true" />
          <h1 className="text-2xl font-bold font-display text-text-primary">
            Challenge Expired or Not Found
          </h1>
          <p className="text-text-secondary text-sm max-w-sm">
            This 1v1 challenge link is invalid or has expired after 7 days.
          </p>
          <Button href="/typing" variant="primary" className="mt-2">
            Start a Fresh Practice
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />
      <ChallengeArenaClient challenge={challenge} />
    </div>
  );
}
