# ADR-002: Feature-First Folder Architecture

- **Status**: Approved
- **Date**: 2026-08-06
- **Authors**: TyProX Core Engineering Team

## Context
As the TyProX codebase expands across typing engine viewports, telemetry processing, cat companions, leaderboards, and user dashboards, flat top-level directories (`components/`, `lib/`, `stores/`, `utils/`) lead to tightly coupled modules, circular imports, and unclear ownership boundaries.

## Problem
In a flat directory structure, components frequently import from arbitrary sub-paths, making code refactoring risky and preventing isolated feature testing.

## Decision
We adopt a strict **Feature-First Architecture** rooted inside `src/`. All code is organized by domain boundaries:

```
src/
├── app/              # Next.js App Router (v1 API & pages)
├── design-system/    # Mechanical Keycap Design Tokens & Primitives
├── components/       # Universal Primitive Components (Modal, Input, Toast)
├── features/         # Feature-isolated domains (typing-engine, analytics, companion)
├── telemetry/        # Telemetry Engine Math & Versioned Serializers
├── infrastructure/   # Repositories, Supabase SDK, Plugin System, Worker Manager
├── providers/        # React Context Providers
├── stores/           # Zustand Client Stores
└── types/            # Strict TypeScript Domain Models
```

Each feature directory must be self-contained and expose a clean public API through its `index.ts`. No cross-feature circular imports are permitted.

## Alternatives Considered
1. **Layer-First Architecture (`components/`, `services/`, `models/`)**: Simple initially, but features become fragmented across multiple directories.
2. **Monorepo Architecture (Turborepo/Nx)**: Overkill for a single product codebase at this stage.

## Consequences
- **Positive**: High modularity, clear component boundaries, fast feature isolation, and zero circular dependencies.
- **Negative**: Requires strict discipline to keep feature internal files private.
