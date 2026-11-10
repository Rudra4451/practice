'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { BarChart2, Sparkles } from 'lucide-react';

export default function AnalyticsSection() {
  return (
    <section className="py-20 md:py-28 px-4 md:px-6 overflow-x-clip">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col gap-6"
        >
          <span className="text-xs font-semibold text-accent-ink uppercase tracking-wider">Analytics & Lab</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-text-primary leading-tight font-display">
            Pinpoint What Slows You Down
          </h2>
          <p className="text-base text-text-secondary leading-relaxed">
            Your Performance Lab reconstructs every session keystroke-by-keystroke against the exact target prompt so you can eliminate errors and hesitate less.
          </p>
          <ul className="flex flex-col gap-4 text-sm font-medium text-text-secondary mt-2">
            {[
              'Second-by-second Net vs Raw WPM speed timeline',
              'Seed-aligned weak-key error counts and direct drill launcher',
              'Left/Right hand split and per-finger workload balance',
              'UTC streak tracking and historical consistency indexing',
            ].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-accent/15 text-accent-ink flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold">✓</span>
                </div>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3 mt-2">
            <Button href="/dashboard" variant="secondary" className="px-6">
              <BarChart2 className="w-4 h-4" />
              <span>Open Dashboard</span>
            </Button>
            <Button href="/dashboard/performance-lab" variant="ghost" className="px-5 border border-border">
              <Sparkles className="w-4 h-4 text-accent-ink" />
              <span>Performance Lab</span>
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="p-6 rounded-2xl border border-border bg-surface shadow-md hover:border-accent/40 transition-colors max-w-lg mx-auto w-full relative"
        >
          <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
                Sample Progression Curve
              </span>
              <span className="text-[11px] text-text-secondary mt-0.5">
                Illustrative speed trend across 7 focused runs
              </span>
            </div>
            <span className="w-2.5 h-2.5 bg-accent rounded-full" />
          </div>

          <div className="h-48 bg-surface-accent/40 rounded-xl flex items-end justify-between p-4 gap-3 relative overflow-hidden border border-border">
            {[42, 56, 68, 64, 78, 92].map((pct, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                whileInView={{ height: `${pct}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: 0.08 + i * 0.08, type: 'spring' }}
                className="w-full rounded-t-md bg-accent/25 border border-accent/20"
              />
            ))}
            <motion.div
              initial={{ height: 0 }}
              whileInView={{ height: '98%' }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.55, type: 'spring' }}
              className="w-full rounded-t-md relative bg-accent flex items-start justify-center pt-2"
            >
              <span className="text-[11px] font-bold text-accent-foreground font-mono">Target</span>
            </motion.div>
          </div>

          <div className="flex justify-between text-[11px] text-text-secondary font-medium uppercase tracking-wider mt-4 px-2">
            {['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'].map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
