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
          <span className="text-xs font-semibold text-accent uppercase tracking-wider">Rewards</span>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary font-display">Earn Achievements</h2>
        </motion.div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { name: 'Speed Demon', desc: 'Maintain 100+ WPM with over 95% accuracy.', points: '100 XP', color: 'border-rose-500/30 bg-rose-500/[0.03] text-rose-500 hover:border-rose-500/50 hover:bg-rose-500/10 hover:shadow-rose-500/10' },
            { name: 'Consistent Pace', desc: 'Achieve a consistency score above 90%.', points: '150 XP', color: 'border-accent/30 bg-accent/[0.03] text-accent hover:border-accent/50 hover:bg-accent/10 hover:shadow-accent/10' },
            { name: 'Daily Warrior', desc: 'Keep a daily typing streak for 7 consecutive days.', points: '200 XP', color: 'border-accent-secondary/30 bg-accent-secondary/[0.03] text-accent-secondary hover:border-accent-secondary/50 hover:bg-accent-secondary/10 hover:shadow-accent-secondary/10' }
          ].map((ach, i) => (
            <motion.div 
              key={ach.name} 
              initial={{ opacity: 0, y: 16 }} 
              whileInView={{ opacity: 1, y: 0 }} 
              viewport={{ once: true }} 
              transition={{ delay: i * 0.1 }}
              className={`p-6 border rounded-2xl flex flex-col gap-4 transition-all duration-300 shadow-sm hover:-translate-y-1.5 hover:shadow-lg ${ach.color}`}
            >
              <div className="flex justify-between items-start">
                <span className="font-bold text-base tracking-tight">{ach.name}</span>
                <span className="font-mono text-xs px-2.5 py-1 border border-current/20 rounded-lg bg-surface/50 font-bold backdrop-blur-md">{ach.points}</span>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed font-medium mt-auto">{ach.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
