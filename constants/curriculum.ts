export type CurriculumTrack = 'Foundations' | 'Fluency' | 'Precision' | 'Developer';

export interface CurriculumLesson {
  slug: string;
  order: number;
  track: CurriculumTrack;
  title: string;
  summary: string;
  focusKeys: string[];
  targetWpm: number;
  minAccuracy: number;
  prompt: string;
}

export interface LessonProgressRecord {
  bestWpm: number;
  bestAccuracy: number;
  stars: number;
  completed: boolean;
  attempts: number;
  lastAttemptAt?: string;
}

export const CURRICULUM_TRACKS: readonly CurriculumTrack[] = [
  'Foundations',
  'Fluency',
  'Precision',
  'Developer',
];

export const CURRICULUM_LESSONS: readonly CurriculumLesson[] = [
  {
    slug: 'home-row-foundations',
    order: 1,
    track: 'Foundations',
    title: 'Home Row Anchors',
    summary: 'Build calm finger return rhythm across the home row index and pinky anchors without looking down.',
    focusKeys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';'],
    targetWpm: 25,
    minAccuracy: 92,
    prompt:
      'ask a lad all fall; a sad dad falls; flask salad asks; half glass falls as lads dash; fall ask dad all lads; aflask salsa jazz falls;',
  },
  {
    slug: 'home-row-reach',
    order: 2,
    track: 'Foundations',
    title: 'Center Index Reach',
    summary: 'Extend left and right index fingers cleanly onto G and H while keeping your anchors steady.',
    focusKeys: ['g', 'h', 'a', 's', 'd', 'f', 'j', 'k', 'l'],
    targetWpm: 30,
    minAccuracy: 92,
    prompt:
      'glad half hall dash gash flash shall glad; hash flag lash gag sag hall; a glad lad had a half glass hall dash shall flash;',
  },
  {
    slug: 'top-row-expansion',
    order: 3,
    track: 'Foundations',
    title: 'Upper Row Reach',
    summary: 'Pair QWERTY upper-row reaches smoothly back to home row resting posture.',
    focusKeys: ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    targetWpm: 35,
    minAccuracy: 92,
    prompt:
      'quiet water route power write type true pure story youth equity report quote your work try quite steady tower;',
  },
  {
    slug: 'bottom-row-control',
    order: 4,
    track: 'Foundations',
    title: 'Bottom Row Coordination',
    summary: 'Coordinate compact downward finger reaches across Z through M with clean spacing.',
    focusKeys: ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
    targetWpm: 35,
    minAccuracy: 92,
    prompt:
      'calm zone mix basic climb exact van combine zoom balance cavern movement matrix exact maximum climb nimble zero;',
  },
  {
    slug: 'shift-and-capitals',
    order: 5,
    track: 'Fluency',
    title: 'Opposite Shift Capitals',
    summary: 'Use opposite-hand Shift chords so capitalized words never break finger timing.',
    focusKeys: ['Shift', 'A-Z'],
    targetWpm: 40,
    minAccuracy: 92,
    prompt:
      'Alice Met David Near London Bridge While Elena Typed Clean JavaScript Notes Every Tuesday Morning Before Nine;',
  },
  {
    slug: 'high-frequency-bigrams',
    order: 6,
    track: 'Fluency',
    title: 'High-Frequency Bigrams',
    summary: 'Accelerate common English letter pairs such as th, he, in, er, an, and re in smooth rolls.',
    focusKeys: ['th', 'he', 'in', 'er', 'an', 're'],
    targetWpm: 45,
    minAccuracy: 92,
    prompt:
      'there then another here where other father mother teacher water enter winter center matter gather render lantern;',
  },
  {
    slug: 'prefixes-and-suffixes',
    order: 7,
    track: 'Fluency',
    title: 'Prefixes & Suffixes',
    summary: 'Chunk whole word endings (-tion, -ing, -ment, -able) instead of sounding out single letters.',
    focusKeys: ['-tion', '-ing', '-ment', '-able'],
    targetWpm: 48,
    minAccuracy: 92,
    prompt:
      'building reliable movement through consistent execution improving measurement remarkable preparation thoughtful action training;',
  },
  {
    slug: 'numbers-top-row',
    order: 8,
    track: 'Precision',
    title: 'Number Row Precision',
    summary: 'Strike top-row digits cleanly for dates, versions, metrics, and ports.',
    focusKeys: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    targetWpm: 35,
    minAccuracy: 92,
    prompt:
      'build 2026 release 148 port 3000 batch 49 score 98 version 16 node 24 run 750 step 12 check 8080 verify 640;',
  },
  {
    slug: 'punctuation-rhythm',
    order: 9,
    track: 'Precision',
    title: 'Punctuation Cadence',
    summary: 'Integrate commas, colons, hyphens, questions, and quotes without pausing before marks.',
    focusKeys: [',', '.', '?', '!', ':', ';', '-', '"'],
    targetWpm: 42,
    minAccuracy: 92,
    prompt:
      'Speed helps, yet accuracy wins: ask yourself, "Did I rush this line?" Steady rhythm, clean stops; zero wasted keys!',
  },
  {
    slug: 'code-brackets-braces',
    order: 10,
    track: 'Developer',
    title: 'Brackets & Delimiters',
    summary: 'Master balanced parentheses, square brackets, and curly braces under clean wrist angle.',
    focusKeys: ['(', ')', '[', ']', '{', '}', '<', '>'],
    targetWpm: 38,
    minAccuracy: 92,
    prompt:
      'const items: Array<number> = [1, 2, 3]; function pick(list: string[]) { return { head: list[0] }; }',
  },
  {
    slug: 'code-operators-arrows',
    order: 11,
    track: 'Developer',
    title: 'Operators & Arrows',
    summary: 'Chain equality checks, logical operators, and arrow functions in fluent developer bursts.',
    focusKeys: ['=>', '===', '!==', '&&', '||', '??'],
    targetWpm: 40,
    minAccuracy: 92,
    prompt:
      'const isReady = count > 0 && status !== "idle"; const next = (v?: number) => (v ?? 1) === 1 || force;',
  },
  {
    slug: 'typescript-signatures',
    order: 12,
    track: 'Developer',
    title: 'TypeScript Signatures',
    summary: 'Put full syntax mastery together across typed interfaces, generics, and async pipelines.',
    focusKeys: ['interface', 'Promise', 'async', '=>', '<T>'],
    targetWpm: 44,
    minAccuracy: 92,
    prompt:
      'export interface ApiResult<T> { ok: boolean; data: T | null; } async function load<T>(url: string): Promise<ApiResult<T>> { return { ok: true, data: null }; }',
  },
];

