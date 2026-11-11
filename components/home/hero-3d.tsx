'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion, useScroll, useTransform, useSpring, useReducedMotion, AnimatePresence } from 'framer-motion';
import { Play, Trophy, Layers, ShieldCheck, BookOpen, Calendar, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface KeyConfig {
  code: string;
  label: string;
  unitWidth: number;
  row: number;
}

interface HUDItemProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  accentColor: string;
  isRainbow?: boolean;
}

interface KeycapProps {
  label: string;
  isPressed: boolean;
  row: number;
  rgbColor: string;
  lightingMode: string;
}

interface CatConfig {
  id: number;
  name: string;
  quote: string;
  emoji: string;
  cardClass: string;
}

const COLLECTIBLE_CATS: CatConfig[] = [
  {
    id: 1,
    name: 'Purrfect Speedster',
    quote: 'Smooth rhythm beats brute force on every keystroke.',
    emoji: '🐱',
    cardClass: 'bg-accent/10 border-accent/35 text-accent-ink',
  },
  {
    id: 2,
    name: 'Keystroke Hunter',
    quote: 'Watch your slowest bigrams disappear one drill at a time.',
    emoji: '🐈',
    cardClass: 'bg-success/10 border-success/35 text-success',
  },
  {
    id: 3,
    name: 'Precision Claw',
    quote: 'Accuracy above 96% unlocks clean muscle memory.',
    emoji: '😼',
    cardClass: 'bg-surface border-border text-text-primary',
  },
];

const ANSI_60_LAYOUT: KeyConfig[][] = [
  [
    { code: 'ESC', label: 'esc', unitWidth: 1, row: 0 },
    { code: '1', label: '1', unitWidth: 1, row: 0 },
    { code: '2', label: '2', unitWidth: 1, row: 0 },
    { code: '3', label: '3', unitWidth: 1, row: 0 },
    { code: '4', label: '4', unitWidth: 1, row: 0 },
    { code: '5', label: '5', unitWidth: 1, row: 0 },
    { code: '6', label: '6', unitWidth: 1, row: 0 },
    { code: '7', label: '7', unitWidth: 1, row: 0 },
    { code: '8', label: '8', unitWidth: 1, row: 0 },
    { code: '9', label: '9', unitWidth: 1, row: 0 },
    { code: '0', label: '0', unitWidth: 1, row: 0 },
    { code: '-', label: '-', unitWidth: 1, row: 0 },
    { code: '=', label: '=', unitWidth: 1, row: 0 },
    { code: 'BACK', label: 'del', unitWidth: 2, row: 0 },
  ],
  [
    { code: 'TAB', label: 'tab', unitWidth: 1.5, row: 1 },
    { code: 'Q', label: 'q', unitWidth: 1, row: 1 },
    { code: 'W', label: 'w', unitWidth: 1, row: 1 },
    { code: 'E', label: 'e', unitWidth: 1, row: 1 },
    { code: 'R', label: 'r', unitWidth: 1, row: 1 },
    { code: 'T', label: 't', unitWidth: 1, row: 1 },
    { code: 'Y', label: 'y', unitWidth: 1, row: 1 },
    { code: 'U', label: 'u', unitWidth: 1, row: 1 },
    { code: 'I', label: 'i', unitWidth: 1, row: 1 },
    { code: 'O', label: 'o', unitWidth: 1, row: 1 },
    { code: 'P', label: 'p', unitWidth: 1, row: 1 },
    { code: '[', label: '[', unitWidth: 1, row: 1 },
    { code: ']', label: ']', unitWidth: 1, row: 1 },
    { code: '\\', label: '\\', unitWidth: 1.5, row: 1 },
  ],
  [
    { code: 'CAPS', label: 'caps', unitWidth: 1.75, row: 2 },
    { code: 'A', label: 'a', unitWidth: 1, row: 2 },
    { code: 'S', label: 's', unitWidth: 1, row: 2 },
    { code: 'D', label: 'd', unitWidth: 1, row: 2 },
    { code: 'F', label: 'f', unitWidth: 1, row: 2 },
    { code: 'G', label: 'g', unitWidth: 1, row: 2 },
    { code: 'H', label: 'h', unitWidth: 1, row: 2 },
    { code: 'J', label: 'j', unitWidth: 1, row: 2 },
    { code: 'K', label: 'k', unitWidth: 1, row: 2 },
    { code: 'L', label: 'l', unitWidth: 1, row: 2 },
    { code: ';', label: ';', unitWidth: 1, row: 2 },
    { code: "'", label: "'", unitWidth: 1, row: 2 },
    { code: 'ENTER', label: 'return', unitWidth: 2.25, row: 2 },
  ],
  [
    { code: 'LSHIFT', label: 'shift', unitWidth: 2.25, row: 3 },
    { code: 'Z', label: 'z', unitWidth: 1, row: 3 },
    { code: 'X', label: 'x', unitWidth: 1, row: 3 },
    { code: 'C', label: 'c', unitWidth: 1, row: 3 },
    { code: 'V', label: 'v', unitWidth: 1, row: 3 },
    { code: 'B', label: 'b', unitWidth: 1, row: 3 },
    { code: 'N', label: 'n', unitWidth: 1, row: 3 },
    { code: 'M', label: 'm', unitWidth: 1, row: 3 },
    { code: ',', label: ',', unitWidth: 1, row: 3 },
    { code: '.', label: '.', unitWidth: 1, row: 3 },
    { code: '/', label: '/', unitWidth: 1, row: 3 },
    { code: 'RSHIFT', label: 'shift', unitWidth: 2.75, row: 3 },
  ],
  [
    { code: 'CTRL', label: 'ctrl', unitWidth: 1.25, row: 4 },
    { code: 'OPT', label: 'opt', unitWidth: 1.25, row: 4 },
    { code: 'CMD', label: 'cmd', unitWidth: 1.25, row: 4 },
    { code: 'SPACE', label: ' ', unitWidth: 6.25, row: 4 },
    { code: 'CMD', label: 'cmd', unitWidth: 1.25, row: 4 },
    { code: 'OPT', label: 'opt', unitWidth: 1.25, row: 4 },
    { code: 'FN', label: 'fn', unitWidth: 1.25, row: 4 },
    { code: 'CTRL', label: 'ctrl', unitWidth: 1.25, row: 4 },
  ],
];

