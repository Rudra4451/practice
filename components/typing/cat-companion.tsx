'use client';

import React, { useState, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Flame } from 'lucide-react';

export interface CatCompanionProps {
  wpm: number;
  accuracy: number;
  errorCount: number;
  streakDays?: number;
}

interface CatInfo {
  id: string;
  name: string;
  type:
    | 'orange'
    | 'void'
    | 'white'
    | 'grey'
    | 'blue'
    | 'purple'
    | 'golden'
    | 'hacker'
    | 'samurai'
    | 'space'
    | 'cyber'
    | 'pirate'
    | 'ninja'
    | 'detective'
    | 'chef';
  color: string;
  accent: string;
  dialogues: {
    perfect: string;
    fast: string;
    pb: string;
    slow: string;
    mistakes: string;
    default: string;
  };
  desc: string;
  accessory?: 'headphones' | 'hoodie' | 'golden-auras' | 'none';
}

const DEFAULT_UNLOCKED_IDS = ['orange', 'void', 'white'];
const DEFAULT_UNLOCKED_JSON = JSON.stringify(DEFAULT_UNLOCKED_IDS);
const UNLOCKED_STORAGE_KEY = 'typrox_cats_unlocked';
const SELECTED_STORAGE_KEY = 'typrox_cats_selected';
const STORAGE_CHANGE_EVENT = 'typrox-cat-storage-change';

const SHORT_QUOTES = [
  'Your fingers are finding flow.',
  'Clean rhythm beats frantic recovery.',
  'Accuracy builds lasting speed.',
  'Steady timing across every key.',
  'Focus on the next two words.',
  'Every keystroke sharpens recall.',
  'Ready for another run?',
];

