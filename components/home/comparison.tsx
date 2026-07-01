'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

export default function ComparisonSection() {
  return (
    <section className="py-20 md:py-28 px-4 md:px-6 bg-surface-accent/20">
      <div className="max-w-4xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 12 }} 
          whileInView={{ opacity: 1, y: 0 }} 
          viewport={{ once: true }} 
          className="text-center mb-12 flex flex-col gap-3"
        >
          <span className="text-xs font-semibold text-accent uppercase tracking-wider">Why TyProX</span>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary font-display">How We Compare</h2>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 16 }} 
          whileInView={{ opacity: 1, y: 0 }} 
          viewport={{ once: true }} 
          className="overflow-x-auto border border-border bg-surface rounded-2xl shadow-md"
        >
          <table className="w-full text-left border-collapse text-sm font-medium">
            <thead>
              <tr className="border-b border-border bg-surface-accent/50 text-[11px] uppercase font-bold text-text-tertiary tracking-wider">
                <th className="p-5 w-1/3">Feature</th>
                <th className="p-5 w-1/3 text-accent border-l border-border/50 bg-accent/5">TyProX</th>
                <th className="p-5 w-1/3 text-text-secondary border-l border-border/50">Traditional Sites</th>
              </tr>
            </thead>
            <tbody>
              {[
                { feature: 'Focus Environment', pro: 'Distraction-free, zero ads', con: 'Cluttered with ads' },
                { feature: 'Analytics', pro: 'Telemetry & consistency indexing', con: 'Basic WPM average' },
                { feature: 'Leaderboards', pro: 'Verified, secure rankings', con: 'Easily manipulated' },
                { feature: 'Growth Tracking', pro: 'Historical trend graphs', con: 'Basic high scores' }
              ].map((row, idx, arr) => (
                <tr key={row.feature} className={`group hover:bg-surface-accent/30 transition-colors ${idx !== arr.length - 1 ? 'border-b border-border/60' : ''}`}>
                  <td className="p-5 text-text-primary font-semibold">{row.feature}</td>
                  <td className="p-5 border-l border-border/50 bg-accent/[0.02] group-hover:bg-accent/[0.04] transition-colors">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 w-4 h-4 rounded-full bg-success/20 text-success flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                      <span className="text-text-primary">{row.pro}</span>
                    </div>
                  </td>
                  <td className="p-5 text-text-secondary border-l border-border/50">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 w-4 h-4 rounded-full bg-error/10 text-error flex items-center justify-center shrink-0">
                        <X className="w-2.5 h-2.5" />
                      </div>
                      <span className="text-text-tertiary">{row.con}</span>
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
