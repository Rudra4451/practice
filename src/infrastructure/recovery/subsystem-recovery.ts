/**
 * TyProX Subsystem Failure Recovery System
 * Enforces graceful degradation policies across worker, DB, replay, audio, and theme layers.
 */

export class SubsystemRecovery {
  // 1. Worker Crash Recovery
  public static handleWorkerCrash(
    onRestart: () => void,
    logError?: (msg: string) => void
  ): void {
    if (logError) logError('Worker process crashed. Executing auto-restart sequence...');
    try {
      onRestart();
    } catch (err) {
      console.error('Failed to restart worker process:', err);
    }
  }

  // 2. Offline Database Result Queueing
  public static queueOfflineResult(resultData: Record<string, unknown>): void {
    try {
      const KEY = 'typrox_offline_queue';
      const existing = localStorage.getItem(KEY);
      const queue = existing ? JSON.parse(existing) : [];
      queue.push({
        ...resultData,
        queuedAt: new Date().toISOString(),
      });
      localStorage.setItem(KEY, JSON.stringify(queue.slice(-50))); // Keep last 50 runs max
    } catch (err) {
      console.error('Failed to queue offline result:', err);
    }
  }

  // 3. Sync Queued Results on Network Restoration
  public static async syncOfflineQueue(
    submitFn: (data: Record<string, unknown>) => Promise<boolean>
  ): Promise<void> {
    try {
      const KEY = 'typrox_offline_queue';
      const existing = localStorage.getItem(KEY);
      if (!existing) return;

      const queue = JSON.parse(existing);
      if (!Array.isArray(queue) || queue.length === 0) return;

      const remaining = [];
      for (const item of queue) {
        const success = await submitFn(item);
        if (!success) {
          remaining.push(item);
        }
      }

      if (remaining.length > 0) {
        localStorage.setItem(KEY, JSON.stringify(remaining));
      } else {
        localStorage.removeItem(KEY);
      }
    } catch (err) {
      console.error('Error synchronizing offline queue:', err);
    }
  }

  // 4. Replay Stream Corruption Recovery
  public static recoverPartialReplay(telemetry: Record<string, unknown>[]): Record<string, unknown>[] {
    if (!Array.isArray(telemetry)) return [];
    // Filter corrupted keystroke frames (must have valid number timestamp and string key)
    return telemetry.filter(
      (frame) =>
        frame &&
        typeof frame.t === 'number' &&
        !isNaN(frame.t) &&
        typeof frame.k === 'string'
    );
  }

  // 5. Audio Fallback Handler
  public static safeAudioPlay(audioElement: HTMLAudioElement | null): void {
    if (!audioElement) return;
    try {
      const promise = audioElement.play();
      if (promise !== undefined) {
        promise.catch(() => {
          // Silent fallback if autoplay is disabled or web audio is unavailable
        });
      }
    } catch {
      // Ignore audio playback exceptions
    }
  }

  // 6. Theme Fallback Handler
  public static getSafeFallbackTheme(): 'dark' | 'light' {
    try {
      if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
      }
    } catch {}
    return 'dark'; // Default fallback
  }
}
