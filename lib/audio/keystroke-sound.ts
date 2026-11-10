let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  const AudioCtx =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioCtx) return null;

  if (!sharedAudioContext) {
    try {
      sharedAudioContext = new AudioCtx();
    } catch {
      return null;
    }
  }

  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume().catch(() => {});
  }

  return sharedAudioContext;
}

export function resetAudioContext(): void {
  sharedAudioContext = null;
}

/**
 * Plays a lightweight synthesized mechanical key click or subtle error thud
 * without bundling external audio payloads. Safe no-op when volume is 0 or unsupported.
 */
export function playKeystrokeSound(volume: number, isError = false): void {
  if (!Number.isFinite(volume) || volume <= 0) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  const clampedVol = Math.min(1, Math.max(0, volume));
  const now = ctx.currentTime;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = isError ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isError ? 160 : 520, now);
    osc.frequency.exponentialRampToValueAtTime(isError ? 90 : 210, now + 0.032);

    const peakGain = (isError ? 0.14 : 0.09) * clampedVol;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  } catch {
    // Ignore transient browser AudioContext state errors
  }
}