const Keycap: React.FC<KeycapProps> = React.memo(({ label, isPressed, row, rgbColor, lightingMode }) => {
  const oemConfig = useMemo(() => {
    switch (row) {
      case 0:
        return { zHeight: 15, tilt: 8 };
      case 1:
        return { zHeight: 12, tilt: 4 };
      case 2:
        return { zHeight: 9, tilt: 0 };
      case 3:
        return { zHeight: 11, tilt: -4 };
      case 4:
        return { zHeight: 14, tilt: -8 };
      default:
        return { zHeight: 10, tilt: 0 };
    }
  }, [row]);

  const targetZ = isPressed ? oemConfig.zHeight - 3.5 : oemConfig.zHeight;
  const isMod = label.length > 1;

  return (
    <div className="w-full h-full preserve-3d relative">
      <motion.div
        animate={{
          z: targetZ,
          rotateX: oemConfig.tilt,
        }}
        transition={{ type: 'spring', stiffness: 240, damping: 18 }}
        className={`w-full h-full rounded-[6px] preserve-3d flex flex-col justify-start select-none border transition-shadow duration-100 ${
          isPressed
            ? 'bg-[#121214] border-[#3F3F46] shadow-[inset_0_2px_4px_rgba(0,0,0,0.85)]'
            : 'bg-gradient-to-b from-[#2E2E31] to-[#1C1C1E] border-[#27272A] shadow-[0_3px_5px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]'
        }`}
      >
        <div className="absolute inset-[1px] border border-white/[0.04] rounded-[5px] pointer-events-none" />

        <span
          className={`absolute left-1 sm:left-1.5 top-1 font-mono lowercase tracking-tighter leading-none ${
            isPressed ? 'text-[#FF641F]' : isMod ? 'text-[#71717A]' : 'text-[#A1A1AA]'
          } ${isMod ? 'text-[6px] md:text-[7.5px] font-bold' : 'text-[8px] sm:text-[9px] md:text-[10px] font-medium'}`}
        >
          {label}
        </span>

        {lightingMode !== 'off' && (
          <div
            style={{ backgroundColor: rgbColor, boxShadow: `0 0 10px ${rgbColor}` }}
            className={`absolute bottom-1 sm:bottom-1.5 left-1/2 -translate-x-1/2 w-[42%] h-[1.5px] rounded-full opacity-75 transition-all duration-300 ${
              lightingMode === 'rainbow' ? 'animate-hue-cycle' : ''
            }`}
          />
        )}
      </motion.div>
    </div>
  );
});

