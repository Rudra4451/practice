# TyProX 2.0 Architecture & Engineering Decision Log

**Purpose:** Record key architectural, database, security, engine, and design decisions along with rejected alternatives and production constraints.

---

## ADR-001: Maintain Production Compatibility (`PGRST205` & Schema Boundaries) Until Database Approval Gate
- **Date:** 2026-11-10
- **Context:** Batch 1.1A preflight verified that live Supabase project `gbovkejymfeiqgverzfr` lacks `leaderboard_view`, has 11 custom rows in `achievements`, only exposes `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` (no `SUPABASE_SERVICE_ROLE_KEY`), and has no confirmed backups.
- **Decision:** Keep `GET /api/leaderboard` resilient via its `PGRST205` `test_results` fallback until `20260620100000_leaderboard_view.sql` / forward hardening SQL is approved and applied. Write server code so `lib/supabase/admin.ts` uses `SUPABASE_SERVICE_ROLE_KEY` automatically when configured and falls back cleanly to authenticated SSR queries against existing live columns without referencing unapplied columns (`client_run_id`, `generator_version`, `is_ranked`) until migration approval.
- **Consequences:** All security fixes (`SEC-1.1` through `SEC-1.7`) deploy cleanly against the current live database without runtime SQL 400/500 regressions while ready-to-run SQL migrations wait safely at the Production Approval Gate.

## ADR-002: Preserve OAuth Callback URL Allowlist Contract
- **Date:** 2026-11-10
- **Context:** Existing `lib/supabase/auth.ts` and `app/login/page.tsx` pass exact `redirectTo: ${window.location.origin}/auth/callback` without query strings to match strict Supabase Auth redirect allowlists.
- **Decision:** Harden `?next=` / redirect handling inside `app/auth/callback/route.ts`, `lib/supabase/middleware.ts`, and post-login redirect logic via `sanitizeRedirectPath()` in `lib/security/redirect.ts`, without altering OAuth `redirectTo` query parameters.
- **Consequences:** Eliminates Open Redirect attacks while preventing Supabase OAuth allowlist mismatches.

## ADR-003: Single Isomorphic Typing Engine Module Shared by Worker, Server Verifier, and Tests
- **Date:** 2026-11-10
- **Context:** Metric calculation previously lived solely in `workers/analytics.worker.ts` using `lastKeystrokeTime - startTime` (`PA-01` 200 WPM exploit) and deleting backspace errors from `rawInputs` (`PA-02`), with `POST /api/results` trusting client numbers blindly.
- **Decision:** Extract pure deterministic modules `lib/typing/metrics.ts` and `lib/typing/text-generator.ts` shared identically by the Web Worker, Zustand store helpers, server `lib/typing/verifier.ts`, and Vitest suites.
- **Consequences:** Zero divergence between live displayed WPM/accuracy and server-verified persisted scores.

## ADR-004: Sentinel-Based `beforeinput` + `composition` Typing Input Capture
- **Date:** 2026-11-10
- **Context:** `<textarea value="">` slicing `.slice(-1)` drops mobile swipe/autocorrect commits and fails Android `Backspace` (`key === 'Unidentified'`).
- **Decision:** Move to an uncontrolled ref-managed `<textarea>` seeded with a sentinel space character, intercepting `beforeinput`, `compositionstart`/`compositionend`, and `onChange` character-diff commits, with strict interactive element focus exemptions (`button, a, input, select, [role="button"], [role="dialog"]`).
- **Consequences:** Supports Android Gboard, iOS Safari, dead keys, CJK IME composition, and desktop rapid typing without sacrificing keyboard accessibility on page controls.

