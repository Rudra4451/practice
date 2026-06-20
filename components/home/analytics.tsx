'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { BarChart2 } from 'lucide-react';

export default function AnalyticsSection() {
  return (
    <section className="py-24 px-4 md:px-6 border-b-3 border-border bg-surface-accent">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="flex flex-col gap-6">
          <span className="text-xs font-bold text-accent uppercase tracking-widest">Analytics & Progress</span>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight uppercase text-text-primary leading-none">Deep Metric Visibility</h2>
          <div className="w-16 h-2 bg-accent mt-1" />
          <p className="text-sm md:text-base text-text-secondary font-semibold leading-relaxed mt-1">
            Your dashboard shows more than a single speed number. Track where your speed comes from and what keeps you back.
          </p>
          <ul className="flex flex-col gap-3 text-xs md:text-sm font-bold uppercase tracking-wider mt-2 text-left">
            {[
              'Track your second-by-second speed improvements',
              'Identify weak keys from your personal error history',
              'Measure your consistency and typing rhythm',
              'Build daily streaks and visual typing habits',
            ].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <div className="w-5 h-5 bg-accent border-2 border-border flex items-center justify-center text-xs text-white flex-shrink-0">✔</div>
                <span className="text-text-primary">{item}</span>
              </li>
            ))}
          </ul>
          <Button href="/dashboard" variant="secondary" className="self-start mt-2">
            <BarChart2 className="w-4 h-4" />
            <span>Open Dashboard</span>
          </Button>
        </motion.div>

        {/* Bauhaus chart mockup */}
        <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="p-6 bg-background border-3 border-border flex flex-col gap-4 max-w-lg mx-auto w-full font-mono relative">
          <div className="absolute -top-3 -right-3 w-6 h-6 bg-bauhaus-red border-2 border-border" />
          <div className="flex items-center justify-between border-b-2 border-border pb-2">
            <span className="text-xs font-bold text-text-primary uppercase tracking-wider">WPM — Last 7 Runs</span>
            <span className="w-3 h-3 bg-accent border border-border" />
          </div>
          <div className="h-44 bg-surface-accent border-2 border-border flex items-end justify-between p-4 gap-2 relative overflow-hidden">
            <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 pointer-events-none opacity-10">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="border-r border-b border-text-primary" />)}
            </div>
            {[10, 16, 24, 20, 28, 36].map((h, i) => (
              <div
                key={i}
                className="w-full border-t border-x border-border z-10 bg-accent"
                style={{ height: `${h * 4}px`, opacity: 0.2 + i * 0.12 }}
              />
            ))}
            <div className="w-full bg-accent h-36 border-2 border-border z-10 flex items-center justify-center text-xs text-white font-bold">96</div>
          </div>
          <div className="flex justify-between text-xs text-text-secondary font-bold uppercase tracking-wider">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
