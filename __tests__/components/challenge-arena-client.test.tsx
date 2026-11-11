// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChallengeArenaClient } from '@/components/challenge/challenge-arena-client';
import { useTypingStore } from '@/stores/typing-store';
import { useUserStore } from '@/stores/user-store';
import type { ChallengeLinkDetails } from '@/lib/data/challenge';
import { verifyAndScoreSession, type SubmitResultPayload } from '@/lib/typing/verifier';

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  }),
}));

vi.mock('@/lib/audio/keystroke-sound', () => ({
  playKeystrokeSound: vi.fn(),
}));

const sampleChallenge: ChallengeLinkDetails = {
  id: '99999999-9999-4999-8999-999999999999',
  creator_id: 'creator-1',
  creator_wpm: 80,
  creator_accuracy: 96,
  mode: 'code',
  duration: 60,
  seed: 'challengeSeed99',
  profiles: {
    username: 'rival',
    display_name: 'Rival Typist',
    avatar_url: null,
  },
};

const shortChallenge: ChallengeLinkDetails = {
  id: '88888888-8888-4888-8888-888888888888',
  creator_id: 'creator-1',
  creator_wpm: 72,
  creator_accuracy: 95,
  mode: 'words',
  duration: 15,
  seed: 'challengeShort15',
  profiles: {
    username: 'rival',
    display_name: 'Rival Typist',
    avatar_url: null,
  },
};

