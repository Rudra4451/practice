# ADR-009: Event Sourcing & Immutable Session Intelligence

- **Status**: Approved
- **Date**: 2026-08-06
- **Authors**: TyProX Core Engineering Team

## Context
User typing skill evolves over time. Previously, platforms updated a single "current profile stat" record, overwriting historical skill states.

## Problem
Overwriting skill data destroys historical progression context, preventing retrospective analysis, trend forecasting, and historical replay validation.

## Decision
We enforce an **Append-Only Event Sourcing Pipeline** for all session intelligence:
$$\text{Telemetry} \longrightarrow \text{Analysis} \longrightarrow \text{DNA Snapshot} \longrightarrow \text{Graph Delta} \longrightarrow \text{Recommendations} \longrightarrow \text{Replay}$$

Current Typing DNA and Knowledge Graph states are dynamically derived by folding historical session deltas sequentially.

## Consequences
- **Positive**: Complete auditability, zero data loss, time-travel progression visualization, and regression forecasting capability.
- **Negative**: Requires historical event folding algorithms during user profile bootstrapping.
