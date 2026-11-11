# TyProX 2.0 — Final Independent Release Candidate Verification & Pre-Merge Review

> **Historical Snapshot Notice:** Archival pre-merge audit of PR #3 (`release/typrox-2-integration`). PR #3 merged into `main` on 2026-11-10; see [FINAL_REPOSITORY_CLEANUP_REPORT.md](./FINAL_REPOSITORY_CLEANUP_REPORT.md) for the current post-merge repository baseline.

- **Review Date:** 2026-11-11
- **Reviewer Role:** Independent Principal Engineer, Database Security Auditor, DevOps Reviewer & Release Manager
- **Candidate PR:** `https://github.com/Rudra4451/practice/pull/3` (`OPEN`, `MERGEABLE`, `CLEAN`)
- **Source Branch / Exact Verified HEAD:** `release/typrox-2-integration` @ `6d1042d4adee7f7991a593f8facbd7648911f614`
- **Target Base Branch:** `main` @ `fba1d80f889a02dbbf407039488223addeb4e80b` (`Branch not protected` — `HTTP 404`)
- **Superseded PR Referenced:** `https://github.com/Rudra4451/practice/pull/2` (`OPEN`, `ci/postgres-16-verification` @ `19e8873fd1ae3889432f6bb82a34d6cd718324a7`)
- **Target Production Database:** Supabase project `gbovkejymfeiqgverzfr` (**UNTOUCHED** — strict read-only repository, CI, Vercel, and local inspection; zero files modified outside this review artifact)

