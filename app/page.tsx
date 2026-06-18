'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Navbar } from '@/components/navbar';
import { Zap, ShieldCheck, Play, ArrowRight, BarChart2, Trophy, Keyboard } from 'lucide-react';

const TargetSentence = "the fastest way to improve speed is through consistent daily practice.";

function LiveProductPreview() {
  const [typedText, setTypedText] = useState("");
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    
    const target = TargetSentence;
    let currentTyped = "";
    
    const steps: Array<() => void> = [];

    // Programmatically generate typing timeline with mistake/correction steps
    for (let i = 0; i < target.length; i++) {
      const char = target[i];
      
      // Simulate a typo at 's' in 'consistent' (index 44) by typing 'z'
      if (i === 44) {
        steps.push(() => {
          currentTyped += "z";
          setTypedText(currentTyped);
          setAccuracy(95);
          setWpm(Math.round(85 + Math.random() * 10));
        });
        steps.push(() => {}); // Pause frame
        steps.push(() => {
          currentTyped = currentTyped.slice(0, -1);
          setTypedText(currentTyped);
        });
        steps.push(() => {
          currentTyped += char;
          setTypedText(currentTyped);
          setAccuracy(100);
          setWpm(Math.round(92 + Math.random() * 8));
        });
      } else {
        steps.push(() => {
          currentTyped += char;
          setTypedText(currentTyped);
          const progress = i / target.length;
          const targetWpm = Math.round(75 + progress * 35 + Math.random() * 8);
          setWpm(targetWpm);
          if (i % 10 === 0) {
            setTimeLeft(prev => Math.max(15, prev - 1));
          }
        });
      }
    }
    
    // Final completion frame
    steps.push(() => {});

    let currentStep = 0;
    
    function runNext() {
      if (!active) return;
      if (currentStep >= steps.length) {
        timer = setTimeout(() => {
          currentTyped = "";
          currentStep = 0;
          setTypedText("");
          setWpm(0);
          setAccuracy(100);
          setTimeLeft(30);
          runNext();
        }, 2500);
        return;
      }
      
      steps[currentStep]();
      currentStep++;
      
      const baseDelay = 110;
      const jitter = Math.random() * 60 - 30;
      let delay = baseDelay + jitter;
      
      if (currentStep === 45 || currentStep === 46) {
        delay = 240; // pause for typing error and backspace correction
      }
      
      timer = setTimeout(runNext, delay);
    }

    runNext();

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="border-3 border-border bg-surface p-6 font-mono shadow-[6px_6px_0px_0px_rgba(253,216,53,1)] relative w-full text-left">
      {/* Configuration row */}
      <div className="flex items-center justify-between border-b-2 border-border pb-3 mb-4 text-[10px] uppercase font-bold text-text-secondary select-none">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 border border-border bg-surface-accent text-accent font-black">words</span>
          <span className="opacity-40">/</span>
          <span>30s</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-[9px]">LIVE PREVIEW</span>
        </div>
      </div>

      {/* Live Stats display */}
      <div className="grid grid-cols-3 border-2 border-border bg-surface-accent py-2.5 text-center mb-4 select-none">
        <div className="border-r border-border">
          <span className="block text-[8px] font-bold text-text-secondary uppercase">Time</span>
          <span className="text-sm font-black text-accent">{timeLeft}s</span>
        </div>
        <div className="border-r border-border">
          <span className="block text-[8px] font-bold text-text-secondary uppercase">WPM</span>
          <span className="text-sm font-black text-text-primary">{wpm || "--"}</span>
        </div>
        <div>
          <span className="block text-[8px] font-bold text-text-secondary uppercase">Accuracy</span>
          <span className="text-sm font-black text-text-primary">{typedText ? `${accuracy}%` : "--"}</span>
        </div>
      </div>

      {/* Typing viewport */}
      <div className="relative text-sm font-medium leading-relaxed select-none min-h-[90px]">
        {TargetSentence.split("").map((char, i) => {
          let charClass = "text-text-secondary opacity-45";
          
          if (i < typedText.length) {
            const typedChar = typedText[i];
            if (typedChar === char) {
              charClass = "text-text-primary font-bold";
            } else {
              charClass = "text-error border-b-2 border-error font-bold";
            }
          }
          
          const isCaret = i === typedText.length;
          
          return (
            <span key={i} className={`relative ${charClass}`}>
              {isCaret && (
                <span className="absolute -left-[1px] top-0 bottom-0 border-l-2 border-accent animate-caret h-full" />
              )}
              {char}
            </span>
          );
        })}
        {typedText.length === TargetSentence.length && (
          <span className="absolute border-l-2 border-accent animate-caret" style={{ marginLeft: "1px" }}>&nbsp;</span>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [liveStats, setLiveStats] = useState({ wpm: 112, acc: 98.6, tests: 142592 });

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveStats(prev => ({
        wpm: Math.round(108 + Math.random() * 8),
        acc: parseFloat((97.8 + Math.random() * 2).toFixed(1)),
        tests: prev.tests + (Math.random() > 0.75 ? 1 : 0)
      }));
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: { y: 16, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring' as const, stiffness: 320, damping: 26 },
    },
  };

  return (
    <div className="flex flex-col min-h-screen bg-background select-none">
      <Navbar />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden py-20 lg:py-32 px-4 md:px-6 flex flex-col justify-center border-b-3 border-border bg-background">
        
        {/* Subtle grid pattern background with slow animated drift */}
        <motion.div 
          animate={{ x: [0, -10, 0], y: [0, -5, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-[0.1] dark:opacity-[0.15]"
        >
          <svg className="absolute inset-x-0 -inset-y-5 w-full h-[110%] stroke-border [mask-image:radial-gradient(100%_100%_at_top_center,white,transparent)]" aria-hidden="true">
            <defs>
              <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse" x="50%">
                <path d="M.5 40V.5H40" fill="none" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-pattern)" />
          </svg>
        </motion.div>

        <div className="max-w-7xl mx-auto w-full z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Headline and CTAs */}
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="lg:col-span-7 flex flex-col items-start gap-8"
          >
            {/* Title */}
            <motion.h1
              variants={itemVariants}
              className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter uppercase leading-[0.9] text-text-primary text-left"
            >
              The Fastest Way <br className="hidden sm:inline" />
              to Improve <br className="hidden sm:inline" />
              Your Typing
              <span className="inline-block w-2.5 h-10 md:h-12 bg-accent ml-2 animate-caret align-middle" />
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              variants={itemVariants}
              className="max-w-xl text-base sm:text-lg text-text-secondary font-semibold leading-relaxed text-left"
            >
              Track speed, accuracy, consistency, and progress with a distraction-free typing platform built for serious improvement.
            </motion.p>

            {/* Live Counters */}
            <motion.div 
              variants={itemVariants}
              className="grid grid-cols-3 gap-4 border-2 border-border p-4 bg-surface max-w-md w-full font-mono select-none"
            >
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-bold text-text-secondary uppercase">Live WPM</span>
                <span className="text-xl font-black text-accent mt-1 font-mono" suppressHydrationWarning>{liveStats.wpm}</span>
              </div>
              <div className="flex flex-col text-left border-l-2 border-border pl-4">
                <span className="text-[10px] font-bold text-text-secondary uppercase">Accuracy</span>
                <span className="text-xl font-black text-text-primary mt-1 font-mono" suppressHydrationWarning>{liveStats.acc}%</span>
              </div>
              <div className="flex flex-col text-left border-l-2 border-border pl-4">
                <span className="text-[10px] font-bold text-text-secondary uppercase">Tests Run</span>
                <span className="text-xl font-black text-text-primary mt-1 font-mono" suppressHydrationWarning>
                  {liveStats.tests.toLocaleString('en-US')}
                </span>
              </div>
            </motion.div>

            {/* CTAs */}
            <motion.div variants={itemVariants} className="flex flex-wrap gap-4 justify-start">
              <Link
                href="/typing"
                className="flex items-center gap-3 px-8 py-4 bg-accent text-white font-bold uppercase tracking-wider border-3 border-border hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:bg-error transition-all cursor-pointer"
              >
                <span>Start Typing</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/leaderboard"
                className="flex items-center gap-3 px-8 py-4 bg-surface-accent text-text-primary font-bold uppercase tracking-wider border-3 border-border hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:bg-accent hover:text-white transition-all cursor-pointer"
              >
                <span>View Leaderboard</span>
              </Link>
            </motion.div>
          </motion.div>

          {/* Right Column: Live Product Preview Showcase */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="lg:col-span-5 flex flex-col gap-2 w-full max-w-lg mx-auto"
          >
            <div className="flex items-center justify-between px-1 text-[10px] font-bold uppercase tracking-widest text-text-secondary select-none">
              <span>LIVE PREVIEW</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                <span>Online</span>
              </div>
            </div>
            
            <LiveProductPreview />

            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mt-1 text-center select-none leading-relaxed">
              See how TyProX tracks speed, accuracy, and consistency in real time.
            </span>
          </motion.div>
        </div>
      </section>

      {/* ── Feature Cards ── */}
      <section id="features" className="py-24 px-4 md:px-6 border-b-3 border-border bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16 flex flex-col gap-3">
            <span className="text-xs font-bold text-accent uppercase tracking-widest">Features</span>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight uppercase text-text-primary">Build Real Typing Mastery</h2>
            <div className="w-16 h-2 bg-accent mx-auto mt-1" />
            <p className="text-sm md:text-base text-text-secondary font-semibold leading-relaxed mt-1">
              TyProX is designed to give you the exact tools you need to track speed, analyze consistency, and rank up.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1 */}
            <div className="p-6 bg-background border-3 border-border flex flex-col gap-4 hover:bg-bauhaus-red/5 hover:shadow-[4px_4px_0px_0px_rgba(229,57,53,0.3)] transition-all">
              <div className="w-10 h-10 bg-bauhaus-red border-2 border-border flex items-center justify-center text-white flex-shrink-0">
                <BarChart2 className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-1.5 text-left">
                <h3 className="text-base font-bold uppercase tracking-tight text-text-primary">Track Your Growth</h3>
                <p className="text-xs text-text-secondary leading-relaxed font-semibold">See your speed, accuracy, and consistency improve over time with detailed historical charts.</p>
              </div>
            </div>

            {/* Card 2 */}
            <div className="p-6 bg-background border-3 border-border flex flex-col gap-4 hover:bg-bauhaus-yellow/5 hover:shadow-[4px_4px_0px_0px_rgba(253,216,53,0.3)] transition-all">
              <div className="w-10 h-10 bg-bauhaus-yellow border-2 border-border flex items-center justify-center text-text-primary flex-shrink-0">
                <Trophy className="w-5 h-5 fill-current" />
              </div>
              <div className="flex flex-col gap-1.5 text-left">
                <h3 className="text-base font-bold uppercase tracking-tight text-text-primary">Climb the Leaderboard</h3>
                <p className="text-xs text-text-secondary leading-relaxed font-semibold">Compete against typists from around the world. Every rank is earned, and every score is verified.</p>
              </div>
            </div>

            {/* Card 3 */}
            <div className="p-6 bg-background border-3 border-border flex flex-col gap-4 hover:bg-bauhaus-blue/5 hover:shadow-[4px_4px_0px_0px_rgba(30,136,229,0.3)] transition-all">
              <div className="w-10 h-10 bg-bauhaus-blue border-2 border-border flex items-center justify-center text-white flex-shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-1.5 text-left">
                <h3 className="text-base font-bold uppercase tracking-tight text-text-primary">Build Consistency</h3>
                <p className="text-xs text-text-secondary leading-relaxed font-semibold">Practice smarter and eliminate common mistakes. View accuracy telemetry to perfect your rhythm.</p>
              </div>
            </div>

            {/* Card 4 */}
            <div className="p-6 bg-background border-3 border-border flex flex-col gap-4 hover:bg-accent/5 hover:shadow-[4px_4px_0px_0px_rgba(var(--accent),0.3)] hover:shadow-accent/30 transition-all">
              <div className="w-10 h-10 bg-accent border-2 border-border flex items-center justify-center text-white flex-shrink-0">
                <Keyboard className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-1.5 text-left">
                <h3 className="text-base font-bold uppercase tracking-tight text-text-primary">Master Real-World Typing</h3>
                <p className="text-xs text-text-secondary leading-relaxed font-semibold">Train with words, quotes, code, and punctuation. Prepare yourself for real-world programming and writing.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Comparison Section ── */}
      <section className="py-20 px-4 md:px-6 border-b-3 border-border bg-surface-accent">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 flex flex-col gap-3">
            <span className="text-xs font-bold text-accent uppercase tracking-widest">Why TyProX</span>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight uppercase text-text-primary">How We Compare</h2>
            <div className="w-16 h-1 bg-accent mx-auto mt-1" />
          </div>
          <div className="overflow-x-auto border-3 border-border bg-background">
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
          </div>
        </div>
      </section>

      {/* ── Analytics Preview ── */}
      <section className="py-24 px-4 md:px-6 border-b-3 border-border bg-surface-accent">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          <div className="flex flex-col gap-6">
            <span className="text-xs font-bold text-accent uppercase tracking-widest">Analytics & Progress</span>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight uppercase text-text-primary leading-none">Deep Metric Visibility</h2>
            <div className="w-16 h-2 bg-accent mt-1" />
            <p className="text-sm md:text-base text-text-secondary font-semibold leading-relaxed mt-1">
              Your dashboard shows more than a single speed number. Track where your speed comes from and what keeps you back.
            </p>

            <ul className="flex flex-col gap-3 text-xs md:text-sm font-bold uppercase tracking-wider mt-2 text-left">
              {[
                'Track your second-by-second speed improvements',
                'Identify weak keys from your personal error history',
                'Measure your consistency and typing rhythm',
                'Build daily streaks and visual typing habits',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-accent border-2 border-border flex items-center justify-center text-[9px] text-white flex-shrink-0">✔</div>
                  <span className="text-text-primary">{item}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/dashboard"
              className="self-start flex items-center gap-2 px-6 py-3 bg-surface text-text-primary font-bold uppercase tracking-wider border-3 border-border hover:bg-accent hover:text-white transition-all text-xs mt-2"
            >
              <BarChart2 className="w-4 h-4" />
              <span>Open Dashboard</span>
            </Link>
          </div>

          {/* Bauhaus chart mockup */}
          <div className="p-6 bg-background border-3 border-border flex flex-col gap-4 max-w-lg mx-auto w-full font-mono relative">
            <div className="absolute -top-3 -right-3 w-6 h-6 bg-bauhaus-red border-2 border-border" />
            <div className="flex items-center justify-between border-b-2 border-border pb-2">
              <span className="text-xs font-bold text-text-primary uppercase tracking-wider">WPM — Last 7 Runs</span>
              <span className="w-3 h-3 bg-accent border border-border" />
            </div>

            <div className="h-44 bg-surface-accent border-2 border-border flex items-end justify-between p-4 gap-2 relative overflow-hidden">
              <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 pointer-events-none opacity-10">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="border-r border-b border-text-primary" />)}
              </div>
              {[10, 16, 24, 20, 28, 36].map((h, i) => (
                <div
                  key={i}
                  className="w-full border-t border-x border-border z-10"
                  style={{ height: `${h * 4}px`, background: `rgba(30, 136, 229, ${0.2 + i * 0.12})` }}
                />
              ))}
              <div className="w-full bg-accent h-36 border-2 border-border z-10 flex items-center justify-center text-[10px] text-white font-bold">96</div>
            </div>

            <div className="flex justify-between text-[10px] text-text-secondary font-bold uppercase tracking-wider">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Featured Achievements ── */}
      <section className="py-20 px-4 md:px-6 border-b-3 border-border bg-background">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 flex flex-col gap-3">
            <span className="text-xs font-bold text-accent uppercase tracking-widest">Rewards</span>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight uppercase text-text-primary">Earn Achievements</h2>
            <div className="w-16 h-1 bg-accent mx-auto mt-1" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: 'Speed Demon', desc: 'Maintain 100+ WPM with over 95% accuracy.', points: '100 XP', color: 'border-bauhaus-red bg-bauhaus-red/5 text-bauhaus-red' },
              { name: 'Consistent Pace', desc: 'Achieve a consistency score above 90%.', points: '150 XP', color: 'border-bauhaus-blue bg-bauhaus-blue/5 text-bauhaus-blue' },
              { name: 'Daily Warrior', desc: 'Keep a daily typing streak for 7 consecutive days.', points: '200 XP', color: 'border-bauhaus-yellow bg-bauhaus-yellow/5 text-bauhaus-yellow dark:text-bauhaus-yellow/90' }
            ].map((ach) => (
              <div key={ach.name} className={`p-6 border-3 border-border flex flex-col gap-3 transition-colors ${ach.color}`}>
                <div className="flex justify-between items-center border-b-2 border-border/10 pb-2">
                  <span className="font-bold uppercase tracking-wider text-sm">{ach.name}</span>
                  <span className="font-mono text-xs px-2 py-0.5 border-2 border-border bg-background">{ach.points}</span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed font-medium uppercase">{ach.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-24 px-4 md:px-6 border-b-3 border-border bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16 flex flex-col gap-3">
            <span className="text-xs font-bold text-accent uppercase tracking-widest">Community</span>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight uppercase text-text-primary">From the Typists</h2>
            <div className="w-16 h-2 bg-accent mx-auto mt-1" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-3 border-border max-w-4xl mx-auto">
            <div className="p-8 bg-background border-r-3 border-border flex flex-col justify-between gap-6 relative">
              <div className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-bauhaus-blue border-2 border-border" />
              <p className="text-base text-text-primary italic font-semibold leading-relaxed">
                "The zero-lag input is immediately noticeable coming from other platforms. There's no stutter when I'm at full speed — it just keeps up."
              </p>
              <div className="flex flex-col border-t-2 border-border pt-4">
                <span className="text-sm font-bold uppercase tracking-wider text-text-primary">Alex M.</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">Software Engineer · 142 WPM avg.</span>
              </div>
            </div>

            <div className="p-8 bg-background flex flex-col justify-between gap-6 relative">
              <div className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-bauhaus-yellow border-2 border-border flex items-center justify-center text-xs text-text-primary font-bold">★</div>
              <p className="text-base text-text-primary italic font-semibold leading-relaxed">
                "The replay feature is the one thing I didn't know I needed. Watching my rhythm collapse mid-test showed me exactly what to practice."
              </p>
              <div className="flex flex-col border-t-2 border-border pt-4">
                <span className="text-sm font-bold uppercase tracking-wider text-text-primary">Sarah C.</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">Data Analyst · 118 WPM avg.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-24 px-4 md:px-6 border-b-3 border-border bg-surface-accent">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16 flex flex-col gap-3">
            <span className="text-xs font-bold text-accent uppercase tracking-widest">FAQ</span>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight uppercase text-text-primary">Common Questions</h2>
            <div className="w-16 h-2 bg-accent mx-auto mt-1" />
          </div>

          <div className="flex flex-col gap-0 border-3 border-border">
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
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="mt-auto border-t-3 border-border py-10 px-4 md:px-6 bg-background text-xs font-bold uppercase tracking-wider text-text-secondary">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0 text-text-primary" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M25 20L60 50L25 80" stroke="currentColor" strokeWidth="14" strokeLinecap="square" strokeLinejoin="miter" />
              <path d="M75 20L40 50L75 80" stroke="var(--accent)" strokeWidth="14" strokeLinecap="square" strokeLinejoin="miter" />
            </svg>
            <span className="font-sans font-bold text-text-primary text-base tracking-tighter">TyProX</span>
            <span className="text-text-secondary">© 2026</span>
          </div>

          <div className="flex gap-8">
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
