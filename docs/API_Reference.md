# TyProX Versioned Public API v1 Reference

All production API routes are versioned under `/api/v1/`:

## Endpoints

### 1. `POST /api/v1/results`
Submits a completed test run for database validation, replay storage, streak calculation, and achievement evaluations.
- **Request Body**: `VersionedTelemetryPayload` (`version: 1`).
- **Response**: `{ success: true, apiVersion: "v1", resultId: "uuid" }`.

### 2. `GET /api/v1/entities`
Queries domain entities (`user`, `profile`, `session`, `replay`, `text_pack`, `challenge`, `club`, `achievement`).
- **Query Params**: `type`, `limit`.
- **Response**: `{ apiVersion: "v1", entityType: string, entities: BaseEntity[] }`.
