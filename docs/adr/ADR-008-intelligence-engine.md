# ADR-008: Modular Deterministic Intelligence Engine

- **Status**: Approved
- **Date**: 2026-08-06
- **Authors**: TyProX Core Engineering Team

## Context
TyProX requires deep analytical insights into user typing skill, bottle-neck finger weaknesses, fatigue curves, and practice recommendations.

## Problem
Relying on external LLMs or third-party cloud APIs for basic telemetry analytics introduces network latency, costs, and non-deterministic variations in user skill evaluation.

## Decision
We enforce a **Pure Deterministic Intelligence Engine** in `src/features/intelligence/`. All analytics, DNA heatmaps, drill compilations, skill graph updates, and predictions execute 100% client-side in pure TypeScript without AI models or network calls.

```
[Telemetry Stream v2] ---> [Intelligence Engine] ---> [Knowledge Graph Delta]
                                                     ---> [Compiled Drills]
                                                     ---> [7/30-Day Forecast]
```

## Consequences
- **Positive**: Zero network latency ($< 60\text{ms}$ calculation budget), 100% deterministic & reproducible insights, complete user data privacy.
- **Negative**: Requires rigorous client-side mathematical algorithms and linear regression models.
