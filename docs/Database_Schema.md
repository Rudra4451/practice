# TyProX PostgreSQL Database Schema

Complete database table definitions, indexes, constraints, and Row Level Security (RLS) policies:

- **`profiles`**: User identity, display handles, theme, font preferences.
- **`sessions`**: Active session metadata & workspace states.
- **`test_results`**: Completed test runs (WPM, raw WPM, accuracy, consistency, duration, seed).
- **`replays`**: Compressed JSONB keystroke telemetry streams (`version: 1`).
- **`typing_dna`**: Historical DNA snapshots & 26-letter heatmap matrices.
- **`creator_packs`**: Versioned user-generated text & code packs.
- **`clubs` & `club_members`**: Community clubs & member roles.
- **`activity_stream`**: Unified platform activity feed.
- **`settings`**: User keybindings & preference settings.
