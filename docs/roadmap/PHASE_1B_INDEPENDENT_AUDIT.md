# TyProX 2.0 — Independent Phase 1B Verification Audit

**Audit Date:** 2026-11-11  
**Auditor Role:** Independent Principal Engineer, Application Security Engineer, Database Security Reviewer, and QA Lead  
**Repository Baseline:** `main` @ `fba1d80` + uncommitted working tree (`58` tracked modified/deleted files, `98` untracked files before this report)  
**Target Supabase Project:** `gbovkejymfeiqgverzfr`  
**Audited Against:**
- [`docs/roadmap/PHASE_1_DIFF_REVIEW.md`](../../docs/roadmap/PHASE_1_DIFF_REVIEW.md)
- [`docs/roadmap/PHASE_1B_REMEDIATION_REPORT.md`](../../docs/roadmap/PHASE_1B_REMEDIATION_REPORT.md)
- [`docs/roadmap/POST_IMPLEMENTATION_AUDIT.md`](../../docs/roadmap/POST_IMPLEMENTATION_AUDIT.md)
- [`docs/roadmap/SECURITY_REMEDIATION_PLAN.md`](../../docs/roadmap/SECURITY_REMEDIATION_PLAN.md)
- [`docs/roadmap/BATCH_1_1A_PREFLIGHT_REPORT.md`](../../docs/roadmap/BATCH_1_1A_PREFLIGHT_REPORT.md)

**Governance Compliance:** Strict read-only inspection across application source, tests, SQL migrations, `.env*` keys (values never read or logged), and Git state. Only this audit artifact (`docs/roadmap/PHASE_1B_INDEPENDENT_AUDIT.md`) was created. Zero production queries or migrations were executed.

---

## 1. Executive Verdict

### **Executive Verdict: `NOT APPROVED`**

| Decision Gate | Status | Justification |
|---|---|---|
| **Application Code Review (Selected Phase 1B Fixes)** | **PARTIAL / CONDITIONALLY SOUND** | `P0-1`, `P1-1`, `P1-2` (request path), `P1-3` (client sync loop), and `P2-1` are genuinely implemented in source and verified across builds, lint, and unit suites. |
| **Phase 1B Holistic Sign-Off** | **`NOT APPROVED`** | Independent audit found **two new `P1` persistence/PLpgSQL correctness regressions** in newly authored `20260623` / `persistence.ts`, **incomplete `P0-2` / `P1-4` security boundaries** (fail-open SSR downgrade + `profiles.username` REST bypass + single-collision trigger), **zero real PostgreSQL execution** for new SQL/RLS, and a **`6/7` Playwright failure (`exit 1`)** contradicting the remediation report's `7/7` claim. |
| **Production DB Migrations (`20260621`–`20260623`)** | **UNSAFE / `BLOCKED`** | Do not execute on `gbovkejymfeiqgverzfr`: `SUPABASE_SERVICE_ROLE_KEY` is unprovisioned locally and unverified in hosting, `20260623` mutates streaks on pure duplicates and skips `is_invalidated = FALSE` on `client_run_id` lookup, live DB catalog (`pg_policies`, `role_table_grants`, `handle_new_user()`) & backups remain uninspected, and zero tests have executed against PostgreSQL. |
| **Production Application Deployment** | **UNSAFE / `BLOCKED`** | Deploying current code + `20260621` without `SUPABASE_SERVICE_ROLE_KEY` triggers an immediate `42501` outage on ranked saves/sync/challenges; deploying without `20260621` leaves live `public.replays` readable anonymously (`164` historic rows) and client writes exposed. |

---

## 2. Verified Fixes

The following fixes from [`PHASE_1_DIFF_REVIEW.md`](../../docs/roadmap/PHASE_1_DIFF_REVIEW.md) were independently verified in the current source tree and observed passing their respective local checks:

