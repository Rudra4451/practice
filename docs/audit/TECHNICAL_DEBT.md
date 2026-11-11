# TyProX — Technical Debt Register

**Audit Date:** 2026-11-10  
**Scope:** Static analysis (`npx tsc --noEmit`, `npm run lint`), build output (`npm run build`), schema migrations, component/store architecture, dead artifacts, and maintainability across all 75 tracked files.

---

## 1. Static Verification & Code Hygiene Summary

| Check | Command | Result | Key Metrics |
|---|---|---|---|
| **TypeScript Typecheck** | `npx tsc --noEmit` | Passed (`exit 0`) | 0 type errors, but masked by 26 explicit `any` annotations |
| **ESLint (`eslint-config-next`)** | `npm run lint` | **Failed (`exit 1`)** | **111 problems (55 errors, 56 warnings)** |
| **Production Build** | `npm run build` | Passed (`exit 0`) | Next.js 16.2.9 Turbopack; 20 routes; 1.91 MB static chunks |
| **Automated Test Suite** | Repository scan (`*test*`/`*spec*`) | **None Present** | **0 unit, integration, or E2E tests** |

### ESLint Error & Warning Distribution (Verified Output from `npm run lint`)
- **26 × `@typescript-eslint/no-explicit-any` (errors):** `app/api/auth/signout/route.ts` (`20:17`), `app/api/debug/supabase/route.ts` (`5:37`, `125:17`), `app/api/leaderboard/route.ts` (`122:29`, `138:19`), `app/api/profile/route.ts` (`42:17`), `app/api/results/route.ts` (`197:17`), `app/api/test-supabase/route.ts` (`48:17`), `app/dashboard/page.tsx` (`24:42`, `25:38`, `166:18`, `167:27`, `260:19`), `app/dashboard/performance-lab/page.tsx` (`115:29`, `116:44`, `203:18`, `204:27`), `app/leaderboard/page.tsx` (`70:18`, `71:27`), `app/login/page.tsx` (`76:19`, `108:19`), `app/showcase/page.tsx` (`283:35`), `app/typing/page.tsx` (`27:26`), `app/u/[username]/page.tsx` (`33:52`, `63:43`, `67:42`, `69:63`), `components/auth/username-modal.tsx` (`107:19`), `components/navbar.tsx` (`86:46`, `142:49`, `153:21`, `153:42`), `lib/logger.ts` (`5:29`), `stores/user-store.ts` (`35:12`, `39:25`).
- **14 × `react-hooks/set-state-in-effect` (errors):** `app/challenge/[id]/page.tsx:66`, `app/dashboard/page.tsx:159, 204, 271`, `app/dashboard/performance-lab/page.tsx:196`, `app/leaderboard/page.tsx:73`, `app/login/page.tsx:34`, `components/auth/username-modal.tsx:23`, `components/navbar.tsx:35`, `components/typing/cat-companion.tsx:307`, `components/typing/replay-player.tsx:96`, `components/typing/result-screen.tsx:37` (Note: multiple sites trigger cascades by deriving state in `useEffect` instead of `useMemo` or initializing synchronously).
- **React 19 Compiler / Rules Errors:** `react-hooks/immutability` in `components/typing/replay-player.tsx:70` (`animate` accessed recursively before declaration), `react-hooks/purity` in `components/typing/cat-companion.tsx:381` (`Math.random()` inside `useMemo`), and **6 × `react/no-unescaped-entities`** in `app/dashboard/performance-lab/page.tsx:301, 391, 421`.
- **56 Warnings:** Dead/unused imports & variables (`app/page.tsx` alone has 8 unused symbols: `useState`, `useEffect`, `useInView`, `Button`, `AnimatedCounter`, `ArrowRight`, `stagger`, `fadeUp`), unused worker vars (`durationLimit`, `testMode`, `inputKeystrokes`, unused `eslint-disable`), and missing hook dependency (`cat-companion.tsx:372`).

---

## 2. Detailed Technical Debt Findings

