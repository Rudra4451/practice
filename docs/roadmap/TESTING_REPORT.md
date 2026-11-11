# TyProX 2.0 Verification & Testing Report

**Environment:** Windows / Node.js v24.16.0 / Next.js `16.2.9` (Turbopack)  
**Test Runners:** Vitest 5.1.0 (unit, API routes, engine, stores, RTL components) + Playwright (E2E & visual/mobile browser verification)

---

## Baseline Measurements (Before Remediation, Commit `fba1d80`)

| Check | Result | Notes |
|---|---|---|
| `npx tsc --noEmit --incremental false` | PASS (0 errors) | Strict TS check passed cleanly |
| `npm run build` | PASS (20/20 routes) | Production Next.js Turbopack build succeeded |
| `npm run lint` | FAIL (111 problems) | 55 errors (26 `no-explicit-any`, 14 `set-state-in-effect`, compiler immutability/purity, unescaped entities), 56 warnings |
| Automated Tests | NONE (0 tests) | No Vitest or Playwright config/suites existed |

---

## Batch Verification Log

### Batch 1.1B & Batch 1.2 — Security Remediation, Server Score Verifier & API Routes
- `npm run typecheck`: **PASS (0 errors)**
- `npm run test:unit`: **PASS — 8 files, 38/38 tests**
  - `__tests__/security/redirect.test.ts` (6 tests): protocol-relative bypasses, external origins, backslash tricks, nested callback normalization, valid internal targets.
  - `__tests__/typing/metrics.test.ts` (6 tests): cumulative accuracy retaining corrected mistakes (`K_correct / K_total`), full timer denominator preventing 200 WPM bursts, outlier-resistant consistency, linear O(N+S) timeline, real-time snapshot clamping.
  - `__tests__/typing/text-generator.test.ts` (5 tests): deterministic PRNG across platforms, `quotes` passage duration scaling (`120s` >= 2300 chars), single-space `code` joining, `drill` target weighting, `daily` determinism.
  - `__tests__/typing/verifier.test.ts` (6 tests): unranked rejection on `POST /api/results`, invalid duration/mode rejection, seed mismatch telemetry rejection, inhuman `<20ms` burst rejection, uniform cadence bot detection, valid server recomputation.
  - `__tests__/api/leaderboard.route.test.ts` (4 tests): Zod 400 validation, `PGRST205` fallback to `test_results` with `is_invalidated=false` and `user_id IS NOT NULL`, internal error masking, single highest-WPM deduplication per user.
  - `__tests__/api/results.route.test.ts` (4 tests): anonymous `401`, invalid payload `400`, `clientRunId` deduplication, server-recomputed score ignoring spoofed client fields.
  - `__tests__/api/profile.route.test.ts` (4 tests): anonymous `401`, reserved username blocklist, `409` duplicate username handling, Zod preference update.
  - `__tests__/api/challenges.route.test.ts` (3 tests): anonymous `401`, ownership/non-invalidated check, challenge link URL issuance.

### Phase 2 — Typing Engine Reliability, Timer Accuracy, Mobile/IME Input & Result Flow
- `npm run typecheck`: **PASS (0 errors)**
- `npm run test:unit`: **PASS — 13 files, 54/54 tests** (+16 new engine/component tests)
  - `__tests__/audio/keystroke-sound.test.ts` (3 tests): muted/zero-volume skip, missing `AudioContext` no-op, WebAudio oscillator envelope synthesis.
  - `__tests__/stores/typing-store.test.ts` (4 tests): live input/combo/backspace state, drift-free `performance.now()` deadline catching up across sleep gaps, `drill` unranked state & seed reset, 0-keystroke recovery.
  - `__tests__/components/typing-container.test.tsx` (5 tests): multi-character swipe commit, `compositionstart`/`compositionend` IME deferral, Android `Backspace` sentinel deletion capture, `Enter` prevention + button `Space` focus exemption, Escape blocked while `[role="dialog"]` is open.
  - `__tests__/components/result-screen.test.tsx` (2 tests): React `<StrictMode>` double-mount sends `POST /api/results` strictly once and resolves PB state (fixed StrictMode cancellation bug and `AnimatedCounter` rAF clock alignment), authentic guest PB suppression when a faster prior run exists.
  - `__tests__/components/cat-companion.test.tsx` (2 tests): preserves existing `localStorage` unlocks on mount, unlocks `golden` companion on 100% accuracy and switches selection.
- `npx eslint` on all 16 Phase 2 source and test files: **PASS (0 errors, 0 warnings)**
- `npm run build`: **PASS (20/20 routes)**