## ADR-005: Editorial Charcoal & Orange System (`#0B0B0C` / `#FF641F`) with Verified WCAG AA Light & Dark Modes
- **Date:** 2026-11-10
- **Context:** Earlier code mixed Neobrutalist `border-3`, indigo shadows (`rgba(99,102,241)`), `text-[6px]`, missing CSS tokens (`text-warning`, `bg-neutral-850`, `bg-surface-hover`), and low-contrast white-on-orange buttons (`3.10:1`).
- **Decision:** Adopt `#0B0B0C` / `#151517` / `#1D1D20` / `#F5F5F3` / `#A1A1A1` / `#FF641F` / `#292929` for Dark default (matching SSR script `'dark'` default) alongside high-contrast Light editorial tokens (`#F6F6F4` / `#FFFFFF` / `#ECECEA` / `#0B0B0C`), using dark `#0B0B0C` ink on `#FF641F` fills (`6.65:1` AA pass verified via `contrast-check.py`).
- **Consequences:** Single coherent visual language across all routes with zero failed contrast ratios or unstyled theme modes.

## ADR-006: Remove `/showcase` Static Mock Route and Fabricated Testimonials
- **Date:** 2026-11-10
- **Context:** `app/showcase/page.tsx` duplicated 1,236 lines of hardcoded Neobrutalist simulation disconnected from real navigation, and `app/page.tsx` displayed fictional testimonials (`Alex M.`, `Sarah C.`) and invented XP points.
- **Decision:** Remove unlinked dead artifacts (`app/showcase/page.tsx`, `app/page.tsx.modified`, `lib/supabase.ts`, `public/robots.txt`, unused starter SVGs) and replace fabricated proof on `/` with genuine capability descriptions and interactive practice/leaderboard links matching live DB behavior.

## ADR-007: Guest + Cloud Dual Architecture for `/profile` and `/dashboard/performance-lab`
- **Date:** 2026-11-10
- **Context:** Early middleware rules redirected unauthenticated requests on `/profile`, whereas Performance Lab and Preferences intentionally support local guest sessions via Zustand `localStorage` persistence alongside automatic cloud sync when signed in.
- **Decision:** Remove forced `/login` redirect from `lib/supabase/middleware.ts` for `/profile` and `/dashboard/performance-lab` while keeping SSR cookie refresh and `401 Unauthorized` server enforcement on `POST /api/results`, `POST /api/results/sync`, `POST /api/challenges`, and `PATCH /api/profile`.
- **Consequences:** Guests can tune typing fonts, audio volume, drill sessions, curriculum progress, and Performance Lab telemetry locally without losing security boundaries on any authenticated API route.

## ADR-008: Deterministic UTC Date Formatting & Isolated Playwright Port (`3105`)
- **Date:** 2026-11-10
- **Context:** Node (`en-IN` / OS locale) and headless Chromium (`en-US`) formatted `new Date().toLocaleDateString()` differently on SSR Server Components and client tables (`#418` hydration mismatch), while a host dev process on `:3000` hijacked Playwright tests when `reuseExistingServer` targeted port `3000`.
- **Decision:** Introduce `formatUtcDate` in [lib/utils/format-date.ts](../../lib/utils/format-date.ts) pinned to `'en-US'` with `timeZone: 'UTC'` across all shared SSR/client date displays, and run Playwright (`playwright.config.ts`) on dedicated `http://127.0.0.1:3105` with `reuseExistingServer: false`.
- **Consequences:** Zero React hydration mismatches across SSR and browser timezones, and deterministic isolated E2E execution against built production artifacts.

## ADR-009: Separate Canonical Bracket `duration` From Actual `elapsedSeconds` on Early Completion
- **Date:** 2026-11-10
- **Context:** Completing a passage before countdown expiry (`text_complete`) previously overwrote `result.duration` with rounded elapsed seconds (e.g., `14` on a `15s` run). That excluded legitimate finishes from `[15, 30, 60, 120]` leaderboards and caused `/challenge/[id]` submissions (`challenge_links.duration`) to fail `VALID_DURATIONS` Zod validation.
- **Decision:** Keep [`TypingSessionResult.duration`](../../lib/typing/metrics.ts) equal to the canonical configured bracket (`15 | 30 | 60 | 120`, normalized via `normalizeBracketDuration`), expose actual timing in `elapsedSeconds` while retaining `totalElapsedMs` for WPM math, and persist/query canonical bracket durations everywhere across `/api/results`, `/api/challenges`, `ResultScreen`, and `ChallengeArenaClient`.
- **Consequences:** Fast passage completions score accurately on elapsed time while remaining valid and competitive in bracket leaderboards and 1v1 challenges.

