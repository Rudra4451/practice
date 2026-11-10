# TyProX 2.0 — Phase 1C Independent Audit Remediation Report

**Completion Date:** 2026-11-11  
**Baseline Commit:** `fba1d80` on `main` (existing uncommitted Phase 1–5 + Phase 1/1B working tree preserved cleanly)  
**Target Supabase Ref:** `gbovkejymfeiqgverzfr`  
**Authoritative Audit Source:** [`docs/roadmap/PHASE_1B_INDEPENDENT_AUDIT.md`](file:///c:/Users/rudra/TyProX/docs/roadmap/PHASE_1B_INDEPENDENT_AUDIT.md)  
**Governance Compliance:** Zero git commits, pushes, deployments, `.env*` edits, secret exposures, production queries, or production migration executions performed.

---

## Executive Verdict

### **VERDICT: `APPLICATION CODE VERIFIED / PRODUCTION DB ROLLOUT BLOCKED PENDING OWNER GATE & CI POSTGRES 16 EXECUTION`**

| Decision Gate | Status | Verified Summary |
|---|---|---|
| **Application Code & Type-Safe Security Boundaries** | **VERIFIED** | Every Section 3 (`#1`–`#6`) and Section 4 (`#1`–`#2`) finding from [`PHASE_1B_INDEPENDENT_AUDIT.md`](file:///c:/Users/rudra/TyProX/docs/roadmap/PHASE_1B_INDEPENDENT_AUDIT.md) is remediated in code and verified across `lint`, `tsc`, dual Next.js builds (`webpack` + `turbopack`), **`23` Vitest suites (`118/118` tests)**, and **`7/7` Chromium Playwright E2E tests (`52.9s`)**. |
| **Forward Corrective SQL Migration (`20260624`)** | **PREPARED (STATICALLY TRACED, UNAPPLIED)** | [`20260624000000_phase1c_security_and_streak_fixes.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260624000000_phase1c_security_and_streak_fixes.sql) (`622` lines) remediates `profiles.username` REST tampering, multi-collision `handle_new_user()`, qualifying-event streaks, future `last_active_date` preservation, and `is_invalidated` / `client_run_id` conflict enforcement while leaving `20260618`–`20260623` untouched to prevent migration checksum drift. **Not executed locally or against production.** |
| **PostgreSQL 16 CI Verification Harness** | **AUTHORED (UNEXECUTED LOCALLY)** | Full PG 16 verification suite ([`supabase_shim.sql`](file:///c:/Users/rudra/TyProX/tests/db/supabase_shim.sql), [`verify_migrations.sql`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql), [`run-pg-verification.sh`](file:///c:/Users/rudra/TyProX/tests/db/run-pg-verification.sh), [`docker-compose.db.yml`](file:///c:/Users/rudra/TyProX/docker-compose.db.yml), [`.github/workflows/ci-postgres-verification.yml`](file:///c:/Users/rudra/TyProX/.github/workflows/ci-postgres-verification.yml)) was authored and statically traced line-by-line, **not executed** on this Windows host because `docker`, `psql`, `supabase`, `sh`, and `bash` are absent (`npm run test:db` exits `1`). |
| **Production DB Cutover (`gbovkejymfeiqgverzfr`)** | **`BLOCKED`** | Production database remains **unhardened** (`public.replays` `164` rows readable via `anon`; `leaderboard_view` missing) until the Owner completes pre-migration inspection, provisions `SUPABASE_SERVICE_ROLE_KEY`, runs PG 16 CI verification, and applies `20260621` -> `20260622` -> `20260623` -> `20260624`. |

---

## Finding-by-Finding Remediation Matrix (`PHASE_1B_INDEPENDENT_AUDIT.md`)

### 1. Section 3 — Security Boundary, Cooldown, Quota & E2E Findings

#### 3.1 `ADMIN-FAIL-CLOSED` (`PHASE_1B_INDEPENDENT_AUDIT.md` Section 3 `#1`)
- **Problem:** `createAdminClient()` logged one warning and failed open to caller SSR `authenticated` context even when `NODE_ENV === 'production'`.
- **Fix Implemented:**
  - [`lib/supabase/admin.ts`](file:///c:/Users/rudra/TyProX/lib/supabase/admin.ts#L23-L129): Added [`AdminConfigurationError`](file:///c:/Users/rudra/TyProX/lib/supabase/admin.ts#L23-L35) (`status = 503`, `code = 'ADMIN_CONFIG_MISSING'`), [`isNonPrivilegedDevFallbackAllowed()`](file:///c:/Users/rudra/TyProX/lib/supabase/admin.ts#L49-L51), and [`resolvePrivilegedWriteClient()`](file:///c:/Users/rudra/TyProX/lib/supabase/admin.ts#L105-L129) which fails closed in `NODE_ENV === 'production'`, explicitly returns `isPrivilegedClient: false` (`privilegeMode: 'ssr_dev_fallback'`) only in non-production, and never mislabels an SSR client as `service_role`.
  - Wired across all privileged write endpoints: [`app/api/results/route.ts`](file:///c:/Users/rudra/TyProX/app/api/results/route.ts#L57-L61,L184-L192), [`app/api/results/sync/route.ts`](file:///c:/Users/rudra/TyProX/app/api/results/sync/route.ts#L75-L79), [`app/api/challenges/route.ts`](file:///c:/Users/rudra/TyProX/app/api/challenges/route.ts#L42-L46,L117-L124), and username transitions in [`app/api/profile/route.ts`](file:///c:/Users/rudra/TyProX/app/api/profile/route.ts#L95-L103). Normal display preference updates on `PATCH /api/profile` continue using caller SSR context cleanly.
- **Verification:** [`__tests__/lib/admin.test.ts`](file:///c:/Users/rudra/TyProX/__tests__/lib/admin.test.ts) (`3` tests), [`__tests__/api/results.route.test.ts`](file:///c:/Users/rudra/TyProX/__tests__/api/results.route.test.ts), [`__tests__/api/sync.route.test.ts`](file:///c:/Users/rudra/TyProX/__tests__/api/sync.route.test.ts), [`__tests__/api/challenges.route.test.ts`](file:///c:/Users/rudra/TyProX/__tests__/api/challenges.route.test.ts), and [`__tests__/api/profile.route.test.ts`](file:///c:/Users/rudra/TyProX/__tests__/api/profile.route.test.ts).

#### 3.2 `SQL-PROFILES-USERNAME` (`PHASE_1B_INDEPENDENT_AUDIT.md` Section 3 `#2`)
- **Problem:** Direct `GRANT UPDATE (..., username, ...)` on `public.profiles` allowed authenticated JWTs calling Supabase REST `PATCH /rest/v1/profiles` directly to bypass `RESERVED_USERNAMES`, claim admin routes, overwrite locked usernames, or revert to `user_xxxxxxxx` placeholders.
- **Fix Implemented:**
  - **Shared Rule Module ([`lib/security/username.ts`](file:///c:/Users/rudra/TyProX/lib/security/username.ts#L1-L44)):** Centralized `USERNAME_PATTERN` (`^[a-z0-9_]{3,24}$`), `TEMPORARY_USERNAME_PATTERN` (`^user_[0-9a-f]{8}(?:_[0-9a-f]{4,8})?$`), and the `24`-entry `RESERVED_USERNAMES` allowlist (`admin`, `typrox`, `api`, `dashboard`, `leaderboard`, `profile`, `u`, `null`, `undefined`, etc.).
  - **SQL Enforcement ([`20260624000000_phase1c_security_and_streak_fixes.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260624000000_phase1c_security_and_streak_fixes.sql#L14-L110)):** Revoked direct table `UPDATE` on `public.profiles` from `PUBLIC, anon, authenticated`; granted column-level `UPDATE (display_name, avatar_url, theme, font_family, updated_at)` ONLY (excluding `username`); added [`public.is_reserved_username(TEXT)`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260624000000_phase1c_security_and_streak_fixes.sql#L25-L59) + trigger [`trg_enforce_profile_username_integrity`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260624000000_phase1c_security_and_streak_fixes.sql#L106-L110) blocking reserved/placeholder/malformed handles (`23514`) and locking permanent handles (`42501 USERNAME_LOCKED`).
  - **API & Modal Parity ([`app/api/profile/route.ts`](file:///c:/Users/rudra/TyProX/app/api/profile/route.ts#L95-L125), [`components/auth/username-modal.tsx`](file:///c:/Users/rudra/TyProX/components/auth/username-modal.tsx#L23-L68)):** `PATCH /api/profile` enforces one-time username transition (`403 USERNAME_LOCKED`) via `resolvePrivilegedWriteClient` and checks reserved/temp patterns; `UsernameModal` opens cleanly even for `user_<8hex>_<8hex>` handles and mirrors `3..24` + reserved checks.
- **Verification:** [`__tests__/api/profile.route.test.ts`](file:///c:/Users/rudra/TyProX/__tests__/api/profile.route.test.ts) (`6` tests including `403 USERNAME_LOCKED`, idempotent replay of current handle, and `503` in prod without key) and [`__tests__/components/username-modal.test.tsx`](file:///c:/Users/rudra/TyProX/__tests__/components/username-modal.test.tsx) (`1` test).

#### 3.3 `RESULTS-RETRY-ORDER` (`PHASE_1B_INDEPENDENT_AUDIT.md` Section 3 `#3`)
- **Problem:** `POST /api/results` checked `latestRow` before `clientRunId` recovery (blocking orphaned Run A retries with `429` if a newer Run B ran within `8s`), while `recentRunCache` returned `{ deduplicated: true }` without checking payload/telemetry parity or live invalidation state.
- **Fix Implemented:**
  - [`lib/security/rate-limit.ts`](file:///c:/Users/rudra/TyProX/lib/security/rate-limit.ts#L79-L126,L173-L288): Added `buildVerifiedPayloadDigest`, bounded per-run/per-user [`checkClientRunRecoveryBudget`](file:///c:/Users/rudra/TyProX/lib/security/rate-limit.ts#L173-L210) (`6/min` per run, `20/min` per user), and prioritized `(user_id, client_run_id)` lookup ahead of `8s` latest-run cooldown inside [`checkResultSubmissionRateLimit`](file:///c:/Users/rudra/TyProX/lib/security/rate-limit.ts#L219-L288).
  - [`app/api/results/route.ts`](file:///c:/Users/rudra/TyProX/app/api/results/route.ts#L71-L166): Verifies `cachedHit.payloadDigest === payloadDigest` (`409 CLIENT_RUN_ID_CONFLICT` on mismatch), checks bounded recovery budget (`429`), re-verifies live DB `is_invalidated` state before returning cache (`409 RESULT_INVALIDATED`), and clears `unlocked: []` on cache dedup.
- **Verification:** [`__tests__/api/results.route.test.ts`](file:///c:/Users/rudra/TyProX/__tests__/api/results.route.test.ts) (`12` tests verifying Run A recovery after newer Run B within `8s`, `429` recovery ceiling, cache digest mismatch -> `409`, and live DB invalidation cache eviction).

#### 3.4 `SYNC-QUOTA-VALIDATION` (`PHASE_1B_INDEPENDENT_AUDIT.md` Section 3 `#4`)
- **Problem:** `syncableCandidateCount` omitted `isValidDuration(item.duration)`, metering permanently unsyncable legacy runs toward sync rate-limit quota and exhausting quota on empty/legacy batches (`itemCount = 0`).
- **Fix Implemented:**
  - [`app/api/results/sync/route.ts`](file:///c:/Users/rudra/TyProX/app/api/results/sync/route.ts#L81-L94): Filters `syncableCandidateCount` using both `isRankedMode(item.mode)` and `isValidDuration(item.duration)`.
  - [`lib/security/rate-limit.ts`](file:///c:/Users/rudra/TyProX/lib/security/rate-limit.ts#L334-L395): Skips incrementing request quota when `itemCount === 0`, while preserving global `150` rows / `10 min` DB ceiling. *(Note: Multi-instance distributed sync throttling remains `P1-5` deferred without Redis infrastructure.)*
- **Verification:** [`__tests__/api/sync.route.test.ts`](file:///c:/Users/rudra/TyProX/__tests__/api/sync.route.test.ts) (`8` tests).

#### 3.5 `SQL-SIGNUP-TRIGGER` (`PHASE_1B_INDEPENDENT_AUDIT.md` Section 3 `#5`)
- **Problem:** `handle_new_user()` only handled a single username collision, crashing with `23505` if two collisions occurred or `user_<8hex>` collided.
- **Fix Implemented:** [`20260624:113-215`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260624000000_phase1c_security_and_streak_fixes.sql#L113-L215) sanitizes reserved/temp OAuth handles, iterates `attempt IN 0..15` appending randomized `8`-char hex suffixes inside `BEGIN ... EXCEPTION WHEN unique_violation` blocks (also checking concurrent `id` insert), and falls back to `gen_random_uuid()` suffix. *(Statically traced against PG 16 semantics; awaits CI PostgreSQL 16 execution.)*

#### 3.6 `E2E-STABILITY-AND-LANDMARK` (`PHASE_1B_INDEPENDENT_AUDIT.md` Section 3 `#6` & Section 7 `#2`)
- **Problem:** `tests/e2e/typrox.spec.ts` Test 6 timed out at `60,000ms` on `waitUntil: 'networkidle'` against `/leaderboard` Realtime subscriptions; running with `domcontentloaded` uncovered two real issues: [`HomeLanding`](file:///c:/Users/rudra/TyProX/components/home/home-landing.tsx#L80) lacked a `<main>` landmark on `/`, and `/leaderboard` Suspense streaming transiently holds fallback `<main>` + `<div hidden>` `<main>` briefly before `$RC` swaps chunks.
- **Fix Implemented:**
  - Wrapped `<Hero3D />`..`<FAQSection />` inside `<main className="flex-1 flex flex-col">` in [`components/home/home-landing.tsx`](file:///c:/Users/rudra/TyProX/components/home/home-landing.tsx#L80).
  - Updated [`tests/e2e/typrox.spec.ts`](file:///c:/Users/rudra/TyProX/tests/e2e/typrox.spec.ts#L211-L306): Test 6 waits cleanly for Next.js streaming settlement (`locator('main')` count `1` + visible `getByRole('main')`) without `networkidle` inside default `60_000ms` timeouts, and Test 5 verifies `/challenge/11111111-1111-4111-8111-111111111111` expired/not-found fallback + navigation to `/typing`.
- **Verification:** `npm run test:e2e` passed **`7/7` (`52.9s`, `exit 0`)**, including `8.5s` across all `9` desktop Dark/Light + mobile views.

---

### 2. Section 4 — High / `P1` Persistence & PL/pgSQL Regressions Fixed

#### 4.1 `SQL-DEDUP-STREAK` (`PHASE_1B_INDEPENDENT_AUDIT.md` Section 4 `#1`)
- **Problem:** Both `submit_verified_result` (`20260623`) and `finalizeRecoveredResult` (`lib/typing/persistence.ts`) unconditionally executed streak updates on pure deduplicated retries (turning yesterday's retry into today's UTC streak advance) and overwrote future `last_active_date` skews backwards.
- **Fix Implemented:**
  - [`20260624:469-588`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260624000000_phase1c_security_and_streak_fixes.sql#L469-L588): Computed `v_qualifies_for_streak := (NOT v_deduplicated) OR v_recovered_partial`. Pure duplicates perform a read-only `SELECT` on `public.streaks` and return `unlocked = []`; orphan partial-write recoveries serialize via `FOR UPDATE`, anchor streak calculation to `v_result.created_at` UTC date (`COALESCE((timezone('utc'::text, v_result.created_at))::date, v_today)`), and never overwrite a future `last_active_date > v_activity_date`. Avoided `FOUND` state bugs with explicit `v_has_replay` and `v_streak_exists` booleans.
  - [`lib/typing/persistence.ts`](file:///c:/Users/rudra/TyProX/lib/typing/persistence.ts#L237-L359,L524-L634): Added [`readDailyStreakForUser()`](file:///c:/Users/rudra/TyProX/lib/typing/persistence.ts#L237-L252), updated [`updateDailyStreakForUser()`](file:///c:/Users/rudra/TyProX/lib/typing/persistence.ts#L254-L359) to accept `referenceDate` (`created_at`) and preserve future `last_active_date`, updated [`ensureReplayExistsForRecovery()`](file:///c:/Users/rudra/TyProX/lib/typing/persistence.ts#L451-L522) for `23505` race loser semantics & telemetry parity checks, and gated streak/achievement evaluation in [`finalizeRecoveredResult()`](file:///c:/Users/rudra/TyProX/lib/typing/persistence.ts#L524-L634) strictly on `replayRecovery.recovered === true`.

#### 4.2 `SQL-INVALIDATED-ID` (`PHASE_1B_INDEPENDENT_AUDIT.md` Section 4 `#2`)
- **Problem:** `(user_id, client_run_id)` lookup ignored `is_invalidated`, letting invalidated/moderated runs replay cleanly as valid deduplicated scores, compute PBs, and unlock speed achievements.
- **Fix Implemented:**
  - [`20260624:274-354,394-426`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260624000000_phase1c_security_and_streak_fixes.sql#L274-L354): Rejects invalidated `client_run_id` rows and invalidated signature matches with `P0001 RESULT_INVALIDATED`, and rejects mismatched `mode`/`duration`/`seed`/telemetry on an active `client_run_id` with `P0001 CLIENT_RUN_ID_CONFLICT` across both initial lookup and `23505` exception paths.
  - [`lib/typing/persistence.ts`](file:///c:/Users/rudra/TyProX/lib/typing/persistence.ts#L61-L128,L636-L880): Distinguishes `'result_invalidated'` and `'client_run_id_conflict'` across direct DB lookups, signature checks, `23505` conflict recovery, and RPC `P0001` errors; [`app/api/results/route.ts`](file:///c:/Users/rudra/TyProX/app/api/results/route.ts#L194-L214) maps both to HTTP `409`; [`app/api/results/sync/route.ts`](file:///c:/Users/rudra/TyProX/app/api/results/sync/route.ts#L196-L204) moves them into permanent `rejectedIds` / `rejectedReasons` (stopping guest sync loops via `'rejected'`).
- **Verification:** [`__tests__/typing/persistence.test.ts`](file:///c:/Users/rudra/TyProX/__tests__/typing/persistence.test.ts) (`14` tests), [`__tests__/api/results.route.test.ts`](file:///c:/Users/rudra/TyProX/__tests__/api/results.route.test.ts) (`12` tests), and [`__tests__/api/sync.route.test.ts`](file:///c:/Users/rudra/TyProX/__tests__/api/sync.route.test.ts) (`8` tests).

---

### 3. Additional Audit Hygiene, Typing & Sync Fixes Completed in Phase 1C

- **Type Drift (`types/database.ts`):** Added `generator_version?: number` and `is_ranked?: boolean` to `test_results` `Row` / `Insert` / `Update` in [`types/database.ts`](file:///c:/Users/rudra/TyProX/types/database.ts#L58-L97).
- **Error Masking (`SEC-A5` partial):** Masked catch error response in [`app/api/auth/signout/route.ts`](file:///c:/Users/rudra/TyProX/app/api/auth/signout/route.ts#L32) to static `{ success: false, error: 'Sign-out failed' }`, verified by [`__tests__/api/signout.route.test.ts`](file:///c:/Users/rudra/TyProX/__tests__/api/signout.route.test.ts) (`2` tests).
- **Bounded Auto-Sync Retries (`sync-client.ts` & `user-store.ts`):** Added `'held'` and `'synced'` clarity, [`MAX_GUEST_SYNC_RETRIES = 3`](file:///c:/Users/rudra/TyProX/stores/user-store.ts#L28-L49), and [`DEFAULT_MAX_SYNC_BATCHES = 10`](file:///c:/Users/rudra/TyProX/lib/typing/sync-client.ts#L6), verified in [`__tests__/typing/sync-client.test.ts`](file:///c:/Users/rudra/TyProX/__tests__/typing/sync-client.test.ts) (`5` tests) and [`__tests__/components/dashboard-page.test.tsx`](file:///c:/Users/rudra/TyProX/__tests__/components/dashboard-page.test.tsx) (`2` tests).
- **PostgreSQL 16 Verification Harness (`QA-A1` prepared):** Created [`tests/db/supabase_shim.sql`](file:///c:/Users/rudra/TyProX/tests/db/supabase_shim.sql), [`tests/db/verify_migrations.sql`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql), [`tests/db/run-pg-verification.sh`](file:///c:/Users/rudra/TyProX/tests/db/run-pg-verification.sh) (`LF`-verified), [`docker-compose.db.yml`](file:///c:/Users/rudra/TyProX/docker-compose.db.yml), [`.github/workflows/ci-postgres-verification.yml`](file:///c:/Users/rudra/TyProX/.github/workflows/ci-postgres-verification.yml), and `"test:db"` script in [`package.json`](file:///c:/Users/rudra/TyProX/package.json#L13).

---

## Command Verification Matrix

> [!IMPORTANT]
> Build checks (`webpack` + `turbopack`) ran after the final application source edit ([`components/home/home-landing.tsx`](file:///c:/Users/rudra/TyProX/components/home/home-landing.tsx)). Following the final test edit ([`tests/e2e/typrox.spec.ts`](file:///c:/Users/rudra/TyProX/tests/e2e/typrox.spec.ts)), `lint`, `typecheck`, `test:unit`, `test:e2e`, and `test:db` were re-executed sequentially.

| Command | Result | Observed Details |
|---|---|---|
| `npx next build --webpack` | **PASS (`exit 0`)** | `33/33` routes + `ƒ Proxy (Middleware)` compiled cleanly (`task-3976`, post-last-app edit) |
| `npm run typecheck` *(post-Webpack)* | **PASS (`exit 0`)** | `0` errors across Webpack `.next/types/` |
| `npm run build` *(Turbopack)* | **PASS (`exit 0`)** | `33/33` routes + `ƒ Proxy (Middleware)` compiled cleanly (`task-3996`, post-last-app edit) |
| `npm run typecheck` *(post-Turbopack)* | **PASS (`exit 0`)** | `0` errors across Turbopack `.next/types/` |
| `npm run lint` | **PASS (`exit 0`)** | `0` errors, `0` warnings across app + unit + E2E suite (post-all edits) |
| `npm run typecheck` *(post-E2E edit)* | **PASS (`exit 0`)** | `0` errors (`tsc --noEmit --incremental false`, post-all edits) |
| `npm run test:unit` | **PASS (`exit 0`)** | **`23` test files, `118/118` tests passed** in `7.23s` (mocked DB clients in API/persistence suites) |
| `npm run test:e2e` | **PASS (`exit 0`)** | **`7/7` Chromium E2E tests** passed in `52.9s` on isolated `127.0.0.1:3105` (Test 6 completed in `8.5s`) |
| `npm run test:db` | **FAIL (`exit 1`)** | `'sh' is not recognized` on Windows host (`docker`, `psql`, `supabase`, `sh`, `bash` verified absent) |
| `git diff --check` | **PASS (`exit 0`)** | Zero conflict markers or trailing whitespace errors |

---

## Mandatory Owner Production Cutover Sequence

> [!CAUTION]
> **Do not deploy Phase 1C app code OR run migrations in the wrong order.** Setting `NODE_ENV=production` without `SUPABASE_SERVICE_ROLE_KEY` triggers intentional `503 ADMIN_CONFIG_MISSING` fail-closed responses on ranked submissions, sync, challenges, and username updates. Conversely, running `20260621`–`20260624` before provisioning `SUPABASE_SERVICE_ROLE_KEY` locks out direct client writes immediately.

1. **Pre-Migration Production Audit & Backup Gate (`gbovkejymfeiqgverzfr`):**
   - Execute the 6 read-only inspection queries from [`SECURITY_REMEDIATION_PLAN.md` Section 4](file:///c:/Users/rudra/TyProX/docs/roadmap/SECURITY_REMEDIATION_PLAN.md#L258-L298) in Supabase SQL Editor (`pg_policies`, `role_table_grants`, views, indexes/achievements/Realtime tables, `handle_new_user()`, outlier/__debug_test__ counts).
   - Confirm automated Supabase backup / PITR recovery point (or export a manual `pg_dump`) and clean up the `6` historic `__debug_test__` (`user_id IS NULL`) / outlier rows per owner review.
2. **Execute Real PostgreSQL 16 Verification Suite:**
   - Run [`.github/workflows/ci-postgres-verification.yml`](file:///c:/Users/rudra/TyProX/.github/workflows/ci-postgres-verification.yml) (or `docker compose -f docker-compose.db.yml run --rm verify`) in CI / Linux container to verify `20260618`–`20260624` end-to-end against real PostgreSQL 16 (including `42501` RLS checks, parallel `client_run_id` race test, streak immutability on pure duplicates, invalidated run rejection, rollback integrity, and 16-attempt `handle_new_user()` collision stress test).
3. **Provision Production Environment Variables First:**
   - Set `SUPABASE_SERVICE_ROLE_KEY` (server-only) and `NEXT_PUBLIC_SITE_URL` in production hosting secrets (and local `.env.local` for privileged testing — never commit `.env*` secrets).
4. **Apply Database Migrations Strictly in Sequential Order:**
   1. [`20260621000000_typrox_2_hardening.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260621000000_typrox_2_hardening.sql)
   2. [`20260622000000_learning_and_competitive_ecosystem.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260622000000_learning_and_competitive_ecosystem.sql)
   3. [`20260623000000_atomic_result_persistence_and_idempotency.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260623000000_atomic_result_persistence_and_idempotency.sql)
   4. [`20260624000000_phase1c_security_and_streak_fixes.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260624000000_phase1c_security_and_streak_fixes.sql)
5. **Deploy Phase 1C Next.js Application & Run Post-Cutover Smoke Validation:**
   - Verify `/leaderboard`, `POST /api/results` (authenticated submission & replay recovery), `PATCH /api/profile` (username set & second-change `403 USERNAME_LOCKED` check), and `/challenge/[id]`.
   - Confirm via `anon` REST query `/rest/v1/replays` returns `[]` (`0` rows), `/rest/v1/profiles` denies direct `username` column `PATCH`, and `submit_verified_result` / `leaderboard_view` are active in Postgres.

---

## Remaining Deliberately Deferred Items (Outside Phase 1C Scope)

1. **`SEC-A2` / `ENG-A6` Anti-Cheat Beyond Telemetry Replay:** Server-issued HMAC run-start tokens (`POST /api/runs/init`) and client `onPaste` prevention + `<15`-char burst checks remain scheduled for a dedicated security hardening batch.
2. **`P1-5` Multi-Instance Distributed Sync Throttling:** `syncWindowCache` and `recoveryRunWindowCache` in [`lib/security/rate-limit.ts`](file:///c:/Users/rudra/TyProX/lib/security/rate-limit.ts) remain process-local `Map` structures paired with global Supabase `test_results` query bounds (`150` rows / `10 min`) until Redis/Upstash infrastructure is approved.
3. **`SEC-A4` Nonce-Based CSP:** [`next.config.ts`](file:///c:/Users/rudra/TyProX/next.config.ts) retains `'unsafe-inline'` in `script-src` pending Next.js nonce middleware adoption.
4. **`P2-2`, `DB-A3`, `ENG-A7` App/Data Follow-Ups:** `ResultScreen.handleShare` save-in-flight guard (`P2-2`); [`lib/data/leaderboard.ts`](file:///c:/Users/rudra/TyProX/lib/data/leaderboard.ts) pre-migration `.limit(300)` fallback & post-migration `.eq('is_ranked', true)` filter once `20260621` applies (`DB-A3`); and [`lib/data/profile.ts`](file:///c:/Users/rudra/TyProX/lib/data/profile.ts) `.limit(200)` KPI aggregation vs SQL aggregates (`ENG-A7`).
5. **Residual Code Hygiene & Unused Tables (`P3`):** `AuthProvider` startup `getSession()` call alongside `getUser()`, unused exports (`vite-tsconfig-paths`, `utils/text-generator.ts`, `getClientSession()`), wiring or removing `20260622` tables (`user_progression`, `user_lesson_progress`, `challenge_attempts`), expanding Playwright to authenticated/challenge write paths (`QA-A3`), and refreshing stale [`FULL_SCHEMA.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/FULL_SCHEMA.sql).

