import { create } from 'zustand';
import {
  RANKED_MODES,
  createMetricsTracker,
  evaluateFinalSession,
  type CompletionReason,
  type CompressedTelemetryPoint,
  type KeystrokeInputEvent,
  type TimelinePoint,
  type TypingMode,
  type TypingSessionResult,
} from '@/lib/typing/metrics';
import { createSeed, generateText } from '@/lib/typing/text-generator';

export type KeystrokeTelemetry = CompressedTelemetryPoint;

export type TestResultData = TypingSessionResult & {
  timeline: TimelinePoint[];
};

interface TypingState {
  // Configs
  duration: number;
  mode: TypingMode;
  seed: string;
  targets: string[];
  clientRunId: string;
  isRankedRun: boolean;

  // Game state
  status: 'idle' | 'running' | 'completed';
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
  setMode: (mode: TypingMode) => void;
  setSeed: (seed: string) => void;
  startTest: () => void;
  startTestWithConfig: (config?: {
    mode?: TypingMode;
    duration?: number;
    seed?: string;
    targets?: string[];
  }) => void;
  handleInput: (char: string) => void;
  handleBackspace: () => void;
  resetTest: () => void;
}

let workerInstance: Worker | null = null;
let timerInterval: ReturnType<typeof setInterval> | null = null;
let timerDeadlineMs: number | null = null;
let isFinalizing = false;

// Fallback event buffer when running without Web Worker support (e.g., jsdom tests)
let fallbackEvents: KeystrokeInputEvent[] = [];
let fallbackStartTime: number | null = null;
let fallbackTracker = createMetricsTracker();

function generateRunId(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }
  return `00000000-0000-4000-8000-${createSeed()}`;
}

function getWorker(onMessage: (e: MessageEvent) => void): Worker | null {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return null;
  if (!workerInstance) {
    try {
      workerInstance = new Worker(
        new URL('@/workers/analytics.worker.ts', import.meta.url)
      );
    } catch {
      return null;
    }
  }
  workerInstance.onmessage = onMessage;
  return workerInstance;
}

function clearTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerDeadlineMs = null;
}

function checkIsRankedMode(mode: TypingMode): boolean {
  return (RANKED_MODES as readonly string[]).includes(mode);
}

