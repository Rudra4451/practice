# TyProX Architecture Decision Log (ADR Index)

All architectural decisions in TyProX require an Architecture Decision Record (ADR) stored in `docs/adr/`.

| ADR ID | Title | Status | Date | Core Decision Summary |
| :--- | :--- | :--- | :--- | :--- |
| **ADR-001** | Web Worker Architecture | Approved | 2026-08-06 | Decoupled all keystroke analytics and timeline generation into `analytics.worker.ts` to ensure 0ms input latency. |
| **ADR-002** | Feature-First Folder Structure | Approved | 2026-08-06 | Adopted `src/` feature-first directory modularity (`src/features`, `src/design-system`, `src/telemetry`). |
| **ADR-003** | Repository Pattern | Approved | 2026-08-06 | Abstracted database operations into Repositories (`ProfilesRepository`, `TestResultsRepository`, `ReplaysRepository`). |
| **ADR-004** | State Management Architecture | Approved | 2026-08-06 | Enforced Zustand stores split (`useTypingStore`, `useUserStore`, `useToastStore`) + `ThemeProvider`. |
| **ADR-005** | Telemetry Versioning Protocol | Approved | 2026-08-06 | Mandated `version: 1` schema headers and forward-compatible serializers for historical replay playback. |
| **ADR-006** | Mechanical Keycap Design System | Approved | 2026-08-06 | Standardized `18px` keycap radius, `4px` travel, `6px` shadow elevation, `1.5px` blueprint strokes, and `140ms` motion curve. |
| **ADR-007** | Telemetry Replay Storage | Approved | 2026-08-06 | Enforced compressed JSONB key mapping (`{ t, k, y, i }`) for 75% DB storage optimization. |
