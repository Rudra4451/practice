/**
 * Internal Performance Instrumentation Monitor
 * Tracks worker execution time, input latency, FPS, memory usage, and DB latency.
 */

export interface SystemMetrics {
  workerExecTimeMs: number;
  inputLatencyMs: number;
  fps: number;
  memoryUsageMb: number;
  dbLatencyMs: number;
}

class PerformanceMonitor {
  private metrics: SystemMetrics = {
    workerExecTimeMs: 0,
    inputLatencyMs: 0,
    fps: 60,
    memoryUsageMb: 0,
    dbLatencyMs: 0,
  };

  private frameCount = 0;
  private lastFpsCheck = performance.now();

  constructor() {
    if (typeof window !== 'undefined') {
      this.startFpsLoop();
    }
  }

  private startFpsLoop = () => {
    const loop = () => {
      this.frameCount++;
      const now = performance.now();
      const delta = now - this.lastFpsCheck;

      if (delta >= 1000) {
        this.metrics.fps = Math.round((this.frameCount * 1000) / delta);
        this.frameCount = 0;
        this.lastFpsCheck = now;

        // Sample memory usage if available
        const perfMemory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
        if (typeof window !== 'undefined' && perfMemory) {
          this.metrics.memoryUsageMb = Math.round(perfMemory.usedJSHeapSize / (1024 * 1024));
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };

  public recordWorkerTime(ms: number): void {
    this.metrics.workerExecTimeMs = Math.round(ms * 100) / 100;
  }

  public recordInputLatency(ms: number): void {
    this.metrics.inputLatencyMs = Math.round(ms * 100) / 100;
  }

  public recordDbLatency(ms: number): void {
    this.metrics.dbLatencyMs = Math.round(ms);
  }

  public getMetrics(): SystemMetrics {
    return { ...this.metrics };
  }
}

export const performanceMonitor = new PerformanceMonitor();
