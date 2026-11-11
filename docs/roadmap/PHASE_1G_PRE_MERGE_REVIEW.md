# TyProX 2.0 — Phase 1G: Independent Pre-Merge Migration & PR #2 Security Review

**Review Date:** 2026-11-11  
**Target PR:** `https://github.com/Rudra4451/practice/pull/2` (`OPEN`, `MERGEABLE`, `+3,535 / -0`, `12` files)  
**Source Branch / Commit:** `ci/postgres-16-verification` @ `19e8873fd1ae3889432f6bb82a34d6cd718324a7`  
**Target Base Branch:** `main` @ [`fba1d80f889a02dbbf407039488223addeb4e80b`](https://github.com/Rudra4451/practice) (`Branch not protected` — HTTP `404`)  
**Target Production Supabase Project:** `gbovkejymfeiqgverzfr`  
**Reviewer Scope & Independence:** Independent senior PostgreSQL & Supabase security review comparing candidate migrations `20260621`–`20260624` against `20260618`–`20260620`, [`FULL_SCHEMA.sql`](../../supabase/reference/FULL_SCHEMA.sql), deployed `origin/main` callers vs. uncommitted Phase 1–5 callers, [`BATCH_1_1A_PREFLIGHT_REPORT.md`](../../docs/roadmap/BATCH_1_1A_PREFLIGHT_REPORT.md), [`PHASE_1D_DATABASE_READINESS_REPORT.md`](../../docs/roadmap/PHASE_1D_DATABASE_READINESS_REPORT.md), [`PHASE_1E_VERIFICATION_HARNESS_REPORT.md`](../../docs/roadmap/PHASE_1E_VERIFICATION_HARNESS_REPORT.md), and live GitHub Actions PostgreSQL `16.15` runs (`42894187120` / `42894175929`). Strictly read-only: zero code/SQL edits, commits, pushes, merges, or production database queries executed.

---

## Final Verdict

# **`DO NOT MERGE`**

### Separation of PR Merge Impact vs. Production Database Rollout Readiness

| Gate | Status | Rationale |
|---|---|---|
| **PR #2 Merge to `main`** | **`DO NOT MERGE`** | Merging PR #2 places locking migrations `20260621`–`20260624` onto unprotected `main` (`vercel[bot]` active) **without** the hardened Phase 1–5 Next.js app callers (still on incompatible `origin/main`) or `SUPABASE_SERVICE_ROLE_KEY`, leaves an unrevoked `"Users can insert their own profiles"` RLS policy (`F-05`) and exposed `is_reserved_username` RPC (`F-07`) masked by CI blind spots, ships a silent `FULL_SCHEMA.sql` index-collision bug (`F-06`), leaves [`FULL_SCHEMA.sql`](../../supabase/reference/FULL_SCHEMA.sql) non-timestamped inside `supabase/migrations/` (`F-03`), and preserves a multi-migration intermediate exposure window (`F-02`). |
| **Production DB Rollout (`gbovkejymfeiqgverzfr`)** | **`BLOCKED`** | Even after clean PostgreSQL `16.15` CI pass ([run `42894187120`](https://github.com/Rudra4451/practice/actions/runs/42894187120)), production rollout remains hard-blocked by: zero owner catalog inspection (`pg_policies`, `role_table_grants`, `pg_indexes`, `handle_new_user`, `pg_proc`, `supabase_migrations.schema_migrations`), unverified Supabase backup/PITR status, zero rollback scripts, unconfirmed `SUPABASE_SERVICE_ROLE_KEY` in production hosting, live `origin/main` caller breakage upon DB cutover, and undecided moderation of historical `__debug_test__` and telemetry outlier rows. |

> **Important Nuance:** On a **clean PostgreSQL 16 database** bootstrapped sequentially through `20260618..20260624` (`16.15`, `server_version_num=160015`), the converged schema after `20260624` is functionally sound and contract-compatible with the **uncommitted local Phase 1–5** application codebase ([`lib/typing/persistence.ts`](../../lib/typing/persistence.ts#L789-L860), [`lib/data/leaderboard.ts`](../../lib/data/leaderboard.ts#L66-L140), [`types/database.ts`](../../types/database.ts#L12-L109)). The **`DO NOT MERGE`** verdict reflects concrete SQL/CI hardening defects plus the high blast radius of landing incompatible DDL on `main` ahead of its application and operational prerequisites.

---

## Severity-Ranked Findings Summary

| ID | Severity | Priority | Summary | Primary Evidence |
|---|---|---|---|---|
| **F-01** | **Critical** | 6, 9 | Merging PR #2 creates split-brain `main` (migrating DDL without hardened Phase 1–5 app or `SUPABASE_SERVICE_ROLE_KEY`), triggers `vercel[bot]` Production deploy of stale `origin/main`, and leaves `origin/main` callers crashing (`42501` / `PGRST200` `500`s) if DB runs first | `origin/main` callers (`git show`); `gh api` `/hooks`, `/deployments`, `/branches/main/protection` |
| **F-02** | **High** | 4, 8 | 4-file split creates severe inter-migration security/outage windows (`20260621` revokes result writes without RPC + leaves `profiles.username` REST-writable; `20260623` installs vulnerable `submit_verified_result` v1) | [`20260621`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L38-L102), `20260623` |
| **F-03** | **High** | 1, 8 | Non-timestamped [`FULL_SCHEMA.sql`](../../supabase/reference/FULL_SCHEMA.sql) sits inside `supabase/migrations/`; prod has proven SQL Editor drift (`11` achievements, missing `leaderboard_view`), uninspected `schema_migrations`, and unknown custom RLS policies that bypass fixed `DROP POLICY IF EXISTS` names | [`FULL_SCHEMA.sql`](../../supabase/reference/FULL_SCHEMA.sql), [`20260621`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L59-L95), [`BATCH_1_1A`](../../docs/roadmap/BATCH_1_1A_PREFLIGHT_REPORT.md#L58-L72) |
| **F-04** | **High** | 10 | Zero rollback/down SQL scripts and unverified Supabase backup/PITR status alongside destructive grant/policy/constraint drops | [`20260621`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L13-L105), `20260623`, [`BATCH_1_1A`](../../docs/roadmap/BATCH_1_1A_PREFLIGHT_REPORT.md#L200-L210) |
| **F-05** | **Medium** | 2 | Legacy `"Users can insert their own profiles"` RLS `INSERT` policy is **never dropped**; `verify_migrations.sql` explicitly excludes `profiles` (`tablename <> 'profiles'`), masking the defect in CI | [`20260618`](../../supabase/migrations/20260618000000_init_schema.sql#L127-L128), [`FULL_SCHEMA.sql`](../../supabase/reference/FULL_SCHEMA.sql#L148-L150), [`verify_migrations.sql`](../../tests/db/verify_migrations.sql#L80-L87) |
| **F-06** | **Medium** | 1, 5 | Unfiltered `idx_test_results_leaderboard` in [`FULL_SCHEMA.sql`](../../supabase/reference/FULL_SCHEMA.sql#L236) makes [`20260621`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L33-L35) silently no-op and would **fail** `TX 1` in [`verify_migrations.sql`](../../tests/db/verify_migrations.sql#L240-L252); CI never tests the `FULL_SCHEMA.sql` upgrade path | [`FULL_SCHEMA.sql`](../../supabase/reference/FULL_SCHEMA.sql#L236), [`run-pg-verification.sh`](../../tests/db/run-pg-verification.sh#L72-L84) |
| **F-07** | **Medium** | 2, 3 | Incomplete function privilege cleanup (`20260621` revokes only `handle_new_user()`; `is_reserved_username` remains exposed to `PUBLIC`/`anon`/`authenticated`); `supabase_shim.sql` masks hosted Supabase `PUBLIC` default `EXECUTE` grants | [`FULL_SCHEMA.sql`](../../supabase/reference/FULL_SCHEMA.sql#L295), [`20260621`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L40), `20260624`, [`supabase_shim.sql`](../../tests/db/supabase_shim.sql#L87-L88) |
| **F-08** | **Medium** | 1, 5, 7 | Creating `leaderboard_view` immediately elevates unmoderated prod outliers (`94 WPM` `3.974s` quote #1, `226 raw_wpm`); latent `is_ranked` omission in PB/profile/streak queries; lowercase mismatch risk in [`lib/data/profile.ts`](../../lib/data/profile.ts#L42) | [`BATCH_1_1A`](../../docs/roadmap/BATCH_1_1A_PREFLIGHT_REPORT.md#L135-L196), `20260624`, [`lib/data/profile.ts`](../../lib/data/profile.ts#L42,L60) |
| **F-09** | **Low** | 6 | No `SET lock_timeout`, non-`CONCURRENTLY` index creation (`ShareLock`), and `DROP VIEW IF EXISTS` + `CREATE OR REPLACE VIEW` must execute atomically in one transaction | [`20260621`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L8-L35,L105-L106) |
| **F-10** | **Low** | 2, 5 | `20260622` schema (`user_progression`, `user_lesson_progress`, `challenge_attempts`) has zero callers; `challenge_attempts` leaks rows via `USING (true)` even after parent `challenge_links` expires | [`20260622`](../../supabase/migrations/20260622000000_learning_and_competitive_ecosystem.sql#L31-L64), [`20260621`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L88-L90) |
| **F-11** | **Low** | 7 | Orphan recovery path (`v_has_replay = FALSE`) does not re-verify telemetry equality if replay row was never written (mitigated only when API enforces server verification) | `20260624` |
| **F-12** | **Info** | 9, CI | Mutable CI tags (`postgres:16-alpine`, `@v4`, live `apt-get`), Node 20 runner deprecation warning in CI log, and stale "0 runs / untracked" statements inside PR #2 docs [`PHASE_1D`](../../docs/roadmap/PHASE_1D_DATABASE_READINESS_REPORT.md#L18,L128) & [`PHASE_1E`](../../docs/roadmap/PHASE_1E_VERIFICATION_HARNESS_REPORT.md#L13,L109) | [`ci-postgres-verification.yml`](../../.github/workflows/ci-postgres-verification.yml#L33,L48-L53) |

---

## Detailed Review Across All 10 Priorities

### Priority 1 — Production Schema Assumptions vs. Verified Divergence (`gbovkejymfeiqgverzfr`)

**Evidence Base Split (Strictly Enforced):**
- **Empirically Verified via `anon` PostgREST Probes ([`BATCH_1_1A`](../../docs/roadmap/BATCH_1_1A_PREFLIGHT_REPORT.md#L50-L72)):** All 9 base tables exist (`16` profiles with `15/16` `user_<8hex>` handles and `theme='dark', font_family='ibm-plex-mono'`; `170` `test_results` including `6` `user_id IS NULL` `__debug_test__` rows; `164` `replays`; `16` `streaks` including `4/10` active users at `current_streak = 0`; `11` custom `achievements` matching [`20260621:188-200`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L188-L200); `4` `user_achievements`; `0` daily/challenge rows); **`public.leaderboard_view` does NOT exist (`PGRST205`)**.
- **Unverified Catalog State (Blind Spots Requiring Owner SQL Editor Execution):** Live `pg_policies`, `information_schema.role_table_grants`, `pg_indexes`, `pg_proc` (`handle_new_user()` + any custom SQL Editor RPCs), `pg_publication_tables`, `information_schema.columns`/`table_constraints`, and `supabase_migrations.schema_migrations`.

1. **[`High`, `F-03`] Non-Timestamped `FULL_SCHEMA.sql` in `supabase/migrations/` & Unverified `schema_migrations` History:**
   - [`supabase/migrations/FULL_SCHEMA.sql`](../../supabase/reference/FULL_SCHEMA.sql) sits directly alongside timestamped migrations (`20260618`–`20260624`) on `main` and PR #2. Live production already proves **out-of-band SQL Editor changes** (live `achievements` has `11` custom rows, whereas `20260618`–`20260620` insert `0` and `FULL_SCHEMA.sql:276-285` inserts `8`, yet `leaderboard_view` in `FULL_SCHEMA.sql:320` and `20260620:9` is missing).
   - If `supabase db push` or automated migration tooling runs against `gbovkejymfeiqgverzfr` without first verifying `supabase_migrations.schema_migrations` (`20260618` lacks `IF NOT EXISTS` on `CREATE TABLE` at [`20260618:8-107`](../../supabase/migrations/20260618000000_init_schema.sql#L8-L107)), migration runners risk crashing immediately on `relation "profiles" already exists`.

2. **[`Medium`, `F-06`] `idx_test_results_leaderboard` Silent No-Op Against `FULL_SCHEMA.sql` Baseline:**
   - [`FULL_SCHEMA.sql:236`](../../supabase/reference/FULL_SCHEMA.sql#L236) defines an **unfiltered** index named `idx_test_results_leaderboard ON public.test_results(mode, duration, is_invalidated, wpm DESC)`.
   - [`20260621:33-35`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L33-L35) uses `CREATE INDEX IF NOT EXISTS idx_test_results_leaderboard ... WHERE user_id IS NOT NULL AND is_invalidated = FALSE;`.
   - If production executed [`FULL_SCHEMA.sql`](../../supabase/reference/FULL_SCHEMA.sql), PostgreSQL treats `20260621:33-35` as a **silent no-op**, retaining the unfiltered index (`indpred IS NULL`). Furthermore, [`verify_migrations.sql:240-252`](../../tests/db/verify_migrations.sql#L240-L252) explicitly **fails** if `idx_test_results_leaderboard` lacks `indpred` predicates (`user_id IS NOT NULL` / `is_invalidated`). CI ([`run-pg-verification.sh:72-84`](../../tests/db/run-pg-verification.sh#L72-L84)) never tests upgrading from [`FULL_SCHEMA.sql`](../../supabase/reference/FULL_SCHEMA.sql), hiding this mismatch.

3. **Verified Clean Schema Assumptions (`20260621`–`20260624`):**
   - `20260621:13-15,24` & `20260623:12-37` safely handle both `CONSTRAINT ... UNIQUE` and standalone `INDEX` (`test_results_client_run_id_key`) dynamically via `pg_constraint` lookup + `DROP INDEX IF EXISTS`.
   - `20260621:16-18` safely drops `DEFAULT` and `NOT NULL` on `streaks.last_active_date` (no incompatible data exists — preflight confirmed `0` nulls and `0` future dates).
   - `20260621:20-21` changes `profiles.font_family` default from `'ibm-plex-mono'` (`20260618:14`) to `'jetbrains-mono'`; existing `16` prod rows remain unaffected, and `handle_new_user()` writes `'jetbrains-mono'` explicitly (`20260624:177,202`).
   - `20260621:188-200` (`ON CONFLICT (code) DO NOTHING`) safely reconciles all `11` production achievement codes without overwriting live badges or breaking `4` `user_achievements` FKs.
   - `20260621:202-213` safely guards `ALTER PUBLICATION supabase_realtime ADD TABLE public.test_results` via `pg_publication_tables`.

---

### Priority 2 — `GRANT`, `REVOKE`, RLS Policies, Triggers & `SECURITY DEFINER` Audit

1. **[`Medium`, `F-05`] Undropped Legacy `profiles` `INSERT` RLS Policy Masked by CI Exception:**
   - [`20260618:127-128`](../../supabase/migrations/20260618000000_init_schema.sql#L127-L128) and [`FULL_SCHEMA.sql:148-150`](../../supabase/reference/FULL_SCHEMA.sql#L148-L150) create `"Users can insert their own profiles" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id)`.
   - **Neither `20260621` nor `20260624` drops this policy.** It persists in `pg_policies` after all 4 migrations run.
   - Why CI (`42894187120`) missed it: [`verify_migrations.sql:80-87`](../../tests/db/verify_migrations.sql#L80-L87) checks `WHERE schemaname = 'public' AND tablename <> 'profiles' AND cmd <> 'SELECT'` — explicitly skipping `profiles`. Currently mitigated only by table-level `REVOKE ALL` (`20260621:38`), leaving a latent RLS defense-in-depth hole if any future script re-grants `INSERT` on `profiles` (for example, another SQL Editor `GRANT ALL`).

2. **[`High`, `F-03`] Unknown Custom-Named RLS Policies Survive Fixed `DROP POLICY IF EXISTS`:**
   - [`20260621:59-95`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L59-L95) only drops known policy names (`20260618`/`20260619`/`FULL_SCHEMA.sql`). Because live `gbovkejymfeiqgverzfr` has uninspected out-of-band SQL Editor modifications, any custom-named permissive `SELECT` policy on `replays` or `test_results` (which retain `GRANT SELECT TO anon, authenticated` at `20260621:44-54`) would remain active via PostgreSQL's permissive `OR` policy combination, silently keeping `164` `replays` or invalidated `test_results` exposed until `pg_policies` is audited.

3. **[`Medium`, `F-07`] Incomplete Function `REVOKE` & Publicly Exposed `is_reserved_username`:**
   - [`FULL_SCHEMA.sql:295`](../../supabase/reference/FULL_SCHEMA.sql#L295) executed `GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role`. [`20260621:40`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L40) revokes `EXECUTE` **only** from `public.handle_new_user()`. Any other SQL-Editor-created helper/trigger function in prod remains callable via PostgREST `/rest/v1/rpc/*`.
   - `20260624:25-59` creates `public.is_reserved_username(TEXT)` (`IMMUTABLE` SQL, not `SECURITY DEFINER`) **without** revoking `EXECUTE` from `PUBLIC, anon, authenticated`. While non-sensitive functionally, exposing internal reserved-handle policy via `/rest/v1/rpc/is_reserved_username` is unnecessary surface.

4. **[`Low`, `F-10`] `20260622` Policies (`challenge_attempts` Lifetime Exposure & Orphaned Tables):**
   - [`20260622:62-64`](../../supabase/migrations/20260622000000_learning_and_competitive_ecosystem.sql#L62-L64) creates `"Challenge attempts readable by participants or public" ... FOR SELECT USING (true)`. Even though [`20260621:88-90`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L88-L90) hides expired `challenge_links`, expired attempts in `challenge_attempts` remain publicly readable forever without expiry or participant scoping. None of `user_progression`, `user_lesson_progress`, or `challenge_attempts` are queried or mutated anywhere in `origin/main` or local Phase 1–5 yet.

5. **Verified Final-State Controls (At `20260624` Only):**
   - `20260624:15-23` restricts `authenticated` on `profiles` to `UPDATE (display_name, avatar_url, theme, font_family, updated_at)` (`username` excluded).
   - `20260624:61-110` enforces `trg_enforce_profile_username_integrity` (`BEFORE INSERT OR UPDATE` on `profiles`): returns `NEW` early if `username` is unchanged (protecting legacy `display_name`/`theme` updates), enforces `^[a-z0-9_]{3,24}$`, blocks 24 reserved names (`23514`), blocks `^user_[0-9a-f]{8}(_[0-9a-f]{4,8})?$` placeholder writes on `UPDATE` (`23514`), and enforces one-time username lock (`42501 USERNAME_LOCKED`).
   - [`20260621:106-128`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L106-L128) configures `public.leaderboard_view` with `WITH (security_invoker = true)` + `WHERE tr.is_invalidated = FALSE AND tr.user_id IS NOT NULL AND tr.is_ranked = TRUE`, proven at runtime by [`verify_migrations.sql` `TX 12`](../../tests/db/verify_migrations.sql#L1139-L1169).

---

### Priority 3 — Function Ownership, `EXECUTE` Permissions & `search_path` Safety

| Function | Migration / Lines | `SECURITY` Mode | `search_path` Config | Final `EXECUTE` ACL (CI `TX 1` vs. Hosted Supabase) | Safety Assessment |
|---|---|---|---|---|---|
| `public.handle_new_user()` | `20260624:113-215` | `SECURITY DEFINER` | `SET search_path = public` | `REVOKE ALL ... FROM PUBLIC, anon, authenticated` (`L215`) | Safe: every table reference is `public.*` qualified; uses built-in `pg_catalog` (`gen_random_uuid()`, `md5()`, `clock_timestamp()`, `regexp_replace()`), so `uuid-ossp`/`pg_trgm` schema placement does not break it. Owner check still recommended in prod (must be `postgres`). |
| `public.submit_verified_result(...)` | `20260624:218-622` | `SECURITY DEFINER` | `SET search_path = public` | `REVOKE ALL ... FROM PUBLIC, anon, authenticated`; `GRANT EXECUTE ... TO service_role` (`L616-622`) | Safe in final `20260624` form: all queries explicitly qualify `public.*`; validates non-null `p_user_id` & non-empty telemetry array. |
| `public.enforce_profile_username_integrity()` | `20260624:61-104` | `SECURITY INVOKER` | `SET search_path = public` | `REVOKE ALL ... FROM PUBLIC, anon, authenticated` (`L104`) | Safe: calls `public.is_reserved_username(v_clean)` explicitly; PostgreSQL evaluates trigger `EXECUTE` only at trigger creation time. |
| `public.is_reserved_username(TEXT)` | `20260624:25-59` | `SECURITY INVOKER` (`IMMUTABLE` SQL) | `SET search_path = public` | **Not revoked from `PUBLIC, anon, authenticated`** | **Minor/Medium Defect (`F-07`):** Default PostgreSQL `PUBLIC` `EXECUTE` (and hosted Supabase `anon`/`authenticated` default function grants) leave it exposed via PostgREST RPC. |

**CI Shim vs. Hosted Supabase Privilege Gap (`F-07`):**
- In [`tests/db/supabase_shim.sql:87-88`](../../tests/db/supabase_shim.sql#L87-L88), `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL PRIVILEGES ON FUNCTIONS TO service_role;` omits `anon` and `authenticated`, and `postgres` in CI is full `rolsuper = TRUE` whereas hosted Supabase runs `postgres` with `BYPASSRLS` + object ownership without `rolsuper` (functional behavior matches only when all `public.*` tables/functions are owned by `postgres`).
- [`verify_migrations.sql:148-183`](../../tests/db/verify_migrations.sql#L148-L183) only inspects `submit_verified_result`, `handle_new_user`, and `enforce_profile_username_integrity` — failing to catch `is_reserved_username` or any extra `public` routine callable by `anon`/`authenticated`.
- *Best-practice note:* `SET search_path = public` omits trailing `, pg_temp`; safe under strict `public.*` table qualification used here (`pg_catalog` is still searched first automatically unless `pg_temp` is explicitly prepended), though explicit `SET search_path = public, pg_catalog` is even cleaner.

---

### Priority 4 — Temporary Security Exposure Between Migrations (`20260621` -> `20260624`)

[`High`, `F-02`] Migrations `20260621` through `20260624` were left as four separate chronological files preserving intermediate Phase 1B bugs (`PHASE_1B` -> `PHASE_1C`) rather than consolidating unapplied DDL:

| Stage Applied | Duration / Risk if Interrupted | Concrete Intermediate Exposure or Outage |
|---|---|---|
| **After `20260621` (before `20260623` & `20260624`)** | Until `20260624` runs | 1. **Direct PostgREST Username Hijack (`SEC`):** [`20260621:56-57,96-102`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L56-L57,L96-L102) grants `authenticated` `UPDATE (..., username, ...)` with only regex `username ~ '^[a-z0-9_]{3,24}$'` — allowing any logged-in user via browser Supabase SDK/REST to claim reserved handles (`admin`, `typrox`), revert to `user_<8hex>`, or rename an already-locked handle until `20260624:15-110` closes it.<br>2. **Signup Collision Crash Risk:** [`20260621:131-185`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L131-L185) handles only 1 username collision without reserved filtering or `WHEN unique_violation`.<br>3. **Total Score-Submission Outage:** Client inserts are revoked while `submit_verified_result` does not exist yet. |
| **After `20260622` (before `20260624`)** | Same + new schema | Same `profiles.username` bypass remains live. |
| **After `20260623` (before `20260624`)** | Until `20260624` runs | Installs **`submit_verified_result` v1** (`20260623:44-360`), which:<br>1. Permits empty telemetry `'[]'::jsonb` (`L56`, no guard).<br>2. Returns and celebrates **`is_invalidated = TRUE`** runs on `client_run_id` retries (`L89-100`).<br>3. Silently returns the old run on mismatched payloads instead of raising `CLIENT_RUN_ID_CONFLICT` (`L89-100,178-195`).<br>4. Unconditionally executes streak advancement & achievement reporting on **pure duplicate retries** and can overwrite future `last_active_date` backwards (`L232-326`). |

CI ([`verify_migrations.sql`](../../tests/db/verify_migrations.sql)) asserts **only** the final post-`20260624` catalog/runtime state; it never verifies intermediate checkpoints, so any gap or partial application across `20260621`..`20260624` leaves production exposed or broken.

---

### Priority 5 — Existing-Data Compatibility, Duplicates & Unique Indexes

1. **Historical Duplicate Safety (`client_run_id` Partial Index — Safe):**
   - Preflight confirmed `15` duplicate submission groups (`34` rows / `19` excess copies out of `164` non-debug runs) plus `6` `__debug_test__` (`user_id IS NULL`) rows (`BATCH_1_1A:139-197`).
   - [`20260621:9,26-28`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L9,L26-L28) & `20260623:39-41` backfill `client_run_id = NULL` and create `CREATE UNIQUE INDEX IF NOT EXISTS idx_test_results_user_client_run_id ON public.test_results(user_id, client_run_id) WHERE user_id IS NOT NULL AND client_run_id IS NOT NULL;`. Because `WHERE client_run_id IS NOT NULL` excludes all `170` existing rows, unique-index creation **will not fail** on historical duplicates.

2. **[`Medium`, `F-08`] Immediate Leaderboard Exposure of Unmoderated Production Outliers (`170` Rows Backfilled `is_ranked = TRUE`):**
   - [`20260621:11`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L11) adds `is_ranked BOOLEAN DEFAULT TRUE NOT NULL`, so all existing runs (`is_invalidated = FALSE`) backfill as ranked.
   - Creating `leaderboard_view` immediately promotes verified production anomalies documented in [`BATCH_1_1A:150-175`](../../docs/roadmap/BATCH_1_1A_PREFLIGHT_REPORT.md#L150-L175), including the global production top speed (`e23c78dc`: `94 WPM` `quotes` `30s` completed in **`3,974ms`**), `260ffffc` (`200 raw_wpm`, `1` keystroke / `0ms` span), and `875a89f8`/`594a6494` (`226 raw_wpm`, `543` errors, `4%` accuracy), unless moderated via `is_invalidated = TRUE` (or deletion of the `6` `__debug_test__` `user_id IS NULL` rows) at cutover.
   - *Verified positive protection:* The `6` `__debug_test__` (`user_id IS NULL`) rows become invisible to `anon`/`authenticated` immediately under [`20260621:63-65`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L63-L65) and [`leaderboard_view:124`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L124).

3. **Unfiltered `is_ranked` in Personal Best / Profile Stats & Lowercase Lookup Caveat (`Medium`, `F-08`):**
   - `20260624:456-466` (`v_prev_best_wpm`) and `20260624:546-550` (`v_total_tests`), plus [`lib/data/profile.ts:60-65`](../../lib/data/profile.ts#L60-L65), omit `.eq('is_ranked', true)` / `AND tr.is_ranked = TRUE` (safe today only because all persisted API rows use `is_ranked DEFAULT TRUE`, latent defect once `learn`/unranked rows persist to `test_results`).
   - [`lib/data/profile.ts:42,50`](../../lib/data/profile.ts#L42-L50) lowercases `.eq('username', cleanUsername)` while [`20260618:10`](../../supabase/migrations/20260618000000_init_schema.sql#L10) allowed mixed-case usernames prior to `20260624:74-99`. If the `1` non-`user_<hex>` custom handle in live prod contains uppercase letters, `/u/[username]` will return `404` until normalized.

4. **Unfiltered Index Collision (`idx_test_results_leaderboard`):** Covered under Priority 1 (`F-06`).

---

### Priority 6 — Table Locks, Downtime Risk & Execution Ordering

1. **[`Low`, `F-09`] Missing `lock_timeout` & Blocking DDL Locks:**
   - [`20260621`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql) executes `ALTER TABLE public.test_results`, `ALTER TABLE public.streaks`, `ALTER TABLE public.profiles`, `REVOKE ALL ON ALL TABLES`, `DROP POLICY` across 6 tables, and `DROP VIEW` / `CREATE OR REPLACE VIEW`, acquiring **`AccessExclusiveLock`** on those tables; [`20260621:26-35`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L26-L35) & `20260623:39-41` create indexes without `CONCURRENTLY` (`ShareLock`). Neither defines `SET lock_timeout`.
   - At current production row volume (`16`–`170` rows), index build CPU time is single-digit milliseconds, but an open analytical query or Realtime transaction can still queue behind `AccessExclusiveLock` and block concurrent `SELECT` traffic across the site unless `SET lock_timeout = '5s';` is used inside a maintenance window.

2. **Transient `PGRST205` Window Around `DROP VIEW` (`F-09`):**
   - [`20260621:105-106`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L105-L106) runs `DROP VIEW IF EXISTS public.leaderboard_view; CREATE OR REPLACE VIEW ...`. If pasted non-transactionally in SQL Editor, concurrent queries see `PGRST205` between statements; wrapping in a single `BEGIN; ... COMMIT;` keeps view replacement atomic (`leaderboard_view` changes column layout from `20260620` by appending `username, display_name, avatar_url`, which is why `DROP VIEW` was required).

3. **[`Critical`, `F-01`] Cutover Ordering Between DB DDL and App Deploy:**
   - Executing `20260621`–`20260624` before deploying the local Phase 1–5 application immediately breaks live `origin/main` writers (`/api/results` `42501`, client DML `42501`) and breaks `/api/leaderboard` (`PGRST200` `500` — see Priority 9).
   - Conversely, deploying the Phase 1–5 app before `20260621`–`20260624` requires `SUPABASE_SERVICE_ROLE_KEY` provisioned (otherwise routes fail closed with `503 ADMIN_CONFIG_MISSING` per [`lib/supabase/admin.ts:120-122`](../../lib/supabase/admin.ts#L120-L122)) and hits the legacy fallback path (`findExistingResultForRun` in [`lib/typing/persistence.ts:862`](../../lib/typing/persistence.ts#L862)) while `replays` remain readable until `20260621` applies. Safe rollout demands a maintenance freeze: **env secrets -> atomic `20260621..20260624` DDL -> immediate Phase 1–5 app deploy + schema cache reload -> smoke tests**.

---

### Priority 7 — Idempotency & Streak Recovery Behavior Against Existing Records

1. **Day-1 Stuck Streak Self-Healing (`4/10` Active Users):**
   - Preflight verified `4/10` active typists in prod remain stuck at `current_streak = 0` with non-null `last_active_date` (`BATCH_1_1A:57,71`).
   - `20260624:512-525` handles `COALESCE(v_streak_row.current_streak, 0) <= 0 OR v_streak_row.last_active_date IS NULL`, setting `current_streak = 1`, updating `longest_streak = GREATEST(1, COALESCE(v_streak_row.longest_streak, 0))`, and preserving any future `last_active_date` skew cleanly (`CASE WHEN ... > v_activity_date`).

2. **Signature Deduplication & Partial-Orphan Recovery Against `170` Legacy Rows:**
   - `20260624:308-354` requires `(user_id, seed, mode, duration, wpm, accuracy)` plus **exact `replay_telemetry = p_telemetry`** (`L331`) or `< 15 minute` `created_at` orphan match (`L332-339`) (`v_recovery_cutoff := now() - interval '15 minutes'`). Because all historical `170` rows are from June–September 2026 (`> 15m` old), the `6` replay-less `__debug_test__` rows (`user_id IS NULL`, outside `p_user_id` scope anyway) and old rows cannot falsely trigger orphan recovery.
   - **[`Low`, `F-11`] Telemetry Parity Gap During Partial-Orphan Retry:** When `v_has_replay = FALSE` in `20260624:288-301,410-423`, `CLIENT_RUN_ID_CONFLICT` checks `mode`, `duration`, and `seed`, skipping replay telemetry comparison until a `replays` row exists. Low risk today because `POST /api/results` and `/api/results/sync` run `verifyAndScoreSession` on server inputs before calling the RPC, and `client_run_id` retries serialize on `SELECT ... FOR UPDATE` (`L435`).

---

### Priority 8 — Partial / Interrupted Migration Risks

- **SQL Editor Auto-Commit Risk (`F-02`, `F-03`, `F-04`):** Neither `20260621`, `20260622`, `20260623`, nor `20260624` wraps its body in explicit `BEGIN; ... COMMIT;`. While Supabase CLI executes each migration file inside a transaction, running via Supabase Dashboard SQL Editor or an interrupted connection can halt mid-file, leaving tables partially altered (`REVOKE ALL` executed before `GRANT SELECT`, `DROP VIEW` committed without `CREATE VIEW`, or `20260623` `submit_verified_result` v1 left active without `20260624`).
- **Mid-`20260618..20260624` Restart Risk:** `20260621` mixes `CREATE INDEX IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `ALTER COLUMN DROP DEFAULT/NOT NULL` (reversible/re-runnable) with `CREATE POLICY` (non-idempotent unless preceded by `DROP POLICY IF EXISTS`, which lines `63`, `70`, `88`, `96` lack!). Thus re-running `20260621` after a mid-file failure at line `64+` will crash on `policy "... " already exists`. Only `20260622` and `20260624` consistently guard policies/triggers with `DROP ... IF EXISTS`.

---

### Priority 9 — Deployment, Automation & Application Compatibility Risk After Merging PR #2

#### 9A. Verified GitHub Repository & Platform Integration State (`Rudra4451/practice`)
Checked directly via `gh api`:
- **Branch Protection (`main`):** **None (`HTTP 404`: `"Branch not protected"`)** — anyone with write access can merge without required reviews or status checks.
- **GitHub Actions Workflows:** Two active workflows — [`PostgreSQL 16 Migration Verification`](../../.github/workflows/ci-postgres-verification.yml) (`id: 413770609`, `permissions: contents: read`, triggers `push`, `pull_request` on `main`, `workflow_dispatch`) and `pages-build-deployment` (`id: 294945041`). **Zero Supabase migration deploy Actions exist.**
- **CI Execution Evidence (`19e8873`):** Both [`42894187120`](https://github.com/Rudra4451/practice/actions/runs/42894187120) (`pull_request`) and [`42894175929`](https://github.com/Rudra4451/practice/actions/runs/42894175929) (`push`) completed `success` on `PostgreSQL 16.15` (`ALL_MIGRATION_INVARIANTS_PASSED`; `Deterministic contention proven via pg_stat_activity Lock wait_event='transactionid'`). Expected benign container notice (`WARNING: wal_level is insufficient to publish logical changes` on `CREATE PUBLICATION`) and Node 20 deprecation notice appeared.
- **GitHub Webhooks vs. GitHub Apps (`Vercel` + Unverified `Supabase` Integration):** `repos/Rudra4451/practice/hooks` returned `[]`, **however** `repos/Rudra4451/practice/deployments` proves `vercel[bot]` actively builds via **GitHub App** (including Preview `7693247738` for PR #2 commit `19e8873`). Because GitHub Apps bypass `/hooks`:
  1. **Merging PR #2 to `main` WILL trigger a `vercel[bot]` Production deployment of `main`** (still running old `origin/main` app code + the 12 DB/doc files).
  2. **Whether a Supabase GitHub Integration App** (automatic `supabase/migrations/` push or Branching sync configured in the Supabase Dashboard) is installed on `Rudra4451/practice` **cannot be observed from public `/hooks` or unprivileged `gh api`** — if enabled, merging PR #2 to `main` could immediately attempt automated `supabase/migrations/` execution against `gbovkejymfeiqgverzfr` in broken order or against stale `origin/main` callers.

#### 9B. Caller Compatibility Matrix: Live `origin/main` vs. Uncommitted Phase 1–5 Codebase

| Database Target / Feature | Live `origin/main` (`fba1d80`) Behavior After `20260621`–`20260624` | Local Phase 1–5 (Uncommitted) Behavior After `20260621`–`20260624` | Verdict |
|---|---|---|---|
| **`public.leaderboard_view` query** | **[`origin/main:app/api/leaderboard/route.ts`](https://github.com/Rudra4451/practice/blob/fba1d80/app/api/leaderboard/route.ts) (`L58-61,82-90`):** Queries `leaderboard_view` using nested PostgREST join `profiles(username, display_name, avatar_url)`. Only falls back on `42P01` / `'does not exist'` / `'schema cache'` / `'Could not find the table'`, **NOT `PGRST200`** (`Could not find a relationship`). Once `leaderboard_view` exists, a `PGRST200` relationship error returns **HTTP `500` permanently**, AND `20260621:118-120` flattens `username, display_name, avatar_url` instead of nesting `profiles`! | **[`lib/data/leaderboard.ts:66-140`](../../lib/data/leaderboard.ts#L66-L140):** Selects flat columns `(id, user_id, wpm, accuracy, consistency, mode, duration, created_at, username, display_name, avatar_url)` matching `20260621:108-120`, keeping `PGRST205` fallback until cutover. | **`origin/main` BREAKS; Phase 1–5 COMPATIBLE** |
| **Score / Replay / Streak / Achievement writes** | **`origin/main:app/api/results/route.ts` (`L86-185`):** Directly inserts/updates `test_results`, `replays`, `streaks`, `user_achievements` via SSR user cookie (`authenticated`). **100% fails with `42501 insufficient_privilege`.** | **[`app/api/results/route.ts:57-61,168-172`](../../app/api/results/route.ts#L57-L61,L168-L172)** & **[`lib/typing/persistence.ts:789-860`](../../lib/typing/persistence.ts#L789-L860):** Calls `submit_verified_result(...)` with exact 13 params using `resolvePrivilegedWriteClient` (`service_role`; fails closed `503 ADMIN_CONFIG_MISSING` if secret omitted per [`lib/supabase/admin.ts:120-122`](../../lib/supabase/admin.ts#L120-L122)). | **`origin/main` BREAKS; Phase 1–5 COMPATIBLE** (requires `SUPABASE_SERVICE_ROLE_KEY`) |
| **Profile & Username updates** | **`origin/main:components/auth/username-modal.tsx` (`L87-95`):** Direct browser `supabase.from('profiles').update({ username, display_name })`. **`42501` error** once `20260624:15-17` revokes `username`. `origin/main:app/api/profile/route.ts` (`L24-32`) updates only `display_name` (still works). | **[`app/api/profile/route.ts:80-150`](../../app/api/profile/route.ts#L80-L150):** Non-username edits use SSR `authenticated`; `username` onboarding uses `service_role` admin client and maps `23505`/`42501`/`23514` cleanly. | **`origin/main` Modal BREAKS; Phase 1–5 COMPATIBLE** |
| **Client direct `test_results`, `streaks`, `challenge_links` DML** | **`origin/main:app/dashboard/page.tsx` (`L327`), `components/navbar.tsx` (`L112,130`), `components/typing/result-screen.tsx` (`L116`):** Browser `INSERT`s into `test_results`, `profiles`/`streaks`, and `challenge_links`. **All fail `42501`.** | **[`app/dashboard/page.tsx:332,363`](../../app/dashboard/page.tsx#L332-L370)**, **[`app/api/results/sync/route.ts`](../../app/api/results/sync/route.ts)**, **[`app/api/challenges/route.ts`](../../app/api/challenges/route.ts):** All writes routed via server API + `service_role`. Client queries are strictly `SELECT`. | **`origin/main` BREAKS; Phase 1–5 COMPATIBLE** |
| **`/api/debug/supabase`** | **`origin/main:app/api/debug/supabase/route.ts` (`L96-122`):** Still deployed on `main`, attempts `__debug_test__` inserts (blocked at DB by `20260621`, but table-count reconnaissance remains live). | Route deleted completely in Phase 1. | **Phase 1–5 REMOVES RISK** |
| **`replays` Realtime & Public Queries** | `app/dashboard/page.tsx`, `/u/[username]`, `/challenge/[id]` `SELECT` public rows cleanly (replays aren't read on `/u/` or `/challenge/`). | [`lib/data/profile.ts:42,60`](../../lib/data/profile.ts#L42,L60), [`lib/data/challenge.ts:39-44`](../../lib/data/challenge.ts#L39-L44): Strictly `SELECT` aligned with new RLS (note minor `.toLowerCase()` & missing `is_ranked = true` items in `F-08`). | **COMPATIBLE** (watch `F-08`) |

---

### Priority 10 — Missing Rollback & Recovery Procedures

[`High`, `F-04`]
- **No Down/Reverse SQL Exists:** Neither PR #2 nor `main` contains reverse migrations. Executing `20260621`–`20260624` mutates grants (`REVOKE ALL`), drops 12 policy names (`DROP POLICY IF EXISTS`), drops/recreates `leaderboard_view`, overwrites `handle_new_user()`, drops `streaks.last_active_date` `NOT NULL` + `DEFAULT CURRENT_DATE`, and drops any single-column `client_run_id` unique constraint.
- **Unverified Production Backup:** As documented in [`BATCH_1_1A:200-210`](../../docs/roadmap/BATCH_1_1A_PREFLIGHT_REPORT.md#L200-L210), Supabase Free-tier projects exclude automated daily backups and PITR, and no verified `pg_dump` or Dashboard snapshot exists yet. Rolling back an interrupted or problematic DDL cutover cleanly is **impossible** without first capturing live `pg_policies`, `role_table_grants`, `pg_indexes`, `handle_new_user()`, and a logical `pg_dump`/snapshot before running DDL.

---

## CI Verification Caveats (`42894187120` / `42894175929`)

While PostgreSQL `16.15` CI passed reliably and caught genuine concurrency via `pg_stat_activity` `Lock wait_event='transactionid'`, reviewers must recognize what CI **did not** verify:
1. [`verify_migrations.sql:80-87`](../../tests/db/verify_migrations.sql#L80-L87) excludes `profiles`, missing legacy policy `"Users can insert their own profiles"` (`F-05`).
2. [`verify_migrations.sql:148-183`](../../tests/db/verify_migrations.sql#L148-L183) checks only 3 named functions, missing `public.is_reserved_username` (`F-07`), and [`supabase_shim.sql:87-88`](../../tests/db/supabase_shim.sql#L87-L88) omits hosted Supabase default `PUBLIC`/`anon`/`authenticated` function grants (`F-07`).
3. [`run-pg-verification.sh:72-84`](../../tests/db/run-pg-verification.sh#L72-L84) tests only `20260618 -> 20260624` on an empty database, never testing [`FULL_SCHEMA.sql`](../../supabase/reference/FULL_SCHEMA.sql)` -> 20260621..20260624` where `TX 1` ([`L240-252`](../../tests/db/verify_migrations.sql#L240-L252)) would fail on `idx_test_results_leaderboard` (`F-06`).
4. Never tests intermediate checkpoints after `20260621` or `20260623` alone (`F-02`).

---

## Required Fixes to Unblock PR #2 Merge

Complete **all** items below on `ci/postgres-16-verification` (or in a coordinated release PR) before merging to `main`:

1. **Close SQL & RLS/ACL Gaps in a Hardened Migration Update (e.g., `20260625` or Consolidated Unapplied Hardening):**
   - `DROP POLICY IF EXISTS "Users can insert their own profiles" ON public.profiles;` (`F-05`).
   - Reconcile `idx_test_results_leaderboard` idempotently (`DROP INDEX IF EXISTS public.idx_test_results_leaderboard;` before `CREATE INDEX ... WHERE user_id IS NOT NULL AND is_invalidated = FALSE;`) so `FULL_SCHEMA.sql`-bootstrapped databases upgrade cleanly (`F-06`).
   - `REVOKE ALL ON FUNCTION public.is_reserved_username(TEXT) FROM PUBLIC, anon, authenticated;` (`F-07`).
   - Wrap policy drops defensively (`DROP POLICY IF EXISTS` before every `CREATE POLICY` in `20260621`) and add `SET lock_timeout = '5s';` (`F-08`/`F-09` resilience).
   - Add expiry/participant restriction or withhold `anon`/`authenticated` `SELECT` on `challenge_attempts` until callers exist (`F-10`).
2. **Tighten [`verify_migrations.sql`](../../tests/db/verify_migrations.sql) & CI Harness:**
   - Check ALL policies (`cmd <> 'SELECT'` OR non-hardened policies) **including `public.profiles`** (verify `"Users can insert their own profiles"` does not exist) (`F-05`).
   - Query `pg_proc` dynamically across `pronamespace = 'public'::regnamespace` for `prokind IN ('f', 'p')` to verify zero unexpected `public` functions are `EXECUTE`-granted to `anon`/`authenticated` (allowing only `extension`-owned functions if any) (`F-07`).
   - Add a second CI matrix/step verifying the **`FULL_SCHEMA.sql` -> `20260621..20260624`** upgrade path against [`verify_migrations.sql`](../../tests/db/verify_migrations.sql) (`F-06`).
3. **Eliminate `FULL_SCHEMA.sql` Migration-Directory Collision & Split-Brain Risk (`F-01`, `F-02`, `F-03`):**
   - Move [`supabase/migrations/FULL_SCHEMA.sql`](../../supabase/reference/FULL_SCHEMA.sql) out of `supabase/migrations/` (e.g., `supabase/reference/FULL_SCHEMA.sql`) so CLI migration runners never parse or choke on it.
   - Verify in Supabase Dashboard that **no Supabase GitHub auto-deploy integration** is linked to `main`, **or** hold merging `20260621`–`20260624` into `main` until PR #2 is bundled with the hardened Phase 1–5 application release PR and `main` branch protection is enabled (`F-01`).
   - Consolidate unapplied `20260621`–`20260624` (since none have run in production yet) **or** guarantee single-transaction execution in production to erase the `20260621`/`20260623` intermediate exploit windows (`F-02`).
4. **Refresh Stale Companion Docs (`F-12`):**
   - Update [`PHASE_1D`](../../docs/roadmap/PHASE_1D_DATABASE_READINESS_REPORT.md#L18,L128) / [`PHASE_1E`](../../docs/roadmap/PHASE_1E_VERIFICATION_HARNESS_REPORT.md#L13,L109) status lines before merge so committed docs do not falsely claim `0` CI runs alongside an active CI workflow, and consider pinning container digest/action SHAs in [`.github/workflows/ci-postgres-verification.yml`](../../.github/workflows/ci-postgres-verification.yml).

---

## Mandatory Pre-Production DB Execution Checklist (`gbovkejymfeiqgverzfr`)

Even after PR merge defects are fixed, **do NOT execute any DDL against `gbovkejymfeiqgverzfr`** until every gate below completes in order:

1. **Verified Production Backup (`F-04`):** Export a verified logical `pg_dump` (or confirm paid PITR + fresh manual Supabase snapshot) and store rollback DDL drafted from step 2.
2. **Read-Only Catalog Inspection in Supabase SQL Editor (`F-03`, `F-06`, `F-07`):** Execute queries `#1`–`#6` from [`SECURITY_REMEDIATION_PLAN.md` Section 4](../../docs/roadmap/SECURITY_REMEDIATION_PLAN.md#L262-L298), query `#7` (`supabase_migrations.schema_migrations`) from [`PHASE_1D:227-235`](../../docs/roadmap/PHASE_1D_DATABASE_READINESS_REPORT.md#L227-L235), **plus** check:
   - Custom `public` functions/privileges (`pg_proc` + `has_function_privilege('anon'/'authenticated', oid, 'EXECUTE')`).
   - Function owners (`pg_get_userbyid(proowner)`) and case sensitivity of the `1` non-`user_<hex>` custom handle in `public.profiles`.
   - Any unexpected custom-named permissive RLS policies in `pg_policies` requiring explicit `DROP POLICY IF EXISTS` (`F-03`).
3. **Hosting & Environment Secrets Verification (`F-01`):** Provision and verify **`SUPABASE_SERVICE_ROLE_KEY`** and **`NEXT_PUBLIC_SITE_URL`** in Vercel Production environment variables (and `.env.local`) without exposing values. Confirm Vercel deployment behavior on `main`.
4. **Historical Data Moderation Decision (`F-08`):** Decide owner policy for the `6` `__debug_test__` (`user_id IS NULL`) rows and Category B–E outliers (`260ffffc` `200 raw_wpm`, `e23c78dc` `94 WPM` `3.974s` `quotes` #1, `875a89f8`/`594a6494` `226 raw_wpm`, `543` errors) prior to making `leaderboard_view` live.
5. **Maintenance Window Cutover (`F-01`, `F-02`, `F-09`):**
   - Put application/writes in maintenance pause -> apply consolidated/corrected migrations atomically inside explicit `BEGIN; SET LOCAL lock_timeout = '5s'; ... COMMIT;` (never leave `20260621`–`20260623` exposed without `20260624`) -> run owner-approved historical moderation -> immediately deploy Phase 1–5 Next.js app -> force PostgREST schema cache reload (`NOTIFY pgrst, 'reload schema';`) -> verify live probes:
     - `anon` `GET /rest/v1/replays` returns `[]` (`0` rows).
     - `anon` `POST /rest/v1/test_results` & `rpc/submit_verified_result` & `rpc/is_reserved_username` fail `42501`/`401`/`404`.
     - `/leaderboard`, `/api/leaderboard`, `/u/[username]`, authenticated `POST /api/results`, `PATCH /api/profile`, `POST /api/challenges`, and `/api/debug/supabase` (`404`) behave cleanly.

