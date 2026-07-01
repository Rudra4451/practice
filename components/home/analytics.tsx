'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { BarChart2 } from 'lucide-react';

export default function AnalyticsSection() {
  return (
    <section className="py-20 md:py-28 px-4 md:px-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <motion.div 
          initial={{ opacity: 0, x: -20 }} 
          whileInView={{ opacity: 1, x: 0 }} 
          viewport={{ once: true }} 
          className="flex flex-col gap-6"
        >
          <span className="text-xs font-semibold text-accent uppercase tracking-wider">Analytics & Progress</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-text-primary leading-tight font-display">Deep Metric Visibility</h2>
          <p className="text-base text-text-secondary leading-relaxed">
            Your dashboard shows more than a single speed number. Track where your speed comes from and what keeps you back.
          </p>
          <ul className="flex flex-col gap-4 text-sm font-medium text-text-secondary mt-2">
            {[
              'Track second-by-second speed improvements',
              'Identify weak keys from personal error history',
              'Measure typing consistency and rhythm',
              'Build daily streaks and visual typing habits',
            ].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-accent/10 text-accent flex items-center justify-center shrink-0">
                  <span className="text-xs">✔</span>
                </div>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <Button href="/dashboard" variant="secondary" className="self-start mt-2 px-6">
            <BarChart2 className="w-4 h-4" />
            <span>Open Dashboard</span>
          </Button>
        </motion.div>

        {/* Branded chart mockup */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }} 
          whileInView={{ opacity: 1, x: 0 }} 
          viewport={{ once: true }} 
          className="p-6 rounded-2xl border border-border bg-surface/50 backdrop-blur-sm shadow-xl hover:shadow-2xl hover:border-accent/30 transition-all duration-300 max-w-lg mx-auto w-full relative group"
        >
          {/* Inner glow */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
          
          <div className="flex items-center justify-between border-b border-border/60 pb-4 mb-6 relative z-10">
            <span className="text-xs font-semibold text-text-primary uppercase tracking-wider">WPM — Last 7 Runs</span>
            <span className="w-2.5 h-2.5 bg-accent rounded-full animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
          </div>
          
          <div className="h-48 bg-surface-accent/20 rounded-xl flex items-end justify-between p-4 gap-3 relative overflow-hidden z-10 border border-border/40">
            <div className="absolute inset-0 pointer-events-none opacity-[0.03]">
              <svg width="100%" height="100%">
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="1"/>
                </pattern>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>
            </div>
            
            {[10, 16, 24, 20, 28, 36].map((h, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                whileInView={{ height: `${h * 4}px` }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 + i * 0.1, type: 'spring' }}
                className="w-full rounded-t-md relative group-hover:bg-accent/40 bg-accent/20 transition-colors"
              />
            ))}
            <motion.div 
              initial={{ height: 0 }}
              whileInView={{ height: '144px' }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.7, type: 'spring' }}
              className="w-full rounded-t-md relative bg-gradient-to-t from-accent/80 to-accent shadow-glow flex items-center justify-center"
            >
              <span className="text-xs font-bold text-white font-mono absolute top-2">96</span>
            </motion.div>
          </div>
          
          <div className="flex justify-between text-[10px] text-text-tertiary font-medium uppercase tracking-wider mt-4 px-2 relative z-10">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
