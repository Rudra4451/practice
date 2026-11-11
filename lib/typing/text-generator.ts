import { WORDS_COMMON, QUOTES, CODE_SNIPPETS } from '@/constants/dictionaries';

// 128-bit FNV/cyrb hash generator for deterministic PRNG seeding
export function cyrb128(str: string): number[] {
  let h1 = 1779033703;
  let h2 = 3024733165;
  let h3 = 3362453659;
  let h4 = 2824967661;

  for (let i = 0; i < str.length; i += 1) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }

  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0];
}

// 32-bit seeded PRNG
export function mulberry32(a: number): () => number {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates a cryptographically strong 12-hex-char seed across both browser and server runtimes.
 */
export function createSeed(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID().replace(/-/g, '').slice(0, 12);
  }
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const bytes = new Uint8Array(6);
    cryptoObj.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Safe fallback for exotic test environments without Web Crypto
  return '0123456789ab';
}

function shuffleWithSeed<T>(items: readonly T[], rand: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function normalizeSpacing(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export interface GenerateTextOptions {
  targets?: string[];
}

export function generateText(
  seed: string,
  mode: string,
  durationLimit: number,
  options?: GenerateTextOptions
): string {
  const safeDuration = Math.max(15, Math.min(300, durationLimit || 30));
  const hash = cyrb128(seed || 'typrox-default')[0];
  const rand = mulberry32(hash);

  // Support ~288 WPM peak typing capacity across all word-based modes
  const wordCount = Math.max(65, Math.ceil(safeDuration * 4.8));

  switch (mode) {
    case 'words': {
      const result: string[] = [];
      for (let i = 0; i < wordCount; i += 1) {
        const idx = Math.floor(rand() * WORDS_COMMON.length);
        result.push(WORDS_COMMON[idx]);
      }
      return normalizeSpacing(result.join(' '));
    }

    case 'numbers': {
      const result: string[] = [];
      for (let i = 0; i < wordCount; i += 1) {
        const roll = rand();
        if (roll < 0.4) {
          result.push(Math.floor(rand() * 1000).toString());
        } else if (roll < 0.7) {
          result.push(
            `${Math.floor(rand() * 100)}.${Math.floor(rand() * 10)}`
          );
        } else {
          const num1 = Math.floor(rand() * 12) + 1;
          const num2 = Math.floor(rand() * 12) + 1;
          const op = rand() > 0.5 ? '+' : '*';
          result.push(`${num1}${op}${num2}`);
        }
      }
      return normalizeSpacing(result.join(' '));
    }

    case 'punctuation': {
      const result: string[] = [];
      const symbols = ['.', ',', '?', '!', ';', ':', '-', '"'];
      for (let i = 0; i < wordCount; i += 1) {
        const wordIdx = Math.floor(rand() * WORDS_COMMON.length);
        let word = WORDS_COMMON[wordIdx];

        if (rand() < 0.15) {
          word = word.charAt(0).toUpperCase() + word.slice(1);
        }

        const roll = rand();
        if (roll < 0.2) {
          const sym = symbols[Math.floor(rand() * symbols.length)];
          word = sym === '"' ? `"${word}"` : `${word}${sym}`;
        }
        result.push(word);
      }
      return normalizeSpacing(result.join(' '));
    }

    case 'quotes': {
      // Scale concatenated non-repeating quotes to fit full test duration (~216 WPM headroom)
      const minChars = Math.max(140, Math.ceil(safeDuration * 18));
      const pool = shuffleWithSeed(QUOTES, rand);
      const selected: string[] = [];
      let totalLength = 0;
      let cursor = 0;

      while (totalLength < minChars) {
        const q = normalizeSpacing(pool[cursor % pool.length].text);
        selected.push(q);
        totalLength += q.length + 1;
        cursor += 1;
      }

      return normalizeSpacing(selected.join(' '));
    }

    case 'code': {
      // Join snippets with single spaces (never double spaces) and scale to duration
      const minChars = Math.max(120, Math.ceil(safeDuration * 16));
      const pool = shuffleWithSeed(CODE_SNIPPETS, rand);
      const items: string[] = [];
      let totalLength = 0;
      let cursor = 0;

      while (items.length < 3 || totalLength < minChars) {
        const snippet = normalizeSpacing(pool[cursor % pool.length]);
        items.push(snippet);
        totalLength += snippet.length + 1;
        cursor += 1;
      }

      return normalizeSpacing(items.join(' '));
    }

    case 'drill': {
      const normalizedTargets = (options?.targets ?? [])
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0 && t.length <= 3);

      const focusedWords =
        normalizedTargets.length > 0
          ? WORDS_COMMON.filter((word) =>
              normalizedTargets.some((target) => word.includes(target))
            )
          : [];

      const activePool = focusedWords.length > 0 ? focusedWords : WORDS_COMMON;
      const drillWordCount = Math.max(40, Math.ceil(safeDuration * 3.5));
      const result: string[] = [];

      for (let i = 0; i < drillWordCount; i += 1) {
        const pool = rand() < 0.75 ? activePool : WORDS_COMMON;
        result.push(pool[Math.floor(rand() * pool.length)]);
      }

      return normalizeSpacing(result.join(' '));
    }

    case 'daily': {
      // Deterministic mix seeded by UTC challenge date string
      const result: string[] = [];
      for (let i = 0; i < wordCount; i += 1) {
        let word = WORDS_COMMON[Math.floor(rand() * WORDS_COMMON.length)];
        if (rand() < 0.12) {
          word = word.charAt(0).toUpperCase() + word.slice(1);
        }
        result.push(word);
      }
      return normalizeSpacing(result.join(' '));
    }

    default: {
      const result: string[] = [];
      for (let i = 0; i < wordCount; i += 1) {
        result.push(WORDS_COMMON[Math.floor(rand() * WORDS_COMMON.length)]);
      }
      return normalizeSpacing(result.join(' '));
    }
  }
}

