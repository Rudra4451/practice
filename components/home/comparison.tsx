'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function ComparisonSection() {
  return (
    <section className="py-20 px-4 md:px-6 border-b-3 border-border bg-surface-accent">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12 flex flex-col gap-3">
          <span className="text-xs font-bold text-accent uppercase tracking-widest">Why TyProX</span>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight uppercase text-text-primary">How We Compare</h2>
          <div className="w-16 h-1 bg-accent mx-auto mt-1" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="overflow-x-auto border-3 border-border bg-background">
          <table className="w-full text-left border-collapse text-xs md:text-sm font-bold uppercase tracking-wider">
            <thead>
              <tr className="border-b-3 border-border bg-surface text-[10px] uppercase font-black text-text-primary tracking-widest">
                <th className="p-4">Feature</th>
                <th className="p-4 text-accent">TyProX</th>
                <th className="p-4 text-text-secondary">Traditional Sites</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b-2 border-border/10">
                <td className="p-4 text-text-primary">Focus Environment</td>
                <td className="p-4 text-accent">Distraction-free, zero-ads</td>
                <td className="p-4 text-text-secondary">Cluttered with ads & popups</td>
              </tr>
              <tr className="border-b-2 border-border/10">
                <td className="p-4 text-text-primary">Rhythm & Flow</td>
                <td className="p-4 text-accent">Consistency indexing & error telemetry</td>
                <td className="p-4 text-text-secondary">Simple WPM average only</td>
              </tr>
              <tr className="border-b-2 border-border/10">
                <td className="p-4 text-text-primary">Fair Competition</td>
                <td className="p-4 text-accent">Verified & secure rankings</td>
                <td className="p-4 text-text-secondary">Easily manipulated scores</td>
              </tr>
              <tr>
                <td className="p-4 text-text-primary">Progress Analytics</td>
                <td className="p-4 text-accent">Historical trends & key graphs</td>
                <td className="p-4 text-text-secondary">Basic high-score summaries</td>
              </tr>
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  );
}
