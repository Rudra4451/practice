// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TypingContainer } from '@/components/typing/typing-container';
import { useTypingStore } from '@/stores/typing-store';
import { useUserStore } from '@/stores/user-store';

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

describe('TypingContainer mobile, IME, and focus ergonomics', () => {
  beforeEach(() => {
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
    useTypingStore.getState().startTestWithConfig({
      mode: 'words',
      duration: 30,
      seed: 'container-test-seed',
      targets: [],
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('commits multi-character mobile swipe/autocorrect batch input in sequence', () => {
    render(<TypingContainer />);
    const textarea = screen.getByLabelText('Typing input area') as HTMLTextAreaElement;

    const target = useTypingStore.getState().targetText;
    const expectedSlice = target.slice(0, 4);

    fireEvent.focus(textarea);
    fireEvent.change(textarea, {
      target: { value: `\u200B${expectedSlice}` },
    });

    expect(useTypingStore.getState().userInput).toBe(expectedSlice);
    expect(useTypingStore.getState().currentIndex).toBe(4);
    expect(textarea.value).toBe('\u200B');
  });

  it('defers IME composition until compositionend before committing text', () => {
    render(<TypingContainer />);
    const textarea = screen.getByLabelText('Typing input area') as HTMLTextAreaElement;

    const target = useTypingStore.getState().targetText;
    const expectedSlice = target.slice(0, 2);

    fireEvent.compositionStart(textarea);
    fireEvent.change(textarea, {
      target: { value: `\u200B${expectedSlice}` },
    });

    // Must not commit while composing
    expect(useTypingStore.getState().currentIndex).toBe(0);

    fireEvent.compositionEnd(textarea, {
      data: expectedSlice,
      currentTarget: textarea,
    });

    expect(useTypingStore.getState().userInput).toBe(expectedSlice);
    expect(useTypingStore.getState().currentIndex).toBe(2);
  });

  it('handles Android Unidentified Backspace when sentinel character is deleted', () => {
    render(<TypingContainer />);
    const textarea = screen.getByLabelText('Typing input area') as HTMLTextAreaElement;

    const target = useTypingStore.getState().targetText;
    fireEvent.change(textarea, {
      target: { value: `\u200B${target.slice(0, 2)}` },
    });
    expect(useTypingStore.getState().currentIndex).toBe(2);

    // Android virtual keyboard deletes the leading sentinel without a reliable KeyDown
    fireEvent.change(textarea, { target: { value: '' } });

    expect(useTypingStore.getState().currentIndex).toBe(1);
    expect(textarea.value).toBe('\u200B');
  });

  it('ignores Enter inside textarea and respects interactive button focus on Space', () => {
    render(<TypingContainer />);
    const textarea = screen.getByLabelText('Typing input area') as HTMLTextAreaElement;

    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(useTypingStore.getState().currentIndex).toBe(0);

    const restartBtn = screen.getByRole('button', { name: /Restart Test/i });
    restartBtn.focus();
    fireEvent.keyDown(restartBtn, { key: ' ', bubbles: true });

    // Focusing/activating a button should not steal focus back to hidden textarea
    expect(document.activeElement).toBe(restartBtn);
  });

  it('ignores global Escape shortcut while an accessible dialog modal is open', () => {
    render(
      <div>
        <div role="dialog" aria-modal="true">
          Modal content
        </div>
        <TypingContainer />
      </div>
    );

    const textarea = screen.getByLabelText('Typing input area') as HTMLTextAreaElement;
    const target = useTypingStore.getState().targetText;
    fireEvent.change(textarea, { target: { value: `\u200B${target[0]}` } });
    expect(useTypingStore.getState().status).toBe('running');

    fireEvent.keyDown(window, { key: 'Escape' });

    // Must not reset test underneath open modal
    expect(useTypingStore.getState().status).toBe('running');
  });

  it('prevents clipboard paste events inside the typing textarea', () => {
    render(<TypingContainer />);
    const textarea = screen.getByLabelText('Typing input area') as HTMLTextAreaElement;

    const pastedAllowed = fireEvent.paste(textarea, {
      clipboardData: {
        getData: () => 'cheated text',
      },
    });

    expect(pastedAllowed).toBe(false);
    expect(useTypingStore.getState().userInput).toBe('');
    expect(useTypingStore.getState().currentIndex).toBe(0);
  });
});
