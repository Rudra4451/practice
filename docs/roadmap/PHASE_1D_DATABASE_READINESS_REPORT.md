# TyProX 2.0 — Phase 1D: PostgreSQL CI Execution & Migration Readiness Audit Report

**Audit Date:** 2026-11-11  
**Audit Scope:** Verification-only review of the PostgreSQL 16 verification harness, Windows & GitHub Actions execution readiness, and full migration sequence (`20260618`–`20260624` + `FULL_SCHEMA.sql`) against live environment evidence  
**Baseline Repository State:** `main` @ `fba1d80` (`+` uncommitted Phase 1–5 & Phase 1C working tree, preserved untouched)  
**Target Production Supabase Project:** `gbovkejymfeiqgverzfr`  
**Governance Compliance:** Strictly verification-only — zero edits to code, SQL migrations, workflows, or `.env*` files; zero commits, pushes, branch resets, or deployments; zero production database connections, writes, or migrations executed.

---

## Executive Summary & Final Verdict

### **Final Verdict: `CONDITIONALLY READY FOR OWNER DATABASE REVIEW`**
*(Production Migration Rollout Status: **`NOT READY / BLOCKED`** until real PostgreSQL 16 execution completes, test-coverage blind spots are closed or manually verified, and all pre-migration catalog/backup/credential gates are satisfied.)*

