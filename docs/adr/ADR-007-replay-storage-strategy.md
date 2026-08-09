# ADR-007: Telemetry Replay Storage & Compression Strategy

- **Status**: Approved
- **Date**: 2026-08-06
- **Authors**: TyProX Core Engineering Team

## Context
Every completed test run generates a stream of keystroke events containing timestamps, character values, delete actions, and target string character offsets. A 2-minute test run at 120 WPM produces over 1,200 individual keystroke event objects.

## Problem
Storing verbose uncompressed event JSON objects (`{ "timestamp": 1690000100, "character": "a", "action": "input", "targetIndex": 42 }`) consumes significant database storage per run and increases payload bandwidth during replay playback.

## Decision
We enforce a compressed key-token mapping schema for all telemetry payloads written to `public.replays`:

```json
[
  { "t": 45,  "k": "t", "y": 0, "i": 0 },
  { "t": 110, "k": "h", "y": 0, "i": 1 },
  { "t": 180, "k": "e", "y": 0, "i": 2 }
]
```

- `t`: Relative time delta (ms) from test start.
- `k`: Key string value.
- `y`: Key action flag (`0` = input, `1` = delete).
- `i`: Target text character index.

Replay payloads are capped at 10,000 events per test run (~3 minutes at 180 WPM) and stored in PostgreSQL `JSONB` columns with foreign key cascade reference to `public.test_results`.

## Alternatives Considered
1. **Raw Binary ArrayBuffer (Protobuf/FlatBuffers)**: Highly compressed, but loses direct PostgreSQL JSONB querying ability and requires custom browser decoding steps.
2. **Full Verbose Key-Value Objects**: Easy to read, but increases database storage footprint by ~4.5x.

## Consequences
- **Positive**: ~75% reduction in DB payload size while retaining PostgreSQL JSONB native query capabilities.
- **Negative**: Field names use single-character keys (`t`, `k`, `y`, `i`) requiring typed TypeScript interfaces for developer clarity.
