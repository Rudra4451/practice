'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function FAQSection() {
  return (
    <section className="py-20 md:py-28 px-4 md:px-6">
      <div className="max-w-3xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 12 }} 
          whileInView={{ opacity: 1, y: 0 }} 
          viewport={{ once: true }} 
          className="text-center mb-14 flex flex-col gap-3"
        >
          <span className="text-xs font-semibold text-accent uppercase tracking-wider">FAQ</span>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary font-display">Common Questions</h2>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 16 }} 
          whileInView={{ opacity: 1, y: 0 }} 
          viewport={{ once: true }} 
          className="flex flex-col gap-0 border border-border rounded-2xl overflow-hidden shadow-md bg-surface/80 backdrop-blur-md"
        >
          {[
            {
              q: 'How does TyProX help me type faster?',
              a: 'By providing a distraction-free, zero-lag environment and instant rhythm feedback so you can identify and eliminate speed bottlenecks.',
            },
            {
              q: 'Can I track my progress over time?',
              a: 'Yes. Connecting your profile saves all your test results so you can monitor your speed trends and analytics on a personalized dashboard.',
            },
            {
              q: 'How do leaderboards work?',
              a: 'Compete in real time across different modes (words, quotes, code) and durations (15s, 30s, 60s). Complete a run, and your score is automatically placed on the global leaderboard.',
            },
            {
              q: 'Are leaderboard rankings verified?',
              a: 'Yes. To ensure fair competition, every submission is analyzed and verified before reaching the rankings. This keeps the leaderboards clean, authentic, and competitive.',
            },
          ].map(({ q, a }, i) => (
            <div key={i} className={`p-6 bg-surface ${i < 3 ? 'border-b border-border' : ''} hover:bg-surface-accent/30 transition-colors duration-300`}>
              <h3 className="font-bold text-base tracking-tight text-text-primary flex items-start gap-3">
                <span className="w-6 h-6 bg-accent/10 text-accent flex-shrink-0 flex items-center justify-center text-[11px] font-bold rounded-full mt-px">?</span>
                <span>{q}</span>
              </h3>
              <p className="text-sm text-text-secondary mt-3 leading-relaxed pl-9 font-medium">
                {a}
              </p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
