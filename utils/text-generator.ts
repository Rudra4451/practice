import { WORDS_COMMON, QUOTES, CODE_SNIPPETS } from '@/constants/dictionaries';

// 128-bit hash generator for strings
export function cyrb128(str: string): number[] {
  let h1 = 1779033703, h2 = 3024733165, h3 = 3362453659, h4 = 2824967661;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
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

// 32-bit PRNG
export function mulberry32(a: number): () => number {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateText(
  seed: string,
  mode: string,
  durationLimit: number
): string {
  const hash = cyrb128(seed)[0];
  const rand = mulberry32(hash);

  // Approximate word count needed based on duration (up to ~180 WPM capacity)
  const wordCount = Math.max(50, Math.ceil(durationLimit * 3.5));

  switch (mode) {
    case 'words': {
      const result: string[] = [];
      for (let i = 0; i < wordCount; i++) {
        const idx = Math.floor(rand() * WORDS_COMMON.length);
        result.push(WORDS_COMMON[idx]);
      }
      return result.join(' ');
    }

    case 'numbers': {
      const result: string[] = [];
      for (let i = 0; i < wordCount; i++) {
        // Mix integers, floats, equations
        const roll = rand();
        if (roll < 0.4) {
          result.push(Math.floor(rand() * 1000).toString());
        } else if (roll < 0.7) {
          result.push(Math.floor(rand() * 100).toString() + '.' + Math.floor(rand() * 10).toString());
        } else {
          const num1 = Math.floor(rand() * 12) + 1;
          const num2 = Math.floor(rand() * 12) + 1;
          const op = rand() > 0.5 ? '+' : '*';
          result.push(`${num1}${op}${num2}`);
        }
      }
      return result.join(' ');
    }

    case 'punctuation': {
      const result: string[] = [];
      const symbols = ['.', ',', '?', '!', ';', ':', '-', '"'];
      for (let i = 0; i < wordCount; i++) {
        const wordIdx = Math.floor(rand() * WORDS_COMMON.length);
        let word = WORDS_COMMON[wordIdx];
        
        // Capitalize some words
        if (rand() < 0.15) {
          word = word.charAt(0).toUpperCase() + word.slice(1);
        }

        const roll = rand();
        if (roll < 0.2) {
          const sym = symbols[Math.floor(rand() * symbols.length)];
          if (sym === '"') {
            word = `"${word}"`;
          } else {
            word = word + sym;
          }
        }
        result.push(word);
      }
      return result.join(' ');
    }

    case 'quotes': {
      const idx = Math.floor(rand() * QUOTES.length);
      return QUOTES[idx].text;
    }

    case 'code': {
      // Pick a selection of snippets and join them with double spaces
      const items: string[] = [];
      const snippetsCount = Math.max(3, Math.ceil(durationLimit / 20));
      for (let i = 0; i < snippetsCount; i++) {
        const idx = Math.floor(rand() * CODE_SNIPPETS.length);
        items.push(CODE_SNIPPETS[idx]);
      }
      return items.join('  ');
    }

    default:
      return "TyProX typing platform fallback text.";
  }
}
