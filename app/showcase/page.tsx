'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award,
  Zap,
  Trophy,
  ArrowRight,
  Mail,
  RefreshCw,
  Play,
  Share2,
  AlertCircle,
  TrendingUp,
  Clock,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  BarChart2,
  Keyboard,
  CheckCircle,
  X
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import canvasConfetti from 'canvas-confetti';

// Target text for simulation
const TargetSentence = "the fastest way to improve speed is through consistent daily practice.";

// Types for telemetry
interface TelemetryPoint {
  t: number;
  k: string;
  y: number; // 0 = type, 1 = backspace
  i: number;
}

export default function ShowcasePage() {
  // Navigation / Tutorial state
  const [stage, setStage] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [email, setEmail] = useState('');
  const [signInSuccess, setSignInSuccess] = useState(false);
  const [signedInUser, setSignedInUser] = useState<string | null>(null);

  // Typing Arena simulation state
  const [typingState, setTypingState] = useState<'idle' | 'running' | 'completed'>('idle');
  const [userInput, setUserInput] = useState('');
  const [simulatedWpm, setSimulatedWpm] = useState(0);
  const [simulatedAccuracy, setSimulatedAccuracy] = useState(100);
  const [simulatedTimeLeft, setSimulatedTimeLeft] = useState(30);
  const [simulating, setSimulating] = useState(false);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [replayActive, setReplayActive] = useState(false);

  // Filters for mock pages
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'all_time'>('all_time');
  const [leaderboardMode, setLeaderboardMode] = useState('words');
  const [dashboardModeFilter, setDashboardModeFilter] = useState('all');

  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clean timers
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  // Guided tour narrative definitions
  const narrativeSteps = [
    {
      title: "Welcome to TyProX Showcase",
      narration: "TyProX is a high-performance, distraction-free typing platform designed for serious improvement. This interactive showcase lets you tour the website's key capabilities. Let's start with simulated authentication.",
      nextText: "Go to Sign In"
    },
    {
      title: "Simulated Sign-In Page",
      narration: "Enter your email or click Google/GitHub to simulate a login. In the live website, this triggers a secure, passwordless magic link flow using Supabase. Logging in saves your telemetry history and places you on the public leaderboards.",
      nextText: "Go to Typing Arena"
    },
    {
      title: "The Typing Arena",
      narration: "Here, users practice in an isolated, micro-second responsive interface. Click the 'Simulate Auto-Type Demo' button to watch a mock professional 130+ WPM typing run. Observe how accuracy, speed, and rhythm are monitored.",
      nextText: "Go to Results & Replay"
    },
    {
      title: "Telemetry Results & Replays",
      narration: "Once a test finishes, TyProX provides rich analytics: net WPM, accuracy, rhythm consistency, and a graph showing speed trends. Click 'Watch Replay' to see a keystroke-by-keystroke playback of your performance.",
      nextText: "Go to Leaderboard"
    },
    {
      title: "Verified Leaderboards",
      narration: "Compete with typists worldwide in different categories (words, quotes, code, punctuation). Rank tiers are calculated dynamically: Bronze to Grandmaster (140+ WPM). Scores are strictly verified.",
      nextText: "Go to Dashboard"
    },
    {
      title: "Analytics Dashboard",
      narration: "The user dashboard tracks historic growth, average speed, consistency, tests completed, and daily practice streaks. It allows custom logs filtering and lets you sync offline guest runs to your profile.",
      nextText: "Back to Home Overview"
    }
  ];

  // Confetti helper
  const triggerConfetti = () => {
    canvasConfetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.7 }
    });
  };

  // Simulated Login Actions
  const handleSimulatedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSignInSuccess(true);
    setTimeout(() => {
      setSignedInUser(email);
      setSignInSuccess(false);
      setStage(2); // Auto proceed to Typing Arena
    }, 1800);
  };

  const handleOAuthLogin = (provider: string) => {
    setSignInSuccess(true);
    setTimeout(() => {
      setSignedInUser(`${provider}_user@typrox.com`);
      setSignInSuccess(false);
      setStage(2); // Auto proceed to Typing Arena
    }, 1200);
  };

  // Auto-typing simulator
  const startAutoTypeSimulation = () => {
    if (simulating) return;
    setSimulating(true);
    setTypingState('running');
    setUserInput('');
    setSimulatedWpm(0);
    setSimulatedAccuracy(100);
    setSimulatedTimeLeft(30);

    const chars = TargetSentence.split("");
    let idx = 0;
    let currentText = "";
    const tempTelemetry: TelemetryPoint[] = [];
    const startTime = performance.now();

    const typeNext = () => {
      if (idx >= chars.length) {
        setSimulating(false);
        setTypingState('completed');
        triggerConfetti();
        return;
      }

      const elapsed = Math.round(performance.now() - startTime);

      // Simulate a typo at 's' in 'consistent' (index 44)
      if (idx === 44 && !currentText.endsWith('z')) {
        // Type incorrect character
        currentText += 'z';
        setUserInput(currentText);
        setSimulatedAccuracy(92);
        tempTelemetry.push({ t: elapsed, k: 'z', y: 0, i: idx });
        setTelemetry([...tempTelemetry]);
        // Pause before deleting
        typingTimerRef.current = setTimeout(deleteNext, 180);
      } else {
        // Normal typing
        const char = chars[idx];
        currentText += char;
        setUserInput(currentText);
        
        // Dynamic speed calculation (climbing up to 135 WPM)
        const progress = idx / chars.length;
        const currentSpeed = Math.round(75 + progress * 55 + Math.random() * 8);
        setSimulatedWpm(currentSpeed);
        
        tempTelemetry.push({ t: elapsed, k: char, y: 0, i: idx });
        setTelemetry([...tempTelemetry]);
        idx++;

        if (idx % 10 === 0) {
          setSimulatedTimeLeft(prev => Math.max(12, prev - 1));
        }

        const delay = 95 + Math.random() * 40;
        typingTimerRef.current = setTimeout(typeNext, delay);
      }
    };

    const deleteNext = () => {
      const elapsed = Math.round(performance.now() - startTime);
      currentText = currentText.slice(0, -1);
      setUserInput(currentText);
      tempTelemetry.push({ t: elapsed, k: 'Backspace', y: 1, i: idx });
      setTelemetry([...tempTelemetry]);
      
      // Correct character typing
      typingTimerRef.current = setTimeout(() => {
        const correctElapsed = Math.round(performance.now() - startTime);
        const char = chars[idx];
        currentText += char;
        setUserInput(currentText);
        setSimulatedAccuracy(100);
        tempTelemetry.push({ t: correctElapsed, k: char, y: 0, i: idx });
        setTelemetry([...tempTelemetry]);
        idx++;
        typingTimerRef.current = setTimeout(typeNext, 110);
      }, 150);
    };

    typeNext();
  };

  // Replay playback logic
  const playReplay = () => {
    if (replayActive || telemetry.length === 0) return;
    setReplayActive(true);
    setUserInput('');
    
    let step = 0;
    const playNext = () => {
      if (step >= telemetry.length) {
        setReplayActive(false);
        return;
      }

      const point = telemetry[step];
      const nextDelay = step === 0 ? 100 : telemetry[step].t - telemetry[step - 1].t;

      typingTimerRef.current = setTimeout(() => {
        if (point.y === 1) {
          setUserInput(prev => prev.slice(0, -1));
        } else {
          setUserInput(prev => prev + point.k);
        }
        step++;
        playNext();
      }, Math.min(250, nextDelay)); // Cap timing delay to keep it fast
    };

    playNext();
  };

  // Mock historic dashboard chart data
  const mockChartData = [
    { index: 1, wpm: 82 },
    { index: 2, wpm: 85 },
    { index: 3, wpm: 84 },
    { index: 4, wpm: 91 },
    { index: 5, wpm: 88 },
    { index: 6, wpm: 95 },
    { index: 7, wpm: 99 },
    { index: 8, wpm: 104 },
    { index: 9, wpm: 102 },
    { index: 10, wpm: 111 },
    { index: 11, wpm: 118 },
    { index: 12, wpm: 115 },
    { index: 13, wpm: 123 },
    { index: 14, wpm: 129 },
    { index: 15, wpm: 135 }
  ];

  const getLeaderboardEntries = () => {
    const listMap: Record<string, Array<{ name: string; wpm: number; acc: number; rank: number; tier: string }>> = {
      all_time: [
        { name: 'speed_demon', wpm: 154, acc: 99.1, rank: 1, tier: 'Grandmaster' },
        { name: 'racer_x', wpm: 147, acc: 98.4, rank: 2, tier: 'Grandmaster' },
        { name: 'key_ninja', wpm: 141, acc: 97.9, rank: 3, tier: 'Grandmaster' },
        { name: 'rudra_practice', wpm: 135, acc: 99.0, rank: 4, tier: 'Master' },
        { name: 'hyper_typer', wpm: 128, acc: 96.5, rank: 5, tier: 'Master' }
      ],
      weekly: [
        { name: 'racer_x', wpm: 146, acc: 98.2, rank: 1, tier: 'Grandmaster' },
        { name: 'rudra_practice', wpm: 135, acc: 99.0, rank: 2, tier: 'Master' },
        { name: 'speedy_sam', wpm: 124, acc: 95.8, rank: 3, tier: 'Master' },
        { name: 'key_slayer', wpm: 119, acc: 97.1, rank: 4, tier: 'Diamond' },
        { name: 'matrix_flow', wpm: 112, acc: 96.0, rank: 5, tier: 'Diamond' }
      ],
      daily: [
        { name: 'rudra_practice', wpm: 135, acc: 99.0, rank: 1, tier: 'Master' },
        { name: 'key_slayer', wpm: 121, acc: 97.4, rank: 2, tier: 'Master' },
        { name: 'zen_fingers', wpm: 118, acc: 99.5, rank: 3, tier: 'Diamond' },
        { name: 'macro_dev', wpm: 110, acc: 95.2, rank: 4, tier: 'Diamond' },
        { name: 'swift_keys', wpm: 104, acc: 96.8, rank: 5, tier: 'Diamond' }
      ]
    };
    return listMap[timeframe];
  };

  // Mock dashboard results log
  const dashboardLogs = [
    { wpm: 135, acc: 99.0, raw: 139, mode: 'words', duration: 30, date: 'Today' },
    { wpm: 129, acc: 98.5, raw: 132, mode: 'words', duration: 30, date: 'Yesterday' },
    { wpm: 123, acc: 97.1, raw: 128, mode: 'quotes', duration: 60, date: '2 days ago' },
    { wpm: 118, acc: 99.2, raw: 120, mode: 'code', duration: 15, date: '3 days ago' },
    { wpm: 115, acc: 96.0, raw: 122, mode: 'punctuation', duration: 30, date: '4 days ago' }
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden relative font-sans text-text-primary">
      {/* ── INTERACTIVE STORYTELLER SIDEBAR ── */}
      <AnimatePresence initial={false}>
        {isSidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 380, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="h-full bg-surface border-r-3 border-border flex flex-col flex-shrink-0 relative z-20 shadow-[4px_0px_10px_rgba(0,0,0,0.05)]"
          >
            {/* Sidebar Header */}
            <div className="p-5 border-b-3 border-border flex items-center justify-between bg-accent/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-accent border-2 border-border flex items-center justify-center font-mono font-black text-black">
                  T
                </div>
                <div className="flex flex-col">
                  <span className="font-sans font-black uppercase text-sm tracking-tight text-text-primary">Showcase Director</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-accent">Feature Guide</span>
                </div>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 border-2 border-border bg-surface-accent text-text-primary hover:bg-error hover:text-white transition-colors cursor-pointer"
                title="Collapse Panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Narrative Area */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-text-secondary">
                <span>STAGE {stage + 1} OF {narrativeSteps.length}</span>
                <span className="text-accent">{Math.round(((stage + 1) / narrativeSteps.length) * 100)}% COMPLETE</span>
              </div>

              {/* Progress Steps Indicators */}
              <div className="grid grid-cols-6 gap-1 border-2 border-border p-1 bg-surface-accent">
                {narrativeSteps.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setStage(i)}
                    className={`h-2.5 transition-all border border-border cursor-pointer ${
                      i <= stage ? 'bg-accent' : 'bg-background'
                    }`}
                    title={`Jump to stage ${i + 1}`}
                  />
                ))}
              </div>

              {/* Narrative Content */}
              <div className="flex flex-col gap-3.5 bg-surface-accent border-3 border-border p-5 shadow-[4px_4px_0px_0px_var(--border)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-8 h-8 bg-accent/20 border-b border-l border-border flex items-center justify-center font-bold text-xs">
                  💬
                </div>
                <h3 className="text-base font-black uppercase tracking-tight text-text-primary">
                  {narrativeSteps[stage].title}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed font-semibold">
                  {narrativeSteps[stage].narration}
                </p>
              </div>

              {/* Showcase Navigation Menu */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Direct Navigation</span>
                <div className="grid grid-cols-1 gap-1 border-2 border-border p-1.5 bg-background">
                  {[
                    "1. Welcome & Home",
                    "2. Simulated Sign In",
                    "3. Typing Arena Test",
                    "4. Telemetry Analytics",
                    "5. Public Leaderboards",
                    "6. User Dashboard"
                  ].map((label, idx) => (
                    <button
                      key={idx}
                      onClick={() => setStage(idx)}
                      className={`text-left px-3 py-2 text-xs font-bold uppercase tracking-wider border-2 transition-all cursor-pointer ${
                        stage === idx
                          ? 'bg-accent border-border text-black'
                          : 'border-transparent text-text-secondary hover:border-border/40 hover:text-text-primary'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar Controls Footer */}
            <div className="p-5 border-t-3 border-border bg-surface-accent flex items-center justify-between gap-3">
              <button
                disabled={stage === 0}
                onClick={() => setStage(prev => prev - 1)}
                className="flex-1 py-3 border-3 border-border bg-surface hover:bg-accent/10 active:translate-y-px text-xs font-bold uppercase tracking-widest disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev</span>
              </button>
              <button
                onClick={() => {
                  if (stage < narrativeSteps.length - 1) {
                    setStage(prev => prev + 1);
                  } else {
                    setStage(0);
                  }
                }}
                className="flex-2 py-3 border-3 border-border bg-accent text-black hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_var(--border)] active:translate-y-px active:shadow-none text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{narrativeSteps[stage].nextText}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Sidebar Toggle Button if Closed */}
      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="absolute left-4 top-4 z-30 p-2.5 border-3 border-border bg-accent text-black hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_var(--border)] transition-all cursor-pointer flex items-center gap-2 text-xs font-black uppercase tracking-widest"
        >
          <ChevronRight className="w-4.5 h-4.5" />
          <span>Show Guide</span>
        </button>
      )}

      {/* ── MAIN SANDBOX DISPLAY AREA ── */}
      <div className="flex-1 h-full overflow-y-auto bg-background flex flex-col relative">
        {/* Sandbox Header */}
        <header className="sticky top-0 z-10 w-full bg-surface border-b-3 border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-black px-2 py-0.5 bg-bauhaus-yellow border-2 border-border text-black uppercase tracking-widest">
              Showcase Sandbox
            </span>
            <span className="text-xs font-bold text-text-secondary uppercase hidden md:inline">
              Running locally: http://localhost:3000
            </span>
          </div>

          {/* Connected User Badge */}
          <div className="flex items-center gap-3.5">
            {signedInUser ? (
              <div className="flex items-center gap-2 border-2 border-border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1 text-xs font-bold uppercase tracking-wider">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span>Simulated Profile: {signedInUser}</span>
              </div>
            ) : (
              <span className="text-xs font-bold text-text-secondary uppercase tracking-widest">
                Guest Mode
              </span>
            )}
          </div>
        </header>

        {/* Content Stages */}
        <main className="flex-1 p-6 md:p-12 flex flex-col items-center justify-center min-h-[calc(100vh-68px)]">
          <AnimatePresence mode="wait">
            
            {/* ── STAGE 0: LANDING PAGE OVERVIEW ── */}
            {stage === 0 && (
              <motion.div
                key="stage-0"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="w-full max-w-5xl flex flex-col gap-10"
              >
                {/* Hero Section Mock */}
                <div className="text-center flex flex-col items-center gap-6">
                  <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase leading-[0.9] text-text-primary">
                    The Fastest Way <br className="hidden sm:inline" />
                    to Improve <br className="hidden sm:inline" />
                    Your Typing
                    <span className="inline-block w-2.5 h-8 md:h-12 bg-accent ml-2 animate-caret align-middle" />
                  </h1>
                  <p className="max-w-xl text-sm sm:text-base text-text-secondary font-semibold leading-relaxed">
                    Track speed, accuracy, consistency, and progress with a distraction-free typing platform built for serious improvement.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-4 mt-2">
                    <button
                      onClick={() => setStage(2)}
                      className="inline-flex items-center justify-center gap-2 px-8 py-4 font-mono text-xs font-black uppercase tracking-wider border-3 border-border bg-accent text-black hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_var(--border)] transition-all cursor-pointer"
                    >
                      <span>Start Typing</span>
                      <ArrowRight className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setStage(4)}
                      className="inline-flex items-center justify-center gap-2 px-8 py-4 font-mono text-xs font-bold uppercase tracking-wider border-3 border-border bg-surface-accent text-text-primary hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_var(--border)] transition-all cursor-pointer"
                    >
                      <span>View Leaderboard</span>
                    </button>
                  </div>
                </div>

                {/* Features Grid Mock */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
                  {[
                    { icon: <BarChart2 />, title: "Track Your Growth", color: "hover:shadow-[6px_6px_0px_0px_var(--color-bauhaus-red)] hover:bg-bauhaus-red/5" },
                    { icon: <Trophy />, title: "Climb Leaderboard", color: "hover:shadow-[6px_6px_0px_0px_var(--color-bauhaus-yellow)] hover:bg-bauhaus-yellow/5" },
                    { icon: <ShieldCheck />, title: "Build Consistency", color: "hover:shadow-[6px_6px_0px_0px_var(--text-primary)] hover:bg-text-primary/5" },
                    { icon: <Keyboard />, title: "Real-world Modes", color: "hover:shadow-[6px_6px_0px_0px_var(--accent)] hover:bg-accent/5" }
                  ].map((card, i) => (
                    <div
                      key={i}
                      className={`p-5 bg-surface border-3 border-border flex flex-col gap-4 text-left transition-all duration-200 cursor-default ${card.color}`}
                    >
                      <div className="w-10 h-10 border-2 border-border flex items-center justify-center text-text-primary">
                        {card.icon}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-black uppercase tracking-tight text-text-primary">{card.title}</span>
                        <span className="text-xs text-text-secondary leading-relaxed font-semibold mt-1">
                          Practice smarter, eliminate mistakes, and compare with verified online profiles.
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── STAGE 1: SIMULATED SIGN IN PAGE ── */}
            {stage === 1 && (
              <motion.div
                key="stage-1"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 border-3 border-border bg-surface relative shadow-[8px_8px_0px_0px_var(--border)]"
              >
                {/* Decorative Bauhaus blocks */}
                <div className="absolute -top-3 -right-3 w-6 h-6 bg-bauhaus-red border-2 border-border rounded-full" />
                <div className="absolute -bottom-3 -left-3 w-6 h-6 bg-bauhaus-yellow border-2 border-border" />

                {/* Left Column: Form */}
                <div className="p-8 border-b-3 md:border-b-0 md:border-r-3 border-border flex flex-col justify-center gap-6">
                  <div className="flex flex-col items-center gap-3 text-center border-b-2 border-border pb-4">
                    <svg className="w-9 h-9 text-text-primary" viewBox="0 0 100 100" fill="none">
                      <path d="M25 20L60 50L25 80" stroke="currentColor" strokeWidth="14" strokeLinecap="square" />
                      <path d="M75 20L40 50L75 80" stroke="var(--accent)" strokeWidth="14" strokeLinecap="square" />
                    </svg>
                    <h2 className="text-2xl font-black uppercase tracking-tight text-text-primary">Join TYPROX</h2>
                    <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">
                      Simulated Authentication Card
                    </span>
                  </div>

                  {signInSuccess && (
                    <div className="p-3 bg-emerald-500/10 border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wide flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 animate-bounce" />
                      <span>Sending simulated connection request... Welcome!</span>
                    </div>
                  )}

                  <form onSubmit={handleSimulatedSubmit} className="flex flex-col gap-4 text-left">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">
                        Email Address
                      </label>
                      <div className="relative flex items-center">
                        <Mail className="absolute left-3 w-4 h-4 text-text-secondary" />
                        <input
                          type="email"
                          placeholder="name@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          disabled={signInSuccess}
                          className="w-full pl-9 pr-4 py-3 bg-background border-2 border-border focus:border-accent text-sm font-bold transition-all focus:ring-0 outline-none text-text-primary"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={signInSuccess || !email}
                      className="w-full py-3.5 border-3 border-border bg-accent text-black hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_var(--border)] disabled:opacity-50 disabled:pointer-events-none transition-all text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Send Magic Link</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>

                  <div className="relative flex items-center justify-center py-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t-2 border-border" />
                    </div>
                    <span className="relative px-3 bg-surface text-xs font-bold text-text-secondary uppercase tracking-widest">
                      Or Connect Profile
                    </span>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={() => handleOAuthLogin('github')}
                      disabled={signInSuccess}
                      className="flex-1 py-3 border-3 border-border bg-surface-accent text-text-primary hover:bg-accent/15 transition-all text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>GitHub</span>
                    </button>
                    <button
                      onClick={() => handleOAuthLogin('google')}
                      disabled={signInSuccess}
                      className="flex-1 py-3 border-3 border-border bg-surface-accent text-text-primary hover:bg-accent/15 transition-all text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Google</span>
                    </button>
                  </div>
                </div>

                {/* Right Column: Info */}
                <div className="p-8 bg-surface-accent flex flex-col justify-between gap-6 text-left">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2 text-accent">
                      <Zap className="w-5 h-5 fill-current" />
                      <span className="text-xs font-black uppercase tracking-widest">Connect & Persist</span>
                    </div>
                    <h3 className="text-xl font-black uppercase tracking-tight">Save Your Records.</h3>
                    <p className="text-xs text-text-secondary font-semibold leading-relaxed">
                      Saving your profiles allows you to verify runs, customize key configurations, and track progress over time.
                    </p>

                    <div className="flex flex-col gap-3 text-xs font-bold uppercase tracking-wider mt-2">
                      {[
                        "Aggregated speed analytics charts",
                        "Streak tracking and badges",
                        "Submit verified results online",
                        "Custom telemetry replay generator"
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-text-primary">
                          <div className="w-4 h-4 bg-accent border border-border flex items-center justify-center text-[10px] text-white">
                            ✔
                          </div>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-background border-2 border-border flex flex-col gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary border-b border-border/20 pb-1">
                      Active Guest Score Log
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="block text-[10px] font-bold text-text-secondary">BEST SPEED</span>
                        <span className="font-mono font-black text-text-primary">128 WPM</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-text-secondary">ACCURACY</span>
                        <span className="font-mono font-black text-text-primary">99.0%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── STAGE 2: SIMULATED TYPING ARENA ── */}
            {stage === 2 && (
              <motion.div
                key="stage-2"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="w-full max-w-3xl flex flex-col gap-6"
              >
                {/* Controller Panel */}
                <div className="p-4 bg-surface border-3 border-border flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-left">
                    <h3 className="text-sm font-black uppercase tracking-tight text-text-primary">Typing sandbox</h3>
                    <p className="text-[10px] font-bold text-text-secondary uppercase">
                      Practice typing below or trigger the auto-typist
                    </p>
                  </div>
                  <button
                    onClick={startAutoTypeSimulation}
                    disabled={simulating}
                    className="px-6 py-3 border-3 border-border bg-accent text-black hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_var(--border)] disabled:opacity-60 transition-all text-xs font-black uppercase tracking-widest flex items-center gap-2 cursor-pointer"
                  >
                    <span>Simulate Auto-Type Demo</span>
                    <Play className="w-4 h-4 fill-current" />
                  </button>
                </div>

                {/* Keyboard typing viewport */}
                <div className="border-3 border-border bg-surface p-6 font-mono shadow-[6px_6px_0px_0px_var(--accent)] relative w-full text-left">
                  {/* Top Stats */}
                  <div className="flex items-center justify-between border-b-2 border-border pb-3 mb-4 text-xs uppercase font-bold text-text-secondary">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 border border-border bg-surface-accent text-accent font-black">
                        words
                      </span>
                      <span>/</span>
                      <span>30s</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                      <span>{typingState === 'running' ? 'RECORDING' : 'SANDBOX READY'}</span>
                    </div>
                  </div>

                  {/* Realtime metric boxes */}
                  <div className="grid grid-cols-3 border-3 border-border bg-surface-accent py-2 text-center mb-6">
                    <div className="border-r border-border">
                      <span className="block text-[10px] font-bold text-text-secondary uppercase">Time Left</span>
                      <span className="text-sm font-black text-accent">{simulatedTimeLeft}s</span>
                    </div>
                    <div className="border-r border-border">
                      <span className="block text-[10px] font-bold text-text-secondary uppercase">Net WPM</span>
                      <span className="text-sm font-black text-text-primary">{simulatedWpm || "--"}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-text-secondary uppercase">Accuracy</span>
                      <span className="text-sm font-black text-text-primary">
                        {userInput ? `${simulatedAccuracy}%` : "--"}
                      </span>
                    </div>
                  </div>

                  {/* Text container */}
                  <div className="relative text-sm md:text-base font-medium leading-relaxed min-h-[90px] text-text-secondary">
                    {TargetSentence.split("").map((char, i) => {
                      let charClass = "text-text-secondary opacity-70";
                      
                      if (i < userInput.length) {
                        const typedChar = userInput[i];
                        if (typedChar === char) {
                          charClass = "text-text-primary font-bold";
                        } else {
                          charClass = "text-error border-b-2 border-error font-bold";
                        }
                      }
                      
                      const isCaret = i === userInput.length;
                      
                      return (
                        <span key={i} className={`relative ${charClass}`}>
                          {isCaret && (
                            <span className="absolute -left-[1px] top-0 bottom-0 border-l-2 border-accent animate-caret h-full" />
                          )}
                          {char}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Guide overlay */}
                {typingState === 'completed' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-emerald-500/10 border-3 border-emerald-500 text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider flex items-center justify-between gap-4"
                  >
                    <span>Test completed! 135 WPM score simulated. Proceed to view results.</span>
                    <button
                      onClick={() => setStage(3)}
                      className="px-4 py-2 border-2 border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600 transition-all cursor-pointer font-black"
                    >
                      View Results
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ── STAGE 3: INTERACTIVE RESULTS & PLAYBACK ── */}
            {stage === 3 && (
              <motion.div
                key="stage-3"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="w-full max-w-4xl flex flex-col gap-6"
              >
                {/* Result Cards Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
                  <div className="p-6 bg-accent border-3 border-border flex flex-col text-background">
                    <span className="text-xs font-bold uppercase tracking-wider opacity-85">Speed</span>
                    <span className="text-4xl font-black font-mono mt-2 leading-none">135</span>
                    <span className="text-xs uppercase font-bold mt-1 opacity-80">WPM (net speed)</span>
                  </div>

                  <div className="p-6 bg-bauhaus-red border-3 border-border flex flex-col text-white">
                    <span className="text-xs font-bold uppercase tracking-wider opacity-85">Accuracy</span>
                    <span className="text-4xl font-black font-mono mt-2 leading-none">99.0%</span>
                    <span className="text-xs uppercase font-bold mt-1 opacity-80">based on correct keys</span>
                  </div>

                  <div className="p-6 bg-surface-accent border-3 border-border flex flex-col text-text-primary">
                    <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Consistency</span>
                    <span className="text-4xl font-black font-mono mt-2 leading-none">96.4%</span>
                    <span className="text-xs uppercase font-bold mt-1 text-text-secondary">keystroke deviation</span>
                  </div>

                  <div className="p-6 bg-surface-accent border-3 border-border flex flex-col text-text-primary">
                    <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Time</span>
                    <span className="text-4xl font-black font-mono mt-2 leading-none">30s</span>
                    <span className="text-xs uppercase font-bold mt-1 text-text-secondary">total test duration</span>
                  </div>
                </div>

                {/* Graph and details */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
                  <div className="lg:col-span-2 p-6 bg-surface border-3 border-border flex flex-col min-h-[280px]">
                    <div className="flex items-center gap-2 border-b-2 border-border pb-4 mb-4">
                      <TrendingUp className="w-4 h-4 text-accent" />
                      <span className="text-sm font-bold uppercase tracking-wider text-text-primary">WPM Speed Evolution</span>
                    </div>
                    <div className="flex-1 w-full h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={[
                          { second: 1, wpm: 110 },
                          { second: 5, wpm: 122 },
                          { second: 10, wpm: 130 },
                          { second: 15, wpm: 128 }, // dip during typo deletion
                          { second: 20, wpm: 132 },
                          { second: 25, wpm: 136 },
                          { second: 30, wpm: 135 }
                        ]}>
                          <CartesianGrid strokeDasharray="0" stroke="var(--border)" opacity={0.15} vertical={false} />
                          <XAxis dataKey="second" stroke="var(--text-secondary)" fontSize={11} />
                          <YAxis stroke="var(--text-secondary)" fontSize={11} domain={[80, 150]} />
                          <Tooltip
                            contentStyle={{
                              background: 'var(--surface-accent)',
                              border: '2px solid var(--border)',
                              fontSize: '12px',
                              fontWeight: 'bold'
                            }}
                          />
                          <Line type="monotone" dataKey="wpm" name="Speed" stroke="var(--accent)" strokeWidth={3} dot={true} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="p-6 bg-surface border-3 border-border flex flex-col justify-between gap-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 border-b-2 border-border pb-3">
                        <Award className="w-4 h-4 text-accent" />
                        <span className="text-sm font-bold uppercase tracking-wider text-text-primary">Telemetry</span>
                      </div>
                      <div className="flex flex-col gap-2 text-xs font-bold uppercase tracking-wider">
                        <div className="flex justify-between py-1 border-b border-border/10">
                          <span className="text-text-secondary">Raw speed</span>
                          <span className="text-text-primary">139 WPM</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/10">
                          <span className="text-text-secondary">Characters typed</span>
                          <span className="text-text-primary">68</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-text-secondary">Mistakes registered</span>
                          <span className="text-error font-mono flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            1
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-surface-accent border-2 border-border text-left">
                      <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Top Weak Keys</span>
                      <div className="flex gap-2 mt-1">
                        <div className="flex-1 text-center p-1 border border-border bg-background">
                          <kbd className="font-mono text-xs font-black text-text-primary">Z</kbd>
                          <span className="block text-[10px] font-bold text-error">1x</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Replay Overlay simulation inside card */}
                <div className="p-5 border-3 border-border bg-surface-accent flex flex-col gap-4 text-left">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Play className="w-4.5 h-4.5 text-accent" />
                      <span className="text-xs font-black uppercase tracking-wider text-text-primary">
                        Interactive Replay Sandbox
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={playReplay}
                        disabled={replayActive || telemetry.length === 0}
                        className="px-4 py-2 border-2 border-border bg-surface text-text-primary hover:bg-accent hover:text-black font-black text-xs uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Watch Replay</span>
                      </button>
                      <button
                        onClick={() => triggerConfetti()}
                        className="px-4 py-2 border-2 border-border bg-surface text-text-primary hover:bg-accent hover:text-black font-black text-xs uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Share Score</span>
                      </button>
                    </div>
                  </div>

                  {/* Replay viewer area */}
                  <div className="p-4 border-2 border-border bg-background font-mono text-xs md:text-sm h-14 flex items-center">
                    {telemetry.length === 0 ? (
                      <span className="text-text-secondary opacity-60">Go to Typing Arena and run the auto-type simulation to capture replay telemetry first!</span>
                    ) : (
                      <div className="relative text-text-primary font-bold">
                        {userInput || <span className="text-text-secondary font-medium opacity-50">Press Replay to begin...</span>}
                        {replayActive && <span className="border-l-2 border-accent animate-caret" />}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── STAGE 4: FAKE LEADERBOARD ── */}
            {stage === 4 && (
              <motion.div
                key="stage-4"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="w-full max-w-4xl flex flex-col gap-6 text-left"
              >
                {/* Header */}
                <div className="flex flex-col gap-1 border-b-3 border-border pb-3">
                  <div className="flex items-center gap-2 text-accent">
                    <Trophy className="w-6 h-6 fill-current" />
                    <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-text-primary">
                      TyProX Global Standings
                    </h2>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">
                    Verified rankings · Simulated data for showcases
                  </span>
                </div>

                {/* Filter Row */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-surface border-3 border-border">
                  {/* Timeframe */}
                  <div className="flex items-center gap-1">
                    {(['daily', 'weekly', 'all_time'] as const).map(opt => (
                      <button
                        key={opt}
                        onClick={() => setTimeframe(opt)}
                        className={`px-3 py-1.5 border-2 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                          timeframe === opt
                            ? 'bg-accent text-black border-border'
                            : 'text-text-secondary border-transparent hover:border-border hover:text-text-primary'
                        }`}
                      >
                        {opt.replace('_', ' ')}
                      </button>
                    ))}
                  </div>

                  {/* Mode Selector */}
                  <div className="flex items-center gap-1">
                    {['words', 'quotes', 'code'].map(opt => (
                      <button
                        key={opt}
                        onClick={() => setLeaderboardMode(opt)}
                        className={`px-3 py-1.5 border-2 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                          leaderboardMode === opt
                            ? 'bg-accent text-black border-border'
                            : 'text-text-secondary border-transparent hover:border-border hover:text-text-primary'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rankings Table */}
                <div className="p-6 bg-surface border-3 border-border shadow-[5px_5px_0px_0px_var(--border)]">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b-3 border-border text-[10px] uppercase font-black text-text-primary tracking-widest pb-3">
                          <th className="py-3 px-2 w-12 text-center">Rank</th>
                          <th className="py-3 px-4">Typist</th>
                          <th className="py-3 px-4">Rank Tier</th>
                          <th className="py-3 px-4 text-right">Speed</th>
                          <th className="py-3 px-4 text-right">Accuracy</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getLeaderboardEntries().map((entry, idx) => {
                          const isSpecial = entry.name === 'rudra_practice';
                          return (
                            <tr
                              key={idx}
                              className={`border-b border-border/20 text-xs md:text-sm font-bold uppercase tracking-wider text-text-primary transition-colors ${
                                isSpecial ? 'bg-accent/15 hover:bg-accent/25' : 'hover:bg-surface-accent'
                              }`}
                            >
                              <td className="py-4 px-2 text-center">
                                <span className={`inline-flex items-center justify-center w-6 h-6 border-2 border-border text-xs font-black ${
                                  entry.rank === 1 ? 'bg-bauhaus-yellow text-black' :
                                  entry.rank === 2 ? 'bg-surface-accent text-text-primary' :
                                  entry.rank === 3 ? 'bg-bauhaus-red text-white' : 'bg-background text-text-secondary'
                                }`}>
                                  {entry.rank}
                                </span>
                              </td>
                              <td className="py-4 px-4 font-bold flex items-center gap-2">
                                <div className="w-6 h-6 border border-border bg-accent/20 flex items-center justify-center text-[10px] text-accent">
                                  {entry.name[0].toUpperCase()}
                                </div>
                                <span>{entry.name}</span>
                                {isSpecial && (
                                  <span className="text-[9px] font-black uppercase bg-accent text-black px-1">
                                    YOU
                                  </span>
                                )}
                              </td>
                              <td className="py-4 px-4">
                                <span className={`px-2 py-0.5 text-[10px] uppercase tracking-widest border border-border font-black ${
                                  entry.tier === 'Grandmaster' ? 'bg-bauhaus-red text-white' :
                                  entry.tier === 'Master' ? 'bg-accent text-black' :
                                  'bg-bauhaus-yellow text-black'
                                }`}>
                                  {entry.tier}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-right font-mono font-black text-accent">
                                {entry.wpm} WPM
                              </td>
                              <td className="py-4 px-4 text-right font-mono text-text-secondary">
                                {entry.acc}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── STAGE 5: FAKE DASHBOARD ── */}
            {stage === 5 && (
              <motion.div
                key="stage-5"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="w-full max-w-4xl flex flex-col gap-6 text-left"
              >
                {/* Dashboard Header */}
                <div className="flex flex-col gap-1 border-b-3 border-border pb-3">
                  <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-text-primary">
                    Dashboard: rudra_practice
                  </h2>
                  <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">
                    Personal Performance Dashboard & Streaks
                  </span>
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="p-4 bg-accent border-3 border-border flex flex-col text-background justify-between min-h-[90px]">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-85">Top Speed</span>
                    <span className="text-xl md:text-2xl font-black font-mono mt-1">135 WPM</span>
                  </div>
                  <div className="p-4 bg-surface-accent border-3 border-border flex flex-col text-text-primary justify-between min-h-[90px]">
                    <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Avg Speed</span>
                    <span className="text-xl md:text-2xl font-black font-mono mt-1">114 WPM</span>
                  </div>
                  <div className="p-4 bg-bauhaus-red border-3 border-border flex flex-col text-white justify-between min-h-[90px]">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-85">Accuracy</span>
                    <span className="text-xl md:text-2xl font-black font-mono mt-1">97.8%</span>
                  </div>
                  <div className="p-4 bg-surface-accent border-3 border-border flex flex-col text-text-primary justify-between min-h-[90px]">
                    <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Tests completed</span>
                    <span className="text-xl md:text-2xl font-black font-mono mt-1">48</span>
                  </div>
                  <div className="col-span-2 md:col-span-1 p-4 bg-bauhaus-yellow border-3 border-border text-bauhaus-black flex flex-col justify-between min-h-[90px]">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-85">Active Streak</span>
                    <div className="flex items-center gap-1 mt-1 font-mono font-black text-lg leading-none">
                      <Zap className="w-4 h-4 fill-current animate-bounce" />
                      <span>18 Days</span>
                    </div>
                  </div>
                </div>

                {/* Progress graph and recent logs */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Graph */}
                  <div className="lg:col-span-2 p-6 bg-surface border-3 border-border flex flex-col min-h-[280px]">
                    <div className="flex items-center gap-2 border-b-2 border-border pb-4 mb-4">
                      <TrendingUp className="w-4 h-4 text-accent" />
                      <span className="text-xs font-bold uppercase tracking-wider text-text-primary">
                        Speed Growth Trend · Last 15 Tests
                      </span>
                    </div>
                    <div className="flex-1 w-full h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={mockChartData}>
                          <CartesianGrid strokeDasharray="0" stroke="var(--border)" opacity={0.15} vertical={false} />
                          <XAxis dataKey="index" stroke="var(--text-secondary)" fontSize={10} />
                          <YAxis stroke="var(--text-secondary)" fontSize={10} />
                          <Tooltip
                            contentStyle={{
                              background: 'var(--surface-accent)',
                              border: '2px solid var(--border)',
                              fontSize: '11px',
                              fontWeight: 'bold'
                            }}
                          />
                          <Line type="monotone" dataKey="wpm" name="WPM" stroke="var(--accent)" strokeWidth={3} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Achievements */}
                  <div className="p-6 bg-surface border-3 border-border flex flex-col gap-4">
                    <div className="flex items-center gap-2 border-b-2 border-border pb-3">
                      <Award className="w-4.5 h-4.5 text-accent" />
                      <span className="text-xs font-bold uppercase tracking-wider text-text-primary">
                        Unlocked Badges
                      </span>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      {[
                        { title: "Speed Demon", desc: "Exceed 120 WPM speed run" },
                        { title: "Consistency King", desc: "Achieve 96%+ consistency" },
                        { title: "Centurion", desc: "Type 50+ total practice tests" }
                      ].map((badge, idx) => (
                        <div key={idx} className="p-2 border-2 border-border bg-surface-accent flex items-start gap-2.5">
                          <div className="w-6 h-6 bg-bauhaus-yellow border border-border flex items-center justify-center text-xs">
                            🏅
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-text-primary leading-tight">{badge.title}</span>
                            <span className="text-[9px] text-text-secondary leading-normal font-semibold normal-case mt-0.5">{badge.desc}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Logs table */}
                <div className="p-6 bg-surface border-3 border-border">
                  <div className="flex items-center justify-between border-b-2 border-border pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4.5 h-4.5 text-accent" />
                      <span className="text-xs font-bold uppercase tracking-wider text-text-primary">
                        Test Activity Logs
                      </span>
                    </div>

                    <select
                      value={dashboardModeFilter}
                      onChange={(e) => setDashboardModeFilter(e.target.value)}
                      className="bg-background text-text-primary border-2 border-border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider outline-none cursor-pointer"
                    >
                      <option value="all">All Modes</option>
                      <option value="words">words</option>
                      <option value="quotes">quotes</option>
                    </select>
                  </div>

                  <div className="overflow-x-auto border-2 border-border max-h-[160px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b-2 border-border text-[9px] uppercase font-black text-text-primary tracking-widest bg-surface-accent sticky top-0 z-10">
                          <th className="py-2 px-3 bg-surface-accent">Speed</th>
                          <th className="py-2 px-3 bg-surface-accent">Accuracy</th>
                          <th className="py-2 px-3 bg-surface-accent">Raw</th>
                          <th className="py-2 px-3 bg-surface-accent">Mode</th>
                          <th className="py-2 px-3 bg-surface-accent">Duration</th>
                          <th className="py-2 px-3 text-right bg-surface-accent">Date</th>
                        </tr>
                      </thead>
                      <tbody className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                        {dashboardLogs
                          .filter(log => dashboardModeFilter === 'all' || log.mode === dashboardModeFilter)
                          .map((log, idx) => (
                            <tr key={idx} className="border-b border-border/20 hover:bg-surface-accent/40 text-text-secondary hover:text-text-primary transition-colors">
                              <td className="py-2.5 px-3 font-mono font-black text-accent">{log.wpm} WPM</td>
                              <td className="py-2.5 px-3 font-mono">{log.acc}%</td>
                              <td className="py-2.5 px-3 font-mono">{log.raw} WPM</td>
                              <td className="py-2.5 px-3">{log.mode}</td>
                              <td className="py-2.5 px-3">{log.duration}s</td>
                              <td className="py-2.5 px-3 text-right font-mono">{log.date}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
