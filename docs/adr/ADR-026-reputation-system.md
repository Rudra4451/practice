# ADR-026: Community Reputation System Architecture

- **Status**: Approved
- **Date**: 2026-08-06
- **Authors**: TyProX Core Engineering Team

## Context
Community engagement requires incentivizing helpful behavior (publishing high-quality code packs, constructive replay comments, challenge creation, moderation).

## Decision
We introduce **Community Reputation** (`src/features/reputation/`), calculated independently from typing performance rating (TPR). Reputation points are awarded for community contributions and verified assets.

```
[Community Contribution] ---> [Reputation Engine] ---> [User Reputation Score] (Distinct from TPR)
```

## Consequences
- **Positive**: Prevents mixing social reputation with raw typing skill; encourages high-quality content publishing.
- **Negative**: Requires contribution validation rules to prevent gaming.
