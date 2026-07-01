'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion, useScroll, useTransform, useSpring, useReducedMotion, AnimatePresence } from 'framer-motion';
import { Play, Trophy, Activity, Target, Flame, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

// --- Types ---
interface KeyConfig {
  code: string;
  label: string;
  unitWidth: number; // relative to 1u
  row: number;
}

interface HUDItemProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  rgbColor: string;
}

interface KeycapProps {
  label: string;
  code: string;
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
  bg: string;
}

// --- Daily Collectible Typing Cats List ---
const COLLECTIBLE_CATS: CatConfig[] = [
  { id: 1, name: 'Purrfect Speedster', quote: 'Pawsitively fast.', emoji: '🐱⚡', bg: 'bg-[#FF5C00]/10 border-[#FF5C00]/30 text-[#FF5C00]' },
  { id: 2, name: 'Keystroke Hunter', quote: 'Even I couldn\'t catch those keystrokes.', emoji: '🐈🐾', bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
  { id: 3, name: 'Typing Master Cat', quote: 'The keyboard approves.', emoji: '🦁👑', bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400' },
  { id: 4, name: 'Sonic Whiskers', quote: 'You\'re now legally faster than this cat.', emoji: '😸💨', bg: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' },
  { id: 5, name: 'Precision Claw', quote: 'Accuracy so good I stopped knocking things off.', emoji: '😼🎯', bg: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' }
];

// --- Keyboard Layout Configurations (ANSI 60% Rigid measurements) ---
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
    { code: 'BACK', label: 'delete', unitWidth: 2, row: 0 }
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
    { code: '\\', label: '\\', unitWidth: 1.5, row: 1 }
  ],
  [
    { code: 'CAPS', label: 'caps lock', unitWidth: 1.75, row: 2 },
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
    { code: '\'', label: '\'', unitWidth: 1, row: 2 },
    { code: 'ENTER', label: 'return', unitWidth: 2.25, row: 2 }
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
    { code: 'RSHIFT', label: 'shift', unitWidth: 2.75, row: 3 }
  ],
  [
    { code: 'CTRL', label: 'ctrl', unitWidth: 1.25, row: 4 },
    { code: 'OPT', label: '⌥', unitWidth: 1.25, row: 4 },
    { code: 'CMD', label: '⌘', unitWidth: 1.25, row: 4 },
    { code: 'SPACE', label: ' ', unitWidth: 6.25, row: 4 },
    { code: 'CMD', label: '⌘', unitWidth: 1.25, row: 4 },
    { code: 'OPT', label: '⌥', unitWidth: 1.25, row: 4 },
    { code: 'FN', label: 'fn', unitWidth: 1.25, row: 4 },
    { code: 'CTRL', label: 'ctrl', unitWidth: 1.25, row: 4 }
  ]
];

// --- Keycap Component (OEM sculpted profile) ---
const Keycap: React.FC<KeycapProps> = React.memo(({ label, code, isPressed, row, rgbColor, lightingMode }) => {
  const oemConfig = useMemo(() => {
    switch (row) {
      case 0: return { zHeight: 15, tilt: 8 };   // Numeric
      case 1: return { zHeight: 12, tilt: 4 };   // QWERTY
      case 2: return { zHeight: 9, tilt: 0 };    // Home Row
      case 3: return { zHeight: 11, tilt: -4 };  // Shift Row
      case 4: return { zHeight: 14, tilt: -8 };  // Modifiers / Spacebar
      default: return { zHeight: 10, tilt: 0 };
    }
  }, [row]);

  const targetZ = isPressed ? oemConfig.zHeight - 3.5 : oemConfig.zHeight;
  const isMod = label.length > 1;

  // Render switch casing borders on sides when pressed (reveals switch travel)
  return (
    <div className="w-full h-full preserve-3d relative">
      <motion.div
        animate={{
          z: targetZ,
          rotateX: oemConfig.tilt
        }}
        transition={{ type: 'spring', stiffness: 240, damping: 18 }}
        className={`w-[95%] h-[93%] mx-auto my-[3.5%] rounded-[6px] preserve-3d flex flex-col justify-start select-none cursor-pointer border transition-shadow duration-100 ${
          isPressed 
            ? 'bg-neutral-850 border-neutral-750 shadow-[inset_0_2px_4px_rgba(0,0,0,0.85)]' 
            : 'bg-gradient-to-b from-[#2E2E31] to-[#1C1C1E] border-neutral-800 shadow-[0_3px_5px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.06)] hover:brightness-105'
        }`}
      >
        {/* Subtle top edge highlight */}
        <div className="absolute inset-[1px] border border-white/2 rounded-[5px] pointer-events-none" />

        {/* Legend: Placed in the upper-left corner exactly like standard ANSI keycaps */}
        <span className={`absolute left-1.5 top-1 font-mono lowercase tracking-tighter ${
          isPressed ? 'text-accent' : 'text-neutral-400'
        } ${
          isMod ? 'text-[6px] md:text-[7.5px] font-bold text-neutral-500' : 'text-[9px] md:text-[10px] font-medium'
        }`}>
          {label}
        </span>

        {/* RGB Switch underglow */}
        {lightingMode !== 'off' && (
          <div 
            style={{ backgroundColor: rgbColor, boxShadow: `0 0 10px ${rgbColor}` }}
            className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-[40%] h-[1.5px] rounded-full opacity-65 transition-all duration-300" 
          />
        )}
      </motion.div>
    </div>
  );
});

Keycap.displayName = 'Keycap';

// --- HUD Glass Panel Component ---
const HUDPanel: React.FC<HUDItemProps> = ({ label, value, icon, position, rgbColor }) => {
  const positioning = useMemo(() => {
    switch (position) {
      case 'top-left': return 'left-[-40px] top-[10%]';
      case 'top-right': return 'right-[-40px] top-[10%]';
      case 'bottom-left': return 'left-[-50px] bottom-[15%]';
      case 'bottom-right': return 'right-[-50px] bottom-[15%]';
    }
  }, [position]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, z: 30 }}
      animate={{ opacity: 1, scale: 1, z: 80 }}
      transition={{ duration: 0.6 }}
      className={`absolute ${positioning} p-4 bg-surface/30 backdrop-blur-xl border border-border/80 rounded-2xl flex flex-col gap-1 shadow-md z-20 pointer-events-none select-none`}
    >
      <div className="flex items-center gap-1.5 text-text-secondary">
        <span style={{ color: rgbColor }} className="transition-colors duration-300">
          {icon}
        </span>
        <span className="text-[9px] font-bold tracking-widest uppercase">{label}</span>
      </div>
      <span className="text-2xl font-black font-mono text-text-primary leading-none mt-1">{value}</span>
    </motion.div>
  );
};

