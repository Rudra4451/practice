'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

export default function ComparisonSection() {
  return (
    <section className="py-20 md:py-28 px-4 md:px-6 bg-surface-accent/40 overflow-x-clip">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 flex flex-col gap-3"
        >
          <span className="text-xs font-semibold text-accent-ink uppercase tracking-wider">Why TyProX</span>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary font-display">
            Built for Deliberate Practice
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="overflow-x-auto border border-border bg-surface rounded-2xl shadow-md"
        >
          <table className="w-full text-left border-collapse text-xs sm:text-sm font-medium">
            <thead>
              <tr className="border-b border-border bg-surface-accent/60 text-[11px] sm:text-xs uppercase font-bold text-text-secondary tracking-wider">
                <th className="p-3 sm:p-5 w-1/3">Capability</th>
                <th className="p-3 sm:p-5 w-1/3 text-accent-ink border-l border-border/60 bg-accent/5">TyProX</th>
                <th className="p-3 sm:p-5 w-1/3 text-text-secondary border-l border-border/60">Conventional Tests</th>
              </tr>
            </thead>
            <tbody>
              {[
                { feature: 'Structured Training', pro: 'Progressive curriculum with 92% accuracy gates', con: 'Random word loops only' },
                { feature: 'Diagnostic Lab', pro: 'Keystroke replays, finger loads, and slow bigrams', con: 'Single raw WPM summary' },
                { feature: 'Leaderboard Trust', pro: 'Server-verified replays and seeded challenges', con: 'Client-submitted score posts' },
                { feature: 'Weakness Remediation', pro: 'One-click targeted drills on missed keys', con: 'No per-key drill targeting' },
              ].map((row, idx, arr) => (
                <tr
                  key={row.feature}
                  className={`group hover:bg-surface-accent/30 transition-colors ${
                    idx !== arr.length - 1 ? 'border-b border-border/60' : ''
                  }`}
                >
                  <td className="p-3 sm:p-5 text-text-primary font-semibold">{row.feature}</td>
                  <td className="p-3 sm:p-5 border-l border-border/60 bg-accent/[0.02]">
                    <div className="flex items-start gap-2 sm:gap-2.5">
                      <div className="mt-0.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-success/15 text-success flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                      <span className="text-text-primary">{row.pro}</span>
                    </div>
                  </td>
                  <td className="p-3 sm:p-5 text-text-secondary border-l border-border/60">
                    <div className="flex items-start gap-2 sm:gap-2.5">
                      <div className="mt-0.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-error/10 text-error flex items-center justify-center shrink-0">
                        <X className="w-3 h-3" />
                      </div>
                      <span className="text-text-secondary">{row.con}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  );
}
