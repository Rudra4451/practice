# TyProX 2.0 — Phase 1H: PR #2 Blocker Remediation Report

> **Historical Snapshot Notice:** Archival Phase 1H report preceding PR #3 (`release/typrox-2-integration`, merged to `main` at `45bd21d`). Retained for migration consolidation history (`20260621`–`20260622`); see [FINAL_REPOSITORY_CLEANUP_REPORT.md](./FINAL_REPOSITORY_CLEANUP_REPORT.md) for current repository state.

**Remediation Date:** 2026-11-11  
**Target PR:** `https://github.com/Rudra4451/practice/pull/2`  
**Branch / PR HEAD Commit:** `ci/postgres-16-verification` (`19e8873fd1ae3889432f6bb82a34d6cd718324a7`, working tree uncommitted atop `19e8873`)  
**Base Branch:** `main` @ [`fba1d80f889a02dbbf407039488223addeb4e80b`](https://github.com/Rudra4451/practice)  
**Target Production Supabase Project:** `gbovkejymfeiqgverzfr` (**UNTOUCHED** — zero connections, queries, or migrations executed)  
**Authoritative Audit Input:** [`docs/roadmap/PHASE_1G_PRE_MERGE_REVIEW.md`](../../docs/roadmap/PHASE_1G_PRE_MERGE_REVIEW.md)  

---

## Final Phase 1H Verdict

# **`READY FOR FINAL INDEPENDENT REVIEW`**

- **PR #2 Merge Status:** Remains **NOT APPROVED / NOT MERGED** until (a) an owner-authorized push updates PR #2 and executes the upgraded **3-scenario PostgreSQL 16 workflow** in GitHub Actions (or Docker Desktop / local PostgreSQL 16), and (b) an **independent reviewer** verifies the pushed commit and live CI run.
- **Production Rollout Status (`gbovkejymfeiqgverzfr`):** Remains **`BLOCKED`** on external owner operational gates (`pg_dump` / verified backup, read-only catalog inspection, `SUPABASE_SERVICE_ROLE_KEY` & `NEXT_PUBLIC_SITE_URL` in hosting, `main` branch protection, and synchronized Phase 1–5 application deployment).
- **Local Verification Transparency:** Next.js TypeScript, ESLint, Vitest (`118/118`), Turbopack production build (`33/33`), POSIX `sh -n` syntax validation, `git diff --check`, and byte-level `LF`/`CR=0` validation all **passed locally (`exit 0`)**. Actual PostgreSQL 16 SQL execution (`tests/db/run-pg-verification.sh`) is **locally blocked (`exit 127`)** because neither `docker` nor `psql` exists on this Windows host, and post-1H changes have not been committed or pushed to GitHub Actions yet.

---

## 1. Repository & Working Tree Inventory (Initial vs. Final)

All Git & governance constraints were respected: branch stayed on `ci/postgres-16-verification`, `git diff --cached` is empty (`0` staged files), zero commits/pushes/deploys occurred, `.env.local` and production `gbovkejymfeiqgverzfr` were untouched, and **all `159` pre-existing uncommitted Phase 1–5 application, test, asset, and roadmap files were preserved without modification**.

| Scope | Before Phase 1H (`19e8873`) | After Phase 1H (Working Tree) | Exact Delta |
|---|---|---|---|
| **Staged Index** | `0` files | `0` files | Unchanged (`0`) |
| **Preserved Uncommitted Phase 1–5 Work** | `159` (`47 M`, `11 D`, `101 ??`) | `159` (`47 M`, `11 D`, `101 ??`) | **Zero unrelated files modified, added, or deleted** |
| **PR #2 / DB / CI / Doc Remediation Files** | `0` dirty against `19e8873` | `14` changes (`9 M`, `3 D`, `2 ??`) + untouched [`docker-compose.db.yml`](../../docker-compose.db.yml) | Consolidated migrations, relocated `FULL_SCHEMA.sql`, upgraded harness & workflow, synced docs |
| **Total `git status --short -uall`** | `159` paths | `173` paths (`56 M`, `14 D`, `103 ??`) | `159 + 14 = 173` |

### Exact Phase 1H Changed Paths (`14` Entries + `1` Untouched Companion)

| Action | Path | Role & Verification Metric |
|---|---|---|
| `M` | [`supabase/migrations/20260621000000_typrox_2_hardening.sql`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql) | Single atomic transaction (`BEGIN; SET LOCAL lock_timeout = '5s'; ... COMMIT;`); consolidates `20260621` + `20260623` + `20260624` (`982` LF lines, `CR=0`) |
| `M` | [`supabase/migrations/20260622000000_learning_and_competitive_ecosystem.sql`](../../supabase/migrations/20260622000000_learning_and_competitive_ecosystem.sql) | Wrapped in `BEGIN; SET LOCAL lock_timeout = '5s'; ... COMMIT;`, expiry-enforced `challenge_attempts` policy (`91` LF lines, `CR=0`) |
| `D` | `supabase/migrations/20260623000000_atomic_result_persistence_and_idempotency.sql` | Deleted (consolidated pre-cutover into `20260621`) |
| `D` | `supabase/migrations/20260624000000_phase1c_security_and_streak_fixes.sql` | Deleted (consolidated pre-cutover into `20260621`) |
| `D` -> `??` | [`supabase/reference/FULL_SCHEMA.sql`](../../supabase/reference/FULL_SCHEMA.sql) *(moved from `supabase/migrations/FULL_SCHEMA.sql`)* | Removed non-timestamped script from `supabase/migrations/`; preserved verbatim legacy DDL with header notice (`351` LF lines, `CR=0`) |
| `M` | [`tests/db/supabase_shim.sql`](../../tests/db/supabase_shim.sql) | Added Supabase-realistic `PUBLIC`, `anon`, `authenticated`, `service_role` default function privileges (`92` LF lines, `CR=0`) |
| `M` | [`tests/db/verify_migrations.sql`](../../tests/db/verify_migrations.sql) | Expanded `TX 1`–`TX 13` + `TX 12B`: removes `profiles` exclusion, adds dynamic `pg_proc` sweep, `is_reserved_username`, `challenge_attempts` expiry, `is_ranked` PB proof (`1,369` LF lines, `CR=0`) |
| `M` | [`tests/db/run-pg-verification.sh`](../../tests/db/run-pg-verification.sh) | Upgraded to 3 full PG16 scenarios + migration directory hygiene gate (`568` LF lines, `CR=0`, `sh -n` = `0`) |
| `M` | [`.github/workflows/ci-postgres-verification.yml`](../../.github/workflows/ci-postgres-verification.yml) | Added `supabase/reference/**` trigger path, SHA-pinned `actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2`, CRLF + filename hygiene check (`111` LF lines, `CR=0`) |
| `M` | [`docs/roadmap/PHASE_1D_DATABASE_READINESS_REPORT.md`](../../docs/roadmap/PHASE_1D_DATABASE_READINESS_REPORT.md) | Added Phase 1H sync notice citing CI runs `42894187120`/`42894175929`, `20260621` consolidation & `FULL_SCHEMA.sql` relocation without altering historical audit text |
| `M` | [`docs/roadmap/PHASE_1E_VERIFICATION_HARNESS_REPORT.md`](../../docs/roadmap/PHASE_1E_VERIFICATION_HARNESS_REPORT.md) | Added Phase 1H sync notice |
| `M` | [`docs/roadmap/PHASE_1F_GITHUB_CI_PREPARATION.md`](../../docs/roadmap/PHASE_1F_GITHUB_CI_PREPARATION.md) | Added Phase 1H supersession warning so stale `12`-file `git add` list is not reused |
| `??` | [`docs/roadmap/PHASE_1H_REMEDIATION_REPORT.md`](../../docs/roadmap/PHASE_1H_REMEDIATION_REPORT.md) | This remediation report |
| *(untouched)* | [`docker-compose.db.yml`](../../docker-compose.db.yml) | Remains LF (`30` lines, `CR=0`), automatically picks up upgraded `run-pg-verification.sh` |

`git diff --stat` across PR #2 scope files vs. `19e8873` (before adding this report): `12 files changed, 1391 insertions(+), 1450 deletions(-)`.

---

## 2. Finding-by-Finding Remediation Matrix (`F-01`–`F-12`)

| Finding | Severity | Disposition & Technical Evidence |
|---|---|---|
| **F-01** | **Critical** | **Operational / Release-Gate Control Documented (Code/SQL Made Compatible):** PR #2 must NOT merge to unprotected `main` (`vercel[bot]` live deploy + possible Supabase GitHub integration) ahead of Phase 1–5 application callers and hosting secrets. Consolidated `20260621` keeps clean single-shot DB cutover readiness while Section 3 defines the exact safe release sequence and `main` protection rules. |
| **F-02** | **High** | **FIXED in SQL:** Eliminated the 4-file inter-migration exploit/outage window (`20260621` revoking client writes before `submit_verified_result` existed, leaving `profiles.username` REST-writable, and temporarily installing buggy `submit_verified_result` v1 in `20260623`). Deleted `20260623` & `20260624`; consolidated all hardening, grants, policies, trigger hardening, and `submit_verified_result` v2 into **one atomic `BEGIN; ... COMMIT;` transaction** in [`20260621`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L11-L980). |
| **F-03** | **High** | **FIXED in Repo Layout + SQL & Documented Live Preflight:** Relocated `FULL_SCHEMA.sql` from `supabase/migrations/` to [`supabase/reference/FULL_SCHEMA.sql`](../../supabase/reference/FULL_SCHEMA.sql) (verified via repo-wide grep that zero code/tests/scripts depend on the old path); added filename regex gate `^[0-9]{14}_.*\.sql$` to both CI workflow and `run-pg-verification.sh`. Added dynamic `pg_proc` revoke sweep (`20260621:911-936`). Preserved mandatory read-only preflight inspection for any unknown custom-named RLS policies or `schema_migrations` drift in live `gbovkejymfeiqgverzfr`. |
| **F-04** | **High** | **Mitigated Safely / Pre-Execution Gates Defined:** Zero data rows or `is_invalidated` flags are deleted or overwritten; every policy/index/trigger change runs atomically with `lock_timeout = '5s'`. Full inventory of destructive schema/grant drops and mandatory pre-cutover `pg_dump` / catalog backup procedure documented in Section 7. |
| **F-05** | **Medium** | **FIXED in SQL + CI:** Added `DROP POLICY IF EXISTS "Users can insert their own profiles" ON public.profiles;` in [`20260621:137`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L137). Removed `tablename <> 'profiles'` blind spot in [`verify_migrations.sql` `TX 1`](../../tests/db/verify_migrations.sql#L80-L92), explicitly checked obsolete policy list for `"Users can insert their own profiles"`, and added runtime `ROLLBACK`-scoped proof [`TX 12B`](../../tests/db/verify_migrations.sql#L1333-L1354) granting table `INSERT` and proving `authenticated` still fails with `42501` because no permissive RLS `INSERT` policy exists. |
| **F-06** | **Medium** | **FIXED in SQL + CI:** Replaced blind `CREATE INDEX IF NOT EXISTS` in [`20260621:66-112`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L66-L112) with catalog-inspected reconciliation (`v_pred_norm` & btree key order): drops `idx_test_results_leaderboard` **only** if missing/mismatched (such as `FULL_SCHEMA.sql`'s unfiltered index) and skips rebuilding when matching. Tightened [`TX 1`](../../tests/db/verify_migrations.sql#L335-L353) predicate check and added Scenario 2 (`FULL_SCHEMA.sql` upgrade) + Scenario 3 (drift reconciliation + OID-verified no-op second rerun) in [`run-pg-verification.sh`](../../tests/db/run-pg-verification.sh). |
| **F-07** | **Medium** | **FIXED in SQL + Shim + CI:** [`20260621:911-950`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L911-L950) executes a dynamic `pg_proc` sweep revoking `EXECUTE` from `PUBLIC, anon, authenticated` on **all** non-extension (`deptype <> 'e'`) routines in schema `public`, grants `EXECUTE` ONLY to `service_role` on `submit_verified_result(...)` and `is_reserved_username(TEXT)`, sets `SET search_path = public, pg_catalog` on all 4 functions. [`supabase_shim.sql:81-92`](../../tests/db/supabase_shim.sql#L81-L92) now mirrors Supabase `PUBLIC`/`anon`/`authenticated` default function grants, and `verify_migrations.sql` [`TX 1`](../../tests/db/verify_migrations.sql#L164-L283) + `TX 6`/`TX 7` enforce both catalog-level and runtime denial (`legacy_sql_editor_helper()` tested in Scenario 2). |
| **F-08** | **Medium** | **FIXED in SQL + Verified Compatibility:** Added non-destructive historical ranking quarantine (`is_ranked = FALSE`) in [`20260621:184-292`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L184-L292) for legacy (`client_run_id IS NULL`) Category A–F outliers (`__debug_test__`, `1`-keystroke, `4%`-acc spam, `<5s` aborts, short `quotes` in timed brackets) without deleting rows or flipping `is_invalidated`. Added `AND tr.is_ranked = TRUE` to `submit_verified_result` PB (`L753`) & total ranked tests (`L845`) and added `idx_profiles_username_lower` (`L63-64`). App-layer `lib/data/profile.ts` / fallback alignment remains cleanly scoped to the Phase 1–5 App PR so PR #2 touches zero app files. |
| **F-09** | **Low** | **FIXED in SQL:** Wrapped both [`20260621`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L11-L980) and [`20260622`](../../supabase/migrations/20260622000000_learning_and_competitive_ecosystem.sql#L6-L91) in explicit `BEGIN; SET LOCAL lock_timeout = '5s'; ... COMMIT;`, added `DROP POLICY IF EXISTS` immediately before every `CREATE POLICY`, and kept `DROP VIEW IF EXISTS` + `CREATE OR REPLACE VIEW` atomic inside the transaction. Documented index lock vs. `CONCURRENTLY` tradeoffs in Section 5. |
| **F-10** | **Low** | **FIXED in SQL + CI:** Replaced `USING (true)` on `public.challenge_attempts` in [`20260622:72-83`](../../supabase/migrations/20260622000000_learning_and_competitive_ecosystem.sql#L72-L83) with `"Active challenge attempts are readable"` enforcing `EXISTS (SELECT 1 FROM public.challenge_links cl WHERE cl.id = challenge_id AND cl.expires_at > timezone('utc'::text, now()))` plus explicit `REVOKE ALL` before `GRANT SELECT`. Asserted in `TX 1`, `TX 9`, `TX 10`, and `TX 11`. *(Deferred Phase 3 tables intentionally retained per scope.)* |
| **F-11** | **Low** | **Mitigated / Documented:** All production writes to `submit_verified_result` run exclusively behind `service_role` in server-verified routes (`POST /api/results` & `/api/results/sync` recompute `verifyAndScoreSession` server-side before persistence), and duplicate `client_run_id` retries serialize on `SELECT ... FOR UPDATE` inside [`20260621:725`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L725). |
| **F-12** | **Info** | **FIXED in CI & Companion Docs:** Pinned `actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2` (uses `node24`, eliminating Node 20 deprecation warnings), added `'supabase/reference/**'` path trigger, enforced `CR=0` + filename checks in workflow, and added clear Phase 1H sync banners to [`PHASE_1D`](../../docs/roadmap/PHASE_1D_DATABASE_READINESS_REPORT.md), [`PHASE_1E`](../../docs/roadmap/PHASE_1E_VERIFICATION_HARNESS_REPORT.md), and [`PHASE_1F`](../../docs/roadmap/PHASE_1F_GITHUB_CI_PREPARATION.md). |

---

## 3. Split-Brain `main`, `vercel[bot]` & Coordinated Release Strategy (`F-01`)

### Why Uncoordinated Merge Breaks Production
1. **Stale `origin/main` App Breaks on Hardened DB:** Deployed `origin/main` (`fba1d80`) queries nested `leaderboard_view?select=...,profiles(...)` (failing permanently with `PGRST200`, not caught by its `42P01`/`PGRST205` fallback), executes direct SSR/browser `INSERT`/`UPDATE` writes into `test_results`, `replays`, `streaks`, `challenge_links`, and `profiles.username` (all failing `42501 insufficient_privilege` after `20260621`), and still ships `/api/debug/supabase`.
2. **Active `vercel[bot]` GitHub App Deploys `main` Automatically:** GitHub `/deployments` confirmed `vercel[bot]` builds pushes/merges automatically. Merging DB migrations onto unprotected `main` (`HTTP 404` branch protection) without the Phase 1–5 Next.js app bundle creates a split-brain `main` and risks accidental execution if a Supabase GitHub Integration or manual CLI run targets `main`.
3. **Why Application Code Was NOT Modified in This DB Branch:** Modifying `lib/data/leaderboard.ts`, `lib/data/profile.ts`, or `lib/typing/persistence.ts` inside `ci/postgres-16-verification` would pollute an isolated DB PR with app changes, could break mocked app tests (e.g., [`__tests__/api/leaderboard.route.test.ts`](../../__tests__/api/leaderboard.route.test.ts#L144-L148)) or live prod prior to `20260621` cutover (`is_ranked` does not exist in `gbovkejymfeiqgverzfr` yet!).

### Safe Coordinated Release Sequence
1. **Before Merging PR #2:**
   - Enable GitHub branch protection on `main` (require independent approval + require `"PostgreSQL 16 Migration Verification"` status check).
   - Verify in Supabase Dashboard (`gbovkejymfeiqgverzfr` -> Integrations / Branching) whether any **Supabase GitHub App** is linked to `Rudra4451/practice`; disable auto-apply before merging PR #2, OR **hold merging PR #2 until the Phase 1–5 Application PR is open, reviewed, and ready for synchronized merge/cutover**.
2. **Maintenance-Window Production Cutover Order:**
   1. Provision & verify `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SITE_URL` in Vercel Production env (never committed).
   2. Execute read-only catalog preflight queries `#1`–`#7` + custom `pg_proc` / `pg_policies` inspection (Section 9) and export a verified `pg_dump` / backup.
   3. Pause writes / announce brief maintenance window -> execute consolidated `20260621` then `20260622` against `gbovkejymfeiqgverzfr` (each is a single atomic transaction with `5s` `lock_timeout`).
   4. Deploy hardened Phase 1–5 Next.js app immediately + reload PostgREST schema (`NOTIFY pgrst, 'reload schema';`) + smoke-test endpoints.
   5. *(Follow-up App PR refinement after `20260621` is live in prod):* add `.eq('is_ranked', true)` and case-insensitive username matching (`.ilike('username', cleanUsername)`) in [`lib/data/profile.ts`](../../lib/data/profile.ts#L50-L64) and fallback paths in [`lib/data/leaderboard.ts`](../../lib/data/leaderboard.ts#L121-L122).

---

## 4. Complete SQL & Application Function Privilege Matrix (`F-07`)

### 4A. PostgreSQL Routines & Views (`20260621` Final State)

| Object | Kind / Mode | `search_path` / Invoker | Effective `EXECUTE` / `SELECT` ACL | Caller & Verification |
|---|---|---|---|---|
| `public.submit_verified_result(...)` (13 params) | `SECURITY DEFINER` PL/pgSQL | `SET search_path = public, pg_catalog` | **`service_role` ONLY** (`PUBLIC`, `anon`, `authenticated` revoked) | Server API ([`lib/typing/persistence.ts:813`](../../lib/typing/persistence.ts#L813)); `TX 1`, `TX 6`–`TX 8` |
| `public.handle_new_user()` | `SECURITY DEFINER` Trigger Fn | `SET search_path = public, pg_catalog` | **Revoked from `PUBLIC`, `anon`, `authenticated`** | Auth trigger `on_auth_user_created` (`20260618`/`FULL_SCHEMA`); `TX 1`, `TX 2` |
| `public.enforce_profile_username_integrity()` | `SECURITY INVOKER` Trigger Fn | `SET search_path = public, pg_catalog` | **Revoked from `PUBLIC`, `anon`, `authenticated`** | Trigger `trg_enforce_profile_username_integrity` on `profiles`; `TX 1`, `TX 5`, `TX 6` |
| `public.is_reserved_username(TEXT)` | `SECURITY INVOKER` `IMMUTABLE` SQL | `SET search_path = public, pg_catalog` | **`service_role` ONLY** (`PUBLIC`, `anon`, `authenticated` revoked) | Needed by `SECURITY INVOKER` trigger only when `service_role` modifies `profiles.username` (`PATCH /api/profile`); `authenticated` non-username updates exit early before calling it. Verified in `TX 1`, `TX 5`–`TX 7`. |
| **All other non-extension `public` `f`/`p` routines** | Any SQL Editor / legacy fn | Flagged by `TX 1` if `SECURITY DEFINER` lacks safe `search_path` | **Dynamic `pg_proc` sweep revokes `PUBLIC`, `anon`, `authenticated`** (`pg_depend.deptype = 'e'` extension helpers excluded) | Proven against synthetic `public.legacy_sql_editor_helper()` in Scenario 2 and dynamic catalog assertion in `TX 1` |
| `public.leaderboard_view` | View (`security_invoker = true`) | Evaluates caller RLS on `test_results` & `profiles` | `SELECT` to `anon`, `authenticated`, `service_role` | Exposes non-invalidated, `user_id IS NOT NULL`, `is_ranked = TRUE`; `TX 1`, `TX 9`–`TX 12` |

### 4B. Application Database Caller Alignment

| Application Module | Role Used | Target DB Operation | Post-`20260621..20260622` Compatibility |
|---|---|---|---|
| [`app/api/results/route.ts`](../../app/api/results/route.ts) & [`app/api/results/sync/route.ts`](../../app/api/results/sync/route.ts) | `service_role` (`AdminConfigurationError` `503` in prod if absent) | [`persistVerifiedResult`](../../lib/typing/persistence.ts#L778-L1053) -> `submit_verified_result(...)`; private TS helper [`finalizeRecoveredResult`](../../lib/typing/persistence.ts#L524-L634) *(unexported TypeScript recovery helper inside fallback path, not a DB RPC)* | **Compatible** (13-arg & JSON payload exact match; fail-closed `503` without `SUPABASE_SERVICE_ROLE_KEY`) |
| [`app/api/profile/route.ts`](../../app/api/profile/route.ts#L80-L150) | `authenticated` (SSR cookie) for preferences; **`service_role`** for onboarding `username` | Column-granted `UPDATE (display_name, avatar_url, theme, font_family, updated_at)`; `service_role` `UPDATE` for first custom handle (`23505`/`42501`/`23514`) | **Compatible** (proven in `TX 5` & `TX 6`) |
| [`app/api/challenges/route.ts`](../../app/api/challenges/route.ts#L42-L99) | `service_role` | Reads owner `test_results` and inserts `public.challenge_links` | **Compatible** (`anon`/`authenticated` `INSERT` blocked at grant & RLS) |
| [`lib/data/leaderboard.ts`](../../lib/data/leaderboard.ts#L66-L140), [`lib/data/profile.ts`](../../lib/data/profile.ts#L47-L76), [`lib/data/challenge.ts`](../../lib/data/challenge.ts#L39-L44), [`app/dashboard/page.tsx`](../../app/dashboard/page.tsx), [`app/dashboard/performance-lab/page.tsx`](../../app/dashboard/performance-lab/page.tsx) | SSR cookie / browser `anon` or `authenticated` | **`SELECT` only** across `leaderboard_view`, `profiles`, `test_results`, `replays` (owner), `streaks`, `achievements`, `user_achievements`, active `challenge_links` | **Compatible** (`SELECT` grants & privacy RLS match; note follow-up `is_ranked = true` filter refinement in `lib/data/profile.ts` for App PR) |

---

## 5. Index Reconciliation, Transaction Atomicity & Locking (`F-06`, `F-09`)

1. **`idx_test_results_leaderboard` Reconciliation ([`20260621:66-112`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L66-L112)):**
   - Queries `pg_class` / `pg_index` / `pg_am` / `pg_get_expr(indpred, indrelid)`.
   - Normalizes predicate whitespace/parentheses (`v_pred_norm`) and checks exact table (`public.test_results`), `NOT indisunique`, `btree`, key list `USING btree (mode, duration, is_invalidated, wpm DESC)`, and predicate `user_id IS NOT NULL AND is_invalidated = FALSE AND is_ranked = TRUE`.
   - Drops and rebuilds **only when missing or drifted** (fixing `FULL_SCHEMA.sql`'s unfiltered index and any partial predicate lacking `is_ranked = TRUE`), while leaving an already-matching index completely untouched (verified via OID equality on second rerun in Scenario 3).
2. **`CONCURRENTLY` vs. Atomic Transaction & Lock Contention Analysis:**
   - PostgreSQL forbids `CREATE INDEX CONCURRENTLY` and `DROP INDEX CONCURRENTLY` inside a multi-statement `BEGIN; ... COMMIT;` block.
   - To eliminate partial security states (`F-02`) and transient `PGRST205` windows around `DROP VIEW IF EXISTS leaderboard_view` (`F-09`), both `20260621` and `20260622` execute atomically inside **`BEGIN; SET LOCAL lock_timeout = '5s'; ... COMMIT;`** instead.
   - **Impact Assessment:** At current observed production scale (`170` `test_results`, `16` `profiles`), index rebuild takes sub-millisecond CPU, and `SET LOCAL lock_timeout = '5s'` aborts cleanly rather than queuing reads behind an `AccessExclusiveLock` if an external session holds locks — provided cutover runs inside a brief maintenance pause. If table size grows substantially before future DDL, index-only changes should be extracted into standalone `CONCURRENTLY` pre/post steps outside transactions.

---

## 6. Non-Destructive Historical Ranking Quarantine & Profile/PB Alignment (`F-08`)

[`20260621:184-292`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L184-L292) audits existing pre-hardening rows (`WHERE tr.client_run_id IS NULL AND tr.is_ranked = TRUE`) **without deleting any rows and without mutating `is_invalidated`**. It sets `is_ranked = FALSE` strictly when objective integrity or telemetry thresholds fail:

| Disqualification Rule | Caught Production Anomalies (`BATCH_1_1A`) & Compatibility |
|---|---|
| `user_id IS NULL` OR `is_invalidated` | Category A (`6` `__debug_test__` rows); already invalidated runs |
| Invalid `mode` / `duration` (`words/quotes/numbers/punctuation/code`; `15/30/60/120`) | Invalid synthetic test brackets |
| `wpm <= 0 OR wpm > 260 OR raw_wpm <= 0 OR raw_wpm > 320 OR accuracy < 20 OR accuracy > 100` | Matches [`verifyAndScoreSession`](../../lib/typing/verifier.ts#L213); disqualifies Category C (`226 raw_wpm`, `4%` acc, `543` errors) |
| Missing/non-array `replays.telemetry`, `< 10` events, malformed elements, or `span_ms < 5000` (supports BOTH `{"t": ms}` objects AND legacy `[delta_ms, ...]` arrays) | Disqualifies Category B (`1`-keystroke `200 raw_wpm`, `0ms` span), Category D (`3`-event `541ms` aborts), while preserving legitimate slow 30s `words`/`punctuation` runs (`10.6s–14.7s`, `>= 20%` acc) |
| `mode = 'quotes' AND span_ms < duration * 500` | Quarantines Category E short 1-sentence quotes stuffed into `30s`/`120s` brackets (`3.974s` `94 WPM` #1, `26.9s` `120s`) from public `leaderboard_view` and server PB baselines while preserving users' personal history (`is_invalidated = FALSE`) |

- **`submit_verified_result` & Profile Indexes:** `v_prev_best_wpm` (`20260621:746-756`) and `v_total_tests` (`L840-845`) now filter `AND tr.is_ranked = TRUE`, so newly submitted runs cannot be artificially suppressed from Personal Best celebration by quarantined legacy outliers (verified in `TX 8` and Scenario 2). `idx_profiles_username_lower` (`L63-64`) enables fast case-insensitive username lookups without conflicting with any pre-existing mixed-case handles (`LegacyMixed` update & lookup tested cleanly).
- *(Optional Owner Moderation Later):* If the owner explicitly wants permanent deletion of the `6` `user_id IS NULL` `__debug_test__` rows (`BATCH_1_1A`), execute `DELETE FROM public.test_results WHERE user_id IS NULL AND seed = '__debug_test__';` only **after** backup and verification — `20260621` never auto-deletes rows.

---

## 7. Destructive Schema Operations, Rerunnability & Recovery Requirements (`F-04`)

| Operation in Phase 1H | Purpose & Rerunnability Guard | Reversibility / Rollback Requirement |
|---|---|---|
| Drop single-column `client_run_id` `UNIQUE` constraints/indexes (`test_results_client_run_id_key`) | Dynamic `pg_constraint` loop + `DROP INDEX IF EXISTS` (safe/idempotent) | Non-destructive (replaced by wider per-user partial unique index `(user_id, client_run_id)`) |
| `ALTER TABLE public.streaks ALTER COLUMN last_active_date DROP DEFAULT / DROP NOT NULL` | Idempotent `ALTER COLUMN` statements (allows `NULL` initial date) | Reversing back to `NOT NULL` fails if new users exist with `last_active_date IS NULL` unless backfilled first |
| `DROP INDEX IF EXISTS idx_test_results_leaderboard` (conditional on mismatch) + `CREATE INDEX` | Catalog predicate/key comparison avoids unnecessary drop on reruns | Recreates equivalent index; original unfiltered index DDL easily restored from preflight backup if rolling back |
| `REVOKE ALL` on tables/sequences/functions & `DROP POLICY IF EXISTS` on 7 tables (incl. `"Users can insert their own profiles"` & `"Challenge attempts readable by participants or public"`) | Re-grants minimal privileges and immediately creates hardened policies inside same transaction | **No down/reverse SQL exists in repo.** Requires capturing live `pg_policies`, `role_table_grants`, `pg_proc` ACLs, and `handle_new_user()` source plus taking a confirmed **`pg_dump` / Supabase backup** before running `20260621` |
| `DROP VIEW IF EXISTS public.leaderboard_view` + `CREATE OR REPLACE VIEW` | Inside same transaction (eliminates transient `PGRST205`) | Restorable from pre-cutover `20260620` definition / backup (live prod has no view today) |
| Deleted `20260623` & `20260624`; moved `FULL_SCHEMA.sql` -> `supabase/reference/` | File-level cleanup prior to any prod execution | Zero impact on prod `schema_migrations` until owner runs `20260621`–`20260622` |

---

## 8. Upgraded PostgreSQL 16 Verification Harness & CI Workflow

- **[`tests/db/supabase_shim.sql`](../../tests/db/supabase_shim.sql):** Adds `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL PRIVILEGES ON FUNCTIONS TO PUBLIC;` and `TO anon, authenticated, service_role;` so vanilla PG 16 reproduces hosted Supabase's permissive function default exposure unless explicitly revoked.
- **[`tests/db/verify_migrations.sql`](../../tests/db/verify_migrations.sql) (`TX 1`–`TX 13` + `TX 12B`):**
  - Removes `tablename <> 'profiles'` exception; asserts zero DML policies in `public` other than hardened `profiles` `UPDATE`; explicitly checks `"Users can insert their own profiles"` and `"Challenge attempts readable by participants or public"` were dropped.
  - Dynamically sweeps ALL non-extension `pg_proc` (`f`/`p`) in `public` ensuring zero `PUBLIC`/`anon`/`authenticated` `EXECUTE` exposure and `search_path` safety on every `SECURITY DEFINER` routine, plus asserts explicit `is_reserved_username` runtime `42501` denial under `authenticated` (`TX 6`) and `anon` (`TX 7`).
  - Verifies exact `idx_test_results_leaderboard` key/predicate normalization + `idx_profiles_username_lower`.
  - Tests `challenge_attempts` expiry RLS across `anon`, `user_b`, and owner `user_a`, verifies `submit_verified_result` ignores unranked rows for PB (`TX 8`), and proves `"Users can insert their own profiles"` removal behaviorally via `TX 12B`.
- **[`tests/db/run-pg-verification.sh`](../../tests/db/run-pg-verification.sh):**
  - Enforces migration filename hygiene (`^[0-9]{14}_.*\.sql$`, absence of deleted `20260623`/`20260624`/`migrations/FULL_SCHEMA.sql`).
  - **Scenario 1:** Clean bootstrap `20260618..20260622` + `verify_migrations.sql` + deterministic 2-worker concurrent contention proof (`pg_advisory_xact_lock(4200, 99002)` + `pg_stat_activity` `Lock` `wait_event IN ('transactionid', 'tuple')`).
  - **Scenario 2:** Bootstraps from `supabase/reference/FULL_SCHEMA.sql`, seeds rogue `legacy_sql_editor_helper()` (`PUBLIC/anon/authenticated`), `LegacyMixed` profile, stuck `streak=0` (`CURRENT_DATE`), and 8 legacy Category A–F / tuple-array / duplicate rows -> applies `20260621..20260622` -> proves non-destructive preservation (`8` rows, `is_invalidated=FALSE`), exact `6` quarantined / `2` ranked split, `legacy_sql_editor_helper()` revoked, `LegacyMixed` preference updates intact, streak self-heal `0 -> 1`, quarantined outlier excluded from PB, followed by full `verify_migrations.sql`.
  - **Scenario 3:** Corrupts `idx_test_results_leaderboard` + adds `test_results_client_run_id_key`, runs `20260621..20260622` twice sequentially verifying drift reconciliation on pass 1 and identical index `oid` (zero needless rebuild) on pass 2, followed by full `verify_migrations.sql`.
- **[`.github/workflows/ci-postgres-verification.yml`](../../.github/workflows/ci-postgres-verification.yml):** Pinned `actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2` (Node 24), added `'supabase/reference/**'` trigger path, expanded CRLF & 14-digit filename check, and updated step summary.

---

## 9. Exact Local Verification Commands, Outputs & Unverified Production Gates

### 9A. Observed Local Verification After All Edits

| Check | Exact Observed Output / Scope | Exit Code |
|---|---|---|
| Byte CRLF / LF check across all 8 modified/created DB/CI files | `CR=0` (`LF` only, UTF-8 no BOM) across `20260621` (`982` LF), `20260622` (`91` LF), `FULL_SCHEMA.sql` (`351` LF), `supabase_shim.sql` (`92` LF), `verify_migrations.sql` (`1369` LF), `run-pg-verification.sh` (`568` LF), `docker-compose.db.yml` (`30` LF), `ci-postgres-verification.yml` (`111` LF) | **`0`** |
| `& "C:\Program Files\Git\bin\sh.exe" -n tests/db/run-pg-verification.sh` | Clean POSIX `sh` syntax check (`0` warnings/errors) | **`0`** |
| `& "C:\Program Files\Git\bin\sh.exe" tests/db/run-pg-verification.sh` | `ERROR: Neither 'psql' nor 'docker' is available on this host. Cannot execute PostgreSQL 16 verification.` (**Local PG 16 runtime blocked**) | **`127`** |
| `npm run test:db` | `'sh' is not recognized as an internal or external command` (**Local PG 16 runtime blocked**) | **`1`** |
| `git diff --check` | Zero conflict markers or trailing whitespace errors | **`0`** |
| `npm run typecheck` | `tsc --noEmit --incremental false` clean | **`0`** |
| `npm run lint` | `eslint` clean | **`0`** |
| `npm run test:unit` | `23 passed (23)` test files, `118 passed (118)` tests (`6.64s`, mocked Supabase clients) | **`0`** |
| `npm run build` | Next.js `16.2.9` (Turbopack) compiled (`5.1s`) & generated `33/33` pages cleanly | **`0`** |

> **Honesty Boundary:** Neither **PostgreSQL 16 Scenario 1–3 runtime execution** nor **GitHub Actions workflow execution** has run on the post-1H files yet (only the pre-1H commit `19e8873` ran earlier in runs `42894187120`/`42894175929`). Push to `ci/postgres-16-verification` and observe a fresh green Actions run before final sign-off.

### 9B. Unverified Production Catalog & Operational Gates (`gbovkejymfeiqgverzfr`)

Zero live queries were run against production (`gbovkejymfeiqgverzfr`). Before any production DDL runs, the owner MUST complete:
1. **Verified Backup:** Confirm paid PITR or take an external `pg_dump` backup + export rollback DDL.
2. **Read-Only Live Catalog Inspection (Supabase Dashboard SQL Editor):** Run queries `#1`–`#7` (`pg_policies`, `information_schema.role_table_grants` + function/sequence ACLs, `pg_indexes`, `pg_publication_tables`, `pg_proc` for `handle_new_user()` and any custom SQL-Editor functions/owners, and `supabase_migrations.schema_migrations`) PLUS inspect case sensitivity of the `1` non-`user_<hex>` custom profile handle and verify whether any custom-named permissive policies exist in `pg_policies`.
3. **Environment & Platform Protection:** Provision **`SUPABASE_SERVICE_ROLE_KEY`** & **`NEXT_PUBLIC_SITE_URL`** in Vercel Production, configure `main` branch protection on `Rudra4451/practice`, and confirm no Supabase GitHub auto-push integration runs uncoordinated migrations.

---

## 10. Exact Owner Commands to Stage, Commit, Push PR #2 Update & Trigger Final CI Review

When ready to update PR #2 (`ci/postgres-16-verification`) **without committing any of the `159` preserved Phase 1–5 application files**, inspect the diff first and run in PowerShell from `c:\Users\rudra\TyProX`:

```powershell
# 1. Inspect PR #2 candidate diff carefully before staging
git diff -- `
  .github/workflows/ci-postgres-verification.yml `
  supabase/migrations `
  tests/db `
  docs/roadmap/PHASE_1D_DATABASE_READINESS_REPORT.md `
  docs/roadmap/PHASE_1E_VERIFICATION_HARNESS_REPORT.md `
  docs/roadmap/PHASE_1F_GITHUB_CI_PREPARATION.md

# 2. Stage ONLY PR #2 remediation changes + deletions + relocated FULL_SCHEMA + 1H report
#    (NEVER run `git add .` or `git commit -a` — 159 Phase 1-5 app files stay untouched locally)
git add -A -- `
  .github/workflows/ci-postgres-verification.yml `
  docker-compose.db.yml `
  supabase/migrations `
  supabase/reference/FULL_SCHEMA.sql `
  tests/db `
  docs/roadmap/PHASE_1D_DATABASE_READINESS_REPORT.md `
  docs/roadmap/PHASE_1E_VERIFICATION_HARNESS_REPORT.md `
  docs/roadmap/PHASE_1F_GITHUB_CI_PREPARATION.md `
  docs/roadmap/PHASE_1H_REMEDIATION_REPORT.md

git update-index --chmod=+x tests/db/run-pg-verification.sh

# 3. SAFETY GATE: confirm ONLY PR #2 DB/CI/doc files are staged
git diff --cached --name-status

# 4. Commit cleanly (do NOT merge PR #2 yet) and push to trigger fresh PG 16 CI
git commit -m "fix(db,ci): consolidate 20260621 hardening, close RLS/ACL gaps, test FULL_SCHEMA upgrade"
git push origin ci/postgres-16-verification

# 5. Monitor fresh GitHub Actions PG 16 verification run, then invoke final independent review (Phase 1I)
gh run list -R Rudra4451/practice --branch ci/postgres-16-verification -L 5
```

