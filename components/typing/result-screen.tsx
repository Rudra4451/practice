'use client';

import React, { useState, useEffect } from 'react';
import { useTypingStore } from '@/stores/typing-store';
import { useUserStore } from '@/stores/user-store';
import { ReplayPlayer } from './replay-player';
import { createClient } from '@/lib/supabase/client';
import { RefreshCw, Play, Share2, Award, AlertCircle, TrendingUp } from 'lucide-react';
import dynamic from 'next/dynamic';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';

const ResultChart = dynamic(() => import('./result-chart'), {
  ssr: false,
  loading: () => <div className="h-[200px] flex items-center justify-center text-text-secondary uppercase tracking-widest text-xs font-bold font-mono">Loading Chart...</div>
});

export const ResultScreen: React.FC = () => {
  const { targetText, userInput, result, resetTest, seed, mode, duration } = useTypingStore();
  const { addGuestResult } = useUserStore();
  const [showReplay, setShowReplay] = useState(false);
  const [copied, setCopied] = useState(false);

  const { session } = useUserStore();
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Save guest run locally or upload to API if authenticated
  React.useEffect(() => {
    if (!result) return;

    if (session?.user) {
      setSaving(true);
      fetch('/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wpm: result.wpm,
          rawWpm: result.rawWpm,
          accuracy: result.accuracy,
          consistency: result.consistency,
          errorCount: result.errorCount,
          backspaceCount: result.backspaceCount,
          mode,
          duration,
          seed,
          telemetry: result.telemetry,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.unlocked && data.unlocked.length > 0) {
            setUnlocked(data.unlocked);
          }
        })
        .catch((err) => logger.error('Error submitting test score', { category: 'api', error: err }))
        .finally(() => setSaving(false));
    } else {
      // Save locally to Guest log buffers
      addGuestResult({
        id: Math.random().toString(36).substring(7),
        wpm: result.wpm,
        raw_wpm: result.rawWpm,
        accuracy: result.accuracy,
        consistency: result.consistency,
        error_count: result.errorCount,
        backspace_count: result.backspaceCount,
        mode,
        duration,
        seed,
        created_at: new Date().toISOString(),
      });
    }
  }, [result, session, addGuestResult, seed, mode, duration]);

  if (!result) return null;

  const handleShare = async () => {
    // Create a proper challenge_links row in DB if user is authenticated,
    // otherwise share a seed-based typing URL as a fallback
    if (session?.user) {
      try {
        const supabase = createClient();
        const { data: link, error } = await supabase
          .from('challenge_links')
          .insert({
            creator_id: session.user.id,
            creator_wpm: result.wpm,
            creator_accuracy: result.accuracy,
            mode,
            duration,
            seed,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .select('id')
          .single();

        if (!error && link) {
          const challengeUrl = `${window.location.origin}/challenge/${link.id}`;
          navigator.clipboard.writeText(challengeUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
          return;
        }
      } catch (err) {
        logger.error('Failed to create challenge link', { category: 'supabase', error: err });
      }
    }

    // Fallback: seed-based typing URL (works for guests)
    const challengeUrl = `${window.location.origin}/typing?seed=${seed}&mode=${mode}&duration=${duration}`;
    navigator.clipboard.writeText(challengeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Extract most missed keys to show to user
  const missedKeys = Object.entries(result.errorKeys)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-8 px-4 py-6 animate-fade-in">
      {/* Saving indicator */}
      {saving && (
        <div className="flex items-center gap-2 px-4 py-2 border-2 border-border bg-surface-accent text-xs font-bold uppercase tracking-wider text-text-secondary">
          <div className="w-3 h-3 bg-accent animate-spin flex-shrink-0" />
          <span>Saving your result…</span>
        </div>
      )}
      {/* Show Replay Player Overlay */}
      {showReplay ? (
        <ReplayPlayer
          targetText={targetText}
          telemetry={result.telemetry}
          onClose={() => setShowReplay(false)}
        />
      ) : (
        <>
          {/* Achievement Banner */}
          {unlocked.length > 0 && (
            <div className="p-4 bg-bauhaus-yellow/10 border-3 border-bauhaus-yellow text-bauhaus-black dark:text-bauhaus-yellow flex items-center gap-3">
              <Award className="w-5 h-5 flex-shrink-0" />
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase tracking-wider">Achievement Unlocked</span>
                <span className="text-xs font-semibold mt-0.5 opacity-80">{unlocked.join(', ')}</span>
              </div>
            </div>
          )}

          {/* Main Stat Numbers Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-6 bg-accent border-3 border-border flex flex-col text-background">
              <span className="text-xs font-bold uppercase tracking-wider opacity-85">Speed</span>
              <span className="text-4xl md:text-5xl font-black font-mono mt-2 leading-none">{result.wpm}</span>
              <span className="text-xs uppercase font-bold mt-1 opacity-80">WPM (net speed)</span>
            </div>

            <div className="p-6 bg-bauhaus-red border-3 border-border flex flex-col text-white">
              <span className="text-xs font-bold uppercase tracking-wider opacity-85">Accuracy</span>
              <span className="text-4xl md:text-5xl font-black font-mono mt-2 leading-none">{result.accuracy}%</span>
              <span className="text-xs uppercase font-bold mt-1 opacity-80">based on correct keys</span>
            </div>

            <div className="p-6 bg-surface-accent border-3 border-border flex flex-col text-text-primary">
              <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Consistency</span>
              <span className="text-4xl md:text-5xl font-black font-mono mt-2 leading-none">{result.consistency}%</span>
              <span className="text-xs uppercase font-bold mt-1 text-text-secondary">keystroke deviation</span>
            </div>

            <div className="p-6 bg-surface-accent border-3 border-border flex flex-col text-text-primary">
              <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Time</span>
              <span className="text-4xl md:text-5xl font-black font-mono mt-2 leading-none">{result.duration}s</span>
              <span className="text-xs uppercase font-bold mt-1 text-text-secondary">total test duration</span>
            </div>
          </div>

          {/* Secondary stats & Recharts Graph Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
            {/* Graph Card */}
            <div className="lg:col-span-2 p-6 bg-surface border-3 border-border flex flex-col min-h-[300px]">
              <div className="flex items-center gap-2 border-b-2 border-border pb-4 mb-4">
                <TrendingUp className="w-4 h-4 text-accent" />
                <span className="text-sm font-bold uppercase tracking-wider text-text-primary">WPM Speed Evolution</span>
              </div>
              <div className="flex-1 w-full h-[200px]">
                <ResultChart timeline={result.timeline} />
              </div>
            </div>

            {/* Performance Stats Panel */}
            <div className="p-6 bg-surface border-3 border-border flex flex-col justify-between gap-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b-2 border-border pb-4">
                  <Award className="w-4 h-4 text-accent" />
                  <span className="text-sm font-bold uppercase tracking-wider text-text-primary">Performance Summary</span>
                </div>
                
                <div className="flex flex-col gap-3 text-xs md:text-sm font-bold uppercase tracking-wider">
                  <div className="flex justify-between items-center py-1 border-b border-border/10">
                    <span className="text-text-secondary">Raw speed</span>
                    <span className="text-text-primary font-mono">{result.rawWpm} WPM</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/10">
                    <span className="text-text-secondary">Errors (uncorrected)</span>
                    <span className="text-text-primary font-mono">{result.errorCount > 0 ? `${result.errorCount}` : '—'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/10">
                    <span className="text-text-secondary">Characters typed</span>
                    <span className="text-text-primary font-mono">{userInput.length}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/10">
                    <span className="text-text-secondary">Mistakes registered</span>
                    <span className="text-error font-mono flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {result.errorCount}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-text-secondary">Backspaces pressed</span>
                    <span className="text-text-primary font-mono">{result.backspaceCount}</span>
                  </div>
                </div>
              </div>

              {/* Missed Keys Heatmap Info */}
              {missedKeys.length > 0 && (
                <div className="flex flex-col gap-2 p-3 bg-surface-accent border-3 border-border">
                  <span className="text-xs font-bold text-text-secondary uppercase tracking-widest">Top Weak Keys</span>
                  <div className="flex gap-2 mt-1">
                    {missedKeys.map(([key, count]) => (
                      <div key={key} className="flex-1 flex flex-col items-center p-2 bg-background border-3 border-border">
                        <kbd className="font-mono text-xs font-bold text-text-primary">{key === ' ' ? 'Space' : key}</kbd>
                        <span className="text-xs font-bold text-error mt-0.5">{count}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t-2 border-border/10 pt-6 font-sans">
            <Button
              onClick={resetTest}
              variant="primary"
              className="flex-1 min-w-[140px] py-4"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Next Test</span>
            </Button>

            <Button
              onClick={() => setShowReplay(true)}
              variant="secondary"
              className="flex-1 min-w-[140px] py-4"
            >
              <Play className="w-4 h-4" />
              <span>Watch Replay</span>
            </Button>

            <Button
              onClick={handleShare}
              variant="secondary"
              className="flex-1 min-w-[140px] py-4"
            >
              <Share2 className="w-4 h-4" />
              <span>{copied ? 'Copied Link!' : 'Share Challenge'}</span>
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
