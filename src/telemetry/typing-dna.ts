import { KeystrokeEvent, TypingDNAVector } from './types';

/**
 * Calculates alphabet key speed vectors and bigram transition matrices
 */
export function calculateTypingDNA(keystrokes: KeystrokeEvent[]): TypingDNAVector {
  const keyTimes: Record<string, number[]> = {};
  const bigramTimes: Record<string, number[]> = {};
  const errorFrequencies: Record<string, number> = {};

  for (let i = 1; i < keystrokes.length; i++) {
    const prev = keystrokes[i - 1];
    const curr = keystrokes[i];

    if (curr.y === 0) {
      // Record key interval if valid input
      const char = curr.k.toLowerCase();
      if (/^[a-z0-9]$/.test(char)) {
        const interval = curr.t - prev.t;
        if (interval > 0 && interval < 3000) {
          if (!keyTimes[char]) keyTimes[char] = [];
          keyTimes[char].push(interval);
        }
      }

      // Record bigram transition if both previous and current are input
      if (prev.y === 0) {
        const bigram = (prev.k + curr.k).toLowerCase();
        if (/^[a-z]{2}$/.test(bigram)) {
          const diff = curr.t - prev.t;
          if (diff > 0 && diff < 3000) {
            if (!bigramTimes[bigram]) bigramTimes[bigram] = [];
            bigramTimes[bigram].push(diff);
          }
        }
      }
    } else if (curr.y === 1) {
      // Record error delete action frequency
      const key = curr.k || 'backspace';
      errorFrequencies[key] = (errorFrequencies[key] || 0) + 1;
    }
  }

  const alphabetSpeeds: Record<string, number> = {};
  Object.keys(keyTimes).forEach((k) => {
    const times = keyTimes[k];
    alphabetSpeeds[k] = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  });

  const bigramSpeeds: Record<string, number> = {};
  Object.keys(bigramTimes).forEach((b) => {
    const times = bigramTimes[b];
    bigramSpeeds[b] = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  });

  return {
    alphabetSpeeds,
    bigramSpeeds,
    errorFrequencies,
  };
}
