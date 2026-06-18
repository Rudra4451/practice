'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUserStore } from '@/stores/user-store';
import { Navbar } from '@/components/navbar';
import { createClient } from '@/lib/supabase/client';
import { Lock, Zap, Keyboard, Sparkles, BarChart2, CheckCircle, ShieldAlert, Award } from 'lucide-react';

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
  const { session, profile } = useUserStore();
  const [loading, setLoading] = useState(true);

  // Performance Telemetry Aggregates
  const [heatmap, setHeatmap] = useState<Record<string, number>>({});
  const [fingerLoads, setFingerLoads] = useState<Record<string, number>>({});
  const [handDistribution, setHandDistribution] = useState({ left: 50, right: 50 });
  const [slowBigrams, setSlowBigrams] = useState<Array<{ bigram: string; speed: number }>>([]);
  const [weakKeys, setWeakKeys] = useState<Array<{ key: string; count: number }>>([]);

  // Aggregate user replay data client-side
  useEffect(() => {
    if (!session?.user) {
      setLoading(false);
      return;
    }

    async function loadTelemetry() {
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
          setLoading(false);
          return;
        }

        const testIds = results.map((r) => r.id);
        const { data: replays } = await supabase
          .from('replays')
          .select('telemetry')
          .in('test_result_id', testIds);

        if (!replays || replays.length === 0) {
          setLoading(false);
          return;
        }

        // Compile metrics
        const keyUsage: Record<string, number> = {};
        const fingerHits: Record<string, number> = {};
        const bigramSpeeds: Record<string, number[]> = {};
        const errorsList: Record<string, number> = {};

        replays.forEach((rep) => {
          const telemetry = rep.telemetry as any[];
          
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
        setFingerLoads(fingerHits);
        setHandDistribution({
          left: Math.round((leftHits / totalHits) * 100),
          right: Math.round((rightHits / totalHits) * 100),
        });
        setSlowBigrams(averageBigrams);
        setWeakKeys(sortedWeakKeys);

      } catch (err) {
        console.error('Failed to compile telemetry analytics:', err);
      } finally {
        setLoading(false);
      }
    }

    loadTelemetry();
  }, [session]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-6 py-10 flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-accent">
            <Sparkles className="w-6 h-6 fill-current" />
            <h1 className="text-2xl md:text-3xl font-extrabold text-text-primary">Performance Lab</h1>
          </div>
          <p className="text-xs text-text-secondary">Signature keyheatmap and finger loading analysis vectors</p>
        </div>

        {/* LOCKED GATING VIEW FOR FREE TIER */}
        {!session?.user ? (
          <div className="relative p-8 border border-border bg-surface rounded-2xl shadow-xl overflow-hidden min-h-[400px] flex items-center justify-center">
            {/* Blurred Mockup Graphics in background */}
            <div className="absolute inset-0 opacity-20 filter blur-sm select-none pointer-events-none flex flex-col justify-around p-8">
              <div className="h-10 bg-border w-1/3 rounded-lg" />
              <div className="h-44 bg-border w-full rounded-xl" />
              <div className="h-20 bg-border w-1/2 rounded-xl" />
            </div>

            {/* Lock Modal Card overlay */}
            <div className="relative z-10 p-8 bg-surface/90 border border-border shadow-2xl rounded-2xl max-w-md text-center flex flex-col items-center gap-6">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                <Lock className="w-6 h-6" />
              </div>
              <div className="flex flex-col gap-2">
                <h2 className="text-lg font-bold text-text-primary">Sign In Required</h2>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Sign in to unlock your custom keystroke heatmaps, finger balance ratios, transition speeds, and weak key lists.
                </p>
              </div>

              <Link
                href="/login"
                className="px-6 py-3 bg-accent hover:bg-accent/90 text-white font-bold text-sm rounded-xl transition-all hover:scale-102"
              >
                Sign In to Unlock
              </Link>
            </div>
          </div>
        ) : (
          /* FULLY FUNCTIONAL LAB VISUALS */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Keyboard Heatmap Grid */}
            <div className="lg:col-span-2 p-6 bg-surface border border-border rounded-2xl flex flex-col shadow-xs gap-6">
              <div className="flex items-center gap-2 border-b border-border/10 pb-4">
                <Keyboard className="w-4 h-4 text-accent" />
                <span className="text-sm font-semibold text-text-primary font-mono">Keystroke usage Map</span>
              </div>

              <div className="flex flex-col gap-2.5 max-w-xl mx-auto w-full">
                {KEYBOARD_ROWS.map((row, rowIdx) => (
                  <div key={rowIdx} className="flex justify-center gap-1.5">
                    {row.map((key) => {
                      const count = heatmap[key] || 0;
                      // Color scale matching counts
                      let heatClass = 'bg-background text-text-secondary border-border/30';
                      if (count > 80) heatClass = 'bg-accent text-white border-accent';
                      else if (count > 40) heatClass = 'bg-accent/60 text-white border-accent/70';
                      else if (count > 15) heatClass = 'bg-accent/30 text-text-primary border-accent/40';
                      else if (count > 0) heatClass = 'bg-accent/10 text-text-primary border-accent/20';

                      return (
                        <div
                          key={key}
                          className={`w-10 h-10 md:w-12 md:h-12 border border-border/40 rounded-md flex flex-col items-center justify-center font-mono font-bold select-none text-xs ${heatClass}`}
                        >
                          <span>{key.toUpperCase()}</span>
                          {count > 0 && <span className="text-[7px] font-normal opacity-80">{count}</span>}
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
              <div className="p-6 bg-surface border border-border rounded-2xl flex flex-col shadow-xs gap-4">
                <div className="flex items-center gap-2 border-b border-border/10 pb-4">
                  <BarChart2 className="w-4 h-4 text-accent" />
                  <span className="text-sm font-semibold text-text-primary">Hands Load Balance</span>
                </div>

                <div className="flex items-center justify-around text-center py-2">
                  <div className="flex flex-col">
                    <span className="text-xl font-bold font-mono text-text-primary">{handDistribution.left}%</span>
                    <span className="text-[10px] text-text-secondary mt-0.5">Left Hand</span>
                  </div>
                  <div className="w-[1px] h-8 bg-border" />
                  <div className="flex flex-col">
                    <span className="text-xl font-bold font-mono text-text-primary">{handDistribution.right}%</span>
                    <span className="text-[10px] text-text-secondary mt-0.5">Right Hand</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-background border border-border rounded-full overflow-hidden flex">
                  <div className="bg-accent h-full" style={{ width: `${handDistribution.left}%` }} />
                  <div className="bg-accent/45 h-full" style={{ width: `${handDistribution.right}%` }} />
                </div>
              </div>

              {/* Slow transitions list */}
              <div className="p-6 bg-surface border border-border rounded-2xl flex flex-col shadow-xs gap-4">
                <div className="flex items-center gap-2 border-b border-border/10 pb-4">
                  <Zap className="w-4 h-4 text-accent" />
                  <span className="text-sm font-semibold text-text-primary">Slowest Key Transitions</span>
                </div>

                {slowBigrams.length === 0 ? (
                  <div className="text-center py-6 text-xs text-text-secondary">
                    No transition metrics resolved yet.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {slowBigrams.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2 bg-background/50 border border-border/50 rounded-xl font-mono text-xs">
                        <span className="font-bold text-text-primary">"{item.bigram.toUpperCase()}"</span>
                        <span className="text-error">{item.speed} ms delay</span>
                      </div>
                    ))}
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
