import { describe, expect, it } from 'vitest';
import { createSeed, generateText } from '@/lib/typing/text-generator';

describe('lib/typing/text-generator', () => {
  it('generates deterministic text across identical seeds for every mode and duration', () => {
    const modes = ['words', 'quotes', 'numbers', 'punctuation', 'code', 'daily'] as const;
    const durations = [15, 30, 60, 120] as const;

    for (const mode of modes) {
      for (const duration of durations) {
        const seed = `test-${mode}-${duration}`;
        const first = generateText(seed, mode, duration);
        const second = generateText(seed, mode, duration);
        expect(first).toBe(second);
        expect(first.length).toBeGreaterThan(0);
      }
    }
  });

  it('eliminates double consecutive spaces and trailing spaces across all modes', () => {
    const modes = ['words', 'quotes', 'numbers', 'punctuation', 'code', 'drill'] as const;
    for (const mode of modes) {
      const generated = generateText('abcdef123456', mode, 120, { targets: ['q', 'z'] });
      expect(generated).not.toContain('  ');
      expect(generated).toBe(generated.trim());
    }
  });

  it('scales quotes and code text capacity properly for 120s high-WPM runs', () => {
    const quote120 = generateText('seed-quote-120', 'quotes', 120);
    const code120 = generateText('seed-code-120', 'code', 120);
    expect(quote120.length).toBeGreaterThanOrEqual(1800);
    expect(code120.length).toBeGreaterThanOrEqual(1600);
  });

  it('weights drill vocabulary toward weak characters/bigrams', () => {
    const drill = generateText('seed-drill-xz', 'drill', 30, { targets: ['z'] });
    const zWords = drill.split(' ').filter((w) => w.includes('z'));
    expect(zWords.length).toBeGreaterThan(20);
  });

  it('creates valid 12-hex-char non-empty seeds', () => {
    for (let i = 0; i < 20; i += 1) {
      expect(createSeed()).toMatch(/^[a-f0-9]{12}$/);
    }
  });
});

