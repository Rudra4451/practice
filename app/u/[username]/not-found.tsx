import React from 'react';
import { Navbar } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { UserX } from 'lucide-react';

export default function ProfileNotFound() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-text-primary">
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-surface-accent border border-border flex items-center justify-center text-text-secondary">
          <UserX className="w-6 h-6" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold font-display text-text-primary">
          Profile Not Found
        </h1>
        <p className="text-text-secondary text-sm max-w-sm">
          No typist exists with that username. Check the spelling or explore the global leaderboards.
        </p>
        <div className="flex gap-3 mt-2">
          <Button href="/leaderboard" variant="primary">
            Leaderboards
          </Button>
          <Button href="/" variant="secondary">
            Return Home
          </Button>
        </div>
      </main>
    </div>
  );
}