## ADR-010: Schema-Adaptive `client_run_id` Persistence, Compensating Replay Rollback & Selective Chunked Sync
- **Date:** 2026-11-10
- **Context:** Production `gbovkejymfeiqgverzfr` has not yet applied [`20260621000000_typrox_2_hardening.sql`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql) (so `test_results.client_run_id` is absent in live Postgres), while `POST /api/results/sync` lacked throttling/dedup and `DashboardPage.handleSyncHistory` wiped un-synced runs `31..100` via `clearGuestHistory()`.
- **Decision:** In [`lib/typing/persistence.ts`](../../lib/typing/persistence.ts), query and insert `client_run_id` optimistically with graceful `PGRST204`/`42703` fallback for pre-migration schemas, handle `23505` conflict recovery, enable telemetry-signature deduplication + `<15m` orphaned partial-write recovery during batch sync, roll back orphaned `test_results` rows cleanly if `replays` insert fails, and propagate streak/achievement write failures strictly. On the client ([`lib/typing/sync-client.ts`](../../lib/typing/sync-client.ts)), chunk syncable runs in batches of `30` and delete only server-confirmed IDs.
- **Consequences:** Zero regression on the pre-hardening database, automatic idempotency upgrade once `20260621` runs, rate-limited batch sync (`429` + `Retry-After`), and zero local guest data loss across large queues or partial (`207`) failures.

## ADR-011: Isolate `Hero3D` Perspective Stacking Context & Dock Capability Cards Outside `preserve-3d`
- **Date:** 2026-11-10
- **Context:** Absolutely positioned HUD cards shared an un-isolated `preserve-3d` stage with a rotated keyboard chassis (`rotateX: 24deg`), causing desktop/laptop bounding-box overlaps and Z-plane background slicing through lower keyboard rows in Light Mode.
- **Decision:** Isolate `perspective: '1200px'` inside a dedicated `isolate` wrapper around the keyboard chassis ([`components/home/hero-3d.tsx`](../../components/home/hero-3d.tsx)), apply gentler `rotateX: 14deg` / `rotateZ: -1.5deg` tilt on nested transforms so no corner crosses `Z < 0` behind `bg-background`, and dock the 4 capability HUD cards in a clean responsive grid (`grid-cols-2 lg:grid-cols-4`) directly below the chassis.
- **Consequences:** Zero overlap or chassis Z-clipping across all viewports (`1440px` to `375px`) in both Dark and Light themes while preserving interactive parallax and typing animations.

## ADR-012: Privilege-Aware Compensating Rollback & Single-Transaction `submit_verified_result` Postgres RPC
- **Date:** 2026-11-11
- **Context:** When `SUPABASE_SERVICE_ROLE_KEY` is missing in `.env.local`, [`createAdminClient()`](../../lib/supabase/admin.ts) returns `null` and routes fall back to SSR `authenticated` context. Postgres has no `DELETE` policy on `public.test_results`, so a bare `.delete().eq('id', ...)` silently deletes `0` rows without an error.
- **Decision:** Only execute compensating `DELETE` (with explicit `.select('id')` row-count verification) when `isPrivilegedClient` (`service_role`) is true; log missing `SUPABASE_SERVICE_ROLE_KEY` once safely (`warnMissingServiceRoleOnce()`); surface structured [`ResultPersistenceError`](../../lib/typing/persistence.ts) (`recoverable: true` when an unrolled orphan exists); and author `submit_verified_result` (`SECURITY DEFINER`, `service_role`-only, row-locked streaks, `(user_id, client_run_id)` scoped uniqueness) as the authoritative transactional write path once `20260621`–`20260623` deploy.
- **Consequences:** Eliminates silent orphan masking without breaking pre-migration compatibility, ensures privileged `service_role` writes persist atomically once migrations run, and enables reliable retry recovery of partial failures.

