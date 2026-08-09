# ADR-024: Global Activity Stream Architecture

- **Status**: Approved
- **Date**: 2026-08-06
- **Authors**: TyProX Core Engineering Team

## Context
Platform activities (practice completions, published packs, club joins, PBs, badge unlocks, replay shares) need to be surfaced across user feeds, club streams, and global activity dashboards.

## Decision
We implement a **Global Activity Stream Engine** (`src/features/activity/activity-stream.ts`). Every platform module publishes standard activity events to a central event bus. UI feeds simply filter the Activity Stream by user ID, club ID, or event type without custom feed logic per feature.

## Consequences
- **Positive**: Single unified event feed architecture, simplified database activity queries, instant real-time event broadcasting.
- **Negative**: Requires event payload standardization across all features.
