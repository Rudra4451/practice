# ADR-013: Composable SVG Blueprint Visualization Primitives

- **Status**: Approved
- **Date**: 2026-08-06
- **Authors**: TyProX Core Engineering Team

## Context
TyProX visualizations require high rendering performance and strict adherence to mechanical blueprint design tokens.

## Decision
We enforce a **Composable SVG Blueprint Primitive Library** in `src/design-system/charts/`:
- `BlueprintCanvas` (viewBox & SVG viewport container)
- `BlueprintAxis` (X & Y axis tick marks & grid lines)
- `BlueprintGrid` (background grid lines)
- `BlueprintScale` (linear & radial coordinate scaling helpers)
- `BlueprintSeries` (Framer Motion path rendering)
- `BlueprintCursor` (hover tracking cursor line)
- `BlueprintAnnotation` (data callouts & milestone flags)

All charts compose these primitives without duplicated inline SVG boilerplate code.

## Consequences
- **Positive**: Lightweight bundle size, zero 3rd-party charting library overhead, 60 FPS animation rendering, 100% brand consistency.
- **Negative**: Custom SVG coordinate math functions must be maintained.