> [!NOTE]
> **Post-Review Remediation Status (Applied Atop `6d1042d`):** Following the independent `6d1042d` review archived verbatim below, both repository pre-merge code/documentation findings have been implemented and locally verified (`tsc`, `eslint`, `27` Vitest files / `134` tests, Webpack & Turbopack builds `33/33`, and `7` Chromium E2E tests exiting `0`):
> 1. Added [`isSupabaseRealtimeEnabled()`](../../lib/supabase/client.ts#L27-L48) guard in [`PerformanceLabPage`](../../app/dashboard/performance-lab/page.tsx#L125-L127) with regression unit tests in [`__tests__/components/performance-lab-page.test.tsx`](../../__tests__/components/performance-lab-page.test.tsx).
> 2. Corrected Section 2–Section 5 of [`FINAL_ENGINEERING_RELEASE_REPORT.md`](../../docs/roadmap/FINAL_ENGINEERING_RELEASE_REPORT.md) (exact `6d1042d` CI/Preview links + zero-downtime app-first cutover sequence) and synchronized [`IMPLEMENTATION_STATUS.md`](../../docs/roadmap/IMPLEMENTATION_STATUS.md).
>
> **Still Required Before Merging PR #3:** Green GitHub Actions CI (`verify-postgres-16`, `quality-and-e2e`) on the updated PR #3 HEAD, plus GitHub/Vercel/Supabase operational gates (§4 & §7).

---

## Executive Verdicts

### PR #3 Merge Verdict
# **`APPROVE WITH SPECIFIC REQUIRED CORRECTIONS.`**

### Production Rollout Classification (`gbovkejymfeiqgverzfr`)
# **`BLOCKED BY PRODUCTION EVIDENCE.`**

**Rationale Summary:**
- **Why PR #3 is technically close to mergeable (`APPROVE WITH SPECIFIC REQUIRED CORRECTIONS.`):** Independent verification confirms that commit `6d1042d4adee7f7991a593f8facbd7648911f614` consolidates all Phase 1G/1H PostgreSQL security fixes atomically into [`20260621000000_typrox_2_hardening.sql`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql) + [`20260622000000_learning_and_competitive_ecosystem.sql`](../../supabase/migrations/20260622000000_learning_and_competitive_ecosystem.sql), resolves all repository-side DB/CI findings (`F-02`, `F-05`–`F-10`, `F-12`), ships backward-compatible server fallbacks ([`lib/data/leaderboard.ts`](../../lib/data/leaderboard.ts), [`lib/data/profile.ts`](../../lib/data/profile.ts), [`lib/typing/persistence.ts`](../../lib/typing/persistence.ts)), and passes every local and live CI check (`typecheck`, `lint`, `26`/`132` Vitest tests, Webpack & Turbopack builds `33/33`, `7` Chromium E2E tests, PostgreSQL `16.15` 3-scenario suite [`42906375928`](https://github.com/Rudra4451/practice/actions/runs/42906375928), App Quality CI [`42906375949`](https://github.com/Rudra4451/practice/actions/runs/42906375949), Vercel Preview `7694923091`, and `npm audit --omit=dev` = `0`). However, **three specific pre-merge corrections are mandatory** because `main` has **no branch protection (`HTTP 404`)** and auto-deploys via `vercel[bot]`:
  1. **Correct the unsafe cutover order & stale CI citations in [`FINAL_ENGINEERING_RELEASE_REPORT.md`](../../docs/roadmap/FINAL_ENGINEERING_RELEASE_REPORT.md):** Its §5 Step 3 instructs applying `20260621`+`20260622` *before* deploying PR #3 (which causes immediate `PGRST200` `500`s and `42501` write outages on live `origin/main` unless traffic is completely frozen, whereas PR #3 is proven backward-compatible to deploy *before* DB DDL once `SUPABASE_SERVICE_ROLE_KEY` is set); and its §4 still cites `f9f3940` and prior runs `42905679038`/`42905679421` rather than HEAD `6d1042d` and `42906375928`/`42906375949`/`42906362540`.
  2. **Add missing [`isSupabaseRealtimeEnabled()`](../../lib/supabase/client.ts#L27-L48) guard in [`PerformanceLabPage`](../../app/dashboard/performance-lab/page.tsx#L124-L165):** Unlike [`DashboardPage`](../../app/dashboard/page.tsx#L299-L331) and [`LeaderboardClient`](../../components/leaderboard/leaderboard-client.tsx#L157-L160), `PerformanceLabPage` subscribes to `lab-results-${userId}` without checking `!isSupabaseRealtimeEnabled()`.
  3. **Execute pre-merge governance & hosting gates before merging:** Provision `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SITE_URL` in Vercel Production *first* (because [`resolvePrivilegedWriteClient`](../../lib/supabase/admin.ts#L105-L129) fails closed with `503 ADMIN_CONFIG_MISSING` in `NODE_ENV=production`), configure `main` branch protection requiring review + both CI workflows, confirm in Supabase Dashboard that no Supabase GitHub App auto-applies `supabase/migrations/` on `main` merge, and close PR #2 cleanly.
- **Why production rollout remains separately classified `BLOCKED BY PRODUCTION EVIDENCE.`:** Live database `gbovkejymfeiqgverzfr` has **not** had verified backup/PITR + `pg_dump` export, read-only catalog inspection (`pg_policies`, `role_table_grants`, `pg_indexes`, `pg_proc`, `supabase_migrations.schema_migrations`, mixed-case custom profile handle check), Supabase GitHub Integration verification, or Vercel Production secret verification.

---

## 1. Actual GitHub Release Verification (`Rudra4451/practice` PR #3)

### 1.1 Pull Request, Branch, Commit & Diff Parity

| Property | Live GitHub / Local Git Evidence | Verdict |
|---|---|---|
| **PR #3 Status & Target** | `https://github.com/Rudra4451/practice/pull/3`: `OPEN`, `MERGEABLE`, `mergeStateStatus: CLEAN`, base `main` (`fba1d80f889a02dbbf407039488223addeb4e80b`), head `release/typrox-2-integration` | Verified |
| **Exact HEAD Commit** | `6d1042d4adee7f7991a593f8facbd7648911f614` (`0` commits ahead/behind reported HEAD `6d1042d`) | Verified |
| **PR #2 Relationship** | Commit #1 atop `origin/main` is `19e8873fd1ae3889432f6bb82a34d6cd718324a7` (exact HEAD of `OPEN` PR #2 `ci/postgres-16-verification`). All `12` PR #2 files were carried into `release/typrox-2-integration`, then consolidated/remediated in `1f4961b`. PR #2 should be closed as superseded upon PR #3 merge. | Included |
| **Local vs. GitHub File Count** | `git diff --name-status origin/main..HEAD` = **`182` paths** (`119` Added, `50` Modified, `12` Deleted, `1` Renamed [`R096`]); GitHub REST `pulls/3/files` = **`182` paths** (`0` missing, `0` extra) | Exact 1:1 Match |
| **Missing Integration Changes** | `git status --short -uall` is completely empty prior to adding this report; all Phase 1–9 code, Phase 1H DB/CI remediation, assets, tests, and docs are committed on `6d1042d`. | None Missing |

**Exact 8-Commit Graph (`origin/main` `fba1d80` .. `HEAD` `6d1042d`):**
1. `19e8873` `ci(db): verify candidate migrations and RLS invariants on PostgreSQL 16` *(preserved PR #2 baseline)*
2. `1f4961b` `fix(db,ci): consolidate atomic hardening migrations and 3-scenario PG16 suite` *(zero `supabase/` edits after this commit)*
3. `0853229` `feat(security,api,engine): harden verification, HTTP limits, DAL, and typing engine`
4. `3692dac` `feat(ui,ux,seo): redesign UI, Performance Lab, curriculum, daily challenge & metadata`
5. `4aea60f` `test,chore(deps,ci): upgrade Next 16.4.6, expand Vitest/E2E suite & add App Quality CI`
6. `8f26ef9` `docs: update README, OAuth setup, roadmap status, ADRs & release report`
7. `f9f3940` `fix(realtime,test): guard placeholder Supabase URLs from opening failed WebSockets`
8. `6d1042d` `docs: record PR #3 and live GitHub Actions verification run results`

### 1.2 Complete Changed-File Inventory (`182` Files Verified Identical Across Git & GitHub)

- **Root, Config & CI Workflows (`13`):** `A` `.env.example`, `A` [`.github/workflows/ci-app-quality.yml`](../../.github/workflows/ci-app-quality.yml), `A` [`.github/workflows/ci-postgres-verification.yml`](../../.github/workflows/ci-postgres-verification.yml), `M` `.gitignore`, `M` [`OAUTH_SETUP.md`](../../OAUTH_SETUP.md), `M` [`README.md`](../../README.md), `A` [`docker-compose.db.yml`](../../docker-compose.db.yml), `M` `next.config.ts`, `M` `package.json`, `M` `package-lock.json`, `A` [`playwright.config.ts`](../../playwright.config.ts), `A` `vitest.config.mts`, `A` `vitest.setup.ts`.
- **Database Migrations, Reference & PG16 Harness (`6`):** `A` [`supabase/migrations/20260621000000_typrox_2_hardening.sql`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql), `A` [`supabase/migrations/20260622000000_learning_and_competitive_ecosystem.sql`](../../supabase/migrations/20260622000000_learning_and_competitive_ecosystem.sql), `R096` `supabase/migrations/FULL_SCHEMA.sql` -> [`supabase/reference/FULL_SCHEMA.sql`](../../supabase/reference/FULL_SCHEMA.sql), `A` [`tests/db/run-pg-verification.sh`](../../tests/db/run-pg-verification.sh), `A` [`tests/db/supabase_shim.sql`](../../tests/db/supabase_shim.sql), `A` [`tests/db/verify_migrations.sql`](../../tests/db/verify_migrations.sql).
- **App Router & API Routes (`34` — `12 A`, `18 M`, `4 D`):**
  - **Added (`12`):** `app/api/challenges/route.ts`, `app/api/results/sync/route.ts`, `app/daily/page.tsx`, `app/dashboard/loading.tsx`, `app/error.tsx`, `app/global-error.tsx`, `app/leaderboard/loading.tsx`, `app/learn/page.tsx`, `app/learn/[slug]/page.tsx`, `app/not-found.tsx`, `app/u/[username]/loading.tsx`, `app/u/[username]/not-found.tsx`.
  - **Modified (`18`):** `app/api/auth/signout/route.ts`, `app/api/leaderboard/route.ts`, `app/api/profile/route.ts`, `app/api/results/route.ts`, `app/auth/callback/route.ts`, `app/challenge/[id]/page.tsx`, `app/dashboard/page.tsx`, `app/dashboard/performance-lab/page.tsx`, `app/globals.css`, `app/layout.tsx`, `app/leaderboard/page.tsx`, `app/login/page.tsx`, `app/page.tsx`, `app/profile/page.tsx`, `app/robots.ts`, `app/sitemap.ts`, `app/typing/page.tsx`, `app/u/[username]/page.tsx`.
  - **Deleted (`4`):** `app/api/debug/supabase/route.ts`, `app/api/test-supabase/route.ts`, `app/page.tsx.modified`, `app/showcase/page.tsx`.
- **Components (`26` — `9 A`, `17 M`):** `A` `components/challenge/challenge-arena-client.tsx`, `A` `components/daily/daily-challenge-client.tsx`, `A` `components/home/home-landing.tsx`, `A` `components/leaderboard/leaderboard-client.tsx`, `A` `components/learn/learn-hub-client.tsx`, `A` `components/learn/lesson-runner-client.tsx`, `A` `components/providers/auth-provider.tsx`, `A` `components/ui/achievement-badge.tsx`, `A` `components/ui/user-avatar.tsx`, `M` `components/auth/username-modal.tsx`, `M` `components/home/achievements.tsx`, `M` `components/home/analytics.tsx`, `M` `components/home/comparison.tsx`, `M` `components/home/faq.tsx`, `M` `components/home/hero-3d.tsx`, `M` `components/navbar.tsx`, `M` `components/typing/cat-companion.tsx`, `M` `components/typing/replay-player.tsx`, `M` `components/typing/result-chart.tsx`, `M` `components/typing/result-screen.tsx`, `M` `components/typing/text-display.tsx`, `M` `components/typing/typing-container.tsx`, `M` `components/ui/animated-counter.tsx`, `M` `components/ui/button.tsx`, `M` `components/ui/skeleton.tsx`, `M` `components/ui/toast-container.tsx`.
- **Domain Libraries, Constants, Stores, Types & Workers (`32` — `21 A`, `9 M`, `2 D`):**
  - **Added (`21`):** `constants/curriculum.ts`, `lib/audio/keystroke-sound.ts`, `lib/data/challenge.ts`, `lib/data/leaderboard.ts`, `lib/data/profile.ts`, `lib/hooks/use-hydrated.ts`, `lib/security/http.ts`, `lib/security/rate-limit.ts`, `lib/security/redirect.ts`, `lib/security/username.ts`, `lib/seo/site-url.ts`, `lib/supabase/admin.ts`, `lib/typing/daily-challenge.ts`, `lib/typing/metrics.ts`, `lib/typing/persistence.ts`, `lib/typing/replay-analyzer.ts`, `lib/typing/sync-client.ts`, `lib/typing/text-generator.ts`, `lib/typing/verifier.ts`, `lib/utils/format-date.ts`, `types/database.ts`.
  - **Modified (`9`):** `constants/dictionaries.ts`, `lib/logger.ts`, `lib/supabase/auth.ts`, `lib/supabase/client.ts`, `lib/supabase/middleware.ts`, `lib/supabase/server.ts`, `stores/typing-store.ts`, `stores/user-store.ts`, `workers/analytics.worker.ts`.
  - **Deleted (`2`):** `lib/supabase.ts`, `utils/text-generator.ts`.
- **Public Static Assets (`18` — `12 A`, `6 D`):** `A` `12` SVGs under `public/achievements/` (`default`, `speed_{50,75,80,100,120,140,150}`, `streak_{3,7,14,30}` `.svg`); `D` `6` unused starter/static files (`public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/robots.txt`, `public/vercel.svg`, `public/window.svg`).
- **Automated Tests (`27` — `27 A`):** `A` `26` Vitest suites under `__tests__/` (`__tests__/api/{challenges,leaderboard,profile,results,signout,sync}.route.test.ts`, `__tests__/audio/keystroke-sound.test.ts`, `__tests__/components/{cat-companion,challenge-arena-client,dashboard-page,result-screen,typing-container,username-modal}.test.tsx`, `__tests__/data/profile.test.ts`, `__tests__/learn/curriculum.test.ts`, `__tests__/lib/{admin,supabase-client}.test.ts`, `__tests__/security/{http,redirect}.test.ts`, `__tests__/stores/typing-store.test.ts`, `__tests__/typing/{metrics,persistence,replay-analyzer,sync-client,text-generator,verifier}.test.ts`) + `A` [`tests/e2e/typrox.spec.ts`](../../tests/e2e/typrox.spec.ts).
- **Documentation (`26` — `26 A`):** `A` `5` audit docs (`docs/audit/{FEATURE_INVENTORY,PROJECT_AUDIT,SECURITY_REVIEW,TECHNICAL_DEBT,UX_REVIEW}.md`) + `A` `21` roadmap docs (`docs/roadmap/{BATCH_1_1A_PREFLIGHT_REPORT,DECISION_LOG,DESIGN_SYSTEM_PLAN,FINAL_ENGINEERING_RELEASE_REPORT,IMPLEMENTATION_STATUS,MASTER_ROADMAP,PHASE_1B_INDEPENDENT_AUDIT,PHASE_1B_REMEDIATION_REPORT,PHASE_1C_REMEDIATION_REPORT,PHASE_1D_DATABASE_READINESS_REPORT,PHASE_1E_VERIFICATION_HARNESS_REPORT,PHASE_1F_GITHUB_CI_PREPARATION,PHASE_1G_PRE_MERGE_REVIEW,PHASE_1H_REMEDIATION_REPORT,PHASE_1_DIFF_REVIEW,POST_IMPLEMENTATION_AUDIT,PRODUCT_FEATURE_SPECIFICATIONS,SECURITY_REMEDIATION_PLAN,TECHNICAL_IMPLEMENTATION_PLAN,TESTING_AND_ACCEPTANCE_CRITERIA,TESTING_REPORT}.md`).

*(Reconciliation check: `13 + 6 + 34 + 26 + 32 + 18 + 27 + 26 = 182` files, matching Git and GitHub API identically.)*

### 1.3 GitHub Workflows, Branch Protection, Webhooks & Automation

- **Branch Protection (`main`):** `gh api repos/Rudra4451/practice/branches/main/protection` returned **`HTTP 404` (`Branch not protected`)**. Zero required reviews, zero required status checks, zero push/force-push guardrails exist on `main`.
- **Webhooks & Installed Automation (`hooks` & `deployments`):**
  - Repository webhooks (`repos/Rudra4451/practice/hooks`): **`[]`** (empty).
  - Active GitHub Workflows:
    - `413835063`: [`Application Quality, Builds & E2E`](../../.github/workflows/ci-app-quality.yml) (tests, builds, Chromium E2E using dummy env vars — **no DB credentials or Supabase execution**).
    - `413770609`: [`PostgreSQL 16 Migration Verification`](../../.github/workflows/ci-postgres-verification.yml) (ephemeral `postgres:16-alpine` container — **no production Supabase connection**).
    - `294945041`: `pages-build-deployment`.
  - **Does any CI automation run migrations on merge?** **No GitHub Actions workflow runs Supabase migrations.** However, `vercel[bot]` GitHub App is active and **will deploy `main` to Vercel Production immediately upon PR #3 merge** (evidenced by live Preview `7694923091`). Furthermore, whether a **Supabase Dashboard GitHub Integration App** (which bypasses `/hooks`) is linked to auto-apply `supabase/migrations/` on push to `main` **cannot be queried from unprivileged `gh api`** and remains an explicit owner pre-merge check.

---

## 2. Verification of Phase 1G & Phase 1H Remediation (`F-01`–`F-12`)

### 2.1 Complete Finding Disposition Matrix

| Finding | Claimed fix | Actual implementation | Test evidence | Verdict |
|---|---|---|---|---|
| **F-01** *(Critical: Split-brain `main` & Vercel deploy ahead of compatible app + secrets)* | Bundled Phase 1–9 app + consolidated DB in PR #3; documented `SUPABASE_SERVICE_ROLE_KEY`, `main` protection & cutover gate | PR #3 unites compatible app code ([`lib/data/leaderboard.ts`](../../lib/data/leaderboard.ts), [`lib/typing/persistence.ts`](../../lib/typing/persistence.ts)) + migrations; [`lib/supabase/admin.ts:120-122`](../../lib/supabase/admin.ts#L120-L122) fails closed (`503`) if service key missing. **`main` still unprotected (`HTTP 404`)** & `FINAL_ENGINEERING_RELEASE_REPORT.md` §5 Step 3 still writes DB-first order | App CI [`42906375949`](https://github.com/Rudra4451/practice/actions/runs/42906375949); [`__tests__/lib/admin.test.ts`](../../__tests__/lib/admin.test.ts); `gh api` confirms `main` unprotected | **MITIGATED IN CODE; HOST GATES OPEN** *(app & DB are compatible once secrets & `main` protection + app-first order are enforced)* |
| **F-02** *(High: 4-file split inter-migration exploit & `submit_verified_result` v1 window)* | Consolidated `20260621`+`20260623`+`20260624` into one atomic transaction | `20260623` & `20260624` deleted; [`20260621:11-982`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L11-L982) applies all hardening, policies, triggers & `submit_verified_result` v2 inside single `BEGIN; ... COMMIT;` | PG16 CI [`42906375928`](https://github.com/Rudra4451/practice/actions/runs/42906375928) Scenarios 1–3; filename checks in [`run-pg-verification.sh:60-65`](../../tests/db/run-pg-verification.sh#L60-L65) | **FIXED** |
| **F-03** *(High: Non-timestamped `FULL_SCHEMA.sql` in `migrations/` & uninspected prod policies/history)* | Moved `FULL_SCHEMA.sql` to `supabase/reference/`, added filename gate & documented preflight | Renamed to [`supabase/reference/FULL_SCHEMA.sql`](../../supabase/reference/FULL_SCHEMA.sql); filename regex check enforced in CI & shell harness; dynamic `pg_proc` revoke added. Live `gbovkejymfeiqgverzfr` `pg_policies` & `schema_migrations` still uninspected | PG16 CI [`42906375928`](https://github.com/Rudra4451/practice/actions/runs/42906375928) filename check + Scenario 2 upgrade (`FULL_SCHEMA.sql`) | **FIXED IN REPO / CI; LIVE PROD PREFLIGHT OPEN** |
| **F-04** *(High: No down SQL / backup / PITR)* | Zero destructive row deletions + mandatory pre-cutover `pg_dump` / rollback capture | [`20260621:190-294`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L190-L294) never deletes rows or mutates `is_invalidated`. Repo still contains no reverse DDL; prod backup unverified | PG16 Scenario 2 (`v_total = 8`, `is_invalidated = 0`); live prod backup external | **MITIGATED IN DDL; PROD BACKUP GATE OPEN** |
| **F-05** *(Medium: Undropped `"Users can insert their own profiles"` & CI exclusion)* | Drop policy + remove CI `profiles` exemption + add `TX 12B` | [`20260621:139`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L139) drops `"Users can insert their own profiles"`; [`verify_migrations.sql:74-89`](../../tests/db/verify_migrations.sql#L74-L89) removes exclusion; [`TX 12B`](../../tests/db/verify_migrations.sql#L1334-L1356) grants `INSERT` and proves `42501` denial | PG16 CI [`42906375928`](https://github.com/Rudra4451/practice/actions/runs/42906375928) `TX 1` & `TX 12B` | **FIXED** |
| **F-06** *(Medium: `idx_test_results_leaderboard` silent no-op against `FULL_SCHEMA.sql`)* | Catalog predicate/key inspection + drop only on mismatch + `FULL_SCHEMA` CI scenario | [`20260621:66-113`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L66-L113) normalizes `pg_get_expr(indpred)` to `'user_idisnotnullandis_invalidated=falseandis_ranked=true'`; Scenario 2 upgrades `FULL_SCHEMA.sql`; Scenario 3 asserts OID unchanged on rerun | PG16 CI [`42906375928`](https://github.com/Rudra4451/practice/actions/runs/42906375928) Scenarios 2 & 3 | **FIXED** |
| **F-07** *(Medium: Partial fn revoke, exposed `is_reserved_username`, permissive shim gap)* | Dynamic non-extension `pg_proc` revoke + `search_path = public, pg_catalog` + Supabase-faithful shim | [`20260621:914-952`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L914-L952) revokes `PUBLIC, anon, authenticated` dynamically where `deptype <> 'e'`, grants only `service_role` on `submit_verified_result` & `is_reserved_username`; [`supabase_shim.sql:89-92`](../../tests/db/supabase_shim.sql#L89-L92) grants default fn ACLs; Scenario 2 tests `legacy_sql_editor_helper()` | PG16 CI [`42906375928`](https://github.com/Rudra4451/practice/actions/runs/42906375928) `TX 1`, `TX 6`, `TX 7` & Scenario 2 | **FIXED** |
| **F-08** *(Medium: Legacy outlier promotion, PB `is_ranked` omission, lowercase lookup)* | Historical `is_ranked = FALSE` quarantine + PB filter + `idx_profiles_username_lower` + TS `.ilike` & `is_ranked` parity | [`20260621:190-294,755,847,63-64`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L190-L294) quarantines Cat A–E + short tuple arrays cleanly; [`lib/data/profile.ts:51-177`](../../lib/data/profile.ts#L51-L177), [`lib/data/leaderboard.ts:138-140`](../../lib/data/leaderboard.ts#L138-L140), [`dashboard/page.tsx:184-232`](../../app/dashboard/page.tsx#L184-L232) align + handle pre-`is_ranked` schemas. *(Note: TS persistence fallback omits `is_ranked` by design while pre-hardening DB lacks column; post-cutover RPC enforces `tr.is_ranked = TRUE`.)* | PG16 CI [`42906375928`](https://github.com/Rudra4451/practice/actions/runs/42906375928) `TX 8` + Scenario 2; [`__tests__/data/profile.test.ts`](../../__tests__/data/profile.test.ts) | **FIXED** |
| **F-09** *(Low: Missing `lock_timeout` & non-atomic `DROP VIEW` / `CREATE POLICY` restart risk)* | Explicit `BEGIN; SET LOCAL lock_timeout = '5s'; ... COMMIT;` + defensive `DROP POLICY IF EXISTS` | Both [`20260621`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L11-L13) & [`20260622`](../../supabase/migrations/20260622000000_learning_and_competitive_ecosystem.sql#L6-L8) enforce `lock_timeout = '5s'` atomically, drop policies before creating, and replace `leaderboard_view` atomically. Non-`CONCURRENTLY` index lock acceptable at `170` rows in maintenance pause | PG16 CI [`42906375928`](https://github.com/Rudra4451/practice/actions/runs/42906375928) Scenario 3 double rerun | **FIXED** |
| **F-10** *(Low: `20260622` orphan tables & `challenge_attempts` `USING (true)` leak)* | Restrict `challenge_attempts` `SELECT` to non-expired parent links | [`20260622:72-83`](../../supabase/migrations/20260622000000_learning_and_competitive_ecosystem.sql#L72-L83) drops permissive policy and enforces parent `cl.expires_at > now()`. *(Deferred tables `user_progression`, `user_lesson_progress`, `challenge_attempts` still have `0` app callers — intentional forward schema.)* | PG16 CI [`42906375928`](https://github.com/Rudra4451/practice/actions/runs/42906375928) `TX 1`, `TX 9`–`TX 11` | **FIXED** |
| **F-11** *(Low: Partial-orphan retry skips replay parity until replay exists)* | Mitigated via server-side verification + row lock | Unchanged in SQL ([`20260621:587-593,727`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L587-L593)): `POST /api/results` & `/api/results/sync` recompute `verifyAndScoreSession` server-side before RPC, and duplicate `client_run_id` recovery serializes under `SELECT ... FOR UPDATE` | [`__tests__/typing/persistence.test.ts`](../../__tests__/typing/persistence.test.ts); PG16 Scenario 1 contention barrier | **MITIGATED (ACCEPTABLE)** |
| **F-12** *(Info: Mutable action tags & stale PR #2 doc claims)* | Pinned actions & synced `PHASE_1D/1E/1F` docs | `actions/checkout` SHA-pinned; LF/filename checks in CI; `PHASE_1D/1E/1F` updated cleanly. **However, [`FINAL_ENGINEERING_RELEASE_REPORT.md`](../../docs/roadmap/FINAL_ENGINEERING_RELEASE_REPORT.md) §4 now exhibits new staleness (`f9f3940` / old CI runs instead of `6d1042d` / new CI runs)** | Verified directly against `.github/workflows/*.yml` and `docs/roadmap/FINAL_ENGINEERING_RELEASE_REPORT.md` | **FIXED FOR PR #2 DOCS; NEW DOC UPDATE NEEDED IN FINAL REPORT** |

### 2.2 Focused Verification Notes

- **Profile `INSERT` Policy (`F-05`):** [`20260621:139`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L139) removes `"Users can insert their own profiles"`; [`verify_migrations.sql:81-89`](../../tests/db/verify_migrations.sql#L81-L89) verifies zero remaining non-`SELECT` policies except hardened `profiles` `UPDATE`; [`TX 12B`](../../tests/db/verify_migrations.sql#L1334-L1356) grants `INSERT` transiently inside a rollback block and proves `authenticated` still hits `42501` RLS rejection.
- **Leaderboard Index & `FULL_SCHEMA.sql` (`F-03`, `F-06`):** `idx_test_results_leaderboard` in [`20260621:66-113`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L66-L113) inspects `pg_class`/`pg_index`/`pg_get_expr`, drops unfiltered (`FULL_SCHEMA.sql`) or stale predicates, preserves exact matches (proven via identical `oid` in Scenario 3), and `FULL_SCHEMA.sql` sits safely outside `supabase/migrations/` in [`supabase/reference/FULL_SCHEMA.sql`](../../supabase/reference/FULL_SCHEMA.sql).
- **Function Privileges (`F-07`):** All 4 routines (`is_reserved_username`, `enforce_profile_username_integrity`, `handle_new_user`, `submit_verified_result`) set `SET search_path = public, pg_catalog`. Dynamic sweep [`20260621:914-952`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L914-L952) locks down all non-extension `public` routines (exempting `deptype = 'e'` such as `uuid-ossp` and `pg_trgm`). Note one realistic operational detail: because `20260621` dynamically revokes `EXECUTE` on any custom out-of-band SQL Editor functions in `gbovkejymfeiqgverzfr`, owner catalog query #5/#2b must inspect custom `pg_proc` functions beforehand in case any external webhook/cron/dashboard dependency relies on them.
- **App / DB Backward & Forward Compatibility:** Confirmed cleanly via code inspection: PR #3's DAL and write layer gracefully degrade if run transiently against pre-hardening `gbovkejymfeiqgverzfr` (which `BATCH_1_1A` observed lacks `leaderboard_view`, `is_ranked`, `client_run_id`, and `submit_verified_result`), **provided `SUPABASE_SERVICE_ROLE_KEY` is configured** in hosting beforehand.

---

## 3. Migration Completeness (`20260618`–`20260624`) & Compatibility Matrix

### 3.1 Actual Repository Migration Chain vs. Historical `20260623`–`20260624`

In PR #2 (`19e8873`), unapplied hardening spanned four scripts (`20260621`, `20260622`, `20260623`, `20260624`). Because none of those had ever been applied to production `gbovkejymfeiqgverzfr`, Phase 1H commit `1f4961b` **deleted `20260623` and `20260624` and folded their complete DDL/PLpgSQL safely into [`20260621000000_typrox_2_hardening.sql`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql)**:

```text
[Existing Prod / Legacy Baselines]
  Option A (Tracked): 20260618 -> 20260619 -> 20260620
  Option B (SQL Editor): supabase/reference/FULL_SCHEMA.sql (+ out-of-band drift)
            │
            ▼  (Atomic Cutover Transaction 1: BEGIN; SET LOCAL lock_timeout = '5s'; ... COMMIT;)
  20260621000000_typrox_2_hardening.sql
     ├─ Schema/constraints: client_run_id, generator_version, is_ranked, streaks NULL last_active_date, drop single client_run_id UNIQUE
     ├─ Indexes: (user_id, client_run_id) partial unique, (user_id, created_at DESC), lower(username), catalog-reconciled idx_test_results_leaderboard
     ├─ Least privilege: REVOKE ALL tables/sequences -> SELECT only + column-restricted profiles UPDATE (NO username)
     ├─ Hardened RLS: drops 12 legacy policies (incl. profiles INSERT), adds test_results/replays/challenge_links privacy/expiry RLS
     ├─ Historical Quarantine: non-destructive is_ranked = FALSE on Cat A–E legacy outliers
     ├─ View: security_invoker = true public.leaderboard_view (is_ranked = TRUE)
     ├─ Functions/Triggers (Phase 1C / 20260624 parity): is_reserved_username, enforce_profile_username_integrity, concurrency-safe handle_new_user (16 retries), submit_verified_result v2 (13 args, RESULT_INVALIDATED, CLIENT_RUN_ID_CONFLICT, partial-orphan FOR UPDATE, self-healing streaks, ranked PB)
     └─ Dynamic pg_proc lockdown sweep + 11 achievement codes (ON CONFLICT DO NOTHING) + realtime test_results publication
            │
            ▼  (Atomic Cutover Transaction 2: BEGIN; SET LOCAL lock_timeout = '5s'; ... COMMIT;)
  20260622000000_learning_and_competitive_ecosystem.sql
     └─ user_progression, user_lesson_progress, challenge_attempts + SELECT-only RLS + expiry policy on challenge_attempts
```

### 3.2 Evaluation of PR #3 Inclusion & [`FINAL_ENGINEERING_RELEASE_REPORT.md` §5 Step 3](../../docs/roadmap/FINAL_ENGINEERING_RELEASE_REPORT.md#L76)

- **Does PR #3 contain all required migrations?** **Yes.** Although `20260623` and `20260624` no longer exist as standalone filenames, 100% of their corrected behaviors (atomic `submit_verified_result` v2, `(user_id, client_run_id)` partial unique index, `profiles.username` column revoke + trigger lock, `is_reserved_username` + dynamic `pg_proc` revoke, `handle_new_user()` retry loop, `"Users can insert their own profiles"` removal, streak self-healing, and `is_ranked = TRUE` PB enforcement) live inside [`20260621`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql). Applying `20260621` followed by `20260622` applies the entire security and feature schema cleanly.
- **What would break if `20260623` or `20260624` logic were omitted (historical/counterfactual risk check):**
  - *Omitting `20260623` logic (`submit_verified_result` + scoped `(user_id, client_run_id)` index):* Client writes remain revoked (`42501`), app hits legacy fallback `42883`/`PGRST202`, losing DB transactional atomicity (orphan `test_results` rows possible if serverless worker dies before rollback), losing concurrent duplicate protection, and losing `submit_verified_result` PB/achievement/streak atomicity.
  - *Omitting `20260624` logic (`username` REVOKE/trigger, `handle_new_user` retries, v2 guards, `"Users can insert their own profiles"` drop):* Authenticated users could overwrite/hijack reserved or locked handles directly via browser Supabase PostgREST calls, OAuth signup username collisions would abort signups, duplicate retries would conflict silently or advance streaks erroneously, invalidated runs could replay on `client_run_id`, legacy `profiles` `INSERT` policy would remain, and `is_reserved_username` / legacy functions would stay callable via RPC.
- **Critique of `FINAL_ENGINEERING_RELEASE_REPORT.md` §5 Step 3 ("pause traffic -> apply `20260621` + `20260622` -> merge & deploy app"):**
  - **SQL Set (`20260621` then `20260622` + `NOTIFY pgrst, 'reload schema';`): CORRECT.**
  - **Cutover Ordering (`DB before App`): UNSAFE UNLESS PUBLIC TRAFFIC IS 100% DISABLED.** While live Vercel continues serving current `origin/main` (`fba1d80`), applying `20260621` *immediately* causes HTTP `500` errors on `/api/leaderboard` (`PGRST200` nested `profiles(...)` on flat `leaderboard_view`, unmasked by `fba1d80`'s `42P01`-only catch) and `42501` errors across `POST /api/results`, `UsernameModal`, dashboard sync, and challenge creation.
  - **Proven Zero-Downtime Order (Once Env Secrets Are Provisioned):** **Env Secrets -> Merge & Deploy PR #3 FIRST (verify Vercel Production `Ready`) -> Execute `20260621` -> `20260622` -> `NOTIFY pgrst, 'reload schema';`.** Because PR #3 falls back cleanly on missing `leaderboard_view` (`PGRST205`), missing `is_ranked` (`42703`/`PGRST204`), missing `client_run_id`, and missing `submit_verified_result` (`PGRST202`/`42883`) while writing via `service_role`, deploying PR #3 *first* retires incompatible `origin/main` gracefully with zero downtime!

### 3.3 Application / Database Compatibility Matrix

| Scenario (App Version vs. DB State) | Leaderboard (`/leaderboard`, `/api/leaderboard`) | Score Save (`POST /api/results`, `/sync`) | Onboarding & Settings (`/api/profile`, Modal) | Challenge Share (`POST /api/challenges`, `/challenge/[id]`) | Dashboard & `/u/[username]` | Verdict |
|---|---|---|---|---|---|---|
| **`origin/main` (`fba1d80`) + Pre-Hardening Prod** *(no view, permissive RLS)* | Works (uses `test_results` fallback) | Works via SSR `authenticated`, but unverified client WPM, non-atomic, no `client_run_id` | Works (direct browser `profiles` update from `UsernameModal`) | Works via client `INSERT` | Works (exposes `__debug_test__` & outliers) | **Live Pre-Cutover Baseline (Insecure)** |
| **`origin/main` (`fba1d80`) + Post-Hardening (`20260621+20260622`)** | **BREAKS (`HTTP 500`):** `PGRST200` nested `profiles(...)` on flat `leaderboard_view` | **BREAKS (`42501`):** `test_results`/`replays`/`streaks`/`user_achievements` writes revoked | **Modal BREAKS (`42501`):** browser `profiles.username` write revoked | **Creation BREAKS (`42501`)** | Partially works (`SELECT`), `/api/debug/supabase` still present | **OUTAGE — Never run `20260621` ahead of PR #3 under live traffic** |
| **PR #3 (`6d1042d`, NO `SUPABASE_SERVICE_ROLE_KEY` in Prod)** | Works pre- & post-`20260621` (`SELECT` only) | **BREAKS (`503 ADMIN_CONFIG_MISSING`)** on every POST | Preference PATCH works; **Username onboarding BREAKS (`503`)** | **Creation BREAKS (`503`)** | Works | **BLOCKED — Must provision `SUPABASE_SERVICE_ROLE_KEY` before merge** |
| **PR #3 (`6d1042d`, WITH `SUPABASE_SERVICE_ROLE_KEY`) + Pre-Hardening Prod** *(no `20260620` view; verified `PGRST205` in `BATCH_1_1A`)* | **WORKS:** `PGRST205` fallback to `test_results`, skips missing `is_ranked` on `42703` ([`leaderboard.ts:100-157`](../../lib/data/leaderboard.ts#L100-L157)) | **WORKS:** catches `PGRST202`/`PGRST204`, falls back safely using `service_role` ([`persistence.ts:849-936`](../../lib/typing/persistence.ts#L849-L936)) | **WORKS:** `service_role` updates handle & preferences cleanly | **WORKS:** `service_role` writes `challenge_links` | **WORKS:** catches missing `is_ranked` cleanly | **SAFE ZERO-DOWNTIME BRIDGE WINDOW** *(Caveat: only breaks `/api/leaderboard` if prod unexpectedly had `20260620` view without `username` — Step 2 catalog query verifies)* |
| **PR #3 (`6d1042d`, WITH `SUPABASE_SERVICE_ROLE_KEY`) + Post-Hardening (`20260621+20260622`)** | **WORKS:** queries flat `security_invoker` `leaderboard_view` (`is_ranked = TRUE`) | **WORKS:** atomic 13-arg `submit_verified_result` RPC via `service_role` | **WORKS:** `authenticated` updates prefs; `service_role` locks onboarding handle once | **WORKS:** expiry RLS + server-authoritative benchmark | **WORKS:** owner replays, quarantined outliers, `.ilike` handle lookup | **TARGET HARDENED PRODUCTION STATE** |

---

## 4. Production Deployment Runbook (`gbovkejymfeiqgverzfr`)

> **Actor Responsibility Legend:** `[Owner / GitHub+Vercel+Supabase]` requires privileged dashboard/CLI credentials; `[CI]` is automated; **NEVER run `20260621`/`20260622` via untrusted third-party scripts or before Steps 1–6 complete.** Notice **Application Deployment (Step 6)** intentionally precedes **Database Migration Execution (Step 7)** for zero-downtime live rollout; the alternative maintenance-freeze option is also noted in Step 4.

1. **Production Backup Verification (`pg_dump` + PITR)**
   - In Supabase Dashboard (`gbovkejymfeiqgverzfr` -> Database -> Backups), verify whether Point-in-Time Recovery (PITR) is enabled or create an on-demand manual snapshot.
   - Because Free/Starter Supabase tiers lack automatic PITR, export an external logical backup + schema snapshot before any DDL:
     ```sh
     pg_dump "$PRODUCTION_DB_URL" --format=custom --no-owner --no-privileges -f "typrox_prod_pre_20260621_$(date -u +%Y%m%dT%H%M%SZ).dump"
     pg_dump "$PRODUCTION_DB_URL" --schema-only -f "typrox_prod_schema_pre_20260621.sql"
     ```
2. **Read-Only Production Catalog Inspection (Supabase SQL Editor)**
   - Execute strictly read-only inspection queries and archive the outputs (for both pre-flight verification and rollback reference):
     ```sql
     -- 2a. Existing RLS policies (check for custom policy names outside 20260618/20260619/FULL_SCHEMA)
     SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
     FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, cmd, policyname;

     -- 2b. Table grants & custom non-extension routine privileges + owners
     SELECT grantee, table_name, privilege_type
     FROM information_schema.role_table_grants
     WHERE table_schema = 'public' AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')
     ORDER BY table_name, grantee, privilege_type;

     SELECT p.oid::regprocedure AS sig, pg_get_userbyid(p.proowner) AS owner, p.prosecdef, p.proconfig,
            has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
            has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')
       AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e');

     -- 2c. Views, indexes (esp. idx_test_results_leaderboard & leaderboard_view), publication, mixed-case handles
     SELECT c.relname, c.relkind, c.reloptions FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'v';
     SELECT indexname, tablename, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;
     SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
     SELECT id, username, length(username) FROM public.profiles WHERE username !~ '^[a-z0-9_]{3,24}$' OR username <> lower(username);
     SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'handle_new_user';
     ```
   - *Action if custom-named permissive RLS policies appear in Query `2a`:* Append explicit `DROP POLICY IF EXISTS "<policy_name>" ON public.<table_name>;` statements before running cutover (otherwise PostgreSQL permissive `OR` semantics leave custom `SELECT`/`INSERT` loopholes open).
3. **Production Migration-History Verification (`supabase_migrations.schema_migrations`)**
   - Inspect whether CLI migration tracking already exists in production:
     ```sql
     SELECT to_regclass('supabase_migrations.schema_migrations') AS migration_table;
     SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version ASC;
     ```
   - *Decision rule:* Because production shows `11` achievements without `leaderboard_view`, SQL Editor changes likely occurred without full `20260618..20260620` CLI tracking. If using `supabase db push`, repair already-represented versions (`supabase migration repair --status applied 20260618000000 20260619000000 20260620100000` only after confirming state equivalence) so Supabase CLI does not crash attempting `CREATE TABLE public.profiles` from `20260618`! Otherwise apply `20260621` and `20260622` sequentially in Supabase Dashboard SQL Editor or `psql` with `-v ON_ERROR_STOP=1` and record their versions in `schema_migrations` if tracking is desired.
4. **Application Compatibility Check & Maintenance / Zero-Downtime Strategy**
   - Verify Query `2c` shows **no** old `20260620` `leaderboard_view` (already confirmed absent [`PGRST205`] by `BATCH_1_1A`).
   - **Recommended Zero-Downtime Cutover Order:** Provision Secrets (Step 5) -> Deploy PR #3 to Vercel Production (Step 6) -> Run DB Migrations (Step 7). *Why:* PR #3 degrades cleanly on pre-hardening `gbovkejymfeiqgverzfr`, whereas live `origin/main` crashes immediately (`PGRST200`/`42501`) if DB DDL executes before PR #3 goes live. *(If you strictly prefer running DB DDL before deploying PR #3, enable a Vercel maintenance page / firewall rule blocking traffic before Step 7 runs until Step 6 finishes.)*
5. **Required Environment, OAuth, Branch Protection & Integration Configuration**
   - **Vercel Production Env Vars (Set BEFORE Merge):**
     - `NEXT_PUBLIC_SUPABASE_URL` = `https://gbovkejymfeiqgverzfr.supabase.co`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = production anon key
     - `SUPABASE_SERVICE_ROLE_KEY` = **server-only secret** (`service_role` key; never `NEXT_PUBLIC_*`)
     - `NEXT_PUBLIC_SITE_URL` = exact canonical production HTTPS origin (without trailing slash)
   - **Supabase Auth Allowlist ([`OAUTH_SETUP.md`](../../OAUTH_SETUP.md)):** Set **Site URL** to canonical origin and list `${SITE_URL}/auth/callback` (plus intentionally permitted preview/local callbacks) under **Redirect URLs**.
   - **GitHub Repository Settings:** Protect `main` requiring at least `1` PR review + passing checks `"Application Quality, Builds & E2E"` and `"PostgreSQL 16 Migration Verification"`.
   - **Supabase Dashboard Check:** Verify under `gbovkejymfeiqgverzfr` -> Integrations / GitHub that **no** automatic migration push or uncoordinated Branching action executes `20260621` on `main` merge before Steps 5–6 are complete.
6. **Application Deployment (`GitHub Merge + Vercel Production` — Execute BEFORE Step 7 DDL under Zero-Downtime Order)**
   - Ensure pre-merge code/doc fixes in §7 are pushed to `release/typrox-2-integration` and CI checks pass on the final commit.
   - Close PR #2 (`ci/postgres-16-verification`) as superseded (`#2`).
   - Merge PR #3 into `main` on GitHub.
   - Wait for `vercel[bot]` Production deployment of `main` HEAD to reach **`Ready`** and confirm `/typing` + `/leaderboard` serve cleanly via pre-hardening fallbacks while `/api/debug/supabase` returns **`404`**.
7. **Database Migration Sequence (`gbovkejymfeiqgverzfr` — Manual/CLI Only, Never GitHub Actions)**
   - After backup (Step 1), catalog check (Step 2), and PR #3 Production `Ready` (Step 6):
     1. Execute [`supabase/migrations/20260621000000_typrox_2_hardening.sql`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql) atomically (`psql -v ON_ERROR_STOP=1` or single Supabase SQL Editor run; already wrapped in `BEGIN; SET LOCAL lock_timeout = '5s'; ... COMMIT;`).
     2. Execute [`supabase/migrations/20260622000000_learning_and_competitive_ecosystem.sql`](../../supabase/migrations/20260622000000_learning_and_competitive_ecosystem.sql) atomically.
     3. Refresh PostgREST schema cache immediately: `NOTIFY pgrst, 'reload schema';`.
     4. *(Optional owner moderation)* Review `is_ranked = FALSE` counts on historical rows (`170` baseline) and decide whether to permanently delete the `6` historical `user_id IS NULL AND seed = '__debug_test__'` rows.
8. **Post-Deployment Verification Probes**
   - **Anonymous Supabase REST Security Probes (using public `anon` key):**
     - `GET /rest/v1/replays?select=id` -> **`200` `[]` (`0` rows)** (anonymous replay leak closed).
     - `GET /rest/v1/test_results?user_id=is.null&select=id` -> **`200` `[]`**.
     - `GET /rest/v1/leaderboard_view?select=id,wpm,username&limit=5` -> **`200`** with flattened verified entries (`94 WPM` 3.97s quote & `226 raw_wpm` spam quarantined).
     - `POST /rest/v1/test_results` -> **`401`/`403` (`42501`)** denied.
     - `POST /rest/v1/rpc/submit_verified_result` and `POST /rest/v1/rpc/is_reserved_username` -> **`401`/`403`/`404` (`42501`)** denied to `anon` and signed-in `authenticated` JWTs.
   - **Live Production App & API Functional Verification:**
     - Visit `/`, `/typing`, `/learn`, `/daily`, `/leaderboard`, `/u/<known-username>`, and `/sitemap.xml` -> `200`, zero console errors, no placeholder `.example` errors.
     - Verify `/api/debug/supabase` -> **`404`**.
     - Sign in via OAuth -> complete onboarding username modal (new account) -> finish a `/typing` test -> verify `POST /api/results` returns `200` (`isPersonalBest`/`streakDays`), `/dashboard` renders new run & streak, reload `/api/results` or `ResultScreen` verify no duplicate row, test `POST /api/challenges` -> visit `/challenge/<id>`, and test preference sync on `/profile`.
9. **Recovery and Rollback Procedure**
   - **App Rollback:** Use Vercel Dashboard -> Deployments -> Instant Rollback *(only valid if `20260621` has NOT applied yet; if `20260621` has already applied, rolling back to `origin/main` `fba1d80` breaks `/leaderboard` and writes!)*.
   - **Database Rollback (No automated down-SQL exists in repo):**
     - *If `20260621` failed mid-transaction:* Transaction rolls back cleanly due to `BEGIN; ... COMMIT;` + `5s` `lock_timeout` with zero partial state.
     - *If rolling back after committed `20260621`/`20260622` cutover:* Restore the pre-cutover `pg_dump` snapshot taken in Step 1 (if zero post-cutover runs need keeping), **or** run forward-compatible reverse DDL drafted from Step 2 catalog outputs (re-granting table privileges, restoring previous `pg_policies`, restoring previous `handle_new_user()`, dropping `20260622` tables if unused) **plus warning:** never execute `ALTER TABLE public.streaks ALTER COLUMN last_active_date SET NOT NULL` blindly if newly onboarded post-cutover accounts exist with `last_active_date IS NULL` — backfill `COALESCE(last_active_date, CURRENT_DATE)` first!

---

## 5. Security & Application Quality Recheck

### 5.1 Independent Verification Across All 14 Areas

| # | Area | Inspected Implementation | Verdict |
|---|---|---|---|
| 1 | **Authentication & authorization** | [`AuthProvider`](../../components/providers/auth-provider.tsx#L67-L85) bootstraps strictly via `supabase.auth.getUser()`, ignoring `INITIAL_SESSION`; mutating/private APIs call SSR `supabase.auth.getUser()`; [`proxy.ts`](../../proxy.ts) delegates session refresh cleanly; [`app/auth/callback/route.ts`](../../app/auth/callback/route.ts) sanitizes `?next=` via [`sanitizeRedirectPath`](../../lib/security/redirect.ts#L10-L71) (blocks scheme, `//`, `\`, double-percent bypasses). | **PASS** |
| 2 | **RLS assumptions** | All `12` `public` tables enable RLS; client roles hold `SELECT` only (plus `authenticated` `UPDATE` on non-username `profiles` columns); `replays` owner-only (`EXISTS` on `test_results.user_id = auth.uid()`); `challenge_links` & `challenge_attempts` enforce `expires_at > now()`; `leaderboard_view` uses `security_invoker = true`. | **PASS** *(live custom policy audit still Step 2 gate)* |
| 3 | **Privileged database operations** | [`createAdminClient`](../../lib/supabase/admin.ts#L71-L97) (`server-only`) uses `SUPABASE_SERVICE_ROLE_KEY`; [`resolvePrivilegedWriteClient`](../../lib/supabase/admin.ts#L105-L129) throws `AdminConfigurationError` (`503 ADMIN_CONFIG_MISSING`) in `NODE_ENV === 'production'` rather than silently degrading to SSR client (`dev`/`test` fallback only). | **PASS** |
| 4 | **Result manipulation controls** | [`verifyAndScoreSession`](../../lib/typing/verifier.ts#L57-L230) deterministically regenerates `targetText = generateText(seed, mode, duration)` server-side, validates cursor/index/char parity, chronological timestamps (`duration + 20s` cap), minimum `3000ms` full-text floor, 15-keystroke `<20ms/char` burst rejection, `<2.0ms` uniform-interval autotyper detection, `wpm <= 260`, `rawWpm <= 320`. Never accepts client-sent WPM. | **PASS** |
| 5 | **Replay security** | `replays` `SELECT` restricted to owning `auth.uid()` ([`20260621:160-169`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L160-L169)); `POST /api/results` validates replay schema (`<=10,000` points, `512 KiB` body) before persistence. | **PASS** |
| 6 | **Rate limiting** | `POST /api/results` enforces DB-backed `8s` cooldown + in-memory recovery budget (`6/run`, `20/user`); `POST /api/results/sync` enforces `10m / 150-row` DB ceiling + sliding-window (`5 req/min`, `120 items/min`); `POST /api/challenges` & `PATCH /api/profile` enforce `20/min`. **Architectural Caveat:** All sliding-window `Map` caches in [`lib/security/rate-limit.ts:65-70,183-185`](../../lib/security/rate-limit.ts#L65-L70) are process-local (resets across serverless cold starts / multi-instance fanout), while DB cooldown and sync DB ceiling remain durable across instances. | **PASS (WITH KNOWN SINGLE-INSTANCE CAVEAT)** |
| 7 | **Origin & payload validation** | [`assertSameOriginIfPresent`](../../lib/security/http.ts#L60-L97) (`403` on mismatched `Origin` or `Origin: null`, reverse-proxy `x-forwarded-host` + `NEXT_PUBLIC_SITE_URL` aware) + [`readJsonBodyWithLimit`](../../lib/security/http.ts#L99-L152) (`413` before `JSON.parse` on `512 KiB` / `2 MiB` / `16 KiB` limits) active on all 5 mutating routes. Paste/drop blocked in [`TypingContainer`](../../components/typing/typing-container.tsx#L178,L433) and [`LessonRunnerClient`](../../components/learn/lesson-runner-client.tsx#L449,L461). | **PASS** |
| 8 | **Username security** | Enforced consistently in SQL trigger [`enforce_profile_username_integrity`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L359-L400) + `24`-term [`is_reserved_username`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L323-L357), [`PATCH /api/profile`](../../app/api/profile/route.ts#L22-L162), [`lib/security/username.ts`](../../lib/security/username.ts), and [`UsernameModal`](../../components/auth/username-modal.tsx#L41-L67). Client direct `username` column updates revoked; one-time lock returns `403 USERNAME_LOCKED`. | **PASS** |
| 9 | **Idempotency** | Partial unique index `(user_id, client_run_id)`, [`submit_verified_result`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L566-L745) duplicate vs `CLIENT_RUN_ID_CONFLICT` (`409`) vs `RESULT_INVALIDATED` (`409`) handling + serialized `FOR UPDATE` orphan recovery + [`ResultScreen`](../../components/typing/result-screen.tsx#L39-L120) `inFlightSubmissions` deduplication (also awaited during `handleShare` `L340-349`). | **PASS** |
| 10 | **Guest synchronization** | [`syncGuestHistoryBatches`](../../lib/typing/sync-client.ts#L102-L328) + [`POST /api/results/sync`](../../app/api/results/sync/route.ts) chunk up to `30` runs/request, re-verify every run server-side, preserve transient `429`/`207`/`5xx` items locally, quarantine permanent failures cleanly until manual retry, and skip legacy/unranked/non-bracket runs safely. | **PASS** |
| 11 | **Challenge verification** | [`POST /api/challenges`](../../app/api/challenges/route.ts#L68-L119) reads authoritative non-invalidated ranked-mode `test_results` row owned by caller (`403` otherwise), binds `7`-day expiry via `service_role`; [`getActiveChallengeById`](../../lib/data/challenge.ts#L33-L73) filters expired challenges. *(Note `challenge_attempts` table has no runtime caller yet.)* | **PASS** |
| 12 | **Realtime subscriptions** | [`DashboardPage`](../../app/dashboard/page.tsx#L301) and [`LeaderboardClient`](../../components/leaderboard/leaderboard-client.tsx#L158) guard `!isSupabaseRealtimeEnabled()` and remove channels on unmount; all user channels filter `user_id=eq.${userId}`. **MINOR DEFECT FOUND:** [`app/dashboard/performance-lab/page.tsx:124-165`](../../app/dashboard/performance-lab/page.tsx#L124-L165) subscribes to `lab-results-${userId}` (with `filter: user_id=eq.${userId}`) **without checking `!isSupabaseRealtimeEnabled()`**. Low prod risk (`*.supabase.co` passes `isSupabaseRealtimeEnabled()`), inconsistent in placeholder envs if a session object exists. | **MINOR DEFECT (FIX BEFORE MERGE)** |
| 13 | **Error handling** | Root & route boundaries [`app/error.tsx`](../../app/error.tsx), [`app/global-error.tsx`](../../app/global-error.tsx), [`app/not-found.tsx`](../../app/not-found.tsx), [`app/u/[username]/not-found.tsx`](../../app/u/[username]/not-found.tsx); retry banner in [`ResultScreen:408-440`](../../components/typing/result-screen.tsx#L408-L440); toast on failed remote preference save in [`app/profile/page.tsx:50-68`](../../app/profile/page.tsx#L50-L68); clean API `400/401/403/409/413/429/500/503` payloads without stack/SQL leaks. | **PASS** |
| 14 | **Secret exposure checks** | `.gitignore` blocks `.env*`; `.env.example` contains placeholders only; `/api/debug/supabase` & `/api/test-supabase` deleted; `SUPABASE_SERVICE_ROLE_KEY` accessed solely in `server-only` [`lib/supabase/admin.ts`](../../lib/supabase/admin.ts); `0` hardcoded credentials found. | **PASS** |

### 5.2 Accuracy Check of [`FINAL_ENGINEERING_RELEASE_REPORT.md`](../../docs/roadmap/FINAL_ENGINEERING_RELEASE_REPORT.md)

1. **§5 Step 3 Cutover Sequence (`L76`):** Incorrectly states DB migrations should apply *before* merging & deploying PR #3 without warning of immediate live `origin/main` `PGRST200`/`42501` breakage unless public traffic is blocked; contradicts zero-downtime compatibility engineered into PR #3.
2. **§4 Stale Commit & Run IDs (`L56-L66`):** Ends history at `f9f3940` and links CI runs `42905679038` / `42905679421` (`f9f3940`) rather than PR #3 HEAD `6d1042d` and actual HEAD CI runs `42906375928` / `42906375949` / `42906362540`.
3. **§2 Realtime Coverage (`L30`):** Claims placeholder Realtime WebSocket guards cleanly cover client subscriptions without catching the omitted `isSupabaseRealtimeEnabled()` check in [`PerformanceLabPage`](../../app/dashboard/performance-lab/page.tsx#L124-L165).

---

## 6. Verification Evidence Matrix (`6d1042d`) & Coverage Limitations

### 6.1 Directly Verified Local, CI & Vercel Checks on Exact HEAD `6d1042d`

| # | Verification Area | Command / Run Target | Observed Output & Evidence | Outcome |
|---|---|---|---|---|
| 1 | **TypeScript** | `npm run typecheck` (`tsc --noEmit --incremental false`) | Clean compilation (`0` diagnostics) locally & in CI [`42906375949`](https://github.com/Rudra4451/practice/actions/runs/42906375949) | **PASS (`0`)** |
| 2 | **ESLint** | `npm run lint` (`eslint`) | Clean repository lint (`0` warnings/errors) locally & in CI [`42906375949`](https://github.com/Rudra4451/practice/actions/runs/42906375949) | **PASS (`0`)** |
| 3 | **Unit Tests** | `npm run test:unit` (`vitest run`) | `26 passed (26)` files, `132 passed (132)` tests (mocked Supabase clients) | **PASS (`0`)** |
| 4 | **E2E Tests** | `npm run test:e2e` (`playwright test`, Chromium) | `7 passed` (`53.7s` locally on offline placeholder `example.supabase.co`, `1.4m` in CI [`42906375949`](https://github.com/Rudra4451/practice/actions/runs/42906375949)) | **PASS (`0`)** |
| 5 | **Webpack Prod Build** | `npx next build --webpack` | Next.js `16.4.6 (webpack)`, `33/33` pages + strict route types (`17.4s` compile, `7.1s` TS) | **PASS (`0`)** |
| 6 | **Turbopack Prod Build** | `npm run build` | Next.js `16.4.6 (Turbopack)`, `33/33` pages, `ƒ Proxy (Middleware)` (`1.17s` compile, `3.4s` TS) | **PASS (`0`)** |
| 7 | **PostgreSQL 16 Migrations** | Live GitHub Actions [`42906375928`](https://github.com/Rudra4451/practice/actions/runs/42906375928) (`postgres:16-alpine`); Local Windows `sh -n tests/db/run-pg-verification.sh` | **CI `42906375928` (`6d1042d`): `SUCCESS` (`35s`)** across Scenarios 1–3 (`ALL_MIGRATION_INVARIANTS_PASSED`, lock contention verified). Local Windows shell syntax `exit 0`; local PG16 execution `exit 127` / `npm run test:db` `exit 1` (no `docker`/`psql`/`sh` on host) | **PASS IN CI (`0`); LOCAL HOST BLOCKED (`127`)** |
| 8 | **Dependency Audit** | `npm audit --omit=dev`; `npm audit` | Production tree: **`found 0 vulnerabilities`** (`exit 0`). Full tree: `7 moderate` **dev-only** (`minimatch` 7.0.0–11.0.0 in `@typescript-eslint/typescript-estree` under `eslint-config-next`, `exit 1`) | **PASS PROD (`0`) / 7 DEV MODERATE** |
| 9 | **GitHub Actions CI** | All checks on `6d1042d4adee7f7991a593f8facbd7648911f614` | `PostgreSQL 16 Migration Verification` [`42906375928`](https://github.com/Rudra4451/practice/actions/runs/42906375928) (`pull_request`, `35s`); `Application Quality, Builds & E2E` [`42906375949`](https://github.com/Rudra4451/practice/actions/runs/42906375949) (`pull_request`, `3m36s`) & [`42906362540`](https://github.com/Rudra4451/practice/actions/runs/42906362540) (`push`, `3m24s`) | **ALL `SUCCESS`** |
| 10 | **Vercel Preview** | Deployment `7694923091` on `6d1042d` (`vercel[bot]`) | `state: success` (`Preview`), URL `https://typrox-1pfsn8zec-ty-prox.vercel.app`, GitHub `Vercel` status + `Vercel Preview Comments` `SUCCESS` | **PASS (`SUCCESS`)** |

### 6.2 What Current Tests Do NOT Prove (Honesty Boundaries)

1. **Mocked vs. Live Auth/PostgREST Integration:** All `132` Vitest tests stub `@/lib/supabase/*` in memory, and all `7` Playwright E2E tests run unauthenticated against offline placeholder env (`https://example.supabase.co`). Real Supabase OAuth (`Google`/`GitHub`), PostgREST schema-cache behavior, and end-to-end authenticated `POST /api/results` -> `submit_verified_result` -> `ResultScreen` / `PATCH /api/profile` / `POST /api/challenges` flows against hosted Supabase remain untested in CI.
2. **Hosted Supabase Shim Approximations:** PG16 CI (`16.15`) uses [`tests/db/supabase_shim.sql`](../../tests/db/supabase_shim.sql) rather than hosted Supabase's full internal `supabase_admin` / PostgREST runtime; custom SQL Editor grants, policies, triggers, or data already inside live `gbovkejymfeiqgverzfr` are outside CI scope.
3. **Single-Instance Rate Limiting:** `challengeWindowCache`, `profileUpdateWindowCache`, `recoveryRunWindowCache`, `syncWindowCache`, and `recentRunCache` in [`lib/security/rate-limit.ts`](../../lib/security/rate-limit.ts) are not distributed across horizontal serverless workers.
4. **Unused `20260622` Runtime Paths:** `user_progression`, `user_lesson_progress`, and `challenge_attempts` are verified at DDL/RLS/policy level in PG16 CI, with zero application runtime callers implemented yet.

---

## 7. Remaining Risks, Required Corrections & Release Readiness Summary

### 7.1 Required Pre-Merge Actions on PR #3 (`APPROVE WITH SPECIFIC REQUIRED CORRECTIONS.`)

1. **Update [`docs/roadmap/FINAL_ENGINEERING_RELEASE_REPORT.md`](../../docs/roadmap/FINAL_ENGINEERING_RELEASE_REPORT.md):**
   - Replace the unsafe §5 Step 3 cutover order with the zero-downtime sequence (`Env secrets -> App deploy PR #3 -> DB 20260621 + 20260622 -> NOTIFY pgrst, 'reload schema'`), or mandate a full maintenance freeze before any DDL runs.
   - Update §4 from commit `f9f3940` / runs `42905679038`/`42905679421` to final HEAD `6d1042d` and runs `42906375928`/`42906375949`/`42906362540` (and reflect the Performance Lab guard below once patched).
2. **Guard Realtime Subscription in [`app/dashboard/performance-lab/page.tsx:125-127`](../../app/dashboard/performance-lab/page.tsx#L125-L127):**
   - Import [`isSupabaseRealtimeEnabled`](../../lib/supabase/client.ts#L27-L48) and change `if (!userId) return;` to `if (!userId || !isSupabaseRealtimeEnabled()) return;`, matching [`DashboardPage`](../../app/dashboard/page.tsx#L301) and [`LeaderboardClient`](../../components/leaderboard/leaderboard-client.tsx#L158), then verify CI passes on the updated HEAD.
3. **Complete Host & Repository Governance Prerequisites Before Merging:**
   - Enable GitHub branch protection on `main` (require approval + `"Application Quality, Builds & E2E"` + `"PostgreSQL 16 Migration Verification"` checks).
   - Provision `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SITE_URL` in Vercel Production **before** merge (`vercel[bot]` auto-deploys `main`).
   - Confirm in Supabase Dashboard that no Supabase GitHub App auto-applies `supabase/migrations/` ahead of Step 5/6.
   - Close PR #2 (`#2`) as superseded when merging PR #3.

### 7.2 Remaining Operational Risks Before Production Database Cutover (`BLOCKED BY PRODUCTION EVIDENCE.`)

- Live `gbovkejymfeiqgverzfr` catalog unknowns (`pg_policies` custom permissive policies, custom `pg_proc` functions impacted by the dynamic revoke sweep, `supabase_migrations.schema_migrations` version alignment, and custom profile-handle casing).
- Absence of confirmed PITR / exported external `pg_dump` backup prior to cutover.
- Unconfirmed Vercel Production secrets (`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`) and Supabase Auth callback allowlist.
- Non-distributed in-memory API sliding-window rate limits in [`lib/security/rate-limit.ts`](../../lib/security/rate-limit.ts) (acceptable for initial launch scale alongside DB cooldowns, future upgrade candidate to Upstash Redis if traffic scales horizontally).
- Owner moderation disposition on the `6` historical `user_id IS NULL` (`__debug_test__`) rows (`is_ranked = FALSE` hides them safely without deletion).
