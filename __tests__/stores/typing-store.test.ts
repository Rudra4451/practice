import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useTypingStore } from '@/stores/typing-store';

describe('useTypingStore engine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useTypingStore.getState().startTestWithConfig({
      mode: 'words',
      duration: 15,
      seed: 'timer-test-seed',
      targets: [],
    });
  });

  afterEach(() => {
    useTypingStore.getState().resetTest();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('tracks live input, backspace, combo, and sets ranked status correctly', () => {
    const store = useTypingStore.getState();
    expect(store.status).toBe('idle');
    expect(store.isRankedRun).toBe(true);
    expect(store.seed).toBe('timer-test-seed');
    expect(store.clientRunId).toBeTruthy();

    const firstChar = store.targetText[0];
    const secondChar = store.targetText[1];

    store.handleInput(firstChar);
    expect(useTypingStore.getState().status).toBe('running');
    expect(useTypingStore.getState().combo).toBe(1);
    expect(useTypingStore.getState().currentIndex).toBe(1);

    // Wrong character resets combo
    store.handleInput(secondChar === 'z' ? 'x' : 'z');
    expect(useTypingStore.getState().combo).toBe(0);
    expect(useTypingStore.getState().maxCombo).toBe(1);

    store.handleBackspace();
    expect(useTypingStore.getState().currentIndex).toBe(1);
    expect(useTypingStore.getState().userInput).toBe(firstChar);
  });

  it('completes cleanly via drift-free performance.now() deadline even after sleep gap', () => {
    let fakePerfNow = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => fakePerfNow);

    useTypingStore.getState().startTestWithConfig({
      mode: 'words',
      duration: 15,
      seed: 'drift-seed',
    });

    const target = useTypingStore.getState().targetText;

    // Type several characters over the first second
    for (let i = 0; i < 6; i++) {
      fakePerfNow += 150;
      useTypingStore.getState().handleInput(target[i]);
    }

    expect(useTypingStore.getState().status).toBe('running');

    // Simulate backgrounded tab / event-loop stall where 16 seconds pass in one jump
    fakePerfNow += 16000;
    vi.advanceTimersByTime(150);

    const completedState = useTypingStore.getState();
    expect(completedState.status).toBe('completed');
    expect(completedState.timeLeft).toBe(0);
    expect(completedState.result).not.toBeNull();
    expect(completedState.result?.duration).toBe(15);
    expect(completedState.result?.wpm).toBeGreaterThanOrEqual(0);
  });

  it('marks drill runs as unranked and supports seeded reset', () => {
    useTypingStore.getState().startTestWithConfig({
      mode: 'drill',
      duration: 30,
      seed: 'drill-seed',
      targets: ['q', 'z'],
    });

    const state = useTypingStore.getState();
    expect(state.isRankedRun).toBe(false);
    expect(state.mode).toBe('drill');
    expect(state.targets).toEqual(['q', 'z']);

    const prevRunId = state.clientRunId;
    state.resetTest();

    const afterReset = useTypingStore.getState();
    expect(afterReset.clientRunId).not.toBe(prevRunId);
    expect(afterReset.seed).toBeTruthy();
    expect(afterReset.status).toBe('idle');
  });

  it('recovers gracefully if finalized with 0 input events', () => {
    let fakePerfNow = 5000;
    vi.spyOn(performance, 'now').mockImplementation(() => fakePerfNow);

    useTypingStore.getState().startTestWithConfig({
      mode: 'words',
      duration: 15,
      seed: 'empty-recover',
    });

    const firstChar = useTypingStore.getState().targetText[0];
    useTypingStore.getState().handleInput(firstChar);
    useTypingStore.getState().handleBackspace();

    fakePerfNow += 20000;
    vi.advanceTimersByTime(150);

    // Must never freeze in 'running' or crash with NaN metrics
    const finalState = useTypingStore.getState();
    expect(finalState.status).toBe('completed');
    expect(finalState.result?.wpm).toBe(0);
  });
});

