'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function AchievementsSection() {
  return (
    <section className="py-20 px-4 md:px-6 border-b-3 border-border bg-background">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12 flex flex-col gap-3">
          <span className="text-xs font-bold text-accent uppercase tracking-widest">Rewards</span>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight uppercase text-text-primary">Earn Achievements</h2>
          <div className="w-16 h-1 bg-accent mx-auto mt-1" />
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { name: 'Speed Demon', desc: 'Maintain 100+ WPM with over 95% accuracy.', points: '100 XP', color: 'border-bauhaus-red bg-bauhaus-red/5 text-bauhaus-red' },
            { name: 'Consistent Pace', desc: 'Achieve a consistency score above 90%.', points: '150 XP', color: 'border-text-primary bg-text-primary/5 text-text-primary' },
            { name: 'Daily Warrior', desc: 'Keep a daily typing streak for 7 consecutive days.', points: '200 XP', color: 'border-bauhaus-yellow bg-bauhaus-yellow/5 text-bauhaus-yellow dark:text-bauhaus-yellow/90' }
          ].map((ach, i) => (
            <motion.div 
              key={ach.name} 
              initial={{ opacity: 0, y: 20 }} 
              whileInView={{ opacity: 1, y: 0 }} 
              viewport={{ once: true }} 
              transition={{ delay: i * 0.1 }}
              className={`p-6 border-3 border-border flex flex-col gap-3 transition-colors ${ach.color}`}
            >
              <div className="flex justify-between items-center border-b-2 border-border/10 pb-2">
                <span className="font-bold uppercase tracking-wider text-sm">{ach.name}</span>
                <span className="font-mono text-xs px-2 py-0.5 border-2 border-border bg-background">{ach.points}</span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed font-medium uppercase">{ach.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
