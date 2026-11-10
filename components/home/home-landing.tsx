'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Navbar } from '@/components/navbar';
import { Hero3D } from '@/components/home/hero-3d';
import ComparisonSection from '@/components/home/comparison';
import AnalyticsSection from '@/components/home/analytics';
import AchievementsSection from '@/components/home/achievements';
import FAQSection from '@/components/home/faq';
import { BarChart2, Trophy, ShieldCheck, Keyboard, BookOpen, Calendar, ArrowRight } from 'lucide-react';

const features = [
  {
    icon: BarChart2,
    title: 'Track Real Growth',
    description: 'Monitor Net WPM, Raw WPM, accuracy, and per-second consistency with full session replays.',
    color: 'text-accent-ink',
    bg: 'bg-accent/10',
  },
  {
    icon: Trophy,
    title: 'Verified Rankings',
    description: 'Every ranked leaderboard score is recomputed server-side from keystroke telemetry.',
    color: 'text-text-primary',
    bg: 'bg-surface-accent',
  },
  {
    icon: ShieldCheck,
    title: 'Deliberate Drills',
    description: 'Turn frequent misses in Performance Lab into targeted drills with one click.',
    color: 'text-success',
    bg: 'bg-success/10',
  },
  {
    icon: Keyboard,
    title: 'Real-World Modes',
    description: 'Train across common words, curated quotes, numbers, punctuation, and TypeScript code.',
    color: 'text-accent-ink',
    bg: 'bg-accent/10',
  },
];

const trainingPillars = [
  {
    href: '/learn',
    icon: BookOpen,
    badge: 'Duolingo-Style Progression',
    title: 'Structured Curriculum',
    description:
      'Work through 12 progressive modules across Home Row, Top Row, Shifts, Numbers, Punctuation, and Code Operators with 92% accuracy gates.',
    cta: 'Explore Lessons',
  },
  {
    href: '/daily',
    icon: Calendar,
    badge: 'Shared UTC Seed',
    title: 'Daily Challenge',
    description:
      'One deterministic daily prompt synchronized to UTC midnight. Build consistency, benchmark daily rhythm, and keep your streak alive.',
    cta: "Play Today's Run",
  },
  {
    href: '/leaderboard',
    icon: Trophy,
    badge: 'Server-Verified Brackets',
    title: 'Competitive Rankings',
    description:
      'Climb mode and duration brackets from 15s sprints to 120s endurance runs with deterministic seed reproducibility.',
    cta: 'View Leaderboards',
  },
];

export function HomeLanding() {
  return (
    <div className="flex flex-col min-h-screen bg-background overflow-x-clip">
      <Navbar />

      <main className="flex-1 flex flex-col">
        <Hero3D />

        <section id="features" className="py-20 md:py-28 px-4 md:px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center max-w-xl mx-auto mb-14 flex flex-col gap-3"
            >
              <span className="text-xs font-semibold text-accent-ink uppercase tracking-wider">Core Capabilities</span>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary font-display">
                Build Real Typing Mastery
              </h2>
              <p className="text-sm text-text-secondary leading-relaxed">
                TyProX pairs a low-latency keystroke engine with structured lessons and transparent analytics.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {features.map((feat, i) => (
                <motion.div
                  key={feat.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  className="group p-6 rounded-2xl border border-border bg-surface hover:-translate-y-1 hover:border-accent/40 transition-all duration-200 shadow-xs"
                >
                  <div className={`w-12 h-12 ${feat.bg} ${feat.color} rounded-xl flex items-center justify-center mb-5`}>
                    <feat.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-text-primary mb-2 tracking-wide">{feat.title}</h3>
                  <p className="text-xs text-text-secondary leading-relaxed">{feat.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <ComparisonSection />
        <AnalyticsSection />
        <AchievementsSection />

        {/* Practice Paths Ecosystem (replaces fabricated testimonials with live product pathways) */}
        <section className="py-20 md:py-28 px-4 md:px-6 border-t border-border bg-surface-accent/30">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center max-w-2xl mx-auto mb-14 flex flex-col gap-3"
            >
              <span className="text-xs font-semibold text-accent-ink uppercase tracking-wider">
                Training Ecosystem
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary font-display">
                Learn, Practice, Compete
              </h2>
              <p className="text-sm text-text-secondary">
                Move cleanly between structured muscle-memory lessons, daily shared prompts, and ranked sprints.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {trainingPillars.map((pillar, i) => (
                <motion.div
                  key={pillar.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="p-7 rounded-2xl border border-border bg-surface flex flex-col justify-between gap-6 shadow-sm hover:border-accent/40 transition-colors"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent-ink flex items-center justify-center">
                        <pillar.icon className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary px-2.5 py-1 rounded-full bg-surface-accent border border-border">
                        {pillar.badge}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold font-display text-text-primary">{pillar.title}</h3>
                    <p className="text-sm text-text-secondary leading-relaxed">{pillar.description}</p>
                  </div>

                  <Link
                    href={pillar.href}
                    className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent-ink hover:underline py-2 min-h-[40px]"
                  >
                    <span>{pillar.cta}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <FAQSection />
      </main>

      <footer className="mt-auto border-t border-border py-8 px-4 md:px-6 bg-background">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <svg className="w-5 h-5 text-text-primary" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M25 20L60 50L25 80" stroke="currentColor" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M75 20L40 50L75 80" stroke="var(--accent)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-display font-semibold text-text-primary text-sm">TyProX</span>
            <span className="text-text-secondary text-xs">© 2026</span>
          </div>

          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-medium text-text-secondary">
            <Link href="/typing" className="hover:text-text-primary transition-colors py-1">Practice</Link>
            <Link href="/learn" className="hover:text-text-primary transition-colors py-1">Curriculum</Link>
            <Link href="/daily" className="hover:text-text-primary transition-colors py-1">Daily Challenge</Link>
            <Link href="/leaderboard" className="hover:text-text-primary transition-colors py-1">Leaderboard</Link>
            <Link href="/dashboard" className="hover:text-text-primary transition-colors py-1">Dashboard</Link>
            <Link href="/dashboard/performance-lab" className="hover:text-text-primary transition-colors py-1">Lab</Link>
            <Link href="/profile" className="hover:text-text-primary transition-colors py-1">Preferences</Link>
            <Link href="/login" className="hover:text-text-primary transition-colors py-1">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