### TD-01 — 111 ESLint Errors & Warnings Across App, API, Stores, and Components
- **Priority:** `High` (`Verified`)
- **File Path:** Codebase-wide (`app/`, `components/`, `lib/`, `stores/`, `workers/`)
- **Relevant Component / Function:** React hooks effects, catch/API handlers, Zustand types
- **Evidence:** `npm run lint` fails with 55 errors and 56 warnings. Examples include synchronous derived state via `useEffect` in [app/dashboard/page.tsx](../../app/dashboard/page.tsx#L269-L294) (`setStats` from `history`) and [app/challenge/[id]/page.tsx](../../app/challenge/%5Bid%5D/page.tsx#L64-L68), unescaped quotes in JSX, and `any` replacing generated Supabase types.
- **Impact:** Prevents CI enforcement of `npm run lint`, obscures real React 19 bugs (`ReplayPlayer` recursion, `CatCompanion` closure bug), and degrades type safety around Supabase rows (`profiles`, `test_results`, `Session`).
- **Recommended Solution:** Replace effect-based state derivations with `useMemo`, type Supabase queries using generated `Database` types + `@supabase/supabase-js` `Session`/`User`, narrow `catch (err: unknown)`, remove dead imports, and turn `npm run lint` into a required CI gate.

### TD-02 — Dead, Orphaned & Duplicated Repository Artifacts
- **Priority:** `Medium` (`Verified`)
- **File Path:** `app/page.tsx.modified`, `lib/supabase.ts`, `public/robots.txt`, [app/robots.ts](../../app/robots.ts), `app/showcase/page.tsx`, [components/ui/skeleton.tsx](../../components/ui/skeleton.tsx), `public/{file,globe,next,vercel,window}.svg`
- **Relevant Component / Function:** Orphaned modules & template leftovers
- **Evidence:**
  - `app/page.tsx.modified` (486 lines, 26.5 KB) is an unused previous Bauhaus landing page tracked in Git.
  - `lib/supabase.ts` (`supabase`, `validateSupabaseConfig`) has **0 imports** across the project (`git grep` verified).
  - `public/robots.txt` conflicts with `app/robots.ts` (`Sitemap: https://typrox.com/sitemap.xml` vs `https://typrox.vercel.app/sitemap.xml`), and Next 16 overrides it with `app/robots.ts`.
  - `app/showcase/page.tsx` (1,236 lines) is unlinked anywhere in navigation and embeds duplicated simulated leaderboard/dashboard views.
  - `components/ui/skeleton.tsx` (`Skeleton`, `SkeletonText`, `SkeletonCard`) has **0 consumers**, while routes use bespoke CSS spinners.
  - `public/` retains default `create-next-app` SVGs (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`) and lacks `/achievements/*.svg` referenced in SQL seeds.
- **Impact:** Bloats the repository, creates build/SEO confusion (`robots.txt`), duplicates maintenance surfaces (`/showcase` vs real pages), and signals incomplete template cleanup.
- **Recommended Solution:** Delete `app/page.tsx.modified`, `lib/supabase.ts`, `public/robots.txt`, and unused template SVGs; archive or move `/showcase` out of production build; adopt `Skeleton` components across loading states; and add real `/achievements/*.svg` icons or remove broken paths.

### TD-03 — SQL Schema Migration Divergence (`20260618` vs `FULL_SCHEMA.sql`) & Missing Views in Init
- **Priority:** `High` (`Verified`)
- **File Path:** [supabase/migrations/20260618000000_init_schema.sql](../../supabase/migrations/20260618000000_init_schema.sql), [supabase/migrations/20260619000000_audit_hardening.sql](../../supabase/migrations/20260619000000_audit_hardening.sql), [supabase/migrations/20260620100000_leaderboard_view.sql](../../supabase/migrations/20260620100000_leaderboard_view.sql), [supabase/migrations/FULL_SCHEMA.sql](../../supabase/reference/FULL_SCHEMA.sql)
- **Relevant Component / Function:** Database migration sequence vs consolidated script
- **Evidence:** `FULL_SCHEMA.sql` combines tables, RLS policies, seeds, `GRANT ALL`, Realtime publication (`supabase_realtime`), and `idx_test_results_leaderboard` index — whereas the ordered migration files `20260618`–`20260620` **omit** achievement seed rows, omit `ALTER PUBLICATION supabase_realtime ADD TABLE public.test_results`, omit `idx_test_results_leaderboard`, and drop a non-existent policy name (`"Anyone can insert challenge links"` in `20260619` vs `"Authenticated users can create challenge links"` in `FULL_SCHEMA.sql:202`).
- **Impact:** Applying migrations via Supabase CLI (`supabase db push`) vs manually pasting `FULL_SCHEMA.sql` yields materially different schemas (missing achievements, missing leaderboard index, missing Realtime broadcast).
- **Recommended Solution:** Reconcile migrations into strict incremental forward migrations executed through Supabase CLI (`supabase migration`) and remove manual copy-paste `FULL_SCHEMA.sql` drift.

### TD-04 — Production Demo-Mode Hooks Scattered Across Seven Modules
- **Priority:** `High` (`Verified`)
- **File Path:** [lib/supabase/middleware.ts](../../lib/supabase/middleware.ts#L48-L50), [components/navbar.tsx](../../components/navbar.tsx#L72-L81), [app/login/page.tsx](../../app/login/page.tsx#L46-L100), [app/dashboard/page.tsx](../../app/dashboard/page.tsx#L63-L95,L216-L231,L301-L308), [app/dashboard/performance-lab/page.tsx](../../app/dashboard/performance-lab/page.tsx#L52-L78), [app/leaderboard/page.tsx](../../app/leaderboard/page.tsx#L49-L50), [app/api/leaderboard/route.ts](../../app/api/leaderboard/route.ts#L13-L54), [components/typing/typing-container.tsx](../../components/typing/typing-container.tsx#L143-L208)
- **Relevant Component / Function:** `isDemo` / `typrox_demo` / stealth auto-type branches
- **Evidence:** Promo-video demo branches (`localStorage.getItem('typrox_demo')`, `?demo=true`, cookie `typrox_demo_logged_in`, and a hardcoded auto-typist that purposefully types `'z'` at index `44` and backspaces) are wired directly into production auth, API, middleware, and typing routes. Notice also `app/api/leaderboard/route.ts:13` evaluates `searchParams.get('demo') !== null`, so even `?demo=false` triggers mock data.
- **Impact:** Pollutes core business logic, risks sticky `typrox_demo=true` state persisting in real users' `localStorage`, and weakens auth/data trustworthiness.
- **Recommended Solution:** Strip demo/promo overrides from production code (or isolate under `NODE_ENV !== 'production'` + explicit env flag) and move promo captures to standalone seeded dev environments.

### TD-05 — Global Typing Store Leaks Seeds Across Routes & Lacks Defensive Param Parsing
- **Priority:** `Medium` (`Verified`)
- **File Path:** [stores/typing-store.ts](../../stores/typing-store.ts#L50-L54,L155-L170), [app/typing/page.tsx](../../app/typing/page.tsx#L15-L38), [app/challenge/[id]/page.tsx](../../app/challenge/%5Bid%5D/page.tsx#L70-L81), `utils/text-generator.ts`
- **Relevant Component / Function:** `useTypingStore`, `TypingArena`, `ChallengePage`, `generateText`
- **Evidence:** `ChallengePage` mutates global `setMode`, `setDuration`, and `setSeed(challenge.seed)`. Navigating away to `/typing` leaves `seed` populated in Zustand; `TypingContainer`'s mount `startTest()` uses `const activeSeed = seed || ...`, re-seeding standard practice with the old challenge seed. Furthermore, `app/typing/page.tsx:27-31` passes unvalidated `?mode=` (`as any`) and `parseInt(urlDuration, 10)` directly into `useTypingStore`, turning `?duration=foo` into `timeLeft: NaN` and invalid `?mode=xyz` into `"TyProX typing platform fallback text."`. And `Math.random().toString(36).substring(7)` produces only 5–6 alphanumeric chars (~31 bits) of seed entropy (or empty string if float rounds to short `.toString(36)`).
- **Impact:** Stale challenge state leaks across pages, malformed query strings break the timer, and `TypingContainer` + `TypingArena` double-run `startTest()` when URL params are supplied.
- **Recommended Solution:** Validate query parameters against Zod (`enum` modes & bounded durations) in `TypingPage`, clear `seed` on unmount of `ChallengePage`, generate seeds with `crypto.randomUUID().slice(0, 12)`, and remove duplicate mount initialization.

### TD-06 — `ReplayPlayer` Frame Recomputation & Hook Immutability Violations
- **Priority:** `Medium` (`Verified`)
- **File Path:** [components/typing/replay-player.tsx](../../components/typing/replay-player.tsx#L31-L98)
- **Relevant Component / Function:** `ReplayPlayer` (`getReplayStateAt`, `animate`)
- **Evidence:** `animate` calls `setIsPlaying(false)` directly inside `setCurrentTime`'s updater (`line 63`) and invokes itself recursively prior to hook stabilization (`react-hooks/immutability` error on `line 70`). Then `useEffect([currentTime])` (`line 94`) filters the entire `telemetry` array from `t = 0` and triggers two additional state updates (`setReplayInput`, `setReplayIndex`), causing cascading renders at 60fps (`react-hooks/set-state-in-effect` error on `line 96`).
- **Impact:** Double renders every animation frame during replay playback and O(N) CPU spikes on long 120s tests.
- **Recommended Solution:** Derive `(replayInput, replayIndex)` via `useMemo` (or precompute checkpoint snapshots / binary-search incremental pointer) directly from `currentTime` instead of syncing via `useEffect`, and terminate the rAF loop cleanly outside the `setCurrentTime` state updater.

### TD-07 — `CatCompanion` State Closure, Impure Render Randomness & Unused DB Sync
- **Priority:** `Medium` (`Verified`)
- **File Path:** [components/typing/cat-companion.tsx](../../components/typing/cat-companion.tsx#L301-L388)
- **Relevant Component / Function:** `CatCompanion` (`useEffect` hooks, `shortQuote` `useMemo`)
- **Evidence:** ESLint flags three defects in `CatCompanion`: synchronous `setUnlockedIds` inside effect (`line 307`), missing dependency `'unlockedIds'` in unlock effect (`line 372`, causing saved cats to be overwritten), and `Math.random()` inside `useMemo(..., [])` (`line 381`, violating React Compiler purity rules). Additionally, unlocked cats exist solely in browser `localStorage` and are lost on browser switch or storage clear.
- **Impact:** Intermittent loss of unlocked companions and non-deterministic SSR/React Compiler violations.
- **Recommended Solution:** Read `localStorage` via lazy `useState(() => ...)` (with SSR fallback) or external store sync, compute random quote safely in effect or derive deterministically from `(wpm, errorCount, duration)`, and store collectible unlocks in Supabase if intended as progression.

### TD-08 — `public.test_results` Schema / API Type Precision & Unindexed Client Aggregations
- **Priority:** `Medium` (`Verified`)
- **File Path:** [app/u/[username]/page.tsx](../../app/u/%5Busername%5D/page.tsx#L56-L78), [app/dashboard/page.tsx](../../app/dashboard/page.tsx#L102-L111), [app/dashboard/performance-lab/page.tsx](../../app/dashboard/performance-lab/page.tsx#L84-L102), [supabase/migrations/FULL_SCHEMA.sql](../../supabase/reference/FULL_SCHEMA.sql#L34-L36)
- **Relevant Component / Function:** `PublicProfilePage`, `Dashboard`, `PerformanceLabPage`
- **Evidence:** `/u/[username]` and `/dashboard` execute unbounded `.select('*')` / `.select('wpm, accuracy, duration')` queries over a user's entire `test_results` lifetime table and sum averages in browser memory. Meanwhile, `PerformanceLabPage` subscribes to `postgres_changes` (`event: 'INSERT'`, `table: 'replays'`) with **no `filter` clause** (`line 211-216`), re-fetching the entire user telemetry set whenever **any** user globally inserts a replay!
- **Impact:** As users accumulate hundreds/thousands of tests, payload sizes grow linearly; every global test completion triggers redundant Postgres fetches on open Performance Lab tabs; and `wpm`/`accuracy` columns are `REAL` floats while UI/worker round inconsistently.
- **Recommended Solution:** Create Postgres RPC/summary views (`user_profile_stats`) for bounded aggregate metrics, paginate dashboard history (`limit` + offset/cursor), and remove/filter the global `replays` Realtime subscription (note `replays` lacks `user_id` for Supabase Realtime row filtering, so filter on `test_results` `user_id=eq.${id}` instead).