### Phase 3 - Engineering Quality, Server Component Boundaries, Security Headers & Editorial Design
- `npm run typecheck`: **PASS (0 errors)**
- `npm run lint`: **PASS (0 errors, 0 warnings across entire repository; down from 55 errors + 56 warnings baseline)**
- `npm run build`: **PASS (30/30 routes with `AuthProvider`, Server Components for `/`, `/leaderboard`, `/u/[username]`, `/challenge/[id]`, error boundaries, CSP/security headers, and `public/achievements/*.svg`)**

### Phase 4 - Replay Telemetry Analyzer, Structured Curriculum & Daily UTC Arena
- `npm run test:unit`: **PASS - 15 files, 63/63 tests** (+9 new unit tests across 2 files)
  - `__tests__/typing/replay-analyzer.test.ts` (3 tests): deterministic replay keystroke accuracy attribution, hand balance (`leftPct` / `rightPct`), weak-key & bigram extraction, finger workload distribution.
  - `__tests__/learn/curriculum.test.ts` (6 tests): 12-lesson sequential prerequisite locking, accuracy threshold pass/fail gates, star tier calculation, unlock propagation.
- `npm run build`: **PASS (33/33 routes including `/learn`, 12 static `/learn/[slug]` paths, `/daily`)**

### Phase 5 - End-to-End Playwright Browser Audit & Final Platform Verification
- `npm run typecheck`: **PASS (`0` errors)**
- `npm run lint`: **PASS (`0` errors, `0` warnings)**
- `npm run test:unit`: **PASS (`15` files, `63/63` tests)**
- `npm run build`: **PASS (`33/33` routes compiled via Next.js 16.2.9 Turbopack)**
- `npm run test:e2e` (Chromium against isolated production server `127.0.0.1:3105`): **PASS (`6/6` tests)**
  1. Landing page honest copy + Dark/Light toggle & reload persistence (`0` console/page/server errors).
  2. Full typing session on `/typing?mode=drill&duration=15&targets=q,z` -> Result screen metrics -> Replay Viewer playback -> Performance Lab keystroke heatmap & `fingerLoads` (`Left Pinky` etc.).
  3. `/learn` Lesson 1 -> Lesson 2 prerequisite lock enforcement -> completing Lesson 1 unlocks Lesson 2 and persists `1 / 12 Passed` across reload.
  4. `/daily` deterministic UTC seed (`daily-YYYY-MM-DD`) & live countdown consistency across reload.
  5. `/leaderboard` honest copy + `mode=code` URL filter sync + `400` invalid filter rejection + `401` unauth `POST /api/results` + `/dashboard?demo=true` ignored cleanly + `/auth/callback?next=https://evil.com` open redirect blocked + `/profile` font family & WebAudio click synthesis.
  6. Desktop (`1440x900` dark & light) + Mobile (`375x812` dark) sweep across all 9 routes (`/`, `/typing`, `/learn`, `/daily`, `/leaderboard`, `/dashboard`, `/dashboard/performance-lab`, `/profile`, `/login`): `<= 1px` horizontal overflow, `0` broken images (including OAuth avatars on `/leaderboard`), accessible mobile drawer open & `Escape` close, and `0` console/page/server errors.

---

### Post-Audit Remediation Phase 1 — Security, Reliability, Duration Contract & Visual Re-Verification

All application checks below executed **after the final code and SVG asset edit**:

