# ADR-001: Web Worker Analytics Architecture

- **Status**: Approved
- **Date**: 2026-08-06
- **Authors**: TyProX Core Engineering Team

## Context
Traditional web typing applications compute Words Per Minute (WPM), accuracy, error tracking, and telemetry on the main JavaScript thread during active typing events. As text test length and telemetry volume grow, DOM re-rendering and synchronous array iterations introduce input frame drops and input latency jitter.

## Problem
In competitive typing, even 5-10ms of input delay creates noticeable key-feel sluggishness. Main thread execution of statistics calculations, timeline snapshots, and keystroke interval standard deviation calculations violates the **Zero Input Latency** mandate.

## Decision
We decouple all keystroke processing, real-time tick calculations, timeline snapshot building, and Relative Standard Deviation (RSD) consistency math into a dedicated Web Worker (`analytics.worker.ts`). The main DOM thread captures keydown events via a transparent focus-trap input, immediately echoes characters locally, and posts a lightweight message payload to the worker thread.

```
[Main Thread Focus-Trap] --- (postMessage) ---> [analytics.worker.ts]
                                                    │
                                                    ├── O(1) Running Map Update
                                                    └── (postMessage TICK/RESULT) ---> [Zustand Store]
```

## Alternatives Considered
1. **Main Thread RequestAnimationFrame Throttling**: Reduces calculations to 60fps but still blocks UI frame rendering during intense keystroke bursts.
2. **WebAssembly (Rust/C++) Module on Main Thread**: High performance math, but synchronous WASM calls still run on the main JS thread and block input handling.

## Consequences
- **Positive**: Main thread remains 100% responsive with zero input latency. Complex analytics (bigram speeds, RSD consistency, timeline snapshots) execute off-thread.
- **Negative**: Asynchronous message passing requires explicit serialization/deserialization protocols and worker crash recovery handlers.
