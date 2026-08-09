# TyProX Performance Benchmarks & Targets

Production latency budgets and verification benchmarks:

- **Input Latency**: `< 1.0 ms` (Decoupled main thread event capture).
- **Worker Computation**: `< 2.0 ms` (Web Worker position ticks).
- **Typing DNA Generation**: `< 32.0 ms` (26-letter heatmap calculations).
- **Drill Compilation**: `< 18.0 ms` (Rule-based passage compilation).
- **Replay Stream Serialization**: `< 45.0 ms` (Compression pipeline).
- **Rendering FPS**: `60 FPS` (Native SVG + Framer Motion).
