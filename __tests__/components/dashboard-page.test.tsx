// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DashboardPage from '@/app/dashboard/page';
import { useUserStore, type GuestResult } from '@/stores/user-store';

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/dynamic', () => ({
  default: () => function MockChart() {
    return <div data-testid="dashboard-chart" />;
  },
}));

vi.mock('@/components/navbar', () => ({
  Navbar: () => <nav data-testid="mock-navbar" />,
}));

vi.mock('@/lib/hooks/use-hydrated', () => ({
  useHydrated: () => true,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
    channel: () => ({
      on: function on() {
        return this;
      },
      subscribe: () => ({}),
    }),
    removeChannel: vi.fn(),
  }),
}));

function makeGuestRun(id: string, overrides?: Partial<GuestResult>): GuestResult {
  return {
    id,
    clientRunId: id,
    wpm: 70,
    raw_wpm: 74,
    accuracy: 96,
    consistency: 90,
    error_count: 1,
    backspace_count: 1,
    mode: 'words',
    duration: 30,
    seed: `seed-${id}`,
    isRanked: true,
    telemetry: [
      { t: 0, k: 'a', y: 0, i: 0 },
      { t: 120, k: 'b', y: 0, i: 1 },
    ],
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('DashboardPage guest history non-looping sync & Retry Held Runs recovery', () => {
  beforeEach(() => {
    useUserStore.setState({
      session: { user: { id: 'signed-in-user' } } as never,
      profile: {
        id: 'signed-in-user',
        username: 'typist_test',
        display_name: 'Typist Test',
        avatar_url: null,
        theme: 'dark',
        font_family: 'jetbrains-mono',
        created_at: new Date().toISOString(),
      },
      guestHistory: [],
      lessonProgress: {},
      dailyCompletions: {},
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('suppresses auto-sync banner for invalid-duration and held-rejected runs while exposing Retry Held Runs recovery', async () => {
    const legacyInvalidRun = makeGuestRun('11111111-1111-4111-8111-111111111111', {
      duration: 12,
    });
    const heldRejectedRun = makeGuestRun('22222222-2222-4222-8222-222222222222', {
      duration: 30,
      syncStatus: 'rejected',
      syncRejectionReason: 'Cadence check failed.',
    });

    useUserStore.setState({
      guestHistory: [legacyInvalidRun, heldRejectedRun],
    });

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          syncedCount: 1,
          syncedIds: [heldRejectedRun.clientRunId],
          duplicateIds: [],
          rejectedIds: [],
          failedIds: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<DashboardPage />);

    // Sync History banner must NOT loop while only invalid-duration + rejected runs exist
    expect(screen.queryByRole('button', { name: /Sync History/i })).toBeNull();
    expect(screen.getByText(/Local-Only \/ Paused Runs Preserved/i)).toBeTruthy();

    // Explicit Retry Held Runs re-queues held run cleanly without deleting legacy run or telemetry
    fireEvent.click(screen.getByRole('button', { name: /Retry Held Runs/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Sync History/i })).toBeTruthy();
    });
    expect(useUserStore.getState().guestHistory).toHaveLength(2);

    // Clicking Sync History now syncs only the recovered valid-duration run, leaving legacy 12s untouched
    fireEvent.click(screen.getByRole('button', { name: /Sync History/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(useUserStore.getState().guestHistory).toHaveLength(1);
    });

    const remaining = useUserStore.getState().guestHistory[0];
    expect(remaining.id).toBe(legacyInvalidRun.id);
    expect(remaining.telemetry).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Sync History/i })).toBeNull();
  });

  it('auto-holds pending runs after 3 transient server failures while preserving telemetry and permitting Retry Held Runs', async () => {
    const flakyRun = makeGuestRun('33333333-3333-4333-8333-333333333333', {
      duration: 30,
    });
    useUserStore.setState({ guestHistory: [flakyRun] });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Temporary outage 1' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Temporary outage 2' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Temporary outage 3' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            syncedCount: 1,
            syncedIds: [flakyRun.clientRunId],
            duplicateIds: [],
            rejectedIds: [],
            failedIds: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    render(<DashboardPage />);

    // Attempts 1, 2 -> stays pending & retryable; Attempt 3 -> automatically transitions to 'held'
    for (let i = 0; i < 3; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: /Sync History/i }));
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(i + 1);
      });
    }

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Sync History/i })).toBeNull();
      expect(screen.getByRole('button', { name: /Retry Held Runs/i })).toBeTruthy();
    });

    const heldRun = useUserStore.getState().guestHistory[0];
    expect(heldRun.syncStatus).toBe('held');
    expect(heldRun.syncAttemptCount).toBe(3);
    expect(heldRun.telemetry).toHaveLength(2);

    // Retry Held Runs resets back to pending, and the next Sync History attempt succeeds
    fireEvent.click(screen.getByRole('button', { name: /Retry Held Runs/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Sync History/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Sync History/i }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(useUserStore.getState().guestHistory).toHaveLength(0);
    });
  });
});

