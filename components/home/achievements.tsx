'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function AchievementsSection() {
  return (
    <section className="py-20 md:py-28 px-4 md:px-6 bg-background">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14 flex flex-col gap-3"
        >
          <span className="text-xs font-semibold text-accent-ink uppercase tracking-wider">Milestones</span>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary font-display">
            Earn Server-Verified Badges
          </h2>
          <p className="text-sm text-text-secondary max-w-lg mx-auto">
            Every achievement badge evaluates your verified server test history automatically and appears on your public profile.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              name: 'Velocity 100',
              desc: 'Complete a verified ranked test at 100+ Net WPM.',
              badge: '100+ WPM',
              accentClass: 'border-accent/35 bg-accent/[0.04] text-accent-ink',
            },
            {
              name: 'Sharp Accuracy',
              desc: 'Hold 98%+ precision across any verified ranked session.',
              badge: '98%+ ACC',
              accentClass: 'border-success/35 bg-success/[0.04] text-success',
            },
            {
              name: '7-Day Streak',
              desc: 'Record at least one verified session on 7 consecutive UTC days.',
              badge: '7 DAYS',
              accentClass: 'border-border bg-surface text-text-primary',
            },
          ].map((ach, i) => (
            <motion.div
              key={ach.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className={`p-6 border rounded-2xl flex flex-col gap-4 transition-all duration-200 shadow-sm hover:-translate-y-1 ${ach.accentClass}`}
            >
              <div className="flex justify-between items-start gap-2">
                <span className="font-bold text-base tracking-tight text-text-primary">{ach.name}</span>
                <span className="font-mono text-[11px] px-2.5 py-1 border border-current/25 rounded-lg bg-surface font-bold">
                  {ach.badge}
                </span>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed font-medium mt-auto">{ach.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