const CATS_DATABASE: CatInfo[] = [
  {
    id: 'orange',
    name: 'Silly Cheddar',
    type: 'orange',
    color: '#FF9F43',
    accent: '#FF5C00',
    desc: 'Silly, playful orange cat. Thinks mainly about food and typing lasagna recipes.',
    dialogues: {
      perfect: '100%? That deserves a whole virtual tuna slice!',
      fast: 'Speedy! Almost as fast as me running from the bath!',
      pb: 'New high score? Time to do a victory slide on the carpet!',
      slow: 'Yawn... typing speed matches my nap pace.',
      mistakes: 'Whoops! Did a mouse run across your keyboard?',
      default: 'Keep typing! The lasagna is baking.',
    },
  },
  {
    id: 'void',
    name: 'Void Shadow',
    type: 'void',
    color: '#1E1E24',
    accent: '#7F8C8D',
    desc: 'Mysterious void cat. Speaks in calm sarcasm and minimal aura.',
    dialogues: {
      perfect: 'Flawless. A glitch in the matrix, surely.',
      fast: 'You type fast for a biological lifeform.',
      pb: 'Impressive. The darkness approves.',
      slow: 'Are we typing or experiencing time dilation?',
      mistakes: 'Chaos. Let us try to hit the actual keys next time.',
      default: 'I stare into the keyboard. It stares back.',
    },
  },
  {
    id: 'white',
    name: 'Kind Marshmallow',
    type: 'white',
    color: '#F5F6FA',
    accent: '#9C88FF',
    desc: 'Warm and kind fluffy white cat. Gives pure encouragement and sweet smiles.',
    dialogues: {
      perfect: 'You did absolutely perfect! I am so proud of you!',
      fast: 'Wow, your fingers flew like angels! Incredible!',
      pb: 'A new record! You are doing so amazing, keep it up!',
      slow: 'Every keystroke is progress! You are doing great.',
      mistakes: 'It is okay to make mistakes! Let us try again together.',
      default: 'I believe in you! Let us take it one key at a time.',
    },
  },
  {
    id: 'grey',
    name: 'Coach Sergeant',
    type: 'grey',
    color: '#7F8C8D',
    accent: '#2C3E50',
    desc: 'Strict Grey Coach. Analytical, performance-focused, and keeps you disciplined.',
    dialogues: {
      perfect: 'Perfect execution. Form was ideal. Dismissed.',
      fast: 'High tempo. Maintain this posture for maximum efficiency.',
      pb: 'Progress registered. Do not get complacent, typist.',
      slow: 'Unacceptable cadence. Focus on consistent rhythm.',
      mistakes: 'Uncontrolled errors. Lock accuracy before pushing pace.',
      default: 'Consistency is built keystroke by keystroke.',
    },
  },
  {
    id: 'blue',
    name: 'Speedy Turbo',
    type: 'blue',
    color: '#00D2D3',
    accent: '#54A0FF',
    desc: 'Fast gaming enthusiast. Competitive and driven by crisp splits.',
    dialogues: {
      perfect: 'Perfect combo! That accuracy run was super clean!',
      fast: '120+ WPM! Locked in and flying across rows.',
      pb: 'A new personal best! Great split.',
      slow: 'Warm-up run complete. Ready to push pace.',
      mistakes: 'Rough patch in the middle. Drill those weak bigrams.',
      default: 'Type fast, stay steady.',
    },
  },
  {
    id: 'purple',
    name: 'Mystic Nebula',
    type: 'purple',
    color: '#9B59B6',
    accent: '#8E44AD',
    desc: 'Space-themed companion focused on rhythmic concentration.',
    dialogues: {
      perfect: 'Clean cadence from start to finish.',
      fast: 'Warp speed achieved without breaking form.',
      pb: 'New benchmark aligned cleanly.',
      slow: 'Steady orbit. Focus on smooth transitions.',
      mistakes: 'Pause briefly and reset finger home row.',
      default: 'Calm focus flows through every keystroke.',
    },
  },
  {
    id: 'golden',
    name: 'Ultra Lucky Neko',
    type: 'golden',
    color: '#F1C40F',
    accent: '#F39C12',
    desc: 'Unlocked by achieving a 100% accuracy run.',
    dialogues: {
      perfect: 'A flawless 100% run. Precision rewarded.',
      fast: 'High-speed velocity with clean form.',
      pb: 'New personal best benchmark saved.',
      slow: 'Taking time for zero mistakes pays off.',
      mistakes: 'Every mistake reveals an easy gain on your next set.',
      default: 'Precision compounds over time.',
    },
  },
  {
    id: 'hacker',
    name: 'Netrunner Cyber',
    type: 'hacker',
    color: '#10AC84',
    accent: '#1DD1A1',
    desc: 'Terminal specialist unlocked during high-volume typing runs.',
    dialogues: {
      perfect: 'Root precision verified. Key sequence clean.',
      fast: 'High throughput sustained across the passage.',
      pb: 'Personal record checkpoint written cleanly.',
      slow: 'Steady packet rate. Keep cadence smooth.',
      mistakes: 'Check your high-error keys in the weakness breakdown.',
      default: 'Listening cleanly to every keystroke event.',
    },
  },
  {
    id: 'samurai',
    name: 'Shogun Ronin',
    type: 'samurai',
    color: '#EE5253',
    accent: '#FF6B6B',
    desc: 'Disciplined Samurai Cat focused on single-pass accuracy.',
    dialogues: {
      perfect: 'One clean pass without wasted motion.',
      fast: 'Rapid cadence without hesitation.',
      pb: 'Disciplined practice forged a new best.',
      slow: 'Controlled form comes first; speed follows.',
      mistakes: 'Tighten precision on your recurring trouble keys.',
      default: 'Precision first, velocity second.',
    },
  },
  {
    id: 'space',
    name: 'Cosmo Astro',
    type: 'space',
    color: '#54A0FF',
    accent: '#2E86DE',
    desc: 'Floating Space Cat tracking long endurance runs.',
    dialogues: {
      perfect: 'Zero deviation recorded across the session.',
      fast: 'High escape velocity achieved cleanly.',
      pb: 'New altitude reached in speed.',
      slow: 'Slow orbit builds endurance.',
      mistakes: 'Re-center both index fingers on F and J.',
      default: 'One small keystroke at a time.',
    },
  },
  {
    id: 'cyber',
    name: 'Mecha Cyberpunk',
    type: 'cyber',
    color: '#00D2D3',
    accent: '#01A3A4',
    desc: 'Unlocked by clearing 120+ WPM in a verified session.',
    dialogues: {
      perfect: 'Calibration complete: zero defects.',
      fast: '120+ WPM benchmark cleared cleanly.',
      pb: 'Firmware benchmark updated with new record.',
      slow: 'Low power warm-up run.',
      mistakes: 'Latency spikes spotted on uncorrected tokens.',
      default: 'Mechanical switch rhythm initialized.',
    },
  },
  {
    id: 'pirate',
    name: 'Captain Hook',
    type: 'pirate',
    color: '#FF9F43',
    accent: '#EE5253',
    desc: 'Seafaring cat cheering consistent practice streaks.',
    dialogues: {
      perfect: 'Smooth sailing with 100% precision!',
      fast: 'Full wind behind your fingers today!',
      pb: 'A brand-new record logged cleanly.',
      slow: 'Calm waters keep accuracy intact.',
      mistakes: 'Choppy passage. Queue a drill on those missed keys.',
      default: 'Set course for another focused session.',
    },
  },
  {
    id: 'ninja',
    name: 'Shadow Shinobi',
    type: 'ninja',
    color: '#2C3E50',
    accent: '#7F8C8D',
    desc: 'Quiet and disciplined companion rewarding streak consistency.',
    dialogues: {
      perfect: 'Quiet accuracy across every word.',
      fast: 'Swift and consistent cadence.',
      pb: 'New personal high unlocked.',
      slow: 'Calm breathing yields steady output.',
      mistakes: 'Eliminate rushing on unfamiliar bigrams.',
      default: 'Focused hands leave zero extra backspaces.',
    },
  },
  {
    id: 'detective',
    name: 'Inspector Paws',
    type: 'detective',
    color: '#D2B48C',
    accent: '#8B5A2B',
    desc: 'Analytical cat inspecting keystroke timing patterns.',
    dialogues: {
      perfect: 'Zero mistake clues left behind.',
      fast: 'Fast, readable transition intervals.',
      pb: 'Evidence confirms a new personal benchmark.',
      slow: 'Careful key inspection keeps errors low.',
      mistakes: 'Follow the weak-key report below to target drills.',
      default: 'Every transition interval reveals a clue.',
    },
  },
  {
    id: 'chef',
    name: 'Chef Pierre',
    type: 'chef',
    color: '#F5F6FA',
    accent: '#B2BEC3',
    desc: 'Precision-obsessed chef cat balancing speed and clean execution.',
    dialogues: {
      perfect: 'Clean, balanced execution across every course.',
      fast: 'Fast preparation with zero burned keys.',
      pb: 'A sharper recipe and a higher peak WPM.',
      slow: 'Low-and-steady warmup complete.',
      mistakes: 'Slow slightly before speeding up to keep accuracy clean.',
      default: 'Blend rhythm and accuracy for steady gains.',
    },
  },
];