export const useTypingStore = create<TypingState>((set, get) => {
  const handleWorkerMessage = (e: MessageEvent) => {
    const { type, payload } = e.data as {
      type: string;
      payload?: unknown;
    };

    if (type === 'TICK' && payload && typeof payload === 'object') {
      const tick = payload as { wpm: number; rawWpm: number; accuracy: number };
      set({
        wpm: tick.wpm,
        rawWpm: tick.rawWpm,
        accuracy: tick.accuracy,
      });
    } else if (type === 'RESULT' && payload && typeof payload === 'object') {
      isFinalizing = false;
      clearTimer();
      const resPayload = payload as TestResultData;
      set({
        status: 'completed',
        result: resPayload,
        wpm: resPayload.wpm,
        rawWpm: resPayload.rawWpm,
        accuracy: resPayload.accuracy,
        timeLeft: 0,
      });
    } else if (type === 'ERROR') {
      isFinalizing = false;
      clearTimer();
      const { duration } = get();
      set({
        status: 'idle',
        userInput: '',
        currentIndex: 0,
        timeLeft: duration,
        wpm: 0,
        rawWpm: 0,
        accuracy: 100,
        combo: 0,
        maxCombo: 0,
        result: null,
      });
    }
  };

  const finalizeSession = (reason: CompletionReason, endTime: number) => {
    if (isFinalizing) return;
    isFinalizing = true;
    clearTimer();

    const worker = getWorker(handleWorkerMessage);
    if (worker) {
      worker.postMessage({
        type: 'FINALIZE',
        payload: { reason, endTime },
      });
      return;
    }

    // Synchronous isomorphic fallback when Web Worker is unavailable (tests/constrained runtimes)
    const { duration } = get();
    const res = evaluateFinalSession(fallbackEvents, {
      durationLimit: duration,
      reason,
      endTime,
    });
    isFinalizing = false;

    if (!res) {
      set({
        status: 'idle',
        userInput: '',
        currentIndex: 0,
        timeLeft: duration,
        wpm: 0,
        rawWpm: 0,
        accuracy: 100,
        combo: 0,
        maxCombo: 0,
        result: null,
      });
      return;
    }

    set({
      status: 'completed',
      result: res,
      wpm: res.wpm,
      rawWpm: res.rawWpm,
      accuracy: res.accuracy,
      timeLeft: 0,
    });
  };

  const initAndStart = (
    duration: number,
    mode: TypingMode,
    seed: string,
    targets: string[]
  ) => {
    isFinalizing = false;
    clearTimer();

    fallbackEvents = [];
    fallbackStartTime = null;
    fallbackTracker = createMetricsTracker();

    const text = generateText(seed, mode, duration, { targets });
    const worker = getWorker(handleWorkerMessage);
    if (worker) {
      worker.postMessage({
        type: 'INIT',
        payload: { duration, mode },
      });
    }

    set({
      seed,
      mode,
      duration,
      targets,
      clientRunId: generateRunId(),
      isRankedRun: checkIsRankedMode(mode),
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
    duration: 30,
    mode: 'words',
    seed: '',
    targets: [],
    clientRunId: '',
    isRankedRun: true,

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
    setMode: (mode) => set({ mode, isRankedRun: checkIsRankedMode(mode) }),
    setSeed: (seed) => set({ seed }),

    startTest: () => {
      const { duration, mode, seed, targets } = get();
      const activeSeed = seed || createSeed();
      initAndStart(duration, mode, activeSeed, targets);
    },

    startTestWithConfig: ({ mode, duration, seed, targets } = {}) => {
      const current = get();
      const finalMode = mode ?? current.mode;
      const finalDuration = duration ?? current.duration;
      const finalSeed = seed ?? createSeed();
      const finalTargets = targets ?? current.targets;

      initAndStart(finalDuration, finalMode, finalSeed, finalTargets);
    },

    handleInput: (char) => {
      const { status, targetText, currentIndex, userInput, duration } = get();

      if (status === 'completed' || isFinalizing) return;
      if (!targetText || currentIndex >= targetText.length) return;

      const now = performance.now();
      const worker = getWorker(handleWorkerMessage);

      if (status === 'idle') {
        set({ status: 'running' });

        clearTimer();
        timerDeadlineMs = now + duration * 1000;
        timerInterval = setInterval(() => {
          const { status: currentStatus, timeLeft: prevTimeLeft } = get();
          if (currentStatus !== 'running' || timerDeadlineMs === null) {
            clearTimer();
            return;
          }

          const remainingMs = timerDeadlineMs - performance.now();
          if (remainingMs <= 0) {
            set({ timeLeft: 0 });
            finalizeSession('timer', timerDeadlineMs);
            return;
          }

          const nextSecs = Math.max(0, Math.ceil(remainingMs / 1000));
          if (nextSecs !== prevTimeLeft) {
            set({ timeLeft: nextSecs });
          }
        }, 100);
      }

      const expectedKey = targetText[currentIndex];
      const isCorrect = char === expectedKey;
      const currentCombo = isCorrect ? get().combo + 1 : 0;
      const newMaxCombo = Math.max(currentCombo, get().maxCombo);

      const eventPayload: KeystrokeInputEvent = {
        key: char,
        time: now,
        index: currentIndex,
        expectedKey,
        type: 'input',
      };

      if (worker) {
        worker.postMessage({
          type: 'KEYSTROKE',
          payload: eventPayload,
        });
      } else {
        if (fallbackStartTime === null) fallbackStartTime = now;
        fallbackEvents.push(eventPayload);
        fallbackTracker.apply(eventPayload);
        const snap = fallbackTracker.snapshot(now - fallbackStartTime);
        set({
          wpm: snap.wpm,
          rawWpm: snap.rawWpm,
          accuracy: snap.accuracy,
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

      if (nextIndex >= targetText.length) {
        set({ timeLeft: 0 });
        finalizeSession('text_complete', now);
      }
    },

    handleBackspace: () => {
      const { status, currentIndex, userInput } = get();
      if (status !== 'running' || currentIndex === 0 || isFinalizing) return;

      const now = performance.now();
      const deleteIdx = currentIndex - 1;
      const worker = getWorker(handleWorkerMessage);

      const eventPayload: KeystrokeInputEvent = {
        key: 'Backspace',
        time: now,
        index: deleteIdx,
        expectedKey: '',
        type: 'delete',
      };

      if (worker) {
        worker.postMessage({
          type: 'KEYSTROKE',
          payload: eventPayload,
        });
      } else {
        fallbackEvents.push(eventPayload);
        fallbackTracker.apply(eventPayload);
        if (fallbackStartTime !== null) {
          const snap = fallbackTracker.snapshot(now - fallbackStartTime);
          set({
            wpm: snap.wpm,
            rawWpm: snap.rawWpm,
            accuracy: snap.accuracy,
          });
        }
      }

      set({
        userInput: userInput.slice(0, -1),
        currentIndex: deleteIdx,
      });
    },

    resetTest: () => {
      clearTimer();
      isFinalizing = false;
      const { duration, mode, targets } = get();
      const newSeed = createSeed();
      initAndStart(duration, mode, newSeed, targets);
    },
  };
});
