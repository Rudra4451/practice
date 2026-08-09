import { SubsystemRecovery } from '../recovery/subsystem-recovery';

export class WorkerManager {
  private worker: Worker | null = null;
  private onMessageCallback: ((e: MessageEvent) => void) | null = null;
  private isTerminated = false;

  constructor(private workerScriptUrl: URL | string) {}

  public getWorker(onMessage: (e: MessageEvent) => void): Worker | null {
    if (typeof window === 'undefined') return null;
    this.onMessageCallback = onMessage;

    if (!this.worker && !this.isTerminated) {
      this.initWorker();
    }

    return this.worker;
  }

  private initWorker(): void {
    try {
      this.worker = new Worker(this.workerScriptUrl);
      if (this.onMessageCallback) {
        this.worker.onmessage = this.onMessageCallback;
      }
      this.worker.onerror = (err) => {
        console.error('WorkerManager detected worker error:', err);
        SubsystemRecovery.handleWorkerCrash(() => {
          this.terminate();
          this.initWorker();
        });
      };
    } catch (err) {
      console.error('WorkerManager initialization failed:', err);
    }
  }

  public postMessage(message: unknown): void {
    if (this.worker) {
      try {
        this.worker.postMessage(message);
      } catch (err) {
        console.error('Failed to post message to worker:', err);
      }
    }
  }

  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
