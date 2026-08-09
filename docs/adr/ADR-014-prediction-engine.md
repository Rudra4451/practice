# ADR-014: Linear Regression Telemetry Forecasting Engine

- **Status**: Approved
- **Date**: 2026-08-06
- **Authors**: TyProX Core Engineering Team

## Context
Users benefit from understanding their long-term growth trajectory and estimated time to reach key milestones (e.g. 100 WPM, 120 WPM, 140 WPM).

## Decision
We implement a **Deterministic Forecasting Engine** in `src/features/intelligence/prediction/` using linear regression models over historical session telemetry:
- **7-Day & 30-Day WPM Forecast**: Evaluates rolling WPM slope $\beta_1$ and intercept $\beta_0$.
- **Plateau Risk Detection**: Identifies plateau periods when rolling slope $\beta_1 < 0.05$ across $> 15$ sessions.
- **Milestone Timeline**: Estimates session count and days required to achieve the next speed tier.
- **Confidence Interval**: Computes standard error of regression $S_e$ to provide lower/upper bounds.

Zero Machine Learning models / zero server GPU compute required.

## Consequences
- **Positive**: Instant client-side forecast calculation ($< 10\text{ms}$), 100% explainable mathematical results.
- **Negative**: Linear models assume consistent practice frequency; accuracy degrades if user pauses practice for long periods.
