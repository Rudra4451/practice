// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { playKeystrokeSound, resetAudioContext } from '@/lib/audio/keystroke-sound';

describe('playKeystrokeSound', () => {
  const originalAudioContext = window.AudioContext;

  afterEach(() => {
    resetAudioContext();
    vi.restoreAllMocks();
    if (originalAudioContext) {
      Object.defineProperty(window, 'AudioContext', {
        configurable: true,
        writable: true,
        value: originalAudioContext,
      });
    } else {
      delete (window as { AudioContext?: unknown }).AudioContext;
    }
  });

  it('does nothing when volume is 0 or negative', () => {
    const mockConstructor = vi.fn();
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: mockConstructor,
    });

    playKeystrokeSound(0, false);
    playKeystrokeSound(-10, true);

    expect(mockConstructor).not.toHaveBeenCalled();
  });

  it('no-ops cleanly when Web Audio API is unavailable', () => {
    delete (window as { AudioContext?: unknown }).AudioContext;
    delete (window as { webkitAudioContext?: unknown }).webkitAudioContext;

    expect(() => playKeystrokeSound(50, false)).not.toThrow();
    expect(() => playKeystrokeSound(80, true)).not.toThrow();
  });

  it('synthesizes keystroke oscillator cleanly when AudioContext exists', () => {
    const startMock = vi.fn();
    const stopMock = vi.fn();
    const connectMock = vi.fn();
    const setValueAtTimeMock = vi.fn();
    const exponentialRampMock = vi.fn();

    class FakeAudioContext {
      state = 'running';
      currentTime = 1.0;
      destination = {};
      resume = vi.fn().mockResolvedValue(undefined);
      createOscillator() {
        return {
          type: 'triangle',
          frequency: {
            setValueAtTime: setValueAtTimeMock,
            exponentialRampToValueAtTime: exponentialRampMock,
          },
          connect: connectMock,
          start: startMock,
          stop: stopMock,
        };
      }
      createGain() {
        return {
          gain: {
            setValueAtTime: setValueAtTimeMock,
            exponentialRampToValueAtTime: exponentialRampMock,
          },
          connect: connectMock,
        };
      }
    }

    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: FakeAudioContext,
    });

    playKeystrokeSound(75, true);

    expect(setValueAtTimeMock).toHaveBeenCalledTimes(2);
    expect(exponentialRampMock).toHaveBeenCalledTimes(3);
    expect(startMock).toHaveBeenCalledTimes(1);
    expect(stopMock).toHaveBeenCalledTimes(1);
  });
});
