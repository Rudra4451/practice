'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { Navbar } from '@/components/navbar';
import { Trophy, ShieldAlert, ArrowRight, User } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface LeaderboardEntry {
  id: string;
  wpm: number;
  accuracy: number;
  consistency: number;
  mode: string;
  duration: number;
  created_at: string;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

// Function to resolve WPM to Rank Tier (Premium Glassmorphism styling)
export function getRankTier(wpm: number) {
  if (wpm >= 140) return { name: 'Grandmaster', color: 'text-error bg-error/10 border border-error/20 font-bold' };
  if (wpm >= 120) return { name: 'Master', color: 'text-accent bg-accent/10 border border-accent/20 font-bold' };
  if (wpm >= 100) return { name: 'Diamond', color: 'text-accent-secondary bg-accent-secondary/10 border border-accent-secondary/20 font-bold' };
  if (wpm >= 80) return { name: 'Platinum', color: 'text-text-primary bg-surface border border-border font-bold' };
  if (wpm >= 60) return { name: 'Gold', color: 'text-warning bg-warning/10 border border-warning/20 font-bold' };
  if (wpm >= 40) return { name: 'Silver', color: 'text-text-secondary bg-surface-accent border border-border/40 font-bold' };
  return { name: 'Bronze', color: 'text-text-tertiary bg-surface-accent border border-border/20 font-bold' };
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'all_time'>('all_time');
  const [mode, setMode] = useState<string>('words');
  const [duration, setDuration] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const isDemo = typeof window !== 'undefined' && (localStorage.getItem('typrox_demo') === 'true' || window.location.search.includes('demo=true'));
      const res = await fetch(`/api/leaderboard?mode=${mode}&duration=${duration}&timeframe=${timeframe}${isDemo ? '&demo=true' : ''}`);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const json = await res.json();
      if (json.data) {
        setEntries(json.data as LeaderboardEntry[]);
        setFetchError(false);
      } else {
        setFetchError(true);
      }
    } catch (err) {
      console.error("Leaderboard fetch error:", err);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [mode, duration, timeframe]);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let supabaseInstance: SupabaseClient | null = null;

    Promise.resolve().then(() => fetchLeaderboard());

    // Subscribe to Postgres changes on test_results to refresh ranking automatically
    try {
      supabaseInstance = createClient();
      channel = supabaseInstance
        .channel(`leaderboard-${mode}-${duration}-${timeframe}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'test_results',
          },
          () => {
            fetchLeaderboard();
          }
        )
        .subscribe();
    } catch (err) {
      console.error("Failed to subscribe to realtime changes:", err);
    }

    return () => {
      if (supabaseInstance && channel) {
        try {
          supabaseInstance.removeChannel(channel);
        } catch (err) {
          console.error("Error removing realtime channel:", err);
        }
      }
    };
  }, [timeframe, mode, duration, fetchLeaderboard]);

  const timeframeOptions: Array<'daily' | 'weekly' | 'all_time'> = ['daily', 'weekly', 'all_time'];
  const modeOptions = ['words', 'quotes', 'numbers', 'punctuation', 'code'];
  const durationOptions = [15, 30, 60, 120];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 md:px-6 py-10 flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2 border-b border-border/60 pb-6 mb-2 relative">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-accent/5 blur-[120px] rounded-full pointer-events-none" />
          <div className="flex items-center gap-3 text-accent">
            <Trophy className="w-8 h-8 fill-current drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-text-primary flex items-center gap-3 font-sans">
              Global Leaderboard
            </h1>
          </div>
          <div className="text-xs font-bold uppercase tracking-wider text-text-secondary flex flex-wrap gap-x-3 gap-y-1 mt-2">
            <span>Every score is verified ·</span>
            <span>Every ranking is earned ·</span>
            <span className="text-accent">Compete to claim your spot</span>
          </div>
        </div>

        {/* Filter Controls Panel */}
        <div className="flex flex-col gap-4 p-5 bg-surface/30 backdrop-blur-md border border-border/60 rounded-2xl shadow-sm">
          {/* Timeframe */}
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
            <span className="w-24 text-xs font-black uppercase tracking-widest text-text-secondary shrink-0">Timeframe</span>
            <div className="overflow-x-auto scrollbar-none">
              <div className="inline-flex bg-surface-accent/30 p-1 rounded-xl">
                {timeframeOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setTimeframe(opt)}
                    className={`px-6 py-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer text-center whitespace-nowrap rounded-lg ${
                      timeframe === opt
                        ? 'bg-surface border border-border/60 text-text-primary shadow-sm'
                        : 'text-text-tertiary hover:text-text-primary'
                    }`}
                  >
                    {opt.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mode */}
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
            <span className="w-24 text-xs font-black uppercase tracking-widest text-text-secondary shrink-0">Mode</span>
            <div className="overflow-x-auto scrollbar-none">
              <div className="inline-flex bg-surface-accent/30 p-1 rounded-xl">
                {modeOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setMode(opt)}
                    className={`px-6 py-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer text-center whitespace-nowrap rounded-lg ${
                      mode === opt
                        ? 'bg-surface border border-border/60 text-text-primary shadow-sm'
                        : 'text-text-tertiary hover:text-text-primary'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Duration */}
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
            <span className="w-24 text-xs font-black uppercase tracking-widest text-text-secondary shrink-0">Duration</span>
            <div className="overflow-x-auto scrollbar-none">
              <div className="inline-flex bg-surface-accent/30 p-1 rounded-xl">
                {durationOptions.map((time) => (
                  <button
                    key={time}
                    onClick={() => setDuration(time)}
                    className={`px-6 py-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer text-center whitespace-nowrap rounded-lg ${
                      duration === time
                        ? 'bg-surface border border-border/60 text-text-primary shadow-sm'
                        : 'text-text-tertiary hover:text-text-primary'
                    }`}
                  >
                    {time}s
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Leaderboard Table Grid */}
        <div className="p-6 bg-surface/30 backdrop-blur-md border border-border/60 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-surface/50 to-transparent pointer-events-none" />
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 bg-accent animate-spin" />
            </div>
          ) : fetchError ? (
            <div className="flex flex-col gap-6 py-10 items-center justify-center text-center">
              <ShieldAlert className="w-12 h-12 text-error" />
              <div className="flex flex-col gap-2">
                <span className="text-lg font-black uppercase tracking-wider text-text-primary">Unable to Load Rankings</span>
                <span className="text-sm font-semibold text-text-secondary">Please check your connection and try again.</span>
              </div>
              <Button onClick={() => fetchLeaderboard()} variant="secondary" className="mt-4">
                Retry
              </Button>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col gap-8">
              {/* Alert Message */}
              <div className="flex items-center gap-3 p-4 border-2 border-dashed border-border bg-surface-accent">
                <ShieldAlert className="w-5 h-5 text-accent flex-shrink-0" />
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-text-primary uppercase tracking-wider">No Verified Runs Recorded Yet</span>
                  <span className="text-xs font-semibold text-text-secondary uppercase tracking-widest mt-0.5">
                    Be the first to submit a verified score in this category!
                  </span>
                </div>
              </div>

              {/* Two Column Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
                {/* Left Side: Demo Rankings */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b-2 border-border pb-2">
                    <span className="text-xs font-black uppercase tracking-widest text-text-primary">Demo Rankings</span>
                    <span className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 border border-border bg-surface text-text-secondary">Simulated</span>
                  </div>
                  <div className="overflow-x-auto border-2 border-border/60 bg-background opacity-60">
                    <table className="w-full text-left border-collapse text-xs font-bold uppercase tracking-wider">
                      <thead>
                        <tr className="border-b-2 border-border text-xs uppercase font-black text-text-primary tracking-widest">
                          <th className="py-2 px-2 w-10 text-center">Rank</th>
                          <th className="py-2 px-3">Typist</th>
                          <th className="py-2 px-3 text-right">Speed</th>
                          <th className="py-2 px-3 text-right">Acc</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { name: 'speed_demon', wpm: 148, acc: 99, rank: 1, color: 'bg-bauhaus-yellow text-bauhaus-black' },
                          { name: 'rhythm_master', wpm: 126, acc: 97, rank: 2, color: 'bg-accent text-white' },
                          { name: 'swift_fingers', wpm: 108, acc: 96, rank: 3, color: 'bg-bauhaus-red text-white' },
                        ].map((mock) => (
                          <tr key={mock.name} className="border-b border-border/20">
                            <td className="py-3 px-2 text-center">
                              <span className={`inline-flex items-center justify-center w-5 h-5 border border-border text-xs font-black ${mock.color}`}>
                                {mock.rank}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-text-secondary">{mock.name}</td>
                            <td className="py-3 px-3 text-right text-accent font-mono">{mock.wpm} WPM</td>
                            <td className="py-3 px-3 text-right text-text-secondary font-mono">{mock.acc}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right Side: Rank Tier System */}
                <div className="flex flex-col gap-4">
                  <div className="border-b-2 border-border pb-2">
                    <span className="text-xs font-black uppercase tracking-widest text-text-primary">Rank Tier System</span>
                  </div>
                  <div className="p-4 bg-background border-2 border-border flex flex-col gap-3">
                    <p className="text-xs font-bold text-text-secondary uppercase tracking-wider leading-relaxed">
                      Your rank tier is determined dynamically based on your net Words Per Minute (WPM) speed:
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        { name: 'Grandmaster', limit: '140+ WPM', color: 'bg-bauhaus-red text-white border border-border' },
                        { name: 'Master', limit: '120-139 WPM', color: 'bg-accent text-white border border-border' },
                        { name: 'Diamond', limit: '100-119 WPM', color: 'bg-bauhaus-yellow text-bauhaus-black border border-border' },
                        { name: 'Platinum', limit: '80-99 WPM', color: 'bg-surface-accent text-text-primary border border-border' },
                        { name: 'Gold', limit: '60-79 WPM', color: 'bg-bauhaus-yellow/60 text-bauhaus-black border border-border' },
                        { name: 'Silver', limit: '40-59 WPM', color: 'bg-surface-accent text-text-secondary border border-border/40' },
                      ].map((tier) => (
                        <div key={tier.name} className="flex items-center justify-between p-1.5 border border-border/20 bg-surface">
                          <span className={`px-2 py-0.5 text-xs font-black uppercase tracking-widest ${tier.color}`}>{tier.name}</span>
                          <span className="font-mono text-text-secondary font-bold text-xs">{tier.limit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="flex justify-center border-t-2 border-border/20 pt-6">
                <Button
                  href="/typing"
                  variant="primary"
                  className="flex items-center gap-3 px-8 py-4"
                >
                  <span>Start Typing to Qualify</span>
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-12 pt-8">
              {/* 3D Podiums */}
              {entries.length >= 3 && (
                <div className="flex items-end justify-center gap-2 md:gap-6 h-[250px] relative z-10 px-4">
                  {/* Silver - Rank 2 */}
                  <motion.div 
                    initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    className="flex flex-col items-center justify-end w-[30%] md:w-32 h-[160px] relative group"
                  >
                    <div className="absolute -top-12 flex flex-col items-center text-center">
                      <span className="text-text-secondary font-bold text-xs uppercase truncate w-24">{entries[1].profiles?.display_name || entries[1].profiles?.username || 'Guest'}</span>
                      <span className="text-accent font-black font-mono text-sm">{entries[1].wpm}</span>
                    </div>
                    <div className="w-full h-full bg-gradient-to-t from-surface to-surface-accent border border-border/80 border-b-0 rounded-t-lg shadow-[0_-5px_15px_rgba(255,255,255,0.05)] flex items-start justify-center pt-2 relative overflow-hidden">
                      <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.1),transparent)] -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
                      <span className="text-2xl font-black text-text-secondary opacity-50 font-mono">2</span>
                    </div>
                  </motion.div>

                  {/* Gold - Rank 1 */}
                  <motion.div 
                    initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="flex flex-col items-center justify-end w-[35%] md:w-40 h-[220px] relative group z-20"
                  >
                    <div className="absolute -top-16 flex flex-col items-center text-center">
                      <Trophy className="w-6 h-6 text-warning mb-1 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                      <span className="text-text-primary font-bold text-sm uppercase truncate w-28">{entries[0].profiles?.display_name || entries[0].profiles?.username || 'Guest'}</span>
                      <span className="text-warning font-black font-mono text-lg">{entries[0].wpm}</span>
                    </div>
                    <div className="w-full h-full bg-gradient-to-t from-warning/5 to-warning/20 border-2 border-warning/50 border-b-0 rounded-t-xl shadow-[0_-8px_25px_rgba(234,179,8,0.15)] flex items-start justify-center pt-4 relative overflow-hidden">
                      <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(234,179,8,0.2),transparent)] -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
                      <span className="text-4xl font-black text-warning font-mono drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]">1</span>
                    </div>
                  </motion.div>

                  {/* Bronze - Rank 3 */}
                  <motion.div 
                    initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                    className="flex flex-col items-center justify-end w-[30%] md:w-32 h-[120px] relative group"
                  >
                    <div className="absolute -top-12 flex flex-col items-center text-center">
                      <span className="text-text-tertiary font-bold text-xs uppercase truncate w-24">{entries[2].profiles?.display_name || entries[2].profiles?.username || 'Guest'}</span>
                      <span className="text-error font-black font-mono text-sm">{entries[2].wpm}</span>
                    </div>
                    <div className="w-full h-full bg-gradient-to-t from-surface to-surface-accent border border-border/60 border-b-0 rounded-t-lg shadow-[0_-5px_15px_rgba(0,0,0,0.2)] flex items-start justify-center pt-2 relative overflow-hidden">
                      <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.05),transparent)] -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
                      <span className="text-2xl font-black text-text-tertiary opacity-40 font-mono">3</span>
                    </div>
                  </motion.div>
                </div>
              )}

              <div className="overflow-x-auto relative z-20 bg-background/40 backdrop-blur-md rounded-xl border border-border/40">
                <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-3 border-border text-xs uppercase font-black text-text-primary tracking-widest pb-3">
                    <th className="py-3 px-2 w-12 text-center">Rank</th>
                    <th className="py-3 px-4">Typist</th>
                    <th className="py-3 px-4">Rank Tier</th>
                    <th className="py-3 px-4 text-right">Speed</th>
                    <th className="py-3 px-4 text-right">Accuracy</th>
                    <th className="py-3 px-4 text-right">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, idx) => {
                    const rank = idx + 1;
                    const username = entry.profiles?.username || 'anonymous';
                    const displayName = entry.profiles?.display_name || username;
                    const tier = getRankTier(entry.wpm);

                    return (
                      <tr
                        key={entry.id}
                        className="border-b border-border/20 text-xs md:text-sm font-bold uppercase tracking-wider text-text-primary hover:bg-surface-accent transition-colors"
                      >
                        <td className="py-4 px-2 text-center">
                          {rank === 1 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 bg-warning/10 border border-warning/40 text-warning text-xs font-black rounded-lg shadow-[0_0_10px_rgba(234,179,8,0.2)]">1</span>
                          ) : rank === 2 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 bg-surface border border-border/80 text-text-secondary text-xs font-black rounded-lg">2</span>
                          ) : rank === 3 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 bg-surface border border-border/60 text-text-tertiary text-xs font-black rounded-lg">3</span>
                          ) : (
                            <span className="text-text-secondary font-mono font-bold text-xs">{rank}</span>
                          )}
                        </td>
                        <td className="py-4 px-4 font-bold">
                          <Link
                            href={`/u/${username}`}
                            className="flex items-center gap-2 hover:text-accent transition-colors"
                          >
                            <div className="w-6 h-6 border border-border bg-accent/15 flex items-center justify-center text-xs text-accent overflow-hidden">
                              {entry.profiles?.avatar_url ? (
                                <Image
                                  src={entry.profiles.avatar_url}
                                  alt={`${displayName}'s avatar`}
                                  width={24}
                                  height={24}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <User className="w-3.5 h-3.5 text-text-primary" />
                              )}
                            </div>
                            <span>{displayName}</span>
                          </Link>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-3 py-1 text-xs uppercase tracking-widest ${tier.color}`}>
                            {tier.name}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right font-mono font-black text-accent">
                          {entry.wpm} WPM
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-text-secondary">
                          {entry.accuracy}%
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-text-secondary/80 text-xs">
                          {new Date(entry.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