## ADR-013: Share Sync Batch Constants in `lib/typing/sync-client.ts` Outside App Route Handler Modules
- **Date:** 2026-11-11
- **Context:** Next.js App Router Route Handlers (`app/**/route.ts`) reject extra named exports under Webpack strict `.next/types/` validation (`TS2344` on `export const MAX_SYNC_BATCH_SIZE = 30`), even though Turbopack structural typegen permitted it.
- **Decision:** Keep non-handler shared constants (`MAX_SYNC_BATCH_SIZE = 30`, `SYNC_CHUNK_SIZE`) in [`lib/typing/sync-client.ts`](../../lib/typing/sync-client.ts) and import them into [`app/api/results/sync/route.ts`](../../app/api/results/sync/route.ts).
- **Consequences:** Full App Router compliance across both Webpack and Turbopack builds and typechecks.

## ADR-014: Recoverable Held-Run State (`syncStatus: 'rejected'`) & Legacy Invalid-Duration Exclusion
- **Date:** 2026-11-11
- **Context:** Legacy guest runs with non-bracket durations (`e.g. 12s`) and verification-rejected runs (`400` / `rejectedIds`) remained counted in `getSyncableGuestRunsCount()`, causing infinite `/dashboard` sync prompts and quota burn without deletion protection.
- **Decision:** Exclude `!isValidDuration(item.duration)` and `item.syncStatus === 'rejected'` from `isSyncableGuestResult()`, persist explicit `'rejected'` metadata via `markGuestResultsRejected` / `retryRejectedGuestResults` in [`useUserStore`](../../stores/user-store.ts), preserve transient failures (`429`, `207`, `500`, network errors) as `'pending'`, and surface `"Local-Only / Paused Runs Preserved"` + `"Retry Held Runs"` in [`DashboardPage`](../../app/dashboard/page.tsx).
- **Consequences:** Zero endless sync loops and zero accidental deletion of local history or telemetry.

## ADR-015: Remove `<45s` `POST /api/results` Short-Circuit & Compute True Recovery PB
- **Date:** 2026-11-11
- **Context:** Returning `200 OK` on `rateCheck.latestRow` within `45s` bypassed `persistVerifiedResult`, leaving failed replays unrecovered, skipping streaks/achievements, hardcoding `isPersonalBest: false`, and allowing `>=45s` pre-migration retries to duplicate rows without `deduplicateBySignature`.
- **Decision:** Route `<45s` retries straight through `persistVerifiedResult(..., { clientRunId, deduplicateBySignature: true, isPrivilegedClient })` in [`app/api/results/route.ts`](../../app/api/results/route.ts), and update [`finalizeRecoveredResult`](../../lib/typing/persistence.ts) to compute true prior PB excluding `existingRow.id`.
- **Consequences:** Partial failures recover replays, streaks, achievements, and accurate `isPersonalBest` flags cleanly across both `client_run_id` and pre-migration schemas.

## ADR-016: Forward Corrective Migration (`20260624`) Preserving `20260618`–`20260623` History
- **Date:** 2026-11-11
- **Context:** Phase 1B independent auditing uncovered defects in prepared migrations [`20260621000000_typrox_2_hardening.sql`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql) (`profiles.username` direct `UPDATE` grant, single-collision `handle_new_user()`) and `20260623000000_atomic_result_persistence_and_idempotency.sql` (streak mutation on pure dedups, missing `is_invalidated` / conflict checks on `client_run_id`). Modifying historical migrations risks Supabase CLI migration-history checksum mismatches.
- **Decision:** Leave `20260618`–`20260623` untouched and deliver all SQL fixes in forward corrective migration `supabase/migrations/20260624000000_phase1c_security_and_streak_fixes.sql`, accompanied by a PostgreSQL 16 verification suite ([`tests/db/verify_migrations.sql`](../../tests/db/verify_migrations.sql), [`.github/workflows/ci-postgres-verification.yml`](../../.github/workflows/ci-postgres-verification.yml)).
- **Consequences:** Preserves clean forward migration ordering while closing every SQL defect ahead of Production DB Gate execution.