export function getLessonBySlug(slug: string): CurriculumLesson | undefined {
  return CURRICULUM_LESSONS.find((lesson) => lesson.slug === slug);
}

export function getNextLesson(slug: string): CurriculumLesson | undefined {
  const current = getLessonBySlug(slug);
  if (!current) return undefined;
  return CURRICULUM_LESSONS.find((lesson) => lesson.order === current.order + 1);
}

export function computeLessonStars(
  wpm: number,
  accuracy: number,
  lesson: Pick<CurriculumLesson, 'targetWpm' | 'minAccuracy'>
): 0 | 1 | 2 | 3 {
  if (accuracy < lesson.minAccuracy) {
    return 0;
  }
  if (wpm >= lesson.targetWpm * 1.2 && accuracy >= 97) {
    return 3;
  }
  if (wpm >= lesson.targetWpm) {
    return 2;
  }
  return 1;
}

export function isLessonUnlocked(
  lesson: Pick<CurriculumLesson, 'order'>,
  progress: Record<string, LessonProgressRecord | undefined>
): boolean {
  if (lesson.order <= 1) return true;
  const previousLesson = CURRICULUM_LESSONS.find((item) => item.order === lesson.order - 1);
  if (!previousLesson) return false;
  return Boolean(progress[previousLesson.slug]?.completed);
}

