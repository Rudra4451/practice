'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function FAQSection() {
  return (
    <section className="py-24 px-4 md:px-6 border-b-3 border-border bg-surface-accent">
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16 flex flex-col gap-3">
          <span className="text-xs font-bold text-accent uppercase tracking-widest">FAQ</span>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight uppercase text-text-primary">Common Questions</h2>
          <div className="w-16 h-2 bg-accent mx-auto mt-1" />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="flex flex-col gap-0 border-3 border-border">
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
            <div key={i} className={`p-6 bg-background ${i < 3 ? 'border-b-2 border-border' : ''}`}>
              <h3 className="font-bold uppercase tracking-wider text-text-primary flex items-start gap-3">
                <span className="w-5 h-5 bg-accent border-2 border-border flex-shrink-0 flex items-center justify-center text-[9px] text-white mt-px">?</span>
                <span>{q}</span>
              </h3>
              <p className="text-xs md:text-sm text-text-secondary mt-3 leading-relaxed pl-8 font-medium">
                {a}
              </p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
