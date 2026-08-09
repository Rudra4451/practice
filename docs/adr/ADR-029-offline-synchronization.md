# ADR-029: Progressive Web App & Offline Synchronization Architecture

- **Status**: Approved
- **Date**: 2026-08-06
- **Authors**: TyProX Core Engineering Team

## Context
Typing practice should remain fully functional even when network connectivity is lost or unstable.

## Decision
We enforce an **Offline PWA Architecture** (`src/infrastructure/recovery/` & Service Worker):
- **Offline Storage**: Telemetry runs, practice drills, and user settings cache locally in IndexedDB / `localStorage`.
- **Operation Queue**: Offline mutations publish to `SubsystemRecovery` operation queue.
- **Conflict Resolution**: Syncs queued operations sequentially when connectivity is restored; server timestamps take precedence for public leaderboards.

## Consequences
- **Positive**: Uninterrupted offline practice capability, automatic background synchronization.
- **Negative**: Requires conflict resolution logic for concurrent multi-device sync.
