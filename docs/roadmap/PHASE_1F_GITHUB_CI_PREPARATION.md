# TyProX 2.0 — Phase 1F: GitHub Actions PostgreSQL 16 CI Preparation Report

**Date:** 2026-11-11  
**Target GitHub Repository:** `Rudra4451/practice` (`https://github.com/Rudra4451/practice.git`, `PUBLIC`, Actions enabled)  
**Target Production Supabase Ref (Untouched):** `gbovkejymfeiqgverzfr`  
**Execution Status:** **PREPARATION & AUDIT COMPLETE — AWAITING OWNER APPROVAL TO COMMIT AND PUSH (`0` commits, `0` pushes, `0` app/migration edits performed)**

---

## 1. Current Branch & Repository State

Inspected directly via `git branch -vv`, `git status -uall --porcelain`, `git status --ignored --porcelain`, `git diff --stat`, `git config --show-origin`, and `gh` read-only queries:

- **Active Local Branch:** `main` at [`fba1d80`](file:///c:/Users/rudra/TyProX/.git) (*Merge pull request #1 from Rudra4451/feature/cat-reaction-system*), tracking `origin/main` with `0` ahead / `0` behind.
- **Git Index (Staged Changes):** Empty (`0` files staged).
- **Remote Baseline (`origin/main`):** Contains only legacy database files [`20260618000000_init_schema.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260618000000_init_schema.sql), [`20260619000000_audit_hardening.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260619000000_audit_hardening.sql), [`20260620100000_leaderboard_view.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260620100000_leaderboard_view.sql), and [`FULL_SCHEMA.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/FULL_SCHEMA.sql). Zero `.github/workflows/*` CI files exist on `origin/main` (`pages-build-deployment` is dynamic Pages only).
- **Total Working-Tree Inventory (Including This Report):** `170` dirty/untracked paths (`47` modified tracked `M`, `11` deleted tracked `D`, `112` untracked `??`) plus `6` `.gitignore`-ignored items (`!!`):
  - **Intended for DB Verification Branch:** `12` untracked files (`9` mandatory CI/harness/migration files + `3` Phase 1D–1F verification reports).
  - **Explicitly Excluded Uncommitted Work:** `158` paths (`47` modified + `11` deleted + `100` untracked app/test/audit/earlier-roadmap files).
  - **Explicitly Excluded Ignored Artifacts:** `6` `.gitignore` items (`.env.local`, `.next/`, `next-env.d.ts`, `node_modules/`, `test-results/`, `tsconfig.tsbuildinfo`).
- **Line-Ending & Mode Settings:** Global Windows Git sets `core.autocrlf = true`; repo sets `core.filemode = false`; no `.gitattributes` file exists. All `9` core SQL/shell/YAML files verified `CR=0` (`LF` only) on disk, and `sh -n tests/db/run-pg-verification.sh` exits `0`.
- **Credential & Secret Scan:** Scanned all candidate modified/untracked files (without reading `.env.local`) for `eyJ...`, `sbp_...`, `postgres://`, and hardcoded `service_role` keys: **zero secrets found** (`package-lock.json` integrity hashes only; `tests/db/*` uses `@typrox.test` synthetic addresses and ephemeral localhost CI password `typrox_ci_pg_password`).

---

## 2. Exact Files Intended for the Branch (`12` Files)

All required Phase 1C, Phase 1D, Phase 1E, and Phase 1F PostgreSQL 16 verification artifacts are accounted for and currently untracked on disk:

### 2.1 Mandatory CI, Harness & Candidate Migration Files (`9` Files)

| # | Path | Origin Phase | Role on Branch | Bytes / LF Lines (`CR=0`) |
|---|---|---|---|---|
| 1 | [`.github/workflows/ci-postgres-verification.yml`](file:///c:/Users/rudra/TyProX/.github/workflows/ci-postgres-verification.yml) | 1C -> 1E -> **1F** (`pull_request.branches: [main]`) | Runs PG 16 service container CI | `3,322` B / `93` LF (`CR=0`) |
| 2 | [`docker-compose.db.yml`](file:///c:/Users/rudra/TyProX/docker-compose.db.yml) | 1C -> 1E | Ephemeral `postgres:16-alpine` local harness | `720` B / `30` LF (`CR=0`) |
| 3 | [`tests/db/supabase_shim.sql`](file:///c:/Users/rudra/TyProX/tests/db/supabase_shim.sql) | 1C -> 1E | Supabase role/JWT/auth/realtime compatibility shim | `3,447` B / `88` LF (`CR=0`) |
| 4 | [`tests/db/verify_migrations.sql`](file:///c:/Users/rudra/TyProX/tests/db/verify_migrations.sql) | 1C -> 1E | `TX 1`–`TX 13` catalog, RLS, privilege, view & RPC proofs | `54,025` B / `1,182` LF (`CR=0`) |
| 5 | [`tests/db/run-pg-verification.sh`](file:///c:/Users/rudra/TyProX/tests/db/run-pg-verification.sh) | 1C -> 1E | Sequential runner + deterministic 2-worker contention barrier | `11,531` B / `305` LF (`CR=0`) |
| 6 | [`supabase/migrations/20260621000000_typrox_2_hardening.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260621000000_typrox_2_hardening.sql) | Phase 1 / 1B (Untouched) | Security hardening, RLS lockdown, `leaderboard_view`, 11 achievements | `8,894` B / `214` LF (`CR=0`) |
| 7 | [`supabase/migrations/20260622000000_learning_and_competitive_ecosystem.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260622000000_learning_and_competitive_ecosystem.sql) | Phase 4 / 5 (Untouched) | Curriculum, progression, challenge attempt tables & RLS | `3,265` B / `71` LF (`CR=0`) |
| 8 | [`supabase/migrations/20260623000000_atomic_result_persistence_and_idempotency.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260623000000_atomic_result_persistence_and_idempotency.sql) | Phase 1B (Untouched) | Scoped `(user_id, client_run_id)` index + `submit_verified_result` v1 | `12,729` B / `360` LF (`CR=0`) |
| 9 | [`supabase/migrations/20260624000000_phase1c_security_and_streak_fixes.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260624000000_phase1c_security_and_streak_fixes.sql) | Phase 1C (Untouched) | `profiles.username` REST guard, collision-safe `handle_new_user()`, RPC v2 | `22,978` B / `622` LF (`CR=0`) |

### 2.2 Companion Phase 1D–1F Database Verification Reports (`3` Files, Included for PR Audit Trail)

| # | Path | Origin Phase | Purpose |
|---|---|---|---|
| 10 | [`docs/roadmap/PHASE_1D_DATABASE_READINESS_REPORT.md`](file:///c:/Users/rudra/TyProX/docs/roadmap/PHASE_1D_DATABASE_READINESS_REPORT.md) | 1D | Migration readiness audit & identified harness blind spots |
| 11 | [`docs/roadmap/PHASE_1E_VERIFICATION_HARNESS_REPORT.md`](file:///c:/Users/rudra/TyProX/docs/roadmap/PHASE_1E_VERIFICATION_HARNESS_REPORT.md) | 1E | Harness remediation & deterministic lock-contention proof report |
| 12 | [`docs/roadmap/PHASE_1F_GITHUB_CI_PREPARATION.md`](file:///c:/Users/rudra/TyProX/docs/roadmap/PHASE_1F_GITHUB_CI_PREPARATION.md) | 1F | This CI branch scope, inventory, risk & command plan |

*(Already on `origin/main` @ `fba1d80` with zero modifications and automatically checked out in CI: `supabase/migrations/20260618000000_init_schema.sql`, `20260619000000_audit_hardening.sql`, `20260620100000_leaderboard_view.sql`, and `FULL_SCHEMA.sql`.)*

---

## 3. Files Explicitly Excluded and Why (`158` Dirty/Untracked + `6` Ignored)

### 3.1 Secrets, Generated Outputs & Ignored Local Artifacts (`6` Ignored Paths — NEVER Commit)

| Path | Git Status | Reason Excluded |
|---|---|---|
| `.env.local` | `!!` Ignored | **Contains live Supabase project URL and anon key.** Never stage or force-add (`-f`). |
| `.next/` | `!!` Ignored | Local Next.js build cache (unrelated to PG 16 SQL CI). |
| `node_modules/` | `!!` Ignored | Local npm packages (PG 16 CI runs SQL/shell only). |
| `next-env.d.ts` | `!!` Ignored | Generated Next.js TypeScript ambient declaration. |
| `test-results/` | `!!` Ignored | Local Playwright output (`.last-run.json`). |
| `tsconfig.tsbuildinfo` | `!!` Ignored | Incremental TypeScript compiler cache. |

### 3.2 Uncommitted Application, UI, Test & Dependency Work (`158` Paths — Excluded to Keep DB Verification PR Isolated)

Including these in the PG 16 CI branch would mix ~14,000 diff lines of application UI/API refactoring and npm dependencies into a database-only verification PR. Because `ci-postgres-verification.yml` calls `sh tests/db/run-pg-verification.sh` directly, **even [`package.json`](file:///c:/Users/rudra/TyProX/package.json) (`"test:db"`) and `package-lock.json` are excluded cleanly**:

1. **Modified Tracked Files (`47` Paths — All Excluded):**
   - Config, Lockfile & Root Docs (`5`): `.gitignore`, `README.md`, `next.config.ts`, `package.json`, `package-lock.json`.
   - App Routes & Pages (`16`): `app/api/auth/signout/route.ts`, `app/api/leaderboard/route.ts`, `app/api/profile/route.ts`, `app/api/results/route.ts`, `app/auth/callback/route.ts`, `app/challenge/[id]/page.tsx`, `app/dashboard/page.tsx`, `app/dashboard/performance-lab/page.tsx`, `app/globals.css`, `app/layout.tsx`, `app/leaderboard/page.tsx`, `app/login/page.tsx`, `app/page.tsx`, `app/profile/page.tsx`, `app/typing/page.tsx`, `app/u/[username]/page.tsx`.
   - Components (`17`): `components/auth/username-modal.tsx`, `components/home/{achievements,analytics,comparison,faq,hero-3d}.tsx`, `components/navbar.tsx`, `components/typing/{cat-companion,replay-player,result-chart,result-screen,text-display,typing-container}.tsx`, `components/ui/{animated-counter,button,skeleton,toast-container}.tsx`.
   - Constants, Lib, Stores, Utils & Workers (`9`): `constants/dictionaries.ts`, `lib/logger.ts`, `lib/supabase/{client,middleware,server}.ts`, `stores/{typing-store,user-store}.ts`, `utils/text-generator.ts`, `workers/analytics.worker.ts`.

2. **Deleted Tracked Files (`11` Paths — All Excluded):**
   - `app/api/debug/supabase/route.ts`, `app/api/test-supabase/route.ts`, `app/page.tsx.modified`, `app/showcase/page.tsx`, `lib/supabase.ts`, `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/robots.txt`, `public/vercel.svg`, `public/window.svg`.

3. **Remaining Untracked Non-DB Files (`100` Paths — All Excluded):**
   - Env template (`1`): `.env.example` (placeholder keys only, excluded as app config).
   - Unit & E2E Tests / Test Runners (`27`): `__tests__/**` (`23` Vitest suites), `tests/e2e/typrox.spec.ts` (`1`), `vitest.config.mts` (`1`), `vitest.setup.ts` (`1`), `playwright.config.ts` (`1`).
   - New App Routes & Error Boundaries (`12`): `app/api/challenges/route.ts`, `app/api/results/sync/route.ts`, `app/daily/page.tsx`, `app/dashboard/loading.tsx`, `app/error.tsx`, `app/global-error.tsx`, `app/leaderboard/loading.tsx`, `app/learn/page.tsx`, `app/learn/[slug]/page.tsx`, `app/not-found.tsx`, `app/u/[username]/loading.tsx`, `app/u/[username]/not-found.tsx`.
   - New Feature & UI Components (`9`): `components/challenge/challenge-arena-client.tsx`, `components/daily/daily-challenge-client.tsx`, `components/home/home-landing.tsx`, `components/leaderboard/leaderboard-client.tsx`, `components/learn/{learn-hub-client,lesson-runner-client}.tsx`, `components/providers/auth-provider.tsx`, `components/ui/{achievement-badge,user-avatar}.tsx`.
   - Curriculum & Type Definitions (`2`): `constants/curriculum.ts`, `types/database.ts`.
   - Audit & Pre-1D Roadmap Docs (`20`): `docs/audit/*` (`5` files) and earlier Phase 0–1C `docs/roadmap/*` documents (`15` files).
   - New Libraries & Assets (`29`): `lib/audio/*` (`1`), `lib/data/*` (`3`), `lib/hooks/*` (`1`), `lib/security/*` (`3`), `lib/supabase/admin.ts` (`1`), `lib/typing/*` (`7`), `lib/utils/*` (`1`), and `public/achievements/*` (`12` SVG icons).

---

## 4. Workflow Trigger & Migration Sequence Verification

Verified directly in [`.github/workflows/ci-postgres-verification.yml`](file:///c:/Users/rudra/TyProX/.github/workflows/ci-postgres-verification.yml) (`93` lines):

1. **Pull Requests Targeting `main` Confirmed ([`L13-L20`](file:///c:/Users/rudra/TyProX/.github/workflows/ci-postgres-verification.yml#L13-L20)):**
   - Added explicit `branches: [main]` under `on.pull_request` (alongside existing `paths:` covering `supabase/migrations/**`, `tests/db/**`, `docker-compose.db.yml`, and `.github/workflows/ci-postgres-verification.yml`).
   - Also retains `on.push` (with matching `paths:`, no branch restriction so pushing `ci/postgres-16-verification` immediately runs CI) and `on.workflow_dispatch` (usable once merged to `main`).
2. **Exact Candidate Migration Sequence Confirmed ([`run-pg-verification.sh:72-84`](file:///c:/Users/rudra/TyProX/tests/db/run-pg-verification.sh#L72-L84)):**
   1. `tests/db/supabase_shim.sql`
   2. `supabase/migrations/20260618000000_init_schema.sql`
   3. `supabase/migrations/20260619000000_audit_hardening.sql`
   4. `supabase/migrations/20260620100000_leaderboard_view.sql`
   5. `supabase/migrations/20260621000000_typrox_2_hardening.sql`
   6. `supabase/migrations/20260622000000_learning_and_competitive_ecosystem.sql`
   7. `supabase/migrations/20260623000000_atomic_result_persistence_and_idempotency.sql`
   8. `supabase/migrations/20260624000000_phase1c_security_and_streak_fixes.sql`
   - Excludes `supabase/migrations/FULL_SCHEMA.sql` intentionally. Runs `tests/db/verify_migrations.sql` (`TX 1`–`TX 13`) and the deterministic 2-worker contention barrier against ephemeral `postgres:16-alpine` (`typrox_verify_$$`).

---

## 5. Potential Git & CI Risks

| # | Risk | Impact & Mitigation |
|---|---|---|
| 1 | **Accidental `git add .` / `git commit -a` on Dirty Tree** | Running `git add .` or `git commit -a` would commit all `158` uncommitted app/test/doc paths. **Mitigation:** Stage ONLY the explicit `12` paths via `git add -- <paths>`, verify `git diff --cached --name-only`, and commit WITHOUT `-a`. |
| 2 | **Windows `core.autocrlf = true` Line-Ending Warnings** | Global Git config converts LF <-> CRLF on Windows checkouts while CI enforces `grep -nU $'\r'` (`CR=0`). Because `CR=0` is verified on disk right now, committing checks `LF` cleanly into Git objects (`i/lf`), so Ubuntu CI receives `LF`. Avoid re-saving `.sh`/`.sql`/`.yml` in CRLF editors or switching branches blindly over modified files; consider adding `.gitattributes` (`*.sh text eol=lf`, `*.sql text eol=lf`) in a follow-up commit. |
| 3 | **`workflow_dispatch` Unavailable Until Merged to `main`** | GitHub Actions does not allow manual `gh workflow run` / UI dispatch until `.github/workflows/ci-postgres-verification.yml` lands on default branch `main`. Pushing `ci/postgres-16-verification` (`on.push.paths`) and opening a PR (`on.pull_request.branches: [main]`) will trigger CI immediately without needing `workflow_dispatch`. |
| 4 | **POSIX File Mode `100644` vs `100755` on `run-pg-verification.sh`** | With `core.filemode = false` on Windows, `tests/db/run-pg-verification.sh` commits as `100644` unless `--chmod=+x` is set. Both CI (`sh tests/db/run-pg-verification.sh`) and `package.json` invoke `sh`, so CI still passes; optionally run `git update-index --chmod=+x tests/db/run-pg-verification.sh` after staging. |
| 5 | **Switching Back to `main` While App Changes Remain Uncommitted** | After committing the `12` DB files on `ci/postgres-16-verification`, those `12` paths do not exist on `fba1d80`. Switching back (`git switch main`) removes those `12` committed files from the working tree cleanly while preserving the `158` uncommitted app files — **never run `git reset --hard`, `git checkout -- .`, or `git clean -fd`** while uncommitted app work sits locally. |
| 6 | **CI Container / Apt Transient Surface & Clean-DB vs Production Drift** | Workflow uses mutable tags (`postgres:16-alpine`, `actions/checkout@v4`) and live `apt-get install postgresql-client` (transient mirror risk), and runs from an empty schema rather than production's `FULL_SCHEMA.sql` state (e.g., unfiltered `idx_test_results_leaderboard` hazard already flagged in [`PHASE_1D_DATABASE_READINESS_REPORT.md`](file:///c:/Users/rudra/TyProX/docs/roadmap/PHASE_1D_DATABASE_READINESS_REPORT.md#L151)). |

---

## 6. Exact Owner Commands to Branch, Commit, Push & Trigger CI

**Wait to run these until you approve creating and pushing the branch.** Execute sequentially in PowerShell from `c:\Users\rudra\TyProX`:

```powershell
# 1. Create the dedicated CI verification branch cleanly at fba1d80 (keeps local working tree untouched)
git switch -c ci/postgres-16-verification

# 2. Stage ONLY the exact 12 PostgreSQL 16 verification & migration files (NEVER use git add .)
git add -- `
  .github/workflows/ci-postgres-verification.yml `
  docker-compose.db.yml `
  tests/db/supabase_shim.sql `
  tests/db/verify_migrations.sql `
  tests/db/run-pg-verification.sh `
  supabase/migrations/20260621000000_typrox_2_hardening.sql `
  supabase/migrations/20260622000000_learning_and_competitive_ecosystem.sql `
  supabase/migrations/20260623000000_atomic_result_persistence_and_idempotency.sql `
  supabase/migrations/20260624000000_phase1c_security_and_streak_fixes.sql `
  docs/roadmap/PHASE_1D_DATABASE_READINESS_REPORT.md `
  docs/roadmap/PHASE_1E_VERIFICATION_HARNESS_REPORT.md `
  docs/roadmap/PHASE_1F_GITHUB_CI_PREPARATION.md

# Optional: record executable bit on the verification shell script in Git index
git update-index --chmod=+x tests/db/run-pg-verification.sh

# 3. SAFETY GATE: confirm ONLY the 12 expected files are staged (zero .env*, zero app/test files)
git diff --cached --name-only
git diff --cached --stat

# 4. Commit strictly the staged index (NEVER pass -a)
git commit -m "ci(db): verify candidate migrations and RLS invariants on PostgreSQL 16"

# 5. Inspect HEAD commit before pushing
git show --stat --summary HEAD

# 6. Push branch to Rudra4451/practice (triggers on.push.paths immediately)
git push -u origin ci/postgres-16-verification

# 7. Open PR targeting main (triggers on.pull_request.branches: [main]) and watch CI runs
gh pr create --repo Rudra4451/practice --base main --head ci/postgres-16-verification `
  --title "ci(db): PostgreSQL 16 verification for migrations 20260621-20260624" `
  --body "Isolated database CI verification branch covering candidate migrations 20260621..20260624, Supabase compatibility shim, SQL security/RLS invariants, deterministic lock-contention race proof, and GitHub Actions workflow. Zero production DB migrations or secrets included."

gh run list -R Rudra4451/practice --workflow "PostgreSQL 16 Migration Verification" -L 5
```

*(Note: After committing, `158` excluded modified/deleted/untracked app/test/doc files remain cleanly uncommitted in your local working tree and will NOT be pushed with `ci/postgres-16-verification`.)*
