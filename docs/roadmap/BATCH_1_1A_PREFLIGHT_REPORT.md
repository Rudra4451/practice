# TyProX — Batch 1.1A Production Preflight Report

**Audit Date:** 2026-11-10  
**Batch:** `1.1A` (Read-Only Production & Environment Preflight)  
**Target Environment:** Local Workspace (`c:\Users\rudra\TyProX`) & Production Supabase Project (`gbovkejymfeiqgverzfr` per [OAUTH_SETUP.md](file:///c:/Users/rudra/TyProX/OAUTH_SETUP.md))  
**Execution Mode:** **STRICTLY READ-ONLY** — Zero SQL writes, zero migrations executed, zero historical DB rows deleted/modified, zero application files modified, zero secrets or PII printed.

---

## 1. Environment Status

### 1.1 Git Branch & Working Tree
- **Active Branch:** `main` at `fba1d80` (`[origin/main] Merge pull request #1 from Rudra4451/feature/cat-reaction-system`).
- **Tracked Files:** Clean — zero staged or modified tracked files.
- **Untracked Files:** Strictly planning/audit documentation (`docs/audit/*` [5 files] and `docs/roadmap/*` [6 files prior to this report]). Local build/typecheck caches (`.next`, `tsconfig.tsbuildinfo`) exist and remain ignored by [`.gitignore`](file:///c:/Users/rudra/TyProX/.gitignore).

### 1.2 Environment Variables & Tooling
- **Env Files Present:** Only `.env.local` (no `.env`, no `.env.production`, no `.env.example`).
- **Environment Variable Names Defined in `.env.local` (values withheld):**
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Critical Missing Environment Variables:**
  - `SUPABASE_SERVICE_ROLE_KEY`: **Not configured.** Server-side privileged writes (`createAdminClient`) required for Phase 1 score/streak/achievement/challenge hardening (`SEC-1.4` / `SEC-1.5`) cannot currently run.
  - `NEXT_PUBLIC_SITE_URL`: **Not configured.** Both [robots.ts](file:///c:/Users/rudra/TyProX/app/robots.ts#L4) and [sitemap.ts](file:///c:/Users/rudra/TyProX/app/sitemap.ts#L5) fall back to hardcoded `'https://typrox.vercel.app'`.
- **Supabase & Hosting Config:**
  - `supabase` CLI is **not installed** in the local environment.
  - No `supabase/config.toml`, `.supabase/`, `.vercel/`, or `.github/` directories exist in the workspace.
  - Supabase project ref `gbovkejymfeiqgverzfr` is documented externally in [OAUTH_SETUP.md](file:///c:/Users/rudra/TyProX/OAUTH_SETUP.md#L3).
- **Local SQL Migrations & Snapshots (`supabase/migrations/`):**
  1. [20260618000000_init_schema.sql](file:///c:/Users/rudra/TyProX/supabase/migrations/20260618000000_init_schema.sql) (created `4cd8230`, amended `ee80fbc`)
  2. [20260619000000_audit_hardening.sql](file:///c:/Users/rudra/TyProX/supabase/migrations/20260619000000_audit_hardening.sql) (created `4cd8230`)
  3. [20260620100000_leaderboard_view.sql](file:///c:/Users/rudra/TyProX/supabase/migrations/20260620100000_leaderboard_view.sql) (created `f717482`)
  4. [FULL_SCHEMA.sql](file:///c:/Users/rudra/TyProX/supabase/migrations/FULL_SCHEMA.sql) (consolidated SQL Editor script created `587e966`, amended `ee112d9`, `f717482`, `ee80fbc`)
- **Database Type Definitions:** **None.** Neither `types/database.ts` nor generated Supabase `Database` types exist anywhere in the repository; queries rely on manual interfaces or untyped `any`.
- **Automated Test Tooling:** **None.** [package.json](file:///c:/Users/rudra/TyProX/package.json#L5-L34) defines only `dev`, `build`, `start`, and `lint`; no Vitest, Jest, or Playwright packages exist.

### 1.3 Typecheck, Build & Lint Baseline
| Check | Command | Outcome | Key Details |
|---|---|---|---|
| TypeScript | `npx tsc --noEmit --incremental false` | **PASS** (`exit 0`) | Strict typecheck compiles cleanly (`next-env.d.ts` + app sources). |
| Production Build | `npm run build` | **PASS** (`exit 0`) | Next.js `16.2.9` (Turbopack) compiled `20/20` routes cleanly. Active dynamic (`ƒ`) routes include `/api/debug/supabase`, `/api/test-supabase`, `/auth/callback`, `/api/leaderboard`, `/api/profile`, `/api/results`, `/api/auth/signout`, `/challenge/[id]`, `/u/[username]`. |
| ESLint | `npm run lint` | **FAIL** (`exit 1`) | **`111` problems (`55` errors, `56` warnings)** — `@typescript-eslint/no-explicit-any`, `react-hooks/set-state-in-effect`, `react/no-unescaped-entities`, `react-hooks/immutability`, `react-hooks/purity`, and unused imports/variables. |

---

## 2. Production Database Findings

> **Access Boundary Note:** Local workspace holds only the public `NEXT_PUBLIC_SUPABASE_ANON_KEY` (no `SUPABASE_SERVICE_ROLE_KEY`, no Postgres URI, no `supabase` CLI link). Live production findings below are split strictly between **empirically verified `anon` PostgREST reads** and **unverified Postgres catalog state** requiring owner SQL Editor execution.

### 2.1 Verified Live Production State (via Read-Only `anon` PostgREST Probes)

| Relation | `anon` `SELECT` | Live Row Count | Observed Production Facts (Non-PII) |
|---|---|---|---|
| `public.profiles` | Accessible (`true`) | `16` | `15` of `16` rows retain default `^user_[0-9a-f]{8}$` handles; all `16` have `theme = 'dark'`, `font_family = 'ibm-plex-mono'`. |
| `public.test_results` | Accessible (`true`) | `170` | `10` distinct non-null `user_id`s; `6` rows have `user_id IS NULL` (all `__debug_test__`); `0` rows have `is_invalidated = true`; `maxWpm = 94`; `maxRawWpm = 226`; distinct `mode` = `words`, `quotes`, `punctuation`, `code`, `numbers`; distinct `duration` = `1`, `15`, `30`, `120` (no `60s` rows present). |
| `public.replays` | Accessible (`true`) | `164` | Matches `170 - 6 = 164` non-debug test runs; `samplePayloadNonEmpty = true` (full keystroke timing telemetry JSONB is publicly readable via `anon`). |
| `public.streaks` | Accessible (`true`) | `16` | `10` of `16` rows have `current_streak = 0` — **including `4` of the `10` users who have submitted `test_results`**; `maxCurrentStreak = 2`; `maxLongestStreak = 2`; `0` null `last_active_date`; `0` future dates. |
| `public.achievements` | Accessible (`true`) | `11` | **11 seeded achievement codes** (`SPEED_50`, `SPEED_75`, `SPEED_80`, `SPEED_100`, `SPEED_120`, `SPEED_140`, `SPEED_150`, `STREAK_3`, `STREAK_7`, `STREAK_14`, `STREAK_30`). |
| `public.user_achievements` | Accessible (`true`) | `4` | Readable to `anon`; `4` unlocked entries across active users. |
| `public.daily_challenges` | Accessible (`true`) | `0` | Empty (`0` seeded challenges). |
| `public.challenge_links` | Accessible (`true`) | `0` | Empty (`0` active or expired lobbies). |
| `public.user_challenge_progress` | Accessible (`true`) | `0` | Empty (`0` completion records). |
| `public.leaderboard_view` | **MISSING (`PGRST205`)** | N/A | Query returned **`PGRST205`: `"Could not find the table 'public.leaderboard_view' in the schema cache"`**. |

**Key Empirical Production Discoveries:**
1. **Live Production Lacks `public.leaderboard_view`:** Consequently, [`GET /api/leaderboard`](file:///c:/Users/rudra/TyProX/app/api/leaderboard/route.ts#L81-L136) is **currently executing its in-memory `isRelationMissing` fallback on every production request**, pulling up to 500 `test_results` rows directly instead of querying `leaderboard_view`.
2. **Production `public.achievements` Differs from Both Local Migrations and `FULL_SCHEMA.sql`:**
   - Production contains custom titles/thresholds (`"Bronze Fingers"` at `50 WPM / 90%`, `"Silver Fingers"` at `80 WPM / 92%`, `"Gold Fingers"` at `100 WPM / 95%`, `"Platinum Fingers"` at `120 WPM / 96%`, `"Grandmaster Typist"` at `140 WPM / 97%`, `"Fingers of Fire"` at `150 WPM / 97%`, `"Consistency Start"` `3d`, `"Weekly Habit"` `7d`, `"Fortnight Dedication"` `14d`, `"Typing Legend"` `30d`, `"Swift Fingers"` `75 WPM / 93%`).
   - This proves the production database received **manual SQL Editor edits out-of-band** outside committed Git SQL files.
3. **Confirmed Historical `anon` Write Execution + Failed Cleanup:** The `6` `seed = '__debug_test__'` (`user_id = NULL`, `duration = 1`) rows inserted on `2026-06-19T08:32Z`–`15:41Z` prove that [`GET /api/debug/supabase`](file:///c:/Users/rudra/TyProX/app/api/debug/supabase/route.ts#L96-L122) successfully inserted anonymous rows into `test_results`, while `.delete()` silently failed because `test_results` lacks a `DELETE` RLS policy.
4. **Confirmed Day-1 Streak Defect in Production Data:** `4` of the `10` active users who recorded `test_results` remain stuck at `current_streak = 0` (`streaks.last_active_date` defaults to `CURRENT_DATE` on signup, causing Day-1 `POST /api/results` `if (lastActive !== today)` to skip initialization).

### 2.2 UNVERIFIED Production Catalog & Platform Properties

Because `pg_catalog` and `information_schema` cannot be queried with `anon`, the following remain **UNVERIFIED** until the owner executes the read-only inspection queries from [SECURITY_REMEDIATION_PLAN.md Section 4](file:///c:/Users/rudra/TyProX/docs/roadmap/SECURITY_REMEDIATION_PLAN.md#L250-L290) inside Supabase Dashboard SQL Editor:

| Unverified Item | Inspection Query / Dashboard Location | Why It Matters Before Batch 1.3 |
|---|---|---|
| Exact `pg_policies` names & expressions (`qual` / `with_check`) | `SELECT ... FROM pg_policies WHERE schemaname = 'public'` | Must know whether `20260619` (`"Anyone can insert challenge links"`), `FULL_SCHEMA.sql` (`"Authenticated users can create challenge links"`, `"Trigger can insert streaks"`), or `ee80fbc` (`"Users can insert their own profiles"`) are currently applied. |
| Role grants (`anon`, `authenticated`) on tables/sequences/functions | `information_schema.role_table_grants` | Verifies whether `FULL_SCHEMA.sql` Section 8 (`GRANT ALL`) ran in prod. |
| Active indexes (`pg_indexes`) | `SELECT indexname, tablename, indexdef FROM pg_indexes` | Verifies whether `idx_test_results_leaderboard` exists cleanly. |
| `public.handle_new_user()` trigger DDL | `pg_get_functiondef` | Verifies whether `SET search_path` is missing and explains why `15/16` profiles retained `user_<hex>`. |
| `supabase_realtime` publication membership | `pg_publication_tables` | Verifies whether `public.test_results` is published to Realtime in prod (`ee112d9`). |
| Column nullability / defaults (`streaks.last_active_date`, constraints) | `information_schema.columns` / `table_constraints` | Prevents DDL errors when altering `streaks` or adding `client_run_id`. |
| Auth Redirect URLs, OAuth settings, OTP limits | Supabase Dashboard -> Auth -> URL Config / Providers | Needed to verify callback allowlists and rate limits. |
| Supabase Backup / PITR Status | Supabase Dashboard -> Database -> Backups | Must confirm recovery capability before any schema or data change. |

---

## 3. Migration Divergence

Comparison across all four schema states reveals severe drift between ordered migrations, `FULL_SCHEMA.sql`, the planned target architecture, and live production:

| Object / Feature | Ordered Migrations (`20260618`–`20260620`) | Snapshot ([`FULL_SCHEMA.sql`](file:///c:/Users/rudra/TyProX/supabase/migrations/FULL_SCHEMA.sql)) | Target Hardened State ([`SECURITY_REMEDIATION_PLAN.md`](file:///c:/Users/rudra/TyProX/docs/roadmap/SECURITY_REMEDIATION_PLAN.md)) | Observed Production DB (`gbovkejymfeiqgverzfr`) |
|---|---|---|---|---|
| **Base 9 Tables** | Created in `20260618` | `CREATE TABLE IF NOT EXISTS` | Base 9 + `client_run_id UUID UNIQUE`, nullable `streaks.last_active_date` | **Verified Present** (`anon` reads succeed on all 9) |
| **`public.leaderboard_view`** | Created in `20260620` (no `security_invoker`, no `user_id IS NOT NULL`) | Section 10 (identical to `20260620`) | `WITH (security_invoker = true)` + `WHERE is_invalidated = false AND user_id IS NOT NULL` | **DOES NOT EXIST (`PGRST205`)** — `GET /api/leaderboard` uses fallback |
| **`public.achievements` Seed** | **0 rows** (no `INSERT` statements) | **8 rows** (`Keyboard Apprentice`, `Speed Demon`, `Typing Master`, `Warming Up`, `Daily Warrior`, `Monthly Champion`, etc.) | Must reconcile & preserve production badges cleanly | **11 rows** (adds `SPEED_80`, `SPEED_150`, `STREAK_14`; custom `"* Fingers"` names) |
| **`profiles` `INSERT` Policy** | Added in `ee80fbc` (`"Users can insert their own profiles"`) | Present (`lines 148-150`) | Retained or managed strictly via trigger / API | **UNVERIFIED** (note `Navbar.ensureProfileExists` assumes client fallback exists) |
| **`challenge_links` `INSERT` Policy** | `"Anyone can insert challenge links"` (`20260619:22-25`) | `"Authenticated users can create challenge links"` (`line 202-205`, still permits `auth.uid() IS NULL`) | **Revoked** (`POST /api/challenges` via `createAdminClient()`) | **UNVERIFIED** |
| **`streaks` `INSERT` / `UPDATE` Policies** | `UPDATE` only (`20260618:145`); **no `INSERT` policy** | `UPDATE` + `"Trigger can insert streaks"` (`WITH CHECK (auth.uid() = user_id)`) | **Both Revoked** (`handle_new_user()` + `POST /api/results` admin client) | **UNVERIFIED** |
| **`user_achievements` `INSERT` Policy** | Added in `20260619:29-31` (`auth.uid() = user_id`) | Present (`lines 225-228`) | **Revoked** (`POST /api/results` admin client) | **UNVERIFIED** |
| **Role Grants (`GRANT ALL`)** | Default Supabase privileges only (plus `GRANT SELECT ON leaderboard_view`) | **`GRANT ALL ON ALL TABLES/SEQUENCES/FUNCTIONS TO anon, authenticated`** (`lines 292-295`) | `REVOKE ALL`, grant `USAGE` + least-privilege `SELECT` / scoped updates only | **UNVERIFIED** |
| **`idx_test_results_leaderboard`** | **Missing** | Present (`line 236`) | Required index present | **UNVERIFIED** |
| **`supabase_realtime` (`test_results`)** | **Missing** | Present (`lines 302-313`) | Keep `test_results` cleanly; fix unfiltered `replays` Realtime client listener | **UNVERIFIED** |

> **Roadmap Correction Identified by Preflight:** Both `SECURITY_REMEDIATION_PLAN.md` and `MASTER_ROADMAP.md` were authored before live probing and assumed either `8` achievement rows (`FULL_SCHEMA.sql`) or uncertainty on `leaderboard_view`. Live preflight establishes that **`leaderboard_view` is absent in production** and **`public.achievements` has 11 diverged production definitions** that future migrations (`Batch 1.3`) MUST preserve (`ON CONFLICT (code) DO NOTHING` or explicit 11-row sync) rather than overwriting.

---

## 4. Security Findings

### 4.1 Verified Application & Schema Security Exposures
1. **Production `anon` Database Exposure & Historical `NULL` Insert Proof (`SEC-02`, `SEC-06`):**
   - With only `NEXT_PUBLIC_SUPABASE_ANON_KEY`, an unauthenticated client can read all `170` `test_results` rows, all `164` full-keystroke `replays` JSONB arrays, all `16` `profiles` & `streaks` rows, and `user_achievements`.
   - The `6` `__debug_test__` rows (`user_id = NULL`) confirm `test_results` has accepted unauthenticated anonymous writes (`auth.uid() IS NULL`).
   - Direct `GRANT ALL` and permissive self-update/insert policies (`streaks`, `user_achievements`, `challenge_links`, `test_results`) cannot be ruled out without the Section 4 catalog query, and code across [`app/dashboard/page.tsx`](file:///c:/Users/rudra/TyProX/app/dashboard/page.tsx#L327), [`components/typing/result-screen.tsx`](file:///c:/Users/rudra/TyProX/components/typing/result-screen.tsx#L116), and [`components/auth/username-modal.tsx`](file:///c:/Users/rudra/TyProX/components/auth/username-modal.tsx#L88) actively performs direct browser-SDK writes.
2. **Service Role Absence (`SUPABASE_SERVICE_ROLE_KEY`):**
   - Without `SUPABASE_SERVICE_ROLE_KEY`, the backend in [`app/api/results/route.ts`](file:///c:/Users/rudra/TyProX/app/api/results/route.ts#L77-L188) runs strictly under the caller's SSR cookie session subject to RLS — preventing immediate removal of client `INSERT`/`UPDATE` policies until `SUPABASE_SERVICE_ROLE_KEY` is provisioned.
3. **`leaderboard_view` Security & Fallback Behavior (`SEC-02`, `SEC-07`):**
   - `public.leaderboard_view` is absent in prod (`PGRST205`).
   - Current [`app/api/leaderboard/route.ts`](file:///c:/Users/rudra/TyProX/app/api/leaderboard/route.ts#L8-L141) fallback does **not** filter `.not('user_id', 'is', null)` (instead grouping `user_id || 'anonymous'`), parses `?duration=` with unguarded `parseInt` (`NaN` -> DB error `500`), and echoes raw Postgres `viewError.message` / `fallbackError.message`.
4. **Unverified Score Submission Pathway (`SEC-01`, `PA-01`, `PA-07`):**
   - [`POST /api/results`](file:///c:/Users/rudra/TyProX/app/api/results/route.ts#L25-L196) trusts client `wpm`, `rawWpm`, `accuracy`, `consistency`, `errorCount`, and `backspaceCount`; bypasses regularity checks whenever `telemetry.length <= 10`; never checks typed keys `k` against `generateText(seed, mode, duration)`; lacks `client_run_id` idempotency; and exhibits the Day-1 streak bug.
5. **Active Debug/Test Endpoints in Production Build (`SEC-04`):**
   - [`GET /api/debug/supabase`](file:///c:/Users/rudra/TyProX/app/api/debug/supabase/route.ts#L4-L132) and [`GET /api/test-supabase`](file:///c:/Users/rudra/TyProX/app/api/test-supabase/route.ts#L4-L55) remain compiled as active dynamic (`ƒ`) routes in `next build`, exposing environment info, table counts, user identity/email (if cookie present), error details, and an active `__debug_test__` DB write leak.
6. **OAuth Callback Open Redirect (`SEC-03`):**
   - [`app/auth/callback/route.ts`](file:///c:/Users/rudra/TyProX/app/auth/callback/route.ts#L7-L14) passes unvalidated `?next=` straight into `new URL(next, request.url)`, enabling off-origin redirects (e.g., `?next=https://evil.example` or `?next=//evil.example`).
7. **Demo Auth & Data Bypasses (`SEC-05`, `TD-04`):**
   - [`lib/supabase/middleware.ts`](file:///c:/Users/rudra/TyProX/lib/supabase/middleware.ts#L48-L54) skips `/login` redirect whenever `typrox_demo_logged_in=true` cookie or `?demo=true` query param is sent.
   - [`GET /api/leaderboard`](file:///c:/Users/rudra/TyProX/app/api/leaderboard/route.ts#L13-L54) returns fabricated rankings whenever `?demo` is present (even `?demo=false`), and demo flags remain embedded in [`Navbar`](file:///c:/Users/rudra/TyProX/components/navbar.tsx#L72-L81), [`LoginPage`](file:///c:/Users/rudra/TyProX/app/login/page.tsx#L46-L100), [`DashboardPage`](file:///c:/Users/rudra/TyProX/app/dashboard/page.tsx#L63), [`PerformanceLabPage`](file:///c:/Users/rudra/TyProX/app/dashboard/performance-lab/page.tsx#L52), [`LeaderboardPage`](file:///c:/Users/rudra/TyProX/app/leaderboard/page.tsx#L49), and [`TypingContainer`](file:///c:/Users/rudra/TyProX/components/typing/typing-container.tsx#L143-L146).

---

### 4.2 Suspicious Historical Records Report (Read-Only Inventory — Untouched)

> **Preservation Notice:** Zero production records were modified, flagged (`is_invalidated`), or deleted during Batch 1.1A. All findings below were observed non-destructively via read-only inspection across the `170` rows in `public.test_results` and their `164` joined `public.replays` payloads.

Out of `170` `test_results` rows, **`34` rows triggered heuristic quality/integrity flags** and **`15` duplicate submission signatures accounted for `34` rows (`19` excess duplicate entries out of `164` non-debug runs = `11.6%` duplicate rate)**:

#### Category A — Unauthenticated Diagnostic Pollution (`6` rows)
All `6` rows have `seed = '__debug_test__'`, `user_id = NULL`, `duration = 1`, `mode = 'words'`, `wpm = 0`, `raw_wpm = 0`, `accuracy = 0`, `consistency = 0`, `is_invalidated = false`, and **no matching row in `replays`**, matching [`app/api/debug/supabase/route.ts#L96-L122`](file:///c:/Users/rudra/TyProX/app/api/debug/supabase/route.ts#L96-L122):
- `c8f103df-3ff0-4e1c-bffa-6e86d0ae8982` (`2026-06-19T15:41:22.538924+00:00`)
- `a7c72688-36f8-4acd-9c45-0c4cda2d926c` (`2026-06-19T15:41:06.861942+00:00`)
- `0544bc81-ac48-46d8-93b8-6f2f8fc3c704` (`2026-06-19T15:40:55.111499+00:00`)
- `da41e550-cdb3-458f-8222-2b7d81d90dbe` (`2026-06-19T09:04:26.917889+00:00`)
- `b0a49e00-4a25-4f6f-84be-025467a088e3` (`2026-06-19T09:02:45.957385+00:00`)
- `d324c335-2ca1-4ecc-8b3d-547df63c86e5` (`2026-06-19T08:32:58.298934+00:00`)

#### Category B — Elapsed-Time `200` Raw-WPM 1-Keystroke Artifact (`1` row)
Empirically confirms audit finding `PA-01` (`lastKeystrokeTime - startTime` clamped to `500ms` floor on countdown tests):
- `260ffffc-fcee-4e38-9c69-4b631587a59d` (`2026-07-22T13:38:43.312904+00:00`, `hasUserId = true`): `mode = 'words'`, `duration = 30`, `seed = 'j5fo8k'`, **`wpm = 0`**, **`raw_wpm = 200`**, `accuracy = 0`, `consistency = 100`, `error_count = 1`, replay has **`eventCount = 1`, `spanMs = 0`**.

#### Category C — Extreme High-Raw Error-Spam Duplicates (`2` rows)
Identical run stored twice (`82s` apart) with `raw_wpm = 226` (production peak `raw_wpm`) at `4%` accuracy and `543` uncorrected errors across `565` events in `29,987ms`:
- `875a89f8-506c-4e8b-ac58-8b626ba4df3d` (`2026-07-21T14:29:47.84503+00:00`, `seed = 'qz59z4'`, `words`, `30s`, `wpm = 9`, `raw_wpm = 226`, `accuracy = 4`, `error_count = 543`)
- `594a6494-d7f4-45d6-ad52-9403fff7742d` (`2026-07-21T14:28:25.333515+00:00`, `seed = 'qz59z4'`, identical signature)

#### Category D — Sub-Second Tiny Telemetry Claiming `30s` Duration (`2` rows)
Identical `3`-keystroke payload (`spanMs = 541ms`, `stdDevMs = 111.5ms`) persisted twice (`9s` apart) as a `30s` `words` test:
- `171f4a1a-b5d0-4aca-a3bd-09d0bfcc3282` (`2026-09-11T08:09:27.703387+00:00`, `seed = 'sgkvq'`, `wpm = 44`, `raw_wpm = 67`, `accuracy = 67`, `error_count = 1`)
- `c054ccfe-9480-4d09-b5a2-2cff40720f32` (`2026-09-11T08:09:18.624554+00:00`, `seed = 'sgkvq'`, identical signature)

#### Category E — Short-Span Early Completions (`spanMs < duration * 500`, `>= 10` events: `23` rows)
- **`quotes` Mode (`17` rows — `1` on `duration = 120`, `16` on `duration = 30`):** Single short quotes terminated early while recorded under `duration = 30` or `120`, validating audit finding `PA-05`:
  - Fastest outlier (also highest `wpm` in production): `e23c78dc-f20e-481a-afcd-52175f976c67` (`2026-07-05T19:10:23.874326+00:00`, `quotes`, `duration = 30`, `seed = 'dv1ji'`, `wpm = 94`, `raw_wpm = 97`, `accuracy = 97`, `32` events in **`3,974ms`**).
  - `120s` mismatch: `0ea2b87c-be91-49fa-a909-f90c149d0049` (`2026-08-30T15:23:46.430911+00:00`, `quotes`, `duration = 120`, `seed = 'rfmk3l'`, `wpm = 33`, `accuracy = 100`, `75` events in **`26,931ms`**).
  - Remaining `15` `quotes` `30s` short-span runs (`4.47s`–`14.21s`, all on `2026-07-05T19:09Z–19:13Z`): `b302f793-b028-4cf7-b64f-871154734678`, `00a88959-566d-4716-98d7-97c760d8e6b4`, `00e108ca-eacf-4565-a8ac-4cd330f72da3`, `824d21fa-1bc8-4f0a-80ff-55897a7a7791`, `08722614-a61e-4129-a758-3cd31d837a6a`, `4529f817-2676-4d2f-975a-553e618d0c8e`, `258ccf5c-cc92-417b-a62a-53de9c658f29`, `eea6bc1f-6a49-469f-b501-ee733011c672`, `95481118-6d86-45dd-b2cb-b8b3a33acfcd`, `d090991c-00a2-4592-aa48-dc729ca5f22b`, `29043b59-d3e9-4fb0-bd22-cf423f322a23`, `a8c5db6f-1b79-4792-ba70-20e49cd10774`, `a1fc394b-3151-4f64-8ac3-53e780e0db00`, `b3110e67-d772-406a-8d27-c9c8f7014a10`, `08e55355-0e65-401d-973e-1245f2b84a96`.
- **`words` / `punctuation` Short-Span Runs (`6` rows on `duration = 30`, `10.63s`–`14.69s`):**
  - `a79c2177-b62a-4995-9a1b-a48cd5e8f650` (`words`, `13,142ms`, `wpm = 35`)
  - `3bb0cdad-9e0a-461b-a445-07de2412788a` (`punctuation`, `13,493ms`, `wpm = 22`)
  - `b0ef8455-06a8-4770-af2b-51b4ac33988d` (`punctuation`, `13,493ms`, `wpm = 22`, duplicate of above)
  - `e32a645e-34f8-4c9d-b051-704eb32bec41` (`words`, `14,690ms`, `wpm = 42`, `backspace_count = 15`)
  - `91cc49c2-95e6-4c09-a4d1-bb942d679419` (`words`, `11,871ms`, `wpm = 12`, `backspace_count = 11`)
  - `f8b9bdb6-9a64-4918-97a0-e8a0b3d90db6` (`words`, `10,633ms`, `wpm = 17`, `raw_wpm = 138`, `accuracy = 12`, `error_count = 107`)

#### Category F — Duplicate Score Submissions (`15` Groups, `34` Total Rows / `19` Redundant Copies)
Empirically confirms `PA-07` (`ResultScreen` missing idempotency key / duplicate effect & guest-sync retries). All groups share identical `(seed, mode, duration, wpm, raw_wpm, error_count, backspace_count)` inserted seconds or minutes apart:

| Signature (`seed\|mode\|duration\|wpm\|raw\|err\|bs`) | Copies | `test_results.id` Rows |
|---|---|---|
| `sgkvq\|words\|30\|44\|67\|1\|0` | `2` | `171f4a1a-b5d0-4aca-a3bd-09d0bfcc3282`, `c054ccfe-9480-4d09-b5a2-2cff40720f32` (`2026-09-11`) |
| `61mbzu\|words\|30\|29\|33\|10\|0` | `3` | `e1dc67d6-d931-4c30-868e-5b6795fe7910`, `335afdd5-f627-4922-b72b-e7a0949a909c`, `cf347d4b-48cb-4e19-8f26-b186b754467c` (`2026-09-03`) |
| `0oafg4\|punctuation\|30\|22\|22\|0\|0` | `2` | `3bb0cdad-9e0a-461b-a445-07de2412788a`, `b0ef8455-06a8-4770-af2b-51b4ac33988d` (`2026-08-30`) |
| `blrp0d\|words\|30\|60\|60\|0\|11` | `2` | `5278ac1f-3df0-49ee-aab4-d32411e4b252`, `d58dd1ff-3396-48ff-9cf8-7266bd4b3df3` (`2026-08-20`) |
| `uc91i\|words\|30\|31\|33\|7\|1` | `2` | `a1b198a9-024d-429a-92e3-a4829ea6fb2c`, `b2fab655-d0b8-49a8-8a74-006ab82cf2f7` (`2026-08-16`) |
| `n9o68f\|words\|30\|30\|30\|0\|7` | `3` | `627967a6-f386-4d57-a212-2d5d2411d263`, `210bb499-1af6-4e8d-bd1a-04db7a778d68`, `ecb859d4-afbb-4cfe-8538-0096aec24c93` (`2026-08-06`) |
| `q0bu5\|words\|30\|34\|34\|0\|0` | `2` | `2312d4da-0518-4271-9547-c326fc32ca99`, `5f0ec7b3-be20-471b-8835-0b22540a28bf` (`2026-08-05`) |
| `9t737d\|words\|30\|31\|31\|0\|4` | `2` | `1dc5a264-7682-4efe-97df-8bf095cbe2be`, `7fff29e0-9ad7-4080-8d93-d75a7ab2ac73` (`2026-08-05`) |
| `45w09\|words\|30\|18\|18\|0\|0` | `2` | `c96af8fe-4d61-4321-bbe9-0b8ccf4bf994`, `3e8475b1-c96b-4c6a-90c0-6d1666da0eb1` (`2026-07-21`) |
| `qz59z4\|words\|30\|9\|226\|543\|0` | `2` | `875a89f8-506c-4e8b-ac58-8b626ba4df3d`, `594a6494-d7f4-45d6-ad52-9403fff7742d` (`2026-07-21`) |
| `08w9zn\|words\|30\|36\|36\|0\|0` | `3` | `9ce57c71-6b6c-4865-a3d5-bad72f31c757`, `06a9a3b3-2d56-41a7-b251-06101930a00a`, `a8c6fd2e-c385-4708-ae38-0369bc4443d0` (`2026-07-07`) |
| `03qo5e\|words\|30\|64\|64\|2\|23` | `2` | `3dabe8ae-fe7d-4fb0-8f5e-8d4b683d0d42`, `13961292-90e6-4023-98f9-7026d1fde6f3` (`2026-07-01`) |
| `dgdq3\|words\|30\|24\|24\|0\|11` | `2` | `857ae89b-b806-4e27-ac35-02e965beb8d8`, `ff3197c9-9565-4b31-9017-5c723a5b66b9` (`2026-06-27`) |
| `ai2pnh\|words\|30\|71\|72\|2\|16` | `2` | `02dad66a-64c6-4523-b9c4-303fd9072985`, `8ecc716a-0e07-4c08-b966-17a5ad909f10` (`2026-06-20`) |
| `cskcm\|words\|30\|32\|34\|4\|1` | `3` | `4dd9f47e-3478-40b2-8bc2-db882352c2ac`, `97a0c4e9-3031-467d-92fb-b981bc97257c`, `cc373d6e-697a-4272-9b39-33d6d9e1fb03` (`2026-06-20`) |

---

## 5. Backup Status

- **Verified Production Backup Exists?** **NO / UNVERIFIED.**
- **Repository Evidence:** Zero backup scripts, zero scheduled `pg_dump` workflows, zero recovery runbooks, and zero down/reverse SQL migration scripts exist anywhere in the codebase or git history.
- **External Platform Status:** Supabase Dashboard backup tier (automated daily backups / Point-in-Time Recovery / manual logical dump) is **unverified** and cannot be assumed to exist (especially on Supabase Free tier projects, which exclude PITR and automated backups).
- **Safe Rollback Posture:**
  - Pure Next.js application changes (e.g., Batch 1.1B) are safely reversible via `git revert` without database impact.
  - Database DDL migrations (`Batch 1.3`) and historical row cleanup (`__debug_test__` / invalidation) **cannot be safely rolled back** without first:
    1. Exporting a verified logical backup / SQL snapshot of production (`pg_dump` or Supabase Dashboard backup).
    2. Capturing exact current `pg_policies` and `role_table_grants` definitions via the read-only catalog queries in [SECURITY_REMEDIATION_PLAN.md Section 4](file:///c:/Users/rudra/TyProX/docs/roadmap/SECURITY_REMEDIATION_PLAN.md#L254-L290) so a reverse-grant/policy restoration SQL script can be drafted before DDL execution.

---

## 6. Unresolved Risks

1. **Unverified Live RLS Policies, Grants, Indexes, Functions & Realtime Publication:** Executing forward RLS/grant DDL without first reading `pg_policies`, `information_schema.role_table_grants`, `pg_indexes`, `handle_new_user()`, and `pg_publication_tables` from live production risks policy-name collisions or unintentionally breaking live queries (`Navbar`, `Dashboard`, `PerformanceLabPage`).
2. **Production `public.achievements` Divergence (`11` Rows vs Snapshot `8`):** Any migration that assumes `FULL_SCHEMA.sql`'s 8 rows will fail to sync or conflict with production's custom 11 achievement codes (`SPEED_80`, `SPEED_150`, `STREAK_14`) and `4` existing `user_achievements` records. Batch 1.3 SQL must preserve and align with the live 11-badge catalog.
3. **Production Missing `public.leaderboard_view` (`PGRST205`):** Any refactor of [`app/api/leaderboard/route.ts`](file:///c:/Users/rudra/TyProX/app/api/leaderboard/route.ts) in Batch 1.1B that removes the `isRelationMissing` fallback before `leaderboard_view` is created in production will immediately break `/leaderboard` (`500`).
4. **Missing `SUPABASE_SERVICE_ROLE_KEY`:** Server-side score/streak/achievement/challenge persistence (`Batch 1.2` / `Batch 1.3`) is blocked until the owner provisions `SUPABASE_SERVICE_ROLE_KEY` in hosting secrets and `.env.local`.
5. **Unconfirmed Backup Prior to Historical Cleanup / Migration:** Without a confirmed backup snapshot, deleting `6` `__debug_test__` rows or altering `test_results` / `streaks` constraints carries unrecoverable data-loss risk if a predicate mistakes data.
6. **Legacy Unverified Client Pathways & Historical User State:**
   - `15/16` profiles have auto-generated `user_<hex>` usernames; `4/10` active typists still show `current_streak = 0`.
   - [`handleSyncHistory`](file:///c:/Users/rudra/TyProX/app/dashboard/page.tsx#L327) and [`handleShare`](file:///c:/Users/rudra/TyProX/components/typing/result-screen.tsx#L116) write directly to Supabase from the browser; `localStorage` guest runs lack `telemetry`. Revoking client write RLS cleanly requires deploying server endpoints (`Batch 1.2` / `1.3`) *before* dropping policies.
7. **Baseline Lint Debt (`111` Findings):** While `tsc` and `next build` pass cleanly, `npm run lint` fails (`55` errors, `56` warnings). Batch 1.1B should keep newly added/edited files lint-clean, deferring repo-wide lint cleanup to Phase 3 (`Batch 3.1`).

---

## 7. Readiness Assessment: Whether Batch 1.1B Is Safe to Begin

### Verdict: **CONDITIONAL GO — Batch 1.1B (App-Only Security Quick Wins & Vitest Bootstrap) IS SAFE TO BEGIN; Batch 1.2 & Batch 1.3 REMAIN BLOCKED.**

#### Safe Now — Batch 1.1B (`SEC-1.1`, `SEC-1.2`, `SEC-1.3`, `ENG-3.5` Vitest Bootstrap)
- **Why Safe:** Batch 1.1B touches **zero** database schema, zero RLS policies, zero production rows, and requires **zero** `SUPABASE_SERVICE_ROLE_KEY`. Removing `/api/debug/supabase` immediately eliminates the unauthenticated `__debug_test__` DB write leak in production.
- **Mandatory Guardrails for Batch 1.1B:**
  1. **Preserve `PGRST205` Fallback in `app/api/leaderboard/route.ts`:** Keep the `isRelationMissing` fallback query to `test_results` (filtering out `user_id IS NULL` safely) because `public.leaderboard_view` does not exist in live production yet.
  2. **No Demo Auth/Data Bypasses:** Any manual dev/test flows that relied on `?demo=true` must switch to an actual authenticated test user session.
  3. **No DB Mutations Included:** Keep Batch 1.1B strictly limited to Next.js routes/components/middleware + Vitest unit tests.

#### Blocked Until Owner Gate Completes — Batch 1.2 & Batch 1.3
Do **not** start DB schema hardening, RLS revocation, or `POST /api/results` service-role writes until the project owner completes these prerequisites:
1. Run the **read-only catalog queries** in [SECURITY_REMEDIATION_PLAN.md Section 4](file:///c:/Users/rudra/TyProX/docs/roadmap/SECURITY_REMEDIATION_PLAN.md#L254-L290) inside Supabase Dashboard SQL Editor (`gbovkejymfeiqgverzfr`) and verify live `pg_policies`, `role_table_grants`, `pg_indexes`, `handle_new_user()`, and `supabase_realtime`.
2. Confirm a **verified production backup / snapshot** exists (or take a manual export) before any DDL migration or historical cleanup (`__debug_test__` / invalidation / deduplication review).
3. Confirm **`SUPABASE_SERVICE_ROLE_KEY`** provisioning in `.env.local` and hosting environment variables (never pasted into chat).

---

*Awaiting owner review and explicit approval before beginning **Batch 1.1B**.*