1. **`P0-1` & `P2-1` — Challenge Arena Config Lock, Restart Isolation, Unmount Cleanup & Alert Semantics:**
   - [`ChallengeArenaClient`](../../components/challenge/challenge-arena-client.tsx#L223) renders `<TypingContainer hideConfigBar onRestartOverride={handleStartChallenge} />`, hiding mode/duration selectors (`typing-container.tsx:311`) and preserving challenge `(seed, mode, duration)` across `"Restart Test"` clicks (`typing-container.tsx:485-491`) and `Escape` resets.
   - [`TypingContainer`](../../components/typing/typing-container.tsx#L226-L237) calls `e.stopPropagation()` on `<textarea>` `Escape` so the global `window` listener (`lines 247-281`) never double-fires on focused input; `window` `Escape` also routes through `onRestartOverride` when present (`lines 277-280`).
   - Unmount cleanup in [`challenge-arena-client.tsx:72-84`](../../components/challenge/challenge-arena-client.tsx#L72-L84) tracks `challengeActiveRef.current` alongside `current.seed === challenge.seed` and resets `useTypingStore`, preventing stale challenge runs from leaking to `/typing` (while safely no-oping before challenge start).
   - Submission failure banner adds `role="alert"` (`lines 260-293`) with a `"Retry Save"` action, and `inFlightChallengeSubmissions` evicts rejected keys on `!res.ok` and `.catch()` (`lines 24-43`).
   - Verified with **non-mocked** `<TypingContainer />` + `verifyAndScoreSession` in test 1 of [`challenge-arena-client.test.tsx:96-230`](../../__tests__/components/challenge-arena-client.test.tsx#L96-L230). *(Caveat: Tests 2–3 inject `useTypingStore.setState` directly, and Playwright does not test `/challenge/[id]` in real Chromium.)*

2. **`P1-1` — Route Handler Export Compliance Across Webpack & Turbopack:**
   - [`MAX_SYNC_BATCH_SIZE = 30`](../../lib/typing/sync-client.ts#L4-L5) moved out of [`app/api/results/sync/route.ts`](../../app/api/results/sync/route.ts#L7,L28) into [`lib/typing/sync-client.ts`](../../lib/typing/sync-client.ts).
   - Observed **both** `npx next build --webpack` (`33/33` routes, `TS2344` gone) + `npm run typecheck`, and `npm run build` (Turbopack) + `npm run typecheck` exiting `0`.

3. **`P1-2` — `POST /api/results` `<45s` Short-Circuit Removal & Real Recovery PB Computation (App Layer):**
   - [`app/api/results/route.ts:84-107`](../../app/api/results/route.ts#L84-L107) removes the early return on `rateCheck.latestRow` and forwards both `<45s` and `>=45s` retries into `persistVerifiedResult(..., { clientRunId, deduplicateBySignature: true, isPrivilegedClient })`.
   - [`finalizeRecoveredResult`](../../lib/typing/persistence.ts#L436-L498) queries prior best excluding `existingRow.id` (`.neq('id', existingRow.id)`), recovers missing `replays` rows, evaluates missed achievements, and computes `previousBestWpm` and `isPersonalBest` instead of returning hardcoded `false`/`null` (`__tests__/api/results.route.test.ts:458-716`). *(See Section 4 for the streak-on-dedup regression introduced in this helper and in `20260623`.)*

4. **`P1-3` — Non-Looping Guest History Sync & Explicit Held-Run UI State:**
   - [`isSyncableGuestResult`](../../lib/typing/sync-client.ts#L55-L64) excludes legacy non-bracket durations (`!isValidDuration(item.duration)`) and permanently rejected runs (`item.syncStatus === 'rejected'`) while preserving all runs locally.
   - [`useUserStore`](../../stores/user-store.ts#L136-L177) tracks `syncStatus?: 'pending' | 'rejected'`, `syncRejectionReason`, `syncRejectedAt`, `markGuestResultsRejected`, and `retryRejectedGuestResults`.
   - [`syncGuestHistoryBatches`](../../lib/typing/sync-client.ts#L179-L277) separates permanent rejection (`400` / `rejectedIds`) from transient failures (`429` + `Retry-After`, `207`, `500`, network errors), and [`DashboardPage`](../../app/dashboard/page.tsx#L510-L540) suppresses `"Local runs detected"` for non-syncable runs while exposing `"Retry Held Runs"`.
   - [`POST /api/results/sync`](../../app/api/results/sync/route.ts#L188-L237) returns HTTP `400` with `rejectedIds` / `rejectedReasons` when all valid-schema items fail verification and `200` on partial valid + rejected batches so valid/duplicate IDs clear cleanly. Verified in [`sync-client.test.ts`](../../__tests__/typing/sync-client.test.ts), [`sync.route.test.ts`](../../__tests__/api/sync.route.test.ts), and [`dashboard-page.test.tsx`](../../__tests__/components/dashboard-page.test.tsx).

5. **`P0-2` App-Side Privilege Awareness & Diagnostics:**
   - [`hasServiceRoleConfig`](../../lib/supabase/admin.ts#L11-L27) and one-time `warnMissingServiceRoleOnce()` emit explicit operational diagnostics without printing secret values.
   - [`persistVerifiedResult`](../../lib/typing/persistence.ts#L625-L673,L795-L835) attempts `submit_verified_result` only when `isPrivilegedClient` is true (falling back on `PGRST202`/`42883`), restricts compensating `DELETE` (`select('id')` count check) to `isPrivilegedClient === true`, detects RLS-blocked `0`-row deletes, throws structured [`ResultPersistenceError`](../../lib/typing/persistence.ts#L58-L74) (`{ orphanResultId, recoverable: true }`), and surfaces `{ recoverable: true }` from [`POST /api/results`](../../app/api/results/route.ts#L124-L131). *(See Section 3 for the fail-open SSR fallback gap.)*

6. **`P1-4`, `DB-A1`, `DB-A2`, & View Drop Guard in Prepared Local SQL (`20260621`, `NOT APPLIED`):**
   - [`20260621:13-29`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L13-L29) drops global `client_run_id UNIQUE` (`test_results_client_run_id_key`) and creates composite partial unique index `idx_test_results_user_client_run_id ON public.test_results(user_id, client_run_id) WHERE user_id IS NOT NULL AND client_run_id IS NOT NULL;`.
   - [`20260621:40`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L40) scopes privilege revocation to `FUNCTION public.handle_new_user()` instead of `ALL FUNCTIONS IN SCHEMA public` (`DB-A1`).
   - [`20260621:105`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L105) adds `DROP VIEW IF EXISTS public.leaderboard_view;` ahead of `CREATE OR REPLACE VIEW ... WITH (security_invoker = true)`.
   - [`20260621:188-200`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L188-L200) includes all `11` production achievement codes (`SPEED_80`, `SPEED_150`, `STREAK_14` restored) with `ON CONFLICT (code) DO NOTHING` (`DB-A2`).

---

## 3. Failed or Incomplete Fixes

1. **[P1 / Security Boundary] `createAdminClient()` Still Fails Open to Unprivileged SSR Context in Production (`P0-2` Incomplete):**
   - **Evidence:** `.env.local` contains only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. [`createAdminClient()`](../../lib/supabase/admin.ts#L33-L59) logs one warning (`warnMissingServiceRoleOnce`) and returns `null`, and callers fall back via `const writeClient = adminClient ?? supabase;` ([`app/api/results/route.ts:82`](../../app/api/results/route.ts#L82), [`app/api/results/sync/route.ts:70`](../../app/api/results/sync/route.ts#L70), [`app/api/challenges/route.ts:38`](../../app/api/challenges/route.ts#L38)).
   - **Why This Matters:** [`PHASE_1_DIFF_REVIEW.md:138`](../../docs/roadmap/PHASE_1_DIFF_REVIEW.md#L138) explicitly noted failing loudly in `NODE_ENV === 'production'`. Keeping fail-open fallback creates a brittle deploy-ordering trap: if code deploys before `SUPABASE_SERVICE_ROLE_KEY` is configured and `20260621` applies, ranked submissions and challenge links crash with `42501`; if `20260621` is delayed, unprivileged SSR inserts continue while production lacks atomic transactions and rollback.

2. **[P1 / Security Bypass] `20260621` Direct `profiles.username` PostgREST Grant Bypasses `PATCH /api/profile` Validation:**
   - **Evidence:** [`20260621:56-57,96-102`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L56-L57) retains `GRANT UPDATE (display_name, avatar_url, theme, font_family, username, updated_at) ON public.profiles TO authenticated;` and policy `WITH CHECK (auth.uid() = id AND username ~ '^[a-z0-9_]{3,24}$')`. Meanwhile, [`app/api/profile/route.ts:6-50`](../../app/api/profile/route.ts#L6-L50) enforces `RESERVED_USERNAMES` (`admin`, `root`, `typrox`, `api`, `dashboard`, `u`, etc.) and rejects `^user_[0-9a-f]{8}$`. Even though browser UI now calls `PATCH /api/profile`, [`DashboardPage:648`](../../app/dashboard/page.tsx#L648) also displays `Username (Locked)`.
   - **Impact:** Any authenticated user invoking Supabase REST `PATCH /rest/v1/profiles` directly with their JWT can claim reserved handles (`admin`, `typrox`, `api`), change their handle arbitrarily despite UI locking, or revert to `user_xxxxxxxx`. Neither SQL nor `PATCH /api/profile` enforces immutability once a custom handle is chosen.

3. **[P1 / Availability & Deduplication Edge] `POST /api/results` Rate-Limit Cooldown Can Block Retry Recovery, and `recentRunCache` Ignores Payload Identity:**
   - **Evidence:** In [`app/api/results/route.ts:60-101`](../../app/api/results/route.ts#L60-L101) and [`checkResultSubmissionRateLimit`](../../lib/security/rate-limit.ts#L63-L117):
     - If Run A produces a partial write (`test_results` written without `replays` -> HTTP `500 { recoverable: true }`), then Run B completes or runs on another worker within `8s` (so `latestRow` is now Run B and `recentRunCache` misses), retrying Run A within `8s` triggers `429` instead of executing recovery lookup by `clientRunId`!
     - Conversely, `recentRunCache` (`lines 60-73`) returns cached `{ deduplicated: true }` purely from `user.id:clientRunId` before `verifyAndScoreSession`, without confirming request `seed`/`mode`/`duration`/`telemetry` match the cached entry.

4. **[P1 / Sync Quota Defect] `syncableCandidateCount` Still Meters Permanently Invalid Durations & Process-Local Cache Remains Bypassable (`P1-5` Open):**
   - **Evidence:** [`app/api/results/sync/route.ts:72-83`](../../app/api/results/sync/route.ts#L72-L83) computes `syncableCandidateCount` using `telemetry.length > 0 && isRanked !== false && isRankedMode(item.mode)` **without checking `isValidDuration(item.duration)`**, unlike [`isSyncableGuestResult`](../../lib/typing/sync-client.ts#L59). Additionally, [`checkSyncRateLimit`](../../lib/security/rate-limit.ts#L123-L167) increments process-local `syncWindowCache` (`5 req / 60s`, `120 items / 60s`) before item verification (`400` rejected batches burn quota), remains ineffective across multiple serverless instances, and relies solely on a `150` rows / `10 min` global `test_results` count (`21,600` synthetic runs/day possible).

5. **[P1 / Signup Trigger Reliability] `handle_new_user()` Only Handles a Single Username Collision (`20260621:158-160`):**
   - **Evidence:** [`20260621:158-160`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L158-L160) runs one `IF EXISTS ...` fallback substituting `substring(fallback_suffix, 1, 5)`. If a second collision exists on the truncated candidate (or `user_<8hex>` already collided), `INSERT INTO public.profiles` fails with SQLSTATE `23505` and aborts `auth.users` signup because only `ON CONFLICT (id) DO NOTHING` is present (`line 177`).

6. **[QA / Reporting Accuracy] `npm run test:e2e` Failed (`6 passed, 1 failed`, `exit 1`) Contrary to Report Claim (`7/7`):**
   - **Evidence:** [`PHASE_1B_REMEDIATION_REPORT.md:105`](../../docs/roadmap/PHASE_1B_REMEDIATION_REPORT.md#L105) reports `npm run test:e2e` as `7/7 passed (1.9m)`. Independent execution in this session exited `1` (`6 passed, 1 failed`, `2.1m`) because Test 6 ([`tests/e2e/typrox.spec.ts:215-249`](../../tests/e2e/typrox.spec.ts#L215-L249)) exceeded the `60,000ms` per-test timeout waiting on `waitUntil: 'networkidle'` while visiting `/leaderboard` during the `18`-navigation Dark + Light loop (`LeaderboardClient` opens a Supabase Realtime WebSocket subscription and queries remote Supabase across routes inside one test timeout).

---

## 4. New Regressions Discovered

### 1. **[HIGH / P1 Regression] Unconditional Streak Mutation & `last_active_date` Overwrite on Pure Deduplicated Retries (`20260623` & `persistence.ts`)**
- **Files & Lines:**
  - `supabase/migrations/20260623000000_atomic_result_persistence_and_idempotency.sql:89-100,198-215,231-280`
  - [`lib/typing/persistence.ts:448-450`](../../lib/typing/persistence.ts#L448-L450)
- **Root Cause:** Neither `submit_verified_result` nor `finalizeRecoveredResult` checks whether the deduplicated row actually represents a newly persisted result or an incomplete orphan recovery (`v_deduplicated = FALSE OR v_recovered_partial = TRUE`).
  - Whenever an already-completed run (`v_deduplicated = TRUE` and `replays` already present -> `v_recovered_partial = FALSE`) is retried across UTC midnight or re-submitted via `client_run_id`/signature sync on a later UTC day, SQL lines `253-276` and TS `line 449` still execute streak logic against `v_today = (timezone('utc', now()))::date`.
  - **Example:** User types a run on Day 1 (`last_active_date = Day 1`, `current_streak = 4`). On Day 2, without typing any test, retrying that `clientRunId` (e.g., stale client tab or `sync` retry) advances `current_streak` to `5` and sets `last_active_date = Day 2`. Re-syncing historical offline guest runs through `/api/results/sync` days later likewise stamps `created_at = now()` and advances *today's* UTC streak.
  - Additionally, at `20260623:268-276`, when `v_streak_row.last_active_date > v_today` (clock anomaly), line `268` keeps `current_streak`, yet line `274` still overwrites `last_active_date = v_today`.

### 2. **[HIGH / P1 Regression] `client_run_id` Idempotency Lookup Ignores `is_invalidated = FALSE` (`20260623` & `persistence.ts`)**
- **Files & Lines:**
  - `supabase/migrations/20260623000000_atomic_result_persistence_and_idempotency.sql:90-95,183-188,218-326`
  - [`lib/typing/persistence.ts:515-525`](../../lib/typing/persistence.ts#L515-L525)
- **Root Cause:** Lookup by `(user_id, client_run_id)` omits `AND is_invalidated = FALSE` (whereas signature lookup at `20260623:122` properly filters `tr.is_invalidated = FALSE`).
- **Impact:** If a moderated/admin-invalidated run is replayed with its `clientRunId`, `submit_verified_result` / `finalizeRecoveredResult` returns that invalidated run as a valid deduplicated success, excludes `v_result.id` in prior-PB lookup (`tr.id <> v_result.id`), computes `isPersonalBest`, advances UTC streaks, and unlocks speed achievements (`v_result.wpm >= ...`) from an invalidated run.

---

## 5. Database and SQL Security Findings

### 5.1 Live Production State & Unverified Catalog Areas
- **Confirmed Unhardened Production Exposure (`BATCH_1_1A_PREFLIGHT_REPORT.md` & `Error Context`):** None of `20260621`, `20260622`, or `20260623` have been executed on `gbovkejymfeiqgverzfr`. Live `public.replays` (`164` rows) remains readable via `anon` key, `leaderboard_view` is missing/broken in prod (`PGRST205` observed forcing `test_results` fallback), and `6` historical `__debug_test__` rows (`user_id IS NULL`) plus speed outliers remain live.
- **Uninspected Privileged Catalog Areas (7 Remaining Owner Checks):** Cannot be verified with `anon` credentials locally: (1) live `pg_policies`, (2) `information_schema.role_table_grants` (`GRANT ALL` presence), (3) live `pg_indexes`, (4) active `public.handle_new_user()` body and `search_path`, (5) `pg_publication_tables` (`supabase_realtime`), (6) live column defaults/nullability, (7) Supabase automated backups / PITR + Auth Redirect URL allowlists.

### 5.2 Migration Review (`20260621`, `20260622`, `20260623`, `FULL_SCHEMA.sql`)
- **Least-Privilege Grants & RLS (`20260621` & `20260622`):**
  - `20260621:38-94` correctly revokes table/sequence `ALL` grants and drops permissive client `INSERT`/`UPDATE` policies on `test_results`, `replays`, `streaks`, `challenge_links`, `user_challenge_progress`, and `user_achievements`, restricting `replays` `SELECT` to row owners via `EXISTS (...)`.
  - **Still Over-Broad:** [`20260621:56-57,96-102`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L56-L57) leaves direct client `UPDATE` on `profiles.username` open (bypassing `PATCH /api/profile`). [`20260621:63-65`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L63-L65) still grants `anon` raw `SELECT` over all verified `test_results` columns (`seed`, `client_run_id`, timestamps, error/backspace counts). [`20260622:53-64`](../../supabase/migrations/20260622000000_learning_and_competitive_ecosystem.sql#L53-L64) creates `user_progression`, `user_lesson_progress`, and `challenge_attempts` with public `USING (true)` `SELECT` on progression/attempts even though zero API routes/DAL functions use these tables today.
- **Trigger & Function Definer Hygiene:**
  - `handle_new_user()` (`20260621:131-185`) sets `SECURITY DEFINER SET search_path = public` and `REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;` (`line 40`), but has the single-collision `23505` defect (`lines 158-160`).
  - `submit_verified_result()` (`20260623:44-63,354-360`) sets `SECURITY DEFINER SET search_path = public` and restricts `EXECUTE` strictly to `service_role`. Wait-for-execution hazard: because no Postgres engine ran this migration yet, type casts (`(v_ach.criteria->>'wpm')::numeric`), lock escalation (`FOR UPDATE` on `streaks`), and streak/invalidation semantics (Section 4) are **unverified at runtime**.
- **Schema & TypeScript Drift:**
  - [`20260621:10-11`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L10-L11) adds `generator_version` and `is_ranked` to `public.test_results`, and [`20260621:125`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L125) filters `leaderboard_view` by `tr.is_ranked = TRUE`, yet [`types/database.ts:46-61`](../../types/database.ts#L46-L61) omits both `is_ranked` and `generator_version`, and [`lib/data/leaderboard.ts:100-132`](../../lib/data/leaderboard.ts#L100-L132) lacks `.eq('is_ranked', true)` in its `test_results` fallback.
  - `20260621` was edited directly instead of creating a later delta migration; while safe strictly prior to applying to prod, it must be treated as immutable once applied.
  - [`supabase/migrations/FULL_SCHEMA.sql`](../../supabase/reference/FULL_SCHEMA.sql) is severely stale relative to `20260621`–`20260623` (retains `GRANT ALL ON ALL TABLES/FUNCTIONS` at `lines 293-295`, omits `client_run_id`, `is_ranked`, `20260622` tables, hardened `leaderboard_view`, and `submit_verified_result`).
- **Deploy / Cutover Ordering Hazard:**
  - `20260621` -> `20260622` -> `20260623` requires: (1) provisioning `SUPABASE_SERVICE_ROLE_KEY` in hosting **before** applying `20260621` (or temporarily accepting a brief maintenance window while revoking `authenticated` write policies), and (2) shipping updated application code supporting `leaderboard_view` + `submit_verified_result` alongside/immediately after migrations. Local workspace `.env.local` has no `SUPABASE_SERVICE_ROLE_KEY`, so local SSR writes cannot even emulate post-`20260621` `service_role` mode today.

---

## 6. Remaining Production Security Exposure

1. **Unapplied Production DB Hardening & Exposed Replay Data [CRITICAL / P0]:** Live `public.replays` (`164` rows) and direct `test_results`/`streaks`/`challenge_links` client writes remain exposed on `gbovkejymfeiqgverzfr` until `20260621` + `SUPABASE_SERVICE_ROLE_KEY` are executed.
2. **Offline Telemetry Forgery (`SEC-A2`) & Missing Short-Burst / Paste Guard [`ENG-A6`] [HIGH / P1]:**
   - No server-issued HMAC run-start token (`POST /api/runs/init`) binds `seed` issuance to server wall-clock elapsed time. Authenticated scripts can generate valid jittered keystroke telemetry at `~255 WPM` for any deterministic `seed` and submit via `POST /api/results` or `POST /api/results/sync`.
   - [`TypingContainer:428-445`](../../components/typing/typing-container.tsx#L428-L445) and [`LessonRunnerClient:446-514`](../../components/learn/lesson-runner-client.tsx#L446-L514) omit `onPaste={(e) => e.preventDefault()}`. Meanwhile, [`verifier.ts:159-186`](../../lib/typing/verifier.ts#L159-L186) requires `>= 15` input characters for both the burst speed check (`j + 14 < inputTimes.length`) and constant-cadence variance check (`deltas.length >= 15`), leaving `< 15`-char instant bursts unchecked (or submitting <15 total chars under `'timer'`).
3. **Direct `profiles.username` PostgREST Tampering + Fail-Open `admin.ts` [HIGH / P1]:** Covered in Section 3 (`#1`, `#2`).
4. **CSP `'unsafe-inline'` (`SEC-A4`) [MEDIUM / P2]:** [`next.config.ts:30`](../../next.config.ts#L30) keeps `'unsafe-inline'` in production `script-src`, weakening XSS defense in depth.
5. **Auth & Error Leakage Residuals (`SEC-A5`) [LOW / P3]:** [`app/api/auth/signout/route.ts:32-33`](../../app/api/auth/signout/route.ts#L32-L33) still exposes raw `err.message`; [`AuthProvider:68-71`](../../components/providers/auth-provider.tsx#L68-L71) still pairs `getSession()` alongside `getUser()` during bootstrap (`lib/supabase/auth.ts:44-49` `getClientSession()` remains unused).
6. **Residual App Data & UX Bugs (`P2-2`, `DB-A3`, `ENG-A7`) [MEDIUM / P2]:**
   - `P2-2`: [`ResultScreen.handleShare`](../../components/typing/result-screen.tsx#L300-L327) still silently copies an unverified `/typing?seed=...` URL if save is still in flight or errored (`savedResultId === null`).
   - `DB-A3` & `ENG-A7`: [`lib/data/leaderboard.ts:132`](../../lib/data/leaderboard.ts#L132) fallback truncates at `.limit(300)` raw rows before per-user dedup (fixed on prod only once `leaderboard_view` exists, minus `is_ranked` filtering until `leaderboard_view` applies); [`lib/data/profile.ts:65-89`](../../lib/data/profile.ts#L65-L89) computes `bestWpm`, `avgWpm`, `avgAccuracy`, and `totalTimeSecs` from `.limit(200)` while using exact total `count` for `testsCompleted`.

---

## 7. Test Coverage Gaps

1. **`QA-A1` [CRITICAL / P0] Zero Real PostgreSQL / PLpgSQL / RLS Verification:**
   - Every persistence and API test (`persistence.test.ts`, `results.route.test.ts`, `sync.route.test.ts`, `challenges.route.test.ts`, `leaderboard.route.test.ts`, `profile.route.test.ts`) runs against in-memory mocked Supabase clients in Vitest.
   - Neither `submit_verified_result` (`20260623`), dynamic `pg_constraint` cleanup (`20260623:12-35`), hardened RLS / column grants (`20260621`), `leaderboard_view` joins, `handle_new_user()`, nor `20260622` tables have ever executed against PostgreSQL. Notably, the **two P1 regressions found in Section 4** live directly in untested `20260623` SQL + `finalizeRecoveredResult`.
   - Local environment lacks `docker`, `psql`, and `supabase` CLI (`Get-Command` verified empty).
   - **Smallest Practical Verification Setup (Recommended):** Add a GitHub Actions CI job (or local Docker Compose / `supabase start`) using a standard `postgres:16-alpine` service container seeded with minimal Supabase `auth.users` / `auth.uid()` / `anon` / `authenticated` / `service_role` role shims before applying `20260618..20260623` sequentially and running real SQL + RLS assertions (verifying `42501` under `authenticated`/`anon` for direct `test_results`/`replays`/`streaks`/`profiles.username` REST mutations, testing `submit_verified_result` atomic rollback on forced replay FK/check failure, multi-day duplicate retry non-mutation of streaks, invalidated `client_run_id` handling, and 2-way `handle_new_user()` username collision).
2. **`QA-A3` [HIGH / P1] Playwright E2E Instability & Authenticated / Challenge Blind Spots:**
   - `tests/e2e/typrox.spec.ts` covers zero `/challenge/[id]` browser journeys (never tests real Chromium `Escape` / focus / `"Restart Test"`), zero authenticated `/api/results`, `/api/results/sync`, `/api/challenges`, `/api/profile`, or `/api/auth/signout` flows, and fails Test 6 (`exit 1`) due to wrapping `18` `networkidle` navigations against live Supabase endpoints inside one `60s` timeout.
3. **Challenge Unit Test Store Injection (`challenge-arena-client.test.tsx:249-305`) & Untested Auth Files (`QA-A2`):**
   - Challenge tests 2–3 overwrite `useTypingStore.setState` with 1-keystroke synthetic data instead of running through `TypingContainer` -> `evaluateFinalSession`.
   - [`app/api/auth/signout/route.ts`](../../app/api/auth/signout/route.ts), [`lib/supabase/middleware.ts`](../../lib/supabase/middleware.ts), and [`UsernameModal`](../../components/auth/username-modal.tsx) lack automated tests.

---

## 8. Exact Remediation Priorities (`P0` / `P1` / `P2` / `P3`)

| Priority | ID | Action Required |
|---|---|---|
| **`P0`** | `DB-GATE-1` | Owner completes privileged read-only catalog inspection & backup/PITR verification on `gbovkejymfeiqgverzfr` and provisions `SUPABASE_SERVICE_ROLE_KEY` (+ `NEXT_PUBLIC_SITE_URL`) in hosting & `.env.local` **before** running `20260621`. |
| **`P0`** | `ADMIN-FAIL-CLOSED` | Update [`createAdminClient()`](../../lib/supabase/admin.ts) / ranked write routes so missing `SUPABASE_SERVICE_ROLE_KEY` in `NODE_ENV === 'production'` (or post-hardening flag) fails closed cleanly instead of silently downgrading to caller SSR client. |
| **`P1`** | `SQL-DEDUP-STREAK` | Fix `20260623:231-280` and [`finalizeRecoveredResult`](../../lib/typing/persistence.ts#L448-L450) so streaks ONLY advance on newly persisted runs (`NOT v_deduplicated` — or recent recovery of unrecovered partial writes within same UTC date), never overwriting `last_active_date` on pure deduplicated retries or future-date skew. |
| **`P1`** | `SQL-INVALIDATED-ID` | Filter `is_invalidated = FALSE` consistently in `(user_id, client_run_id)` lookups across `20260623:90-95,183-188` and [`findExistingByClientRunId`](../../lib/typing/persistence.ts#L515-L525); reject or return non-rewarding response for invalidated `clientRunId` retries without running PB/streak/achievement logic. |
| **`P1`** | `SQL-PROFILES-USERNAME` | Remove `username` from [`20260621:56-57`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L56-L57) direct `authenticated` `UPDATE` column grant (or enforce reserved words + one-time handle lock in DB + `PATCH /api/profile` using `service_role` or `BEFORE UPDATE` trigger), and loop/randomize suffix retries in `handle_new_user()` (`20260621:158-160`). |
| **`P1`** | `RESULTS-RETRY-ORDER` | In [`POST /api/results`](../../app/api/results/route.ts#L60-L101), verify payload equality on `recentRunCache` hits and allow `clientRunId` retry recovery **before** cross-run `8s` cooldown so Run B never blocks recoverable Run A retry with `429`. |
| **`P1`** | `SYNC-QUOTA-VALIDATION` | Filter `isValidDuration(item.duration)` in `syncableCandidateCount` ([`app/api/results/sync/route.ts:72-83`](../../app/api/results/sync/route.ts#L72-L83)) and move sync rate limiting to shared DB/Redis state (`QA-A1` + `P1-5`). |
| **`P1`** | `PG-CI-HARNESS` | Stand up real PostgreSQL integration tests in CI (`postgres:16` / Supabase CLI) executing `20260618..20260623`, PL/pgSQL `submit_verified_result`, and RLS `42501` checks, and stabilize `Test 6` in [`tests/e2e/typrox.spec.ts`](../../tests/e2e/typrox.spec.ts#L249) + add Chromium `/challenge/[id]` coverage. |
| **`P1`** | `SEC-A2-TOKENS` | Implement HMAC run-start tokens (`POST /api/runs/init`) and block paste / `<15`-char bursts (`ENG-A6`). |
| **`P2`** | `APP-UX-TYPES` | Fix `ResultScreen.handleShare` pending/error behavior (`P2-2`), add `is_ranked` & `generator_version` to [`types/database.ts`](../../types/database.ts) and leaderboard fallback filter, add SQL aggregate KPIs (`ENG-A7`), tighten production CSP (`SEC-A4`), and split uncommitted Git tree (`58 M/D` + `98 ??`) into clean commits. |
| **`P3`** | `HYGIENE` | Mask [`signout/route.ts:32-33`](../../app/api/auth/signout/route.ts#L32-L33) error messages, simplify [`AuthProvider:70`](../../components/providers/auth-provider.tsx#L70), delete dead `lib/supabase/auth.ts` `getClientSession()`, update [`FULL_SCHEMA.sql`](../../supabase/reference/FULL_SCHEMA.sql), and wire or remove unused `20260622` tables. |

---

## 9. Deployment Blockers

1. **Unfixed SQL Regressions in `20260623` & `20260621`:** Streak mutation on pure dedup, missing `is_invalidated = FALSE` on `client_run_id`, direct `profiles.username` `UPDATE` grant bypassing `RESERVED_USERNAMES`, and single-collision `handle_new_user()` must be repaired **before** executing migrations on `gbovkejymfeiqgverzfr`.
2. **Zero Real PostgreSQL Execution (`QA-A1`):** No automated or manual execution of `20260621`, `20260622`, or `20260623` against a PostgreSQL engine has occurred.
3. **Unprovisioned `SUPABASE_SERVICE_ROLE_KEY` & Fail-Open App Fallback:** `.env.local` lacks `SUPABASE_SERVICE_ROLE_KEY`, production hosting secret status is unverified, and `createAdminClient()` still fails open in production rather than enforcing explicit fail-closed boundaries.
4. **Uninspected Production Catalog & Backups:** Owner has not yet run the read-only inspection SQL or confirmed backups/PITR and cleanup of live `__debug_test__` / invalid rows.
5. **Failing E2E Verification (`npm run test:e2e`):** `Test 6` currently fails with `Test timeout of 60000ms exceeded` (`exit 1`) on `/leaderboard` `networkidle` wait.

---

## 10. Evidence for Every Major Conclusion

### 10.1 Firsthand Command Execution Matrix (Executed During This Audit)

| Command | Result | Exact Observed Outcome |
|---|---|---|
| `npx next build --webpack` | **PASS (`exit 0`)** | `33/33` routes compiled + `ƒ Proxy (Middleware)` + Webpack `.next/types/` validation passed (`task-3385`). |
| `npm run typecheck` *(post-Webpack)* | **PASS (`exit 0`)** | `tsc --noEmit --incremental false` returned `0` errors (`task-3385`). |
| `npm run build` *(Turbopack)* | **PASS (`exit 0`)** | `33/33` routes compiled + `ƒ Proxy (Middleware)` (`task-3406`). |
| `npm run lint` | **PASS (`exit 0`)** | `eslint` returned `0` errors, `0` warnings (`task-3406`). |
| `npm run test:unit` | **PASS (`exit 0`)** | `vitest run` — **`21` files, `99/99` tests passed** in `6.80s` (mocked DB clients in API/persistence suites; `task-3406`). |
| `npm run test:e2e` | **FAIL (`exit 1`)** | **`6` passed, `1` failed** (`2.1m`). Tests `1`–`5` & `7` passed; **Test 6 failed** (`Test timeout of 60000ms exceeded` at [`tests/e2e/typrox.spec.ts:249`](../../tests/e2e/typrox.spec.ts#L249), `/leaderboard` `waitUntil: 'networkidle'`; `task-3434`). |
| `git status --short` / `git diff --shortstat` / `git diff --check` | **VERIFIED (`exit 0`)** | Branch `main` @ `fba1d80`; `58` tracked `M`/`D` files (`6881 insertions, 6934 deletions`), `98` untracked paths; `0` conflict markers/whitespace errors. |
| `.env*` Key Check *(names only)* | **VERIFIED** | `.env.local` has `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`SUPABASE_SERVICE_ROLE_KEY` & `NEXT_PUBLIC_SITE_URL` absent). `.env.example` lists `# SUPABASE_SERVICE_ROLE_KEY` as commented optional. |
| Local Postgres Tooling Probe | **VERIFIED ABSENT** | `Get-Command docker,psql,supabase` returned none installed locally. |

### 10.2 Cross-Check of Claims in `PHASE_1B_REMEDIATION_REPORT.md`

| Report Claim ([`PHASE_1B_REMEDIATION_REPORT.md`](../../docs/roadmap/PHASE_1B_REMEDIATION_REPORT.md)) | Independent Verification Verdict |
|---|---|
| `P0-1` & `P2-1` resolved (`ChallengeArenaClient`, `TypingContainer`, `role="alert"`) | **VERIFIED** in source and real-`TypingContainer` integration test (`line 96-230`); Playwright Chromium coverage of `/challenge/[id]` remains absent. |
| `P1-1` fixed (`next build --webpack` + Turbopack + `typecheck`) | **VERIFIED** (`exit 0` on both builds + `typecheck`). |
| `P1-2` fixed (`<45s` short-circuit removed, real PB on recovery) | **PARTIAL / REGRESSION FOUND** — Request routing and prior-best calculation fixed in code, but `finalizeRecoveredResult` & `20260623` mutate streaks on pure duplicates and skip `is_invalidated = FALSE` on `client_run_id` lookup, while `8s` `latestRow` cooldown can block recoverable retry after a newer run. |
| `P1-3` fixed (non-looping guest sync + `"Retry Held Runs"`) | **VERIFIED CLIENT-SIDE / MINOR SERVER QUOTA GAP** — Client loop cleanly stopped and `"Retry Held Runs"` verified; server `syncableCandidateCount` still forgets `isValidDuration`. |
| `P0-2` app fixed & `20260623` RPC ready | **PARTIAL / UNSAFE FOR PROD** — App detects `0`-row RLS delete & skips blind SSR `DELETE`, but `createAdminClient()` still fails open in prod and `20260623` PL/pgSQL introduces streak/invalidation bugs with zero Postgres execution tests. |
| `P1-4`, `DB-A1`, `DB-A2` SQL fixes ready | **PARTIAL** — Composite partial `client_run_id` index, narrowed `handle_new_user()` revoke, `DROP VIEW`, and `11` achievement codes verified; **but** `profiles.username` direct `UPDATE` bypass and 2nd-collision `handle_new_user()` bug remain in `20260621`. |
| `npm run test:e2e`: `7/7 passed (1.9m)` | **DISPROVEN IN RE-EXECUTION** — Re-running `npm run test:e2e` exited `1` (`6 passed, 1 failed` on Test 6 timeout). |

