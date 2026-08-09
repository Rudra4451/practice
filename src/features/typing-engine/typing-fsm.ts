// TyProX Typing Engine Deterministic Finite-State Machine (Revision 2)

export type TypingEngineState =
  | 'IDLE'
  | 'READY'
  | 'COUNTDOWN'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'VALIDATING'
  | 'SAVING'
  | 'FINISHED';

export type TypingEngineEvent =
  | { type: 'INIT'; payload: { mode: string; duration: number; seed: string; text: string } }
  | { type: 'KEYPRESS_START' }
  | { type: 'TICK'; payload: { wpm: number; rawWpm: number; accuracy: number; timeLeft: number } }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'FINALIZE' }
  | { type: 'VALIDATION_SUCCESS' }
  | { type: 'VALIDATION_FAILURE'; error: string }
  | { type: 'SAVE_SUCCESS'; resultId?: string }
  | { type: 'SAVE_FAILURE' }
  | { type: 'RESET' };

export class TypingFSM {
  private state: TypingEngineState = 'IDLE';
  private mode = 'words';
  private duration = 30;
  private seed = '';
  private targetText = '';
  private userInput = '';
  private currentIndex = 0;
  private timeLeft = 30;
  private wpm = 0;
  private rawWpm = 0;
  private accuracy = 100;
  private error = null as string | null;

  private listeners: Array<(state: TypingEngineState) => void> = [];

  public getState(): TypingEngineState {
    return this.state;
  }

  public getData() {
    return {
      state: this.state,
      mode: this.mode,
      duration: this.duration,
      seed: this.seed,
      targetText: this.targetText,
      userInput: this.userInput,
      currentIndex: this.currentIndex,
      timeLeft: this.timeLeft,
      wpm: this.wpm,
      rawWpm: this.rawWpm,
      accuracy: this.accuracy,
      error: this.error,
    };
  }

  public subscribe(listener: (state: TypingEngineState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public transition(event: TypingEngineEvent): TypingEngineState {
    const prev = this.state;

    switch (event.type) {
      case 'INIT':
        this.state = 'READY';
        this.mode = event.payload.mode;
        this.duration = event.payload.duration;
        this.seed = event.payload.seed;
        this.targetText = event.payload.text;
        this.userInput = '';
        this.currentIndex = 0;
        this.timeLeft = event.payload.duration;
        this.wpm = 0;
        this.rawWpm = 0;
        this.accuracy = 100;
        this.error = null;
        break;

      case 'KEYPRESS_START':
        if (this.state === 'READY' || this.state === 'IDLE') {
          this.state = 'RUNNING';
        }
        break;

      case 'TICK':
        if (this.state === 'RUNNING') {
          this.wpm = event.payload.wpm;
          this.rawWpm = event.payload.rawWpm;
          this.accuracy = event.payload.accuracy;
          this.timeLeft = event.payload.timeLeft;
        }
        break;

      case 'PAUSE':
        if (this.state === 'RUNNING') {
          this.state = 'PAUSED';
        }
        break;

      case 'RESUME':
        if (this.state === 'PAUSED') {
          this.state = 'RUNNING';
        }
        break;

      case 'FINALIZE':
        if (this.state === 'RUNNING' || this.state === 'PAUSED') {
          this.state = 'COMPLETED';
        }
        break;

      case 'VALIDATION_SUCCESS':
        if (this.state === 'COMPLETED') {
          this.state = 'SAVING';
        }
        break;

      case 'VALIDATION_FAILURE':
        this.state = 'FINISHED';
        this.error = event.error;
        break;

      case 'SAVE_SUCCESS':
      case 'SAVE_FAILURE':
        if (this.state === 'SAVING') {
          this.state = 'FINISHED';
        }
        break;

      case 'RESET':
        this.state = 'IDLE';
        this.userInput = '';
        this.currentIndex = 0;
        this.wpm = 0;
        this.rawWpm = 0;
        this.accuracy = 100;
        break;
    }

    if (prev !== this.state) {
      this.listeners.forEach((l) => l(this.state));
    }

    return this.state;
  }
}

export const typingFSM = new TypingFSM();
