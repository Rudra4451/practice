// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import PerformanceLabPage from '@/app/dashboard/performance-lab/page';
import { useUserStore } from '@/stores/user-store';

const mockRealtimeEnabled = vi.fn<() => boolean>();
const mockChannel = vi.fn();
const mockOn = vi.fn();
const mockSubscribe = vi.fn();
const mockRemoveChannel = vi.fn();
const mockLimit = vi.fn();

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/navbar', () => ({
  Navbar: () => <nav data-testid="mock-navbar" />,
}));

vi.mock('@/lib/hooks/use-hydrated', () => ({
  useHydrated: () => true,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseRealtimeEnabled: () => mockRealtimeEnabled(),
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({
              limit: mockLimit,
            }),
          }),
        }),
      }),
    }),
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  }),
}));

describe('PerformanceLabPage Realtime guard', () => {
  beforeEach(() => {
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockSubscribe.mockReturnValue({ topic: 'lab-channel' });
    mockOn.mockImplementation(() => ({
      subscribe: mockSubscribe,
    }));
    mockChannel.mockImplementation(() => ({
      on: mockOn,
    }));

    useUserStore.setState({
      session: { user: { id: 'lab-user-123' } } as never,
      profile: {
        id: 'lab-user-123',
        username: 'lab_typist',
        display_name: 'Lab Typist',
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
    vi.clearAllMocks();
  });

  it('skips creating a Realtime WebSocket channel when isSupabaseRealtimeEnabled returns false', async () => {
    mockRealtimeEnabled.mockReturnValue(false);

    render(<PerformanceLabPage />);

    await waitFor(() => {
      expect(mockLimit).toHaveBeenCalledTimes(1);
    });
    expect(mockRealtimeEnabled).toHaveBeenCalled();
    expect(mockChannel).not.toHaveBeenCalled();
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it('subscribes to scoped user_id channel when isSupabaseRealtimeEnabled returns true and cleans up on unmount', async () => {
    mockRealtimeEnabled.mockReturnValue(true);

    const { unmount } = render(<PerformanceLabPage />);

    await waitFor(() => {
      expect(mockChannel).toHaveBeenCalledWith('lab-results-lab-user-123');
    });

    expect(mockOn).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'test_results',
        filter: 'user_id=eq.lab-user-123',
      },
      expect.any(Function)
    );
    expect(mockSubscribe).toHaveBeenCalledTimes(1);

    unmount();
    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
  });
});
