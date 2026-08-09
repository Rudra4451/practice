# TyProX Architecture Specification v2 (Production Public Beta)

> **System Identity**: High-frequency analytical typing platform & operating system.  
> **Core Stack**: Next.js 16.2 App Router, React 19, Supabase PostgreSQL, Web Workers, Native SVG Blueprint Charts.

---

## Architectural Principles

1. **Zero Input Latency**: Input capture is decoupled from DOM re-renders via Web Worker thread offloading (`analytics.worker.ts`).
2. **The One-Key Rule**: Single keypress Focus Mode entry in $< 1\text{ms}$ startup latency.
3. **BaseEntity Architecture**: All domain objects inherit from standard `BaseEntity` interfaces.
4. **Append-Only Event Sourcing**: Historical session intelligence is never overwritten.
5. **Deterministic Intelligence**: All skill graphs, DNA heatmaps, drill compilations, and linear forecasts execute 100% client-side without external AI or network calls.
6. **In-House Native SVG Blueprint Visualizations**: Zero 3rd-party charting library overhead; 100% custom SVG primitives with Framer Motion path animations.
