'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Navbar } from '@/components/navbar';
import { BarChart2, Trophy, ShieldCheck, Keyboard, User } from 'lucide-react';
import dynamic from 'next/dynamic';

const ComparisonSection = dynamic(() => import('@/components/home/comparison'), { ssr: true });
const AnalyticsSection = dynamic(() => import('@/components/home/analytics'), { ssr: true });
const AchievementsSection = dynamic(() => import('@/components/home/achievements'), { ssr: true });
const FAQSection = dynamic(() => import('@/components/home/faq'), { ssr: true });
import { Hero3D } from '@/components/home/hero-3d';
import { LiveStatsBar } from '@/components/home/live-stats-bar';



const features = [
  {
    icon: BarChart2,
    title: 'Track Your Growth',
    description: 'See your speed, accuracy, and consistency improve over time with detailed historical charts.',
    color: 'text-accent',
    bg: 'bg-accent/8',
  },
  {
    icon: Trophy,
    title: 'Climb the Leaderboard',
    description: 'Compete against typists worldwide. Every rank is earned, every score is verified.',
    color: 'text-accent-secondary',
    bg: 'bg-accent-secondary/8',
  },
  {
    icon: ShieldCheck,
    title: 'Build Consistency',
    description: 'Eliminate common mistakes. View accuracy telemetry to perfect your rhythm.',
    color: 'text-success',
    bg: 'bg-success/8',
  },
  {
    icon: Keyboard,
    title: 'Master Real-World Typing',
    description: 'Train with words, quotes, code, and punctuation for real-world programming and writing.',
    color: 'text-error',
    bg: 'bg-error/8',
  },
];

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />

      <Hero3D />

      <LiveStatsBar />

      {/* ── Feature Cards ── */}
      <section id="features" className="py-20 md:py-28 px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-xl mx-auto mb-14 flex flex-col gap-3"
          >
            <span className="text-xs font-semibold text-accent uppercase tracking-wider">Core Capabilities</span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary font-display">Build Real Typing Mastery</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              TyProX gives you the tools to track speed, analyze consistency, and rank up.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="group p-6 rounded-3xl border border-border/60 bg-surface/30 backdrop-blur-md hover:-translate-y-1 hover:shadow-glow hover:border-accent/40 transition-all duration-300 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className={`w-12 h-12 ${feat.bg} ${feat.color} rounded-xl flex items-center justify-center mb-5 relative z-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]`}>
                  <feat.icon className="w-6 h-6 drop-shadow-md" />
                </div>
                <h3 className="text-sm font-bold text-text-primary mb-2 relative z-10 tracking-wide">{feat.title}</h3>
                <p className="text-xs text-text-secondary leading-relaxed relative z-10">{feat.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Lazy Loaded Sections */}
      <ComparisonSection />
      <AnalyticsSection />
      <AchievementsSection />

      {/* ── Testimonials ── */}
      <section className="py-20 md:py-28 px-4 md:px-6 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-xl mx-auto mb-14 flex flex-col gap-3"
          >
            <span className="text-xs font-semibold text-accent uppercase tracking-wider">Community</span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary font-display">From the Typists</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                quote: "The zero-lag input is immediately noticeable coming from other platforms. There's no stutter when I'm at full speed — it just keeps up. The dashboard insights completely changed how I practice.",
                name: "Alex M.",
                role: "Software Engineer",
                improvement: "90 → 142 WPM",
              },
              {
                quote: "The replay feature is the one thing I didn't know I needed. Watching my rhythm collapse mid-test showed me exactly what to practice. I've gained 30 WPM in just two months.",
                name: "Sarah C.",
                role: "Data Analyst",
                improvement: "88 → 118 WPM",
              },
            ].map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-8 rounded-3xl border border-border/60 bg-surface/30 backdrop-blur-md flex flex-col justify-between gap-6 shadow-sm relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-[50px] rounded-full pointer-events-none" />
                <p className="text-base text-text-primary leading-relaxed italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3 pt-4 border-t border-border/60">
                  <div className="w-10 h-10 rounded-full bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-text-primary">{t.name}</span>
                    <span className="text-xs text-text-tertiary">{t.role}</span>
                  </div>
                  <div className="ml-auto text-right">
                    <span className="text-xs text-text-tertiary block">Improvement</span>
                    <span className="text-sm font-bold text-success font-mono">{t.improvement}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <FAQSection />

      {/* ── Footer ── */}
      <footer className="mt-auto border-t border-border py-8 px-4 md:px-6 bg-background">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <svg className="w-5 h-5 text-text-primary" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M25 20L60 50L25 80" stroke="currentColor" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M75 20L40 50L75 80" stroke="var(--accent)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-display font-semibold text-text-primary text-sm">TyProX</span>
            <span className="text-text-tertiary text-xs">© 2026</span>
          </div>

          <div className="flex gap-6 text-xs font-medium text-text-secondary">
            <Link href="/typing" className="hover:text-text-primary transition-colors">Practice</Link>
            <Link href="/leaderboard" className="hover:text-text-primary transition-colors">Leaderboard</Link>
            <Link href="/dashboard" className="hover:text-text-primary transition-colors">Dashboard</Link>
            <Link href="/login" className="hover:text-text-primary transition-colors">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
