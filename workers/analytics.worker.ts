import {
  createMetricsTracker,
  evaluateFinalSession,
  type CompletionReason,
  type KeystrokeInputEvent,
} from '@/lib/typing/metrics';

let startTime: number | null = null;
let durationLimit = 60;
let keystrokes: KeystrokeInputEvent[] = [];
let tracker = createMetricsTracker();

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data as {
    type: string;
    payload?: Record<string, unknown>;
  };

  switch (type) {
    case 'INIT': {
      startTime = null;
      keystrokes = [];
      tracker = createMetricsTracker();
      durationLimit =
        typeof payload?.duration === 'number' && payload.duration > 0
          ? payload.duration
          : 60;
      break;
    }

    case 'KEYSTROKE': {
      const event = payload as unknown as KeystrokeInputEvent;
      if (startTime === null) {
        startTime = event.time;
      }

      keystrokes.push(event);
      tracker.apply(event);

      const elapsed = Math.max(0, event.time - startTime);
      const snap = tracker.snapshot(elapsed);

      self.postMessage({
        type: 'TICK',
        payload: {
          wpm: snap.wpm,
          rawWpm: snap.rawWpm,
          accuracy: snap.accuracy,
          currentIndex: event.index + (event.type === 'input' ? 1 : 0),
        },
      });
      break;
    }

    case 'FINALIZE': {
      if (keystrokes.length === 0 || startTime === null) {
        self.postMessage({ type: 'ERROR', payload: 'No keystrokes recorded.' });
        return;
      }

      const reason: CompletionReason =
        payload?.reason === 'text_complete' ? 'text_complete' : 'timer';
      const endTime =
        typeof payload?.endTime === 'number' ? payload.endTime : undefined;

      const finalResult = evaluateFinalSession(keystrokes, {
        durationLimit,
        reason,
        endTime,
      });

      if (!finalResult) {
        self.postMessage({ type: 'ERROR', payload: 'Unable to compute typing metrics.' });
        return;
      }

      self.postMessage({
        type: 'RESULT',
        payload: finalResult,
      });
      break;
    }

    default:
      break;
  }
};
