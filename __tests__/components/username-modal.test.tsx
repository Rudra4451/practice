// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UsernameModal } from '@/components/auth/username-modal';
import { useUserStore } from '@/stores/user-store';

describe('UsernameModal onboarding & security validation', () => {
  beforeEach(() => {
    useUserStore.setState({
      session: {
        user: {
          id: 'user-1',
          user_metadata: { full_name: 'Alex Typist' },
        },
      } as never,
      profile: {
        id: 'user-1',
        username: 'user_1234abcd_deadbeef',
        display_name: null,
        avatar_url: null,
        theme: 'dark',
        font_family: 'jetbrains-mono',
        created_at: new Date().toISOString(),
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('opens for collision-suffixed temporary handles, blocks reserved/placeholder names, and submits valid custom handle', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          profile: {
            id: 'user-1',
            username: 'alex_keys',
            display_name: 'Alex Typist',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<UsernameModal />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/Choose Your Handle/i)).toBeTruthy();

    const input = screen.getByLabelText(/Unique Username/i) as HTMLInputElement;

    // Reserved name rejected client-side
    fireEvent.change(input, { target: { value: 'admin' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Handle/i }));
    expect(screen.getByText(/This username is reserved/i)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();

    // Valid custom handle submits via PATCH /api/profile and closes modal cleanly
    fireEvent.change(input, { target: { value: 'alex_keys' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Handle/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(useUserStore.getState().profile?.username).toBe('alex_keys');
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

