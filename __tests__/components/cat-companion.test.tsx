// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CatCompanion } from '@/components/typing/cat-companion';

describe('CatCompanion persistence, deterministic quotes, and unlock logic', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    localStorage.clear();
  });

  it('preserves pre-existing unlocked companions in localStorage on mount', () => {
    localStorage.setItem('typrox_cats_unlocked', JSON.stringify(['orange', 'void', 'white', 'cyber']));

    render(<CatCompanion wpm={55} accuracy={92} errorCount={4} streakDays={2} />);

    vi.advanceTimersByTime(100);

    const saved = JSON.parse(localStorage.getItem('typrox_cats_unlocked') || '[]');
    expect(saved).toContain('cyber');
    expect(screen.getByText(/collected: 4 \/ 15/i)).toBeTruthy();
  });

  it('unlocks golden companion on 100% accuracy and allows switching companions', () => {
    render(<CatCompanion wpm={68} accuracy={100} errorCount={0} streakDays={8} />);

    vi.advanceTimersByTime(100);

    const saved = JSON.parse(localStorage.getItem('typrox_cats_unlocked') || '[]');
    expect(saved).toContain('golden');

    fireEvent.click(screen.getByRole('button', { name: /My Collection/i }));
    const goldenTile = screen.getByRole('button', { name: /Ultra/i }) as HTMLButtonElement;
    expect(goldenTile.disabled).toBe(false);

    fireEvent.click(goldenTile);
    expect(localStorage.getItem('typrox_cats_selected')).toBe('golden');
  });

  it('renders collection drawer with opaque semantic surface classes and clean z-layering over footer', () => {
    const { container } = render(
      <CatCompanion wpm={72} accuracy={97} errorCount={2} streakDays={1} />
    );

    fireEvent.click(screen.getByRole('button', { name: /My Collection/i }));
    const drawer = screen.getByTestId('cat-collection-drawer');
    expect(drawer).toBeTruthy();
    expect(drawer.className).toContain('bg-surface');
    expect(drawer.className).toContain('text-text-primary');
    expect(drawer.className).toContain('z-40');
    expect(drawer.className).not.toContain('bg-neutral-950');
    expect(drawer.className).not.toContain('bg-neutral-900');

    const footer = container.querySelector('.border-t.z-10');
    expect(footer).toBeTruthy();
  });
});
