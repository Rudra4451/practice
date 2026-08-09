# ADR-012: Rule-Based Algorithmic Drill Compiler

- **Status**: Approved
- **Date**: 2026-08-06
- **Authors**: TyProX Core Engineering Team

## Context
Generic typing tests repeat static dictionary word lists. To accelerate skill acquisition, practice passages must target the user's specific weak keys, sluggish fingers, and error clusters.

## Decision
We implement a deterministic **Algorithmic Drill Compiler Pipeline**:
$$\text{Weak Keys} \rightarrow \text{Weak Digraphs} \rightarrow \text{Weak Trigraphs} \rightarrow \text{Finger Weakness} \rightarrow \text{Error Clusters} \rightarrow \text{Difficulty Budget} \rightarrow \text{Grammar Rules} \rightarrow \text{Compiled Drill}$$

Compiled passages include metadata: target fingers, target digraphs, difficulty rating ($1-100$), expected duration, and repeatability score. Zero AI / zero network API dependency ($< 40\text{ms}$ compilation budget).

## Consequences
- **Positive**: Instant personalized drill generation, zero API cost, 100% deterministic passage targeting.
- **Negative**: Algorithmic grammar rules must be curated for code syntax and prose text.
