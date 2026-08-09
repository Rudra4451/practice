# ADR-003: Repository Pattern for Data Access

- **Status**: Approved
- **Date**: 2026-08-06
- **Authors**: TyProX Core Engineering Team

## Context
Client components and API routes previously invoked Supabase client methods directly (`supabase.from('test_results').insert(...)`), scattering SQL queries, error handling, and database schemas across UI components.

## Problem
Direct database SDK calls in UI components couple visual rendering to database table schemas, complicate unit testing (mocking Supabase client calls is tedious), and make offline local storage fallbacks difficult to implement cleanly.

## Decision
We introduce a strict **Repository Pattern** layer in `src/infrastructure/repositories/`. UI components and API routes query repositories rather than database clients directly:

- `ProfilesRepository`: User profile CRUD, display name updates, username uniqueness checks.
- `TestResultsRepository`: Test run saving, historical aggregations, streak updates.
- `ReplaysRepository`: Compressed telemetry payload read/write operations.

Each repository interface defines clean TypeScript methods and encapsulates error handling, Supabase fallback handling, and local storage queueing.

```
[UI Component / API Route] ---> [TestResultsRepository] ---> [Supabase Client / Local Cache]
```

## Alternatives Considered
1. **Direct Supabase SDK Calls**: Faster for quick prototypes, but creates high coupling and schema refactoring friction.
2. **Prisma / Drizzle ORM Layer**: Adds extra server runtime overhead and database migration complexity on top of Supabase's native PostgreSQL capabilities.

## Consequences
- **Positive**: Complete decoupling of UI from DB schema, seamless offline storage fallbacks, type-safe data access, easy repository mocking in unit tests.
- **Negative**: Adds a thin abstraction layer requiring repository interface definitions.
