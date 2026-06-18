'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Navbar } from '@/components/navbar';
import { Award, Zap, Trophy, ShieldAlert, ArrowRight, User } from 'lucide-react';
import Link from 'next/link';

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

// Function to resolve WPM to Rank Tier (Bauhaus flat color blocks)
export function getRankTier(wpm: number) {
  if (wpm >= 140) return { name: 'Grandmaster', color: 'text-white bg-bauhaus-red border-2 border-border font-bold' };
  if (wpm >= 120) return { name: 'Master', color: 'text-white bg-accent border-2 border-border font-bold' };
  if (wpm >= 100) return { name: 'Diamond', color: 'text-bauhaus-black bg-bauhaus-yellow border-2 border-border font-bold' };
  if (wpm >= 80) return { name: 'Platinum', color: 'text-text-primary bg-surface-accent border-2 border-border font-bold' };
  if (wpm >= 60) return { name: 'Gold', color: 'text-bauhaus-black bg-bauhaus-yellow/60 border-2 border-border font-bold' };
  if (wpm >= 40) return { name: 'Silver', color: 'text-text-secondary bg-surface-accent border border-border/40 font-bold' };
  return { name: 'Bronze', color: 'text-text-secondary bg-surface-accent border border-border/20 font-bold' };
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'all_time'>('all_time');
  const [mode, setMode] = useState<string>('words');
  const [duration, setDuration] = useState<number>(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      try {
        const supabase = createClient();
        
        let query = supabase
          .from('test_results')
          .select('id, wpm, accuracy, consistency, mode, duration, created_at, profiles(username, display_name, avatar_url)')
          .eq('is_invalidated', false)
          .eq('mode', mode)
          .eq('duration', duration);

        // Apply timeframe filters
        if (timeframe === 'daily') {
          const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          query = query.gt('created_at', past24h);
        } else if (timeframe === 'weekly') {
          const past7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          query = query.gt('created_at', past7d);
        }

        const { data, error } = await query
          .order('wpm', { ascending: false })
          .limit(50);

        if (!error && data) {
          setEntries(data as unknown as LeaderboardEntry[]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboard();
  }, [timeframe, mode, duration]);

  const timeframeOptions: Array<'daily' | 'weekly' | 'all_time'> = ['daily', 'weekly', 'all_time'];
  const modeOptions = ['words', 'quotes', 'numbers', 'punctuation', 'code'];
  const durationOptions = [15, 30, 60, 120];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 md:px-6 py-10 flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2 border-b-3 border-border pb-4 mb-2 select-none">
          <div className="flex items-center gap-2 text-accent">
            <Trophy className="w-6 h-6 fill-current" />
            <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-text-primary">See Where You Stand.</h1>
          </div>
          <div className="text-xs font-bold uppercase tracking-wider text-text-secondary flex flex-wrap gap-x-3 gap-y-1">
            <span>Every score is verified ·</span>
            <span>Every ranking is earned ·</span>
            <span className="text-text-primary">Complete a test and claim your spot</span>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 bg-surface border-3 border-border select-none overflow-hidden">
          {/* Timeframe */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none whitespace-nowrap pb-1 md:pb-0">
            {timeframeOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => setTimeframe(opt)}
                className={`px-4 py-2 border-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  timeframe === opt
                    ? 'bg-accent text-background border-border'
                    : 'text-text-secondary border-transparent hover:border-border hover:text-text-primary'
                }`}
              >
                {opt.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Mode */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none whitespace-nowrap pb-1 md:pb-0">
            {modeOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => setMode(opt)}
                className={`px-4 py-2 border-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  mode === opt
                    ? 'bg-accent text-background border-border'
                    : 'text-text-secondary border-transparent hover:border-border hover:text-text-primary'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>

          {/* Duration */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none whitespace-nowrap pb-1 md:pb-0">
            {durationOptions.map((time) => (
              <button
                key={time}
                onClick={() => setDuration(time)}
                className={`px-4 py-2 border-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  duration === time
                    ? 'bg-accent text-background border-border'
                    : 'text-text-secondary border-transparent hover:border-border hover:text-text-primary'
                }`}
              >
                {time}s
              </button>
            ))}
          </div>
        </div>

        {/* Leaderboard Table Grid */}
        <div className="p-6 bg-surface border-3 border-border">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 bg-accent animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col gap-8">
              {/* Alert Message */}
              <div className="flex items-center gap-3 p-4 border-2 border-dashed border-border bg-surface-accent select-none">
                <ShieldAlert className="w-5 h-5 text-accent flex-shrink-0" />
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-text-primary uppercase tracking-wider">No Verified Runs Recorded Yet</span>
                  <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-widest mt-0.5">
                    Be the first to submit a verified score in this category!
                  </span>
                </div>
              </div>

              {/* Two Column Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
                {/* Left Side: Demo Rankings */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b-2 border-border pb-2 select-none">
                    <span className="text-[10px] font-black uppercase tracking-widest text-text-primary">Demo Rankings</span>
                    <span className="text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 border border-border bg-surface text-text-secondary">Simulated</span>
                  </div>
                  <div className="overflow-x-auto border-2 border-border/60 bg-background opacity-60">
                    <table className="w-full text-left border-collapse text-xs font-bold uppercase tracking-wider">
                      <thead>
                        <tr className="border-b-2 border-border text-[9px] uppercase font-black text-text-primary tracking-widest">
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
                              <span className={`inline-flex items-center justify-center w-5 h-5 border border-border text-[9px] font-black ${mock.color}`}>
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
                  <div className="border-b-2 border-border pb-2 select-none">
                    <span className="text-[10px] font-black uppercase tracking-widest text-text-primary">Rank Tier System</span>
                  </div>
                  <div className="p-4 bg-background border-2 border-border flex flex-col gap-3 select-none">
                    <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider leading-relaxed">
                      Your rank tier is determined dynamically based on your net Words Per Minute (WPM) speed:
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      {[
                        { name: 'Grandmaster', limit: '140+ WPM', color: 'bg-bauhaus-red text-white border border-border' },
                        { name: 'Master', limit: '120-139 WPM', color: 'bg-accent text-white border border-border' },
                        { name: 'Diamond', limit: '100-119 WPM', color: 'bg-bauhaus-yellow text-bauhaus-black border border-border' },
                        { name: 'Platinum', limit: '80-99 WPM', color: 'bg-surface-accent text-text-primary border border-border' },
                        { name: 'Gold', limit: '60-79 WPM', color: 'bg-bauhaus-yellow/60 text-bauhaus-black border border-border' },
                        { name: 'Silver', limit: '40-59 WPM', color: 'bg-surface-accent text-text-secondary border border-border/40' },
                      ].map((tier) => (
                        <div key={tier.name} className="flex items-center justify-between p-1.5 border border-border/20 bg-surface">
                          <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${tier.color}`}>{tier.name}</span>
                          <span className="font-mono text-text-secondary font-bold text-[9px]">{tier.limit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="flex justify-center border-t-2 border-border/20 pt-6 select-none">
                <Link
                  href="/typing"
                  className="flex items-center gap-3 px-8 py-4 bg-accent text-white font-bold uppercase tracking-wider border-3 border-border hover:bg-error transition-all"
                >
                  <span>Start Typing to Qualify</span>
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-3 border-border text-[10px] uppercase font-black text-text-primary tracking-widest pb-3">
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
                            <span className="inline-flex items-center justify-center w-6 h-6 bg-bauhaus-yellow border-2 border-border text-bauhaus-black text-[9px] font-black">1</span>
                          ) : rank === 2 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 bg-accent border-2 border-border text-white text-[9px] font-black">2</span>
                          ) : rank === 3 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 bg-bauhaus-red border-2 border-border text-white text-[9px] font-black">3</span>
                          ) : (
                            <span className="text-text-secondary font-mono font-bold text-xs">{rank}</span>
                          )}
                        </td>
                        <td className="py-4 px-4 font-bold">
                          <Link
                            href={`/u/${username}`}
                            className="flex items-center gap-2 hover:text-accent transition-colors"
                          >
                            <div className="w-6 h-6 border border-border bg-accent/15 flex items-center justify-center text-[10px] text-accent">
                              {entry.profiles?.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={entry.profiles.avatar_url}
                                  alt={username}
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
                          <span className={`px-3 py-1 text-[9px] uppercase tracking-widest ${tier.color}`}>
                            {tier.name}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right font-mono font-black text-accent">
                          {entry.wpm} WPM
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-text-secondary">
                          {entry.accuracy}%
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-text-secondary/50 text-[10px]">
                          {new Date(entry.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
