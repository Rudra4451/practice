'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { Keyboard, Trophy, Zap, ShieldCheck } from 'lucide-react';

const STATS_DATA = [
  {
    icon: Keyboard,
    label: 'Total Keystrokes',
    value: 1248900,
    suffix: '+',
    color: 'text-accent',
    border: 'border-accent/30',
  },
  {
    icon: Trophy,
    label: 'Verified Tests',
    value: 54820,
    suffix: '',
    color: 'text-amber-400',
    border: 'border-amber-500/30',
  },
  {
    icon: ShieldCheck,
    label: 'Precision Engine',
    value: 99.4,
    suffix: '%',
    decimals: 1,
    color: 'text-success',
    border: 'border-success/30',
  },
  {
    icon: Zap,
    label: 'All-Time Record WPM',
    value: 186,
    suffix: ' WPM',
    color: 'text-cyan-400',
    border: 'border-cyan-500/30',
  },
];

export const LiveStatsBar: React.FC = () => {
  return (
    <section className="w-full py-12 px-4 border-y border-border/80 bg-surface/20 backdrop-blur-xl relative overflow-hidden select-none">
      {/* Background Subtle Gradient Glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-accent/5 via-transparent to-accent-secondary/5 pointer-events-none" />

      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 relative z-10">
        {STATS_DATA.map((st, i) => (
          <motion.div
            key={st.label}
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className={`p-5 rounded-2xl border ${st.border} bg-surface/40 backdrop-blur-md flex flex-col gap-1 shadow-sm hover:scale-[1.02] transition-all duration-300`}
          >
            <div className="flex items-center gap-2 text-text-secondary mb-1">
              <st.icon className={`w-4 h-4 ${st.color}`} />
              <span className="text-[10px] font-bold uppercase tracking-widest">{st.label}</span>
            </div>

            <span className={`text-3xl sm:text-4xl font-black font-mono leading-none ${st.color}`}>
              <AnimatedCounter value={st.value} duration={2000} suffix={st.suffix} />
            </span>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