Keycap.displayName = 'Keycap';

const HUDPanel: React.FC<HUDItemProps> = ({ label, value, icon, accentColor, isRainbow }) => (
  <div className="p-3.5 bg-surface/90 backdrop-blur-xl border border-border rounded-2xl flex flex-col gap-1 shadow-sm select-none h-full">
    <div className="flex items-center gap-1.5 text-text-secondary">
      <span
        style={{ color: accentColor }}
        className={`transition-colors duration-300 ${isRainbow ? 'animate-hue-cycle' : ''}`}
      >
        {icon}
      </span>
      <span className="text-[10px] font-bold tracking-widest uppercase">{label}</span>
    </div>
    <span className="text-base font-bold font-mono text-text-primary leading-tight mt-0.5">{value}</span>
  </div>
);

interface RGBToggleProps {
  currentMode: string;
  setMode: (mode: string) => void;
  modes: Array<{ id: string; label: string; bg: string }>;
}

const RGBToggle: React.FC<RGBToggleProps> = ({ currentMode, setMode, modes }) => (
  <div className="flex items-center gap-2 px-3 py-2 min-h-[44px] bg-surface border border-border rounded-full select-none z-30 shadow-xs">
    <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">RGB</span>
    <div className="flex items-center gap-1.5">
      {modes.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => setMode(m.id)}
          title={m.label}
          aria-label={`Set keyboard lighting to ${m.label}`}
          aria-pressed={currentMode === m.id}
          className={`w-6 h-6 rounded-full border border-border transition-transform duration-150 hover:scale-110 relative cursor-pointer ${m.bg}`}
        >
          {currentMode === m.id && (
            <span className="absolute -inset-0.5 rounded-full ring-2 ring-accent ring-offset-1 ring-offset-surface" />
          )}
        </button>
      ))}
    </div>
  </div>
);

