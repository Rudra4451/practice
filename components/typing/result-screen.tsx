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
import { AnimatedCounter } from '@/components/ui/animated-counter';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';

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
    // Fire confetti on successful result
    if (result.wpm > 0) {
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#FF5C00', '#E2E8F0', '#F5F5F5']
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#FF5C00', '#E2E8F0', '#F5F5F5']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
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
        <div className="flex items-center gap-2 px-4 py-2.5 border border-border bg-surface rounded-lg text-xs font-bold uppercase tracking-wider text-text-secondary shadow-xs">
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
            <div className="p-4 bg-accent-secondary/5 border border-accent-secondary/35 text-accent-secondary flex items-center gap-3 rounded-xl shadow-xs">
              <Award className="w-5 h-5 flex-shrink-0" />
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase tracking-wider">Achievement Unlocked</span>
                <span className="text-xs font-semibold mt-0.5 opacity-80">{unlocked.join(', ')}</span>
              </div>
            </div>
          )}

          {/* Main Stat Numbers Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-6 bg-surface/30 backdrop-blur-md border border-border/80 text-text-primary rounded-2xl shadow-sm flex flex-col relative overflow-hidden">
              {/* Personal Best Tag */}
              {result.wpm > 80 && (
                <div className="absolute top-3 right-3 px-2 py-0.5 bg-accent/10 border border-accent/20 rounded text-[9px] font-bold uppercase tracking-widest text-text-primary">
                  Personal Best
                </div>
              )}
              <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Speed</span>
              <span className="text-4xl md:text-5xl font-black font-mono mt-2 leading-none text-accent">
                <AnimatedCounter value={result.wpm} duration={1500} />
              </span>
              <span className="text-[10px] uppercase font-bold mt-1 text-text-tertiary">WPM (net speed)</span>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="p-6 bg-surface/30 backdrop-blur-md border border-border/80 text-text-primary rounded-2xl shadow-sm flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Accuracy</span>
              <span className="text-4xl md:text-5xl font-black font-mono mt-2 leading-none text-accent-secondary">
                <AnimatedCounter value={result.accuracy} duration={1500} suffix="%" />
              </span>
              <span className="text-[10px] uppercase font-bold mt-1 text-text-tertiary">based on correct keys</span>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="p-6 bg-surface/30 backdrop-blur-md border border-border/80 flex flex-col text-text-primary rounded-2xl shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Consistency</span>
              <span className="text-4xl md:text-5xl font-black font-mono mt-2 leading-none">
                <AnimatedCounter value={result.consistency} duration={1500} suffix="%" />
              </span>
              <span className="text-[10px] uppercase font-bold mt-1 text-text-tertiary">keystroke deviation</span>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="p-6 bg-surface/30 backdrop-blur-md border border-border/80 flex flex-col text-text-primary rounded-2xl shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Time</span>
              <span className="text-4xl md:text-5xl font-black font-mono mt-2 leading-none">
                <AnimatedCounter value={result.duration} duration={1000} suffix="s" />
              </span>
              <span className="text-[10px] uppercase font-bold mt-1 text-text-tertiary">total test duration</span>
            </motion.div>
          </div>

          {/* Secondary stats & Recharts Graph Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
            {/* Graph Card */}
            <div className="lg:col-span-2 p-6 bg-surface border border-border flex flex-col min-h-[300px] rounded-xl shadow-sm">
              <div className="flex items-center gap-2 border-b border-border/80 pb-4 mb-4">
                <TrendingUp className="w-4 h-4 text-accent" />
                <span className="text-sm font-bold uppercase tracking-wider text-text-primary">WPM Speed Evolution</span>
              </div>
              <div className="flex-1 w-full h-[200px]">
                <ResultChart timeline={result.timeline} />
              </div>
            </div>

            {/* Performance Stats Panel */}
            <div className="p-6 bg-surface border border-border flex flex-col justify-between gap-6 rounded-xl shadow-sm">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b border-border/80 pb-4">
                  <Award className="w-4 h-4 text-accent" />
                  <span className="text-sm font-bold uppercase tracking-wider text-text-primary">Performance Summary</span>
                </div>
                
                <div className="flex flex-col gap-1.5 text-xs md:text-sm font-bold uppercase tracking-wider">
                  <div className="flex justify-between items-center py-2 border-b border-border/60">
                    <span className="text-text-secondary">Raw speed</span>
                    <span className="text-text-primary font-mono">{result.rawWpm} WPM</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/60">
                    <span className="text-text-secondary">Errors (uncorrected)</span>
                    <span className="text-text-primary font-mono">{result.errorCount > 0 ? `${result.errorCount}` : '—'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/60">
                    <span className="text-text-secondary">Characters typed</span>
                    <span className="text-text-primary font-mono">{userInput.length}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/60">
                    <span className="text-text-secondary">Mistakes registered</span>
                    <span className="text-error font-mono flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {result.errorCount}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-text-secondary">Backspaces pressed</span>
                    <span className="text-text-primary font-mono">{result.backspaceCount}</span>
                  </div>
                </div>
              </div>

              {/* Missed Keys Heatmap Info */}
              {missedKeys.length > 0 && (
                <div className="flex flex-col gap-2.5 p-4 bg-surface-accent/40 border border-border rounded-xl">
                  <span className="text-xs font-bold text-text-secondary uppercase tracking-widest">Top Weak Keys</span>
                  <div className="flex gap-2.5 mt-1.5">
                    {missedKeys.map(([key, count]) => (
                      <div key={key} className="flex-1 flex flex-col items-center p-2 bg-surface border border-border rounded-lg shadow-sm font-mono">
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
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-6 font-sans">
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
              className="flex-1 min-w-[140px] py-4 border border-border"
            >
              <Play className="w-4 h-4" />
              <span>Watch Replay</span>
            </Button>

            <Button
              onClick={handleShare}
              variant="secondary"
              className="flex-1 min-w-[140px] py-4 border border-border"
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
