'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Flame } from 'lucide-react';

// --- Type Declarations ---
export interface CatCompanionProps {
  wpm: number;
  accuracy: number;
  errorCount: number;
  streakDays?: number; // Optional custom streak override
}

interface CatInfo {
  id: string;
  name: string;
  type: 'orange' | 'void' | 'white' | 'grey' | 'blue' | 'purple' | 'golden' | 'hacker' | 'samurai' | 'space' | 'cyber' | 'pirate' | 'ninja' | 'detective' | 'chef';
  color: string;
  accent: string;
  dialogues: {
    perfect: string; // 100% accuracy
    fast: string;    // 120+ WPM
    pb: string;      // personal best
    slow: string;    // slow typing
    mistakes: string;// many mistakes
    default: string;
  };
  desc: string;
  accessory?: 'headphones' | 'hoodie' | 'golden-auras' | 'none';
}

// --- Quotes Config (Max 8-10 words) ---
const SHORT_QUOTES = [
  'Your fingers are cooking.',
  'That combo was clean.',
  'Accuracy > Speed.',
  'Keyboard approved.',
  'Even I’m impressed.',
  'Touch grass… after one more run.',
  'Another run?'
];

// --- 12 Collectible Cats list ---
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
      default: 'Keep typing! The lasagna is baking.'
    }
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
      default: 'I stare into the keyboard. It stares back.'
    }
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
      default: 'I believe in you! Let us take it one key at a time.'
    }
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
      pb: 'Progress registered. Do not get complacent, soldier.',
      slow: 'Unacceptable cadence. Double your finger posture drill.',
      mistakes: 'Uncontrolled errors. Focus on accuracy before adding speed.',
      default: 'Consistency is built keystroke by keystroke.'
    }
  },
  {
    id: 'blue',
    name: 'Speedy Turbo',
    type: 'blue',
    color: '#00D2D3',
    accent: '#54A0FF',
    desc: 'Fast gaming enthusiast. Hyped, competitive, and lives for high WPM runs.',
    dialogues: {
      perfect: 'Perfect combo! That accuracy run was absolutely cracked!',
      fast: '120+ WPM! You are cooking! Keep that high refresh rate!',
      pb: 'A new personal best! Absolute gamer status!',
      slow: 'Ping is too high? Let us reboot and speedrun it!',
      mistakes: 'Choked the combo! Get back in the queue!',
      default: 'Type fast, think faster. GG!'
    }
  },
  {
    id: 'purple',
    name: 'Mystic Nebula',
    type: 'purple',
    color: '#9B59B6',
    accent: '#8E44AD',
    desc: 'Magical space-glowing cat. Controls floating star particles and cosmos magic.',
    dialogues: {
      perfect: 'The stars have aligned. A truly celestial performance.',
      fast: 'Warp speed achieved. You transcend normal constraints.',
      pb: 'The constellation of success glows brightly today.',
      slow: 'A slow orbit. Take your time to gather cosmic focus.',
      mistakes: 'Asteroids disrupted your path. Center your aura.',
      default: 'Magic flows through every keystroke.'
    }
  },
  {
    id: 'golden',
    name: 'Ultra Lucky Neko',
    type: 'golden',
    color: '#F1C40F',
    accent: '#F39C12',
    desc: 'Legendary gold cat. Brings fortune, glowing stars, and ultimate typing luck.',
    dialogues: {
      perfect: 'A legendary flawless run! Gold particles for everyone!',
      fast: 'Supercharged speed! Gold tier velocity achieved!',
      pb: 'New Personal Best! The golden bell rings for you!',
      slow: 'A slow golden hour. Relax and enjoy the glow.',
      mistakes: 'Even gold has rough spots. Let us polishing it up!',
      default: 'Fortune favors the focused typist.'
    }
  },
  // Unlocked specialty collection cats
  {
    id: 'hacker',
    name: 'Netrunner Cyber',
    type: 'hacker',
    color: '#10AC84',
    accent: '#1DD1A1',
    desc: 'Hacker Cat with a glitch green matrix styling and terminal visor.',
    dialogues: {
      perfect: 'Root access obtained. Key sequence fully compiled.',
      fast: 'Overclocked CPU! Hacking the server at warp speed!',
      pb: 'New firewall bypassed! score.log updated successfully.',
      slow: 'Buffer underrun. System response delay detected.',
      mistakes: 'Syntax error! Syntax error! Check your key maps.',
      default: 'Listening on port 1337. Start typing.'
    }
  },
  {
    id: 'samurai',
    name: 'Shogun Ronin',
    type: 'samurai',
    color: '#EE5253',
    accent: '#FF6B6B',
    desc: 'Disciplined Samurai Cat with crossed swords and a focus headband.',
    dialogues: {
      perfect: 'One strike, one kill. Flawless katana movement.',
      fast: 'Swords draw like lightning. Speed is your ally.',
      pb: 'A legendary masterstroke. Honor to your fingers.',
      slow: 'Patience. But do not let your blade rust in slow stance.',
      mistakes: 'Your guard was broken. Re-center your warrior spirit.',
      default: 'The mind is the blade. The keyboard is the sheath.'
    }
  },
  {
    id: 'space',
    name: 'Cosmo Astro',
    type: 'space',
    color: '#54A0FF',
    accent: '#2E86DE',
    desc: 'Floating Space Cat wearing a tiny glass astronaut fishbowl helmet.',
    dialogues: {
      perfect: 'Perfect oxygen levels. Zero gravity precision typing.',
      fast: 'Rocket propulsion engaged! Leaving orbit now!',
      pb: 'New galaxy conquered! Star mapping looks beautiful.',
      slow: 'Floating adrift. Gravity is pulling you down.',
      mistakes: 'Houston, we have a problem. Recalibrating coordinates.',
      default: 'A small step for paws, a giant leap for typists.'
    }
  },
  {
    id: 'cyber',
    name: 'Mecha Cyberpunk',
    type: 'cyber',
    color: '#00D2D3',
    accent: '#01A3A4',
    desc: 'Neon cybernetic cat with mechanical ears and glowing neon circuit visor.',
    dialogues: {
      perfect: 'System optimization 100%. Cyberware fully calibrated.',
      fast: 'Neon speedlines flashing! Neural link speed maximized!',
      pb: 'Level up! Upgrading firmware with personal best stats.',
      slow: 'Low battery power. Recharge cells to type faster.',
      mistakes: 'Hardware glitch! System latency on fingers.',
      default: 'Connected to Net space. Cybernetic implants ready.'
    }
  },
  {
    id: 'pirate',
    name: 'Captain Hook',
    type: 'pirate',
    color: '#FF9F43',
    accent: '#EE5253',
    desc: 'Pirate Captain Cat with a tiny eyepatch and golden hook.',
    dialogues: {
      perfect: 'A chest full of gold! Flawless booty collected!',
      fast: 'Sailing with full wind speed! Ahoy speedy fingers!',
      pb: 'New treasure map discovered! The chest is ours!',
      slow: 'Calm waters. Row faster, ye scurvy dog!',
      mistakes: 'Stormy seas! We are taking on typos!',
      default: 'Arr! Set sail for the next keyboard conquest!'
    }
  },
  {
    id: 'ninja',
    name: 'Shadow Shinobi',
    type: 'ninja',
    color: '#2C3E50',
    accent: '#7F8C8D',
    desc: 'Quiet and disciplined Ninja Cat. Speaks in zen focus and quick slashes.',
    dialogues: {
      perfect: 'Flawless execution. Your target was struck with absolute precision.',
      fast: 'Fast as the shadow steps. A silent, swift strike!',
      pb: 'A legendary leap. Your training yields great power.',
      slow: 'Slow focus. Speed will follow once the mind is calm.',
      mistakes: 'Your steps faltered. Focus on the center of the key.',
      default: 'The silent typist strikes without noise.'
    }
  },
  {
    id: 'detective',
    name: 'Inspector Paws',
    type: 'detective',
    color: '#D2B48C',
    accent: '#8B5A2B',
    desc: 'Smart detective cat. Searches for clues in your typing patterns.',
    dialogues: {
      perfect: 'Case closed. Not a single typo clue was left behind.',
      fast: 'Quick deduction! You solved the layout mystery in record time.',
      pb: 'Brilliant discovery! A new breakthrough in WPM research.',
      slow: 'Hmm, examining the keys? Let us gather more evidence.',
      mistakes: 'I found several mistake clues. Let us analyze the patterns.',
      default: 'Every keystroke leaves a trace. Let us deduce the secret.'
    }
  },
  {
    id: 'chef',
    name: 'Chef Pierre',
    type: 'chef',
    color: '#F5F6FA',
    accent: '#B2BEC3',
    desc: 'Culinary expert Chef Cat. Evaluates your typing speed like baking a fine souffle.',
    dialogues: {
      perfect: 'Magnifique! A Michelin-star flawless run!',
      fast: 'Finger-licking fast! That run was absolutely sizzling!',
      pb: 'A brand new recipe! A delicious personal best!',
      slow: 'A slow-cook recipe? Let us turn up the burner heat!',
      mistakes: 'The souffle collapsed! Too many typo spices.',
      default: 'Let us mix speed and precision for the perfect blend.'
    }
  }
];

