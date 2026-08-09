import { create } from 'zustand';
import { generateText } from '@/utils/text-generator';

export interface KeystrokeTelemetry {
  t: number; // relative time since start (ms)
  k: string; // key character
  y: number; // 0 = input, 1 = delete
  i: number; // target character index
}

export interface TestResultData {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
  errorCount: number;
  backspaceCount: number;
  duration: number;
  timeline: Array<{ second: number; wpm: number; rawWpm: number }>;
  keySpeeds: Record<string, number>;
  errorKeys: Record<string, number>;
  bigramSpeeds: Record<string, number>;
  telemetry: KeystrokeTelemetry[];
}

interface TypingState {
  // Configs
  duration: number;
  mode: 'words' | 'quotes' | 'numbers' | 'punctuation' | 'code';
  seed: string;

  // Game state
  status: 'idle' | 'running' | 'completed' | 'paused';
  targetText: string;
  userInput: string;
  currentIndex: number;
  timeLeft: number;

  // Real-time Metrics
  wpm: number;
  rawWpm: number;
  accuracy: number;
  combo: number;
  maxCombo: number;

  // Final Result Data
  result: TestResultData | null;

  // Actions
  setDuration: (duration: number) => void;
  setMode: (mode: 'words' | 'quotes' | 'numbers' | 'punctuation' | 'code') => void;
  setSeed: (seed: string) => void;
  startTest: () => void;
  startTestWithConfig: (config: { mode?: string; duration?: number; seed?: string }) => void;
  handleInput: (char: string) => void;
  handleBackspace: () => void;
  resetTest: () => void;
  pauseTest: () => void;
  resumeTest: () => void;
}

let workerInstance: Worker | null = null;
let timerInterval: ReturnType<typeof setInterval> | null = null;

function getWorker(onMessage: (e: MessageEvent) => void): Worker | null {
  if (typeof window === 'undefined') return null;
  if (!workerInstance) {
    workerInstance = new Worker(new URL('@/workers/analytics.worker.ts', import.meta.url));
  }
  workerInstance.onmessage = onMessage;
  return workerInstance;
}

function clearTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

