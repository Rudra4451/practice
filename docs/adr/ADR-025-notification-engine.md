# ADR-025: Event-Driven Notification Pipeline Architecture

- **Status**: Approved
- **Date**: 2026-08-06
- **Authors**: TyProX Core Engineering Team

## Context
System events (replay comments, challenge invites, pack forks, streak milestones) require reliable user notifications.

## Decision
We enforce an **Event-Driven Notification Pipeline** (`src/features/notifications/`):
$$\text{Event} \longrightarrow \text{Notification Rule} \longrightarrow \text{Delivery} \longrightarrow \text{Read State} \longrightarrow \text{Archive}$$

Notifications support in-app alerts, browser push, and digest queues while keeping delivery transports decoupled from event generators.

## Consequences
- **Positive**: Extensible notification rules, zero coupling to UI components, clear read/unread state tracking.
- **Negative**: Requires rule evaluation during event processing.
