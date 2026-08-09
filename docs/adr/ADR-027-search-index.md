# ADR-027: Universal Search Index Architecture

- **Status**: Approved
- **Date**: 2026-08-06
- **Authors**: TyProX Core Engineering Team

## Context
Users need to search across profiles, text packs, challenges, clubs, replays, and system navigation commands.

## Decision
We implement a **Unified Search Index Engine** (`src/features/search/search-index.ts`). All searchable `BaseEntity` objects register searchable fields (title, tags, owner, metadata) in a single memory-efficient search index. The `Ctrl + K` / `Cmd + K` Command Palette queries this index with fuzzy scoring, recents, commands, and actions.

## Consequences
- **Positive**: Blazing-fast VS Code style command palette search ($< 5\text{ms}$ query latency), single keyboard interface across the platform.
- **Negative**: Entity modifications must update the search index memory buffer.
