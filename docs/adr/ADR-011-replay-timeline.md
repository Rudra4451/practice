# ADR-011: Timeline-Based Replay Engine Layering

- **Status**: Approved
- **Date**: 2026-08-06
- **Authors**: TyProX Core Engineering Team

## Context
Keystroke replays reproduce test runs frame-by-frame. As new visual analysis overlays (e.g. ghost heatmaps, error flags, WPM curves) are introduced, monolithic replay components become unmaintainable.

## Decision
We enforce a **7-Layer Composable Replay Timeline Architecture**:
- Layer 1: Cursor Position
- Layer 2: Typed Input Text
- Layer 3: Error Mis-strike Overlay
- Layer 4: Instantaneous WPM Curve
- Layer 5: Rhythm Stability Bar
- Layer 6: Keypress Heatmap Overlay
- Layer 7: DNA Marker Milestones

Each layer renders as an independent overlay component synchronized to the global playback timeline clock.

## Consequences
- **Positive**: High modularity; new visual playback layers can be added without modifying core playback timing loops.
- **Negative**: Requires synchronized timeline clock context.