- `npm run typecheck` (`tsc --noEmit --incremental false`): **PASS (`0` errors, exit `0`)**
- `npm run lint` (`eslint`): **PASS (`0` errors, `0` warnings, exit `0`)**
- `npm run test:unit` (`vitest run`): **PASS — `19` test files, `84/84` tests passed** (+4 new suites / +21 tests over Phase 5 baseline):
  - `__tests__/typing/metrics.test.ts` (`7` tests): added early `text_complete` `elapsedSeconds` vs canonical bracket `duration` across all 4 `[15, 30, 60, 120]` brackets + `normalizeBracketDuration`.
  - `__tests__/typing/verifier.test.ts` (`7` tests): verified `configuredDuration` preservation across `[15, 30, 60, 120]` including early `text_complete` and optional `clientRunId` propagation.
  - `__tests__/typing/persistence.test.ts` (`6` tests — **new**): verifies `client_run_id` insert when present, `PGRST204` missing-column fallback, `23505` unique-conflict idempotent recovery, compensating `test_results` `DELETE` rollback + throw on `replays` error, `<15m` orphaned partial-write recovery under `deduplicateBySignature`, and strict error propagation for `streaks` / `achievements` (ignoring `23505` races only).
  - `__tests__/typing/sync-client.test.ts` (`2` tests — **new**): verifies `>30` guest runs retain `telemetry` cleanly, sequential 30-item batch chunking via `syncGuestHistoryBatches`, selective deletion of only server-confirmed IDs, preservation of unranked (`isRanked: false` / `drill`) and remaining `>30` runs across `207` partial failures & `429` rate limits, and clean retry.
  - `__tests__/api/results.route.test.ts` (`5` tests): verifies canonical bracket duration on early completion, missing `client_run_id` schema fallback, `429` cooldown, and idempotent retries.
  - `__tests__/api/sync.route.test.ts` (`4` tests — **new**): verifies `401` auth gate, `400` >30 batch rejection, `clientRunId` + telemetry-signature deduplication across retries, unranked blocking, `429` + `Retry-After` rate limiting, and `207` partial / `500` total persistence failures without falsely acknowledging failed items.
  - `__tests__/api/challenges.route.test.ts` (`4` tests): verifies legacy non-bracket duration normalization and `400` unranked mode rejection.
  - `__tests__/components/result-screen.test.tsx` (`4` tests): verifies actual elapsed time UI sublabel alongside canonical bracket server submission, explicit `role="alert"` save failure banner + failed promise eviction + `"Retry Save"` recovery.
  - `__tests__/components/challenge-arena-client.test.tsx` (`2` tests — **new**): verifies canonical bracket duration on early challenge completion, failed save recovery, unmount `resetTest()`, and guest challenge recording with `isRanked: true`.
  - `__tests__/components/cat-companion.test.tsx` (`3` tests): verifies opaque `bg-surface` drawer styling (`z-40`) free of dark-hardcoded `bg-neutral-950` / `bg-neutral-900` bleed classes.
  - Preserved suites passing unchanged: `text-generator.test.ts` (`5`), `typing-store.test.ts` (`4`), `leaderboard.route.test.ts` (`4`), `profile.route.test.ts` (`4`), `typing-container.test.tsx` (`5`), `replay-analyzer.test.ts` (`3`), `redirect.test.ts` (`6`), `curriculum.test.ts` (`6`), `keystroke-sound.test.ts` (`3`).
- `npm run build` (`next build` `16.2.9` Turbopack): **PASS — `33/33` routes compiled cleanly + `ƒ Proxy (Middleware)`**
- `npm run test:e2e` (`playwright test` on isolated `127.0.0.1:3105`): **PASS — `7/7` Chromium E2E tests**
  - Tests 1–6 preserved and green, plus **Test 7** verifying: `Hero3D` zero bounding-box overlaps between `hero-3d-chassis` and all 4 `hero-hud-card` panels across Desktop (`1440x900`), Laptop (`1024x768`), Tablet (`768x1024`), and Mobile (`375x812`) in Dark & Light modes; Light Mode `CatCompanion` collection drawer rendering opaque `#FFFFFF` (`rgb(255, 255, 255)`) with `#111113` (`rgb(17, 17, 19)`) ink and `zIndex >= 40`; and HTTP `200` `<svg` serving for `/achievements/speed_80.svg`, `/achievements/speed_150.svg`, and `/achievements/streak_14.svg`.
- **Multi-Viewport Visual Re-Audit (Headless Chromium Screenshots Inspected Firsthand):**
  - Rendered and inspected `/` across `desktop (1440x900)`, `laptop (1024x768)`, `tablet (768x1024)`, and `mobile (375x812)` in both Dark and Light themes (`0px` horizontal overflow across all 8 views, `0` HUD overlaps, zero keyboard Z-plane background clipping in Light or Dark mode) plus Light/Dark/Mobile `CatCompanion` drawers (`zIndex: 40`, zero footer bleed).

---

### Phase 1B — Critical Defect Remediation & Dual Build Verification Matrix

All checks below ran sequentially **after the final code and test edit** (details in [`docs/roadmap/PHASE_1B_REMEDIATION_REPORT.md`](../../docs/roadmap/PHASE_1B_REMEDIATION_REPORT.md)):

