# TyProX 2.0 — Phase 1E: PostgreSQL 16 Verification Harness Report

**Date:** 2026-11-11  
**Baseline Workspace State:** `main` @ `fba1d80` (`+` preserved Phase 1–5 & Phase 1C uncommitted working tree)  
**Target Production Supabase Project:** `gbovkejymfeiqgverzfr`  
**Scope:** Hardening the local/CI PostgreSQL 16 verification harness per [`docs/roadmap/PHASE_1D_DATABASE_READINESS_REPORT.md`](file:///c:/Users/rudra/TyProX/docs/roadmap/PHASE_1D_DATABASE_READINESS_REPORT.md) without altering application code, migrations, `.env*`, or production state.

---

## Verdict: `CONDITIONALLY VERIFIED — LOCAL EXECUTION BLOCKED`

- **Actual PostgreSQL 16 execution completed locally:** **NO** (`docker`, `psql`, `supabase`, and `wsl` are absent on this Windows host; `npm run test:db` exits `1`, and direct Git Bash `run-pg-verification.sh` exits `127`).
- **GitHub Actions CI execution completed:** **NO** (`ci-postgres-verification.yml` is untracked locally and has `0` runs on `Rudra4451/practice`).
- **Verification Harness Status:** **Static & Shell Syntax Verified, Runtime Blocked Pending PostgreSQL 16 Execution.** All five Phase 1D blind spots (superuser `leaderboard_view` query, sticky `request.jwt.claim.sub` GUC under `anon`, unasserted `pg_policies`/grants catalogs, superuser-tested onboarding triggers, non-deterministic race window, missing `anon`/table DML & privacy RLS checks, and CI workflow gaps) are fixed cleanly in [`tests/db/supabase_shim.sql`](file:///c:/Users/rudra/TyProX/tests/db/supabase_shim.sql), [`tests/db/verify_migrations.sql`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql), [`tests/db/run-pg-verification.sh`](file:///c:/Users/rudra/TyProX/tests/db/run-pg-verification.sh), [`.github/workflows/ci-postgres-verification.yml`](file:///c:/Users/rudra/TyProX/.github/workflows/ci-postgres-verification.yml), and [`docker-compose.db.yml`](file:///c:/Users/rudra/TyProX/docker-compose.db.yml). **Production database rollout remains BLOCKED until a real PostgreSQL 16 run succeeds and owner preflight catalog/backup/credential checks pass.**

---

## 1. Supabase Shim Hardening ([`tests/db/supabase_shim.sql`](file:///c:/Users/rudra/TyProX/tests/db/supabase_shim.sql))

Rewrote the local compatibility shim (`88` LF lines, `CR=0`) to enforce real role identity boundaries:
- **Authentic Role Isolation ([`L40-L67`](file:///c:/Users/rudra/TyProX/tests/db/supabase_shim.sql#L40-L67)):**
  - `auth.uid()` returns `NULL::uuid` unconditionally whenever `current_user = 'anon'` — even if stale `request.jwt.claim.sub` or `request.jwt.claims` JSON GUCs remain set in the session/subtransaction. For non-`anon` roles it resolves `request.jwt.claim.sub` with JSON fallback `request.jwt.claims::jsonb->>'sub'`.
  - `auth.role()` returns `current_user::text` directly whenever running as `'anon'`, `'authenticated'`, or `'service_role'`, falling back cleanly otherwise.
- **Least-Privilege `auth` Schema Grants ([`L23-L35`](file:///c:/Users/rudra/TyProX/tests/db/supabase_shim.sql#L23-L35), [`L69-L72`](file:///c:/Users/rudra/TyProX/tests/db/supabase_shim.sql#L69-L72)):**
  - Granted `USAGE ON SCHEMA auth` and `EXECUTE` on `auth.uid()` / `auth.role()` explicitly to `postgres, anon, authenticated, service_role` (revoked from `PUBLIC`) so client-role assertions can call `auth.uid()` directly without failing schema lookup.
  - Explicitly revoked `ALL ON ALL TABLES IN SCHEMA auth` and `auth.users` from `PUBLIC, anon, authenticated`.
- **Remaining Fidelity Difference vs Managed Supabase:** Installed PostgreSQL extensions land in `public` rather than Supabase's `extensions` schema, GoTrue-internal columns/roles (`authenticator`, `supabase_admin`) are omitted, and verification always initializes from an empty DB rather than a `FULL_SCHEMA.sql`-bootstrapped state.

---

## 2. Test Suite Hardening ([`tests/db/verify_migrations.sql`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql))

Converted [`tests/db/verify_migrations.sql`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql) (`1182` LF lines, `CR=0`) from one monolithic block into **13 isolated transactions (`TX 1`–`TX 13`)** so `LOCAL` role switches and JWT GUCs cannot bleed across checks:

| Transaction | Scope & Verified Invariants |
|---|---|
| **`TX 1`** ([`L17-L280`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql#L17-L280)) | Full catalog assertions (details in Section 3 below). |
| **`TX 2`** ([`L285-L361`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql#L285-L361)) | Fixture setup (`auth.users`), temporary `trg_test_force_replay_failure`, `handle_new_user()` reserved/`user_<8hex>` sanitization, duplicate collision burst (`20` rapid `storm_handle` signups), and initial streak (`0`, `NULL`). |
| **`TX 3 & TX 4`** ([`L366-L444`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql#L366-L444)) | Cross-transaction & role-switch identity isolation: confirms `COMMIT` clears `request.jwt.claim.sub`; `authenticated` without claim returns `auth.uid() IS NULL`; `authenticated` -> `anon` role switch forces `auth.uid() IS NULL` even with injected stale `sub`; `anon` & `authenticated` denied `SELECT auth.users`. |
| **`TX 5`** ([`L449-L506`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql#L449-L506)) | Executes username onboarding & rename lock strictly under **`SET LOCAL ROLE service_role`** (mirrors `PATCH /api/profile`): rejects short (`23514`), reserved `'ADMIN'` (`23514`), placeholder `'user_deadbeef'` (`23514`), normalizes `'Beta_Verified'` -> `'beta_verified'`, and rejects second rename (`42501 USERNAME_LOCKED`). |
| **`TX 6`** ([`L511-L639`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql#L511-L639)) | **`authenticated` permissions:** allows own non-username preference update (`display_name`, `theme`, `font_family`, `updated_at`), confirms cross-user `UPDATE` affects `0` rows, blocks `UPDATE profiles.username` (`42501`), blocks `INSERT`/`UPDATE`/`DELETE` across **all `12` public tables**, and blocks `submit_verified_result(...)`. |
| **`TX 7`** ([`L644-L758`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql#L644-L758)) | **`anon` exhaustive denial:** verifies strict `auth.uid() IS NULL` and `42501 insufficient_privilege` on `INSERT`/`UPDATE`/`DELETE` across **all `12` public tables** plus `submit_verified_result(...)`. |
| **`TX 8`** ([`L763-L934`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql#L763-L934)) | **`service_role` RPC & fixtures:** fresh write (`streak=1`, Bronze Fingers), atomic rollback on `trg_test_force_replay_failure`, pure-duplicate UTC streak immutability (`client_run_id` & signature), orphan recovery anchored to `created_at` UTC, future `last_active_date` skew preservation, `CLIENT_RUN_ID_CONFLICT` (`P0001`), `RESULT_INVALIDATED` (`P0001`), cross-user shared `client_run_id`, plus unranked (`240 WPM`), anonymous (`250 WPM`), active/expired `challenge_links`, and `user_lesson_progress` fixtures. |
| **`TX 9`** ([`L939-L1009`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql#L939-L1009)) | **`anon` privacy & view checks:** direct `leaderboard_view` query **as `anon`** (never `postgres`), verifying `replays=0`, `test_results` hiding invalidated & `user_id IS NULL` rows, `challenge_links` expiry filter, `user_lesson_progress=0`, and deduplicated `99 WPM` leaderboard output (`0` rows with `wpm >= 111`). |
| **`TX 10`** ([`L1014-L1086`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql#L1014-L1086)) | **`authenticated(user_b)` isolation:** blocks `user_a` replays, invalidated results, `NULL user_id` runs, expired challenges, and `user_a` lesson progress; verifies `user_b`'s own unranked `240 WPM` run appears in `test_results` yet stays suppressed from `leaderboard_view`. |
| **`TX 11`** ([`L1091-L1134`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql#L1091-L1134)) | **`authenticated(user_a)` owner reads:** confirms owner reads own replay, lesson progress, and invalidated `111 WPM` base row while `leaderboard_view` queried as `user_a` still hides `111 WPM` and shows `99 WPM`. |
| **`TX 12`** ([`L1139-L1169`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql#L1139-L1169)) | **Runtime `security_invoker` proof** (details in Section 4). |
| **`TX 13`** ([`L1174-L1182`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql#L1174-L1182)) | Drops temporary scratch table `_verify_state` and replay failure trigger/function; emits `ALL_MIGRATION_INVARIANTS_PASSED`. |

---

## 3. Catalog Assertions Added (`TX 1`)

[`TX 1`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql#L17-L280) queries system catalogs directly rather than assuming grants mask policies:
- **Roles & RLS Enablement ([`L30-L60`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql#L30-L60)):** Confirms `anon` & `authenticated` are `NOLOGIN`, `NOINHERIT`, non-superuser, non-`BYPASSRLS`; `service_role` has `NOLOGIN`, `NOINHERIT`, `BYPASSRLS`; and all `12` public tables have `rowsecurity = TRUE` in `pg_tables`.
- **`pg_policies` Dropped & Hardened Checks ([`L63-L115`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql#L63-L115)):** Explicitly verifies zero remnants of legacy permissive/broad policies (`"Authenticated users or server can insert results"`, `"Test results are readable by everyone"`, `"Anyone can insert replays (verified via API)"`, `"Replays are readable by everyone"`, `"Users can update their own streaks"`, `"Trigger can insert streaks"`, `"Anyone can insert challenge links"`, `"Authenticated users can create challenge links"`, `"Challenge links are readable by everyone"`, `"Users can log their own challenge progress"`, `"Users can insert their own achievements"`, `"Users can update their own profiles"`), verifies zero non-`SELECT` policies outside `public.profiles`, verifies hardened `"Users can update their own profiles safely"` contains `auth.uid() = id` without the legacy `username` regex fallback, and verifies required `SELECT` privacy policies exist on `test_results`, `replays`, `challenge_links`, and `user_lesson_progress`.
- **Table & Column Privileges ([`L118-L162`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql#L118-L162)):** Confirms `anon` holds strictly `SELECT` in `role_table_grants`; `authenticated` holds strictly `SELECT` plus `UPDATE` on `profiles`; `column_privileges` on `profiles` `UPDATE` for `authenticated` equals the exact array `['avatar_url', 'display_name', 'font_family', 'theme', 'updated_at']` (verifying `username` is absent).
- **`SECURITY DEFINER` & Function Execute ([`L165-L200`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql#L165-L200)):** Verifies `prosecdef = TRUE` and `search_path=public` on `submit_verified_result` and `handle_new_user`, revokes on `anon`/`authenticated` across `submit_verified_result`, `handle_new_user`, and `enforce_profile_username_integrity`, and `EXECUTE` retained by `service_role`.
- **View Metadata, Indexes, Seeds & Realtime ([`L202-L279`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql#L202-L279)):** Checks `leaderboard_view` `reloptions` (`security_invoker=true`), `has_table_privilege` `SELECT` for `anon`/`authenticated`, `pg_get_viewdef` predicates (`is_invalidated`, `user_id`, `is_ranked`), exact `12`-column output contract, removal of `test_results_client_run_id_key`, partial unique index `idx_test_results_user_client_run_id`, partial filtered `idx_test_results_leaderboard`, `11` seeded achievements, and `supabase_realtime` membership for `test_results`.

---

## 4. Runtime `security_invoker` Proof (`TX 12`)

In addition to `reloptions` inspection, [`TX 12`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql#L1139-L1169) proves `security_invoker = true` behaviorally inside an ephemeral `ROLLBACK`-scoped transaction:
1. Executes `REVOKE SELECT ON public.test_results FROM anon;` as `postgres`.
2. Switches to `SET LOCAL ROLE anon;` and queries `public.leaderboard_view`.
3. Asserts PostgreSQL throws SQLSTATE `42501 insufficient_privilege` (raising an exception if the view instead bypassed caller privileges like a `security_invoker = false` / definer view).
4. Runs `ROLLBACK;` and immediately re-verifies a subsequent `anon` query against `public.leaderboard_view` returns `>= 1` valid ranked entry cleanly.

---

## 5. Deterministic Concurrency Synchronization ([`tests/db/run-pg-verification.sh`](file:///c:/Users/rudra/TyProX/tests/db/run-pg-verification.sh))

Rewrote [`tests/db/run-pg-verification.sh`](file:///c:/Users/rudra/TyProX/tests/db/run-pg-verification.sh) (`305` LF lines, `CR=0`, POSIX `sh`) to make Step `[4/4]` genuinely deterministic:
- **PostgreSQL 16 Version Gate ([`L34-L40`](file:///c:/Users/rudra/TyProX/tests/db/run-pg-verification.sh#L34-L40)):** Logs `SELECT version();` and fails unless `server_version_num >= 160000`.
- **Advisory-Lock & `AFTER INSERT` Barrier ([`L97-L204`](file:///c:/Users/rudra/TyProX/tests/db/run-pg-verification.sh#L97-L204)):**
  - Installs a temporary `AFTER INSERT ON public.test_results` trigger (`trg_test_race_barrier` -> [`test_race_barrier()`](file:///c:/Users/rudra/TyProX/tests/db/run-pg-verification.sh#L105-L155)) scoped strictly to `seed = 'race_seed_1'`.
  - Worker 1 runs `BEGIN; SET LOCAL ROLE service_role; SELECT submit_verified_result(...); COMMIT;` under `statement_timeout = '15s'`, `lock_timeout = '10s'`. After inserting into `test_results` in RPC Step `3C`, the trigger acquires `pg_advisory_xact_lock(4200, 99002)` **before committing** and polls `pg_stat_activity` (`50ms` intervals, `8s` bound) until `typrox_race_worker_2` enters `state = 'active'`, `wait_event_type = 'Lock'`, `wait_event IN ('transactionid', 'tuple')`.
  - Worker 2 (`application_name = 'typrox_race_worker_2'`) polls `pg_locks` until advisory lock `(4200, 99002)` is granted (`8s` bound) **before** calling `submit_verified_result(...)`. Because Worker 1 is uncommitted, Worker 2 bypasses Step `3A` under `READ COMMITTED`, blocks in `3C INSERT` on Worker 1's uncommitted index tuple/xact lock, records contention evidence in `public.test_race_evidence`, and upon Worker 1's `COMMIT` enters `EXCEPTION WHEN unique_violation`.
- **Safe Process Cleanup & Contention Assertions ([`L50-L63`](file:///c:/Users/rudra/TyProX/tests/db/run-pg-verification.sh#L50-L63), [`L206-L296`](file:///c:/Users/rudra/TyProX/tests/db/run-pg-verification.sh#L206-L296)):** Captures separate worker stdout/stderr files and exit codes (`RC1`, `RC2`) with `trap cleanup EXIT INT TERM` reaping any stray worker PIDs; parses both JSON outputs as native PostgreSQL `jsonb` to prove `test_race_evidence.worker2_blocked_observed = TRUE`, `results = 1`, `replays = 1`, `streak = 1`, `user_achievements = 3`, identical `result.id`, winner `deduplicated = false` (`unlocked @> ["Bronze Fingers"]`), and contention loser `deduplicated = true`, `recoveredPartialWrite = false`, `streakDays = 1`, `unlocked = []`.

---

## 6. CI Workflow & Compose Hardening ([`.github/workflows/ci-postgres-verification.yml`](file:///c:/Users/rudra/TyProX/.github/workflows/ci-postgres-verification.yml), [`docker-compose.db.yml`](file:///c:/Users/rudra/TyProX/docker-compose.db.yml))

Updated [`.github/workflows/ci-postgres-verification.yml`](file:///c:/Users/rudra/TyProX/.github/workflows/ci-postgres-verification.yml) (`91` LF lines, `CR=0`):
- **Least Privilege & Triggers ([`L3-L23`](file:///c:/Users/rudra/TyProX/.github/workflows/ci-postgres-verification.yml#L3-L23)):** Added `permissions: { contents: read }`, `workflow_dispatch:`, and scoped `concurrency: { group: postgres-verification-${{ github.ref }}, cancel-in-progress: true }`.
- **Timeout & Healthcheck ([`L28-L43`](file:///c:/Users/rudra/TyProX/.github/workflows/ci-postgres-verification.yml#L28-L43)):** Added `timeout-minutes: 10`, `--health-start-period=5s`, and explicit `-d postgres` to `pg_isready` (mirrored in [`docker-compose.db.yml:11`](file:///c:/Users/rudra/TyProX/docker-compose.db.yml#L11)).
- **CRLF Gate, Cleanup & Summary ([`L53-L91`](file:///c:/Users/rudra/TyProX/.github/workflows/ci-postgres-verification.yml#L53-L91)):** Enforces `CR=0` on `tests/db/*`, invokes `sh tests/db/run-pg-verification.sh`, runs `if: always()` reaper dropping any orphan `typrox_verify_%` DBs, and emits a `$GITHUB_STEP_SUMMARY` block.

---

## 7. Actual Verification Commands & Exit Codes

All commands executed locally in `c:\Users\rudra\TyProX` after completing Phase 1E edits:

| Check | Exact Observed Output / Summary | Exit Code |
|---|---|---|
| `Get-Command docker,psql,supabase,sh,bash,wsl,gh` | Only `wsl.exe` (not installed) and `gh.exe` present on `PATH`; no `docker`/`psql`/`supabase`/`sh` | `0` |
| `npm run test:db` | `'sh' is not recognized as an internal or external command` | **`1`** |
| `& "C:\Program Files\Git\bin\sh.exe" -n tests/db/run-pg-verification.sh` | Clean POSIX shell syntax validation (`0` errors) | **`0`** |
| `& "C:\Program Files\Git\bin\sh.exe" tests/db/run-pg-verification.sh` | `ERROR: Neither 'psql' nor 'docker' is available on this host. Cannot execute PostgreSQL 16 verification.` | **`127`** |
| Byte CRLF inspection (`supabase_shim.sql`, `verify_migrations.sql`, `run-pg-verification.sh`, `ci-postgres-verification.yml`, `docker-compose.db.yml`) | `CR=0` across all 5 files (`88`, `1182`, `305`, `91`, `30` LF lines respectively) | **`0`** |
| `git diff --check` | Clean whitespace/conflict check | **`0`** |
| `npm run test:unit` | `23 passed (23)` test files, `118 passed (118)` tests (Vitest / jsdom mocked suites) | **`0`** |
| `npm run lint` | Clean `eslint` check | **`0`** |
| `npm run typecheck` | Clean `tsc --noEmit --incremental false` | **`0`** |
| `gh workflow list -R Rudra4451/practice -a` / `gh run list -R Rudra4451/practice -L 5` | Only `pages-build-deployment` active (`2026-06-12` last run); `0` runs of `PostgreSQL 16 Migration Verification` | **`0`** |

---

## 8. Governance Compliance Confirmation

- **Untouched Application & Migration Assets:** Zero modifications were made to `app/`, `components/`, `lib/`, `stores/`, `types/`, `__tests__/`, `e2e/`, [`package.json`](file:///c:/Users/rudra/TyProX/package.json), `.env*`, [`FULL_SCHEMA.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/FULL_SCHEMA.sql), or `supabase/migrations/20260618`–`20260624` (verified untouched timestamps and `git status`).
- **No Production Side Effects:** Zero connections, queries, writes, or migrations executed against production Supabase (`gbovkejymfeiqgverzfr`); zero service-role secrets exposed or printed; zero Git commits, pushes, or deployments performed.

---

## 9. Exact Owner Next Steps to Unblock Real PostgreSQL 16 Verification

### Option 1 — Run via GitHub Actions (No Local PostgreSQL/Docker Install Needed)
1. Review and commit the prepared database migrations, Docker/DB test harness, and workflow (keeping `.env.local` out of Git):
   ```powershell
   git add supabase/migrations/2026062*.sql tests/db docker-compose.db.yml .github/workflows/ci-postgres-verification.yml
   ```
   *(Or stage them alongside your approved Phase 1–5 & Phase 1C release branch/PR.)*
2. Push to `origin` and trigger/inspect `"PostgreSQL 16 Migration Verification"`:
   ```powershell
   git push origin <branch>
   gh run list -R Rudra4451/practice --workflow "PostgreSQL 16 Migration Verification" -L 5
   gh workflow run "PostgreSQL 16 Migration Verification" -R Rudra4451/practice --ref <branch>
   ```

### Option 2 — Run Locally on Windows via Docker Desktop or Native PostgreSQL 16
- **Docker Desktop (free Personal tier):**
  ```powershell
  docker compose -f docker-compose.db.yml run --rm verify
  $ec = $LASTEXITCODE
  docker compose -f docker-compose.db.yml down
  if ($ec -ne 0) { exit $ec }
  ```
- **Native Windows PostgreSQL 16 (`psql.exe` on `PATH` + Git Bash, local instance only):**
  ```powershell
  $env:PGHOST = "127.0.0.1"; $env:PGPORT = "5432"; $env:PGUSER = "postgres"; $env:PGPASSWORD = "<local_pg_password>"
  & "C:\Program Files\Git\bin\sh.exe" tests/db/run-pg-verification.sh
  ```

*(After PostgreSQL 16 passes `SUCCESS: All PostgreSQL 16 migrations (20260618..20260624), security boundaries, and deterministic concurrency invariants passed.`, complete the production preflight queries `#1`–`#7`, take a backup, provision `SUPABASE_SERVICE_ROLE_KEY`, and apply `20260621`–`20260624` sequentially in a maintenance window as detailed in [`PHASE_1D_DATABASE_READINESS_REPORT.md`](file:///c:/Users/rudra/TyProX/docs/roadmap/PHASE_1D_DATABASE_READINESS_REPORT.md).)*