## ADR-017: Qualifying-Event Streak Semantics & Explicit `is_invalidated` / `client_run_id` Conflict Rejection
- **Date:** 2026-11-11
- **Context:** Replaying already-completed runs across UTC midnight must never advance `streaks.current_streak`, backwards-overwrite future `last_active_date`, unlock achievements twice, or legitimize admin-invalidated runs and mismatched `client_run_id` payloads.
- **Decision:** In both `submit_verified_result` and [`persistVerifiedResult`](../../lib/typing/persistence.ts), restrict streak + achievement mutation to `NOT v_deduplicated OR v_recovered_partial` (anchoring orphan replay recoveries to `v_result.created_at` UTC date and returning `unlocked = []` on pure duplicates), reject invalidated runs (`RESULT_INVALIDATED`) and payload/telemetry mismatches (`CLIENT_RUN_ID_CONFLICT`) with HTTP `409` (`POST /api/results`) or permanent `'rejected'` quarantine (`POST /api/results/sync`).
- **Consequences:** Eliminates cross-day streak farming via duplicate retries and ensures invalidated/tampered `clientRunId` retries fail consistently across RPC and TS fallback paths.

## ADR-018: Revoke Direct `profiles.username` REST Updates & Share Validation via `lib/security/username.ts`
- **Date:** 2026-11-11
- **Context:** Column-level `GRANT UPDATE (..., username, ...)` in `20260621` allowed authenticated clients to bypass [`PATCH /api/profile`](../../app/api/profile/route.ts) reserved-word and one-time handle locking rules directly via PostgREST, while `handle_new_user()` lacked multi-collision retry loops.
- **Decision:** Revoke table-wide `UPDATE` on `public.profiles` and grant column-level `UPDATE` strictly for `(display_name, avatar_url, theme, font_family, updated_at)` in `20260624`; enforce `is_reserved_username` + one-time handle lock via trigger `trg_enforce_profile_username_integrity`; loop `0..15` with random suffixes in `handle_new_user()`; and align UI/API rules in [`lib/security/username.ts`](../../lib/security/username.ts) and [`UsernameModal`](../../components/auth/username-modal.tsx).
- **Consequences:** Prevents direct REST handle spoofing or reserved route hijacking while keeping normal theme/font/display preference updates smooth and making username transitions fail-closed via `PATCH /api/profile`.

