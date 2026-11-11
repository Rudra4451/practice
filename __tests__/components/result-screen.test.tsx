// @vitest-environment jsdom
import React, { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { ResultScreen } from '@/components/typing/result-screen';
import { useTypingStore } from '@/stores/typing-store';
import { useUserStore } from '@/stores/user-store';

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/typing/result-chart', () => ({
  default: () => <div data-testid="mock-result-chart">Chart</div>,
}));

const confettiMock = vi.fn();
vi.mock('canvas-confetti', () => ({
  default: confettiMock,
}));

const baseResult = {
  wpm: 85,
  rawWpm: 92,
  accuracy: 96,
  consistency: 88,
  errorCount: 2,
  backspaceCount: 4,
  correctInputKeystrokes: 96,
  totalInputKeystrokes: 100,
  duration: 30,
  elapsedSeconds: 30,
  timeline: [{ second: 1, wpm: 80, rawWpm: 88 }],
  keySpeeds: {},
  errorKeys: { q: 2 },
  bigramSpeeds: {},
  telemetry: [
    { t: 100, k: 'a', i: 0, y: 0 as const },
    { t: 250, k: 'b', i: 1, y: 0 as const },
  ],
};

describe('ResultScreen submission idempotency, PB logic, and UI details', () => {
  beforeEach(() => {
    confettiMock.mockClear();
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true, // reduced-motion default on in tests
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('submits POST /api/results strictly once even inside React StrictMode double-mount', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        result: { id: 'res-uuid-1' },
        unlocked: ['first_run'],
        isPersonalBest: true,
        previousBestWpm: 72,
        streakDays: 3,
      }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    useUserStore.setState({
      session: {
        user: { id: 'user-1' },
      } as never,
      profile: null,
      guestHistory: [],
    });

    useTypingStore.setState({
      status: 'completed',
      mode: 'words',
      duration: 30,
      seed: 'strict-seed',
      clientRunId: 'run-strict-1',
      isRankedRun: true,
      targetText: 'ab cd',
      result: baseResult,
    });

    render(
      <StrictMode>
        <ResultScreen />
      </StrictMode>
    );

    await waitFor(() => {
      expect(screen.getByText('Personal Best')).toBeTruthy();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/3d streak/i)).toBeTruthy();
    expect(screen.getByText(/96 \/ 100/)).toBeTruthy();
    const drillLink = screen.getByRole('link', { name: /Practice Weakness/i });
    expect(drillLink.getAttribute('href')).toBe('/typing?mode=drill&duration=30&targets=q');
  });

  it('never shows Personal Best badge when a prior higher guest run exists', async () => {
    useUserStore.setState({
      session: null,
      profile: null,
      guestHistory: [
        {
          id: 'old-pb',
          clientRunId: 'old-pb',
          wpm: 120,
          raw_wpm: 125,
          accuracy: 98,
          consistency: 91,
          error_count: 1,
          backspace_count: 1,
          mode: 'words',
          duration: 30,
          seed: 'older-seed',
          created_at: new Date().toISOString(),
        },
      ],
    });

    useTypingStore.setState({
      status: 'completed',
      mode: 'words',
      duration: 30,
      seed: 'new-seed',
      clientRunId: 'new-run-id',
      isRankedRun: true,
      targetText: 'hello world',
      result: { ...baseResult, wpm: 85 },
    });

    render(<ResultScreen />);

    await waitFor(() => {
      expect(useUserStore.getState().guestHistory.length).toBe(2);
    });

    expect(screen.queryByText('Personal Best')).toBeNull();
    expect(confettiMock).not.toHaveBeenCalled();
  });

  it('displays actual elapsed time on early completion while submitting canonical bracket duration', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        result: { id: 'res-early-1' },
        unlocked: [],
        isPersonalBest: false,
        previousBestWpm: 110,
        streakDays: 2,
      }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    useUserStore.setState({
      session: {
        user: { id: 'user-early' },
      } as never,
      profile: null,
      guestHistory: [],
    });

    useTypingStore.setState({
      status: 'completed',
      mode: 'quotes',
      duration: 60,
      seed: 'early-seed-1',
      clientRunId: '22222222-2222-4222-8222-222222222222',
      isRankedRun: true,
      targetText: 'quote passage completed early',
      result: { ...baseResult, duration: 60, elapsedSeconds: 18 },
    });

    render(<ResultScreen />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    const body = JSON.parse(String((fetchSpy.mock.calls[0]?.[1] as RequestInit).body));
    expect(body.duration).toBe(60);
    expect(screen.getByText(/Actual time · 60s mode/i)).toBeTruthy();
  });

  it('surfaces save error banner and retries failed submission cleanly', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Storage service unavailable.' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          result: { id: 'res-retry-ok' },
          unlocked: [],
          isPersonalBest: true,
          previousBestWpm: null,
          streakDays: 1,
        }),
      });
    vi.stubGlobal('fetch', fetchSpy);

    useUserStore.setState({
      session: {
        user: { id: 'user-retry' },
      } as never,
      profile: null,
      guestHistory: [],
    });

    useTypingStore.setState({
      status: 'completed',
      mode: 'words',
      duration: 30,
      seed: 'retry-seed-1',
      clientRunId: '33333333-3333-4333-8333-333333333333',
      isRankedRun: true,
      targetText: 'ab cd',
      result: baseResult,
    });

    render(<ResultScreen />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
    expect(screen.getByText(/Storage service unavailable\./i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Retry Save/i }));

    await waitFor(() => {
      expect(screen.getByText('Personal Best')).toBeTruthy();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('awaits an in-flight ranked save before creating a verified /challenge/[id] share link', async () => {
    let resolveResults!: (value: unknown) => void;
    const pendingResultsPromise = new Promise((resolve) => {
      resolveResults = resolve;
    });

    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextSpy },
    });

    const fetchSpy = vi
      .fn()
      .mockImplementationOnce(() => pendingResultsPromise)
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          id: 'challenge-uuid-9',
          url: '/challenge/challenge-uuid-9',
        }),
      });
    vi.stubGlobal('fetch', fetchSpy);

    useUserStore.setState({
      session: {
        user: { id: 'user-share' },
      } as never,
      profile: null,
      guestHistory: [],
    });

    useTypingStore.setState({
      status: 'completed',
      mode: 'words',
      duration: 30,
      seed: 'share-race-seed',
      clientRunId: '44444444-4444-4444-8444-444444444444',
      isRankedRun: true,
      targetText: 'ab cd',
      result: baseResult,
    });

    render(<ResultScreen />);

    // Click Share Challenge BEFORE /api/results resolves
    const shareButton = screen.getByRole('button', { name: /Share Challenge/i });
    fireEvent.click(shareButton);
    expect(screen.getByText('Creating Link...')).toBeTruthy();

    resolveResults({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        result: { id: 'res-shared-1' },
        unlocked: [],
        isPersonalBest: false,
        previousBestWpm: 95,
        streakDays: 2,
      }),
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    expect(fetchSpy.mock.calls[1]?.[0]).toBe('/api/challenges');
    const challengeReqBody = JSON.parse(
      String((fetchSpy.mock.calls[1]?.[1] as RequestInit).body)
    );
    expect(challengeReqBody.testResultId).toBe('res-shared-1');
    expect(writeTextSpy).toHaveBeenCalledWith(
      `${window.location.origin}/challenge/challenge-uuid-9`
    );
  });
});
