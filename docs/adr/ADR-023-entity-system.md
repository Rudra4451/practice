# ADR-023: BaseEntity System Architecture

- **Status**: Approved
- **Date**: 2026-08-06
- **Authors**: TyProX Core Engineering Team

## Context
TyProX manages multiple domain objects (Users, Profiles, Sessions, Replays, Text Packs, Challenges, Clubs, Achievements, Badges, Drills, Events, Notifications).

## Problem
Building isolated data models for each domain object leads to fragmented API endpoints, duplicate permission logic, and complex search indexing.

## Decision
We enforce a unified **BaseEntity System** in `src/types/entity.types.ts`. Every object in TyProX inherits common traits:
- `id`: Unique UUID identifier.
- `version`: Integer version number.
- `ownerId`: UUID of entity owner.
- `createdAt` / `updatedAt`: ISO timestamps.
- `permissions`: Access control flags.
- `visibility`: `'public' | 'private' | 'unlisted'`.
- `tags`: String tags.
- `metadata`: Key-value JSONB metadata.

## Consequences
- **Positive**: Simplifies domain APIs, search indexing, permissions, and audit logging across the entire platform.
- **Negative**: Requires all entity interfaces to implement the `BaseEntity` contract.
