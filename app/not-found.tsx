import React from 'react';
import { Navbar } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-text-primary">
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center gap-6">
        <div className="w-12 h-12 rounded-2xl bg-surface-accent border border-border flex items-center justify-center text-accent-ink">
          <Compass className="w-6 h-6" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-2 max-w-md">
          <span className="text-xs font-mono uppercase tracking-widest text-text-secondary">
            404 Not Found
          </span>
          <h1 className="text-3xl font-bold font-display tracking-tight text-text-primary">
            Route Does Not Exist
          </h1>
          <p className="text-sm text-text-secondary leading-relaxed">
            This page or profile could not be located. Jump back into practice or browse the curriculum.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button href="/typing" variant="primary">
            Start Typing
          </Button>
          <Button href="/" variant="secondary">
            Return Home
          </Button>
        </div>
      </main>
    </div>
  );
}