export const useTypingStore = create<TypingState>((set, get) => {
  const handleWorkerMessage = (e: MessageEvent) => {
    const { type, payload } = e.data;

    if (type === 'TICK') {
      set({
        wpm: payload.wpm,
        rawWpm: payload.rawWpm,
        accuracy: payload.accuracy,
      });
    } else if (type === 'RESULT') {
      clearTimer();
      set({
        status: 'completed',
        result: payload as TestResultData,
        wpm: payload.wpm,
        rawWpm: payload.rawWpm,
        accuracy: payload.accuracy,
        timeLeft: 0,
      });
    }
  };

  const initAndStart = (duration: number, mode: string, seed: string) => {
    clearTimer();
    const text = generateText(seed, mode, duration);

    const worker = getWorker(handleWorkerMessage);
    if (worker) {
      worker.postMessage({
        type: 'INIT',
        payload: { duration, mode },
      });
    }

    set({
      seed,
      targetText: text,
      userInput: '',
      currentIndex: 0,
      timeLeft: duration,
      status: 'idle',
      wpm: 0,
      rawWpm: 0,
      accuracy: 100,
      combo: 0,
      maxCombo: 0,
      result: null,
    });
  };

  return {
    // Default Configs
    duration: 30,
    mode: 'words',
    seed: '',

    // Default Game State
    status: 'idle',
    targetText: '',
    userInput: '',
    currentIndex: 0,
    timeLeft: 30,
    wpm: 0,
    rawWpm: 0,
    accuracy: 100,
    combo: 0,
    maxCombo: 0,
    result: null,

    setDuration: (duration) => set({ duration, timeLeft: duration }),
    setMode: (mode) => set({ mode }),
    setSeed: (seed) => set({ seed }),

    startTest: () => {
      const { duration, mode, seed } = get();
      const activeSeed = seed || Math.random().toString(36).substring(7);
      initAndStart(duration, mode, activeSeed);
    },

    // Atomic config + start — avoids race condition when mode/duration change simultaneously
    startTestWithConfig: ({ mode, duration, seed } = {}) => {
      const current = get();
      const finalMode = (mode as TypingState['mode']) ?? current.mode;
      const finalDuration = duration ?? current.duration;
      const finalSeed = seed ?? (Math.random().toString(36).substring(7));

      set({ mode: finalMode, duration: finalDuration });
      initAndStart(finalDuration, finalMode, finalSeed);
    },

    handleInput: (char) => {
      const { status, targetText, currentIndex, userInput } = get();

      if (status === 'completed' || status === 'paused') return;

      const now = performance.now();
      const worker = getWorker(handleWorkerMessage);

      // Start timer on the very first keypress
      if (status === 'idle') {
        set({ status: 'running' });

        clearTimer();
        timerInterval = setInterval(() => {
          const { timeLeft, status: currentStatus } = get();
          if (currentStatus !== 'running') {
            clearTimer();
            return;
          }

          if (timeLeft <= 1) {
            // Show 0 on the display, then finalize
            set({ timeLeft: 0 });
            clearTimer();
            const w = getWorker(handleWorkerMessage);
            if (w) w.postMessage({ type: 'FINALIZE' });
          } else {
            set({ timeLeft: timeLeft - 1 });
          }
        }, 1000);
      }

      const expectedKey = targetText[currentIndex];
      const isCorrect = char === expectedKey;
      const currentCombo = isCorrect ? get().combo + 1 : 0;
      const newMaxCombo = Math.max(currentCombo, get().maxCombo);

      if (worker) {
        worker.postMessage({
          type: 'KEYSTROKE',
          payload: {
            key: char,
            time: now,
            index: currentIndex,
            expectedKey,
            type: 'input',
          },
        });
      }

      const newUserInput = userInput + char;
      const nextIndex = currentIndex + 1;

      set({
        userInput: newUserInput,
        currentIndex: nextIndex,
        combo: currentCombo,
        maxCombo: newMaxCombo,
      });

      // Complete test if typing reached end of text
      if (nextIndex >= targetText.length) {
        set({ timeLeft: 0 });
        clearTimer();
        if (worker) {
          worker.postMessage({ type: 'FINALIZE' });
        }
      }
    },

    handleBackspace: () => {
      const { status, currentIndex, userInput } = get();
      if (status !== 'running' || currentIndex === 0) return;

      const now = performance.now();
      const worker = getWorker(handleWorkerMessage);

      if (worker) {
        worker.postMessage({
          type: 'KEYSTROKE',
          payload: {
            key: 'Backspace',
            time: now,
            index: currentIndex - 1,
            expectedKey: '',
            type: 'delete',
          },
        });
      }

      set({
        userInput: userInput.slice(0, -1),
        currentIndex: currentIndex - 1,
      });
    },

    resetTest: () => {
      clearTimer();
      const { duration, mode } = get();
      const newSeed = Math.random().toString(36).substring(7);
      set({ seed: '' });
      initAndStart(duration, mode, newSeed);
    },

    pauseTest: () => {
      if (get().status === 'running') {
        clearTimer();
        set({ status: 'paused' });
      }
    },

    resumeTest: () => {
      const { status } = get();
      if (status !== 'paused') return;

      set({ status: 'running' });

      const worker = getWorker(handleWorkerMessage);
      timerInterval = setInterval(() => {
        const { timeLeft: tl, status: s } = get();
        if (s !== 'running') {
          clearTimer();
          return;
        }
        if (tl <= 1) {
          set({ timeLeft: 0 });
          clearTimer();
          if (worker) worker.postMessage({ type: 'FINALIZE' });
        } else {
          set({ timeLeft: tl - 1 });
        }
      }, 1000);
    },
  };
});
