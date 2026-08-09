# ADR-028: Dashboard Widget Plugin Architecture

- **Status**: Approved
- **Date**: 2026-08-06
- **Authors**: TyProX Core Engineering Team

## Context
The Desk OS personalized dashboard displays customizable widgets (Skill Graph, Typing DNA, Practice Heatmap, Challenges, Recent Runs) that users can freely rearrange.

## Decision
We enforce a **Widget Plugin Architecture** (`src/features/dashboard/widgets/`). Every dashboard widget implements an explicit plugin contract:
`register()`, `render()`, `refresh()`, `resize()`, `serialize()`, `deserialize()`.

Widgets can be registered, reordered, or added without modifying core dashboard container layout logic.

## Consequences
- **Positive**: Complete widget isolation, dynamic layout reordering, auto-persisted layout state.
- **Negative**: Requires strict widget plugin interface compliance.
