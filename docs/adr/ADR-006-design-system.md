# ADR-006: Mechanical Keycap Design System Architecture

- **Status**: Approved
- **Date**: 2026-08-06
- **Authors**: TyProX Core Engineering Team

## Context
TyProX requires a distinct brand visual language that reflects mechanical keycap precision without copying existing typing platforms.

## Problem
Inconsistent border radii, shadow elevations, and generic SaaS layout templates create a fragmented user interface and fail to convey the tactile precision of mechanical keyboards.

## Decision
We enforce a unified **Mechanical Keycap Design System** in `src/design-system/`:

- **Keycap Corner Radius**: Fixed `18px` (`rounded-[18px]`).
- **Key Travel & Elevation**: `4px` travel offset (`translate-y-[4px]`), `6px` shadow elevation (`shadow-[0_6px_0_var(--border)]`).
- **Pressed Key State**: `3px` downward offset on active press (`active:translate-y-[3px] active:shadow-[0_3px_0_var(--border)]`).
- **Blueprint Stroke**: `1.5px` border outline on blueprint containers.
- **Motion Timing**: `140ms` duration curve (`duration-140 ease-out`).
- **Typography Scale**: `Space Grotesk` (Headers), `IBM Plex Mono` / `JetBrains Mono` (Code/Data), `Inter` (UI Body).

## Alternatives Considered
1. **Generic Tailwind UI Defaults**: Fast, but generic and lacks brand identity.
2. **Neobrutalism (Heavy Black Offset Borders)**: Visually loud and lacks luxury engineering polish.

## Consequences
- **Positive**: Cohesive, tactile UI experience that feels like operating a precision mechanical engineering instrument.
- **Negative**: Custom shadow and key travel properties must be maintained in CSS custom tokens.