export const Hero3D = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isInViewport, setIsInViewport] = useState(true);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [pressedKeys, setPressedKeys] = useState<Record<string, boolean>>({});
  const [trails, setTrails] = useState<Array<{ id: number; text: string; x: number; y: number }>>([]);
  const [keyboardShaking, setKeyboardShaking] = useState({ x: 0, y: 0 });
  const [summonedCat, setSummonedCat] = useState<CatConfig | null>(null);
  const [rgbMode, setRgbMode] = useState('amber');

  const rgbModes = [
    { id: 'off', label: 'Off', bg: 'bg-[#1C1C1E]' },
    { id: 'white', label: 'White', bg: 'bg-[#F5F5F3]' },
    { id: 'ice', label: 'Ice Blue', bg: 'bg-cyan-400' },
    { id: 'amber', label: 'Amber', bg: 'bg-[#FF641F]' },
    { id: 'rainbow', label: 'Spectrum', bg: 'bg-gradient-to-r from-orange-500 via-emerald-400 to-cyan-400' },
  ];

  const rgbTone = useMemo(() => {
    switch (rgbMode) {
      case 'white':
        return { hex: '#F5F5F3', rgb: '245, 245, 243' };
      case 'ice':
        return { hex: '#22D3EE', rgb: '34, 211, 238' };
      case 'amber':
        return { hex: '#FF641F', rgb: '255, 100, 31' };
      case 'rainbow':
        return { hex: '#FF641F', rgb: '255, 100, 31' };
      default:
        return { hex: 'transparent', rgb: '0, 0, 0' };
    }
  }, [rgbMode]);
  const rgbColorValue = rgbTone.hex;

  const springConfig = { stiffness: 50, damping: 20, mass: 1 };
  const rotateX = useSpring(0, springConfig);
  const rotateY = useSpring(0, springConfig);
  const translateX = useSpring(0, springConfig);
  const translateY = useSpring(0, springConfig);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  const cameraZ = useTransform(scrollYProgress, [0, 1], [0, -400]);
  const sceneOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0]);
  const sceneScale = useTransform(scrollYProgress, [0, 1], [1, 1.1]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileViewport(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Gate idle intervals when scrolled off-screen or tab is backgrounded
  useEffect(() => {
    const onVisibility = () => {
      setIsTabVisible(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', onVisibility);

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined' && containerRef.current) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]) {
            setIsInViewport(entries[0].isIntersecting);
          }
        },
        { threshold: 0.05 }
      );
      observer.observe(containerRef.current);
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (observer) observer.disconnect();
    };
  }, []);

  // Mouse-driven camera parallax (desktop only)
  useEffect(() => {
    if (prefersReducedMotion || isMobileViewport || !isInViewport) return;

    let frameId = 0;
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const { left, top, width, height } = containerRef.current.getBoundingClientRect();
      const center = { x: left + width / 2, y: top + height / 2 };
      const x = (e.clientX - center.x) / (width / 2);
      const y = (e.clientY - center.y) / (height / 2);

      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        rotateX.set(y * -5);
        rotateY.set(x * 6);
        translateX.set(x * -8);
        translateY.set(y * -6);
      });
    };

    const handleMouseLeave = () => {
      rotateX.set(0);
      rotateY.set(0);
      translateX.set(0);
      translateY.set(0);
    };

    const target = containerRef.current;
    if (target) {
      window.addEventListener('mousemove', handleMouseMove);
      target.addEventListener('mouseleave', handleMouseLeave);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (target) target.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(frameId);
    };
  }, [prefersReducedMotion, isMobileViewport, isInViewport, rotateX, rotateY, translateX, translateY]);

  // Idle camera orbital bob (gated cleanly by visibility + reduced motion)
  useEffect(() => {
    if (prefersReducedMotion || !isInViewport || !isTabVisible) return;

    let angle = 0;
    const idleBob = setInterval(() => {
      if (Math.abs(rotateX.get()) < 1) {
        angle += 0.015;
        rotateX.set(Math.sin(angle) * 1.1);
        rotateY.set(Math.cos(angle * 0.8) * 1.3);
      }
    }, 55);

    return () => clearInterval(idleBob);
  }, [prefersReducedMotion, isInViewport, isTabVisible, rotateX, rotateY]);

  // Simulated keystroke demo on chassis (gated by visibility + reduced motion)
  useEffect(() => {
    if (prefersReducedMotion || !isInViewport || !isTabVisible) {
      return;
    }

    const sequence = 'EVERY KEYSTROKE MAKES YOU BETTER PRACTICE ON TYPROX';
    const keys = sequence.split('');
    let index = 0;
    const pendingTimeouts: ReturnType<typeof setTimeout>[] = [];

    const interval = setInterval(() => {
      const char = keys[index % keys.length];
      const up = char.toUpperCase();

      setKeyboardShaking({
        x: (Math.random() - 0.5) * 1.1,
        y: (Math.random() - 0.5) * 1.1,
      });
      pendingTimeouts.push(setTimeout(() => setKeyboardShaking({ x: 0, y: 0 }), 50));

      const targetCode = char === ' ' ? 'SPACE' : up;
      setPressedKeys((prev) => ({ ...prev, [targetCode]: true }));
      pendingTimeouts.push(
        setTimeout(() => {
          setPressedKeys((prev) => ({ ...prev, [targetCode]: false }));
        }, 110)
      );

      if (char !== ' ' && Math.random() > 0.86) {
        const focusWords = ['rhythm', 'precision', 'focus', 'clean', 'flow'];
        const text = focusWords[Math.floor(Math.random() * focusWords.length)];
        setTrails((prev) => [
          ...prev.slice(-2),
          { id: Date.now() + Math.random(), text, x: Math.random() * 34 - 17, y: Math.random() * 6 - 3 },
        ]);
      }

      index += 1;
    }, 240);

    return () => {
      clearInterval(interval);
      pendingTimeouts.forEach(clearTimeout);
    };
  }, [prefersReducedMotion, isInViewport, isTabVisible]);

  const summonDailyCat = () => {
    const randomIndex = Math.floor(Math.random() * COLLECTIBLE_CATS.length);
    setSummonedCat(COLLECTIBLE_CATS[randomIndex]);
  };

  const capabilityCards = [
    {
      label: 'Modes',
      value: 'Words · Code',
      icon: <Layers className="w-3.5 h-3.5" />,
    },
    {
      label: 'Integrity',
      value: 'Replay Guard',
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
    },
    {
      label: 'Curriculum',
      value: '12 Lessons',
      icon: <BookOpen className="w-3.5 h-3.5" />,
    },
    {
      label: 'Daily UTC',
      value: 'Seeded Arena',
      icon: <Calendar className="w-3.5 h-3.5" />,
    },
  ];

  const resolvedHudIconColor = rgbMode === 'off' ? 'var(--accent-ink)' : rgbColorValue;

  return (
    <motion.section
      ref={containerRef}
      style={{ opacity: sceneOpacity }}
      className="relative isolate w-full min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center overflow-hidden bg-background py-6 md:py-10 px-4"
    >
      <div className="hidden dark:block absolute inset-0 bg-radial-[circle_at_center,transparent_40%,rgba(11,11,12,0.9)_100%] pointer-events-none -z-20" />

      {/* Editorial Headline & Action Bar */}
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center text-center select-none relative z-20 mb-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="flex flex-col items-center gap-3.5"
        >
          <span className="text-xs font-bold uppercase tracking-widest text-accent-ink px-3 py-1 rounded-full bg-accent/10 border border-accent/25">
            Every keystroke makes you better
          </span>
          <h1 className="text-4xl sm:text-6xl lg:text-[74px] font-black tracking-tighter text-text-primary font-display leading-[0.98]">
            Master Every Keystroke.
          </h1>
          <p className="text-sm sm:text-base text-text-secondary max-w-xl font-medium leading-relaxed font-sans">
            Deliberate typing curriculum, keystroke weakness drills, daily challenges, and replay-verified leaderboards.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="flex flex-wrap items-center justify-center gap-3 mt-5"
        >
          <Button
            href="/typing"
            className="h-11 px-6 rounded-full bg-accent text-accent-foreground font-black uppercase tracking-wider text-xs hover:brightness-105 active:scale-[0.98] transition-all shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-current mr-1" />
            <span>Start Typing</span>
          </Button>

          <Button
            href="/learn"
            variant="secondary"
            className="h-11 px-5 rounded-full text-xs font-bold uppercase tracking-wider"
          >
            <BookOpen className="w-3.5 h-3.5 mr-1" />
            <span>Curriculum</span>
          </Button>

          <Button
            href="/leaderboard"
            variant="ghost"
            className="h-11 px-5 rounded-full border border-border text-text-primary bg-surface/60 font-bold uppercase tracking-wider text-xs hover:bg-surface"
          >
            <Trophy className="w-3.5 h-3.5 mr-1" />
            <span>Leaderboards</span>
          </Button>

          <RGBToggle currentMode={rgbMode} setMode={setRgbMode} modes={rgbModes} />
        </motion.div>
      </div>

      {/* Interactive 3D Keyboard Stage */}
      <motion.div
        style={{
          scale: sceneScale,
        }}
        className="w-full max-w-[1000px] mx-auto flex flex-col items-center justify-center z-10 lg:px-12"
      >
        <div className="relative w-full flex items-center justify-center">
          {/* Keep hue-rotate on outer wrapper so CSS filter doesn't strip inner blur */}
          {rgbMode !== 'off' && (
            <div
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(94vw,1060px)] h-[320px] sm:h-[460px] md:h-[520px] pointer-events-none -z-10 ${
                rgbMode === 'rainbow' ? 'animate-hue-cycle' : ''
              }`}
            >
              <div
                style={{
                  background: `radial-gradient(ellipse closest-side at center, rgba(${rgbTone.rgb}, 0.85) 0%, rgba(${rgbTone.rgb}, 0.4) 28%, rgba(${rgbTone.rgb}, 0.12) 52%, rgba(${rgbTone.rgb}, 0) 74%)`,
                }}
                className="w-full h-full blur-[40px] sm:blur-[52px] opacity-12 dark:opacity-25 transition-all duration-500"
              />
            </div>
          )}

          <div
            style={{
              perspective: '1200px',
              transform: `translate3d(${keyboardShaking.x}px, ${keyboardShaking.y}px, 0px)`,
            }}
            className="relative w-full flex items-center justify-center mt-1 py-3 md:py-5 transition-transform duration-75 isolate"
          >
            <div
              className="hidden sm:block absolute bottom-2 w-[72%] h-[28%] bg-black/25 dark:bg-black/55 rounded-full blur-[36px] pointer-events-none"
            />

            <div className="absolute inset-0 z-40 pointer-events-none overflow-hidden">
              <AnimatePresence>
                {trails.map((t) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, scale: 0.85, left: `${50 + t.x}%`, top: `${50 + t.y}%` }}
                    animate={{
                      opacity: [0, 0.85, 0.85, 0],
                      scale: [0.85, 1.04, 1.04, 0.92],
                      top: [`${50 + t.y}%`, `${28 + t.y}%`, `${10 + t.y}%`],
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 2.2, ease: 'easeOut' }}
                    className="absolute font-mono font-bold lowercase text-xs tracking-wider text-accent-ink"
                  >
                    {t.text}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Anodized Mechanical Keyboard Chassis */}
            <motion.div
              style={{
                rotateX,
                rotateY,
                x: translateX,
                y: translateY,
                z: cameraZ,
              }}
              className="w-full max-w-[820px] preserve-3d"
            >
              <motion.div
                data-testid="hero-3d-chassis"
                initial={{ opacity: 0, y: 24, rotateX: prefersReducedMotion ? 0 : 18, rotateZ: prefersReducedMotion ? 0 : -2 }}
                animate={{ opacity: 1, y: 0, rotateX: prefersReducedMotion ? 0 : 14, rotateZ: prefersReducedMotion ? 0 : -1.5 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                className="w-full bg-[#161618] border-2 border-[#2C2C30] p-3 sm:p-5 rounded-[22px] sm:rounded-[28px] shadow-[0_24px_60px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] preserve-3d relative z-10"
              >
              {rgbMode !== 'off' && (
                <div
                  className={`absolute inset-0 pointer-events-none -z-10 ${
                    rgbMode === 'rainbow' ? 'animate-hue-cycle' : ''
                  }`}
                >
                  <div
                    style={{
                      backgroundColor: rgbColorValue,
                      boxShadow: `0 0 36px 2px ${rgbColorValue}, 0 0 72px 8px rgba(${rgbTone.rgb}, 0.45)`,
                    }}
                    className="w-full h-full rounded-[28px] blur-xl opacity-[0.07] dark:opacity-[0.09] transition-all duration-500"
                  />
                </div>
              )}

              <div className="flex flex-col gap-[3px] sm:gap-[4px] w-full preserve-3d">
                {ANSI_60_LAYOUT.map((row, rIdx) => (
                  <div key={rIdx} className="flex gap-[3px] sm:gap-[4px] w-full preserve-3d">
                    {row.map((k, cIdx) => {
                      const isPressed = Boolean(pressedKeys[k.code]);
                      return (
                        <div
                          key={`${k.code}-${rIdx}-${cIdx}`}
                          style={{ flexGrow: k.unitWidth, flexBasis: 0 }}
                          className="relative min-w-0 h-[24px] sm:h-[34px] md:h-[42px] preserve-3d"
                        >
                          <Keycap
                            label={k.label}
                            isPressed={isPressed}
                            row={k.row}
                            rgbColor={rgbColorValue}
                            lightingMode={rgbMode}
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Non-overlapping Capability Telemetry Strip docked cleanly beneath 3D keyboard */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full max-w-[820px] mt-4 relative z-20">
          {capabilityCards.map((card) => (
            <div key={card.label} data-testid="hero-hud-card">
              <HUDPanel
                label={card.label}
                value={card.value}
                icon={card.icon}
                accentColor={resolvedHudIconColor}
                isRainbow={rgbMode === 'rainbow'}
              />
            </div>
          ))}
        </div>

        {/* Interactive Focus Cat Companion */}
        <div className="mt-6 flex flex-col items-center select-none relative z-30 gap-4">
          <button
            type="button"
            onClick={summonDailyCat}
            className="px-4 py-2.5 min-h-[44px] border border-border bg-surface hover:bg-surface-accent text-xs font-bold uppercase tracking-wider text-text-primary rounded-xl transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-accent-ink" />
            <span>Summon Focus Companion</span>
          </button>

          <AnimatePresence>
            {summonedCat && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.96 }}
                className={`p-4 border rounded-2xl flex items-center gap-4 max-w-sm shadow-md transition-colors relative ${summonedCat.cardClass}`}
              >
                <button
                  type="button"
                  onClick={() => setSummonedCat(null)}
                  aria-label="Dismiss focus companion"
                  className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-md text-xs opacity-70 hover:opacity-100 font-bold cursor-pointer"
                >
                  ✕
                </button>
                <div className="text-3xl flex-shrink-0">{summonedCat.emoji}</div>
                <div className="flex flex-col pr-6 text-left">
                  <span className="text-xs font-black uppercase tracking-wider">{summonedCat.name}</span>
                  <span className="text-xs italic font-medium mt-1 opacity-90 leading-relaxed font-sans">
                    &ldquo;{summonedCat.quote}&rdquo;
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.section>
  );
};
