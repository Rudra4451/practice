# TyProX 2.0 — Phase 1 Independent Diff Review & Commit Readiness

**Review Date:** 2026-11-10  
**Reviewer Role:** Independent Principal Engineer, Security Reviewer, Database Reviewer & QA Lead  
**Repository:** `c:\Users\rudra\TyProX` ([`https://github.com/Rudra4451/practice`](https://github.com/Rudra4451/practice))  
**Git Baseline:** Branch `main` at `fba1d80` (*Merge pull request #1 from Rudra4451/feature/cat-reaction-system*, parent `0fddf78`)  
**Target Supabase Ref (Observed Config):** `gbovkejymfeiqgverzfr`  
**Governance Compliance:** Strictly read-only code/DB review. Zero edits to application code, tests, SQL migrations, `.env*`, or live Supabase data/policies.

---

## Executive Decision: **`NOT APPROVED`**

Phase 1 remediation fixes several real defects cleanly (guest chunked sync, selective ID retention, early-completion bracket duration preservation, and `Hero3D` / `CatCompanion` / missing SVG regressions), and the default Turbopack build, ESLint, Vitest unit suite (`19` files, `84` tests), and unauthenticated Chromium E2E suite (`7` tests) currently exit `0`.

However, **Phase 1 is NOT ready for commit or production rollout** because deeper inspection of the actual diff and runtime execution paths exposes critical reliability and integrity gaps masked by mocked tests:

1. **`P0` Challenge Arena Config/Restart Bypass Corrupts Telemetry & Cleanup:** [`ChallengeArenaClient`](../../components/challenge/challenge-arena-client.tsx#L203) renders [`TypingContainer`](../../components/typing/typing-container.tsx#L329-L378) without `hideConfigBar` or `onRestartOverride`. Changing idle pills or pressing `Escape` / `Restart Test` switches the prompt seed to a random seed, causing guaranteed `400` verification failures on submit and skipping unmount cleanup (masked by mocking `TypingContainer` in [`challenge-arena-client.test.tsx`](../../__tests__/components/challenge-arena-client.test.tsx#L18-L20)).
2. **`P0` Rollback & Hardening Blockers Under Real Postgres RLS:** `.env.local` still lacks `SUPABASE_SERVICE_ROLE_KEY`, so [`createAdminClient()`](../../lib/supabase/admin.ts#L19-L22) returns `null` and downgrades writes to SSR `authenticated` context. In real Postgres (which has no `DELETE` policy on `test_results` in [`20260618`](../../supabase/migrations/20260618000000_init_schema.sql#L130-L135)), the compensating `DELETE` rollback in [`persistVerifiedResult`](../../lib/typing/persistence.ts#L616-L623) silently leaves orphaned rows on replay failures (masked by mocking `.delete()` success in unit tests). Meanwhile `public.replays` (`164` rows) remains `anon`-readable, and [`20260621000000_typrox_2_hardening.sql`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql) still carries blocking SQL defects (`DB-A1`, `DB-A2`, global `client_run_id UNIQUE`).
3. **`P1` App Router Route-Export Violation, Recovery Short-Circuit & Sync/Rate-Limit Gaps:** [`app/api/results/sync/route.ts:14`](../../app/api/results/sync/route.ts#L14) exports `MAX_SYNC_BATCH_SIZE = 30`, breaking `npx next build --webpack` and strict Next route typegen (`TS2344`); [`POST /api/results`](../../app/api/results/route.ts#L88-L97) short-circuits within 45s without recovering missing replays, updating streaks, checking achievements, or returning `isPersonalBest` / `streakDays`; `400`-rejected or invalid-duration legacy guest runs loop forever in `/dashboard`; and sync rate limiting uses process-local `Map` state.
4. **Undifferentiated Working Tree:** `58` modified/deleted tracked files (`6,755+ / 6,933-`) and `93` untracked file paths mix Phases 1–5 + Phase 1 remediation into one uncommitted heap.

**Production Database Gate Status:** **REMAINS BLOCKED** pending Owner catalog inspection, verified backup/PITR, `SUPABASE_SERVICE_ROLE_KEY` provisioning, SQL fixes to `20260621`, and owner sign-off.

---

## 1. Git & Uncommitted Change Inventory

### 1.1 Branch, Diff & Hygiene Summary (Verified)
- **Active Branch / HEAD:** `main` at `fba1d80` (`Merge pull request #1 from Rudra4451/feature/cat-reaction-system`; parent `0fddf78`).
- **`git diff --shortstat`:** `58 files changed, 6755 insertions(+), 6933 deletions(-)` (`47` modified tracked `M`, `11` deleted tracked `D`).
- **Untracked Paths (`git status --porcelain -uall`):** `38` top-level `??` entries totaling **`93` untracked files**.
- **`git diff --check`:** **PASS (`exit 0`)** — Windows LF→CRLF warnings only; zero trailing-whitespace bugs or conflict markers.
- **Environment Variable Names Checked (Values Withheld):**
  - [`.env.example`](../../.env.example): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`
  - `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (**missing** `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SITE_URL`)
- **Accidental Artifacts / Secrets / Dead Code Assessment:**
  - `.gitignore` excludes `.env*` (except `.env.example`), `.next/`, `test-results/`, `playwright-report/`, `coverage/`, and `*.tsbuildinfo`. No accidental screenshots, debug logs, temporary scripts, or secrets appear in tracked or untracked Git paths.
  - **Working-tree scope:** **Does NOT contain only intentional Phase 1 changes.** Phase 1 security hardening, Phase 2 typing-engine rewrites, Phase 3 RSC/UI redesign (`home`, `leaderboard`, `u/[username]`), Phase 4 curriculum/daily features, Phase 5 E2E infrastructure, and Post-Audit Remediation Phase 1 all sit together in one uncommitted tree — alongside lingering dead code (`DEBT-01`: `vite-tsconfig-paths` in [`package.json:45`](../../package.json#L45); `DEBT-02`: `utils/text-generator.ts` and unused `getClientSession()` in `lib/supabase/auth.ts`).

### 1.2 Complete Uncommitted File Inventory

<details>
<summary>Tracked Changes: 47 Modified (`M`) + 11 Deleted (`D`) = 58 Files</summary>

- **Deleted (`11`):**
  - `app/api/debug/supabase/route.ts` *(intentional `SEC-1.1` cleanup)*
  - `app/api/test-supabase/route.ts` *(intentional `SEC-1.1` cleanup)*
  - `app/page.tsx.modified`, `app/showcase/page.tsx`, `lib/supabase.ts` *(Phase 3 dead code cleanup)*
  - `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/robots.txt`, `public/vercel.svg`, `public/window.svg` *(replaced with `app/robots.ts` & Phase 3 asset cleanup)*
- **Modified (`47`):**
  - Core config/meta: `.gitignore`, `README.md`, `next.config.ts`, `package.json`, `package-lock.json`
  - API & Auth: `app/api/auth/signout/route.ts`, `app/api/leaderboard/route.ts`, `app/api/profile/route.ts`, `app/api/results/route.ts`, `app/auth/callback/route.ts`, `lib/supabase/client.ts`, `lib/supabase/middleware.ts`, `lib/supabase/server.ts`, `lib/logger.ts`
  - Pages & Styling: `app/challenge/[id]/page.tsx`, `app/dashboard/page.tsx`, `app/dashboard/performance-lab/page.tsx`, `app/globals.css`, `app/layout.tsx`, `app/leaderboard/page.tsx`, `app/login/page.tsx`, `app/page.tsx`, `app/profile/page.tsx`, `app/typing/page.tsx`, `app/u/[username]/page.tsx`
  - Components: `components/auth/username-modal.tsx`, `components/home/{achievements,analytics,comparison,faq,hero-3d}.tsx`, `components/navbar.tsx`, `components/typing/{cat-companion,replay-player,result-chart,result-screen,text-display,typing-container}.tsx`, `components/ui/{animated-counter,button,skeleton,toast-container}.tsx`
  - Stores, Workers & Data: `constants/dictionaries.ts`, `stores/typing-store.ts`, `stores/user-store.ts`, `utils/text-generator.ts`, `workers/analytics.worker.ts`

</details>

<details>
<summary>Untracked (`93` File Paths across `38` Top-Level Entries)</summary>

- **App Routes & Error Boundaries (`12`):** `app/api/challenges/route.ts`, `app/api/results/sync/route.ts`, `app/daily/page.tsx`, `app/dashboard/loading.tsx`, `app/error.tsx`, `app/global-error.tsx`, `app/leaderboard/loading.tsx`, `app/learn/page.tsx`, `app/learn/[slug]/page.tsx`, `app/not-found.tsx`, `app/u/[username]/loading.tsx`, `app/u/[username]/not-found.tsx`
- **Components (`9`):** `components/challenge/challenge-arena-client.tsx`, `components/daily/daily-challenge-client.tsx`, `components/home/home-landing.tsx`, `components/leaderboard/leaderboard-client.tsx`, `components/learn/learn-hub-client.tsx`, `components/learn/lesson-runner-client.tsx`, `components/providers/auth-provider.tsx`, `components/ui/achievement-badge.tsx`, `components/ui/user-avatar.tsx`
- **Libraries, Constants & Types (`15`):** `constants/curriculum.ts`, `lib/audio/keystroke-sound.ts`, `lib/data/{challenge,leaderboard,profile}.ts`, `lib/hooks/use-hydrated.ts`, `lib/security/{rate-limit,redirect}.ts`, `lib/supabase/admin.ts`, `lib/typing/{daily-challenge,metrics,persistence,replay-analyzer,sync-client,text-generator,verifier}.ts`, `lib/utils/format-date.ts`, `types/database.ts`
- **Tests & Tooling Config (`23`):** `.env.example`, `playwright.config.ts`, `vitest.config.mts`, `vitest.setup.ts`, `tests/e2e/typrox.spec.ts`, `__tests__/api/{challenges,leaderboard,profile,results,sync}.route.test.ts`, `__tests__/audio/keystroke-sound.test.ts`, `__tests__/components/{cat-companion,challenge-arena-client,result-screen,typing-container}.test.tsx`, `__tests__/learn/curriculum.test.ts`, `__tests__/security/redirect.test.ts`, `__tests__/stores/typing-store.test.ts`, `__tests__/typing/{metrics,persistence,replay-analyzer,sync-client,text-generator,verifier}.test.ts`
- **Assets, Migrations & Documentation (`34`):**
  - `public/achievements/` (`12` SVGs: `default`, `speed_{50,75,80,100,120,140,150}`, `streak_{3,7,14,30}`)
  - `supabase/migrations/{20260621000000_typrox_2_hardening,20260622000000_learning_and_competitive_ecosystem}.sql`
  - `docs/audit/*` (`5` files) and `docs/roadmap/*` (`11` files prior to this review)

</details>

---

## 2. Verified Fixes vs. Inaccurate / Overstated Report Claims

### 2.1 Genuine Phase 1 Improvements Verified in Source
- **Guest telemetry retention & chunked selective deletion:** [`useUserStore.addGuestResult`](../../stores/user-store.ts#L104-L116) keeps full `telemetry` across all `100` stored runs and deduplicates by `clientRunId` or `id`; [`syncGuestHistoryBatches`](../../lib/typing/sync-client.ts#L55-L170) sends sequential 30-item chunks, calls [`removeGuestResults`](../../stores/user-store.ts#L118-L127) strictly with `syncedIds` + `duplicateIds`, and halts cleanly on non-OK/partial failures (`207`, `429`, `500`, network errors) without wiping unpersisted, unranked, legacy, or `>30` runs.
- **`POST /api/results/sync` hardening:** [`app/api/results/sync/route.ts:69-208`](../../app/api/results/sync/route.ts#L69-L208) requires authenticated `getUser()`, gates on `checkSyncRateLimit` (`429` + `Retry-After`), blocks non-ranked modes (`skippedUnrankedIds`) and telemetry-less entries (`skippedLegacyIds`), deduplicates in-batch and cross-request by both `clientRunId` and full telemetry fingerprint (`deduplicateBySignature: true`), and returns HTTP `207` on partial failure / `500` on total failure without acknowledging `failedIds`.
- **Canonical bracket duration vs. elapsed time:** [`evaluateFinalSession`](../../lib/typing/metrics.ts#L172-L339) preserves configured bracket `duration` (`[15, 30, 60, 120]`) while using exact `totalElapsedMs` for WPM on `text_complete` and surfacing `elapsedSeconds`; [`verifier.ts:199-229`](../../lib/typing/verifier.ts#L199-L229), [`api/challenges/route.ts:76`](../../app/api/challenges/route.ts#L76), [`lib/data/challenge.ts:61`](../../lib/data/challenge.ts#L61), and [`ResultScreen`](../../components/typing/result-screen.tsx#L175-L180,L472-L482) preserve canonical brackets cleanly.
- **Non-destructive rollback scope & strict streak/achievement checks:** [`persistVerifiedResult`](../../lib/typing/persistence.ts#L504-L625) branches pre-existing (`existingRow`) and `23505`-raced rows (`racedRow`) directly into [`finalizeRecoveredResult`](../../lib/typing/persistence.ts#L326-L368) so `.delete()` rollback is never invoked on pre-existing records. [`updateDailyStreakForUser`](../../lib/typing/persistence.ts#L104-L202) and [`evaluateAndUnlockAchievements`](../../lib/typing/persistence.ts#L204-L292) now throw on DB write failures (ignoring `23505` races only).
- **Phase 1D visual & asset fixes:** [`Hero3D`](../../components/home/hero-3d.tsx#L540-L640) isolates `perspective: '1200px'` inside `isolate` and docks telemetry HUD cards below in a responsive grid; [`CatCompanion`](../../components/typing/cat-companion.tsx#L740-L796) uses opaque `bg-surface text-text-primary z-40` above `z-10`; [`public/achievements/`](../../public/achievements/speed_80.svg) now includes `speed_80.svg`, `speed_150.svg`, and `streak_14.svg`.

### 2.2 Inaccurate, Overstated, or Misleading Claims in Phase 1 Reports

| Report Claim & Citation | Verified Codebase / Runtime Reality | Verdict |
|---|---|---|
| [`IMPLEMENTATION_STATUS.md:95`](../../docs/roadmap/IMPLEMENTATION_STATUS.md#L95) & [`POST_IMPLEMENTATION_AUDIT.md:20,188`](../../docs/roadmap/POST_IMPLEMENTATION_AUDIT.md#L20): Both `ResultScreen` and `ChallengeArenaClient` render explicit **`role="alert"`** save-failure banners | [`ResultScreen:349`](../../components/typing/result-screen.tsx#L349) has `role="alert"`. [`ChallengeArenaClient:240-270`](../../components/challenge/challenge-arena-client.tsx#L240-L270) uses `<div className="mt-2 inline-flex ... text-error">` **without `role="alert"`** | **Incorrect** |
| [`IMPLEMENTATION_STATUS.md:95`](../../docs/roadmap/IMPLEMENTATION_STATUS.md#L95) & [`POST_IMPLEMENTATION_AUDIT.md:20,182`](../../docs/roadmap/POST_IMPLEMENTATION_AUDIT.md#L20): `[ENG-A2]` (`ChallengeArenaClient` unmount cleanup) and `[ENG-A1]` challenge integrity marked `[RESOLVED]` | [`ChallengeArenaClient:203`](../../components/challenge/challenge-arena-client.tsx#L203) omits `hideConfigBar` and `onRestartOverride`. Pressing `Escape`/`Restart Test` or clicking pills switches to a random seed, submitting wrong-seed telemetry (`400`) and defeating `current.seed === challenge.seed` cleanup (`lines 76-78`) | **Overstated** (`P0` regression) |
| [`DECISION_LOG.md:64`](../../docs/roadmap/DECISION_LOG.md#L64) (`ADR-010`) & [`IMPLEMENTATION_STATUS.md:96`](../../docs/roadmap/IMPLEMENTATION_STATUS.md#L96): `"roll back orphaned test_results rows cleanly if replays insert fails"` | `.env.local` lacks `SUPABASE_SERVICE_ROLE_KEY`, so `writeClient` is SSR `authenticated` context. Postgres `test_results` has **no `DELETE` RLS policy** ([`20260618:130-135`](../../supabase/migrations/20260618000000_init_schema.sql#L130-L135)), so compensating `.delete()` silently deletes 0 rows in production Postgres | **Overstated** (`P0` gap) |
| [`IMPLEMENTATION_STATUS.md:96`](../../docs/roadmap/IMPLEMENTATION_STATUS.md#L96): `client_run_id` idempotent retries across `/api/results` | [`app/api/results/route.ts:88-97`](../../app/api/results/route.ts#L88-L97) returns early on `rateCheck.latestRow` within 45s **before** calling `persistVerifiedResult`, skipping partial-write replay recovery, streaks, achievements, `isPersonalBest`, and `streakDays` | **Incomplete** (`P1` defect) |
| [`TESTING_REPORT.md:80,88`](../../docs/roadmap/TESTING_REPORT.md#L80): Build passes cleanly, and `sync-client.test.ts` tests `207` & `429` interruptions | `npm run build` (Turbopack) passes, **but** `npx next build --webpack` & Webpack typegen **FAIL (`TS2344`)** on [`app/api/results/sync/route.ts:14`](../../app/api/results/sync/route.ts#L14) (`export const MAX_SYNC_BATCH_SIZE = 30`). Also [`sync-client.test.ts:106-180`](../../__tests__/typing/sync-client.test.ts#L106-L180) never actually mocks or asserts a `429` response | **Incomplete / Overstated** |

---

## 3. Critical Code Review Across Areas A–E (Severity Ranked)

### Area Verification Matrix (At-a-Glance)

| Review Area | Verified Controls | Gaps / Defects Identified |
|---|---|---|
| **A. Guest History Sync** | Chunked `30`-item batching, selective `syncedIds`+`duplicateIds` removal, halts cleanly on `207`/`429`/network error, keeps legacy & unranked items, in-batch & DB signature dedup | **`P1-3`**: `400`-rejected & invalid-duration legacy guest items remain counted by `isSyncableGuestResult`, causing infinite retry loops in `/dashboard` UI; `sync-client.test.ts` never tests `429` or `rejectedIds` |
| **B. Result Persistence** | `client_run_id` optimistic insert + `PGRST204`/`42703` fallback + `23505` recovery; `updateDailyStreakForUser`/`evaluateAndUnlockAchievements` strict errors; pre-existing rows never hit `.delete()` | **`P0-2`**: Compensating `.delete()` rollback fails silently under RLS without `SUPABASE_SERVICE_ROLE_KEY`; **`P1-2`**: `/api/results` 45s short-circuit bypasses replay recovery/streaks/achievements/PB; `>=45s` retries omit `deduplicateBySignature`; **`P1-4`**: global `client_run_id UNIQUE` |
| **C. Typing Calculations** | `metrics.ts` & `verifier.ts` share `computeWpmFromChars`, cumulative `K_correct/K_total`, full timer denominator on `timer`, `totalElapsedMs` on `text_complete`, canonical `duration` bracket (`15/30/60/120`), consistent error accounting | **`P0-1`** indirectly breaks Challenge scoring/validation when challenger switches config or hits `Restart`/`Esc` |
| **D. Challenge Lifecycle** | Challenge creation validates ownership/ranked mode and normalizes bracket duration (`challenges/route.ts:76`); guest challenges save `isRanked: true` and canonical bracket | **`P0-1`**: `<TypingContainer />` missing `hideConfigBar` & `onRestartOverride={handleStartChallenge}`, breaking seed integrity, submit validation, and unmount cleanup; **`P2-1`**: missing `role="alert"` |
| **E. Security** | Strict `401` `getUser()` auth on `/api/results`, `/api/results/sync`, `/api/challenges`, `/api/profile`; `isRanked` enforced; server recomputes all scores; burst `<20ms` & jitter `>=2ms` checks; `sync` batch cap `30` + DB `150/10m` cap | **`P0-2`**: Live `replays` (`164` rows) still `anon`-readable (`20260621` unapplied); **`P1-5`**: Process-local `syncWindowCache` ineffective across instances; `SEC-A2` (no signed run-start token) & `SEC-A5` (`signout` `err.message`) remain open |

---

### `P0` — Critical Security & Data Integrity Defects

#### `P0-1` (Area D / C) — `ChallengeArenaClient` Exposes Interactive Mode/Duration Bar & Random-Seed `resetTest()`, Corrupting Submissions & Unmount Cleanup
- **Locations:**
  - [`components/challenge/challenge-arena-client.tsx:74-81,91-98,203`](../../components/challenge/challenge-arena-client.tsx#L203)
  - [`components/typing/typing-container.tsx:24-32,226-260,329-378,484-491`](../../components/typing/typing-container.tsx#L329-L378)
  - [`stores/typing-store.ts:406-412`](../../stores/typing-store.ts#L406-L412)
  - Masked by: [`__tests__/components/challenge-arena-client.test.tsx:18-20`](../../__tests__/components/challenge-arena-client.test.tsx#L18-L20)
- **Root Cause:** Unlike [`DailyChallengeClient:128`](../../components/daily/daily-challenge-client.tsx#L128) (`<TypingContainer hideConfigBar onRestartOverride={startDailyRun} />`), [`ChallengeArenaClient:203`](../../components/challenge/challenge-arena-client.tsx#L203) renders `<TypingContainer />` with neither prop:
  1. In idle state (`status === 'idle'`), [`TypingContainer:329-378`](../../components/typing/typing-container.tsx#L329-L378) renders clickable mode/duration buttons calling `startTestWithConfig({ mode: opt, duration, targets: [] })` / `startTestWithConfig({ mode, duration: time, targets })` (`omit seed` -> [`typing-store.ts:279`](../../stores/typing-store.ts#L279) generates a random `createSeed()`).
  2. Pressing `Escape` ([`TypingContainer:226-260`](../../components/typing/typing-container.tsx#L226-L260)) or clicking `"Restart Test"` (`lines 483-491`) invokes default `resetTest()` (`stores/typing-store.ts:406-412`), which generates a **new random seed** instead of re-seeding `challenge.seed`.
- **Impact:**
  1. Any challenger who retries mid-race (`Esc` or `"Restart Test"`) or clicks a mode/duration pill finishes typing the wrong prompt, then [`ChallengeArenaClient:92-97`](../../components/challenge/challenge-arena-client.tsx#L92-L97) submits `{ mode: challenge.mode, duration: challengeDuration, seed: challenge.seed, telemetry }` against the new random prompt's telemetry — causing deterministic **`400 Cursor progression mismatch`** rejection (or polluting `guestHistory` with mismatched seed/telemetry that `/api/results/sync` later rejects forever).
  2. Because `current.seed` is no longer `challenge.seed`, the unmount guard [`if (current.seed === challenge.seed) resetTest()`](../../components/challenge/challenge-arena-client.tsx#L77-L78) evaluates `false`, leaking completed challenge results onto `/typing` (reintroducing `ENG-A2`).
- **Required Fix:** Update [`ChallengeArenaClient:203`](../../components/challenge/challenge-arena-client.tsx#L203) to `<TypingContainer hideConfigBar onRestartOverride={handleStartChallenge} />`, reset unconditionally on unmount whenever `hasStarted` (or challenge route) was active so stale state never leaks to `/typing`, and add an integration/RTL test mounting real `TypingContainer` (or E2E test covering `/challenge/[id]` Escape + cleanup).

#### `P0-2` (Area B / E / DB) — Silent Compensating Rollback Failure Under Authenticated RLS, Missing `SUPABASE_SERVICE_ROLE_KEY`, & Publicly Readable `replays`
- **Locations:**
  - [`lib/supabase/admin.ts:11-33`](../../lib/supabase/admin.ts#L11-L33), [`app/api/results/route.ts:79`](../../app/api/results/route.ts#L79), [`app/api/results/sync/route.ts:69`](../../app/api/results/sync/route.ts#L69)
  - [`lib/typing/persistence.ts:614-625`](../../lib/typing/persistence.ts#L614-L625)
  - [`supabase/migrations/20260618000000_init_schema.sql:130-138`](../../supabase/migrations/20260618000000_init_schema.sql#L130-L138), [`supabase/migrations/20260621000000_typrox_2_hardening.sql:29,58-70`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L29)
  - Masked by: [`__tests__/typing/persistence.test.ts:145-150`](../../__tests__/typing/persistence.test.ts#L145-L150), [`__tests__/api/sync.route.test.ts:107-113`](../../__tests__/api/sync.route.test.ts#L107-L113)
- **Root Cause & Impact:**
  1. `.env.local` still lacks `SUPABASE_SERVICE_ROLE_KEY`; `createAdminClient()` returns `null` silently and falls back to caller SSR `authenticated` sessions.
  2. Live Postgres `public.test_results` has **no `DELETE` RLS policy** ([`20260618:130-135`](../../supabase/migrations/20260618000000_init_schema.sql#L130-L135); also [`20260621:29`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L29) revokes `DELETE`). When `replays` insertion fails in any environment lacking `SUPABASE_SERVICE_ROLE_KEY`, `.from('test_results').delete().eq('id', dbResult.id)` cannot delete the newly inserted parent row (PostgREST RLS returns `0` deleted rows with `{ error: null }` when no `.select()` is chained!), leaving orphaned `test_results` without replay telemetry — the exact failure mode that left `__debug_test__` rows stranded historically ([`BATCH_1_1A_PREFLIGHT_REPORT.md:70`](../../docs/roadmap/BATCH_1_1A_PREFLIGHT_REPORT.md#L70)).
  3. Meanwhile, live Supabase `public.replays` (`164` rows) remains readable to `anon` (keystroke timing data exposed publicly) until the Owner DB Gate applies hardened RLS.
- **Required Fix:**
  - Provision `SUPABASE_SERVICE_ROLE_KEY` and fail loudly in production if missing (`createAdminClient()` should not silently downgrade privileged server writes in `NODE_ENV === 'production'`).
  - Better yet, encapsulate result + replay + streak + achievement insertion inside an atomic `service_role`-only Postgres RPC function (`submit_verified_result`) so multi-table writes roll back natively in a single DB transaction.

---

### `P1` — Important Reliability, Correctness & Build Issues

#### `P1-1` (Build & App Router Spec) — Invalid Route Handler Export `MAX_SYNC_BATCH_SIZE` Fails `next build --webpack` & Webpack Typegen (`TS2344`)
- **Locations:** [`app/api/results/sync/route.ts:14`](../../app/api/results/sync/route.ts#L14), `.next/types/validator.ts:39-47,203-210`, Next.js docs `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`
- **Root Cause:** `route.ts:14` defines `export const MAX_SYNC_BATCH_SIZE = 30;` (nothing outside `route.ts` imports it; [`sync-client.ts:4`](../../lib/typing/sync-client.ts#L4) defines `SYNC_CHUNK_SIZE = 30`). Next.js App Router Route Handlers only permit HTTP methods and segment config exports. Turbopack's `.next/types/validator.ts` checks structural assignability (`RouteHandlerConfig`) and misses excess exports, whereas Webpack's generated `.next/types/app/api/results/sync/route.ts` validates exact keys via `OmitWithTag` and rejects `MAX_SYNC_BATCH_SIZE` with `TS2344`:
  > `.next/types/app/api/results/sync/route.ts(14,13): error TS2344: ... Property 'MAX_SYNC_BATCH_SIZE' is incompatible with index signature. Type '30' is not assignable to type 'never'.`
- **Additional Build Caveat:** [`app/layout.tsx:2-43`](../../app/layout.tsx#L2-L43) imports five Google Fonts via `next/font/google` (`Inter`, `Space_Grotesk`, `JetBrains_Mono`, `IBM_Plex_Mono`, `Geist_Mono`); one offline/transient `npm run build` attempt failed resolving `Geist_Mono` before succeeding when `fonts.googleapis.com` responded cleanly.
- **Required Fix:** Remove `export` from `const MAX_SYNC_BATCH_SIZE = 30;` (or move shared constant into `lib/typing/sync-client.ts`).

#### `P1-2` (Area B / C) — `POST /api/results` 45s Cooldown Short-Circuit Skips Partial-Write Recovery, Streaks, Achievements & PB (+ Pre-Migration >=45s Duplicate Risk)
- **Locations:**
  - [`app/api/results/route.ts:81-113`](../../app/api/results/route.ts#L81-L113)
  - [`lib/security/rate-limit.ts:95-106`](../../lib/security/rate-limit.ts#L95-L106)
  - [`lib/typing/persistence.ts:326-368`](../../lib/typing/persistence.ts#L326-L368)
  - [`components/typing/result-screen.tsx:95`](../../components/typing/result-screen.tsx#L95)
- **Root Cause & Impact:**
  1. When an initial `POST /api/results` inserts `test_results` and fails mid-flight (e.g., `replays`, `streaks`, or `achievements` error where RLS blocked rollback), retrying within `45s` hits `rateCheck.latestRow` in [`app/api/results/route.ts:88-97`](../../app/api/results/route.ts#L88-L97) and returns `200 OK` **without calling `persistVerifiedResult`**:
     - [`ensureReplayExistsForRecovery`](../../lib/typing/persistence.ts#L294-L324) is never called (replay stays permanently missing in Performance Lab).
     - [`updateDailyStreakForUser`](../../lib/typing/persistence.ts#L104-L202) and [`evaluateAndUnlockAchievements`](../../lib/typing/persistence.ts#L204-L292) are skipped (`unlocked: []`).
     - `isPersonalBest` is hardcoded `false` and `streakDays` is omitted (`ResultScreen:95` falls back to `1`).
  2. When retrying `>= 45s` later (or after server cold-start) against the **current pre-`client_run_id` live schema**, [`app/api/results/route.ts:111-113`](../../app/api/results/route.ts#L111-L113) omits `deduplicateBySignature: true` — so pre-migration retries after 45s insert duplicate `test_results` rows!
  3. Even when [`finalizeRecoveredResult`](../../lib/typing/persistence.ts#L326-L368) runs (`23505` race or recovery path), `lines 362-363` hardcode `previousBestWpm: null, isPersonalBest: false`.
- **Required Fix:** Remove the early short-circuit at `route.ts:88-97` (let `persistVerifiedResult` handle recovery via `client_run_id` + `deduplicateBySignature: true` for recent retries, passing `latestRow` only as a rate-limit bypass signal, or invoke `finalizeRecoveredResult` with real PB evaluation).

#### `P1-3` (Area A) — Permanently Rejected (`400`) & Invalid-Duration Legacy Guest Runs Loop Indefinitely in `/dashboard` Sync UI
- **Locations:**
  - [`lib/typing/sync-client.ts:38-45,70-78,126-140`](../../lib/typing/sync-client.ts#L38-L45)
  - [`app/dashboard/page.tsx:352-401,448-464`](../../app/dashboard/page.tsx#L448-L464)
  - [`app/api/results/sync/route.ts:119-139`](../../app/api/results/sync/route.ts#L119-L139)
- **Root Cause & Impact:** [`isSyncableGuestResult`](../../lib/typing/sync-client.ts#L38-L45) checks `item.isRanked !== false && isRankedMode(item.mode) && Array.isArray(item.telemetry) && item.telemetry.length > 0`, **omitting** `isValidDuration(item.duration)` and any persisted `rejected` marker. Consequently:
  - Any legacy pre-Phase-1 guest run created by early completion (`duration` outside `[15, 30, 60, 120]`, e.g., `12s`) or any run returned in `rejectedIds` (schema invalid / burst-flagged / telemetry-corrupted) is retained safely in `guestHistory` (good!), **but stays counted forever by `getSyncableGuestRunsCount(guestHistory)`** (`app/dashboard/page.tsx:448-457`).
  - Users see `"Local runs detected — ready to verify and sync"` on every reload, and every `"Sync History"` click re-transmits the same permanently rejected runs and burns sync rate-limit quota.
- **Required Fix:** Check `isValidDuration(item.duration)` and `!item.syncRejected` in `isSyncableGuestResult` (and treat pre-Phase-1 early-complete guest durations or server-returned `rejectedIds` by flagging them `syncRejected: true` in `user-store` so they remain visible in local history without triggering endless sync attempts).

#### `P1-4` (Area B / E / DB) — Table-Wide `client_run_id UNIQUE` Constraint Creates Cross-User Collision `500`
- **Locations:** [`supabase/migrations/20260621000000_typrox_2_hardening.sql:9`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L9), [`lib/typing/persistence.ts:569-583`](../../lib/typing/persistence.ts#L569-L583)
- **Root Cause & Impact:** `20260621:9` adds `client_run_id UUID UNIQUE` across all users instead of scoping uniqueness to `(user_id, client_run_id)`. If User B submits a `clientRunId` UUID already recorded by User A, Postgres raises `23505`, then `persistence.ts:577` queries `.eq('user_id', userId).eq('client_run_id', effectiveClientRunId).maybeSingle()`, finds `null`, and throws `500`.
- **Required Fix:** Replace global `UNIQUE` with `CREATE UNIQUE INDEX IF NOT EXISTS idx_test_results_user_client_run_id ON public.test_results(user_id, client_run_id) WHERE user_id IS NOT NULL AND client_run_id IS NOT NULL;`.

#### `P1-5` (Area E) — Process-Local `syncWindowCache` Fails Across Serverless Workers & Open Run-Start Token (`SEC-A2`)
- **Locations:** [`lib/security/rate-limit.ts:39,123-168`](../../lib/security/rate-limit.ts#L39), [`app/api/results/sync/route.ts:71-73`](../../app/api/results/sync/route.ts#L71-L73), [`lib/typing/verifier.ts:57-230`](../../lib/typing/verifier.ts#L57-L230)
- **Root Cause & Impact:**
  - `syncWindowCache` is a process-local `Map` (`lib/security/rate-limit.ts:39`). Across serverless isolates or restarts, the 5-req/60s burst guard resets to zero (only the 10-minute `150` DB count ceiling remains shared across workers). Also `sync/route.ts:71-73` bills `parsed.data.items.length` before filtering skipped legacy/unranked items, unnecessarily throttling legitimate retries containing legacy entries.
  - **`SEC-A2` (Unresolved High):** Without server-issued HMAC run-start tokens (`POST /api/runs/init`), an attacker can still synthesize varied `seed` + valid telemetry offline and burst runs up to rate/DB ceilings without spending real wall time.

---

### `P2` — Quality, Accessibility, Maintainability & UX Issues

#### `P2-1` (Area D / A11y) — Missing `role="alert"` on `ChallengeArenaClient` Save Error Banner
- **Location:** [`components/challenge/challenge-arena-client.tsx:240-270`](../../components/challenge/challenge-arena-client.tsx#L240-L270)
- **Evidence:** Renders error text + `"Retry Save"` inside `<div className="mt-2 inline-flex ... text-error">` without `role="alert"`, contradicting Phase 1 documentation.
- **Required Fix:** Add `role="alert"` (mirroring [`ResultScreen:349`](../../components/typing/result-screen.tsx#L349)).

#### `P2-2` (Area D / UX) — `ResultScreen.handleShare` Copies Unverified Seed URL While Saving or Errored
- **Location:** [`components/typing/result-screen.tsx:300-327`](../../components/typing/result-screen.tsx#L300-L327)
- **Evidence:** Clicking `"Share Challenge"` while `isSaving` is `true` or when `activeSubmission?.status === 'error'` (`savedResultId === null`) skips `POST /api/challenges` and silently copies `/typing?seed=...` instead of a verified 1v1 challenge link or warning.
- **Required Fix:** Disable/indicate `"Saving..."` on `"Share Challenge"` while signed-in persistence is in flight, or show an explicit toast when `savedId` is unavailable for signed-in users.

#### `P2-3` (DB Hygiene & Minor Security/Tech Debt) — Unremediated Migration, Signout Error Leak & Deferred Phase 1–3 Items
- [`supabase/migrations/20260621000000_typrox_2_hardening.sql:31`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L31) (`DB-A1`): Blanket `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public` still present.
- [`supabase/migrations/20260621000000_typrox_2_hardening.sql:178-187`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L178-L187) (`DB-A2`): Seeds `8` achievement rows instead of all `11` live production codes.
- [`lib/data/leaderboard.ts:132`](../../lib/data/leaderboard.ts#L132) (`DB-A3`): `PGRST205` fallback truncates at `.limit(300)` raw rows before JS user deduplication.
- [`app/api/auth/signout/route.ts:32-33`](../../app/api/auth/signout/route.ts#L32-L33) (`SEC-A5`): Returns raw `err.message` instead of masked error text; [`AuthProvider:68-71`](../../components/providers/auth-provider.tsx#L68-L71) still calls `getSession()` alongside `getUser()`.
- Dead code (`DEBT-01`/`DEBT-02`): `vite-tsconfig-paths` unused in `package.json`, `utils/text-generator.ts` unused, `lib/supabase/auth.ts` unused `getClientSession()`.

---

## 4. Test Verification & Coverage Blind-Spot Audit

### 4.1 Firsthand Command Execution Matrix

| Command | Mode / Conditions | Outcome | Verified Details |
|---|---|---|---|
| `npm run lint` (`eslint`) | Clean repo scan | **PASS (`exit 0`)** | `0` errors, `0` warnings across all app, lib, worker, and test files |
| `npm run test:unit` (`vitest run`) | JSDOM + mocked Supabase/fetch | **PASS (`exit 0`)** | **`19` files, `84/84` tests** passed in `7.86s` |
| `npm run build` (`next build`) | Next.js `16.2.9` **Turbopack** | **PASS (`exit 0`)** | `33/33` routes + `ƒ Proxy (Middleware)` compiled; note one earlier transient failure resolving `Geist_Mono` over network before succeeding when `fonts.googleapis.com` responded cleanly |
| `npx next build --webpack` | Next.js `16.2.9` **Webpack** | **FAIL (`exit 1`)** | Compiled bundle cleanly (`45s`), then failed TypeScript route validation (`TS2344`) on `.next/types/app/api/results/sync/route.ts:14` (`export const MAX_SYNC_BATCH_SIZE = 30`) |
| `npm run typecheck` (`tsc --noEmit --incremental false`) | Against Turbopack `.next/types/` vs. Webpack `.next/types/` | **PASS (`exit 0`) on Turbopack / FAIL (`exit 2`) on Webpack** | Passes with Turbopack's `.next/types/validator.ts` (`RouteHandlerConfig` excess properties ignored); **fails `TS2344`** against Webpack's `OmitWithTag` route validator |
| `npm run test:e2e` (`playwright test`) | Chromium on `127.0.0.1:3105` against Turbopack build | **PASS (`exit 0`)** | **`7/7` Chromium E2E tests** passed (`1.1m`); unauthenticated flows only (`0` signed-in API write / DB RLS / `/challenge/[id]` journeys) |

### 4.2 Test Quality & Blind-Spot Assessment
- **Verified meaningful test coverage:**
  - Early `text_complete` timing & `[15, 30, 60, 120]` bracket preservation ([`metrics.test.ts:83-126`](../../__tests__/typing/metrics.test.ts#L83-L126), [`verifier.test.ts:127-172`](../../__tests__/typing/verifier.test.ts#L127-L172), [`result-screen.test.tsx:159-201`](../../__tests__/components/result-screen.test.tsx#L159-L201)).
  - Result & sync route dedup (`clientRunId` + signature), `207` partial failure & `500` total failure payload handling, missing `client_run_id` `PGRST204` fallback, `23505` conflict recovery, strict streak/achievement throws, and `<15m` orphaned partial-write recovery ([`results.route.test.ts`](../../__tests__/api/results.route.test.ts), [`sync.route.test.ts`](../../__tests__/api/sync.route.test.ts), [`persistence.test.ts`](../../__tests__/typing/persistence.test.ts)).
- **Critical blind spots masking live failures (`P0`/`P1`):**
  1. **Mocked `.delete()` rollback hides Postgres RLS block:** [`persistence.test.ts:145-150`](../../__tests__/typing/persistence.test.ts#L145-L150) & [`sync.route.test.ts:107-113`](../../__tests__/api/sync.route.test.ts#L107-L113) mock `.delete()` succeeding with `createAdminClient() = null`, whereas real Postgres has no `DELETE` policy on `test_results`. Zero tests run against real Postgres + RLS.
  2. **Mocked `TypingContainer` hides `P0-1` Challenge bug:** [`challenge-arena-client.test.tsx:18-20`](../../__tests__/components/challenge-arena-client.test.tsx#L18-L20) stubs out `@/components/typing/typing-container`, completely missing the exposed config pills & default `resetTest()` random-seed overwrite on `/challenge/[id]`.
  3. **Untested sync edge cases:** [`sync-client.test.ts:106-180`](../../__tests__/typing/sync-client.test.ts#L106-L180) claims `"rate-limit (429) interruption"` in its description while mocking only `200`/`207`/`200`; zero tests exercise `rejectedIds` looping in `DashboardPage` or `/api/results` retry within 45s after a partial write.

---

## 5. Security & Database Safety Review (Production Gate `BLOCKED`)

### 5.1 Database Migration Safety Checklist ([`20260621000000_typrox_2_hardening.sql`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql))

| Audit Question | Assessment | Evidence / Notes |
|---|---|---|
| **1. Is `20260621` safe to apply as-is?** | **NO — UNSAFE** | Applying drops client `INSERT`/`UPDATE` policies (`lines 50-85`) while `.env.local` lacks `SUPABASE_SERVICE_ROLE_KEY`, breaking all server API writes (`42501`). Also contains `DB-A1`, `DB-A2`, and global `client_run_id UNIQUE` (`P1-4`). |
| **2. Has blanket function revocation been corrected?** | **NO (`DB-A1` OPEN)** | [`20260621:31`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L31) still executes `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;` instead of targeting only `public.handle_new_user()`. |
| **3. Are all `11` production achievement codes represented?** | **NO (`DB-A2` PARTIAL)** | Locally [`public/achievements/`](../../public/achievements/speed_80.svg) now includes all `11` SVG files, **but** [`20260621:178-187`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L178-L187) still seeds only `8` codes (missing `SPEED_80`, `SPEED_150`, `STREAK_14`). |
| **4. Is `leaderboard_view` compatible with the live schema?** | **YES (when run after `line 11`)** | [`20260621:11`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql#L11) adds `is_ranked BOOLEAN DEFAULT TRUE NOT NULL` before `lines 96-118` create `public.leaderboard_view` matching [`lib/data/leaderboard.ts:67-70`](../../lib/data/leaderboard.ts#L67-L70). (Unlike legacy `20260620`, which lacks joined profile fields and `security_invoker = true`.) Adding `DROP VIEW IF EXISTS public.leaderboard_view;` ahead of `line 96` is recommended for clean fresh replays. |
| **5. Is `client_run_id` fallback safe before migration?** | **PARTIAL (`P1-2` CAVEAT)** | `persistence.ts:58-67,556-568` safely catches `PGRST204`/`42703` and retries without `client_run_id`. However, `POST /api/results` omits `deduplicateBySignature: true`, allowing duplicates on retries `>= 45s` against pre-migration prod, and short-circuits `< 45s` retries without replay/streak recovery. |
| **6. Exact live DB permissions & policies still UNVERIFIED** | **7 Catalog Areas Unverified** | Cannot be read via `anon` key: (1) live `pg_policies` names/predicates across all 9 tables; (2) `information_schema.role_table_grants` (`GRANT ALL` status); (3) active `pg_indexes`; (4) `public.handle_new_user()` `SET search_path` definition; (5) `pg_publication_tables` (`supabase_realtime`); (6) column nullability/constraints (`streaks.last_active_date`, `profiles.username`); (7) Supabase automated backups / PITR & Auth Redirect URL allowlists. |

### 5.2 Remaining Application Security Findings Summary
- **High — Exposed Live Replays (`164` rows) & Unprovisioned Service Role:** Production `public.replays` allows `anon` reads until `20260621` runs; `.env.local` lacks `SUPABASE_SERVICE_ROLE_KEY`.
- **High — `SEC-A2` Unresolved:** No HMAC-signed run-start token (`POST /api/runs/init`) binds `seed` issuance to elapsed wall-clock time.
- **Medium — `SEC-A4`:** Production CSP in [`next.config.ts:30`](../../next.config.ts#L30) retains `'unsafe-inline'` in `script-src`.
- **Medium — Serverless Sync Rate-Limit State:** Process-local `syncWindowCache` (`lib/security/rate-limit.ts:39`) is bypassed across separate serverless workers.
- **Low — `SEC-A5`:** [`app/api/auth/signout/route.ts:32-33`](../../app/api/auth/signout/route.ts#L32-L33) leaks `err.message`; [`AuthProvider:70`](../../components/providers/auth-provider.tsx#L70) retains a `getSession()` call alongside `getUser()`.

---

## 6. Required Corrections Before Re-Review / Commit

1. **Fix `P0-1` Challenge Arena config/restart lock:** Pass `hideConfigBar` and `onRestartOverride={handleStartChallenge}` to `<TypingContainer />` in [`components/challenge/challenge-arena-client.tsx:203`](../../components/challenge/challenge-arena-client.tsx#L203); ensure unmount cleanup resets `useTypingStore` whenever a challenge started; add `role="alert"` (`P2-1`); verify with non-mocked integration/E2E tests.
2. **Fix `P1-1` Route Handler export:** Remove `export` from `MAX_SYNC_BATCH_SIZE` in [`app/api/results/sync/route.ts:14`](../../app/api/results/sync/route.ts#L14) and verify **both** `npm run build` and `npx next build --webpack` + `npm run typecheck` pass cleanly.
3. **Fix `P1-2` `/api/results` retry/recovery bypass:** Stop short-circuiting within 45s in [`app/api/results/route.ts:88-97`](../../app/api/results/route.ts#L88-L97) before `persistVerifiedResult`, pass `deduplicateBySignature: true` for recent pre-migration retries, and compute real PB state in [`finalizeRecoveredResult`](../../lib/typing/persistence.ts#L326-L368).
4. **Fix `P1-3` Guest rejected-run loop:** Exclude `!isValidDuration(item.duration)` and client-flagged `rejectedIds` in [`isSyncableGuestResult`](../../lib/typing/sync-client.ts#L38-L45) while keeping the runs intact locally.
5. **Fix `P0-2` / `P1-4` / `DB-A1` / `DB-A2` before executing Production DB Gate:**
   - Replace `persistence.ts` multi-step rollback with an atomic `service_role` Postgres transaction RPC (`submit_verified_result`) and fail loudly if `SUPABASE_SERVICE_ROLE_KEY` is missing in production.
   - Update [`20260621000000_typrox_2_hardening.sql`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql) to: (a) scope `client_run_id` uniqueness to `(user_id, client_run_id)`; (b) narrow `line 31` to `REVOKE ALL ON FUNCTION public.handle_new_user()`; (c) include all `11` production achievement codes (`ON CONFLICT (code) DO NOTHING`).
   - Add real `429` assertions in [`sync-client.test.ts`](../../__tests__/typing/sync-client.test.ts) and add a local Postgres/Docker RLS harness (`QA-A1`).
6. **Split commits cleanly once fixed:** Organize the working tree into atomic, reviewable commits (Phase 1 security + verifier, Phase 2 typing engine, Phase 3 RSC/UI, Phase 4 curriculum/daily, Phase 5 tests) and keep the Production DB Approval Gate **BLOCKED** until owner backup verification + catalog audit.

---

### Final Verdict: **`NOT APPROVED`** *(Historical Point-in-Time Verdict — See Phase 1B Addendum Below)*

---

## Phase 1B Remediation Status Addendum (2026-11-11)

Follow-up batch **Phase 1B** remediated all application and prepared-SQL `P0`, `P1`, and `P2-1` findings identified in this review without modifying live production data or executing Supabase migrations. Full evidence and updated command results are recorded in [`docs/roadmap/PHASE_1B_REMEDIATION_REPORT.md`](../../docs/roadmap/PHASE_1B_REMEDIATION_REPORT.md):

- **`P0-1` & `P2-1` (`ChallengeArenaClient` config/restart lock, unmount cleanup, `role="alert"`):** **RESOLVED** — [`challenge-arena-client.tsx`](../../components/challenge/challenge-arena-client.tsx) + [`typing-container.tsx`](../../components/typing/typing-container.tsx); verified by `3` real-`TypingContainer` integration tests in [`challenge-arena-client.test.tsx`](../../__tests__/components/challenge-arena-client.test.tsx).
- **`P0-2` (RLS-aware rollback, missing `SUPABASE_SERVICE_ROLE_KEY` warning, atomic Postgres RPC):** **APP FIXED & SQL PREPARED (DB GATE STILL BLOCKED)** — [`admin.ts`](../../lib/supabase/admin.ts), [`persistence.ts`](../../lib/typing/persistence.ts), `20260623000000_atomic_result_persistence_and_idempotency.sql`, [`types/database.ts`](../../types/database.ts). Live `public.replays` `anon` RLS & missing `SUPABASE_SERVICE_ROLE_KEY` remain blocked on Owner Production DB Gate.
- **`P1-1` (Route Handler export failing `next build --webpack`):** **RESOLVED** — Moved `MAX_SYNC_BATCH_SIZE` to [`sync-client.ts`](../../lib/typing/sync-client.ts); **both** `npx next build --webpack` and `npm run build` (Turbopack) + `npm run typecheck` pass (`exit 0`).
- **`P1-2` (`POST /api/results` `<45s` short-circuit & true recovery PB):** **RESOLVED** — [`app/api/results/route.ts`](../../app/api/results/route.ts) + [`finalizeRecoveredResult`](../../lib/typing/persistence.ts); verified across `<45s`, `>=45s`, and cross-user isolation tests.
- **`P1-3` (Guest sync loop on rejected/invalid-duration runs):** **RESOLVED** — [`user-store.ts`](../../stores/user-store.ts), [`sync-client.ts`](../../lib/typing/sync-client.ts), [`app/api/results/sync/route.ts`](../../app/api/results/sync/route.ts), [`app/dashboard/page.tsx`](../../app/dashboard/page.tsx); verified including real `429` / `207` / `500` / `400` / network errors & UI recovery.
- **`P1-4`, `DB-A1`, `DB-A2` (`20260621` SQL fixes):** **PREPARED IN LOCAL SQL (UNAPPLIED)** — [`20260621000000_typrox_2_hardening.sql`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql) now scopes uniqueness to `(user_id, client_run_id)`, narrows `REVOKE ALL` to `FUNCTION public.handle_new_user()`, adds `DROP VIEW IF EXISTS public.leaderboard_view`, and seeds all `11` production achievement codes.
- **Still Open / Follow-Up:** Production DB Approval Gate (`SUPABASE_SERVICE_ROLE_KEY`, catalog inspection, backup verification, applying `20260621`–`20260623`), `QA-A1` (real Postgres/Docker test harness), `P1-5`/`SEC-A2` (distributed sync limit & run-start tokens), `P2-2`/`P2-3`, and splitting uncommitted Git history cleanly.