function subscribeCatStorage(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  window.addEventListener(STORAGE_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(STORAGE_CHANGE_EVENT, callback);
  };
}

function getUnlockedSnapshot(): string {
  if (typeof window === 'undefined') return DEFAULT_UNLOCKED_JSON;
  return localStorage.getItem(UNLOCKED_STORAGE_KEY) || DEFAULT_UNLOCKED_JSON;
}

function getSelectedSnapshot(): string {
  if (typeof window === 'undefined') return 'orange';
  return localStorage.getItem(SELECTED_STORAGE_KEY) || 'orange';
}

function getServerUnlockedSnapshot(): string {
  return DEFAULT_UNLOCKED_JSON;
}

function getServerSelectedSnapshot(): string {
  return 'orange';
}

function parseUnlockedIds(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.filter((id): id is string => typeof id === 'string');
    }
  } catch {
    // Fall back safely on corrupted storage value
  }
  return DEFAULT_UNLOCKED_IDS;
}

export const CatCompanion: React.FC<CatCompanionProps> = ({
  wpm,
  accuracy,
  errorCount,
  streakDays = 1,
}) => {
  const unlockedRaw = useSyncExternalStore(
    subscribeCatStorage,
    getUnlockedSnapshot,
    getServerUnlockedSnapshot
  );
  const selectedCatId = useSyncExternalStore(
    subscribeCatStorage,
    getSelectedSnapshot,
    getServerSelectedSnapshot
  );

  const unlockedIds = useMemo(() => parseUnlockedIds(unlockedRaw), [unlockedRaw]);
  const [showNotification, setShowNotification] = useState<string | null>(null);
  const [showCollectionDrawer, setShowCollectionDrawer] = useState(false);
  const processedRunSignatureRef = useRef<string>('');

  const performanceCategory = useMemo(():
    | 'perfect'
    | 'fast'
    | 'pb'
    | 'slow'
    | 'mistakes'
    | 'default' => {
    if (accuracy === 100) return 'perfect';
    if (wpm >= 120) return 'fast';
    if (wpm > 85) return 'pb';
    if (errorCount > 8) return 'mistakes';
    if (wpm < 30) return 'slow';
    return 'default';
  }, [wpm, accuracy, errorCount]);

  const activeCat = useMemo((): CatInfo => {
    const dbCat = CATS_DATABASE.find((c) => c.id === selectedCatId) || CATS_DATABASE[0];

    let acc: 'headphones' | 'hoodie' | 'golden-auras' | 'none' = 'none';
    if (streakDays >= 100) acc = 'golden-auras';
    else if (streakDays >= 30) acc = 'hoodie';
    else if (streakDays >= 7) acc = 'headphones';

    return { ...dbCat, accessory: acc };
  }, [selectedCatId, streakDays]);

  // Deterministically unlock specialty companions without overwriting existing storage
  useEffect(() => {
    const signature = `${wpm}:${accuracy}:${errorCount}`;
    if (processedRunSignatureRef.current === signature) return;
    processedRunSignatureRef.current = signature;

    const timerId = window.setTimeout(() => {
      const currentIds = parseUnlockedIds(
        localStorage.getItem(UNLOCKED_STORAGE_KEY) || DEFAULT_UNLOCKED_JSON
      );

      let targetUnlock: CatInfo | null = null;
      if (accuracy === 100 && wpm >= 30 && !currentIds.includes('golden')) {
        targetUnlock = CATS_DATABASE.find((c) => c.id === 'golden') ?? null;
      } else if (wpm >= 120 && !currentIds.includes('cyber')) {
        targetUnlock = CATS_DATABASE.find((c) => c.id === 'cyber') ?? null;
      } else if (errorCount > 10 && !currentIds.includes('hacker')) {
        targetUnlock = CATS_DATABASE.find((c) => c.id === 'hacker') ?? null;
      } else if (streakDays >= 7 && !currentIds.includes('ninja')) {
        targetUnlock = CATS_DATABASE.find((c) => c.id === 'ninja') ?? null;
      }

      if (targetUnlock) {
        const nextList = Array.from(new Set([...currentIds, targetUnlock.id]));
        localStorage.setItem(UNLOCKED_STORAGE_KEY, JSON.stringify(nextList));
        window.dispatchEvent(new Event(STORAGE_CHANGE_EVENT));
        setShowNotification(`Unlocked companion: ${targetUnlock.name}`);
      }
    }, 50);

    return () => window.clearTimeout(timerId);
  }, [wpm, accuracy, errorCount, streakDays]);

  // Auto-dismiss notification cleanly
  useEffect(() => {
    if (!showNotification) return;
    const hideId = window.setTimeout(() => setShowNotification(null), 4000);
    return () => window.clearTimeout(hideId);
  }, [showNotification]);

  const catDialogue = useMemo(() => {
    return activeCat.dialogues[performanceCategory];
  }, [activeCat, performanceCategory]);

  // Pure deterministic quote selection (no Math.random inside useMemo)
  const shortQuote = useMemo(() => {
    const idx = Math.abs(Math.round(wpm) + errorCount) % SHORT_QUOTES.length;
    return SHORT_QUOTES[idx];
  }, [wpm, errorCount]);

  const selectCompanion = (id: string) => {
    localStorage.setItem(SELECTED_STORAGE_KEY, id);
    window.dispatchEvent(new Event(STORAGE_CHANGE_EVENT));
  };

  const renderCatVector = (cat: CatInfo) => {
    const isGlitch = performanceCategory === 'mistakes' || cat.type === 'hacker';
    const isExcited = performanceCategory === 'fast' || performanceCategory === 'pb';
    const isSleepy = performanceCategory === 'slow';

    return (
      <motion.svg
        width="110"
        height="110"
        viewBox="0 0 64 64"
        className="w-24 h-24 preserve-3d"
        animate={
          isExcited
            ? { y: [0, -10, 0], scaleY: [1, 0.9, 1.05, 1] }
            : isSleepy
              ? { scaleY: [0.95, 0.98, 0.95], y: [0, 1.5, 0] }
              : { y: [0, -2, 0] }
        }
        transition={
          isExcited
            ? { duration: 0.6, repeat: Infinity, repeatType: 'reverse' }
            : { duration: 2.2, repeat: Infinity, repeatType: 'reverse' }
        }
      >
        <defs>
          <filter id="gold-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <g
          filter={
            cat.accessory === 'golden-auras' || cat.type === 'golden'
              ? 'url(#gold-glow)'
              : undefined
          }
        >
          {cat.type === 'purple' && (
            <motion.circle
              cx="32"
              cy="36"
              r="22"
              fill={`${cat.color}20`}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}

          <motion.path
            d="M 16 48 Q 6 52 10 40 Q 14 30 18 36"
            stroke={cat.color}
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
            animate={{
              rotate: [-8, 12, -8],
              originX: '18px',
              originY: '42px',
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />

          <rect
            x="14"
            y="24"
            width="36"
            height="26"
            rx="14"
            fill={cat.color}
            stroke="#1A1A1D"
            strokeWidth="2.5"
          />

          <path d="M 12 36 L 8 38 L 13 40 Z" fill={cat.color} stroke="#1A1A1D" strokeWidth="1.5" />
          <path d="M 52 36 L 56 38 L 51 40 Z" fill={cat.color} stroke="#1A1A1D" strokeWidth="1.5" />

          <polygon points="16,25 6,12 24,18" fill={cat.color} stroke="#1A1A1D" strokeWidth="2.5" />
          <polygon points="18,21 10,14 22,17" fill="#FFA5A5" />

          <polygon points="48,25 58,12 40,18" fill={cat.color} stroke="#1A1A1D" strokeWidth="2.5" />
          <polygon points="46,21 54,14 42,17" fill="#FFA5A5" />

          <g>
            {isSleepy ? (
              <>
                <path
                  d="M 22 30 Q 25 33 28 30"
                  stroke="#1A1A1D"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M 36 30 Q 39 33 42 30"
                  stroke="#1A1A1D"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                />
              </>
            ) : isGlitch ? (
              <>
                <path d="M 22 26 L 28 32 M 28 26 L 22 32" stroke="#1A1A1D" strokeWidth="2.5" />
                <path d="M 36 26 L 42 32 M 42 26 L 36 32" stroke="#1A1A1D" strokeWidth="2.5" />
              </>
            ) : (
              <>
                <motion.ellipse
                  cx="25"
                  cy="30"
                  rx="3.5"
                  ry="4.5"
                  fill={cat.type === 'void' ? '#E17055' : '#1A1A1D'}
                  animate={{ scaleY: [1, 1, 0.1, 1, 1] }}
                  transition={{ duration: 3.5, repeat: Infinity }}
                />
                <motion.ellipse
                  cx="39"
                  cy="30"
                  rx="3.5"
                  ry="4.5"
                  fill={cat.type === 'void' ? '#E17055' : '#1A1A1D'}
                  animate={{ scaleY: [1, 1, 0.1, 1, 1] }}
                  transition={{ duration: 3.5, repeat: Infinity }}
                />
              </>
            )}
          </g>

          {cat.type === 'white' && (
            <>
              <circle cx="21" cy="33" r="2.5" fill="#FF8B8B" opacity="0.6" />
              <circle cx="43" cy="33" r="2.5" fill="#FF8B8B" opacity="0.6" />
            </>
          )}

          <path
            d="M 30 34 Q 32 36 34 34"
            stroke="#1A1A1D"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />

          {cat.accessory === 'headphones' && (
            <g>
              <path d="M 12 24 Q 32 6 52 24" stroke="#D63031" strokeWidth="4" fill="none" />
              <rect x="8" y="22" width="6" height="10" rx="2" fill="#D63031" />
              <rect x="50" y="22" width="6" height="10" rx="2" fill="#D63031" />
            </g>
          )}

          {cat.accessory === 'hoodie' && (
            <g opacity="0.8">
              <circle cx="32" cy="32" r="21" stroke="#2C3E50" strokeWidth="3" fill="none" />
            </g>
          )}

          {cat.type === 'space' && (
            <circle
              cx="32"
              cy="32"
              r="23"
              stroke="#81ECEC"
              strokeWidth="1.5"
              fill="rgba(129,236,236,0.1)"
            />
          )}

          {cat.type === 'pirate' && (
            <>
              <rect x="22" y="27" width="7" height="6" fill="#1A1A1D" />
              <path d="M 12 24 L 32 30" stroke="#1A1A1D" strokeWidth="1.5" />
            </>
          )}

          {cat.type === 'cyber' && (
            <rect x="20" y="27" width="24" height="4" fill="#00CEC9" opacity="0.75" />
          )}

          {cat.type === 'ninja' && (
            <g>
              <rect x="12" y="20" width="40" height="4" fill="#2D3436" rx="1" />
              <path
                d="M 12 22 L 6 27 M 12 22 L 4 19"
                stroke="#2D3436"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </g>
          )}

          {cat.type === 'detective' && (
            <g>
              <path
                d="M 16 23 C 16 11, 48 11, 48 23 Z"
                fill="#D2B48C"
                stroke="#1A1A1D"
                strokeWidth="1.5"
              />
              <rect x="10" y="21" width="44" height="3" fill="#8B5A2B" rx="1" />
            </g>
          )}

          {cat.type === 'chef' && (
            <g>
              <path
                d="M 22 23 C 20 8, 44 8, 42 23 Z"
                fill="#F5F6FA"
                stroke="#1A1A1D"
                strokeWidth="1.5"
              />
              <rect
                x="20"
                y="20"
                width="24"
                height="4"
                fill="#DFE4EA"
                stroke="#1A1A1D"
                strokeWidth="1"
                rx="1"
              />
            </g>
          )}
        </g>
      </motion.svg>
    );
  };

  return (
    <div className="w-full bg-surface/80 dark:bg-surface/40 backdrop-blur-md border border-border/80 rounded-2xl p-6 relative flex flex-col items-center justify-center gap-6 overflow-hidden">
      <AnimatePresence>
        {showNotification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-4 px-4 py-2 bg-accent text-[#0B0B0C] rounded-full text-xs font-black uppercase tracking-wider shadow-lg flex items-center gap-1.5 z-50"
          >
            <Sparkles className="w-3.5 h-3.5 fill-current" />
            <span>{showNotification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col items-center gap-4 relative">
        <div className="relative p-3 bg-surface-accent rounded-full border border-border">
          {renderCatVector(activeCat)}
          {activeCat.accessory !== 'none' && (
            <span className="absolute bottom-1.5 right-1.5 bg-accent text-[#0B0B0C] font-black text-[9px] uppercase px-1.5 py-0.5 rounded-full tracking-wider border border-border">
              {activeCat.accessory}
            </span>
          )}
        </div>

        <div className="flex flex-col items-center text-center max-w-md">
          <span className="text-xs font-black uppercase tracking-widest text-accent-ink mb-1 flex items-center gap-1.5">
            {activeCat.name}
            {streakDays > 0 && (
              <span className="text-text-secondary font-mono flex items-center gap-0.5 lowercase text-xs tracking-normal">
                <Flame className="w-3.5 h-3.5 text-accent-ink" />
                {streakDays}d streak
              </span>
            )}
          </span>
          <p className="text-sm font-semibold text-text-primary italic leading-relaxed">
            &ldquo;{catDialogue}&rdquo;
          </p>
          <span className="text-xs font-bold text-text-secondary mt-2.5 uppercase tracking-widest">
            {shortQuote}
          </span>
        </div>
      </div>

      <div className="flex gap-4 border-t border-border/50 pt-4 w-full justify-between items-center z-10">
        <span className="text-xs font-black text-text-secondary uppercase tracking-widest">
          collected: {unlockedIds.length} / {CATS_DATABASE.length}
        </span>
        <button
          type="button"
          onClick={() => setShowCollectionDrawer(true)}
          className="px-3.5 py-2 min-h-[36px] border border-border bg-surface-accent/60 hover:bg-surface-accent text-xs font-black uppercase tracking-wider text-text-primary rounded-xl transition-all cursor-pointer"
        >
          My Collection
        </button>
      </div>

      <AnimatePresence>
        {showCollectionDrawer && (
          <motion.div
            data-testid="cat-collection-drawer"
            role="region"
            aria-label="Cat Companions Collection"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-surface text-text-primary flex flex-col justify-between p-6 z-40"
          >
            <div className="flex justify-between items-center border-b border-border pb-3">
              <span className="text-xs font-black uppercase tracking-wider text-text-primary flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-accent-ink" />
                Cat Companions
              </span>
              <button
                type="button"
                onClick={() => setShowCollectionDrawer(false)}
                className="text-xs font-black font-mono text-text-primary bg-surface-accent hover:bg-border border border-border px-2.5 py-1 rounded-lg cursor-pointer"
              >
                close
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 overflow-y-auto my-4 pr-1 max-h-[220px]">
              {CATS_DATABASE.map((cat) => {
                const isUnlocked = unlockedIds.includes(cat.id);
                const isSelected = selectedCatId === cat.id;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    disabled={!isUnlocked}
                    onClick={() => selectCompanion(cat.id)}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                      isSelected
                        ? 'border-accent bg-accent/15 text-text-primary shadow-xs cursor-pointer'
                        : isUnlocked
                          ? 'border-border bg-background hover:bg-surface-accent text-text-primary hover:scale-[1.02] cursor-pointer'
                          : 'border-border/70 bg-surface-accent/80 text-text-secondary cursor-not-allowed'
                    }`}
                  >
                    <span className="text-2xl">{isUnlocked ? '😸' : '🔒'}</span>
                    <span className="text-xs font-black tracking-wider uppercase text-center mt-1 truncate max-w-full">
                      {cat.name.split(' ')[0]}
                    </span>
                    <span className="text-[10px] text-text-secondary lowercase tracking-normal">
                      {cat.type}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="text-xs text-text-secondary leading-normal border-t border-border pt-2 text-center font-semibold">
              Tip: finish tests with 100% accuracy or 120+ WPM to unlock specialty companions.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
