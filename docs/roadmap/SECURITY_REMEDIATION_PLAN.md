# TyProX Security & Competitive Integrity Remediation Plan (Phase 1)

**Document Status:** Application Hardening Implemented & Verified; Database DDL Migrations Prepared & Gated for Owner Approval  
**Priority Tier:** Phase 1 (Highest Priority, Launch Blocker)  
**Primary Audit Sources:** [SECURITY_REVIEW.md](file:///c:/Users/rudra/TyProX/docs/audit/SECURITY_REVIEW.md), [PROJECT_AUDIT.md](file:///c:/Users/rudra/TyProX/docs/audit/PROJECT_AUDIT.md), [FEATURE_INVENTORY.md](file:///c:/Users/rudra/TyProX/docs/audit/FEATURE_INVENTORY.md), [TECHNICAL_DEBT.md](file:///c:/Users/rudra/TyProX/docs/audit/TECHNICAL_DEBT.md)  
**Implementation Status:**
- `SEC-1.1` (Delete debug/test endpoints): **Implemented & Verified (`404`)**
- `SEC-1.2` (OAuth Callback & Login Open Redirect hardening): **Implemented & Verified (`6` unit tests + E2E `307` guard)**
- `SEC-1.3` (Remove `?demo=true` & `typrox_demo` bypasses): **Implemented & Verified**
- `SEC-1.4` (Server-side telemetry verifier `lib/typing/verifier.ts` & hardened `POST /api/results` / `POST /api/results/sync`): **Implemented & Verified (with live schema compatibility guard until DB gate)**
- `SEC-1.6` (`POST /api/challenges` & `PATCH /api/profile` validation/masking + challenge expiry checks): **Implemented & Verified**
- `SEC-1.7` (`GET /api/leaderboard` Zod validation & error masking, rate limiter, `AuthProvider` `getUser()`, `next.config.ts` CSP & security headers): **Implemented & Verified**
- `SEC-1.5` (SQL `GRANT ALL` revocation, RLS tightening, `leaderboard_view` `security_invoker`, hardened `handle_new_user()`, backup & outlier cleanup): **Prepared in [20260621000000_typrox_2_hardening.sql](file:///c:/Users/rudra/TyProX/supabase/migrations/20260621000000_typrox_2_hardening.sql); Awaiting Owner Database Approval Gate**

---

## 1. Three-State Database & Infrastructure Truth Model

Before applying any DDL or RLS changes, implementation must treat the PostgreSQL database across three strictly separated states:

1. **Local Migration State (Ordered Files in Git):**
   - [20260618000000_init_schema.sql](file:///c:/Users/rudra/TyProX/supabase/migrations/20260618000000_init_schema.sql)
   - [20260619000000_audit_hardening.sql](file:///c:/Users/rudra/TyProX/supabase/migrations/20260619000000_audit_hardening.sql)
   - [20260620100000_leaderboard_view.sql](file:///c:/Users/rudra/TyProX/supabase/migrations/20260620100000_leaderboard_view.sql)
   - **Characteristics:** Missing achievement seed rows (`public.achievements`), missing `idx_test_results_leaderboard`, missing `supabase_realtime` publication membership for `test_results`, retains permissive policies (`test_results`, `replays`, `streaks`, `user_achievements`), and `20260619` references a policy name (`"Anyone can insert challenge links"`) that collides differently in `FULL_SCHEMA.sql`.
2. **Repository Schema Snapshot:**
   - [FULL_SCHEMA.sql](file:///c:/Users/rudra/TyProX/supabase/migrations/FULL_SCHEMA.sql)
   - **Characteristics:** Consolidated manual SQL Editor script containing `GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role`, 8 achievement seed rows, `idx_test_results_leaderboard`, `ALTER PUBLICATION supabase_realtime ADD TABLE public.test_results`, `"Authenticated users can create challenge links"`, and `leaderboard_view`.
3. **Actual Production Database State (External / Unverified):**
   - **Characteristics:** Static repository inspection cannot confirm whether live Supabase project (`gbovkejymfeiqgverzfr` referenced in [OAUTH_SETUP.md](file:///c:/Users/rudra/TyProX/OAUTH_SETUP.md)) was bootstrapped via `FULL_SCHEMA.sql`, via ordered migrations, or edited ad hoc via Dashboard SQL Editor, nor how many orphaned `__debug_test__` rows, anonymous `user_id IS NULL` rows, or invalid client-submitted high scores currently exist.
   - **Mandatory Pre-Migration Gate:** Execute the read-only verification script in Section 4 inside the live Supabase SQL Editor (or via authenticated `supabase db diff --linked`) **before** authoring or applying the forward hardening migration.

### 1.1 Infrastructure Prerequisite (`SUPABASE_SERVICE_ROLE_KEY`)
Currently `.env.local` defines only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Revoking direct browser/PostgREST `INSERT`/`UPDATE` access to `test_results`, `replays`, `streaks`, `user_achievements`, and `challenge_links` requires privileged server writes via one of two mechanisms:
- **Recommended Strategy (Option A): Server-Only Admin Client (`createAdminClient`)**
  - Provision server-only `SUPABASE_SERVICE_ROLE_KEY` in hosting secrets / `.env.local` (never prefixed with `NEXT_PUBLIC_`).
  - Create [lib/supabase/admin.ts](file:///c:/Users/rudra/TyProX/lib/supabase/admin.ts) guarded with `import 'server-only'` (`auth: { persistSession: false, autoRefreshToken: false }`).
  - Route handlers authenticate the user first via SSR cookie client (`createClient()` -> `supabase.auth.getUser()`), validate & recompute scores deterministically in TypeScript (`lib/typing/verifier.ts`), and perform authoritative writes using `createAdminClient()`.
  - **Why Option A fits best:** Reuses one isomorphic TypeScript text generator (`generateText`) and telemetry engine across browser worker, server verifier, and Vitest without duplicating dictionaries or PRNG math inside PL/pgSQL.
- **Alternative (Option B): Postgres `SECURITY DEFINER` RPCs:** Would still require invoking `generateText` in Node or porting dictionaries into SQL functions. Option A is lower maintenance and strongly recommended.

---

## 2. Phase 1 Detailed Task Specifications

### SEC-1.1: Remove Public Debug & Database Test API Endpoints
- **Audit Reference:** `SEC-04`, `PA-09`
- **Problem:** Unauthenticated routes `GET /api/debug/supabase` and `GET /api/test-supabase` expose environment metadata, exact table row counts, Postgres error details/hints, current user email/profile JSON, and full Supabase URL. Every GET to `/api/debug/supabase` also inserts a permanent `seed: '__debug_test__'` row into `test_results` because `.delete()` silently fails under missing `DELETE` RLS policy.
- **Root Cause:** Temporary setup diagnostics left deployed without `NODE_ENV` gating, authorization checks, or removal prior to launch.
- **Proposed Solution:**
  1. Delete [app/api/debug/supabase/route.ts](file:///c:/Users/rudra/TyProX/app/api/debug/supabase/route.ts) and [app/api/test-supabase/route.ts](file:///c:/Users/rudra/TyProX/app/api/test-supabase/route.ts) (preferred over env gating so production build surface is completely clean and no diagnostic write-test code stays shipped).
  2. Clean up existing `__debug_test__` rows in production DB after inspection.
- **Files/Components Affected:** Delete `app/api/debug/supabase/route.ts`, delete `app/api/test-supabase/route.ts`.
- **Database Changes:**
  - *Local Migrations / Snapshot:* None.
  - *Production DB:* Run conditional cleanup query (`DELETE FROM public.test_results WHERE seed = '__debug_test__';`) via Dashboard SQL Editor after read-only count verification.
- **Security Implications:** Eliminates unauthenticated reconnaissance leak and database write spam vector immediately.
- **Dependencies:** None (safe first change).
- **Testing Requirements:** Playwright/HTTP smoke test asserting `GET /api/debug/supabase` and `GET /api/test-supabase` return `404`.
- **Acceptance Criteria:** Neither route appears in `next build` route manifest; requests to both endpoints return `404 Not Found`; zero `__debug_test__` rows remain in production `test_results`.
- **Priority:** `Critical`
- **Estimated Complexity:** `S` (Trivial removal + DB row cleanup)

---

### SEC-1.2: Fix Open Redirect in OAuth Callback & Login Flow
- **Audit Reference:** `SEC-03`
- **Problem:** [app/auth/callback/route.ts](file:///c:/Users/rudra/TyProX/app/auth/callback/route.ts#L7-L14) feeds raw `?next=` query parameter into `new URL(next, request.url)` and redirects immediately after `exchangeCodeForSession(code)`. Attackers can supply `?next=https://evil.example` or `?next=//evil.example`.
- **Root Cause:** `new URL(input, base)` resolves full external origins and protocol-relative URLs when `input` includes scheme or `//`.
- **Proposed Solution:**
  1. Add shared URL validator `sanitizeRedirectPath(next: string | null, fallback = '/dashboard'): string` in [lib/security/redirect.ts](file:///c:/Users/rudra/TyProX/lib/security/redirect.ts).
  2. Enforce strict relative path rules: must begin with single `/`, must NOT start with `//` or `/\`, must NOT contain `\r`, `\n`, `\0`, whitespace control chars, `@`, or encoded backslash bypasses (`decodeURIComponent` checked identically), and parsed `new URL(candidate, 'https://localhost').origin === 'https://localhost'`.
  3. Apply `sanitizeRedirectPath` in `app/auth/callback/route.ts` and when constructing `redirectTo` on [app/login/page.tsx](file:///c:/Users/rudra/TyProX/app/login/page.tsx). Also check proxy middleware `?next=` usage in [lib/supabase/middleware.ts](file:///c:/Users/rudra/TyProX/lib/supabase/middleware.ts#L52).
- **Files/Components Affected:** `lib/security/redirect.ts` (new), `app/auth/callback/route.ts`, `app/login/page.tsx`, `lib/supabase/middleware.ts`.
- **Database Changes:**
  - *Local Migrations / Snapshot / Production DB:* Verify in external Supabase Auth Dashboard that **Redirect URLs** allowlist permits only trusted app origins (`/auth/callback` on localhost dev & verified Vercel/custom domain).
- **Security Implications:** Neutralizes trusted-domain OAuth phishing bounce attacks.
- **Dependencies:** None.
- **Testing Requirements:** Vitest unit suite testing `sanitizeRedirectPath` against `https://evil.com`, `//evil.com`, `/\evil.com`, `/%2f/evil.com`, `javascript:alert(1)`, `@evil.com`, valid `/typing?mode=words`, valid `/dashboard`. Playwright check verifying `/auth/callback?next=https://evil.com` never redirects off-origin.
- **Acceptance Criteria:** 100% of external/protocol-relative redirect inputs fall back to `/dashboard`; valid internal routes (`/challenge/<uuid>`, `/typing`, `/dashboard`) preserve redirect destination.
- **Priority:** `High`
- **Estimated Complexity:** `S`

---

### SEC-1.3: Strip All Demo-Mode Auth & Data Bypasses from Production Paths
- **Audit Reference:** `SEC-05`, `TD-04`
- **Problem:** `?demo=true` query parameters, `typrox_demo_logged_in=true` cookie, and `localStorage.getItem('typrox_demo')` bypass Edge auth checks in `updateSession`, return fabricated scores in `GET /api/leaderboard` (`searchParams.get('demo') !== null` even triggers on `?demo=false`), hijack typing input with an auto-typist, and mock sessions in Navbar/Login/Dashboard/Performance Lab.
- **Root Cause:** Temporary promo-video instrumentation left unguarded in core runtime code.
- **Proposed Solution:**
  1. Remove `isDemo` / `typrox_demo_logged_in` bypass completely from [lib/supabase/middleware.ts](file:///c:/Users/rudra/TyProX/lib/supabase/middleware.ts#L48-L54). Protected paths (`/dashboard`, `/profile`) redirect unauthenticated requests strictly via `supabase.auth.getUser()`. Also update `isProtectedPath` decision on `/dashboard/performance-lab` intentionally (verify with product owner whether Performance Lab remains previewable to guests as a locked gate or protected — currently middleware explicitly skips `/dashboard/performance-lab` so guests see the locked screen; keep intentional route parity while removing `isDemo`).
  2. Remove all `isDemo` branches from [app/api/leaderboard/route.ts](file:///c:/Users/rudra/TyProX/app/api/leaderboard/route.ts#L13-L54), [components/navbar.tsx](file:///c:/Users/rudra/TyProX/components/navbar.tsx), [app/login/page.tsx](file:///c:/Users/rudra/TyProX/app/login/page.tsx), [app/dashboard/page.tsx](file:///c:/Users/rudra/TyProX/app/dashboard/page.tsx), [app/dashboard/performance-lab/page.tsx](file:///c:/Users/rudra/TyProX/app/dashboard/performance-lab/page.tsx), [app/leaderboard/page.tsx](file:///c:/Users/rudra/TyProX/app/leaderboard/page.tsx), and [components/typing/typing-container.tsx](file:///c:/Users/rudra/TyProX/components/typing/typing-container.tsx#L142-L208).
- **Files/Components Affected:** `lib/supabase/middleware.ts`, `app/api/leaderboard/route.ts`, `components/navbar.tsx`, `app/login/page.tsx`, `app/dashboard/page.tsx`, `app/dashboard/performance-lab/page.tsx`, `app/leaderboard/page.tsx`, `components/typing/typing-container.tsx`.
- **Database Changes:** None.
- **Security Implications:** Closes trivial `?demo=true` cookie/query auth bypass and prevents fake data injection into API/UI.
- **Dependencies:** None.
- **Testing Requirements:** Playwright test requesting `/dashboard?demo=true` and `/dashboard` with forged `typrox_demo_logged_in=true` cookie -> verifies `307` redirect to `/login`; API integration test asserting `GET /api/leaderboard?demo=true` queries database (never returns `'speed_demon'` mock).
- **Acceptance Criteria:** Zero occurrences of `typrox_demo` or `typrox_demo_logged_in` remain across `app/`, `components/`, `lib/`, and `proxy.ts`.
- **Priority:** `High`
- **Estimated Complexity:** `M` (Touches 8 files cleanly)

---

### SEC-1.4: Harden Server-Side Score Verification & Telemetry Anti-Cheat (`POST /api/results`)
- **Audit Reference:** `SEC-01`, `PA-01`, `PA-02`, `FI-02`
- **Problem:** `POST /api/results` trusts client-supplied `wpm`, `rawWpm`, `accuracy`, `consistency`, `errorCount`, `backspaceCount`, and `duration` verbatim; skips anti-cheat checks when `telemetry` has `<= 10` events (`telemetry: []` succeeds with `350 WPM`); does not compare typed keys `k` against `generateText(seed, mode, duration)`; accepts malformed unbounded strings in `telemetry.k`; ignores wall-clock/idle mismatch (`lastKeystrokeTime - startTime` exploit yielding `200 WPM` from 1 character on 60s tests); and executes streak/achievement bugs.
- **Root Cause:** Missing server-side domain verifier module and lack of `createAdminClient()` separation between client payload and authoritative DB calculation.
- **Proposed Solution:**
  1. Create isomorphic typing generator/metrics package ([lib/typing/text-generator.ts](file:///c:/Users/rudra/TyProX/lib/typing/text-generator.ts) & [lib/typing/metrics.ts](file:///c:/Users/rudra/TyProX/lib/typing/metrics.ts)) shared between client worker, server verifier, and unit tests.
  2. Create server-only verification engine [lib/typing/verifier.ts](file:///c:/Users/rudra/TyProX/lib/typing/verifier.ts) (`import 'server-only'`) performing:
     - **Strict Zod Validation:** Enforce `mode` enum, `duration` allowlist (`15 | 30 | 60 | 120` for ranked tests), `seed` charset/length (`[a-zA-Z0-9_-]{4,64}`), `telemetry.length >= 10` (or minimum text length if completed early), `t` non-negative finite int `<= 600_000`, `y` binary `0 | 1`, `i` int `>= 0` and `< reconstructedMaxLength`, `k`: for `y === 0`, single code point / allowed key char (`length === 1`); for `y === 1`, `'Backspace'`. Reject client score spoofing by **not trusting** submitted `wpm`, `accuracy`, `rawWpm`, `consistency`, `errorCount`, `backspaceCount` as source of truth.
     - **Deterministic Text & Cursor Replay Reconstruction:** Generate `targetText = generateText(seed, mode, duration)`. Step through sorted `telemetry`:
       - Verify cursor index progression strictly: start `cursor = 0`; on `y === 0`, `item.i === cursor`, then `cursor++` (`cursor <= targetText.length`); on `y === 1`, `cursor > 0` and `item.i === cursor - 1`, then `cursor--`. Any impossible index jump (`item.i !== expectedCursor`) triggers cheat rejection (`400 Bad Request`).
       - Compare every input event against `targetText[item.i]` to derive authoritative `correctBufferChars`, `uncorrectedErrors`, `totalInputKeystrokes`, `correctInputKeystrokes`, `backspaceCount`, and replay metrics.
     - **Authoritative Duration & Exploit Closing:** Determine completion boundary (`completionReason`: `'timer'` vs `'completed_text'`):
       - If `cursor < targetText.length` (test ended via countdown expiry): authoritative duration for WPM calculation MUST be `duration` (`15 | 30 | 60 | 120` seconds), **never** `lastKeystrokeTime - startTime`. Thus typing 1 key at `t = 0` and idling for 60s yields `(1/5) / 1.0 = 0.2 WPM` rounded to `0`, NOT `200 WPM`.
       - If `cursor >= targetText.length` (user finished full generated text before timer ran out): require minimum wall-clock finish plausibility (`lastT >= duration * 1000` OR if `quotes`/`code` finished cleanly, wait until Phase 2 multi-quote concatenation ensures `targetText` cannot finish in `< 15s` at human speeds, and compute `actualDurationSecs = Math.max(5, Math.round(lastT / 1000))`, flagging ranked eligibility only if `actualDurationSecs >= duration` or `mode === 'quotes'` minimum duration `>= 5s`).
     - **Hardened Anti-Cheat Checks (Plausibility & Bot Detection):**
       - Monotonic non-decreasing timestamps (`item.t >= prev.t`, `telemetry[0].t <= 200`).
       - Reject inhuman sustained speed: minimum sliding-window interval over any `15`-char window `< 22ms/char` (equivalent to `> 545 WPM` burst) or overall server-recomputed `wpm > 280` or `rawWpm > 320`.
       - Reject synthetic constant-jitter bots: require telemetry spread (compute IQR or standard deviation & distinct delta count; reject if `stdDev < 2.5ms` OR if >95% of deltas fall within 3 distinct quantized values over `>= 25` keystrokes).
       - Optional Defense-in-Depth (Phase 1 follow-on / Phase 2): Signed server run-start token (`POST /api/runs/init`) embedding `(seed, mode, duration, issuedAt, hmac)` so client cannot submit a `60s` run 2 seconds after generating a seed. Note clearly if run-start token requires stateless HMAC secret (`RUN_TOKEN_SECRET`) in `.env`.
  3. **Idempotent Submission Key (`clientRunId` UUID):** Require `runId: z.string().uuid()` backed by a `UNIQUE (user_id, client_run_id)` partial index or `client_run_id UUID UNIQUE` column on `test_results` so strict-mode double POSTs return existing record idempotently instead of inserting duplicates.
  4. **Require Auth on `POST /api/results` (or Explicit Guest Handling):** Keep guest storage client-side (`localStorage`) so anonymous unauthenticated callers do NOT trigger pointless API writes — or if `POST /api/results` requires authenticated `user` (`401 Unauthorized` when signed out), update client so guests save locally cleanly without noisy failed POSTs. Wait: currently guests don't even call `/api/results` (`ResultScreen:36` checks `if (session?.user)`!). Requiring `401 Unauthorized` in `POST /api/results` when `!user` closes anonymous server compute waste cleanly!
  5. **Verified Guest-to-Cloud Sync Endpoint:** Replace direct browser Supabase insert (`app/dashboard/page.tsx:327`) with `POST /api/results/sync` (or batched verified calls through the shared verifier). Any legacy `GuestResult` saved in `localStorage` without `telemetry` cannot be verified for ranked leaderboards and is explicitly marked/skipped during verified cloud sync (with clear count message to user), while new `GuestResult` entries store capped `telemetry` so they pass full server verification upon login!
  6. **Fix Streak & Achievement Evaluation Server-Side (`FI-02`):**
     - Initialize `streaks.last_active_date` nullable (`DATE NULL`, `current_streak = 0`), or treat `current_streak === 0` as Day 1 -> `currentStreak = 1`, `longestStreak = Math.max(1, longestStreak)`, `last_active_date = today`.
     - Pass updated `currentStreak` (NOT stale `streakRow.current_streak`) into achievement trigger evaluation.
     - Accept optional client IANA timezone offset or standardize clearly on UTC calendar day documented in UI (`UTC day`) to avoid timezone manipulation/confusion.
     - Insert `test_results`, `replays`, `streaks`, and `user_achievements` via `createAdminClient()`. (Consider wrapping multi-table persistence in a single Postgres transaction RPC called exclusively by `service_role` if atomic rollback across `test_results` + `replays` + `streaks` is desired — recommend `submit_verified_result` SQL transaction RPC OR sequential admin inserts with error handling).
- **Files/Components Affected:** `lib/supabase/admin.ts` (new), `lib/typing/text-generator.ts` (extracted/shared), `lib/typing/verifier.ts` (new), `app/api/results/route.ts`, `app/api/results/sync/route.ts` (new or consolidated), `app/dashboard/page.tsx` (`handleSyncHistory`), `components/typing/result-screen.tsx`, `stores/typing-store.ts`, `stores/user-store.ts` (`GuestResult` telemetry field).
- **Database Changes:**
  - *Local Migrations:* Add `client_run_id UUID UNIQUE` (nullable for legacy rows) on `public.test_results`; make `streaks.last_active_date` nullable (`ALTER TABLE public.streaks ALTER COLUMN last_active_date DROP DEFAULT, ALTER COLUMN last_active_date DROP NOT NULL;` or handle `current_streak = 0` cleanly without breaking existing nulls); add optional `verification_version SMALLINT DEFAULT 1` / `is_ranked BOOLEAN DEFAULT true` if differentiating post-fix verified runs.
  - *Snapshot (`FULL_SCHEMA.sql`):* Reconciled cleanly via unified forward migration + schema docs update.
  - *Production DB:* Requires verifying existing `test_results` / `streaks` rows before adding columns/constraints (`client_run_id` nullable so historical rows are unaffected). Historical suspicious scores (`wpm > 250` or `__debug_test__`) should be inspected and flagged `is_invalidated = true` by owner review.
- **Security Implications:** Eliminates client score fabrication, 1-char 200 WPM exploit, empty-telemetry bypass, telemetry schema stuffing, direct DB insert bypass (`handleSyncHistory`), and client-triggered duplicate DB writes.
- **Dependencies:** `SUPABASE_SERVICE_ROLE_KEY` provisioned; **Shared `generateText` parity** between Phase 1 (`verifier.ts`) and Phase 2 (`ENG-2.3` quotes/code adjustments) so both server and client generate byte-identical text for any `(seed, mode, duration)`.
- **Testing Requirements:** Vitest tests for `verifyAndScoreSession` covering: valid run metrics, 1-char 60s idle exploit (must compute ~`0 WPM`, NOT `200 WPM`), empty telemetry (`400`), cursor index jump (`400`), negative/non-monotonic timestamp (`400`), zero-variance autotyper (`400`), wrong character keys (`accuracy`/`errorKeys` match), corrected mistakes affecting `rawWpm`/`accuracy`, duplicate `runId` idempotency, Day-1 streak initialization (`0 -> 1`), and same-day Day-3 achievement unlock.
- **Acceptance Criteria:** Submitting forged `{ wpm: 350, telemetry: [] }` returns HTTP `400`; submitting 1-keystroke 60s telemetry stores `0`–`1 WPM` instead of `200 WPM`; browser-console `supabase.from('test_results').insert(...)` returns `403` / RLS failure; Day-1 signup test increments `current_streak` to `1`.
- **Priority:** `Critical`
- **Estimated Complexity:** `L`

---

### SEC-1.5: Lock Down Postgres Schema Privileges (`GRANT ALL`), RLS Policies & Views
- **Audit Reference:** `SEC-02`, `SEC-06`, `SEC-08`, `TD-03`
- **Problem:** `FULL_SCHEMA.sql` executes `GRANT ALL ON ALL TABLES/SEQUENCES/FUNCTIONS IN SCHEMA public TO anon, authenticated`. RLS allows anonymous (`auth.uid() IS NULL`) inserts on `test_results`, `replays`, `challenge_links`; allows authenticated users to directly `INSERT` arbitrary scores onto `test_results`/`replays`, `UPDATE` their own `streaks`, and `INSERT` arbitrary `user_achievements`; leaves `leaderboard_view` missing `WHERE user_id IS NOT NULL` and missing `WITH (security_invoker = true)`; leaves `challenge_links` missing `expires_at > now()`; and leaves `handle_new_user()` trigger vulnerable to OAuth username collision/length crash and mutable `search_path`.
- **Root Cause:** Early beta convenience policies + unhardened manual `FULL_SCHEMA.sql` `GRANT ALL` block + omitted migration alignment.
- **Proposed Solution (Forward Migration `20260621000000_security_hardening_reconcile.sql`):**
  1. **Least-Privilege SQL Grants:**
     - `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;`
     - `REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;`
     - `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;`
     - `GRANT USAGE ON SCHEMA public TO anon, authenticated;`
     - Re-grant **explicit minimal privileges**:
       - `anon`: `SELECT` only on `public.profiles`, `public.achievements`, `public.daily_challenges`, `public.challenge_links`, `public.leaderboard_view`, `public.streaks`, `public.user_achievements`, and scoped `public.test_results` / `public.replays` (see privacy scoping below). **ZERO `INSERT`/`UPDATE`/`DELETE` grants for `anon`.**
       - `authenticated`: `SELECT` on same permitted tables/views + `UPDATE (display_name, avatar_url, theme, font_family, updated_at)` on `public.profiles` (or keep full row `UPDATE` protected via trigger/API while preventing `username`/`id` hijack if desired — note `UsernameModal` sets `username` once when matching `^user_`, so column update via validated `/api/profile` route is even safer than direct browser table `UPDATE`!). Drop direct `INSERT`/`UPDATE` grants for `authenticated` on `test_results`, `replays`, `streaks`, `user_achievements`, `challenge_links`, `user_challenge_progress` (once challenge submission & daily challenges route through API/server!). Wait: let's keep Phase 5 `user_challenge_progress` & `challenge_links` routed via server API too so **no** competitive/progression table accepts arbitrary client writes!
  2. **RLS Policy Hardening:**
     - Drop permissive `INSERT` policies on `test_results`, `replays`, `challenge_links`, `user_achievements`, `user_challenge_progress`.
     - Drop `UPDATE` policy `"Users can update their own streaks"` on `streaks` and `INSERT` policy `"Trigger can insert streaks"` (handled by `SECURITY DEFINER` trigger & `service_role`).
     - Tighten `challenge_links` `SELECT`: `USING (expires_at > timezone('utc'::text, now()))` so expired lobbies are invisible even via direct Supabase REST query!
     - Tighten `test_results` & `replays` `SELECT` privacy (`SEC-06`):
       - `test_results`: `USING (is_invalidated = false OR auth.uid() = user_id)` (better yet: restrict non-owner reads of raw non-public runs or expose public profile summaries via a SQL `public_profile_stats` / `public_top_runs` view with `WHERE user_id IS NOT NULL AND is_invalidated = false`, while `test_results` `SELECT` RLS permits `auth.uid() = user_id` cleanly — verify compatibility with `/u/[username]` in Phase 3 Server Component DAL! Notice `/u/[username]` in Phase 3 Server Component can query aggregated stats via safe view or `createAdminClient()` DTO, whereas keeping `(is_invalidated = false AND user_id IS NOT NULL) OR auth.uid() = user_id` on `test_results` immediately blocks querying invalidated rows and null guest rows without breaking existing `/u/[username]` client query until Batch 3.3 migrates `/u/[username]` to a Server Component! Document that exact two-step tightening!).
       - `replays`: restrict direct PostgREST `SELECT` to owner (`EXISTS (SELECT 1 FROM public.test_results tr WHERE tr.id = test_result_id AND tr.user_id = auth.uid())`) OR allow via controlled API route (`GET /api/replays/[id]`) for shareable non-invalidated runs in Phase 5, stopping bulk unauthenticated telemetry scraping today! Double-check client consumers of `replays`: `PerformanceLabPage` queries replays ONLY for signed-in `session.user.id` (`performance-lab/page.tsx:87-101`), so scoping `replays` `SELECT` to `auth.uid()` preserves 100% of current working functionality immediately while blocking unauthenticated scraping (`SEC-06`)!
  3. **Harden `leaderboard_view`:**
     - Rebuild with `CREATE OR REPLACE VIEW public.leaderboard_view WITH (security_invoker = true) AS SELECT DISTINCT ON (user_id, mode, duration) id, user_id, wpm, accuracy, consistency, mode, duration, is_invalidated, created_at FROM public.test_results WHERE is_invalidated = false AND user_id IS NOT NULL ORDER BY user_id, mode, duration, wpm DESC;`
     - Verify `idx_test_results_leaderboard` index exists cleanly (`CREATE INDEX IF NOT EXISTS ...`).
     - Reconcile achievement seeds (`ON CONFLICT (code) DO NOTHING`) and Realtime publication guard cleanly.
  4. **Harden `handle_new_user()` Auth Trigger (`SEC-08`):**
     - `CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ ...`
     - Sanitize username: extract lowercase alphanumeric + underscores from metadata (`regexp_replace(lower(...), '[^a-z0-9_]', '', 'g')`), require `char_length >= 3` or fallback to `'user_' || substring(NEW.id::text, 1, 8)`, and check uniqueness / append deterministic 4-char ID suffix if collision occurs so Google/GitHub signups NEVER fail due to duplicate display handles!
     - Set initial `streaks`: `INSERT INTO public.streaks (user_id, current_streak, longest_streak, last_active_date) VALUES (NEW.id, 0, 0, NULL)` (after making `last_active_date` nullable, or keeping sentinel check `current_streak = 0`).
- **Files/Components Affected:** New migration `supabase/migrations/20260621000000_security_hardening_reconcile.sql`; update `supabase/migrations/FULL_SCHEMA.sql` documentation note or deprecate manual copy-paste snapshot cleanly in favor of CLI migrations; move client `challenge_links` creation in `components/typing/result-screen.tsx` to new `POST /api/challenges` API route; move `UsernameModal` profile update in `components/auth/username-modal.tsx` through hardened `PATCH /api/profile` (or ensure `profiles` column integrity).
- **Database Changes:**
  - *Local Migrations:* New forward migration file `20260621000000_security_hardening_reconcile.sql`.
  - *Snapshot:* Reconciled state documented; ensure `FULL_SCHEMA.sql` either mirrors exact post-migration hardened DDL or carries a deprecation header pointing to ordered migrations.
  - *Production DB:* **Requires manual inspection first** (Section 4 queries) before executing migration!
- **Security Implications:** Closes every direct PostgREST tamper hole (`test_results`, `replays`, `streaks`, `user_achievements`, `challenge_links`), blocks `anon` spam, stops bulk replay telemetry dumping, fixes `security_invoker` on `leaderboard_view`, and eliminates OAuth signup crashes.
- **Dependencies:** `SEC-1.4` (`POST /api/results` & `SUPABASE_SERVICE_ROLE_KEY`), `POST /api/challenges` (`SEC-1.6`).
- **Testing Requirements:** SQL RLS verification suite executed against staging/local Supabase with `anon` and `authenticated` roles + integration check on `UsernameModal`, `/u/[username]`, `/leaderboard`, `/challenge/[id]`, and `PerformanceLabPage`.
- **Acceptance Criteria:**
  - `anon` write attempts against any public table fail with Postgres `42501`.
  - Authenticated direct inserts/updates to `test_results`, `replays`, `streaks`, `user_achievements`, `challenge_links` fail with `42501`.
  - `anon` select on `replays` returns 0 rows for other users.
  - `leaderboard_view` definition includes `security_invoker=true` and `user_id IS NOT NULL`.
  - Expired `challenge_links` return 0 rows.
  - Conflicting OAuth metadata usernames resolve cleanly without failing `auth.users` insert.
- **Priority:** `Critical`
- **Estimated Complexity:** `L`

---

### SEC-1.6: Move Challenge Creation & Profile/Username Mutation Behind Validated APIs
- **Audit Reference:** `SEC-01`, `SEC-02`, `SEC-07`, `SEC-08`, `FI-03`
- **Problem:** `ResultScreen.handleShare()` inserts directly into `challenge_links` from browser JS (`result-screen.tsx:115`) using client-reported `creator_wpm`/`creator_accuracy`. `UsernameModal` updates `profiles.username` directly from browser JS (`username-modal.tsx`) while `PATCH /api/profile` only validates `displayName` (`profile/route.ts:14`) and leaks raw Supabase error strings (`error.message`). Meanwhile `ChallengePage` queries `challenge_links` without checking `expires_at` (`challenge/[id]/page.tsx:42-46`).
- **Root Cause:** Inconsistent client-SDK vs Next Route Handler mutation boundary.
- **Proposed Solution:**
  1. Create `POST /api/challenges` route handler:
     - Requires authenticated `user = await supabase.auth.getUser()`.
     - Accepts `{ testResultId: uuid }`, fetches the verified `test_results` row owned by `user.id` (`is_invalidated = false`) using `createAdminClient()`, creates the `challenge_links` row copying authoritative `wpm`, `accuracy`, `mode`, `duration`, `seed` from `test_results` (never trusting client-sent WPM!), and returns `{ id, url }`.
  2. Update [app/api/profile/route.ts](file:///c:/Users/rudra/TyProX/app/api/profile/route.ts):
     - Validate `{ username?, displayName?, theme?, font_family? }` with strict Zod schema (`username`: lowercase regex `^[a-z0-9_]{3,24}$`, reserved word blocklist like `admin`, `api`, `login`, `dashboard`, `null`; `displayName`: `.trim().min(1).max(50)`; `theme`: `'light' | 'dark'`; `font_family`: allowlisted font enum).
     - Return generic sanitized error messages (`409` for duplicate username, `400` for validation, `500` generic message logged server-side via `logger`).
     - Update [components/auth/username-modal.tsx](file:///c:/Users/rudra/TyProX/components/auth/username-modal.tsx) to submit via `PATCH /api/profile`.
  3. Update [app/challenge/[id]/page.tsx](file:///c:/Users/rudra/TyProX/app/challenge/%5Bid%5D/page.tsx) to filter `.gt('expires_at', new Date().toISOString())` alongside RLS enforcement.
- **Files/Components Affected:** `app/api/challenges/route.ts` (new), `app/api/profile/route.ts`, `components/typing/result-screen.tsx`, `components/auth/username-modal.tsx`, `app/challenge/[id]/page.tsx`.
- **Database Changes:** Pairs with `SEC-1.5` removing client `INSERT` policy on `challenge_links` and enforcing `expires_at` on `SELECT`. Optionally drop direct client `UPDATE` RLS on `profiles` once both Dashboard and UsernameModal route via `PATCH /api/profile` (or allow safe `UPDATE` RLS strictly on own profile while enforcing column validation in API). Keeping RLS `auth.uid() = id` + database trigger preventing unvalidated `username` format or routing all `profiles` mutations through `PATCH /api/profile` + `WITH CHECK` regex `username ~ '^[a-z0-9_]{3,30}$'` provides defense-in-depth!
- **Security Implications:** Eliminates forged 1v1 challenge WPM targets, prevents arbitrary error text leakage, enforces strict username allowlist/format.
- **Dependencies:** `SEC-1.4`, `SEC-1.5`.
- **Testing Requirements:** Vitest tests for `PATCH /api/profile` Zod validation & error masking; integration test for `POST /api/challenges` rejecting unowned `testResultId` (`403`/`404`).
- **Acceptance Criteria:** Sharing a challenge persists authoritative DB speed from verified run; invalid/short/reserved usernames rejected with `400`; expired challenge links show clean expiry screen.
- **Priority:** `High`
- **Estimated Complexity:** `M`

---

### SEC-1.7: Harden API Validation, Error Responses, Client Auth Hydration, Rate Limiting & HTTP Security Headers
- **Audit Reference:** `SEC-07`, `SEC-08`, `PA-05`, `PA-09`
- **Problem:**
  1. `GET /api/leaderboard` calls `parseInt(duration, 10)` unguarded (`?duration=abc` -> `NaN` -> DB `500`) and echoes raw `viewError.message`, `fallbackError.message`, `error.message` (`route.ts:89, 117, 140`); same raw error echo in `api/results/route.ts:198` and `api/profile/route.ts:35, 43`.
  2. Zero rate limiting exists on `POST /api/results`, `POST /api/challenges`, `PATCH /api/profile`.
  3. [components/navbar.tsx](file:///c:/Users/rudra/TyProX/components/navbar.tsx#L142) reads unvalidated `supabase.auth.getSession()` on client hydration instead of server-validated `getUser()`.
  4. [next.config.ts](file:///c:/Users/rudra/TyProX/next.config.ts) sets zero security headers (`CSP`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`).
- **Root Cause:** Missing shared API validation helpers, missing rate-limit guard, legacy `getSession()` habit, minimal `next.config.ts`.
- **Proposed Solution:**
  1. **Leaderboard Query Validation & Generic Errors:** Validate `?mode`, `?duration`, `?timeframe` cleanly with Zod in [app/api/leaderboard/route.ts](file:///c:/Users/rudra/TyProX/app/api/leaderboard/route.ts) (return `400` on invalid params instead of `NaN` crash). Mask all `500` internal Postgres error strings across `results`, `leaderboard`, and `profile` route handlers (log full error server-side only).
  2. **Rate Limiting Guard (`SEC-07`):** Implement clean rate-limiting utility [lib/security/rate-limit.ts](file:///c:/Users/rudra/TyProX/lib/security/rate-limit.ts). Recommend database/timestamp cooldown check on `POST /api/results` (e.g., check latest `test_results.created_at` for `user.id` — forbid more than 1 submission per `10s` per user, plus short sliding window via Upstash Redis if owner provisions `@upstash/ratelimit`, or fail-safe Postgres recent-count query `COUNT(*) >= 20 in last 10m`). Database-backed per-user cooldown requires **zero new paid services**! Pair with Vercel/Upstash IP limiter if deploying publicly at high scale (flag in Owner Approval section).
  3. **Standardize Client Auth Hydration on `getUser()`:** Replace `getSession()` in `Navbar` (`SEC-08`) cleanly, migrating auth lifecycle out into root `<AuthProvider>` cleanly in Batch 1/Batch 3.
  4. **Security Headers in `next.config.ts`:** Configure `headers()` setting `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and Report-Only -> Enforce `Content-Security-Policy` allowing `'self'`, Supabase HTTPS/WSS project origin (`process.env.NEXT_PUBLIC_SUPABASE_URL`), OAuth/avatar image hosts, `style-src 'self' 'unsafe-inline'` (for Framer Motion/Tailwind runtime), and `'wasm-unsafe-eval'` only if needed (verify `next/font` & Web Worker `script-src 'self' worker-src 'self' blob:` compatibility cleanly per [content-security-policy.md](file:///c:/Users/rudra/TyProX/node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md)!).
- **Files/Components Affected:** `app/api/leaderboard/route.ts`, `app/api/results/route.ts`, `app/api/profile/route.ts`, `lib/security/rate-limit.ts` (new), `components/navbar.tsx`, `next.config.ts`, `.env.example` (new).
- **Database Changes:** Ensure existing composite index `idx_test_results_created_at_desc (user_id, created_at DESC)` supports fast O(log N) per-user submission rate-limit lookup without extra schema changes.
- **Security Implications:** Stops query fuzzing `500`s, strips error reconnaissance strings, prevents spam flooding via rapid API calls, enforces valid JWT verification via Supabase Auth server, and mitigates clickjacking/XSS framing.
- **Dependencies:** `SEC-1.4`.
- **Testing Requirements:** Vitest tests for `/api/leaderboard` invalid params (`duration=abc` -> `400`) & mocked DB failure masking; rate-limit cooldown unit test; manual/Playwright verification of response security headers & zero CSP console violations on `/`, `/typing`, Web Worker, and Recharts.
- **Acceptance Criteria:** Malformed query params return `400`; internal DB errors return generic `{ error: 'Internal server error.' }` with no schema details; security headers appear on every response with zero blocked first-party assets/workers.
- **Priority:** `Medium`
- **Estimated Complexity:** `M`

---

## 3. Target RLS & Permission Matrix (Post-Phase 1)

| Table / View | `anon` SELECT | `authenticated` SELECT | Client INSERT | Client UPDATE | Client DELETE | Authoritative Write Path |
|---|---|---|---|---|---|---|
| `public.profiles` | Public fields | Public fields | Trigger (`handle_new_user`) | Own row (`username` format checked) via API recommended | None | `handle_new_user()` trigger + `PATCH /api/profile` |
| `public.test_results` | Non-invalidated user runs (`user_id IS NOT NULL AND is_invalidated = false`) | Own rows (`auth.uid() = user_id`) OR non-invalidated user runs | **Revoked** | **Revoked** | **Revoked** | `POST /api/results` (`createAdminClient`) |
| `public.replays` | **Revoked** (Phase 5 curated share API/view only) | Own replays (`test_result.user_id = auth.uid()`) | **Revoked** | **Revoked** | **Revoked** | `POST /api/results` (`createAdminClient`) |
| `public.streaks` | Public (`true`) | Public (`true`) | **Revoked** | **Revoked** | **Revoked** | `handle_new_user()` + `POST /api/results` (`createAdminClient`) |
| `public.achievements` | Public (`true`) | Public (`true`) | **Revoked** | **Revoked** | **Revoked** | Seed / Admin migrations |
| `public.user_achievements` | Public (`true`) | Public (`true`) | **Revoked** | **Revoked** | **Revoked** | `POST /api/results` (`createAdminClient`) |
| `public.challenge_links` | Non-expired (`expires_at > now()`) | Non-expired (`expires_at > now()`) | **Revoked** | **Revoked** | **Revoked** | `POST /api/challenges` (`createAdminClient`) |
| `public.daily_challenges` | Public (`true`) | Public (`true`) | **Revoked** | **Revoked** | **Revoked** | Server generator / CRON (`createAdminClient`) |
| `public.user_challenge_progress` | Public summary | Own rows (`auth.uid() = user_id`) | **Revoked** | **Revoked** | **Revoked** | `POST /api/results` (`createAdminClient`) |
| `public.leaderboard_view` | `security_invoker = true`, `is_invalidated = false AND user_id IS NOT NULL` | Same | N/A | N/A | N/A | Derived SQL View |

---

## 4. Mandatory Read-Only Production Inspection Queries (Pre-Migration)

Run these read-only queries in the live Supabase SQL Editor **before** executing any hardening migration so production divergence is 100% documented first:

```sql
-- 1. Check all existing RLS policies across public schema
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- 2. Check excessive schema grants (e.g. GRANT ALL / DELETE / TRUNCATE)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, table_name, privilege_type;

-- 3. Check view options (security_invoker) & definition of leaderboard_view
SELECT c.relname, c.reloptions, pg_get_viewdef(c.oid, true) AS view_sql
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'v';

-- 4. Check indexes, achievements seed count, & Realtime publication tables
SELECT indexname, tablename, indexdef FROM pg_indexes WHERE schemaname = 'public';
SELECT count(*) AS achievement_count FROM public.achievements;
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- 5. Inspect handle_new_user search_path & logic
SELECT pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'handle_new_user';

-- 6. Audit existing dirty/suspicious rows before hardening (READ-ONLY)
SELECT count(*) FILTER (WHERE seed = '__debug_test__') AS debug_rows,
       count(*) FILTER (WHERE user_id IS NULL) AS anon_rows,
       count(*) FILTER (WHERE wpm > 250) AS outlier_wpm_rows
FROM public.test_results;
```

