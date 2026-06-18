/* eslint-disable no-restricted-globals */

interface KeystrokeEvent {
  key: string;
  time: number; // millisecond timestamp
  index: number;
  expectedKey: string;
  type: 'input' | 'delete';
}

// Running counters — O(1) per keystroke instead of O(n) scan on each event
let startTime: number | null = null;
let durationLimit = 60;
let testMode = 'words';
let keystrokes: KeystrokeEvent[] = [];
let backspaceCount = 0;

// Position-indexed map: tracks whether each character position is currently correct.
// When user types char at index i: correctMap[i] = (char === expected)
// When user deletes: remove correctMap[currentIndex - 1]
const correctMap = new Map<number, boolean>();

// Running totals rebuilt from correctMap
function getRunningCounts() {
  let correctChars = 0;
  let rawInputs = 0;
  for (const [, isCorrect] of correctMap) {
    rawInputs++;
    if (isCorrect) correctChars++;
  }
  return { correctChars, rawInputs };
}

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;

  switch (type) {
    case 'INIT': {
      startTime = null;
      keystrokes = [];
      backspaceCount = 0;
      correctMap.clear();
      durationLimit = payload.duration;
      testMode = payload.mode;
      break;
    }

    case 'KEYSTROKE': {
      const event = payload as KeystrokeEvent;
      if (startTime === null) {
        startTime = event.time;
      }

      keystrokes.push(event);

      if (event.type === 'delete') {
        backspaceCount++;
        // Remove the character at the position being deleted
        correctMap.delete(event.index);
      } else {
        // Record whether this position is correct
        correctMap.set(event.index, event.key === event.expectedKey);
      }

      // O(1) running stats — just read the map size/counts
      const elapsed = Math.max(100, event.time - startTime!);
      const elapsedMins = elapsed / 60000;

      const { correctChars, rawInputs } = getRunningCounts();

      // Net WPM = (correct chars / 5) / minutes
      const wpm = Math.round((correctChars / 5) / elapsedMins);
      // Raw WPM = (total positions occupied / 5) / minutes  
      const rawWpm = Math.round((rawInputs / 5) / elapsedMins);

      // Accuracy = correct positions / total occupied positions
      const accuracy = rawInputs > 0
        ? Math.round((correctChars / rawInputs) * 100)
        : 100;

      self.postMessage({
        type: 'TICK',
        payload: {
          wpm: Math.max(0, wpm),
          rawWpm: Math.max(0, rawWpm),
          accuracy: Math.max(0, Math.min(100, accuracy)),
          currentIndex: event.index + (event.type === 'input' ? 1 : 0),
        },
      });
      break;
    }

    case 'FINALIZE': {
      if (keystrokes.length === 0 || !startTime) {
        self.postMessage({ type: 'ERROR', payload: 'No keystrokes recorded.' });
        return;
      }

      const lastKeystrokeTime = keystrokes[keystrokes.length - 1].time;
      const totalElapsedMs = lastKeystrokeTime - startTime;
      const totalElapsedSecs = Math.max(1, Math.round(totalElapsedMs / 1000));
      const elapsedMins = Math.max(0.001, totalElapsedMs / 60000);

      // Use the position map for final counts (consistent with TICK)
      const { correctChars, rawInputs } = getRunningCounts();

      const finalWpm = Math.round((correctChars / 5) / elapsedMins);
      const finalRawWpm = Math.round((rawInputs / 5) / elapsedMins);

      // errorCount: positions currently holding wrong characters
      let errorCount = 0;
      for (const [, isCorrect] of correctMap) {
        if (!isCorrect) errorCount++;
      }

      const finalAccuracy = rawInputs > 0
        ? Math.round((correctChars / rawInputs) * 100)
        : 100;

      // 1. Consistency (RSD of intervals between correct input events)
      const correctKeystrokeTimes = keystrokes
        .filter(k => k.type === 'input' && k.key === k.expectedKey)
        .map(k => k.time);

      let consistency = 100;
      if (correctKeystrokeTimes.length > 2) {
        const intervals: number[] = [];
        for (let i = 1; i < correctKeystrokeTimes.length; i++) {
          intervals.push(correctKeystrokeTimes[i] - correctKeystrokeTimes[i - 1]);
        }
        const meanInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        if (meanInterval > 0) {
          const variance = intervals.reduce((a, b) => a + Math.pow(b - meanInterval, 2), 0) / intervals.length;
          const stdDev = Math.sqrt(variance);
          const rsd = stdDev / meanInterval;
          consistency = Math.max(0, Math.min(100, Math.round(100 * (1 - rsd))));
        }
      }

      // 2. Second-by-second WPM timeline for Recharts
      const timeline: Array<{ second: number; wpm: number; rawWpm: number }> = [];
      
      // Build a sorted timeline of input events only for perf
      const inputKeystrokes = keystrokes.filter(k => k.type === 'input');
      
      for (let s = 1; s <= totalElapsedSecs; s++) {
        const timeCutoff = startTime + s * 1000;
        const subMins = s / 60;

        // Count correct/raw up to this time cutoff using the raw event list
        // We rebuild from events not the map (map reflects final state, not point-in-time)
        const positionState = new Map<number, boolean>();
        for (const k of keystrokes) {
          if (k.time > timeCutoff) break;
          if (k.type === 'input') {
            positionState.set(k.index, k.key === k.expectedKey);
          } else {
            positionState.delete(k.index);
          }
        }
        
        let subCorrect = 0;
        let subRaw = 0;
        for (const [, isCorrect] of positionState) {
          subRaw++;
          if (isCorrect) subCorrect++;
        }

        const subWpm = Math.round((subCorrect / 5) / subMins);
        const subRawWpm = Math.round((subRaw / 5) / subMins);

        timeline.push({
          second: s,
          wpm: Math.max(0, isNaN(subWpm) ? 0 : subWpm),
          rawWpm: Math.max(0, isNaN(subRawWpm) ? 0 : subRawWpm),
        });
      }

      // 3. Performance Lab metrics
      const errorKeys: Record<string, number> = {};
      const slowKeys: Record<string, number[]> = {};
      const bigramTransitions: Record<string, number[]> = {};

      for (let i = 1; i < keystrokes.length; i++) {
        const prev = keystrokes[i - 1];
        const curr = keystrokes[i];

        if (curr.type === 'input') {
          if (curr.key !== curr.expectedKey) {
            errorKeys[curr.expectedKey] = (errorKeys[curr.expectedKey] || 0) + 1;
          }

          if (curr.key === curr.expectedKey && prev.type === 'input' && prev.key === prev.expectedKey) {
            const diff = curr.time - prev.time;
            if (diff > 0 && diff < 5000) { // sanity: ignore pauses > 5s
              if (!slowKeys[curr.key]) slowKeys[curr.key] = [];
              slowKeys[curr.key].push(diff);

              const bigram = (prev.key + curr.key).toLowerCase();
              if (bigram.length === 2 && /^[a-z]{2}$/.test(bigram)) {
                if (!bigramTransitions[bigram]) bigramTransitions[bigram] = [];
                bigramTransitions[bigram].push(diff);
              }
            }
          }
        }
      }

      const keySpeeds: Record<string, number> = {};
      Object.keys(slowKeys).forEach((k) => {
        const times = slowKeys[k];
        keySpeeds[k] = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
      });

      const bigramSpeeds: Record<string, number> = {};
      Object.keys(bigramTransitions).forEach((b) => {
        const times = bigramTransitions[b];
        bigramSpeeds[b] = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
      });

      self.postMessage({
        type: 'RESULT',
        payload: {
          wpm: Math.max(0, finalWpm),
          rawWpm: Math.max(0, finalRawWpm),
          accuracy: Math.max(0, Math.min(100, finalAccuracy)),
          consistency,
          errorCount,
          backspaceCount,
          duration: totalElapsedSecs,
          timeline,
          keySpeeds,
          errorKeys,
          bigramSpeeds,
          telemetry: keystrokes.map(k => ({
            t: Math.round(k.time - startTime!),
            k: k.key,
            y: k.type === 'input' ? 0 : 1,
            i: k.index,
          })),
        },
      });
      break;
    }

    default:
      break;
  }
};