- `npm run lint` (`eslint`): **PASS (`0` errors, `0` warnings, exit `0`)**
- `npm run test:unit` (`vitest run`): **PASS — `21` test files, `99/99` tests passed** in `8.10s` (+2 new test suites / +15 new or strengthened assertions over Phase 1 baseline):
  - [`__tests__/components/challenge-arena-client.test.tsx`](../../__tests__/components/challenge-arena-client.test.tsx) (`3` tests — real `TypingContainer` integration, no stub): verifies locked config bar (`hideConfigBar`), `Escape` + `"Restart Test"` + window `Escape` preserving challenge `seed`/`mode`/`duration` while passing real `verifyAndScoreSession`, `role="alert"` + `"Retry Save"`, and unmount `resetTest()` cleanup even after restarts.
  - [`__tests__/typing/persistence.test.ts`](../../__tests__/typing/persistence.test.ts) (`10` tests): verifies RLS `0`-row silent delete detection (`data: []`) and `42501` delete errors, skipping doomed `DELETE` under unprivileged SSR context and recovering orphaned replay + true PB (`priorBest < run` & `priorBest > run`) on retry, single-transaction `submit_verified_result` RPC execution + `PGRST202` pre-migration fallback, and `23505` conflict recovery without hardcoded `isPersonalBest: false`.
  - [`__tests__/lib/admin.test.ts`](../../__tests__/lib/admin.test.ts) (`2` tests — **new**): verifies `hasServiceRoleConfig()`, one-time missing `SUPABASE_SERVICE_ROLE_KEY` warning without secret/URL leakage, and client caching when configured.
  - [`__tests__/api/results.route.test.ts`](../../__tests__/api/results.route.test.ts) (`8` tests): verifies `<45s` retry recovery of missing replay, streak, achievement, and true PB after SSR partial writes (both `client_run_id` and `PGRST204` schemas), `>=45s` late signature deduplication without duplicate DB inserts, and multi-user `clientRunId` isolation.
  - [`__tests__/api/sync.route.test.ts`](../../__tests__/api/sync.route.test.ts) (`6` tests): verifies candidate-count rate metering, HTTP `400` (`rejectedIds` + `rejectedReasons`) when all candidates fail (`zod` invalid duration & `0ms`-jitter bot cadence) vs `200` on mixed batches, `429` + `Retry-After` bursts, and privileged `DELETE` rollback vs SSR orphan preservation + retry recovery.
  - [`__tests__/typing/sync-client.test.ts`](../../__tests__/typing/sync-client.test.ts) (`4` tests): verifies zero network calls for invalid-duration legacy (`12s`/`45s`/`0s`) or held `'rejected'` runs, `rejectedIds` + outer `400` holding + `retryRejectedGuestResults()`, and real HTTP `429` (`Retry-After`), `207`, `500`, and `TypeError` network failures preserving pending retry state cleanly.
  - [`__tests__/components/dashboard-page.test.tsx`](../../__tests__/components/dashboard-page.test.tsx) (`1` test — **new**): verifies `/dashboard` suppresses `"Sync History"` auto-looping for invalid-duration & rejected runs while rendering `"Local-Only / Paused Runs Preserved"` and supporting explicit `"Retry Held Runs"` recovery without losing telemetry.
- `npx next build --webpack`: **PASS (`exit 0`, `33/33` routes compiled + Webpack route type validator passing)**
- `npm run typecheck` *(after Webpack build)*: **PASS (`0` errors, exit `0`)**
- `npm run build` *(Next.js `16.2.9` Turbopack)*: **PASS (`exit 0`, `33/33` routes compiled + `ƒ Proxy (Middleware)`)**
- `npm run typecheck` *(after Turbopack build)*: **PASS (`0` errors, exit `0`)**
- `npm run test:e2e` (`playwright test` on `127.0.0.1:3105`): **PASS — `7/7` Chromium E2E tests** in `1.9m`
- `git diff --check`: **PASS (`exit 0`)**
- **Coverage Caveat (`QA-A1`):** API and persistence unit suites run against mocked Supabase/PostgREST clients (including synthetic `42501`/`0`-row/`23505`/`PGRST204`/`PGRST202` errors); real PostgreSQL RLS policy evaluation and PL/pgSQL execution of `submit_verified_result` have **not** yet been exercised against a local Postgres container.

---

### Phase 1C — Security Boundary, Streak/Invalidation Integrity & Dual-Build/E2E Re-Verification

*(Full finding-by-finding traceability in [`docs/roadmap/PHASE_1C_REMEDIATION_REPORT.md`](../../docs/roadmap/PHASE_1C_REMEDIATION_REPORT.md).)*