describe('ChallengeArenaClient real TypingContainer integration, restart safety, retry recovery, and cleanup', () => {
  beforeEach(() => {
    useTypingStore.setState({
      mode: 'words',
      duration: 30,
      seed: 'initialSeed',
      status: 'idle',
      result: null,
      clientRunId: '',
      targetText: '',
      userInput: '',
      currentIndex: 0,
    });
    useUserStore.setState({
      session: null,
      profile: null,
      guestHistory: [],
      preferences: {
        theme: 'dark',
        font_family: 'jetbrains-mono',
        volume: 0,
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('locks mode/duration bar, preserves challenge config on Escape & Restart Test, passes real server verification after restart, alerts on error, and cleans up on unmount', async () => {
    let fakeNowMs = 1_000;
    let perfReadCount = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => {
      perfReadCount += 1;
      fakeNowMs += 46 + (perfReadCount % 5) * 3;
      return fakeNowMs;
    });

    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Database temporarily busy.' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });
    vi.stubGlobal('fetch', fetchSpy);

    useUserStore.setState({
      session: { user: { id: 'challenger-1' } } as never,
      profile: null,
      guestHistory: [],
    });

    const { unmount } = render(<ChallengeArenaClient challenge={shortChallenge} />);

    fireEvent.click(screen.getByRole('button', { name: /Accept Challenge/i }));

    // Real TypingContainer mounts with config bar hidden
    const textarea = screen.getByLabelText('Typing input area') as HTMLTextAreaElement;
    expect(screen.queryByRole('button', { name: '15s' })).toBeNull();
    expect(screen.queryByRole('button', { name: '30s' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'quotes' })).toBeNull();

    const initialState = useTypingStore.getState();
    const challengeTarget = initialState.targetText;
    const firstClientRunId = initialState.clientRunId;
    expect(initialState.seed).toBe('challengeShort15');
    expect(initialState.mode).toBe('words');
    expect(initialState.duration).toBe(15);
    expect(challengeTarget.length).toBeGreaterThan(20);

    // 1. Type partial progress, then trigger Escape inside real TypingContainer
    fireEvent.change(textarea, {
      target: { value: `\u200B${challengeTarget.slice(0, 4)}` },
    });
    expect(useTypingStore.getState().status).toBe('running');
    expect(useTypingStore.getState().currentIndex).toBe(4);

    fireEvent.keyDown(textarea, { key: 'Escape' });

    const afterEscape = useTypingStore.getState();
    expect(afterEscape.seed).toBe('challengeShort15');
    expect(afterEscape.mode).toBe('words');
    expect(afterEscape.duration).toBe(15);
    expect(afterEscape.targetText).toBe(challengeTarget);
    expect(afterEscape.status).toBe('idle');
    expect(afterEscape.currentIndex).toBe(0);
    expect(afterEscape.clientRunId).not.toBe(firstClientRunId);

    // 2. Type again, then click visible "Restart Test" button
    const secondClientRunId = afterEscape.clientRunId;
    fireEvent.change(textarea, {
      target: { value: `\u200B${challengeTarget.slice(0, 3)}` },
    });
    expect(useTypingStore.getState().status).toBe('running');

    fireEvent.click(screen.getByRole('button', { name: /Restart Test/i }));

    const afterRestartButton = useTypingStore.getState();
    expect(afterRestartButton.seed).toBe('challengeShort15');
    expect(afterRestartButton.mode).toBe('words');
    expect(afterRestartButton.duration).toBe(15);
    expect(afterRestartButton.targetText).toBe(challengeTarget);
    expect(afterRestartButton.status).toBe('idle');
    expect(afterRestartButton.currentIndex).toBe(0);
    expect(afterRestartButton.clientRunId).not.toBe(secondClientRunId);

    // 2b. Verify unfocused window Escape also routes through challenge restart override
    const thirdClientRunId = afterRestartButton.clientRunId;
    fireEvent.change(textarea, {
      target: { value: `\u200B${challengeTarget.slice(0, 2)}` },
    });
    expect(useTypingStore.getState().status).toBe('running');
    fireEvent.blur(textarea);
    fireEvent.keyDown(window, { key: 'Escape' });

    const afterWindowEscape = useTypingStore.getState();
    expect(afterWindowEscape.seed).toBe('challengeShort15');
    expect(afterWindowEscape.mode).toBe('words');
    expect(afterWindowEscape.duration).toBe(15);
    expect(afterWindowEscape.status).toBe('idle');
    expect(afterWindowEscape.currentIndex).toBe(0);
    expect(afterWindowEscape.clientRunId).not.toBe(thirdClientRunId);

    // 3. Complete full challenge prompt through real TypingContainer after restarts
    fireEvent.change(textarea, {
      target: { value: `\u200B${challengeTarget}` },
    });

    await waitFor(() => {
      const alertBanner = screen.getByRole('alert');
      expect(alertBanner.textContent).toMatch(/Database temporarily busy\./i);
    });

    // Real server verifier accepts the exact POST payload submitted after Escape + Restart Test
    const firstBody = JSON.parse(
      String((fetchSpy.mock.calls[0]?.[1] as RequestInit).body)
    ) as SubmitResultPayload;
    expect(firstBody.seed).toBe('challengeShort15');
    expect(firstBody.mode).toBe('words');
    expect(firstBody.duration).toBe(15);
    expect(firstBody.clientRunId).toBe(afterWindowEscape.clientRunId);

    const serverCheck = verifyAndScoreSession(firstBody);
    expect(serverCheck.ok ? 'ok' : `${serverCheck.error} (len=${firstBody.telemetry.length}, firstT=${firstBody.telemetry[0]?.t}, lastT=${firstBody.telemetry[firstBody.telemetry.length - 1]?.t})`).toBe('ok');

    fireEvent.click(screen.getByRole('button', { name: /Retry Save/i }));

    await waitFor(() => {
      expect(screen.getByText(/Result verified and saved to your history\./i)).toBeTruthy();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Exiting challenge resets active typing store off challenge seed even after restarts
    unmount();
    expect(useTypingStore.getState().seed).not.toBe('challengeShort15');
    expect(useTypingStore.getState().status).toBe('idle');
    expect(useTypingStore.getState().result).toBeNull();
  });

  it('completes a full 60s code challenge through real TypingContainer, passes server verification, submits canonical bracket duration, and cleans up on unmount', async () => {
    const fetchSpy = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    useUserStore.setState({
      session: { user: { id: 'challenger-2' } } as never,
      profile: null,
      guestHistory: [],
    });

    const { unmount } = render(<ChallengeArenaClient challenge={sampleChallenge} />);
    fireEvent.click(screen.getByRole('button', { name: /Accept Challenge/i }));

    const textarea = screen.getByLabelText('Typing input area') as HTMLTextAreaElement;
    const challengeTarget = useTypingStore.getState().targetText;
    const activeClientRunId = useTypingStore.getState().clientRunId;
    expect(useTypingStore.getState().mode).toBe('code');
    expect(useTypingStore.getState().duration).toBe(60);
    expect(challengeTarget.length).toBeGreaterThan(200);

    // Space keystrokes dynamically across ~68_000ms (< 80_000ms max window, < 200 WPM ceiling)
    const baseMsPerChar = Math.max(58, Math.floor(68_000 / challengeTarget.length));
    let fakeNowMs = 2_000;
    let perfReadCount = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => {
      perfReadCount += 1;
      fakeNowMs += baseMsPerChar + (perfReadCount % 5) * 2;
      return fakeNowMs;
    });

    fireEvent.change(textarea, {
      target: { value: `\u200B${challengeTarget}` },
    });

    await waitFor(() => {
      expect(screen.getByText(/Result verified and saved to your history\./i)).toBeTruthy();
    });

    const submittedBody = JSON.parse(
      String((fetchSpy.mock.calls[0]?.[1] as RequestInit).body)
    ) as SubmitResultPayload;
    expect(submittedBody.mode).toBe('code');
    expect(submittedBody.duration).toBe(60);
    expect(submittedBody.seed).toBe('challengeSeed99');
    expect(submittedBody.clientRunId).toBe(activeClientRunId);

    const serverCheck = verifyAndScoreSession(submittedBody);
    expect(
      serverCheck.ok
        ? 'ok'
        : `${serverCheck.error} (len=${submittedBody.telemetry.length}, firstT=${submittedBody.telemetry[0]?.t}, lastT=${submittedBody.telemetry[submittedBody.telemetry.length - 1]?.t})`
    ).toBe('ok');

    // Retry Challenge from comparison screen resets back into active typing arena cleanly
    fireEvent.click(screen.getByRole('button', { name: /Retry Challenge/i }));
    expect(screen.getByLabelText('Typing input area')).toBeTruthy();
    expect(useTypingStore.getState().status).toBe('idle');
    expect(useTypingStore.getState().clientRunId).not.toBe(activeClientRunId);

    unmount();
    expect(useTypingStore.getState().seed).not.toBe('challengeSeed99');
    expect(useTypingStore.getState().status).toBe('idle');
  });

  it('records guest challenge completions through real TypingContainer with canonical duration, verified telemetry, and isRanked: true', async () => {
    render(<ChallengeArenaClient challenge={sampleChallenge} />);
    fireEvent.click(screen.getByRole('button', { name: /Accept Challenge/i }));

    const textarea = screen.getByLabelText('Typing input area') as HTMLTextAreaElement;
    const challengeTarget = useTypingStore.getState().targetText;
    const guestClientRunId = useTypingStore.getState().clientRunId;

    const baseMsPerChar = Math.max(58, Math.floor(68_000 / challengeTarget.length));
    let fakeNowMs = 3_000;
    let perfReadCount = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => {
      perfReadCount += 1;
      fakeNowMs += baseMsPerChar + (perfReadCount % 5) * 2;
      return fakeNowMs;
    });

    fireEvent.change(textarea, {
      target: { value: `\u200B${challengeTarget}` },
    });

    await waitFor(() => {
      expect(useUserStore.getState().guestHistory).toHaveLength(1);
    });

    const savedGuest = useUserStore.getState().guestHistory[0];
    expect(savedGuest.clientRunId).toBe(guestClientRunId);
    expect(savedGuest.duration).toBe(60);
    expect(savedGuest.isRanked).toBe(true);
    expect(savedGuest.mode).toBe('code');
    expect(savedGuest.telemetry?.length).toBe(challengeTarget.length);

    const serverCheck = verifyAndScoreSession({
      mode: 'code',
      duration: 60,
      seed: 'challengeSeed99',
      clientRunId: savedGuest.clientRunId,
      telemetry: savedGuest.telemetry!,
    });
    expect(serverCheck.ok).toBe(true);
  });
});

