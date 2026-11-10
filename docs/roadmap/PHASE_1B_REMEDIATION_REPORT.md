# TyProX 2.0 — Phase 1B Critical Defect Remediation Report

**Completion Date:** 2026-11-11  
**Baseline Commit:** `fba1d80` on `main` (uncommitted Phase 1–5 + Phase 1 remediation working tree preserved cleanly)  
**Target Supabase Ref:** `gbovkejymfeiqgverzfr`  
**Authoritative Source List:** [`docs/roadmap/PHASE_1_DIFF_REVIEW.md`](file:///c:/Users/rudra/TyProX/docs/roadmap/PHASE_1_DIFF_REVIEW.md)  
**Governance Compliance:** Zero git commits, pushes, deployments, live database mutations, `.env*` edits, secret exposures, or production migration executions performed.

---

## Executive Summary & Release Readiness Status

| Gate / Scope | Status | Summary |
|---|---|---|
| **Application Code & Dual Next.js Build** | **READY / RESOLVED** | All `P0-1`, `P0-2` (app-side privilege-aware rollback + warning + atomic RPC integration), `P1-1`, `P1-2`, `P1-3`, and `P2-1` code defects resolved and verified across **both** Webpack and Turbopack builds, strict TypeScript, ESLint (`0` problems), `21` Vitest suites (`99/99` tests), and `7/7` Chromium E2E tests. |
| **Prepared Local SQL Migrations** | **READY (UNAPPLIED)** | [`20260621000000_typrox_2_hardening.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260621000000_typrox_2_hardening.sql) (`P1-4`, `DB-A1`, `DB-A2`, view drop guard) and [`20260623000000_atomic_result_persistence_and_idempotency.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260623000000_atomic_result_persistence_and_idempotency.sql) (`submit_verified_result` single-transaction Postgres RPC) are prepared on disk for sequential execution at the Production DB Gate. |
| **Production Database Approval Gate** | **`BLOCKED`** | Production `gbovkejymfeiqgverzfr` has **not** been modified. Live `public.replays` (`164` rows) still allows `anon` reads, `.env.local` lacks `SUPABASE_SERVICE_ROLE_KEY`, live catalog inspection (`pg_policies`, `role_table_grants`, `handle_new_user`) and backup/PITR verification remain pending owner execution before migrations `20260621` -> `20260622` -> `20260623` run. |

---

## Defect-by-Defect Remediation Summary

### `P0-1` & `P2-1` — Challenge Arena Config Lock, Restart Integrity, Unmount Cleanup & `role="alert"`
- **Files Modified:**
  - [`components/challenge/challenge-arena-client.tsx`](file:///c:/Users/rudra/TyProX/components/challenge/challenge-arena-client.tsx#L72-L84,L151-L162,L223,L260-L293)
  - [`components/typing/typing-container.tsx`](file:///c:/Users/rudra/TyProX/components/typing/typing-container.tsx#L226-L237)
- **What Changed:**
  - Passed `hideConfigBar` and `onRestartOverride={handleStartChallenge}` into `<TypingContainer />` inside `ChallengeArenaClient`, preventing idle mode/duration changes or random-seed `resetTest()` resets during 1v1 challenges.
  - Added `e.stopPropagation()` to `<textarea>` `Escape` handling in `TypingContainer` so pressing `Escape` inside the input does not double-trigger `window` `Escape`.
  - Added `challengeActiveRef` (`boolean`) alongside `current.seed === challenge.seed` so unmounting after any challenge start or restart reliably calls `resetTest()` and never leaks challenge results onto `/typing`.
  - Added `role="alert"` (`P2-1`) to the `ChallengeArenaClient` persistence error banner alongside `"Retry Save"`.
- **Verification ([`__tests__/components/challenge-arena-client.test.tsx`](file:///c:/Users/rudra/TyProX/__tests__/components/challenge-arena-client.test.tsx#L96-L316)):** Removed the mocked `TypingContainer` stub and implemented `3` integration tests with real `TypingContainer` + `useTypingStore` + `verifyAndScoreSession`, verifying config bar hiding, focused `Escape`, `"Restart Test"` button, unfocused `window` `Escape`, server telemetry verification post-restart, `role="alert"` + `"Retry Save"`, and unmount cleanup.

### `P0-2` — Privilege-Aware Rollback, Service-Role Diagnostics & Atomic Postgres RPC
- **Files Modified / Created:**
  - [`lib/supabase/admin.ts`](file:///c:/Users/rudra/TyProX/lib/supabase/admin.ts#L11-L64)
  - [`lib/typing/persistence.ts`](file:///c:/Users/rudra/TyProX/lib/typing/persistence.ts#L15-L44,L615-L866)
  - [`app/api/results/route.ts`](file:///c:/Users/rudra/TyProX/app/api/results/route.ts#L80-L131)
  - [`app/api/results/sync/route.ts`](file:///c:/Users/rudra/TyProX/app/api/results/sync/route.ts#L68-L70,L155-L159)
  - [`types/database.ts`](file:///c:/Users/rudra/TyProX/types/database.ts#L433-L452)
  - [`supabase/migrations/20260623000000_atomic_result_persistence_and_idempotency.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260623000000_atomic_result_persistence_and_idempotency.sql)
- **What Changed:**
  - Added `hasServiceRoleConfig()` and one-time `warnMissingServiceRoleOnce()` diagnostics in `lib/supabase/admin.ts` (never logging secrets/URLs).
  - Updated `persistVerifiedResult()` to track `isPrivilegedClient`:
    - When `isPrivilegedClient === true` (`SUPABASE_SERVICE_ROLE_KEY` provisioned) and `supabase.rpc` exists, calls `public.submit_verified_result(...)` first for single-transaction ACID persistence across `test_results`, `replays`, `streaks`, and `user_achievements`, falling back cleanly on missing-function `PGRST202`/`42883` before `20260623` applies.
    - When falling back to multi-step writes on `replays` failure, **only** attempts compensating `.delete().eq('id', ...).select('id')` if `isPrivilegedClient === true`, explicitly checks deleted row IDs to detect RLS-blocked `0`-row silent failures (`data: []`) or `42501` errors, skips doomed blind `DELETE` under SSR `authenticated` context, and raises structured [`ResultPersistenceError`](file:///c:/Users/rudra/TyProX/lib/typing/persistence.ts#L15-L44) with `{ orphanResultId, rollbackAttempted, rollbackSucceeded, recoverable, reason }`.
    - Returns HTTP `500` with `{ recoverable: true }` from `POST /api/results` when an unrolled recoverable orphan remains for automatic retry recovery.
  - Authored `public.submit_verified_result(...)` in `20260623` (`SECURITY DEFINER SET search_path = public`, `REVOKE ALL FROM PUBLIC, anon, authenticated; GRANT EXECUTE TO service_role;`) with row-locked `FOR UPDATE` UTC streak calculation and true prior PB lookup (`tr.id <> v_result.id`).
- **Verification ([`__tests__/typing/persistence.test.ts`](file:///c:/Users/rudra/TyProX/__tests__/typing/persistence.test.ts), [`__tests__/lib/admin.test.ts`](file:///c:/Users/rudra/TyProX/__tests__/lib/admin.test.ts)):** Tested RLS `0`-row silent delete detection (`data: []`), `42501` delete errors, unprivileged SSR orphan preservation + retry recovery, atomic `submit_verified_result` RPC execution + `PGRST202` pre-migration fallback, and `hasServiceRoleConfig` / `warnMissingServiceRoleOnce`.

### `P1-1` — Route Handler Export Compliance Across Webpack & Turbopack
- **Files Modified:**
  - [`lib/typing/sync-client.ts`](file:///c:/Users/rudra/TyProX/lib/typing/sync-client.ts#L4-L5)
  - [`app/api/results/sync/route.ts`](file:///c:/Users/rudra/TyProX/app/api/results/sync/route.ts#L7,L28)
- **What Changed:** Moved `export const MAX_SYNC_BATCH_SIZE = 30;` out of `app/api/results/sync/route.ts` (where Next.js Webpack typegen `.next/types/app/api/results/sync/route.ts` rejects non-Route-Handler exports with `TS2344`) into `lib/typing/sync-client.ts`, importing it in `route.ts`.
- **Verification:** Both `npx next build --webpack` (`TS2344` gone) and `npm run build` (Turbopack), followed by `npm run typecheck` after each build, exit `0`.

### `P1-2` — Removing `<45s` Short-Circuit, Enabling Late Pre-Migration Dedup & True Recovery PB
- **Files Modified:**
  - [`app/api/results/route.ts`](file:///c:/Users/rudra/TyProX/app/api/results/route.ts#L84-L108)
  - [`lib/typing/persistence.ts`](file:///c:/Users/rudra/TyProX/lib/typing/persistence.ts#L343-L498)
- **What Changed:**
  - Removed the early `if (rateCheck.latestRow) return ...` short-circuit in `POST /api/results`. Retries within `45s` bypass cooldown via `checkResultSubmissionRateLimit()` and proceed straight into `persistVerifiedResult(..., { clientRunId, deduplicateBySignature: true, isPrivilegedClient })`.
  - Updated `finalizeRecoveredResult()` to query prior Personal Best strictly excluding `existingRow.id` (`.neq('id', existingRow.id)`), recovering missing replays (`ensureReplayExistsForRecovery`), updating UTC streaks, unlocking missed achievements, and returning real `previousBestWpm`, `isPersonalBest`, `streakDays`, `unlocked`, `deduplicated: true`, and `recoveredPartialWrite: true`.
- **Verification ([`__tests__/api/results.route.test.ts`](file:///c:/Users/rudra/TyProX/__tests__/api/results.route.test.ts#L458-L716), [`__tests__/typing/persistence.test.ts`](file:///c:/Users/rudra/TyProX/__tests__/typing/persistence.test.ts)):** Explicitly tested `<45s` partial-write recovery (both `client_run_id` and `PGRST204` pre-migration), `>=45s` late signature deduplication without duplicate inserts, true PB (`priorBest < run` vs `priorBest > run`) across recovered & `23505`-raced rows, and cross-user `clientRunId` isolation.

### `P1-3` — Non-Looping Recoverable Guest Sync State & Legacy Duration Handling
- **Files Modified:**
  - [`stores/user-store.ts`](file:///c:/Users/rudra/TyProX/stores/user-store.ts#L23-L43,L64-L66,L136-L177)
  - [`lib/typing/sync-client.ts`](file:///c:/Users/rudra/TyProX/lib/typing/sync-client.ts#L7-L298)
  - [`app/api/results/sync/route.ts`](file:///c:/Users/rudra/TyProX/app/api/results/sync/route.ts#L72-L83,L100-L152,L188-L237)
  - [`app/dashboard/page.tsx`](file:///c:/Users/rudra/TyProX/app/dashboard/page.tsx#L362-L535)
- **What Changed:**
  - Excluded `!isValidDuration(item.duration)` (legacy pre-Phase-1 runs like `12s`/`45s`) and `item.syncStatus === 'rejected'` from `isSyncableGuestResult()` so `/dashboard` stops looping over permanently unsyncable runs while preserving 100% of runs and telemetry in `guestHistory`.
  - Added `syncStatus?: 'pending' | 'rejected'`, `syncRejectionReason`, `syncRejectedAt`, `markGuestResultsRejected()`, and `retryRejectedGuestResults()` in `useUserStore`.
  - Distinguished `SyncFailureCategory` (`'permanent_rejected' | 'rate_limited' | 'partial_failure' | 'server_error' | 'network_error'`) in `syncGuestHistoryBatches()`: HTTP `400` / `rejectedIds` mark items `'rejected'` (`temporaryFailure: false`), whereas HTTP `429` (with `Retry-After`), `207`, `500`, and network failures stay `'pending'` (`temporaryFailure: true`) so nothing is falsely marked permanent or dropped.
  - Updated `POST /api/results/sync` to meter `checkSyncRateLimit` quota by `Math.max(1, syncableCandidateCount)` and return HTTP `400` with `rejectedIds` + `rejectedReasons` when all candidates are rejected (`200` on mixed batches so synced items are still cleared).
  - Updated `DashboardPage` to display `"Local-Only / Paused Runs Preserved"` (`role="status"`) with an explicit `"Retry Held Runs"` action when paused or invalid-duration runs are present, without firing network retries automatically.
- **Verification ([`__tests__/typing/sync-client.test.ts`](file:///c:/Users/rudra/TyProX/__tests__/typing/sync-client.test.ts), [`__tests__/api/sync.route.test.ts`](file:///c:/Users/rudra/TyProX/__tests__/api/sync.route.test.ts), [`__tests__/components/dashboard-page.test.tsx`](file:///c:/Users/rudra/TyProX/__tests__/components/dashboard-page.test.tsx)):** Verified zero network calls for invalid-duration/held runs, `rejectedIds` + outer `400` handling, real `429` (`Retry-After`), `207`, `500`, network errors, and interactive `/dashboard` `"Retry Held Runs"` recovery.

### `P1-4`, `DB-A1`, & `DB-A2` — Prepared SQL Migrations (`NOT EXECUTED`)
- **Files Updated / Created:**
  - [`supabase/migrations/20260621000000_typrox_2_hardening.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260621000000_typrox_2_hardening.sql)
  - [`supabase/migrations/20260623000000_atomic_result_persistence_and_idempotency.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260623000000_atomic_result_persistence_and_idempotency.sql)
- **What Changed:**
  - **`P1-4`:** Removed table-wide `client_run_id UUID UNIQUE`, dropped legacy `test_results_client_run_id_key` constraints/indexes dynamically, and added composite partial unique index `idx_test_results_user_client_run_id ON public.test_results(user_id, client_run_id) WHERE user_id IS NOT NULL AND client_run_id IS NOT NULL;`.
  - **`DB-A1`:** Narrowed blanket `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public` to explicit `REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;`, protecting schema `public` extension operators/functions.
  - **`DB-A2`:** Reconciled all `11` live production achievement codes (`SPEED_50`, `SPEED_75`, `SPEED_80`, `SPEED_100`, `SPEED_120`, `SPEED_140`, `SPEED_150`, `STREAK_3`, `STREAK_7`, `STREAK_14`, `STREAK_30`) matching `public/achievements/*.svg` with `ON CONFLICT (code) DO NOTHING;`.
  - Added `DROP VIEW IF EXISTS public.leaderboard_view;` ahead of view creation for idempotent clean replay.

---

## Final Verification Results (Executed After Last Code Edit)

All checks below ran sequentially against the final state of the codebase:

| Check | Result | Verified Outcome |
|---|---|---|
| `npm run lint` (`eslint`) | **PASS (`exit 0`)** | `0` errors, `0` warnings across entire codebase & tests |
| `npm run test:unit` (`vitest run`) | **PASS (`exit 0`)** | **`21` test files, `99/99` tests passed** in `8.10s` |
| `npx next build --webpack` | **PASS (`exit 0`)** | `33/33` routes compiled + Webpack `.next/types/` validation passed (`TS2344` eliminated) |
| `npm run typecheck` *(after Webpack build)* | **PASS (`exit 0`)** | `0` TypeScript errors against Webpack `.next/types/` |
| `npm run build` *(Turbopack default)* | **PASS (`exit 0`)** | `33/33` routes + `ƒ Proxy (Middleware)` compiled |
| `npm run typecheck` *(after Turbopack build)* | **PASS (`exit 0`)** | `0` TypeScript errors against Turbopack `.next/types/` |
| `npm run test:e2e` (`playwright test`) | **PASS (`exit 0`)** | **`7/7` Chromium E2E tests** passed in `1.9m` on isolated `127.0.0.1:3105` |
| `git diff --check` | **PASS (`exit 0`)** | Zero whitespace/conflict-marker errors (`58` tracked `M/D`, CRLF notices only) |
| `.env.local` Key Audit | **VERIFIED** | Keys present: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (**still absent:** `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`) |

---

## Production Database Rollout & Service-Role Runbook (Owner Action Required)

> [!CAUTION]
> Do **not** execute `20260621` until `SUPABASE_SERVICE_ROLE_KEY` is deployed in `.env.local` and hosting environment variables. Applying `20260621` revokes direct client `INSERT`/`UPDATE` on `test_results`, `replays`, `streaks`, `challenge_links`, and `user_achievements` — routes without `SUPABASE_SERVICE_ROLE_KEY` would immediately return `500` (`42501`).

1. **Inspect Production Catalog & Backups (Read-Only):**
   - Execute the 6 read-only inspection queries in [`SECURITY_REMEDIATION_PLAN.md` Section 4](file:///c:/Users/rudra/TyProX/docs/roadmap/SECURITY_REMEDIATION_PLAN.md#L258-L298) in Supabase SQL Editor (`pg_policies`, `role_table_grants`, views, indexes/achievements/realtime, `handle_new_user()`, orphan/__debug_test__ counts).
   - Verify Supabase automated backup / PITR snapshot or take a manual `pg_dump`.
   - Decide & execute owner cleanup on the `6` historic `__debug_test__` (`user_id IS NULL`) rows and active streaks if desired.
2. **Provision Environment Secrets (Without Exposing Values):**
   - Set `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SITE_URL` in local `.env.local` (never committed) and production hosting secret storage.
   - Verify `hasServiceRoleConfig()` is active on deploy; inspect runtime logs to verify `[TyProX Security] SUPABASE_SERVICE_ROLE_KEY is missing` does not appear.
3. **Apply Migrations Strictly in Order (`gbovkejymfeiqgverzfr`):**
   1. [`20260621000000_typrox_2_hardening.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260621000000_typrox_2_hardening.sql)
   2. [`20260622000000_learning_and_competitive_ecosystem.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260622000000_learning_and_competitive_ecosystem.sql)
   3. [`20260623000000_atomic_result_persistence_and_idempotency.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260623000000_atomic_result_persistence_and_idempotency.sql)
4. **Post-Migration Validation SQL (Read-Only):**
   ```sql
   SELECT COUNT(*) FROM public.achievements; -- Expect >= 11 including SPEED_80, SPEED_150, STREAK_14
   SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'test_results' AND schemaname = 'public'; -- Expect idx_test_results_user_client_run_id
   SELECT c.relname, c.reloptions FROM pg_class c WHERE c.relname = 'leaderboard_view'; -- Expect security_invoker=true
   SELECT proname, prosecdef, proconfig FROM pg_proc WHERE proname IN ('handle_new_user', 'submit_verified_result');
   -- Confirm anon REST probe against /rest/v1/replays returns [] (0 rows readable anonymously)
   ```

---

## Remaining Out-of-Scope / Follow-Up Items (Tracked Transparently)

1. **`QA-A1` Real Postgres/Docker Integration Harness:** Current Vitest API & persistence suites exercise thoroughly mocked PostgREST clients (including explicit RLS `0`-row and `42501` branches), **not** live PostgreSQL constraint evaluation or `submit_verified_result` PL/pgSQL execution. Provisioning Supabase CLI / Docker local DB testing remains an important follow-up before autonomous CI migrations.
2. **`P1-5` / `SEC-A2` Distributed Sync Throttling & Signed Run-Start Tokens:** `syncWindowCache` in [`lib/security/rate-limit.ts`](file:///c:/Users/rudra/TyProX/lib/security/rate-limit.ts#L39) remains process-local `Map` state (10-minute `150`-row DB ceiling remains global), and `POST /api/runs/init` wall-clock run tokens remain deferred for a dedicated security batch.
3. **Remaining `P2-2` / `P2-3` / Tech Debt:**
   - `ResultScreen.handleShare` fallback behavior while persistence is in flight or errored (`P2-2`).
   - [`lib/data/leaderboard.ts`](file:///c:/Users/rudra/TyProX/lib/data/leaderboard.ts#L132) `PGRST205` fallback `.limit(300)` ceiling (resolved natively on prod once `20260621` deploys `leaderboard_view`), [`app/api/auth/signout/route.ts`](file:///c:/Users/rudra/TyProX/app/api/auth/signout/route.ts) raw error message masking (`SEC-A5`), [`AuthProvider`](file:///c:/Users/rudra/TyProX/components/providers/auth-provider.tsx#L68-L71) residual `getSession()` call, and dead exports (`vite-tsconfig-paths`, `utils/text-generator.ts`, `getClientSession()`).
4. **Git Commit Splitting:** Working tree still holds all accumulated uncommitted changes (`58` tracked `M/D` paths + untracked feature/test/doc paths); split into logical commits cleanly after review.

