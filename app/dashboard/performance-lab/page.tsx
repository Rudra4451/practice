'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useUserStore } from '@/stores/user-store';
import { Navbar } from '@/components/navbar';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { Lock, Zap, Keyboard, Sparkles, BarChart2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Keyboard Layout Mapping for Heatmap render
const KEYBOARD_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'],
];

// Finger Mapping
const FINGER_MAP: Record<string, string> = {
  q: 'Left Pinky', a: 'Left Pinky', z: 'Left Pinky',
  w: 'Left Ring', s: 'Left Ring', x: 'Left Ring',
  e: 'Left Middle', d: 'Left Middle', c: 'Left Middle',
  r: 'Left Index', f: 'Left Index', v: 'Left Index',
  t: 'Left Index', g: 'Left Index', b: 'Left Index',
  ' ': 'Space (Thumb)',
  y: 'Right Index', h: 'Right Index', n: 'Right Index',
  u: 'Right Index', j: 'Right Index', m: 'Right Index',
  i: 'Right Middle', k: 'Right Middle', ',': 'Right Middle',
  o: 'Right Ring', l: 'Right Ring', '.': 'Right Ring',
  p: 'Right Pinky', ';': 'Right Pinky', '/': 'Right Pinky',
};

export default function PerformanceLabPage() {
  const { session } = useUserStore();
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);

  // Performance Telemetry Aggregates
  const [heatmap, setHeatmap] = useState<Record<string, number>>({});
  const [handDistribution, setHandDistribution] = useState({ left: 50, right: 50 });
  const [slowBigrams, setSlowBigrams] = useState<Array<{ bigram: string; speed: number }>>([]);
  const [weakKeys, setWeakKeys] = useState<Array<{ key: string; count: number }>>([]);

  // Aggregate user replay data client-side wrapped in useCallback
  const loadTelemetry = useCallback(async () => {
    if (!session?.user) {
      setLoading(false);
      return;
    }

    const isDemo = typeof window !== 'undefined' && (localStorage.getItem('typrox_demo') === 'true' || window.location.search.includes('demo=true'));
    if (isDemo) {
      setHeatmap({
        q: 12, w: 25, e: 84, r: 56, t: 44, y: 31, u: 48, i: 62, o: 53, p: 18,
        a: 42, s: 61, d: 73, f: 58, g: 35, h: 29, j: 38, k: 44, l: 51, ';': 8,
        z: 5, x: 9, c: 32, v: 28, b: 22, n: 41, m: 36, ',': 14, '.': 19, '/': 3,
        ' ': 154
      });
      setHandDistribution({ left: 53, right: 47 });
      setSlowBigrams([
        { bigram: 'wa', speed: 284 },
        { bigram: 'lo', speed: 261 },
        { bigram: 'br', speed: 245 },
        { bigram: 'pl', speed: 238 },
        { bigram: 'fe', speed: 219 }
      ]);
      setWeakKeys([
        { key: 'q', count: 9 },
        { key: 'z', count: 7 },
        { key: 'p', count: 6 },
        { key: 'x', count: 5 },
        { key: ';', count: 4 }
      ]);
      setHasData(true);
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      
      // Fetch last 15 user tests with replays
      const { data: results } = await supabase
        .from('test_results')
        .select('id')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(15);

      if (!results || results.length === 0) {
        setHasData(false);
        setLoading(false);
        return;
      }

      const testIds = results.map((r: { id: string }) => r.id);
      const { data: replays } = await supabase
        .from('replays')
        .select('telemetry')
        .in('test_result_id', testIds);

      if (!replays || replays.length === 0) {
        setHasData(false);
        setLoading(false);
        return;
      }

      // Compile metrics
      const keyUsage: Record<string, number> = {};
      const fingerHits: Record<string, number> = {};
      const bigramSpeeds: Record<string, number[]> = {};
      const errorsList: Record<string, number> = {};

      replays.forEach((rep: { telemetry?: Array<{ t: number; k: string; y: number; i: number }> }) => {
        const telemetry = (rep.telemetry || []) as Array<{ t: number; k: string; y: number; i: number }>;
        
        for (let i = 1; i < telemetry.length; i++) {
          const prev = telemetry[i - 1];
          const curr = telemetry[i];

          if (curr.y === 0) { // input event
            const char = curr.k.toLowerCase();
            
            // Heatmap tracking
            keyUsage[char] = (keyUsage[char] || 0) + 1;

            // Finger load mapping
            const finger = FINGER_MAP[char] || 'Other';
            fingerHits[finger] = (fingerHits[finger] || 0) + 1;

            // Bigram transitions speed
            if (prev.y === 0) {
              const bigram = (prev.k + curr.k).toLowerCase();
              if (bigram.length === 2 && /^[a-z]{2}$/.test(bigram)) {
                const delta = curr.t - prev.t;
                if (delta > 0 && delta < 1500) {
                  if (!bigramSpeeds[bigram]) bigramSpeeds[bigram] = [];
                  bigramSpeeds[bigram].push(delta);
                }
              }
            }
          } else if (curr.y === 1) { // delete event
            // Trace key that was deleted to label as error
            const errorChar = prev.k.toLowerCase();
            if (errorChar.length === 1) {
              errorsList[errorChar] = (errorsList[errorChar] || 0) + 1;
            }
          }
        }
      });

      // Resolve bigram averages
      const averageBigrams = Object.entries(bigramSpeeds)
        .map(([bigram, times]) => ({
          bigram,
          speed: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
        }))
        .sort((a, b) => b.speed - a.speed) // Slowest transitions first
        .slice(0, 5);

      // Resolve weak keys
      const sortedWeakKeys = Object.entries(errorsList)
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Left vs Right hand calculation
      let leftHits = 0;
      let rightHits = 0;
      Object.entries(fingerHits).forEach(([finger, count]) => {
        if (finger.startsWith('Left')) leftHits += count;
        if (finger.startsWith('Right')) rightHits += count;
      });
      const totalHits = leftHits + rightHits || 1;

      setHeatmap(keyUsage);
      setHandDistribution({
        left: Math.round((leftHits / totalHits) * 100),
        right: Math.round((rightHits / totalHits) * 100),
      });
      setSlowBigrams(averageBigrams);
      setWeakKeys(sortedWeakKeys);
      setHasData(true);

    } catch (err) {
      console.error('Failed to compile telemetry analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  // Load telemetry data on mount/session changes
  useEffect(() => {
    Promise.resolve().then(() => loadTelemetry());
  }, [loadTelemetry]);

  // Realtime subscription for Supabase replays table
  useEffect(() => {
    if (!session?.user) return;

    let channel: RealtimeChannel | null = null;
    let supabaseInstance: SupabaseClient | null = null;

    try {
      supabaseInstance = createClient();
      channel = supabaseInstance
        .channel(`lab-replays-${session.user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'replays',
          },
          () => {
            loadTelemetry();
          }
        )
        .subscribe();
    } catch (err) {
      console.error("Failed to subscribe to lab replays:", err);
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
  }, [session, loadTelemetry]);

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

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-6 py-10 flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2 border-b-3 border-border pb-4 mb-2">
          <div className="flex items-center gap-2.5 text-accent">
            <Sparkles className="w-6 h-6 fill-current" />
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-text-primary">Performance Lab</h1>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Signature keyheatmap and finger loading analysis vectors</p>
        </div>

        {/* LOCKED GATING VIEW FOR FREE TIER */}
        {!session?.user ? (
          <div className="relative p-8 border-3 border-border bg-surface overflow-hidden min-h-[400px] flex items-center justify-center">
            {/* Blurred Mockup Graphics in background */}
            <div className="absolute inset-0 opacity-20 filter blur-sm select-none pointer-events-none flex flex-col justify-around p-8">
              <div className="h-10 bg-border w-1/3" />
              <div className="h-44 bg-border w-full" />
              <div className="h-20 bg-border w-1/2" />
            </div>

            {/* Lock Modal Card overlay */}
            <div className="relative z-10 p-8 bg-surface/90 border-3 border-border shadow-2xl max-w-md text-center flex flex-col items-center gap-6">
              <div className="w-12 h-12 bg-accent/10 border-2 border-border flex items-center justify-center text-accent">
                <Lock className="w-6 h-6" />
              </div>
              <div className="flex flex-col gap-2">
                <h2 className="text-lg font-bold text-text-primary">Sign In Required</h2>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Sign in to unlock your custom keystroke heatmaps, finger balance ratios, transition speeds, and weak key lists.
                </p>
              </div>

              <Button
                href="/login"
                variant="primary"
              >
                Sign In to Unlock
              </Button>
            </div>
          </div>
        ) : !hasData ? (
          /* EMPTY STATE CTA FOR SIGNED IN USERS WITH NO REPLAYS */
          <div className="p-8 border-3 border-border bg-surface-accent flex flex-col items-center justify-center text-center gap-6 min-h-[350px]">
            <div className="w-12 h-12 bg-bauhaus-red/10 border-2 border-border flex items-center justify-center text-bauhaus-red">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-2 max-w-md">
              <h2 className="text-lg font-black uppercase tracking-wider text-text-primary">No Replay Data Detected</h2>
              <p className="text-xs font-bold uppercase tracking-wider text-text-secondary leading-relaxed">
                You haven&apos;t completed any typing tests in this account yet, or your tests don&apos;t have replay logs. Head over to the practice arena to register your first keystroke profile!
              </p>
            </div>
            <Button
              href="/typing"
              variant="primary"
            >
              Start Typing Test
            </Button>
          </div>
        ) : (
          /* FULLY FUNCTIONAL LAB VISUALS */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Left: Keyboard Heatmap Grid */}
            <div className="md:col-span-2 p-6 bg-surface border-3 border-border flex flex-col shadow-xs gap-6">
              <div className="flex items-center gap-2 border-b-2 border-border pb-4">
                <Keyboard className="w-4 h-4 text-accent" />
                <span className="text-xs font-black uppercase tracking-widest text-text-primary font-mono">Keystroke usage Map</span>
              </div>

              <div className="flex flex-col gap-2.5 max-w-xl mx-auto w-full">
                {KEYBOARD_ROWS.map((row, rowIdx) => (
                  <div key={rowIdx} className="flex justify-center gap-1.5">
                    {row.map((key) => {
                      const count = heatmap[key] || 0;
                      // Color scale matching counts
                      let heatClass = 'bg-background text-text-secondary border-border/30';
                      if (count > 80) heatClass = 'bg-accent text-black border-accent';
                      else if (count > 40) heatClass = 'bg-accent/60 text-black border-accent/70';
                      else if (count > 15) heatClass = 'bg-accent/30 text-text-primary border-accent/40';
                      else if (count > 0) heatClass = 'bg-accent/10 text-text-primary border-accent/20';

                      return (
                        <div
                          key={key}
                          className={`w-8 h-8 md:w-11 md:h-11 border border-border/40 flex flex-col items-center justify-center font-mono font-bold select-none text-[10px] md:text-xs ${heatClass}`}
                        >
                          <span>{key.toUpperCase()}</span>
                          {count > 0 && <span className="text-[9px] font-normal opacity-85">{count}</span>}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Hand split & Bigrams lists */}
            <div className="flex flex-col gap-6">
              {/* Hand usage card */}
              <div className="p-6 bg-surface border-3 border-border flex flex-col shadow-xs gap-4">
                <div className="flex items-center gap-2 border-b-2 border-border pb-4">
                  <BarChart2 className="w-4 h-4 text-accent" />
                  <span className="text-xs font-black uppercase tracking-widest text-text-primary">Hands Load Balance</span>
                </div>

                <div className="flex items-center justify-around text-center py-2">
                  <div className="flex flex-col">
                    <span className="text-xl font-bold font-mono text-text-primary">{handDistribution.left}%</span>
                    <span className="text-xs font-bold uppercase tracking-wider text-text-secondary mt-0.5">Left Hand</span>
                  </div>
                  <div className="w-[1px] h-8 bg-border" />
                  <div className="flex flex-col">
                    <span className="text-xl font-bold font-mono text-text-primary">{handDistribution.right}%</span>
                    <span className="text-xs font-bold uppercase tracking-wider text-text-secondary mt-0.5">Right Hand</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-background border-2 border-border overflow-hidden flex">
                  <div className="bg-accent h-full" style={{ width: `${handDistribution.left}%` }} />
                  <div className="bg-accent/80 h-full" style={{ width: `${handDistribution.right}%` }} />
                </div>
              </div>

              {/* Slow transitions list */}
              <div className="p-6 bg-surface border-3 border-border flex flex-col shadow-xs gap-4">
                <div className="flex items-center gap-2 border-b-2 border-border pb-4">
                  <Zap className="w-4 h-4 text-accent" />
                  <span className="text-xs font-black uppercase tracking-widest text-text-primary">Slowest Key Transitions</span>
                </div>

                {slowBigrams.length === 0 ? (
                  <div className="text-center py-6 text-xs text-text-secondary font-bold uppercase tracking-wider">
                    No transition metrics resolved yet.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {slowBigrams.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2 bg-background/50 border-3 border-border/50 font-mono text-xs">
                        <span className="font-bold text-text-primary">&quot;{item.bigram.toUpperCase()}&quot;</span>
                        <span className="text-error">{item.speed} ms delay</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Weak Key Drills */}
              <div className="p-6 bg-surface border-3 border-border flex flex-col shadow-xs gap-4">
                <div className="flex items-center gap-2 border-b-2 border-border pb-4">
                  <ShieldAlert className="w-4 h-4 text-accent" />
                  <span className="text-xs font-black uppercase tracking-widest text-text-primary">Weak Key Drills</span>
                </div>

                {weakKeys.length === 0 ? (
                  <div className="text-center py-6 text-xs text-text-secondary font-bold uppercase tracking-wider">
                    No error logs registered yet.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                      Top error keys (Drill these characters in Custom Mode):
                    </p>
                    {weakKeys.map((item, idx) => {
                      const maxCount = Math.max(...weakKeys.map(k => k.count)) || 1;
                      const percentage = Math.round((item.count / maxCount) * 100);
                      return (
                        <div key={idx} className="flex flex-col gap-1.5">
                          <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider font-mono">
                            <span className="text-text-primary font-black">&quot;{item.key.toUpperCase()}&quot;</span>
                            <span className="text-bauhaus-red">{item.count} errors</span>
                          </div>
                          <div className="w-full h-2 bg-background border border-border overflow-hidden">
                            <div className="bg-bauhaus-red h-full" style={{ width: `${percentage}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