- **Migrations & Application Contract (`20260621`–`20260624`):** Statically sound and cleanly aligned with all Phase 1C server/client callers ([`lib/data/leaderboard.ts`](file:///c:/Users/rudra/TyProX/lib/data/leaderboard.ts), [`lib/data/profile.ts`](file:///c:/Users/rudra/TyProX/lib/data/profile.ts), [`lib/data/challenge.ts`](file:///c:/Users/rudra/TyProX/lib/data/challenge.ts), [`lib/typing/persistence.ts`](file:///c:/Users/rudra/TyProX/lib/typing/persistence.ts), [`app/api/results/route.ts`](file:///c:/Users/rudra/TyProX/app/api/results/route.ts), [`app/api/results/sync/route.ts`](file:///c:/Users/rudra/TyProX/app/api/results/sync/route.ts), [`app/api/challenges/route.ts`](file:///c:/Users/rudra/TyProX/app/api/challenges/route.ts), [`app/api/profile/route.ts`](file:///c:/Users/rudra/TyProX/app/api/profile/route.ts), [`app/dashboard/page.tsx`](file:///c:/Users/rudra/TyProX/app/dashboard/page.tsx), [`app/dashboard/performance-lab/page.tsx`](file:///c:/Users/rudra/TyProX/app/dashboard/performance-lab/page.tsx)). No syntax errors or destructive schema breaks were identified in static review, making the bundle safe for owner SQL inspection.
- **Why Not `READY`:**
  1. **Zero real PostgreSQL 16 execution evidence exists:** `npm run test:db` fails on this Windows host (`docker`, `psql`, `supabase`, `sh`/`bash` on `PATH`, and `wsl` are unavailable), and [`.github/workflows/ci-postgres-verification.yml`](file:///c:/Users/rudra/TyProX/.github/workflows/ci-postgres-verification.yml) exists only locally (untracked) with zero workflow runs on GitHub.
  2. **Verification suite false-confidence gaps:** [`tests/db/verify_migrations.sql`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql) and [`tests/db/run-pg-verification.sh`](file:///c:/Users/rudra/TyProX/tests/db/run-pg-verification.sh) have concrete blind spots (testing `leaderboard_view` as superuser `postgres` instead of `anon`/`authenticated`; sticky `request.jwt.claim.sub` GUC across `RESET ROLE` / `anon` switches; no direct `pg_policies` assertion; untested `anon` DML, `test_results` visibility, `challenge_links` expiry, and `user_lesson_progress` RLS boundaries; non-deterministic parallel race trigger in Step 4).
  3. **Production preconditions are unverified:** Live `pg_policies`, `role_table_grants`, `pg_indexes`, `handle_new_user()`, `supabase_realtime`, `supabase_migrations.schema_migrations`, verified backups/PITR, and `SUPABASE_SERVICE_ROLE_KEY` remain unconfirmed or unprovisioned.

---

## 1. PostgreSQL 16 Verification Harness Review

Reviewed files:
- [`docker-compose.db.yml`](file:///c:/Users/rudra/TyProX/docker-compose.db.yml) (`30` lines, `CRLF=0`)
- [`tests/db/supabase_shim.sql`](file:///c:/Users/rudra/TyProX/tests/db/supabase_shim.sql) (`62` lines, `CRLF=0`)
- [`tests/db/verify_migrations.sql`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql) (`491` lines, `CRLF=0`)
- [`tests/db/run-pg-verification.sh`](file:///c:/Users/rudra/TyProX/tests/db/run-pg-verification.sh) (`125` lines, `CRLF=0`)
- [`.github/workflows/ci-postgres-verification.yml`](file:///c:/Users/rudra/TyProX/.github/workflows/ci-postgres-verification.yml) (`50` lines, `CRLF=0`)
- [`package.json`](file:///c:/Users/rudra/TyProX/package.json) (`49` lines, `"test:db"` on line `13`)

### 1.1 Initialization, Sequencing & Exit Propagation

| Dimension | Assessment | Evidence & Notes |
|---|---|---|
| **PG 16 Container Startup** | **Sound** | [`docker-compose.db.yml`](file:///c:/Users/rudra/TyProX/docker-compose.db.yml#L2-L20) uses `postgres:16-alpine`, `tmpfs` storage, `pg_isready -U postgres` (`interval: 2s`, `retries: 20`), and `depends_on.postgres.condition: service_healthy`. |
| **Deterministic Clean State** | **Sound** | Both Docker (`tmpfs`) and CI (`postgres:16-alpine` service container) start empty; [`run-pg-verification.sh`](file:///c:/Users/rudra/TyProX/tests/db/run-pg-verification.sh#L34-L47) creates a PID-scoped database (`typrox_verify_$$`) and drops it via `trap cleanup EXIT INT TERM` (`WITH (FORCE)`). |
| **Migration Application Order** | **Sound** | [`run-pg-verification.sh`](file:///c:/Users/rudra/TyProX/tests/db/run-pg-verification.sh#L49-L61) applies `supabase_shim.sql` followed strictly by `20260618` -> `20260619` -> `20260620` -> `20260621` -> `20260622` -> `20260623` -> `20260624` with `-v ON_ERROR_STOP=1`. Correctly excludes [`FULL_SCHEMA.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/FULL_SCHEMA.sql). |
| **Exit Code Propagation** | **Sound** | [`run-pg-verification.sh`](file:///c:/Users/rudra/TyProX/tests/db/run-pg-verification.sh#L1-L2,L19,L28,L87-L88,L122) uses `set -eu`, `-v ON_ERROR_STOP=1` on every `psql` call, returns `127` when both `psql` and `docker` are absent, and exits `1` on race-count mismatch. Under `set -e`, `wait "$PID1"` and `wait "$PID2"` propagate background `psql` failure codes. |
| **Ephemeral Container Lifecycle Caveat** | **Minor Operational Note** | Running `docker compose -f docker-compose.db.yml run --rm verify` removes `verify`, **but leaves the `postgres` dependency container running** until `docker compose -f docker-compose.db.yml down` is run. |

### 1.2 Supabase Shim Fidelity Boundaries ([`tests/db/supabase_shim.sql`](file:///c:/Users/rudra/TyProX/tests/db/supabase_shim.sql))

The shim accurately provides the roles (`anon`, `authenticated`, `service_role` with `NOINHERIT` and `BYPASSRLS` on `service_role`), `auth` schema, `auth.users`, `auth.uid()`, `auth.role()`, `supabase_realtime` publication, and `service_role` default privileges needed by `20260618`–`20260624`. However, owners must note these structural differences from managed Supabase (`gbovkejymfeiqgverzfr`):

1. **Extension Schema Difference:** `20260618` runs `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` and `"pg_trgm"` in `public` (succeeding in `postgres:16-alpine`), whereas Supabase typically installs extensions in the dedicated `extensions` schema (already pre-installed in production).
2. **`auth.uid()` Implementation & Stale JWT GUC:** [`supabase_shim.sql`](file:///c:/Users/rudra/TyProX/tests/db/supabase_shim.sql#L31-L37) reads only `NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid`. Real Supabase GoTrue/PostgREST sets `request.jwt.claims` JSON + per-HTTP-request transaction GUCs and ensures `anon` has no `sub` claim unless authenticated. Additionally, the shim omits `authenticator` / `supabase_admin` roles, GoTrue columns (`aud`, `role`, `encrypted_password`, `raw_app_meta_data`, etc.), and Supabase PostgREST schema-cache behavior.
3. **Production Cleanliness vs Clean DB:** The harness always starts from an empty schema, so it **does not test running `20260621`–`20260624` on top of a `FULL_SCHEMA.sql`-bootstrapped database** (notably pre-existing `idx_test_results_leaderboard` or manual policy names).

---

## 2. Windows Execution & Environment Compatibility

### 2.1 Observed Host Tooling Failure (`npm run test:db`)

Direct verification on this Windows workspace confirmed:
- [`package.json`](file:///c:/Users/rudra/TyProX/package.json#L13) defines `"test:db": "sh tests/db/run-pg-verification.sh"`.
- Running `npm run test:db` from Windows `PowerShell` / `cmd.exe` **fails immediately with `exit 1`** (`'sh' is not recognized`).
- System binary check (`Get-Command docker,psql,supabase,sh,bash,wsl,gh`) returned only `wsl.exe` (`C:\WINDOWS\system32\wsl.exe`) and `gh.exe` (`C:\Program Files\GitHub CLI\gh.exe`).
- `wsl --list --verbose` reported: `"The Windows Subsystem for Linux is not installed."`
- While Git for Windows provides `C:\Program Files\Git\bin\sh.exe` and `bash.exe`, running `run-pg-verification.sh` through Git Bash on this machine still aborts cleanly with **`exit 127`** because neither `docker` nor `psql` is installed locally.
- `.env.local` defines only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SITE_URL` are absent; `.env.example` exists locally with placeholders).

### 2.2 Supported Execution Paths on Windows (Zero Paid Tools)

#### Route A — Docker Desktop (Free Personal Tier / Podman / Rancher Desktop)
1. Install Docker Desktop for Windows (free Personal edition) and ensure the Linux container engine is running.
2. Execute in PowerShell from `c:\Users\rudra\TyProX`:
```powershell
docker compose -f docker-compose.db.yml run --rm verify
$verifyExit = $LASTEXITCODE
docker compose -f docker-compose.db.yml down
if ($verifyExit -ne 0) { exit $verifyExit }
```
*(Alternatively, once `docker` is on `PATH`, Git Bash can invoke `& "C:\Program Files\Git\bin\sh.exe" tests/db/run-pg-verification.sh`, which delegates to `docker compose`, followed by `docker compose -f docker-compose.db.yml down`.)*

#### Route B — Native Windows PostgreSQL 16 + Git Bash (No Docker Required)
1. Install the free official Windows PostgreSQL 16 package (includes `psql.exe` and `pg_isready.exe`) and add its `bin` folder (typically `C:\Program Files\PostgreSQL\16\bin`) to `PATH`.
2. Execute in PowerShell from `c:\Users\rudra\TyProX` against a local test instance (**never** a production URI):
```powershell
$env:PGHOST = "127.0.0.1"
$env:PGPORT = "5432"
$env:PGUSER = "postgres"
$env:PGPASSWORD = "your_local_postgres_password"
& "C:\Program Files\Git\bin\sh.exe" tests/db/run-pg-verification.sh
```

#### Route C — GitHub Actions (`ubuntu-latest`, Free GitHub-Hosted Runner)
See Section 3 below for committing, pushing, and triggering `.github/workflows/ci-postgres-verification.yml`.

---

## 3. GitHub Actions CI Workflow Readiness

Inspected [`.github/workflows/ci-postgres-verification.yml`](file:///c:/Users/rudra/TyProX/.github/workflows/ci-postgres-verification.yml) (`50` lines) and queried `Rudra4451/practice` via `gh`:

### 3.1 Workflow Configuration Audit

| Aspect | Status | Verified Details |
|---|---|---|
| **Remote Presence** | **NOT IN REPO YET** | `git ls-tree -r --name-only origin/main -- .github supabase/migrations` confirms **only** `20260618`, `20260619`, `20260620`, and `FULL_SCHEMA.sql` exist on `origin/main`. `.github/workflows/ci-postgres-verification.yml`, `docker-compose.db.yml`, `tests/db/*`, and `20260621`–`20260624` are all local-only (`untracked`). |
| **Line Endings** | **Clean (`CRLF=0`)** | Verified zero CRLF bytes in `ci-postgres-verification.yml`, `run-pg-verification.sh`, `supabase_shim.sql`, `verify_migrations.sql`, `docker-compose.db.yml`, and `20260621`–`20260624`. (`20260618`–`20260620` & `FULL_SCHEMA.sql` have CRLF endings from earlier commits; `psql -f` reads CRLF SQL cleanly on Linux.) |
| **Container & Service Health** | **Sound** | Uses `ubuntu-latest`, service `postgres:16-alpine`, `POSTGRES_USER: postgres`, `POSTGRES_PASSWORD: typrox_ci_pg_password`, `ports: 5432:5432`, and `pg_isready -U postgres` health check (`5s` interval, `10` retries). |
| **Client Tools & Env Vars** | **Sound** | Installs `postgresql-client` via `apt-get` and sets matching `PGHOST=127.0.0.1`, `PGPORT="5432"`, `PGUSER=postgres`, `PGPASSWORD=typrox_ci_pg_password` for `bash tests/db/run-pg-verification.sh`. |
| **Trigger Usability Gap** | **Needs Attention** | `on:` defines only `push.paths` and `pull_request.paths` (`supabase/migrations/**`, `tests/db/**`, `docker-compose.db.yml`, `.github/workflows/ci-postgres-verification.yml`). **No `workflow_dispatch:` trigger exists**, so owners cannot manually re-run `"PostgreSQL 16 Migration Verification"` via GitHub UI or `gh workflow run` without making a path-matching commit. |
| **Least-Privilege Permissions Gap** | **Needs Attention** | Workflow lacks explicit `permissions: { contents: read }`. Best practice is declaring minimal permissions explicitly rather than inheriting repo defaults. |

### 3.2 Exact Owner Steps to Run CI (After Adding Approval / Committing)
1. Optional but recommended before first push: add `workflow_dispatch:` under `on:` and top-level `permissions: { contents: read }` in [`.github/workflows/ci-postgres-verification.yml`](file:///c:/Users/rudra/TyProX/.github/workflows/ci-postgres-verification.yml).
2. Stage and commit the harness, workflow, and migrations (`tests/db/**`, `docker-compose.db.yml`, `.github/workflows/ci-postgres-verification.yml`, `supabase/migrations/2026062*`) on a branch/PR (or `main`) and push to `origin`.
3. Verify the workflow named **`PostgreSQL 16 Migration Verification`** executes and finishes `completed` / `success` in GitHub Actions:
```powershell
gh workflow list -R Rudra4451/practice -a
gh run list -R Rudra4451/practice --workflow "PostgreSQL 16 Migration Verification" -L 5
```

---

## 4. Actual Execution Evidence

No synthetic or mocked execution is counted as PostgreSQL verification:

| Check | Date / Scope | Observed Exit Code & Evidence |
|---|---|---|
| **Local `npm run test:db`** | Local Windows host (`c:\Users\rudra\TyProX`) | **FAILED (`exit 1`)** — `'sh' is not recognized`; neither `docker` nor `psql` nor `wsl` is installed locally. |
| **GitHub Actions (`Rudra4451/practice`)** | Checked via `gh workflow list` & `gh run list` | **NEVER RUN (`0` runs)** — Only workflow registered remotely is `pages-build-deployment` (ID `294945041`); latest remote runs are static Vite/Pages runs from `2026-06-12` (`27438364127` etc.). |
| **Mocked App Suites (Phase 1C Reference)** | Local workspace (Vitest + Playwright + builds) | Phase 1C recorded `lint` (`0`), `typecheck` (`0`), `webpack`/`turbopack` builds (`33/33`), `test:unit` (`23` files, `118/118`), and `test:e2e` (`7/7`). **These mock Supabase / do not run SQL or test Postgres DDL, triggers, or RLS.** |

---

## 5. Migration-by-Migration Audit (`20260618`–`20260624` + `FULL_SCHEMA.sql`)

### 5.1 Chronological Overview & State Divergence

| File | Origin | Key Purpose & Production Notes |
|---|---|---|
| [`20260618000000_init_schema.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260618000000_init_schema.sql) | Committed (`4cd8230`/`ee80fbc`) | Creates `uuid-ossp`, `pg_trgm`, base 9 tables, RLS enabled, permissive policies (`test_results` `auth.uid() IS NULL`, `replays` `WITH CHECK (true)`, `streaks` client `UPDATE`, `challenge_links` `WITH CHECK (true)`), 5 indexes, and initial `handle_new_user()` (no `SET search_path`, `streaks` omits `INSERT` policy). Not idempotent (`CREATE TABLE` without `IF NOT EXISTS`). |
| [`20260619000000_audit_hardening.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260619000000_audit_hardening.sql) | Committed (`4cd8230`) | Tightens `INSERT` policies on `test_results`, `replays`, `challenge_links` (`"Anyone can insert challenge links"`), and adds `user_achievements` `INSERT` (`auth.uid() = user_id`), **while still preserving `user_id IS NULL AND auth.uid() IS NULL` anonymous writes**. |
| [`20260620100000_leaderboard_view.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260620100000_leaderboard_view.sql) | Committed (`f717482`) | Creates `public.leaderboard_view` without `security_invoker`, without `user_id IS NOT NULL`, and without tie-breakers; grants `SELECT` to `anon`, `authenticated`, `service_role`. **Absent (`PGRST205`) in live prod `gbovkejymfeiqgverzfr` per Batch 1.1A.** |
| [`FULL_SCHEMA.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/FULL_SCHEMA.sql) | Committed snapshot | Non-migration SQL Editor script: adds `GRANT ALL ON ALL TABLES/SEQUENCES/FUNCTIONS TO anon, authenticated, service_role`, `"Trigger can insert streaks"`, `"Authenticated users can create challenge links"`, **unfiltered** `idx_test_results_leaderboard`, `8` achievements (differs from prod's `11`), and Realtime publication for `test_results`. Must **NOT** be executed as a migration. |
| [`20260621000000_typrox_2_hardening.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260621000000_typrox_2_hardening.sql) | Uncommitted (Prepared) | Core security hardening: adds `client_run_id`, `generator_version`, `is_ranked`; makes `streaks.last_active_date` nullable; drops global `test_results_client_run_id_key`; creates scoped `idx_test_results_user_client_run_id` + partial `idx_test_results_leaderboard`; `REVOKE ALL` -> minimal `SELECT` + column-level `profiles` `UPDATE`; drops client write RLS policies on `test_results`, `replays`, `streaks`, `challenge_links`, `user_challenge_progress`, `user_achievements`; restricts `replays` `SELECT` to owner (`auth.uid()`), `test_results` `SELECT` to non-invalidated non-null runs or owner, `challenge_links` `SELECT` to non-expired; rebuilds `leaderboard_view` with `WITH (security_invoker = true)` + joins `profiles`; adds `SET search_path = public` to `handle_new_user()`; seeds `11` achievements (`ON CONFLICT DO NOTHING`); conditionally adds `test_results` to `supabase_realtime`. |
| [`20260622000000_learning_and_competitive_ecosystem.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260622000000_learning_and_competitive_ecosystem.sql) | Uncommitted (Prepared) | Creates `user_progression`, `user_lesson_progress`, and `challenge_attempts` (`IF NOT EXISTS`), enables RLS, grants `SELECT` only to `anon, authenticated` (zero client DML), restricts `user_lesson_progress` `SELECT` to owner (`auth.uid() = user_id`), leaves `user_progression` and `challenge_attempts` publicly readable, adds 2 indexes. |
| [`20260623000000_atomic_result_persistence_and_idempotency.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260623000000_atomic_result_persistence_and_idempotency.sql) | Uncommitted (Prepared) | Ensures scoped `(user_id, client_run_id)` partial unique index (dropping any single-column constraint/index on `client_run_id`) and installs `submit_verified_result(...)` v1 (`SECURITY DEFINER`, `service_role` only). **Warning:** v1 contains two Phase 1B-audited bugs (advances streaks on pure duplicates and skips `is_invalidated` check on `client_run_id`), both patched immediately by `20260624`. |
| [`20260624000000_phase1c_security_and_streak_fixes.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260624000000_phase1c_security_and_streak_fixes.sql) | Uncommitted (Prepared) | Preserves `20260618`–`20260623` checksums; strips `username` from `authenticated` `UPDATE` grant on `public.profiles`; adds `is_reserved_username(TEXT)` (`24` words) and `enforce_profile_username_integrity()` trigger (`23514` invalid/reserved/placeholder, `42501 USERNAME_LOCKED` on second rename); upgrades `handle_new_user()` to `16`-attempt collision loop + `gen_random_uuid()` fallback; replaces `submit_verified_result(...)` with v2 (blocks empty telemetry, rejects invalidated runs & conflicting `client_run_id` payloads via `P0001`, serializes orphan replay recovery with `FOR UPDATE`, restricts streak/achievement updates strictly to fresh runs and recovered replay-less orphans anchored to `created_at` UTC, preserves future `last_active_date`). |

### 5.2 Deep Schema, Security & Compatibility Checkpoints

1. **Idempotency & Existing-Schema Traps (`gbovkejymfeiqgverzfr`):**
   - **Unfiltered `idx_test_results_leaderboard` Hazard:** [`FULL_SCHEMA.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/FULL_SCHEMA.sql#L236) creates an unfiltered index named `idx_test_results_leaderboard`. If production already has that index, [`20260621`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260621000000_typrox_2_hardening.sql#L33-L35)'s `CREATE INDEX IF NOT EXISTS idx_test_results_leaderboard ... WHERE user_id IS NOT NULL AND is_invalidated = FALSE` silently becomes a no-op rather than rebuilding as the partial index. *(Owner can inspect `pg_indexes` and optionally `DROP INDEX IF EXISTS` / recreate cleanly if desired, though functionally harmless.)*
   - **Live Data Backfill Compatibility:** All `170` live `test_results` rows (`6` `__debug_test__` rows with `user_id IS NULL`, `19` duplicate submissions, historical `200`/`226` `raw_wpm` & `94 WPM` `3.97s` quote outliers) receive `client_run_id = NULL`, `generator_version = 1`, and `is_ranked = TRUE`. Partial unique index `idx_test_results_user_client_run_id` (`WHERE user_id IS NOT NULL AND client_run_id IS NOT NULL`) ignores `NULL` rows, so historical duplicates **will not fail index creation**.
   - **Historical Outliers Remain on Leaderboard Unless Moderated:** Because existing rows backfill `is_ranked = TRUE` and `is_invalidated = FALSE`, known outliers (`3.97s` `94 WPM` quote, `543`-error `226 raw_wpm` run) will appear in `leaderboard_view` until manually invalidated or deleted by owner review. Meanwhile `replays` (`164` rows) becomes immediately protected (`owner` only) once `20260621` applies.
   - **Existing `streaks` Day-1 Self-Healing:** `4/10` live active users stuck at `current_streak = 0` with non-null `last_active_date` will initialize to `1` on their next verified test thanks to [`20260624`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260624000000_phase1c_security_and_streak_fixes.sql#L512) (`COALESCE(v_streak_row.current_streak, 0) <= 0 OR last_active_date IS NULL`).
   - **Legacy Profile Row Protection:** [`20260624`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260624000000_phase1c_security_and_streak_fixes.sql#L70-L72) returns `NEW` early when `NEW.username IS NOT DISTINCT FROM OLD.username`, so existing users editing `theme`/`display_name`/`font_family` never trip username regex triggers.

2. **`SECURITY DEFINER`, Privilege & Trigger Soundness:**
   - Both `handle_new_user()` and `submit_verified_result(...)` use `SECURITY DEFINER SET search_path = public` and revoke `EXECUTE` from `PUBLIC`, `anon`, and `authenticated`. Only `service_role` holds `EXECUTE` on `submit_verified_result`.
   - `enforce_profile_username_integrity()` revokes `EXECUTE` from `PUBLIC, anon, authenticated`; in PostgreSQL, trigger function `EXECUTE` privilege is checked at `CREATE TRIGGER` time rather than per-DML row fire, allowing `authenticated` column updates on non-username fields without error while blocking direct calls (`is_reserved_username` retains default `PUBLIC` `EXECUTE` safely as `IMMUTABLE` SQL).
   - **Transient Intermediate States Between `20260621`–`20260624`:** Applying `20260621` temporarily grants `authenticated` `UPDATE(..., username)` until `20260624`, and applying `20260623` installs buggy `submit_verified_result` v1 until `20260624` overwrites it. **Therefore `20260621` -> `20260622` -> `20260623` -> `20260624` must execute sequentially in one maintenance window before reopening production writes.**

3. **Rollback & Recovery Risks:**
   - **Zero down/reverse SQL migrations exist.** `20260621` and `20260623` drop legacy constraints/policies (`DROP POLICY IF EXISTS`, `DROP VIEW`, `DROP CONSTRAINT`), and `20260621` modifies `streaks.last_active_date` nullability. Safe rollback requires capturing live `pg_policies`, `role_table_grants`, `pg_indexes`, and `handle_new_user()` definitions PLUS taking a verified database snapshot/`pg_dump` before executing any DDL.

4. **Application & TypeScript Compatibility (`20260624` Final Schema):**
   - **Leaderboard ([`lib/data/leaderboard.ts`](file:///c:/Users/rudra/TyProX/lib/data/leaderboard.ts#L66-L140)):** Queries `leaderboard_view` columns `(id, user_id, wpm, accuracy, consistency, mode, duration, created_at, username, display_name, avatar_url)`, matching [`20260621:106-127`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260621000000_typrox_2_hardening.sql#L106-L127). Retains `PGRST205` fallback until cutover completes (`DB-A3` noted: fallback omits `is_ranked = true` until `20260621` applies, after which `leaderboard_view` handles `is_ranked = TRUE` directly).
   - **Public Profile & Challenge Pages ([`lib/data/profile.ts`](file:///c:/Users/rudra/TyProX/lib/data/profile.ts#L47-L76), [`lib/data/challenge.ts`](file:///c:/Users/rudra/TyProX/lib/data/challenge.ts#L39-L45)):** Only execute `SELECT` on `profiles`, `test_results` (`is_invalidated = false`), `streaks`, `user_achievements`/`achievements`, and active `challenge_links` (`expires_at > now()`), all aligned with post-`20260621` RLS/grants.
   - **Browser Client Direct Queries (`dashboard`, `performance-lab`, `typing-container`, `auth-provider`):** All client components execute strictly `SELECT` (never client `INSERT`/`UPDATE`), and [`dashboard/page.tsx`](file:///c:/Users/rudra/TyProX/app/dashboard/page.tsx#L332), [`app/profile/page.tsx`](file:///c:/Users/rudra/TyProX/app/profile/page.tsx#L41), and [`components/auth/username-modal.tsx`](file:///c:/Users/rudra/TyProX/components/auth/username-modal.tsx#L72) route mutations through `/api/profile`, `/api/results`, `/api/results/sync`, and `/api/challenges`.
   - **Atomic RPC Contract ([`lib/typing/persistence.ts`](file:///c:/Users/rudra/TyProX/lib/typing/persistence.ts#L129-L190,L789-L860), [`types/database.ts`](file:///c:/Users/rudra/TyProX/types/database.ts#L45-L99,L440-L457)):** Exact 13-argument match (`p_user_id`..`p_deduplicate_by_signature`) and JSON key match (`result`, `unlocked`, `previousBestWpm`, `isPersonalBest`, `streakDays`, `deduplicated`, `recoveredPartialWrite`), plus `generator_version` / `is_ranked` typed properly (`DEFAULT 1` / `DEFAULT TRUE` in SQL).
   - **Schema/App Drift Note (`20260622` Tables):** `user_progression`, `user_lesson_progress`, and `challenge_attempts` exist in [`20260622`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260622000000_learning_and_competitive_ecosystem.sql) and [`types/database.ts`](file:///c:/Users/rudra/TyProX/types/database.ts#L323-L418) but currently have zero application writers/readers (deferred Phase 3+ product work).

---

## 6. Security Test Coverage & False-Confidence Analysis

Audit of [`tests/db/verify_migrations.sql`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql) (`491` lines) and [`tests/db/run-pg-verification.sh`](file:///c:/Users/rudra/TyProX/tests/db/run-pg-verification.sh) (`125` lines) identifies several tests that **pass without exercising the claimed security or concurrency boundary**, plus uncovered tables/policies:

### 6.1 False-Confidence Defects in Current DB Tests

1. **`leaderboard_view` Checked as Superuser `postgres` (Does NOT Test `security_invoker = true` or Role Permissions):**
   - [`verify_migrations.sql:465-485`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql#L465-L485) runs `RESET ROLE` (reverting to superuser `postgres`, which has `BYPASSRLS`) before querying `public.leaderboard_view`.
   - While line `232` inspects `pg_class.reloptions` for `security_invoker=true`, lines `473-485` never query `leaderboard_view` as `anon` or `authenticated`. Even if `GRANT SELECT ON public.leaderboard_view TO anon` were omitted or broke `test_results` / `profiles` RLS interaction, `verify_migrations.sql` would still pass.
2. **Sticky `request.jwt.claim.sub` GUC During `anon` Role Checks:**
   - [`supabase_shim.sql:31-37`](file:///c:/Users/rudra/TyProX/tests/db/supabase_shim.sql#L31-L37) defines `auth.uid()` solely from `request.jwt.claim.sub` without checking `current_user <> 'anon'`, and `verify_migrations.sql` never clears `request.jwt.claim.sub` (`set_config(..., '', true)`) upon `RESET ROLE`.
   - At line [`169`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql#L169), `request.jwt.claim.sub` is set to `v_user_reserved`. At lines [`217`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql#L217) and [`291`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql#L291) (`SET LOCAL ROLE anon`), `auth.uid()` **still evaluates to `v_user_reserved`**, only passing the replay test because `v_result_id` was owned by `v_user_a`.
3. **Permissive Write RLS Policies Masked by `REVOKE ALL` + Missing `pg_policies` Assertion:**
   - Because `20260621` revokes `INSERT`/`UPDATE` grants on tables, `verify_migrations.sql:180-200` hits `insufficient_privilege` (`42501`) at the table-grant layer before RLS is evaluated, and **never queries `pg_policies`** to confirm legacy permissive policies (`"Users can update their own streaks"`, `"Trigger can insert streaks"`, `"Anyone can insert challenge links"`, etc.) are actually absent.
4. **Username Onboarding & Profile Trigger Checked as `postgres`, Not `service_role`:**
   - [`verify_migrations.sql:106-157`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql#L106-L157) tests `23514` format/reserved rejections and `42501 USERNAME_LOCKED` as superuser `postgres` instead of `SET LOCAL ROLE service_role`, never proving `service_role` has column/trigger/table permissions for [`PATCH /api/profile`](file:///c:/Users/rudra/TyProX/app/api/profile/route.ts#L98-L149).
5. **Parallel Race Test (`run-pg-verification.sh:75-123`) Does Not Guarantee Concurrent Collision:**
   - Launching two background `psql ... &` processes without an internal synchronization barrier (e.g., `pg_sleep` or advisory-lock release) allows Worker 1 to finish and `COMMIT` before Worker 2 executes `INSERT` in `3C`.
   - Because both Branch `3A` (sequential duplicate lookup) and Branch `3C` (`EXCEPTION WHEN unique_violation`) return one `deduplicated: false` and one `deduplicated: true` with `recoveredPartialWrite: false`, **Step 4 can pass while exercising zero real `unique_violation` contention**.

### 6.2 Untested Security & Privacy Surfaces (`verify_migrations.sql`)

| Surface | Claimed Boundary | Current `verify_migrations.sql` Coverage |
|---|---|---|
| **`test_results` `SELECT` Privacy** | Hides `is_invalidated = TRUE` and `user_id IS NULL` rows from `anon` and `user_b`, visible to owner `user_a` (`20260621:63-65`) | **UNTESTED** |
| **`challenge_links` Expiry `SELECT` RLS** | Hides `expires_at <= now()` rows from `anon`/`authenticated` (`20260621:88-90`) | **UNTESTED** |
| **`user_lesson_progress` Owner `SELECT` RLS** | Restricts reads to `auth.uid() = user_id` (`20260622:58-60`) | **UNTESTED** |
| **`anon` DML Denial** | Blocks `anon` `INSERT`/`UPDATE`/`DELETE` across all public tables | **UNTESTED** (`anon` only tested on `submit_verified_result` & `replays` `SELECT`) |
| **`authenticated` DML on Remaining Tables** | Blocks direct `replays`, `challenge_links`, `user_achievements`, `user_challenge_progress`, `daily_challenges`, `achievements`, `user_progression`, `user_lesson_progress`, `challenge_attempts` writes | **UNTESTED** (`verify_migrations.sql` tests only `profiles`, `test_results`, `streaks`) |

---

## 7. Production Database Readiness Checklist (`gbovkejymfeiqgverzfr`)

Explicitly separates **Verified Facts** (from [`BATCH_1_1A_PREFLIGHT_REPORT.md`](file:///c:/Users/rudra/TyProX/docs/roadmap/BATCH_1_1A_PREFLIGHT_REPORT.md) and repo inspection) from **Unverified / Assumed Production State**:

| # | Readiness Requirement | Status Tag | Verified Facts vs Assumptions & Required Action |
|---|---|---|---|
| 1 | **Live `pg_policies` expressions & names** | **UNVERIFIED (Assumption-Dependent)** | Only `anon` data behavior was empirically observed (`164` replays readable, `6` `NULL` inserts succeeded in June 2026). **Cannot verify policy names** (`"Anyone can insert challenge links"` vs `"Authenticated users can create challenge links"`, `"Trigger can insert streaks"`, etc.) without owner SQL query #1. |
| 2 | **Live `role_table_grants` / sequence / function privileges** | **UNVERIFIED** | Strong historical evidence of permissive writes, but exact `GRANT ALL` presence from `FULL_SCHEMA.sql` Section 8 is **unverified**. Run owner SQL query #2 (plus function/sequence grant inspection). |
| 3 | **Live `pg_indexes` (esp. `idx_test_results_leaderboard`)** | **UNVERIFIED (Known Drift Risk)** | If `FULL_SCHEMA.sql` ran in prod, `idx_test_results_leaderboard` exists **without** `20260621`'s `WHERE` predicate and `CREATE INDEX IF NOT EXISTS` will no-op. Verify via owner SQL query #4 before cutover. |
| 4 | **Live `public.handle_new_user()` trigger DDL** | **UNVERIFIED** | **Verified Fact:** `15/16` live profiles have `user_<8hex>`. Function source (`SET search_path` missing vs present) requires owner SQL query #5. |
| 5 | **Live `supabase_realtime` publication membership** | **UNVERIFIED** | `test_results` membership is **unverified**; [`20260621:202-213`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260621000000_typrox_2_hardening.sql#L202-L213) adds it safely if missing via `pg_publication_tables` guard. Confirm via owner SQL query #4. |
| 6 | **Live `supabase_migrations.schema_migrations` tracking** | **UNVERIFIED (High Risk)** | **Verified Facts:** Live prod lacks `leaderboard_view` (`PGRST205`) while having `11` custom `achievements` vs `0` in `20260618..20260620` and `8` in `FULL_SCHEMA.sql` — proving manual out-of-band SQL Editor changes occurred. `schema_migrations` is **not** inspected by `SECURITY_REMEDIATION_PLAN.md` Section 4! Owner MUST run the extra `schema_migrations` query below before deciding between Dashboard SQL Editor application vs `supabase migration repair`. |
| 7 | **Confirmed Supabase backup / PITR / `pg_dump`** | **NO / UNVERIFIED** | Zero backup scripts or down migrations exist in repo; Free-tier Supabase lacks PITR/daily automated backups. Owner must export a verified backup before running DDL or row deletes. |
| 8 | **`SUPABASE_SERVICE_ROLE_KEY` provisioned** | **NOT CONFIGURED LOCALLY / UNVERIFIED IN HOSTING** | **Verified Fact:** `.env.local` has **only** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Hosting secrets (`Vercel`) are unverified. **Must be provisioned before `20260621` applies or deploying Phase 1C (`NODE_ENV=production` fails closed with `503`).** |
| 9 | **Historical `__debug_test__` & outlier review** | **KNOWN DIRTY DATA (UNTOUCHED)** | **Verified Facts:** Live `test_results` (`170` rows) includes `6` `__debug_test__` (`user_id IS NULL`), `1` `200 raw_wpm` 1-keystroke row, `2` `226 raw_wpm` error-spam duplicates, `17` short `quotes` (`3.97s` `94 WPM`, `26.9s` `120s` bracket), and `15` duplicate groups (`19` excess rows). Owner must approve deletion/invalidation after backup. |
| 10 | **Sequenced cutover order (`env` -> `DB` -> `App`)** | **DOCUMENTED / UNEXECUTED** | Provision `SUPABASE_SERVICE_ROLE_KEY` & `NEXT_PUBLIC_SITE_URL` -> take backup & run catalog queries -> execute PG 16 CI -> apply `20260621`..`20260624` consecutively in maintenance window -> optional outlier cleanup -> deploy Phase 1C app -> smoke-test `/rest/v1/replays` (`[]`), `leaderboard_view`, and `POST /api/results`. |

### Required Additional Owner Preflight Query (`supabase_migrations.schema_migrations`)

Run alongside the 6 queries in [`SECURITY_REMEDIATION_PLAN.md` Section 4](file:///c:/Users/rudra/TyProX/docs/roadmap/SECURITY_REMEDIATION_PLAN.md#L262-L298) in Supabase Dashboard SQL Editor (**read-only**):

```sql
-- 7. Check whether Supabase CLI migration history exists & which versions are recorded
SELECT to_regclass('supabase_migrations.schema_migrations') AS migration_table;

-- Only if migration_table above is non-null:
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version ASC;
```

---

## 8. Remaining Blockers Before Production Database Cutover

1. **Zero Real PostgreSQL 16 Execution (Hard Blocker):** Neither Docker Compose, local `psql`, nor `.github/workflows/ci-postgres-verification.yml` has ever executed `20260618`–`20260624` against a real PostgreSQL 16 engine.
2. **DB Test Harness Blind Spots (`verify_migrations.sql` / `run-pg-verification.sh`):** Superuser `leaderboard_view` query, uncleared `request.jwt.claim.sub` GUC during `anon` checks, missing `pg_policies` drop assertions, missing `anon` DML / `test_results` / `challenge_links` expiry / `user_lesson_progress` RLS tests, and unforced parallel contention in Step 4 should be remediated before treating CI green as proof of all security boundaries.
3. **Workflow Not Pushed & Lacks `workflow_dispatch`:** Commit/push `.github/workflows/ci-postgres-verification.yml` (ideally with `workflow_dispatch:` and `permissions: { contents: read }`) so GitHub Actions actually validates the harness.
4. **Missing Production Catalog & `schema_migrations` Audit + Verified Backup:** Execute preflight SQL queries `#1`–`#7` against `gbovkejymfeiqgverzfr` and export a confirmed backup prior to any DDL.
5. **Missing `SUPABASE_SERVICE_ROLE_KEY` (and `NEXT_PUBLIC_SITE_URL`):** Must be provisioned in hosting and server environment before `20260621` revokes client writes or Phase 1C deploys.
6. **Atomic Maintenance Window & Historical Outlier Policy:** Apply `20260621` -> `20260622` -> `20260623` -> `20260624` together with traffic paused (never leave `20260623` exposed without `20260624`), decide whether to drop/recreate `idx_test_results_leaderboard` if pre-existing unfiltered, and execute owner-approved cleanup for the `6` `__debug_test__` and flagged outlier rows.

