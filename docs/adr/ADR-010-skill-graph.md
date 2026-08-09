# ADR-010: Knowledge Graph Skill Architecture

- **Status**: Approved
- **Date**: 2026-08-06
- **Authors**: TyProX Core Engineering Team

## Context
Typing mastery is an interconnected web of cognitive and physical capabilities (e.g. Reaction Time directly influences Speed Ceiling; Consistency directly influences Rhythm).

## Problem
Representing user skill as isolated numbers fails to capture cross-attribute dependencies and structural bottlenecks.

## Decision
We model the user's skill profile as a **Directed Weighted Knowledge Graph** with 12 canonical nodes:
- Reaction, Precision, Consistency, Rhythm, Acceleration, Focus, Endurance, Finger Independence, Error Recovery, Confidence, Learning Velocity, Speed Ceiling.

Edges store directed influence weight values (e.g. $\text{Reaction} \xrightarrow{0.84} \text{Speed Ceiling}$).

## Consequences
- **Positive**: Enables structural root-cause analysis of typing bottlenecks and enables non-linear prediction models.
- **Negative**: Requires matrix graph calculations on session completion.
