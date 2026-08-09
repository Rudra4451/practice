# TyProX Core Architecture Blueprint

> **System Overview**: High-frequency analytical typing operating system built on Next.js 16.2 App Router, React 19, Supabase PostgreSQL, and off-thread Web Workers.

---

## Architectural Layers

```
┌─────────────────────────────────────────────────────────────┐
│                       Presentation Layer                    │
│   Next.js App Router Pages + React 19 Components + Tokens    │
└──────────────────────────────┬──────────────────────────────┘
                               │ Dispatches Keystrokes
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Decoupled Telemetry Layer                │
│     Web Worker (analytics.worker.ts) + Telemetry Engine     │
└──────────────────────────────┬──────────────────────────────┘
                               │ Submits Verified Runs
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     Infrastructure & Repositories           │
│   ProfilesRepo / TestResultsRepo / ReplaysRepo / Supabase   │
└─────────────────────────────────────────────────────────────┘
```

## Layer Boundaries & Principles

1. **Zero Input Latency**: The presentation layer captures DOM key events via an unlagged focus trap and immediately Echoes typed characters. All analytical math runs in Web Workers.
2. **Feature Isolation**: Features (`typing-engine`, `analytics`, `companion`, `leaderboard`, `dashboard`) operate within isolated directories inside `src/features/`.
3. **Repository Abstraction**: All database interactions pass through type-safe repository classes in `src/infrastructure/repositories/`. UI components never execute raw Supabase SDK queries directly.
4. **Plugin Architecture Contract**: Extensible systems (AI Coach, Community, Creator Packs) integrate via `src/infrastructure/plugins/`.
