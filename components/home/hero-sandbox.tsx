'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Zap, Volume2, VolumeX, Sparkles, CheckCircle2 } from 'lucide-react';
import { mechanicalSynth, SwitchType } from '@/lib/audio/mechanical-synth';

const SAMPLE_SENTENCES = [
  "the quick brown fox jumps over the lazy dog and masters every keystroke.",
  "speed and accuracy flow together when your fingers find their natural rhythm.",
  "clean code requires precise typing and unwavering focus under deadline pressure."
];

export interface HeroSandboxProps {
  onKeyType?: (key: string) => void;
  rgbColor?: string;
}

export const HeroSandbox: React.FC<HeroSandboxProps> = ({ onKeyType, rgbColor = '#FF5C00' }) => {
  const [targetText, setTargetText] = useState(SAMPLE_SENTENCES[0]);
  const [userInput, setUserInput] = useState('');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [switchType, setSwitchType] = useState<SwitchType>('thock');
  const [isCompleted, setIsCompleted] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when clicking on sandbox box
  const handleBoxClick = () => {
    inputRef.current?.focus();
  };

  const handleReset = () => {
    const nextIdx = (SAMPLE_SENTENCES.indexOf(targetText) + 1) % SAMPLE_SENTENCES.length;
    setTargetText(SAMPLE_SENTENCES[nextIdx]);
    setUserInput('');
    setStartTime(null);
    setWpm(0);
    setAccuracy(100);
    setIsCompleted(false);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (isCompleted) return;

    const now = Date.now();
    if (!startTime && val.length > 0) {
      setStartTime(now);
    }

    // Play procedural key audio
    const lastChar = val.slice(-1);
    if (val.length > userInput.length && lastChar) {
      mechanicalSynth.playKey(lastChar);
      onKeyType?.(lastChar);
    }

    setUserInput(val);

    // Calculate real WPM and accuracy
    const elapsedSecs = startTime ? Math.max(1, (now - startTime) / 1000) : 1;
    const currentWpm = Math.round((val.length / 5) / (elapsedSecs / 60));
    setWpm(isNaN(currentWpm) ? 0 : currentWpm);

    let correct = 0;
    for (let i = 0; i < val.length; i++) {
      if (val[i] === targetText[i]) correct++;
    }
    const acc = val.length > 0 ? Math.round((correct / val.length) * 100) : 100;
    setAccuracy(acc);

    if (val.length >= targetText.length) {
      setIsCompleted(true);
    }
  };

  const toggleSound = () => {
    const muted = mechanicalSynth.toggleMute();
    setIsMuted(muted);
  };

  const handleSwitchChange = (type: SwitchType) => {
    mechanicalSynth.setSwitchType(type);
    setSwitchType(type);
    mechanicalSynth.playKey('a');
  };

  return (
    <div
      onClick={handleBoxClick}
      className="w-full max-w-3xl mx-auto p-5 md:p-6 bg-surface/40 backdrop-blur-2xl border border-border/80 rounded-3xl shadow-xl hover:border-accent/40 transition-all duration-300 relative group overflow-hidden cursor-text"
    >
      {/* Background Subtle Gradient Glow */}
      <div
        style={{
          background: `radial-gradient(circle at 50% 0%, ${rgbColor}15, transparent 75%)`
        }}
        className="absolute inset-0 pointer-events-none transition-all duration-500"
      />

      {/* Hidden real input field for mobile & desktop typing captures */}
      <input
        ref={inputRef}
        type="text"
        value={userInput}
        onChange={handleInputChange}
        className="absolute opacity-0 w-0 h-0 pointer-events-none"
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />

      {/* Sandbox Header HUD Bar */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4 select-none">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-text-primary">
            Instant Hero Sandbox
          </span>
          <span className="text-[10px] text-text-tertiary hidden sm:inline-block font-mono">
            (click & type to test live)
          </span>
        </div>

        {/* Live Audio Controls & Switch Selector */}
        <div className="flex items-center gap-3">
          {/* Switch Sound Type Picker */}
          <div className="hidden md:flex items-center gap-1 bg-surface-accent/60 p-1 rounded-full border border-border/40 text-[10px] font-mono">
            {(['thock', 'clicky', 'tactile'] as SwitchType[]).map((t) => (
              <button
                key={t}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSwitchChange(t);
                }}
                className={`px-2 py-0.5 rounded-full uppercase font-bold transition-all ${
                  switchType === t
                    ? 'bg-accent text-white shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Sound Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleSound();
            }}
            title={isMuted ? 'Unmute mechanical click sounds' : 'Mute mechanical click sounds'}
            className="p-1.5 rounded-full bg-surface border border-border/80 text-text-secondary hover:text-text-primary transition-all active:scale-95"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-accent" />}
          </button>

          {/* Reset Sandbox */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleReset();
            }}
            title="Reset Sentence"
            className="p-1.5 rounded-full bg-surface border border-border/80 text-text-secondary hover:text-text-primary transition-all active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Target & User Input Character Display */}
      <div className="relative font-mono text-base md:text-lg leading-relaxed min-h-[70px] flex items-center flex-wrap gap-y-1">
        {targetText.split('').map((char, index) => {
          const userChar = userInput[index];
          let statusClass = 'text-text-tertiary/70';

          if (userChar !== undefined) {
            statusClass = userChar === char ? 'text-accent font-bold drop-shadow-[0_0_8px_rgba(255,92,0,0.4)]' : 'text-error font-bold bg-error/20 rounded px-0.5';
          }

          const isCursor = index === userInput.length;

          return (
            <span key={index} className={`relative ${statusClass}`}>
              {isCursor && (
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className="absolute left-0 bottom-0 top-0 w-[2px] bg-accent rounded-full shadow-[0_0_8px_#FF5C00]"
                />
              )}
              {char === ' ' ? '\u00A0' : char}
            </span>
          );
        })}
      </div>

      {/* Sandbox Stats Bar Footnote */}
      <div className="flex items-center justify-between pt-4 mt-2 border-t border-border/60 font-mono text-xs select-none">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-accent" />
            <span className="text-text-secondary">Speed:</span>
            <span className="font-bold text-text-primary text-sm">{wpm} WPM</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-text-secondary">Acc:</span>
            <span className="font-bold text-accent-secondary text-sm">{accuracy}%</span>
          </div>
        </div>

        {isCompleted ? (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-1.5 text-success font-bold text-xs"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Finished! Great speed.</span>
          </motion.div>
        ) : (
          <div className="text-[11px] text-text-tertiary flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-accent" />
            <span>Type above to start test</span>
          </div>
        )}
      </div>
    </div>
  );
};