// --- Custom RGB Selector Component ---
interface RGBToggleProps {
  currentMode: string;
  setMode: (mode: string) => void;
  modes: Array<{ id: string; label: string; bg: string }>;
}

const RGBToggle: React.FC<RGBToggleProps> = ({ currentMode, setMode, modes }) => (
  <div className="flex items-center gap-2 p-1.5 bg-surface-accent/40 backdrop-blur-md border border-border/40 rounded-full select-none z-30">
    <span className="text-[9px] font-black uppercase tracking-wider text-text-tertiary pl-2.5">RGB Light</span>
    <div className="flex gap-1.5 pr-1">
      {modes.map((m) => (
        <button
          key={m.id}
          onClick={() => setMode(m.id)}
          title={m.label}
          className={`w-[18px] h-[18px] rounded-full border border-neutral-800 transition-all duration-200 hover:scale-110 relative ${m.bg}`}
        >
          {currentMode === m.id && (
            <span className="absolute inset-0.5 rounded-full border border-white/50 bg-white/10" />
          )}
        </button>
      ))}
    </div>
  </div>
);

// --- Complete Redeveloped Hero3D Component ---
export const Hero3D = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [pressedKeys, setPressedKeys] = useState<Record<string, boolean>>({});
  const [trails, setTrails] = useState<{ id: number; text: string; x: number; y: number }[]>([]);
  const [keyboardShaking, setKeyboardShaking] = useState({ x: 0, y: 0 });

  // Summoned collectible cat state
  const [summonedCat, setSummonedCat] = useState<CatConfig | null>(null);

  // RGB Control states
  const [rgbMode, setRgbMode] = useState('amber');
  const rgbModes = [
    { id: 'off', label: 'Off', bg: 'bg-neutral-850' },
    { id: 'white', label: 'White', bg: 'bg-white' },
    { id: 'ice', label: 'Ice Blue', bg: 'bg-cyan-400' },
    { id: 'amber', label: 'Amber', bg: 'bg-[#FF5C00]' },
    { id: 'rainbow', label: 'Rainbow', bg: 'bg-gradient-to-r from-red-500 via-green-500 to-blue-500' }
  ];

  // Resolve RGB values dynamically
  const rgbColorValue = useMemo(() => {
    switch (rgbMode) {
      case 'white': return '#F5F5F5';
      case 'ice': return '#22D3EE';
      case 'amber': return '#FF5C00';
      case 'rainbow': return '#FF007F'; // dynamic sweep cycle mapped in css
      default: return 'transparent';
    }
  }, [rgbMode]);

  // Spring camera parameters
  const springConfig = { stiffness: 50, damping: 20, mass: 1 };
  const rotateX = useSpring(0, springConfig);
  const rotateY = useSpring(0, springConfig);
  const translateX = useSpring(0, springConfig);
  const translateY = useSpring(0, springConfig);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start']
  });

  const cameraZ = useTransform(scrollYProgress, [0, 1], [0, -500]);
  const sceneOpacity = useTransform(scrollYProgress, [0, 0.45], [1, 0]);
  const sceneScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileViewport(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Dampened Camera movement bounds (X ±5°, Y ±6°)
  useEffect(() => {
    if (prefersReducedMotion || isMobileViewport) return;

    let frameId: number;
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
  }, [prefersReducedMotion, isMobileViewport, rotateX, rotateY, translateX, translateY]);

  // Gentle, heavy orbital camera bob when idle
  useEffect(() => {
    let angle = 0;
    const idleBob = setInterval(() => {
      if (Math.abs(rotateX.get()) < 1) {
        angle += 0.015;
        rotateX.set(Math.sin(angle) * 1.1);
        rotateY.set(Math.cos(angle * 0.8) * 1.3);
      }
    }, 45);
    return () => clearInterval(idleBob);
  }, [rotateX, rotateY]);

  // Automated logical human typing simulator with vibration
  useEffect(() => {
    const sequence = 'PRACTICE ON TYPROX TO MASTER EVERY KEYSTROKE COMPETE ON THE LEADERBOARDS FLOW SPEED';
    const keys = sequence.split('');
    let index = 0;

    const interval = setInterval(() => {
      const char = keys[index % keys.length];
      const up = char.toUpperCase();

      // Keyboard chassis vibration offsets on press
      setKeyboardShaking({
        x: (Math.random() - 0.5) * 1.4,
        y: (Math.random() - 0.5) * 1.4
      });
      setTimeout(() => setKeyboardShaking({ x: 0, y: 0 }), 50);

      if (char !== ' ') {
        setPressedKeys((prev) => ({ ...prev, [up]: true }));
        setTimeout(() => {
          setPressedKeys((prev) => ({ ...prev, [up]: false }));
        }, 110);

        // Small floating words
        if (Math.random() > 0.85) {
          const words = ['120 WPM', 'perfect', 'flow', '98.7% accuracy', 'streak +1'];
          const text = words[Math.floor(Math.random() * words.length)];
          setTrails((prev) => [
            ...prev,
            { id: Date.now() + Math.random(), text, x: Math.random() * 40 - 20, y: Math.random() * 6 - 3 }
          ].slice(-3));
        }
      } else {
        setPressedKeys((prev) => ({ ...prev, SPACE: true }));
        setTimeout(() => {
          setPressedKeys((prev) => ({ ...prev, SPACE: false }));
        }, 110);
      }
      index++;
    }, 250);

    return () => clearInterval(interval);
  }, []);

  // Summon a random collectible cat (Daily Typing Cat experience)
  const summonDailyCat = () => {
    const randomIndex = Math.floor(Math.random() * COLLECTIBLE_CATS.length);
    setSummonedCat(COLLECTIBLE_CATS[randomIndex]);
  };

  return (
    <motion.div
      ref={containerRef}
      style={{ opacity: sceneOpacity }}
      className="relative w-full min-h-screen flex flex-col items-center justify-center overflow-hidden bg-background py-16 px-4"
    >
      {/* ── Background Vignette & Spotlight ── */}
      <div className="absolute inset-0 bg-radial-[circle_at_center,transparent_40%,rgba(15,15,16,0.95)_100%] pointer-events-none -z-20" />
      <div className="absolute inset-0 bg-noise-overlay opacity-[0.012] pointer-events-none -z-30" />
      
      {/* Dynamic spotlight matching selected RGB Mode */}
      <div 
        style={{
          background: rgbMode !== 'off' 
            ? `radial-gradient(circle, ${rgbColorValue} 0%, transparent 70%)` 
            : 'transparent'
        }}
        className="absolute top-[40%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[70vw] h-[40vh] opacity-3 blur-[140px] pointer-events-none -z-20 transition-all duration-500" 
      />

      {/* ── Large Editorial Typography Stack ── */}
      <div className="w-full max-w-5xl mx-auto flex flex-col items-center text-center select-none relative z-10 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center gap-6"
        >
          <h1 className="text-5xl sm:text-7xl lg:text-[85px] font-black tracking-tighter text-text-primary font-display leading-[0.95]">
            Master Every Keystroke.
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary max-w-lg font-medium leading-relaxed font-sans lowercase">
            improve your typing speed and accuracy with lessons, live feedback, challenges and detailed progress tracking.
          </p>
        </motion.div>

        {/* Console CTAs and RGB Controller row (Height 40-42px) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex flex-wrap items-center justify-center gap-4 mt-8"
        >
          <Button
            href="/typing"
            className="h-10 px-5 rounded-full bg-accent text-neutral-950 font-black uppercase tracking-wider text-[11px] hover:brightness-105 active:scale-[0.98] transition-all shadow-[0_3px_10px_rgba(255,92,0,0.2)] hover:shadow-[0_4px_15px_rgba(255,92,0,0.35)] duration-200"
          >
            <Play className="w-3.5 h-3.5 fill-current mr-1" />
            <span>Start Typing</span>
          </Button>

          <Button
            href="/leaderboard"
            variant="ghost"
            className="h-10 px-5 rounded-full border border-border/80 text-text-primary bg-surface/20 backdrop-blur-md font-bold uppercase tracking-wider text-[11px] hover:bg-surface/50 active:scale-[0.98] transition-all duration-200"
          >
            <Trophy className="w-3.5 h-3.5 mr-1" />
            <span>Leaderboards</span>
          </Button>

          {/* Interactive RGB Mode Switcher */}
          <RGBToggle currentMode={rgbMode} setMode={setRgbMode} modes={rgbModes} />
        </motion.div>
      </div>

      {/* ── Main Workstation Platform (Keyboard width 900-1100px on desktop) ── */}
      <motion.div
        style={{
          rotateX,
          rotateY,
          x: translateX,
          y: translateY,
          z: cameraZ,
          scale: sceneScale
        }}
        className="w-full max-w-[1000px] mx-auto flex flex-col items-center justify-center preserve-3d z-10"
      >
        
        {/* CNC Mechanical keyboard chassis plate */}
        <div 
          style={{
            transform: `translate3d(${keyboardShaking.x}px, ${keyboardShaking.y}px, 0px)`
          }}
          className="relative w-full aspect-[16/9] flex items-center justify-center preserve-3d mt-4 transition-transform duration-75"
        >
          
          {/* Chassis Drop Shadow */}
          <div className="absolute w-[80%] h-[40%] bg-black/70 rounded-full blur-[45px] -z-20" style={{ transform: 'rotateX(82deg) translateZ(-80px)' }} />

          {/* Floating Message splines */}
          <div className="absolute inset-0 z-40 pointer-events-none preserve-3d">
            <AnimatePresence>
              {trails.map((t) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, scale: 0.85, x: `${50 + t.x}%`, y: `${50 + t.y}%`, z: 20 }}
                  animate={{ 
                    opacity: [0, 0.8, 0.8, 0],
                    scale: [0.85, 1.05, 1.05, 0.9],
                    y: [`${50 + t.y}%`, `${28 + t.y}%`, `${10 + t.y}%`],
                    z: [20, 100, 180]
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 2.5, ease: 'easeOut' }}
                  className="absolute font-mono font-bold lowercase text-xs tracking-wider text-accent drop-shadow-[0_0_8px_rgba(255,92,0,0.3)]"
                >
                  {t.text}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* CNC ALUM MECHANICAL KEYBOARD */}
          <motion.div
            initial={{ opacity: 0, y: 40, rotateX: 38, rotateZ: -8 }}
            animate={{ opacity: 1, y: 0, rotateX: 32, rotateZ: -5 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="w-full max-w-[850px] bg-[#161618] border-3 border-neutral-750 p-5 rounded-[28px] shadow-[0_30px_70px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)] preserve-3d relative z-10"
          >
            {/* Dynamic RGB ambient underglow */}
            {rgbMode !== 'off' && (
              <div 
                style={{ backgroundColor: rgbColorValue, boxShadow: `0 0 45px ${rgbColorValue}`, opacity: 0.08 }}
                className="absolute inset-0 rounded-[28px] blur-md pointer-events-none -z-10 transition-all duration-500" 
              />
            )}

            {/* Recessed Switch Plate and Screw Details */}
            <div className="absolute inset-[1px] border border-neutral-800 rounded-[26px] pointer-events-none shadow-[inset_0_5px_15px_rgba(0,0,0,0.95)]" />
            
            {/* CNC Bevel screws in the corners */}
            <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-neutral-900 border border-neutral-800" />
            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-neutral-900 border border-neutral-800" />
            <div className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-neutral-900 border border-neutral-800" />
            <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-neutral-900 border border-neutral-800" />

            {/* USB-C Port Cutout on the back plate */}
            <div className="absolute top-0 left-[20%] w-10 h-[5px] bg-neutral-950 rounded-b border border-t-0 border-neutral-800" style={{ transform: 'translateY(-100%) translateZ(4px)' }} />

            {/* ANSI 60% Rigid percentage columns layout */}
            <div className="flex flex-col gap-[3.5px] w-full preserve-3d">
              {ANSI_60_LAYOUT.map((row, rIdx) => (
                <div key={rIdx} className="flex gap-[3.5px] w-full preserve-3d">
                  {row.map((k, cIdx) => {
                    const isPressed = pressedKeys[k.code];
                    const keyWidthPercent = `${(k.unitWidth / 15) * 100}%`;
                    return (
                      <div 
                        key={`${k.code}-${rIdx}-${cIdx}`}
                        style={{ width: keyWidthPercent }}
                        className="relative aspect-square h-[30px] md:h-[42px] preserve-3d flex-shrink-0"
                      >
                        <Keycap 
                          label={k.label} 
                          code={k.code} 
                          isPressed={isPressed || false} 
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

          {/* Floating GlassmorphismHUD Panels (Accent color syncs with selected RGB Mode) */}
          <HUDPanel 
            label="Speed" 
            value="128 wpm" 
            icon={<Activity className="w-3.5 h-3.5" />} 
            position="top-left" 
            rgbColor={rgbColorValue} 
          />
          <HUDPanel 
            label="Accuracy" 
            value="98.7%" 
            icon={<Target className="w-3.5 h-3.5" />} 
            position="top-right" 
            rgbColor={rgbColorValue} 
          />
          <HUDPanel 
            label="Streak" 
            value="21 days" 
            icon={<Flame className="w-3.5 h-3.5" />} 
            position="bottom-left" 
            rgbColor={rgbColorValue} 
          />
          <HUDPanel 
            label="Standing" 
            value="#142" 
            icon={<Trophy className="w-3.5 h-3.5" />} 
            position="bottom-right" 
            rgbColor={rgbColorValue} 
          />

        </div>

        {/* ── Summon Daily Typing Cat Button ── */}
        <div className="mt-8 flex flex-col items-center select-none relative z-30 gap-4">
          <button
            onClick={summonDailyCat}
            className="px-4 py-2 border border-border/80 bg-surface/20 backdrop-blur-md hover:bg-surface/50 text-[11px] font-bold uppercase tracking-wider text-text-primary rounded-xl transition-all cursor-pointer flex items-center gap-1.5 active:scale-[0.98]"
          >
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span>Summon Daily Typing Cat</span>
          </button>

          {/* Collectible Cat Card Overlay */}
          <AnimatePresence>
            {summonedCat && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className={`p-4 border rounded-2xl flex items-center gap-4 max-w-sm shadow-md transition-all duration-300 relative ${summonedCat.bg}`}
              >
                {/* Dismiss button */}
                <button 
                  onClick={() => setSummonedCat(null)} 
                  className="absolute top-2 right-2 text-[10px] opacity-60 hover:opacity-100 font-bold font-mono px-1.5"
                >
                  ✕
                </button>
                <div className="text-3xl flex-shrink-0">{summonedCat.emoji}</div>
                <div className="flex flex-col pr-4">
                  <span className="text-xs font-black uppercase tracking-wider">{summonedCat.name}</span>
                  <span className="text-xs italic font-semibold mt-1 opacity-80 leading-relaxed font-sans">
                    &ldquo;{summonedCat.quote}&rdquo;
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </motion.div>
    </motion.div>
  );
};