## ADR-019: Fail-Closed Privileged Write Resolution (`503`) & Run-Scoped Recovery Ordering
- **Date:** 2026-11-11
- **Context:** Failing open to caller SSR context when `SUPABASE_SERVICE_ROLE_KEY` is absent creates a silent production misconfiguration trap, while checking latest-run `8s` cooldown before `clientRunId` recovery caused newer Run B completions to block Run A orphan recovery with `429`.
- **Decision:** Centralize privilege enforcement in [`resolvePrivilegedWriteClient()`](../../lib/supabase/admin.ts#L105-L129) throwing `AdminConfigurationError` (`503 ADMIN_CONFIG_MISSING`) in `NODE_ENV === 'production'` when the service-role key is missing, and prioritize bounded [`checkClientRunRecoveryBudget`](../../lib/security/rate-limit.ts#L173-L210) + payload-digest/invalidation verification ahead of cross-run cooldowns in [`POST /api/results`](../../app/api/results/route.ts).
- **Consequences:** Production failures fail closed with actionable diagnostics rather than silently downgrading privileges, while legitimate Run A retry recovery works even immediately after a newer Run B without opening an unthrottled endpoint DoS vector.

## ADR-020: Phase 1H Atomic Pre-Cutover Consolidation (`20260621`–`20260622`) & Reference Schema Separation
- **Date:** 2026-11-11
- **Context:** Pre-merge audit `PHASE_1G_PRE_MERGE_REVIEW.md` identified an inter-migration security/outage window across `20260621` -> `20260623` -> `20260624`, noted non-timestamped `FULL_SCHEMA.sql` inside `supabase/migrations/`, uncovered a missing `profiles` insert-policy drop, unrevoked legacy SQL Editor helper risk, unfiltered `challenge_attempts` read exposure, and missing `FULL_SCHEMA.sql` upgrade testing. Since `20260621`–`20260624` had NOT been applied to production (`gbovkejymfeiqgverzfr`), consolidating them prior to production execution eliminates any partial intermediate states cleanly.
- **Decision:** Consolidate `20260623` and `20260624` into a single atomic `BEGIN; SET LOCAL lock_timeout = '5s'; ... COMMIT;` migration in [`supabase/migrations/20260621000000_typrox_2_hardening.sql`](../../supabase/migrations/20260621000000_typrox_2_hardening.sql) (reconciling `idx_test_results_leaderboard` by predicate/keys, adding dynamic `pg_proc` revoke sweeps, non-destructive `is_ranked = FALSE` quarantine, and `idx_profiles_username_lower`); wrap [`20260622000000_learning_and_competitive_ecosystem.sql`](../../supabase/migrations/20260622000000_learning_and_competitive_ecosystem.sql) with `challenge_attempts` expiry enforcement; relocate legacy `FULL_SCHEMA.sql` to [`supabase/reference/FULL_SCHEMA.sql`](../../supabase/reference/FULL_SCHEMA.sql); and expand `tests/db/` to assert clean, `FULL_SCHEMA.sql` upgrade, and drift-reconciliation scenarios.
- **Consequences:** Eliminates inter-migration downtime or username-privilege windows, validates both greenfield and legacy production upgrade paths in PG16 CI, and preserves clean migration filenames (`^[0-9]{14}_.*\.sql$`).

## ADR-021: Mutation Origin/Payload Guards (`lib/security/http.ts`), Ranked Peak Parity & Canonical Site URL Helper
- **Date:** 2026-11-11
- **Context:** Remaining API mutation routes parsed unbounded request JSON bodies (`request.json()`), lacked explicit cross-origin `Origin` header validation, lacked challenge/profile mutation rate limits, and had pre-`is_ranked` mismatches in `/u/[username]`, `/dashboard`, and `leaderboard.ts` fallbacks alongside inconsistent hardcoded `typrox.vercel.app` fallback strings.
- **Decision:** Add [`assertSameOriginIfPresent`](../../lib/security/http.ts#L60-L97) (`403`) and [`readJsonBodyWithLimit`](../../lib/security/http.ts#L99-L152) (`413` on declared or actual UTF-8 byte length) across all API `POST`/`PATCH` routes, add `checkChallengeRateLimit` / `checkProfileUpdateRateLimit` (`20/min`) in [`lib/security/rate-limit.ts`](../../lib/security/rate-limit.ts), align `is_ranked` filtering & conditional lifetime peak queries across [`lib/data/profile.ts`](../../lib/data/profile.ts), [`lib/data/leaderboard.ts`](../../lib/data/leaderboard.ts), and [`app/dashboard/page.tsx`](../../app/dashboard/page.tsx), fix [`ResultScreen`](../../components/typing/result-screen.tsx) `handleShare` save-race awaiting `inFlightSubmissions`, add paste blocking in typing arenas, centralize [`getSiteUrl`](../../lib/seo/site-url.ts), and upgrade `next` / `eslint-config-next` to `16.4.6` (`0` runtime audit vulnerabilities).
- **Consequences:** Closes request-size DoS, CSRF origin, challenge-link share race, and paste-cheat vectors while keeping pre-migration database compatibility intact across Webpack, Turbopack, and Playwright CI gates.

