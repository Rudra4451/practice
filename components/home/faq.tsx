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
          <span className="text-xs font-semibold text-accent-ink uppercase tracking-wider">FAQ</span>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary font-display">
            Common Questions
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col gap-0 border border-border rounded-2xl overflow-hidden shadow-md bg-surface"
        >
          {[
            {
              q: 'How does TyProX help me type faster cleanly?',
              a: 'Start in the guided curriculum to lock in finger placement with 92% accuracy gates, then use Performance Lab drills to fix your slowest bigrams and frequent typos.',
            },
            {
              q: 'Can I practice before creating an account?',
              a: 'Yes. Guest runs, curriculum mastery progress, and daily challenge results save locally in your browser. When you sign in, compatible replay runs can be imported into your account.',
            },
            {
              q: 'How does the Daily Challenge work?',
              a: 'Every UTC calendar day generates a deterministic shared prompt seed on /daily so everyone practices the exact same sequence under identical conditions.',
            },
            {
              q: 'How are global leaderboards kept authentic?',
              a: 'Scores are never accepted straight from the browser. Signed-in ranked runs send compressed keystroke telemetry to the server, which regenerates the seeded prompt and recomputes WPM, accuracy, and consistency.',
            },
          ].map(({ q, a }, i) => (
            <div
              key={q}
              className={`p-6 bg-surface ${i < 3 ? 'border-b border-border' : ''} hover:bg-surface-accent/30 transition-colors duration-200`}
            >
              <h3 className="font-bold text-base tracking-tight text-text-primary flex items-start gap-3">
                <span className="w-6 h-6 bg-accent/15 text-accent-ink flex-shrink-0 flex items-center justify-center text-xs font-bold rounded-full mt-px">
                  ?
                </span>
                <span>{q}</span>
              </h3>
              <p className="text-sm text-text-secondary mt-3 leading-relaxed pl-9 font-medium">{a}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
