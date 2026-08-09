'use client';

import React, { useEffect, useState, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTypingStore } from '@/stores/typing-store';
import { Navbar } from '@/components/navbar';
import { TypingContainer } from '@/components/typing/typing-container';
import { Trophy, ArrowRight, Play, ShieldAlert, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChallengeLinkDetails {
  id: string;
  creator_id: string | null;
  creator_wpm: number | null;
  creator_accuracy: number | null;
  mode: 'words' | 'quotes' | 'numbers' | 'punctuation' | 'code';
  duration: number;
  seed: string;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

export default function ChallengePage({ params }: { params: Promise<{ id: string }> }) {
  // Unpack Next 15 parameters
  const { id } = use(params);
  
  const { status, setMode, setDuration, setSeed, startTest, result } = useTypingStore();

  const [challenge, setChallenge] = useState<ChallengeLinkDetails | null>(null);
  const [gameState, setGameState] = useState<'lobby' | 'typing' | 'comparison'>('lobby');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function fetchChallenge() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('challenge_links')
          .select('*, profiles(username, display_name, avatar_url)')
          .eq('id', id)
          .single();

        if (error || !data) {
          setNotFound(true);
          return;
        }

        setChallenge(data as unknown as ChallengeLinkDetails);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchChallenge();
  }, [id]);

  // Transition to comparison when typing completed
  useEffect(() => {
    if (gameState === 'typing' && status === 'completed' && result) {
      Promise.resolve().then(() => setGameState('comparison'));
    }
  }, [status, gameState, result]);

  const handleStartChallenge = () => {
    if (!challenge) return;
    
    // Seed typing store with challenge parameters
    setMode(challenge.mode);
    setDuration(challenge.duration);
    setSeed(challenge.seed);
    
    // Start game
    startTest();
    setGameState('typing');
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-3 border-accent border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (notFound || !challenge) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
          <ShieldAlert className="w-12 h-12 text-error" />
          <h1 className="text-2xl font-bold text-text-primary">Challenge Expired or Not Found</h1>
          <p className="text-text-secondary text-sm">This 1v1 link is invalid or has expired.</p>
          <Button href="/" variant="primary" className="mt-2">
            Return Home
          </Button>
        </main>
      </div>
    );
  }

  const creatorName = challenge.profiles?.display_name || challenge.profiles?.username || 'Guest';

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-center py-10 px-4">
        {gameState === 'lobby' && (
          <div className="w-full max-w-md p-8 bg-surface border-3 border-border flex flex-col gap-6 shadow-xl text-center">
            <div className="w-12 h-12 bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mx-auto animate-bounce">
              <Trophy className="w-6 h-6 fill-current" />
            </div>

            <div className="flex flex-col gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-text-primary">1v1 Challenge Received</h1>
              <p className="text-xs text-text-secondary">
                You have been challenged to a typing race by <span className="font-semibold text-text-primary">u/{creatorName}</span>
              </p>
            </div>

            {/* Challenger Card */}
            <div className="p-4 bg-background/50 border-3 border-border flex items-center justify-around gap-4 text-xs font-mono">
              <div className="flex flex-col">
                <span className="text-text-secondary font-sans">Creator Speed</span>
                <span className="text-xl font-bold text-accent mt-1">{challenge.creator_wpm || 0} WPM</span>
              </div>
              <div className="w-[1px] h-8 bg-border" />
              <div className="flex flex-col">
                <span className="text-text-secondary font-sans">Accuracy</span>
                <span className="text-xl font-bold text-text-primary mt-1">{challenge.creator_accuracy || 0}%</span>
              </div>
              <div className="w-[1px] h-8 bg-border" />
              <div className="flex flex-col">
                <span className="text-text-secondary font-sans">Duration</span>
                <span className="text-xl font-bold text-text-primary mt-1">{challenge.duration}s</span>
              </div>
            </div>

            <Button
              onClick={handleStartChallenge}
              variant="primary"
              className="w-full"
            >
              <span>Accept Challenge</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {gameState === 'typing' && (
          <div className="w-full flex flex-col gap-4">
            <div className="text-center text-xs font-bold text-accent uppercase tracking-wider animate-pulse">
              🏆 Racing u/{creatorName} ({challenge.creator_wpm} WPM target)
            </div>
            <TypingContainer />
          </div>
        )}

        {gameState === 'comparison' && result && (
          <div className="w-full max-w-xl p-8 bg-surface border-3 border-border flex flex-col gap-8 shadow-xl">
            {/* Winner Badge Card */}
            {(() => {
              const won = result.wpm > (challenge.creator_wpm || 0);
              const tie = result.wpm === (challenge.creator_wpm || 0);
              
              return (
                <div className={`p-6 border-3 border-border flex flex-col items-center gap-2 text-center shadow-xs ${
                  won 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                    : tie 
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                }`}>
                  <Sparkles className={`w-8 h-8 ${won ? 'animate-spin' : ''}`} />
                  <span className="text-xl font-extrabold tracking-tight">
                    {won ? 'You Won!' : tie ? 'It\'s a Tie!' : `${creatorName} Won`}
                  </span>
                  <span className="text-xs opacity-90">
                    {won 
                      ? `You beat u/${creatorName}'s score by ${(result.wpm - (challenge.creator_wpm || 0))} WPM!` 
                      : tie 
                        ? 'Identical speeds achieved!' 
                        : `You were short by ${((challenge.creator_wpm || 0) - result.wpm)} WPM. Try again!`}
                  </span>
                </div>
              );
            })()}

            {/* Double Column comparisons */}
            <div className="grid grid-cols-2 gap-6">
              {/* Creator Card */}
              <div className="p-4 bg-background/40 border-3 border-border flex flex-col gap-2">
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">u/{creatorName}</span>
                <div className="flex flex-col">
                  <span className="text-2xl font-bold font-mono text-text-primary">{challenge.creator_wpm} WPM</span>
                  <span className="text-xs text-text-secondary mt-0.5">{challenge.creator_accuracy}% Accuracy</span>
                </div>
              </div>

              {/* Player Card */}
              <div className="p-4 bg-background/40 border-3 border-border flex flex-col gap-2">
                <span className="text-xs font-bold text-accent uppercase tracking-wider">You (Player)</span>
                <div className="flex flex-col">
                  <span className="text-2xl font-bold font-mono text-accent">{result.wpm} WPM</span>
                  <span className="text-xs text-text-secondary mt-0.5">{result.accuracy}% Accuracy</span>
                </div>
              </div>
            </div>

            {/* Diffs lists */}
            <div className="flex flex-col gap-2 text-xs md:text-sm border-t border-border/10 pt-4">
              <div className="flex justify-between items-center py-1">
                <span className="text-text-secondary">WPM Speed Difference</span>
                <span className={`font-semibold font-mono ${
                  result.wpm >= (challenge.creator_wpm || 0) ? 'text-emerald-500' : 'text-rose-500'
                }`}>
                  {result.wpm >= (challenge.creator_wpm || 0) ? '+' : ''}
                  {result.wpm - (challenge.creator_wpm || 0)} WPM
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-text-secondary">Accuracy Difference</span>
                <span className={`font-semibold font-mono ${
                  result.accuracy >= (challenge.creator_accuracy || 0) ? 'text-emerald-500' : 'text-rose-500'
                }`}>
                  {result.accuracy >= (challenge.creator_accuracy || 0) ? '+' : ''}
                  {(result.accuracy - (challenge.creator_accuracy || 0)).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex gap-4 border-t border-border/10 pt-6">
              <Button
                onClick={handleStartChallenge}
                variant="primary"
                className="flex-1"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Retry Challenge</span>
              </Button>
              <Button
                href="/typing"
                variant="secondary"
                className="flex-1"
              >
                <span>Practice Sandbox</span>
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