- `npx next build --webpack`: **PASS (`exit 0`, `33/33` routes + `ƒ Proxy (Middleware)`, executed after final app edit [`components/home/home-landing.tsx`](../../components/home/home-landing.tsx))**
- `npm run typecheck` *(after Webpack build)*: **PASS (`0` errors, `exit 0`)**
- `npm run build` *(Next.js `16.2.9` Turbopack)*: **PASS (`exit 0`, `33/33` routes + `ƒ Proxy (Middleware)`, executed after final app edit)**
- `npm run typecheck` *(after Turbopack build)*: **PASS (`0` errors, `exit 0`)**
- `npm run lint` (`eslint`, executed after all code & E2E edits): **PASS (`0` errors, `0` warnings, `exit 0`)**
- `npm run typecheck` *(executed after final E2E test edit)*: **PASS (`0` errors, `exit 0`)**
- `npm run test:unit` (`vitest run`, executed after all edits): **PASS — `23` test files, `118/118` tests passed** in `7.23s` (+2 test files / +19 tests over Phase 1B baseline):
  - [`__tests__/lib/admin.test.ts`](../../__tests__/lib/admin.test.ts) (`3` tests): verifies fail-closed `AdminConfigurationError` (`503 ADMIN_CONFIG_MISSING`) in `NODE_ENV === 'production'` while never marking SSR fallback clients privileged in development/test.
  - [`__tests__/api/profile.route.test.ts`](../../__tests__/api/profile.route.test.ts) (`6` tests): verifies `403 USERNAME_LOCKED` on second handle change, idempotent same-username preservation, reserved/temp placeholder blocking, `503` fail-closed username mutation without admin config, and SSR preference updates.
  - [`__tests__/api/signout.route.test.ts`](../../__tests__/api/signout.route.test.ts) (`2` tests — **new**): verifies `sb-*` cookie clearing and raw exception masking (`Sign-out failed`).
  - [`__tests__/components/username-modal.test.tsx`](../../__tests__/components/username-modal.test.tsx) (`1` test — **new**): verifies `user_<8hex>_<8hex>` trigger detection, reserved/placeholder client guardrails, and `PATCH /api/profile` completion.
  - [`__tests__/typing/persistence.test.ts`](../../__tests__/typing/persistence.test.ts) (`14` tests): verifies pure duplicate runs leave streaks unchanged (even across UTC days) and return `unlocked: []`, future `last_active_date` skews are never overwritten backwards, orphan replay recovery anchors to `created_at` UTC date, and `is_invalidated` / conflicting `client_run_id` raise structured `ResultPersistenceError` across lookup/signature/`23505`/RPC `P0001` paths.
  - [`__tests__/api/results.route.test.ts`](../../__tests__/api/results.route.test.ts) (`12` tests): verifies Run A retry recovery even after a newer Run B within `8s`, bounded recovery rate limits (`429`), cache digest mismatch (`409 CLIENT_RUN_ID_CONFLICT`), live DB invalidation eviction (`409 RESULT_INVALIDATED`), and production `503 ADMIN_CONFIG_MISSING`.
  - [`__tests__/api/sync.route.test.ts`](../../__tests__/api/sync.route.test.ts) (`8` tests): verifies `isValidDuration` filtering in quota metering, permanent `rejectedIds` handling of invalidated & `clientRunId`-conflicting runs, and production `503` fail-closed gate.
  - [`__tests__/api/challenges.route.test.ts`](../../__tests__/api/challenges.route.test.ts) (`5` tests) & [`__tests__/typing/sync-client.test.ts`](../../__tests__/typing/sync-client.test.ts) (`5` tests) & [`__tests__/components/dashboard-page.test.tsx`](../../__tests__/components/dashboard-page.test.tsx) (`2` tests).
- `npm run test:e2e` (`playwright test` on isolated `127.0.0.1:3105`, executed after all edits): **PASS — `7/7` Chromium E2E tests** in `52.9s` (Test 5 exercises `/challenge/11111111-1111-4111-8111-111111111111` fallback + `/typing` navigation; Test 6 completed in `8.5s` verifying unique semantic `<main>` landmarks across all `9` desktop Dark/Light + mobile routes).
- `npm run test:db` (`sh tests/db/run-pg-verification.sh`): **FAIL (`exit 1`, `'sh' is not recognized`)** — `docker`, `psql`, `supabase`, `sh`, and `bash` are absent on this Windows host; [`verify_migrations.sql`](../../tests/db/verify_migrations.sql), [`supabase_shim.sql`](../../tests/db/supabase_shim.sql), and [`.github/workflows/ci-postgres-verification.yml`](../../.github/workflows/ci-postgres-verification.yml) remain **unexecuted against a live PostgreSQL 16 binary** until run in CI/Docker.
- `git diff --check`: **PASS (`exit 0`)**.
