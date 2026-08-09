# ADR-030: Versioned Creator Resource Pipeline Architecture

- **Status**: Approved
- **Date**: 2026-08-06
- **Authors**: TyProX Core Engineering Team

## Context
User-generated content (Text Packs, Code Packs, Custom Challenges) undergoes edits, revisions, and community forks.

## Decision
Every published asset is treated as a **Versioned Resource** (`src/features/creator/`):
- Lifecycle: `Draft` $\rightarrow$ `Published` $\rightarrow$ `Deprecated` $\rightarrow$ `Archived` $\rightarrow$ `Forked` $\rightarrow$ `Remixed`.
- Every resource maintains an explicit Version string (`v1.0.0`) and parent resource lineage pointers (`parentResourceId`, `forkCount`).

## Consequences
- **Positive**: Complete version lineage, non-breaking content edits, future creator marketplace compatibility.
- **Negative**: Requires version management UI tools in the creator workspace.