export const CatCompanion: React.FC<CatCompanionProps> = ({
  wpm,
  accuracy,
  errorCount,
  streakDays = 1
}) => {
  // Read streak and unlocked cats from localStorage to maintain gaming vibe
  const [unlockedIds, setUnlockedIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return ['orange', 'void', 'white'];
    const local = localStorage.getItem('typrox_cats_unlocked');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    localStorage.setItem('typrox_cats_unlocked', JSON.stringify(['orange', 'void', 'white']));
    return ['orange', 'void', 'white'];
  });

  const [selectedCatId, setSelectedCatId] = useState<string>(() => {
    if (typeof window === 'undefined') return 'orange';
    return localStorage.getItem('typrox_cats_selected') || 'orange';
  });

  const [showNotification, setShowNotification] = useState<string | null>(null);
  const [showCollectionDrawer, setShowCollectionDrawer] = useState(false);

  // Determine current rating category
  const performanceCategory = useMemo((): 'perfect' | 'fast' | 'pb' | 'slow' | 'mistakes' | 'default' => {
    if (accuracy === 100) return 'perfect';
    if (wpm >= 120) return 'fast';
    if (wpm > 85) return 'pb'; // simulated high-tier milestone
    if (errorCount > 8) return 'mistakes';
    if (wpm < 30) return 'slow';
    return 'default';
  }, [wpm, accuracy, errorCount]);

  // Retrieve current active cat
  const activeCat = useMemo((): CatInfo => {
    const dbCat = CATS_DATABASE.find((c) => c.id === selectedCatId) || CATS_DATABASE[0];
    
    // Determine Streak accessory upgrade level:
    // Day 1: normal, Day 7: headphones, Day 30: hoodie, Day 100: golden aura
    let acc: 'headphones' | 'hoodie' | 'golden-auras' | 'none' = 'none';
    if (streakDays >= 100) acc = 'golden-auras';
    else if (streakDays >= 30) acc = 'hoodie';
    else if (streakDays >= 7) acc = 'headphones';

    return { ...dbCat, accessory: acc };
  }, [selectedCatId, streakDays]);

  // Unlock check triggered on every new test score
  useEffect(() => {
    // If accuracy is perfect, or WPM is very high, there is a chance to unlock a specialty cat!
    const tryUnlock = () => {
      const lockable = CATS_DATABASE.filter((c) => !unlockedIds.includes(c.id));
      if (lockable.length === 0) return;

      let targetUnlock: CatInfo | null = null;

      if (accuracy === 100 && !unlockedIds.includes('golden')) {
        targetUnlock = CATS_DATABASE.find((c) => c.id === 'golden') || null;
      } else if (wpm >= 120 && !unlockedIds.includes('cyber')) {
        targetUnlock = CATS_DATABASE.find((c) => c.id === 'cyber') || null;
      } else if (errorCount > 10 && !unlockedIds.includes('hacker')) {
        // comedic unlock
        targetUnlock = CATS_DATABASE.find((c) => c.id === 'hacker') || null;
      } else if (Math.random() > 0.6) {
        // random chance
        targetUnlock = lockable[Math.floor(Math.random() * lockable.length)];
      }

      if (targetUnlock) {
        const unlockId = targetUnlock.id;
        const unlockName = targetUnlock.name;
        setUnlockedIds((prev) => {
          if (prev.includes(unlockId)) return prev;
          const nextList = [...prev, unlockId];
          localStorage.setItem('typrox_cats_unlocked', JSON.stringify(nextList));
          return nextList;
        });
        setShowNotification(`🎁 You discovered a new cat: ${unlockName}!`);
        setTimeout(() => setShowNotification(null), 4000);
      }
    };

    tryUnlock();
  }, [wpm, accuracy, errorCount, unlockedIds]);

  // Select a random dialogue for result feedback
  const catDialogue = useMemo(() => {
    return activeCat.dialogues[performanceCategory];
  }, [activeCat, performanceCategory]);

  // Deterministic quote based on test metrics
  const shortQuote = SHORT_QUOTES[(wpm + accuracy + errorCount) % SHORT_QUOTES.length];

  // Handle companion swap
  const selectCompanion = (id: string) => {
    setSelectedCatId(id);
    localStorage.setItem('typrox_cats_selected', id);
  };

  // Render fluffy cat SVG body
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
        animate={isExcited ? {
          y: [0, -10, 0],
          scaleY: [1, 0.9, 1.05, 1]
        } : isSleepy ? {
          scaleY: [0.95, 0.98, 0.95],
          y: [0, 1.5, 0]
        } : {
          y: [0, -2, 0]
        }}
        transition={isExcited ? {
          duration: 0.6,
          repeat: Infinity,
          repeatType: 'reverse'
        } : {
          duration: 2.2,
          repeat: Infinity,
          repeatType: 'reverse'
        }}
      >
        <defs>
          {/* Subtle gold glow filter */}
          <filter id="gold-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <g filter={cat.accessory === 'golden-auras' || cat.type === 'golden' ? 'url(#gold-glow)' : undefined}>
          {/* Cosmic aura or particle clouds */}
          {cat.type === 'purple' && (
            <motion.circle cx="32" cy="36" r="22" fill={`${cat.color}20`} animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }} />
          )}

          {/* Wavy Tail */}
          <motion.path
            d="M 16 48 Q 6 52 10 40 Q 14 30 18 36"
            stroke={cat.color}
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
            animate={{
              rotate: [-8, 12, -8],
              originX: '18px',
              originY: '42px'
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Large Round Fluffy Body */}
          <rect x="14" y="24" width="36" height="26" rx="14" fill={cat.color} stroke="#1A1A1D" strokeWidth="2.5" />
          
          {/* Fluff volume checks (cheek details) */}
          <path d="M 12 36 L 8 38 L 13 40 Z" fill={cat.color} stroke="#1A1A1D" strokeWidth="1.5" />
          <path d="M 52 36 L 56 38 L 51 40 Z" fill={cat.color} stroke="#1A1A1D" strokeWidth="1.5" />

          {/* Rounded Ears */}
          <polygon points="16,25 6,12 24,18" fill={cat.color} stroke="#1A1A1D" strokeWidth="2.5" />
          <polygon points="18,21 10,14 22,17" fill="#FFA5A5" />

          <polygon points="48,25 58,12 40,18" fill={cat.color} stroke="#1A1A1D" strokeWidth="2.5" />
          <polygon points="46,21 54,14 42,17" fill="#FFA5A5" />

          {/* Large Expression Eyes */}
          <g>
            {isSleepy ? (
              // Sleeping closed eyes
              <>
                <path d="M 22 30 Q 25 33 28 30" stroke="#1A1A1D" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <path d="M 36 30 Q 39 33 42 30" stroke="#1A1A1D" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              </>
            ) : isGlitch ? (
              // Glitched cross eyes
              <>
                <path d="M 22 26 L 28 32 M 28 26 L 22 32" stroke="#1A1A1D" strokeWidth="2.5" />
                <path d="M 36 26 L 42 32 M 42 26 L 36 32" stroke="#1A1A1D" strokeWidth="2.5" />
              </>
            ) : (
              // Standard blinking eyes
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

          {/* Blush details for supportive kind cat */}
          {cat.type === 'white' && (
            <>
              <circle cx="21" cy="33" r="2.5" fill="#FF8B8B" opacity="0.6" />
              <circle cx="43" cy="33" r="2.5" fill="#FF8B8B" opacity="0.6" />
            </>
          )}

          {/* Chibi Mouth */}
          <path d="M 30 34 Q 32 36 34 34" stroke="#1A1A1D" strokeWidth="2" strokeLinecap="round" fill="none" />

          {/* 3 Accessory Streak Upgrades */}
          {cat.accessory === 'headphones' && (
            <g>
              {/* Headphones arch */}
              <path d="M 12 24 Q 32 6 52 24" stroke="#D63031" strokeWidth="4" fill="none" />
              <rect x="8" y="22" width="6" height="10" rx="2" fill="#D63031" />
              <rect x="50" y="22" width="6" height="10" rx="2" fill="#D63031" />
            </g>
          )}

          {cat.accessory === 'hoodie' && (
            <g opacity="0.8">
              {/* Hoodie hoodie ring */}
              <circle cx="32" cy="32" r="21" stroke="#2C3E50" strokeWidth="3" fill="none" />
            </g>
          )}

          {/* Specialty Unlocked Mascots Visual Details */}
          {cat.type === 'space' && (
            <circle cx="32" cy="32" r="23" stroke="#81ECEC" strokeWidth="1.5" fill="rgba(129,236,236,0.1)" />
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
              <path d="M 12 22 L 6 27 M 12 22 L 4 19" stroke="#2D3436" strokeWidth="2.5" strokeLinecap="round" />
            </g>
          )}

          {cat.type === 'detective' && (
            <g>
              <path d="M 16 23 C 16 11, 48 11, 48 23 Z" fill="#D2B48C" stroke="#1A1A1D" strokeWidth="1.5" />
              <rect x="10" y="21" width="44" height="3" fill="#8B5A2B" rx="1" />
            </g>
          )}

          {cat.type === 'chef' && (
            <g>
              <path d="M 22 23 C 20 8, 44 8, 42 23 Z" fill="#F5F6FA" stroke="#1A1A1D" strokeWidth="1.5" />
              <rect x="20" y="20" width="24" height="4" fill="#DFE4EA" stroke="#1A1A1D" strokeWidth="1" rx="1" />
            </g>
          )}
        </g>
      </motion.svg>
    );
  };

  return (
    <div className="w-full bg-surface/20 backdrop-blur-md border border-border/80 rounded-2xl p-6 relative flex flex-col items-center justify-center gap-6 overflow-hidden">
      
      {/* Absolute micro background effects */}
      {performanceCategory === 'perfect' && (
        <div className="absolute inset-0 bg-[#FF5C00]/1 blur-2xl pointer-events-none animate-pulse" />
      )}
      {performanceCategory === 'fast' && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
          <div className="absolute left-4 top-0 bottom-0 w-[1px] bg-accent/20 animate-[slide_3s_infinite]" />
          <div className="absolute right-4 top-0 bottom-0 w-[1px] bg-accent/20 animate-[slide_3s_infinite_reverse]" />
        </div>
      )}

      {/* Collectible unlock notifications */}
      <AnimatePresence>
        {showNotification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-4 px-4 py-2 bg-accent text-neutral-950 rounded-full text-[10px] font-black uppercase tracking-wider shadow-lg flex items-center gap-1.5 z-40"
          >
            <Sparkles className="w-3.5 h-3.5 fill-current" />
            <span>{showNotification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Companion Presentation Row */}
      <div className="flex flex-col items-center gap-4 relative">
        <div className="relative p-3 bg-neutral-900/40 rounded-full border border-border/50">
          {renderCatVector(activeCat)}
          {/* Accessories Badge indicator */}
          {activeCat.accessory !== 'none' && (
            <span className="absolute bottom-1.5 right-1.5 bg-accent text-neutral-950 font-black text-[7px] uppercase px-1.5 py-0.5 rounded-full tracking-wider border border-neutral-900">
              {activeCat.accessory}
            </span>
          )}
        </div>

        {/* Dialog bubble */}
        <div className="flex flex-col items-center text-center max-w-md">
          <span className="text-[10px] font-black uppercase tracking-widest text-accent mb-1 flex items-center gap-1">
            {activeCat.name}
            {streakDays > 1 && (
              <span className="text-text-secondary font-mono flex items-center gap-0.5 lowercase text-[9px] tracking-normal">
                <Flame className="w-3 h-3 text-[#FF5C00]" />
                {streakDays}d streak
              </span>
            )}
          </span>
          <p className="text-sm font-semibold text-text-primary italic leading-relaxed">
            &ldquo;{catDialogue}&rdquo;
          </p>
          <span className="text-[9px] font-bold text-text-tertiary mt-2.5 uppercase tracking-widest">
            {shortQuote}
          </span>
        </div>
      </div>

      {/* Drawer Open Switch */}
      <div className="flex gap-4 border-t border-border/50 pt-4 w-full justify-between items-center z-30">
        <span className="text-[9px] font-black text-text-tertiary uppercase tracking-widest">
          collected: {unlockedIds.length} / 15
        </span>
        <button
          onClick={() => setShowCollectionDrawer(true)}
          className="px-3 py-1.5 border border-border/80 bg-surface-accent/20 hover:bg-surface-accent/60 text-[10px] font-black uppercase tracking-wider text-text-primary rounded-xl transition-all cursor-pointer"
        >
          My Collection
        </button>
      </div>

      {/* Drawer Overlay */}
      <AnimatePresence>
        {showCollectionDrawer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-neutral-950/80 backdrop-blur-md flex flex-col justify-between p-6 z-40"
          >
            <div className="flex justify-between items-center border-b border-border/80 pb-3">
              <span className="text-xs font-black uppercase tracking-wider text-text-primary flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                Cat Companions
              </span>
              <button
                onClick={() => setShowCollectionDrawer(false)}
                className="text-[10px] font-black font-mono text-text-secondary hover:text-text-primary border border-border px-2 py-1 rounded-lg"
              >
                close
              </button>
            </div>

            {/* Grid of collected cats */}
            <div className="grid grid-cols-3 gap-2 overflow-y-auto my-4 pr-1 max-h-[220px]">
              {CATS_DATABASE.map((cat) => {
                const isUnlocked = unlockedIds.includes(cat.id);
                const isSelected = selectedCatId === cat.id;

                return (
                  <button
                    key={cat.id}
                    disabled={!isUnlocked}
                    onClick={() => selectCompanion(cat.id)}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                      isSelected 
                        ? 'border-accent bg-accent/10' 
                        : isUnlocked 
                          ? 'border-border bg-surface/40 hover:bg-surface/80 hover:scale-[1.02]' 
                          : 'border-border/20 opacity-40 bg-neutral-900/40 cursor-not-allowed'
                    }`}
                  >
                    <span className="text-2xl">{isUnlocked ? '😸' : '🔒'}</span>
                    <span className="text-[9px] font-black tracking-wider uppercase text-center mt-1 truncate max-w-full">
                      {cat.name.split(' ')[0]}
                    </span>
                    <span className="text-[7px] text-text-tertiary lowercase tracking-normal">
                      {cat.type}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="text-[8px] text-text-tertiary leading-normal border-t border-border/50 pt-2 text-center uppercase tracking-wider font-semibold">
              Tip: complete tests with perfect accuracy or high speeds to discover new cats!
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
