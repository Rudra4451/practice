# TyProX 2.0 — Independent Post-Implementation Technical Audit

**Audit Date:** 2026-11-10  
**Auditor Role:** Independent Principal Software Engineer, Application Security Engineer, Database Reliability Engineer, QA Lead & Product Auditor  
**Repository:** `c:\Users\rudra\TyProX` (`https://github.com/Rudra4451/practice`)  
**Git Baseline:** `main` at [`fba1d80`](file:///c:/Users/rudra/TyProX/.git) (+ 96 uncommitted working-tree changes)  
**Target Supabase Ref (Observed Config):** `gbovkejymfeiqgverzfr`  
**Audit Method:** Strict read-only inspection (zero source, test, SQL, env, or DB modifications; all automated checks, build, Playwright E2E, live read-only `anon` Supabase REST probes, and 4-viewport visual/a11y screenshot inspections executed firsthand).

---

## Executive Summary & Authoritative Release Verdict

### Final Verdict: **`NOT READY — BLOCKED ON PRODUCTION DB GATE & REMAINING P1 ITEMS`**
*(Codebase P0 blockers remediated in Post-Audit Phase 1; production deployment remains **BLOCKED** pending Owner DB Approval Gate on Supabase Project `gbovkejymfeiqgverzfr` and deferred security/product items.)*

> **Post-Audit Remediation Phase 1 Addendum (2026-11-10):**  
> Application-level P0 fixes completed & verified (`typecheck` 0 errors, `lint` 0 errors/warnings, `19` unit files / `84/84` tests, `33`-route `next build`, `7/7` Chromium E2E tests + 4-viewport Dark/Light screenshots):
> - **App Fixed (DB Gate Still Required):** [`SEC-A1`](file:///c:/Users/rudra/TyProX/app/api/results/sync/route.ts) (sync rate limit, `clientRunId` + signature deduplication, chunked selective client sync preserving unpersisted/`>30`/unranked runs), [`SEC-A3`](file:///c:/Users/rudra/TyProX/lib/typing/persistence.ts) (schema-adaptive `client_run_id` + `23505` recovery, compensating replay rollback, strict streak/achievement error checks, `.eq('is_invalidated', false)` rate-limit filter), [`DB-A2`](file:///c:/Users/rudra/TyProX/public/achievements/speed_80.svg) (3 missing SVG files added locally; `20260621` SQL unchanged per governance), [`DB-A3`](file:///c:/Users/rudra/TyProX/types/database.ts) (`types/database.ts` aligned for `client_run_id` & nullable `last_active_date`; live `leaderboard_view` & `.limit(300)` unchanged).
> - **Resolved in Codebase:** [`ENG-A1`](file:///c:/Users/rudra/TyProX/lib/typing/metrics.ts) (canonical bracket `duration` vs `elapsedSeconds`), [`ENG-A2`](file:///c:/Users/rudra/TyProX/components/challenge/challenge-arena-client.tsx) (`ChallengeArenaClient` `resetTest()` cleanup on unmount), [`ENG-A3`](file:///c:/Users/rudra/TyProX/components/typing/result-screen.tsx) (save failure `role="alert"` banners + failed promise eviction + `"Retry Save"`), [`UX-A1`](file:///c:/Users/rudra/TyProX/components/typing/cat-companion.tsx) (Light Mode `CatCompanion` drawer opaque `bg-surface` & `z-40` fix), [`UX-A2`](file:///c:/Users/rudra/TyProX/components/home/hero-3d.tsx) (`Hero3D` perspective isolation & docked capability HUD grid), [`QA-A2`](file:///c:/Users/rudra/TyProX/__tests__/api/sync.route.test.ts) (added unit/RTL suites for `/api/results/sync`, `sync-client`, `persistence`, and `ChallengeArenaClient`).
> - **Explicitly Unresolved / Gated:** Live `public.replays` `anon` read RLS (`164` rows — app queries remain strictly scoped to authenticated owners in `performance-lab`), absent `SUPABASE_SERVICE_ROLE_KEY`, unapplied `20260621` (`DB-A1`, `DB-A2` SQL catalog) & `20260622` migrations, `DB-A3` live `leaderboard_view` / `.limit(300)`, `DB-A4`, `SEC-A2` (server-signed run-start tokens), `SEC-A4`, `SEC-A5`, `ENG-A4`–`A7`, `UX-A3`–`A5`, `QA-A1`, `QA-A3` (authenticated E2E), `DEBT-01`–`02`, and unbuilt `20260622` ecosystem endpoints.

The TyProX 2.0 implementation delivers genuine, well-engineered security and typing-engine improvements over baseline [`fba1d80`](file:///c:/Users/rudra/TyProX): debug write endpoints were removed, OAuth redirect sanitization blocks open redirects cleanly, all demo auth/leaderboard bypasses are gone, `lib/typing/metrics.ts` and `lib/typing/verifier.ts` share deterministic scoring that eliminates the 200 WPM single-keystroke exploit, mobile/IME input handling was rebuilt safely, ESLint was brought from `111` problems (`55` errors, `56` warnings) to **`0`**, and `63` unit tests + `6` Chromium E2E checks + `33`-route Next.js `16.2.9` builds pass.

However, **deploying today would either fail functionally or leave high-severity integrity holes exposed** for six concrete reasons verified firsthand:
1. **`POST /api/results/sync` has no rate limiting, no cooldown, and no `client_run_id` deduplication** — an authenticated caller can loop 30x copies of one verified payload per request to flood `test_results` and `replays`, while [`DashboardPage.handleSyncHistory`](file:///c:/Users/rudra/TyProX/app/dashboard/page.tsx#L353-L372) silently deletes un-synced local runs `31..100` (`clearGuestHistory()`).
2. **`SUPABASE_SERVICE_ROLE_KEY` is absent in `.env.local`**, while [`20260621000000_typrox_2_hardening.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260621000000_typrox_2_hardening.sql) has **not been applied** to live Supabase (`leaderboard_view` still returns `PGRST205`, `164` `replays` remain publicly readable via `anon`, `6` `__debug_test__` `user_id = NULL` rows persist). Applying `20260621` without `SUPABASE_SERVICE_ROLE_KEY` breaks all ranked writes (`42501`); shipping without `20260621` leaves client RLS bypasses wide open.
3. **`20260621` contains a blanket `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public` statement** (`line 31`) and omits **3 live production achievement codes** (`SPEED_80`, `SPEED_150`, `STREAK_14`) whose SVG icons (`speed_80.svg`, `speed_150.svg`, `streak_14.svg`) do not exist in `public/achievements/`.
4. **Finishing a run early (`text_complete`) saves an unbucketed `duration`** (e.g., `12s` on a `15s` test) instead of the configured bracket duration, causing ranked runs to miss `[15, 30, 60, 120]` leaderboards and **causing challenger submissions on `/challenge/[id]` to fail Zod validation (`400`) silently**.
5. **Two severe visual/UI defects fail visual inspection**: [`Hero3D`](file:///c:/Users/rudra/TyProX/components/home/hero-3d.tsx#L440-L464,L587-L639) overlaps and physically Z-slices the desktop/laptop HUD cards behind the rotated 3D keyboard (`CURI... / 12 Le...`), and [`CatCompanion`](file:///c:/Users/rudra/TyProX/components/typing/cat-companion.tsx#L696,L743,L775) renders light-mode charcoal text on a hardcoded near-black `bg-neutral-950/90` collection overlay with footer text bleeding through.
6. **Product completeness is materially below roadmap perception for Phases 4–5**: `/learn` and `/daily` persist progress only in browser `localStorage` (`user-store`), zero endpoints touch [`20260622000000_learning_and_competitive_ecosystem.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260622000000_learning_and_competitive_ecosystem.sql), and `SPEC-5.3`, `SPEC-5.5`–`5.10` remain unimplemented.

---

## 1. Phase 1 — Repository, Dependency & Roadmap Verification

### 1.1 Git, Workspace & Runtime Inventory (Verified)
- **Branch & Commit:** Active branch `main` at [`fba1d80`](file:///c:/Users/rudra/TyProX) (*Merge pull request #1 from Rudra4451/feature/cat-reaction-system*).
- **Uncommitted Working Tree (`96` paths):** `47` modified tracked files, `11` deleted tracked files (removed `/api/debug/supabase`, `/api/test-supabase`, `/showcase`, `app/page.tsx.modified`, `lib/supabase.ts`, legacy SVGs, `public/robots.txt`), and `38` untracked files/directories (`__tests__/`, `tests/`, `lib/{audio,data,hooks,security,typing,utils}/`, `app/{daily,learn,api/challenges,api/results/sync}/`, `docs/`, `supabase/migrations/20260621*` & `20260622*`, `types/database.ts`, `vitest.config.mts`, `playwright.config.ts`). **No commits or tags separate Phase 1–5**, increasing rollback/deployment risk until cleanly committed.
- **Framework Compliance (`AGENTS.md` / Next.js `16.2.9`):** Uses [`proxy.ts`](file:///c:/Users/rudra/TyProX/proxy.ts#L1-L19) exporting `async function proxy(request: NextRequest)` and `config.matcher`, verified compliant against [`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`](file:///c:/Users/rudra/TyProX/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md). Zero deprecated `middleware.ts` exists.
- **Environment Variable Names (Values Withheld):** `.env.local` sets `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Missing: `SUPABASE_SERVICE_ROLE_KEY` (server admin client blocker) and `NEXT_PUBLIC_SITE_URL` (`app/sitemap.ts:5` & `app/robots.ts:4` fall back to `https://typrox.vercel.app`). [.env.example](file:///c:/Users/rudra/TyProX/.env.example) documents expected keys cleanly.

### 1.2 Verification vs. Roadmap Claims
| Roadmap Claim | Doc Source | Actual Codebase Reality | Audit Assessment |
|---|---|---|---|
| Phase 1 app hardening (`SEC-1.1`..`1.3`, `1.6`, `1.7`) | [IMPLEMENTATION_STATUS.md](file:///c:/Users/rudra/TyProX/docs/roadmap/IMPLEMENTATION_STATUS.md#L34-L47) | Debug endpoints deleted; redirects sanitized; demo bypasses removed; API Zod/error masking added. **Deviation:** [`middleware.ts`](file:///c:/Users/rudra/TyProX/lib/supabase/middleware.ts#L34-L38) intentionally skips `307` login redirects on `/dashboard` & `/profile` (contradicts [`SECURITY_REMEDIATION_PLAN.md` (`SEC-1.3`)](file:///c:/Users/rudra/TyProX/docs/roadmap/SECURITY_REMEDIATION_PLAN.md#L91,L97), documented post-hoc in [`ADR-007`](file:///c:/Users/rudra/TyProX/docs/roadmap/DECISION_LOG.md#L42-L46)). | **Mostly Accurate** (policy shift documented) |
| Server verifier & `sync` (`SEC-1.4`) | [IMPLEMENTATION_STATUS.md](file:///c:/Users/rudra/TyProX/docs/roadmap/IMPLEMENTATION_STATUS.md#L43-L45) | `POST /api/results` is strong, **but** `POST /api/results/sync` omits rate limiting & dedup, and no server-issued run-start token exists (`verifier.ts`). | **Partially Accurate / Gap Found** |
| `/learn` (`SPEC-5.2`) & `/daily` (`SPEC-5.4`) `"client-sync adapter prepared for 20260622"` | [IMPLEMENTATION_STATUS.md](file:///c:/Users/rudra/TyProX/docs/roadmap/IMPLEMENTATION_STATUS.md#L77-L78) | Both track state purely in Zustand `localStorage` ([`stores/user-store.ts`](file:///c:/Users/rudra/TyProX/stores/user-store.ts#L52-L53,L119-L155)). **Zero API routes, DAL queries, or Supabase calls read or write `user_lesson_progress`, `daily_challenges`, `user_challenge_progress`, `user_progression`, or `challenge_attempts`.** | **Overstated** |
| `replay-analyzer.ts` computes median bigram latency | [PRODUCT_FEATURE_SPECIFICATIONS.md](file:///c:/Users/rudra/TyProX/docs/roadmap/PRODUCT_FEATURE_SPECIFICATIONS.md#L21) | [`lib/typing/replay-analyzer.ts`](file:///c:/Users/rudra/TyProX/lib/typing/replay-analyzer.ts#L260-L264) computes arithmetic mean (`avgMs`), not median. | **Minor Spec Drift** |
| Remaining ecosystem (`SPEC-5.3`, `5.5`–`5.10`) | [PRODUCT_FEATURE_SPECIFICATIONS.md](file:///c:/Users/rudra/TyProX/docs/roadmap/PRODUCT_FEATURE_SPECIFICATIONS.md#L63-L242) | XP/levels, persisted challenge duels (`challenge_attempts`), TSI season ratings, follows, 365-day `/u/[username]` heatmap, `/replay/[id]`, `/compare` are **not implemented**. | **Honest (Omitted cleanly in status table)** |

### 1.3 Dead Code & Unused Dependencies (`DEBT-*`)
- **`DEBT-01` (Low) — Unused devDependency `vite-tsconfig-paths` ([`package.json:45`](file:///c:/Users/rudra/TyProX/package.json#L45)):** [`vitest.config.mts:6-8`](file:///c:/Users/rudra/TyProX/vitest.config.mts#L6-L8) uses Vite's native `resolve: { tsconfigPaths: true }`; `vite-tsconfig-paths` has zero references anywhere in build/test config.
- **`DEBT-02` (Low) — Dead Barrel & Auth Helpers:** [`utils/text-generator.ts`](file:///c:/Users/rudra/TyProX/utils/text-generator.ts#L1-L7) has zero callers anywhere; [`lib/supabase/auth.ts`](file:///c:/Users/rudra/TyProX/lib/supabase/auth.ts#L44-L67) exports `getClientSession()` (which calls deprecated `supabase.auth.getSession()`) and `getProfile()` with zero callers outside that file.

---

## 2. Phase 2 — Security Audit (`SEC-*`)

### Verified Positive Controls
- **Anonymous Write Surface in API Routes:** `POST /api/results`, `POST /api/results/sync`, `POST /api/challenges`, and `PATCH /api/profile` all authenticate server-side with `supabase.auth.getUser()` and fail closed with `401`.
- **Anti-Cheat Replay Verification ([`lib/typing/verifier.ts`](file:///c:/Users/rudra/TyProX/lib/typing/verifier.ts#L56-L228)):** Strictly validates character-by-character cursor index (`i`), single printable input characters (`y === 0`), monotonic `t`, deterministic `generateText(seed, mode, duration)` alignment, `15`-char sliding-window burst ceiling (`>= 20ms/char`), minimum jitter (`stdDev >= 2.0ms` when `deltas.length >= 15`), and timer denominator (`durationLimit * 1000` on `timer` completion). Ignored spoofed client `wpm`/`accuracy`.
- **OAuth Open Redirect Guard ([`app/auth/callback/route.ts`](file:///c:/Users/rudra/TyProX/app/auth/callback/route.ts#L5-L25), `lib/security/redirect.ts`):** Rejects scheme URLs, protocol-relative `//`, backslashes, and encoded variants, validated by `6` Vitest specs + Playwright probe.
- **No Demo Auth Backdoors:** Zero references to `typrox_demo` or `?demo=true` remain in runtime paths; `/api/debug/supabase` and `/api/test-supabase` are deleted (`404`).

### Security Findings

#### `SEC-A1` [HIGH] — `POST /api/results/sync` Lacks Rate Limiting, Cooldown, and `client_run_id` Deduplication (Plus Local History Truncation) `[APP FIXED — DB COLUMN & REPLAY RLS GATED]`
- **Remediation Note (2026-11-10):** [`app/api/results/sync/route.ts`](file:///c:/Users/rudra/TyProX/app/api/results/sync/route.ts) now enforces `checkSyncRateLimit` (`429` + `Retry-After`), blocks unranked runs, deduplicates in-batch and across DB via `client_run_id` + `deduplicateBySignature`, and avoids false acks on partial (`207`) or total (`500`) failure. [`lib/typing/sync-client.ts`](file:///c:/Users/rudra/TyProX/lib/typing/sync-client.ts), [`stores/user-store.ts`](file:///c:/Users/rudra/TyProX/stores/user-store.ts), and [`app/dashboard/page.tsx`](file:///c:/Users/rudra/TyProX/app/dashboard/page.tsx) preserve `telemetry` across all 100 stored runs, sync sequentially in 30-item chunks, and call selective `removeGuestResults(persistedIds)` instead of blanket `clearGuestHistory()`. Live Postgres `client_run_id` uniqueness & `public.replays` `anon` read RLS (`164` rows) remain **UNRESOLVED** until `20260621` applies.
- **Files & Lines:** [`app/api/results/sync/route.ts:21-93`](file:///c:/Users/rudra/TyProX/app/api/results/sync/route.ts#L21-L93), [`app/dashboard/page.tsx:348-373`](file:///c:/Users/rudra/TyProX/app/dashboard/page.tsx#L348-L373), [`stores/user-store.ts:111-114`](file:///c:/Users/rudra/TyProX/stores/user-store.ts#L111-L114), [`lib/typing/persistence.ts:224-238`](file:///c:/Users/rudra/TyProX/lib/typing/persistence.ts#L224-L238).
- **Evidence:** `POST /api/results/sync` accepts `items` up to `30` entries per call, validates `clientRunId` at `line 72`, discards `clientRunId` immediately afterward, never checks [`checkResultSubmissionRateLimit`](file:///c:/Users/rudra/TyProX/lib/security/rate-limit.ts#L29-L78), and calls `persistVerifiedResult` in a loop `line 87`. Even when `client_run_id` column is added by `20260621`, `persistVerifiedResult` does not insert `client_run_id` into `test_results`. Meanwhile [`DashboardPage.handleSyncHistory`](file:///c:/Users/rudra/TyProX/app/dashboard/page.tsx#L357-L372) sends only `guestHistory.slice(0, 30)` and then unconditionally calls `clearGuestHistory()`, permanently deleting entries `31..100` (since `addGuestResult` caps at `100`) as well as any rejected or `drill` sessions.
- **Impact:**
  1. **Security/DoS/Farm:** Any signed-in account can replay one legitimate telemetry array `30x` per request across concurrent HTTP requests to flood `test_results` + `replays` JSONB storage, bypass the `8s` submission cooldown completely, and artificially inflate total-test milestone counts.
  2. **Data Loss:** Users with `> 30` local runs silently lose older runs upon syncing.
- **Recommended Fix:** Enforce a per-user sync rate limit (`1–2` requests/minute or `sync` max/hour), persist `client_run_id` once `20260621` applies (or gate on duplicate `(user_id, client_run_id)` conflict + in-batch dedup `Set`), skip `recentRunCache` gaps, and only remove successfully `syncedCount` / legacy-acknowledged IDs from `guestHistory` rather than blanket `clearGuestHistory()`.

#### `SEC-A2` [HIGH] — No Server-Issued Run-Start Token Allows Offline Telemetry Synthesis Against Known Seeds
- **Files & Lines:** [`lib/typing/verifier.ts:29-37,56-228`](file:///c:/Users/rudra/TyProX/lib/typing/verifier.ts#L29-L37), [`lib/typing/text-generator.ts:69-214`](file:///c:/Users/rudra/TyProX/lib/typing/text-generator.ts#L69-L214), [`app/api/results/route.ts:74`](file:///c:/Users/rudra/TyProX/app/api/results/route.ts#L74).
- **Evidence:** Client submits arbitrary `seed` matching `/^[a-zA-Z0-9_-]{4,64}$/`. Because `generateText` and `dictionaries.ts` run deterministically on both client and server without server-signed issuance or elapsed wall-clock binding (`issuedAt`), the server verifies only internal arithmetic consistency of the submitted array.
- **Impact:** Using a small script, an attacker can pre-compute `targetText` for any `seed`, generate human-like random timing deltas (`stdDev >= 2ms`, sliding average `>= 20ms`), and submit a synthetic ~255 WPM leaderboard run immediately every `8s` without opening a browser or waiting `15s`–`120s` of wall time. Note that [`SECURITY_REMEDIATION_PLAN.md` (`SEC-1.4` line 122)](file:///c:/Users/rudra/TyProX/docs/roadmap/SECURITY_REMEDIATION_PLAN.md#L122) deferred server run-start tokens explicitly.
- **Recommended Fix:** Add a lightweight HMAC-signed `POST /api/runs/init` endpoint issuing `(seed, mode, duration, issuedAt, nonce, sig)` using `RUN_TOKEN_SECRET`, verifying on `POST /api/results` that `Date.now() - issuedAt >= configuredDuration * 1000 - 1500` (with challenge/daily tokens signed server-side on route render/init).

#### `SEC-A3` [HIGH] — `SUPABASE_SERVICE_ROLE_KEY` Unprovisioned & Non-Atomic Persistence / In-Memory Fallback Gaps `[APP HARDENED — ENV & DB GATE REMAINING]`
- **Remediation Note (2026-11-10):** [`lib/typing/persistence.ts`](file:///c:/Users/rudra/TyProX/lib/typing/persistence.ts) now persists `client_run_id` when supported (`PGRST204`/`42703` fallback pre-migration, `23505` conflict recovery), performs compensating `test_results` `DELETE` rollback + throws when `replays` fails, throws strictly on `streaks` / `achievements` / count write errors (ignoring `23505` races only), and [`checkResultSubmissionRateLimit`](file:///c:/Users/rudra/TyProX/lib/security/rate-limit.ts) filters `.eq('is_invalidated', false)`. **`SUPABASE_SERVICE_ROLE_KEY` provisioning and transactional SQL RPC remain UNRESOLVED until Owner DB Gate.**
- **Files & Lines:** [`lib/supabase/admin.ts:11-33`](file:///c:/Users/rudra/TyProX/lib/supabase/admin.ts#L11-L33), [`app/api/results/route.ts:20,79`](file:///c:/Users/rudra/TyProX/app/api/results/route.ts#L20), [`lib/typing/persistence.ts:69-117,246-253`](file:///c:/Users/rudra/TyProX/lib/typing/persistence.ts#L69-L117), [`lib/security/rate-limit.ts:42-50`](file:///c:/Users/rudra/TyProX/lib/security/rate-limit.ts#L42-L50).
- **Evidence:**
  1. `.env.local` omits `SUPABASE_SERVICE_ROLE_KEY`; `createAdminClient()` returns `null`, falling back to caller SSR `supabase` in `api/results`, `api/results/sync`, and `api/challenges`. Once `20260621` drops client `INSERT`/`UPDATE` RLS policies, those routes will immediately return `500` until `SUPABASE_SERVICE_ROLE_KEY` is configured in all environments.
  2. `recentRunCache` (`app/api/results/route.ts:20`) is process-local `Map` memory (ineffective across serverless workers) paired with a time/seed heuristic (`checkResultSubmissionRateLimit:59-67`) instead of DB `client_run_id` uniqueness; additionally `checkResultSubmissionRateLimit` does not filter `.eq('is_invalidated', false)`.
  3. `updateDailyStreakForUser` (`persistence.ts:70-76,88-96,109-117`) ignores PostgREST `.insert()`/`.update()` error responses, and failed `replays` inserts (`line 251-253`) only log a warning while keeping the parent `test_results` row — leaving permanent runs with missing replay telemetry (`Performance Lab` cannot analyze them).
- **Recommended Fix:** Provision `SUPABASE_SERVICE_ROLE_KEY`; fail loudly in `createAdminClient()` in production when `NODE_ENV === 'production'` (never silently downgrade privileged writes); check DB write errors on `streaks`/`replays` (or wrap result+replay+streak+achievement writes in a single `service_role`-only Postgres RPC `submit_verified_result`).

#### `SEC-A4` [MEDIUM] — Production CSP Retains `script-src 'self' 'unsafe-inline'`
- **Files & Lines:** [`next.config.ts:30`](file:///c:/Users/rudra/TyProX/next.config.ts#L30), [`app/layout.tsx:102-132`](file:///c:/Users/rudra/TyProX/app/layout.tsx#L102-L132).
- **Evidence:** `cspHeader` includes `script-src 'self' 'unsafe-inline'` in production to accommodate the inline `beforeInteractive` theme bootstrap `<Script>` (`layout.tsx:102`) and Next bootstrap scripts.
- **Impact:** Weakens XSS mitigation if an injection bug is ever introduced.
- **Recommended Fix:** Replace `'unsafe-inline'` in `script-src` with per-request CSP nonces via `proxy.ts` (or SHA-256 hash / static asset script if keeping static optimization on marketing routes).

#### `SEC-A5` [LOW] — Minor Error-Text Leakage in Signout & Unverified Session Helper Usage
- **Files & Lines:** [`app/api/auth/signout/route.ts:32-33`](file:///c:/Users/rudra/TyProX/app/api/auth/signout/route.ts#L32-L33), [`components/providers/auth-provider.tsx:68-76`](file:///c:/Users/rudra/TyProX/components/providers/auth-provider.tsx#L68-L76), [`lib/supabase/auth.ts:44-49`](file:///c:/Users/rudra/TyProX/lib/supabase/auth.ts#L44-L49).
- **Evidence:** `POST /api/auth/signout` returns `err.message` verbatim on catch (`line 32-33`), whereas `results`/`profile`/`challenges`/`leaderboard` mask errors. In addition, `AuthProvider` calls both `supabase.auth.getUser()` and `supabase.auth.getSession()` in `Promise.all` (`line 68-71`) to hydrate Zustand `session` (while `getClientSession()` in `lib/supabase/auth.ts:44` remains unguarded dead code).
- **Recommended Fix:** Mask signout `500` message cleanly, remove dead `getClientSession()`, and store a minimal verified user object in `useUserStore` instead of calling `getSession()` on client bootstrap.

---

## 3. Phase 3 — Database, Migrations & Live Production Audit (`DB-*`)

### 3.1 Live Production State (Empirically Verified via Read-Only `anon` REST Probes)
Read-only queries executed against live `gbovkejymfeiqgverzfr.supabase.co` confirmed zero schema migrations have been executed since [`BATCH_1_1A_PREFLIGHT_REPORT.md`](file:///c:/Users/rudra/TyProX/docs/roadmap/BATCH_1_1A_PREFLIGHT_REPORT.md#L50-L72):
- **`public.leaderboard_view`:** **MISSING (`PGRST205`)** — production `/leaderboard` currently runs the fallback query against `test_results`.
- **`public.test_results`:** `170` rows including **`6` `__debug_test__` (`user_id IS NULL`, `duration = 1`)**; `0` invalidated rows.
- **`public.replays`:** `164` rows **currently readable to `anon`** (full keystroke JSONB).
- **`public.streaks`:** `16` rows, **`10` at `current_streak = 0`** (`4` of `10` active typists stuck at `0`).
- **`public.achievements`:** **`11` custom rows** (`SPEED_50`, `SPEED_75`, `SPEED_80`, `SPEED_100`, `SPEED_120`, `SPEED_140`, `SPEED_150`, `STREAK_3`, `STREAK_7`, `STREAK_14`, `STREAK_30`) with titles like `"Bronze Fingers"`, `"Fingers of Fire"`, `"Swift Fingers"`.
- **`public.daily_challenges` / `challenge_links` / `user_challenge_progress`:** `0` rows each.

### 3.2 Unverified Production Catalog & Recovery State (Owner Gate Required)
Because `pg_catalog` and `information_schema` are inaccessible to `anon` and `supabase` CLI is unlinked locally, the following remain **UNVERIFIED** on live production until the owner executes the read-only SQL queries in [`SECURITY_REMEDIATION_PLAN.md` Section 4](file:///c:/Users/rudra/TyProX/docs/roadmap/SECURITY_REMEDIATION_PLAN.md#L258-L298):
- Active `pg_policies` names/predicates (`FULL_SCHEMA.sql` vs `20260618`–`20260619` vs manual policies, including `"Users can insert their own profiles"`).
- `information_schema.role_table_grants` (`GRANT ALL` status for `anon` and `authenticated`).
- Active `pg_indexes`, `pg_publication_tables` (`supabase_realtime`), and live `public.handle_new_user()` trigger DDL (`SET search_path` check).
- Verified Supabase automated backup / PITR / manual `pg_dump` recovery availability & Supabase Auth Redirect URL allowlist.

### 3.3 Schema & Migration Findings

#### `DB-A1` [HIGH] — Blanket `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public` in `20260621` Risk
- **File & Lines:** [`supabase/migrations/20260621000000_typrox_2_hardening.sql:31`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260621000000_typrox_2_hardening.sql#L31).
- **Evidence:** `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;` revokes `EXECUTE` on **every** function living in schema `public`.
- **Impact:** On Supabase projects where Postgres extensions (`pg_trgm`, `uuid-ossp`, custom helpers) are installed into `public`, blanket revocation strips `anon`/`authenticated` `EXECUTE` grants on extension operators/functions and can break unrelated queries or RLS expressions.
- **Recommended Fix:** Replace blanket `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public` with explicit `REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;` (plus `PUBLIC`), leaving extension functions untouched.

#### `DB-A2` [HIGH] — Live `achievements` Catalog (`11` Codes) vs `20260621` (`8` Mismatched Rows) & `3` Missing Achievement SVG Files `[SVGS ADDED — SQL GATED]`
- **Remediation Note (2026-11-10):** `speed_80.svg`, `speed_150.svg`, and `streak_14.svg` have been created under [`public/achievements/`](file:///c:/Users/rudra/TyProX/public/achievements/speed_80.svg) (HTTP `200`). Reconciling the `11` codes inside [`20260621000000_typrox_2_hardening.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260621000000_typrox_2_hardening.sql) remains **UNRESOLVED** (migration SQL untouched under Phase 1 governance).
- **Files & Evidence:**
  - `public/achievements/` contains **`9` files**: `default.svg`, `speed_50.svg`, `speed_75.svg`, `speed_100.svg`, `speed_120.svg`, `speed_140.svg`, `streak_3.svg`, `streak_7.svg`, `streak_30.svg`.
  - Live Supabase `public.achievements` references **`/achievements/speed_80.svg` (`SPEED_80`), `/achievements/speed_150.svg` (`SPEED_150`), and `/achievements/streak_14.svg` (`STREAK_14`)** — none of those `3` files exist in `public/achievements/`! While [`AchievementBadge`](file:///c:/Users/rudra/TyProX/components/ui/achievement-badge.tsx#L28-L32) catches `onError` and swaps to `default.svg`, browsers still trigger `404` network errors on affected `/u/[username]` profiles and render generic fallback icons.
  - Meanwhile [`20260621` lines 178–187](file:///c:/Users/rudra/TyProX/supabase/migrations/20260621000000_typrox_2_hardening.sql#L178-L187) seeds only `8` codes with non-matching display names (`'Keyboard Apprentice'`, `'Speed Demon'`, etc.) and `ON CONFLICT (code) DO NOTHING`, leaving the 3 production-only codes unversioned in Git.
- **Recommended Fix:** Add crisp `speed_80.svg`, `speed_150.svg`, and `streak_14.svg` to `public/achievements/`, and reconcile all `11` achievement codes cleanly in `20260621` (using `ON CONFLICT (code) DO NOTHING` to preserve live names cleanly).

#### `DB-A3` [MEDIUM] — `leaderboard_view` Fallback `.limit(300)` Truncation & Schema/Type Drift (`types/database.ts`) `[TYPES ALIGNED — VIEW & LIMIT UNRESOLVED]`
- **Remediation Note (2026-11-10):** [`types/database.ts`](file:///c:/Users/rudra/TyProX/types/database.ts) now includes optional `client_run_id` and nullable `streaks.last_active_date: string | null`. Live `leaderboard_view` deployment and fallback `.limit(300)` remain **UNRESOLVED**.
- **Files & Lines:** [`lib/data/leaderboard.ts:128-132`](file:///c:/Users/rudra/TyProX/lib/data/leaderboard.ts#L128-L132), [`types/database.ts:46-155,314-409`](file:///c:/Users/rudra/TyProX/types/database.ts#L46-L155).
- **Evidence:**
  1. When `leaderboard_view` is missing (`PGRST205` — currently true in live prod), `getLeaderboardEntries` fetches `.limit(300)` raw `test_results` rows sorted by `wpm DESC` **before** deduplicating by `user_id` in JS (`lines 143–167`). As user volume grows, a few frequent top typists submitting >100 fast runs will crowd out lower-ranked distinct users from the top 100 leaderboard.
  2. `types/database.ts` already declares unapplied `20260622` tables (`user_progression`, `user_lesson_progress`, `challenge_attempts`), omits `20260621` `test_results` columns (`client_run_id`, `generator_version`, `is_ranked`), and types `streaks.last_active_date: string` non-null even though `20260621:14-15` makes it `NULL`.
- **Recommended Fix:** Prioritize applying `20260621` so `leaderboard_view` serves pre-deduplicated rows via `DISTINCT ON`, widen fallback `.limit(1000)` temporarily until view creation, and keep `types/database.ts` aligned per migration stage (making `last_active_date: string | null`).

#### `DB-A4` [LOW] — Legacy `FULL_SCHEMA.sql` Snapshot Remains Undeprecated
- **File:** [`supabase/migrations/FULL_SCHEMA.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/FULL_SCHEMA.sql).
- **Evidence:** Still contains legacy `GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated` (`Section 8`) and permissive policies without a deprecation notice redirecting future bootstraps to ordered CLI migrations.

---

## 4. Phase 4 & 5 — Typing Engine & Product Completeness Audit (`ENG-*` / `PROD-*`)

### 4.1 Honest Feature Classification Inventory
| Feature / Route | Status | Reality & Evidence |
|---|---|---|
| Core Typing Engine (`/typing`) | **Functional (with P1 bug)** | Drift-free `performance.now()` timer, cumulative accuracy (`K_correct / K_total`), mobile `beforeinput` + IME composition, WebAudio click synthesizer, Web Worker analytics + synchronous fallback. Affected by `ENG-A1` (`text_complete` duration) and `ENG-A6` (`onPaste`). |
| Replay Telemetry & Replay Viewer | **Functional (Session-Only)** | `ReplayPlayer` O(1) prefix scrub plays cleanly right after completing a test; persisted in `replays` for authed runs. **No standalone `/replay/[id]` route** (`SPEC-5.9` unbuilt); past runs in `/dashboard` cannot reopen Replay Viewer. |
| Server Score Verification & Leaderboards (`/leaderboard`, `/api/results`) | **Functional (Pending DB Gate)** | Deterministic server replay verification (`lib/typing/verifier.ts`) & `getLeaderboardEntries` RSC + Realtime work; live Supabase still uses `PGRST205` fallback without `leaderboard_view`. `POST /api/results/sync` lacks throttling/dedup. |
| Performance Lab & Weak-Key Drills (`/dashboard/performance-lab`, `?mode=drill`) | **Partially Functional** | Seed-aligned error/finger/hand/bigram analysis works for last `15` cloud or local runs (`fingerLoads` rendered cleanly). Drops Space/punctuation drill targets (`ENG-A4`), computes bigram mean instead of median (`ENG-A6`). |
| Curriculum (`/learn`, `/learn/[slug]`) | **Local-Only (Frontend)** | 12 structured lessons with sequential accuracy/speed star locks work and persist cleanly in `localStorage` (`user-store`). **Zero server/Postgres persistence** (`user_lesson_progress` unused). |
| Daily UTC Challenge (`/daily`) | **Local-Only (Hybrid)** | Deterministic `daily-YYYY-MM-DD` prompt + live UTC countdown work (`DailyChallengeClient`). Completions stored in `localStorage` (`dailyCompletions`); also submits to `/api/results` as standard mode without touching `daily_challenges` / `user_challenge_progress` and with **no Daily Standings leaderboard**. |
| Dashboard (`/dashboard`) | **Functional (with Scope Bugs)** | Displays metrics, Recharts trend, guest/cloud switch, scoped Realtime updates, 50-row pagination. Aggregates KPIs only over loaded slice (`ENG-A7`); `handleSyncHistory` drops local runs >30 (`SEC-A1`). |
| 1v1 Challenge Arena (`/challenge/[id]`) | **Partially Functional** | Challenge creation (`POST /api/challenges`) & link expiry checks work; opponent UI compares scores locally. **Breaks on early finish challenges (`ENG-A1`), leaves stale state on `/typing` (`ENG-A2`), and never persists `challenge_attempts` W/L/T** (`SPEC-5.5` unbuilt). |
| Public Profiles (`/u/[username]`) | **Partially Functional** | Clean RSC profile with OG metadata, stats, streak, badges, recent 8 runs. Averages/PBs truncate at `.limit(200)` (`ENG-A7`); lacks 365-day activity heatmap & `(mode x duration)` PB matrix (`SPEC-5.8`). |
| Preferences & Cat Companion (`/profile`, `CatCompanion`) | **Partially Functional** | Theme, font (`--typing-font`), sound volume, display name work cleanly; `CatCompanion` light-mode collection overlay is broken (`UX-A1`). |
| XP/Levels, TSI Ratings, Seasons, Follows, `/compare` (`SPEC-5.3`, `5.6`, `5.7`, `5.10`) | **Not Implemented** | Zero backend or UI code exists beyond unused `user_progression` DDL in `20260622`. |

### 4.2 Typing Engine & Application Functional Defects

#### `ENG-A1` [HIGH] — Early Completion (`text_complete`) Saves Non-Bracket Duration, Breaking Leaderboards & 1v1 Challenges `[RESOLVED]`
- **Remediation Note (2026-11-10):** [`lib/typing/metrics.ts`](file:///c:/Users/rudra/TyProX/lib/typing/metrics.ts) keeps `duration` canonical (`options.durationLimit`) and exposes actual elapsed duration via `elapsedSeconds`; [`lib/typing/verifier.ts`](file:///c:/Users/rudra/TyProX/lib/typing/verifier.ts), [`components/typing/result-screen.tsx`](file:///c:/Users/rudra/TyProX/components/typing/result-screen.tsx), [`app/api/challenges/route.ts`](file:///c:/Users/rudra/TyProX/app/api/challenges/route.ts), [`lib/data/challenge.ts`](file:///c:/Users/rudra/TyProX/lib/data/challenge.ts), and [`components/challenge/challenge-arena-client.tsx`](file:///c:/Users/rudra/TyProX/components/challenge/challenge-arena-client.tsx) normalize/persist canonical brackets while displaying `"Actual time · ${result.duration}s mode"` on early completions.
- **Files & Lines:** [`lib/typing/metrics.ts:173-178,308`](file:///c:/Users/rudra/TyProX/lib/typing/metrics.ts#L173-L178), [`lib/typing/verifier.ts:188-202`](file:///c:/Users/rudra/TyProX/lib/typing/verifier.ts#L188-L202), [`lib/typing/persistence.ts:212,235`](file:///c:/Users/rudra/TyProX/lib/typing/persistence.ts#L212,L235), [`components/challenge/challenge-arena-client.tsx:62-67`](file:///c:/Users/rudra/TyProX/components/challenge/challenge-arena-client.tsx#L62-L67).
- **Evidence:** When a fast user finishes `targetText` before the countdown expires (`reason === 'text_complete'`, `lastT >= 3000ms`), `evaluateFinalSession` computes `durationSecs = Math.max(1, Math.round(totalElapsedMs / 1000))` and returns `result.duration` (e.g., `14s` on a `15s` test, or `26s` on a `30s` test, feasible in `quotes`/`code`/`numbers` where `quotes` `15s` produces `>=270` chars). [`persistVerifiedResult`](file:///c:/Users/rudra/TyProX/lib/typing/persistence.ts#L235) then inserts `result.duration` (instead of `verified.configuredDuration`) into `test_results.duration`, and `POST /api/challenges` copies `resultRow.duration` onto `challenge_links.duration`.
- **Impact:**
  1. Valid `15s`/`30s` early completions silently disappear from `[15, 30, 60, 120]` leaderboards and PB lookups (`eq('duration', result.duration)`).
  2. When a challenger races that challenge link in [`ChallengeArenaClient`](file:///c:/Users/rudra/TyProX/components/challenge/challenge-arena-client.tsx#L64), it submits `duration: challenge.duration` (`14`) to `POST /api/results`, failing `VALID_DURATIONS` Zod validation (`400`) silently.
- **Recommended Fix:** Separate `elapsed_ms` (used as WPM denominator `totalElapsedMs` on `text_complete`) from the configured bracket `duration` (`verified.configuredDuration`) persisted to `test_results.duration` and `challenge_links.duration`.

#### `ENG-A2` [HIGH] — Exiting `/challenge/[id]` to `/typing` Renders Stale Challenge Result Screen with Empty Seed `[RESOLVED]`
- **Remediation Note (2026-11-10):** [`ChallengeArenaClient`](file:///c:/Users/rudra/TyProX/components/challenge/challenge-arena-client.tsx#L73-L81) now invokes `resetTest()` on unmount when `current.seed === challenge.seed` (`/daily` seeds already reset automatically in [`app/typing/page.tsx:51`](file:///c:/Users/rudra/TyProX/app/typing/page.tsx#L51)).
- **Files & Lines:** [`components/challenge/challenge-arena-client.tsx:47-51`](file:///c:/Users/rudra/TyProX/components/challenge/challenge-arena-client.tsx#L47-L51), [`app/typing/page.tsx:49-55`](file:///c:/Users/rudra/TyProX/app/typing/page.tsx#L49-L55).
- **Evidence:** Completing a challenge leaves Zustand `useTypingStore` in `status === 'completed'`, `mode === 'words'`, `targetText !== ''`. `ChallengeArenaClient`'s cleanup only calls `setSeed('')`. Navigating back to `/typing` evaluates `app/typing/page.tsx:51`: `!current.targetText || current.seed.startsWith('daily-') || current.mode === 'drill'` -> all `false` — so `/typing` mounts `<ResultScreen />` for the stale challenge run with `seed === ''` (`Copy /typing?seed=&mode=...`).
- **Recommended Fix:** Call `resetTest()` (or `startTestWithConfig` reset) when unmounting `ChallengeArenaClient` / `DailyChallengeClient` if `status === 'completed'`, or reset non-sandbox runs cleanly in `/typing`.

#### `ENG-A3` [HIGH] — Silent Score Persistence Failure & Permanent Failed Promise Cache `[RESOLVED]`
- **Remediation Note (2026-11-10):** Both [`ResultScreen`](file:///c:/Users/rudra/TyProX/components/typing/result-screen.tsx#L73-L100,L347-L379) and [`ChallengeArenaClient`](file:///c:/Users/rudra/TyProX/components/challenge/challenge-arena-client.tsx#L40-L56,L203-L234) evict failed entries from in-flight promise maps and render explicit `role="alert"` banners with `"Retry Save"`.
- **Files & Lines:** [`components/typing/result-screen.tsx:35-107,207-212,324`](file:///c:/Users/rudra/TyProX/components/typing/result-screen.tsx#L35-L107), [`components/challenge/challenge-arena-client.tsx:12-35,68-70`](file:///c:/Users/rudra/TyProX/components/challenge/challenge-arena-client.tsx#L12-L35).
- **Evidence:** If `POST /api/results` returns `400`, `429`, or `500` (e.g., cooldown hit on quick 15s restarts or network blip), `submitRankedResultOnce` resolves `{ status: 'error' }` and caches that failed Promise permanently by `clientRunId`, while **neither `ResultScreen` nor `ChallengeArenaClient` displays any error banner or Retry button** (nor preserves the unsaved run locally). Users also notice the `"Share Challenge"` button silently falls back to sharing an unverified raw seed URL (`ResultScreen:286-308`).
- **Recommended Fix:** Render an explicit warning banner + `"Retry Save"` control on `status === 'error'` (clearing failed cache entry on retry), and save failed ranked runs safely into local retry queue / `guestHistory` if upload fails.

#### `ENG-A4` [MEDIUM] — Space & Punctuation Stripped From Weak-Key Drill Queries
- **Files & Lines:** [`components/typing/result-screen.tsx:317-320`](file:///c:/Users/rudra/TyProX/components/typing/result-screen.tsx#L317-L320), [`app/dashboard/performance-lab/page.tsx:184-190`](file:///c:/Users/rudra/TyProX/app/dashboard/performance-lab/page.tsx#L184-L190), [`lib/typing/text-generator.ts:170-173`](file:///c:/Users/rudra/TyProX/lib/typing/text-generator.ts#L170-L173).
- **Evidence:** Captured directly in `cat_collection_light.png`: `TOP WEAK KEYS` displayed **`Space 11x`** with **no `"Practice Weak Keys"` CTA**, because `.map(([k]) => k.trim().toLowerCase()).filter((k) => /[a-z0-9]/.test(k))` reduces `' '` to `''` and drops all punctuation (`;`, `.`, `'`, `,`, etc.).
- **Recommended Fix:** Filter non-Space printable targets (or preserve `'space'` / word-transition focus + allow punctuation symbols via allowlist `^[a-z0-9.,;:'"/-]$`) and fall back gracefully to general high-variance drill words when Space alone dominates errors.

#### `ENG-A5` [MEDIUM] — Guest Active Streak Hardcoded to `1` in Practice & Results vs Real Streak Logic on Dashboard
- **Files & Lines:** [`components/typing/typing-container.tsx:101`](file:///c:/Users/rudra/TyProX/components/typing/typing-container.tsx#L101), [`components/typing/result-screen.tsx:220`](file:///c:/Users/rudra/TyProX/components/typing/result-screen.tsx#L220), [`app/dashboard/page.tsx:45-90`](file:///c:/Users/rudra/TyProX/app/dashboard/page.tsx#L45-L90).
- **Evidence:** Both `TypingContainer` and `ResultScreen` evaluate `guestHistory.length > 0 ? 1 : 0`, ignoring multi-day guest history dates even though `computeGuestStreak` already exists in `app/dashboard/page.tsx`.
- **Recommended Fix:** Extract `computeGuestStreak` into `lib/typing/streak.ts` and reuse across `DashboardPage`, `TypingContainer`, and `ResultScreen`.

#### `ENG-A6` [MEDIUM] — Missing `onPaste` Guard & Replay Analyzer Mean vs. Spec Median / Incomplete Finger Attribution
- **Files & Lines:** [`components/typing/typing-container.tsx:185-204`](file:///c:/Users/rudra/TyProX/components/typing/typing-container.tsx#L185-L204), [`components/learn/lesson-runner-client.tsx:215-245`](file:///c:/Users/rudra/TyProX/components/learn/lesson-runner-client.tsx), [`lib/typing/replay-analyzer.ts:178-265`](file:///c:/Users/rudra/TyProX/lib/typing/replay-analyzer.ts#L178-L265).
- **Evidence:** Neither typing `<textarea>` intercepts `onPaste`, allowing clipboard pastes to commit multi-character chunks with `0ms` delta (which distort live/guest stats and trigger server burst rejection `400` if >= 15 chars). Meanwhile `analyzeReplaySessions` computes arithmetic mean `avgMs` instead of median (`SPEC-5.1`) and excludes Backspace/Shift (`Shift`/navigation keys ignored in `FINGER_MAP`, slightly biasing `Right Pinky` load metrics downward).
- **Recommended Fix:** Intercept `onPaste` -> `e.preventDefault()` on both typing textareas; compute median transition ms in `analyzeReplaySessions`.

#### `ENG-A7` [MEDIUM] — Paginated / Limited Queries Truncate Lifetime Peak WPM, Averages & Time Practiced
- **Files & Lines:** [`app/dashboard/page.tsx:124-130,277-302`](file:///c:/Users/rudra/TyProX/app/dashboard/page.tsx#L124-L130), [`lib/data/profile.ts:59-88,110-116`](file:///c:/Users/rudra/TyProX/lib/data/profile.ts#L59-L88).
- **Evidence:** `/dashboard` computes `bestWpm`, `avgWpm`, `avgAccuracy`, `testsCompleted`, and `totalTimeSecs` from `dbHistory` (initial `PAGE_STEP = 50` rows), showing e.g. `testsCompleted = 50` and `totalTimeSecs` of only the newest 50 tests. Similarly `getPublicProfileByUsername` fetches `.limit(200)` rows (`line 65`), mixing true SQL `count` into `testsCompleted` (`line 114`) with a 200-row cap on `bestWpm`, `avgWpm`, `avgAccuracy`, and `totalTimeSecs`.
- **Recommended Fix:** Query SQL aggregates (e.g., RPC `get_user_summary_stats(p_user_id)` using `COUNT(*)`, `MAX(wpm)`, `AVG(wpm)`, `AVG(accuracy)`, `SUM(duration)`) instead of summarizing truncated row pages client/server-side.

---

## 5. Phase 6 — Automated Verification & Test Quality Audit (`QA-*`)

### Firsthand Command Results Run During Audit
| Command | Result | Verified Output Summary |
|---|---|---|
| `npm run typecheck` (`tsc --noEmit --incremental false`) | **PASS (`exit 0`)** | `0` TypeScript errors across app, workers, and tests. |
| `npm run lint` (`eslint`) | **PASS (`exit 0`)** | `0` errors, `0` warnings across entire workspace. |
| `npm run test:unit` (`vitest run`) | **PASS (`exit 0`)** | **`15` test files, `63/63` tests passed** (metrics, verifier, text-generator, replay-analyzer, curriculum, redirect, audio, store, 4 mocked API suites, 3 RTL component suites). |
| `npm run build` (`next build` `16.2.9` Turbopack) | **PASS (`exit 0`)** | **`33/33` routes** compiled cleanly + `ƒ Proxy (Middleware)`. |
| `npm run test:e2e` (`playwright test` on `127.0.0.1:3105`) | **PASS (`exit 0`)** | **`6/6` Chromium E2E journeys** passed (`47.4s`), `<= 1px` overflow, `0` broken images, `0` console/page/server errors on visited paths. |

### Test Quality & Coverage Gaps (`QA-*`)
- **`QA-A1` [HIGH] — Zero Real Postgres / RLS / Auth Integration Tests:** Every API route test (`__tests__/api/{results,challenges,profile,leaderboard}.route.test.ts`) mocks `createClient` and `createAdminClient` in JS memory. Neither the SQL logic in [`20260621`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260621000000_typrox_2_hardening.sql) (policies, `handle_new_user()`, `leaderboard_view`, `GRANT` revocations) nor real PostgREST constraint behavior has been executed or tested against a local Postgres/Supabase instance.
- **`QA-A2` [MEDIUM] — Zero Automated Tests for High-Risk Endpoint & Auth Flows `[PARTIALLY RESOLVED]`:** Added unit/integration-mock suites for [`app/api/results/sync/route.ts`](file:///c:/Users/rudra/TyProX/__tests__/api/sync.route.test.ts), [`lib/typing/sync-client.ts`](file:///c:/Users/rudra/TyProX/__tests__/typing/sync-client.test.ts), [`lib/typing/persistence.ts`](file:///c:/Users/rudra/TyProX/__tests__/typing/persistence.test.ts), and [`components/challenge/challenge-arena-client.tsx`](file:///c:/Users/rudra/TyProX/__tests__/components/challenge-arena-client.test.tsx). `signout`, `lib/supabase/middleware.ts`, and `UsernameModal` remain untested.
- **`QA-A3` [MEDIUM] — Playwright E2E Covers Guest Flows Only:** [`tests/e2e/typrox.spec.ts`](file:///c:/Users/rudra/TyProX/tests/e2e/typrox.spec.ts) tests guest `?mode=drill` (not standard ranked `/typing` submission), never verifies signed-in Dashboard sync/challenge/profile flows, never opens [`CatCompanion`](file:///c:/Users/rudra/TyProX/components/typing/cat-companion.tsx#L738-L795) collection drawer in Light Mode (`UX-A1`), and did not detect HUD Z-axis occlusion (`UX-A2`).

---

## 6. Phase 7 — Multi-Viewport Visual, Responsive & Accessibility Audit (`UX-*`)

Tested via standalone headless Chromium instrumentation across **`4` viewports** (`1440x900` Dark/Light + Populated, `1024x768` Dark, `768x1024` Dark/Light, `375x812` Dark/Light) plus `/u/user_dfdce864` public profile and Tab-key focus-ring inspection:
- **Verified Passes:** `0px` horizontal document overflow (`docOverflow === 0`) across all viewports and themes; `0` broken images (`brokenImages === []`); `0` unnamed controls; `2px solid` orange `:focus-visible` outlines confirmed on Tab navigation; clean populated rendering on `/dashboard`, `/dashboard/performance-lab`, `/learn`, `/daily`, `/leaderboard`, `/u/user_dfdce864`, and mobile `375x812` `/typing`.

### Visual & Accessibility Defects

#### `UX-A1` [HIGH] — `CatCompanion` Light Mode Drawer Fails Contrast Completely & Bleeds Background Footer `[RESOLVED]`
- **Remediation Note (2026-11-10):** [`components/typing/cat-companion.tsx`](file:///c:/Users/rudra/TyProX/components/typing/cat-companion.tsx#L724-L795) now renders opaque semantic `bg-surface` / `bg-surface-accent` / `text-text-primary` tokens at `z-40` over the `z-10` footer, verified by Light Mode E2E assertions (`rgb(255, 255, 255)` background, `rgb(17, 17, 19)` text) and visual screenshot inspection.
- **Files & Lines:** [`components/typing/cat-companion.tsx:696,724,743,775`](file:///c:/Users/rudra/TyProX/components/typing/cat-companion.tsx#L696) (verified in light-mode screenshots).
- **Evidence:** In Light Mode (`--text-primary: #0B0B0C`, `--surface: #FFFFFF`), clicking `"My Collection"` opens an overlay styled with hardcoded dark-palette Tailwind classes **`bg-neutral-950/90`** (`line 743`) and **`bg-neutral-900/40`** (`lines 696, 775`) while text inside uses theme-adaptive `text-text-primary` (`#0B0B0C`) and `text-text-tertiary`! Dark charcoal text renders almost invisible against the `90%` near-black scrim, while the underlying `z-30` footer (`COLLECTED: 3 / 15` and `MY COLLECTION`) bleeds darkly through the bottom edge of the translucent overlay (`z-40`).
- **Impact:** Severe WCAG 2.1 Level AA contrast failure (~`< 2:1` on titles & locked cards) making the companion drawer illegible in Light Mode.
- **Recommended Fix:** Replace hardcoded `bg-neutral-950/90` and `bg-neutral-900/40` with solid/near-opaque semantic surface tokens (`bg-surface/95` or `bg-background/95`, `bg-surface-accent`), and give locked cards clean `bg-surface-accent/60 text-text-secondary` styling.

#### `UX-A2` [HIGH] — `Hero3D` Desktop (`1440px`) & Laptop (`1024px`) Capability HUD Cards Overlap & Z-Slice Behind Keyboard Chassis `[RESOLVED]`
- **Remediation Note (2026-11-10):** [`components/home/hero-3d.tsx`](file:///c:/Users/rudra/TyProX/components/home/hero-3d.tsx#L533-L640) now isolates `perspective: '1200px'` inside a dedicated `isolate` keyboard wrapper (preventing Light Mode chassis Z-clipping) and docks the 4 HUD cards in a responsive `grid-cols-2 lg:grid-cols-4` strip below the chassis, verified via 4-viewport Dark/Light E2E checks & PNG inspection.
- **Files & Lines:** [`components/home/hero-3d.tsx:440-464,587-639`](file:///c:/Users/rudra/TyProX/components/home/hero-3d.tsx#L440-L464) (verified empirically via bounding-box telemetry and inspected `desktop-dark_home.png`, `laptop-dark_home.png`).
- **Evidence:** At both `1440x900` and `1024x768`, `lg:left-2` and `lg:right-2` place all four `HUDPanel` cards directly inside the `max-w-[1000px]` stage occupied by the `max-w-[820px]` rotated `preserve-3d` keyboard (`119–123px × 71px` geometric bounding-box intersection per card). Because the keyboard tilts in 3D space (`rotateX: 24deg, rotateZ: -3deg`) without z-plane elevation (`translateZ`) on the cards, the lower-left and lower-right keyboard chassis **physically slice over** `"CURRICULUM / 12 Lessons"` (`"CURI... / 12 Le..."`) and `"DAILY UTC / Seeded Arena"`. On `768px` tablet and `375px` mobile (`lg:hidden` 2x2 grid below stage), layout renders cleanly with `0` overlaps.
- **Recommended Fix:** Position the desktop HUD cards outside the keyboard width (`max-w-[1160px]` stage with `xl:-left-4` / narrower `max-w-[740px]` board) **or** render the clean 2x2 summary row cleanly below/beside the keyboard without `preserve-3d` Z-fighting (apply `translateZ(60px)` / move out of `preserve-3d` sibling context).

#### `UX-A3` [MEDIUM] — Missing Semantic Landmarks (`<main>` on `/`, `<h1>` on `/typing`)
- **Files & Lines:** [`components/home/home-landing.tsx:76-181`](file:///c:/Users/rudra/TyProX/components/home/home-landing.tsx#L76-L181), [`app/typing/page.tsx:83-87`](file:///c:/Users/rudra/TyProX/app/typing/page.tsx#L83-L87), [`components/typing/typing-container.tsx`](file:///c:/Users/rudra/TyProX/components/typing/typing-container.tsx), [`components/typing/result-screen.tsx`](file:///c:/Users/rudra/TyProX/components/typing/result-screen.tsx).
- **Evidence:** Accessibility DOM audit recorded `mainCount = 0` on `/` (`HomeLanding` wraps `<Hero3D />` and `<section>` tags inside a `<div>` without `<main>`) and `h1Count = 0` on `/typing` (both live arena and ResultScreen omit an `<h1>` or `sr-only` page heading).
- **Recommended Fix:** Wrap primary sections in `<main>` inside `HomeLanding` and add a concise/screen-reader-accessible `<h1>` (`"Typing Practice Arena"` / `"Session Results"`) on `/typing`.

#### `UX-A4` [MEDIUM] — Sub-40px Touch Targets on Interactive Mobile & Tablet Controls
- **Files & Lines:** [`components/home/hero-3d.tsx` (`RGBToggle`)](file:///c:/Users/rudra/TyProX/components/home/hero-3d.tsx), [`components/typing/typing-container.tsx`](file:///c:/Users/rudra/TyProX/components/typing/typing-container.tsx), [`components/leaderboard/leaderboard-client.tsx:213,235,261,287`](file:///c:/Users/rudra/TyProX/components/leaderboard/leaderboard-client.tsx#L213), [`app/dashboard/page.tsx`](file:///c:/Users/rudra/TyProX/app/dashboard/page.tsx), [`components/typing/cat-companion.tsx:731`](file:///c:/Users/rudra/TyProX/components/typing/cat-companion.tsx#L731).
- **Evidence:** At `375x812` and `768x1024`, interactive buttons below WCAG/mobile `44x44` guidelines include: `Hero3D` RGB swatches (`24×24px`), `CatCompanion` `"My Collection"` (`30px` height), `DashboardPage` filter pills (`36px` height), and `TypingContainer` / `LeaderboardClient` filter/mode/duration pills (`38px` height). (Note: header hamburger & drawer links cleanly meet `min-h-[44px]`.)

#### `UX-A5` [LOW] — Minor UI / SEO Field Mismatches
- **Files & Lines:** [`components/auth/username-modal.tsx:43,138,144`](file:///c:/Users/rudra/TyProX/components/auth/username-modal.tsx#L43), [`app/api/profile/route.ts:40`](file:///c:/Users/rudra/TyProX/app/api/profile/route.ts#L40), [`app/sitemap.ts:9-14`](file:///c:/Users/rudra/TyProX/app/sitemap.ts#L9-L14).
- **Evidence:** `UsernameModal` enforces max `20` chars (`maxLength={20}`), whereas `PATCH /api/profile` and `20260621:92` permit `3–24` chars. `app/sitemap.ts` omits `/learn`, `/learn/[slug]`, and `/daily` public routes. Also public leaderboard fallback [`LeaderboardClient:440`](file:///c:/Users/rudra/TyProX/components/leaderboard/leaderboard-client.tsx#L440) renders nicely, while [`PublicProfile`](file:///c:/Users/rudra/TyProX/app/u/%5Busername%5D/page.tsx) profile icon hits `404` -> fallback (`default.svg`) whenever `SPEED_80` / `SPEED_150` / `STREAK_14` is displayed (`DB-A2`).

---

## 7. Prioritized Remediation Action Plan & Release Gate

### P0 — Mandatory Before Production Hardening / Launch
1. **Harden `POST /api/results/sync` & Safe Partial Sync (`SEC-A1`) — `[App Done / DB Column Gated]`:** Implemented `checkSyncRateLimit` (`429` + `Retry-After`), unranked mode exclusion, in-batch & cross-DB `clientRunId` + signature deduplication, non-false-ack `207`/`500` responses, chunked `syncGuestHistoryBatches` + selective `removeGuestResults`, and route/client unit tests. Persisting DB `client_run_id` uniqueness & closing `public.replays` `anon` RLS still require executing `20260621`.
2. **Fix `20260621` Migration Defects & Missing Assets (`DB-A1`, `DB-A2`, `SEC-A3`) — `[App & SVGs Done / SQL Gated]`:**
   - Added `speed_80.svg`, `speed_150.svg`, and `streak_14.svg` to `public/achievements/`.
   - Implemented schema-adaptive `client_run_id` persistence (`PGRST204` fallback), `replays` compensating rollback, strict `streaks`/`achievements`/count error checking, and `.eq('is_invalidated', false)` rate-limit filtering in `persistence.ts` & `rate-limit.ts`.
   - **Still Blocked on Owner DB Gate:** Update [`20260621`](file:///c:/Users/rudra/TyProX/supabase/migrations/20260621000000_typrox_2_hardening.sql) SQL (`REVOKE ALL ON FUNCTION public.handle_new_user()`, seed all `11` achievement codes) and provision `SUPABASE_SERVICE_ROLE_KEY` before running migrations.
3. **Fix Early Completion Bracket Duration Bug (`ENG-A1`) — `[Done]`:** Separated `elapsedSeconds` from canonical bracket `duration` across metrics, verifier, ResultScreen, `/api/challenges`, DAL, and ChallengeArenaClient.
4. **Fix High-Severity Visual Defects (`UX-A1`, `UX-A2`) — `[Done]`:** Fixed Light Mode `CatCompanion` opaque semantic drawer (`bg-surface`, `z-40`) and isolated `Hero3D` perspective stacking context + docked HUD card grid.

### P1 — High-Value Reliability, Security Depth & UX Fixes (Strongly Recommended Before Public Announcement)
1. **Provision Server Secrets & Complete Owner DB Gate (Section 8 below) — `[Unresolved / Owner Gate]`.**
2. **Server-Signed Run-Start Token (`SEC-A2`) — `[Unresolved]`:** Issue HMAC-signed `(seed, mode, duration, issuedAt)` tokens on run initialization (`POST /api/runs/init`) to eliminate offline seed telemetry synthesis.
3. **Fix Stale Challenge State & Silent Failure Feedback (`ENG-A2`, `ENG-A3`, `ENG-A4`..`ENG-A7`) — `[ENG-A2 & ENG-A3 Done; ENG-A4..A7 Open]`:** Cleared challenge state cleanly on unmount (`ChallengeArenaClient`) and added explicit failure banners + `"Retry Save"` + failed-promise cache eviction (`ResultScreen`, `ChallengeArenaClient`); `ENG-A4` (non-alpha drill targets), `ENG-A5` (guest streak helper), `ENG-A6` (`onPaste` + median bigram latency), and `ENG-A7` (SQL aggregate KPIs) remain open.
4. **Semantic Landmarks, Mobile Tap Targets & Middleware Redirect Policy (`UX-A3`, `UX-A4`, `QA-A1`) — `[Unresolved]`:** Add `<main>` on `/`, `<h1>` on `/typing`, bump filter/pill controls to `min-h-[44px]` on small screens (`w-7 h-7` -> `p-2` `>=40px` for swatches), add real local-Postgres RLS tests, and commit atomic feature/hardening batches to Git.

### P2 — Roadmap Completion (Phases 4–5 Ecosystem)
1. Wire `/learn`, `/daily` (+ Daily Standings tab), and `challenge_attempts` 1v1 outcomes to `20260622` tables via validated API/DAL modules rather than leaving them local-only.
2. Implement `SPEC-5.3` (server XP/levels + streak freezes), `SPEC-5.6` (TSI rating/seasons), `SPEC-5.8` (365-day `/u/[username]` heatmap & PB matrix), `SPEC-5.9` (`/replay/[id]`), and `SPEC-5.10` (`/compare`).
3. Harden production CSP with per-request nonces (`SEC-A4`) and complete sitemap coverage (`UX-A5`).

---

## 8. Production Database Approval Gate Runbook (Required External Sequence)

Do **not** deploy TyProX 2.0 to production until the project owner completes these steps in exact order:
1. **Fix P0 code/SQL issues first** (`sync` hardening, `20260621` function revoke & 11 achievements + 3 SVGs, `configuredDuration` persistence, `Hero3D` & `CatCompanion` UI).
2. **Backup & Inspect Production (`gbovkejymfeiqgverzfr`):** Verify Supabase automated backups or take a manual `pg_dump` export; run the read-only catalog queries (`pg_policies`, `role_table_grants`, `pg_indexes`, `handle_new_user()`, `pg_publication_tables`) in [`SECURITY_REMEDIATION_PLAN.md` Section 4](file:///c:/Users/rudra/TyProX/docs/roadmap/SECURITY_REMEDIATION_PLAN.md#L258-L298).
3. **Provision Environment Secrets:** Set `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SITE_URL` in hosting env & local `.env.local` (never expose via `NEXT_PUBLIC_*`).
4. **Apply Hardening Migration (`20260621`):** Execute revised `20260621000000_typrox_2_hardening.sql`, test `POST /api/results`, `POST /api/challenges`, `GET /api/leaderboard` (`leaderboard_view` live without `PGRST205`), and confirm direct browser `anon`/`authenticated` writes to `test_results`/`replays`/`streaks`/`challenge_links` fail with `42501`.
5. **Review Historical Outliers Read-Only First:** Separately quarantine `6` `__debug_test__` rows (`user_id IS NULL`) and verified exploit rows (e.g., `1`-keystroke `200 raw_wpm` artifact) with explicit owner sign-off.
