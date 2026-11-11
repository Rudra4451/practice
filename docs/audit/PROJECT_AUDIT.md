# TyProX — Comprehensive Project Audit

**Repository:** `https://github.com/Rudra4451/practice`  
**Local Workspace:** `c:\Users\rudra\TyProX`  
**Audit Scope:** Strict read-only inspection of all 75 Git-tracked files, build verification (`next build`), TypeScript check (`npx tsc --noEmit`), and lint check (`npm run lint`).  
**Verification Legend:**
- **Verified:** Directly observed in source files, SQL migrations, `node_modules/next/dist/docs`, or command output executed during this audit.
- **Assumption / External:** Live runtime infrastructure outside the repository (remote Supabase Auth/OAuth provider configuration, production environment secrets, hosted Vercel settings, and deployed database state) was not directly queried.

---

## Executive Summary

TyProX has a promising product foundation: a Next.js 16 App Router frontend, a Web Worker-backed typing engine (`words`, `quotes`, `numbers`, `punctuation`, `code`), deterministic PRNG seeded tests, second-by-second keystroke replay telemetry, a 1v1 challenge flow, Supabase authentication and Postgres schema migrations, a global leaderboard view with Supabase Realtime subscriptions, and a Performance Lab for bigram/keystroke diagnostics.

However, **the application is not yet production-ready for its intended vision** (Duolingo-style progression, Chess.com-style competition, GitHub-style community profiles). Three structural gaps block launch:

1. **Competitive Integrity & Security Failures:** `/api/results` accepts client-computed WPM/accuracy/duration verbatim without re-deriving metrics from keystroke telemetry, skips anti-cheat checks whenever `telemetry` is empty or short, and can be bypassed via direct Supabase SDK inserts (`test_results` RLS allows client inserts). Compounding this, the typing worker calculates WPM using `lastKeystrokeTime - startTime` while submitting the configured duration, allowing a 1-character run left idle to post **200 WPM** on the 60s leaderboard. Debug routes, an OAuth open redirect, `?demo=true` middleware bypasses, and permissive RLS policies (`GRANT ALL`, self-editable `streaks` and `user_achievements`) further compromise integrity.
2. **Broken & Misaligned Core Typing UX:** During active typing (`status === 'running'`), the timer and live WPM grid are hidden (`opacity-0 pointer-events-none absolute`), causing a vertical layout jump and removing live pacing feedback. Future words beyond `+4` are blurred (`opacity-10 blur-[2px]`), preventing fast typists from reading ahead. Mobile/IME typing fails due to `<textarea value="">` slicing only the last character, and `/profile` settings for fonts and sound volume are non-functional UI stubs.
3. **Engineering, Testing & Design System Debt:** There are **0 automated tests**, **111 ESLint issues (55 errors, 56 warnings)**, client-only `'use client'` boundaries on all 10 page routes, stale Neobrutalist/Bauhaus and indigo styles clashing with the `#FF5C00` editorial palette, broken Tailwind v4 utility names (`text-warning`, `bg-neutral-850`, `bg-surface-hover`, `bg-noise-overlay`), and fabricated metrics (simulated online counts, fake testimonials, and a hardcoded `wpm > 80` "Personal Best" badge).

---

## 1. Repository & Architecture Inspection

### 1.1 Framework, Tooling & Exact Dependency Versions
Verified from [package.json](file:///c:/Users/rudra/TyProX/package.json):

| Package | Declared Version | Role in Codebase | Audit Status |
|---|---|---|---|
| `next` | `16.2.9` | App Router, Turbopack build, Route Handlers, `proxy.ts` | Active (`npm run build` succeeded) |
| `react` / `react-dom` | `19.2.4` | UI runtime | Active |
| `@supabase/ssr` | `^0.12.0` | Server/middleware/browser cookie-backed Supabase clients | Active |
| `@supabase/supabase-js` | `^2.108.2` | DB queries, auth, Postgres Realtime subscriptions | Active |
| `zustand` | `^5.0.14` | Client state (`useTypingStore`, `useUserStore`, `useToastStore`) | Active |
| `framer-motion` | `^12.40.0` | Page sections, 3D keyboard, caret keyscale, cat companion, navbar pill | Active (heavy on hot paths) |
| `recharts` | `^3.8.1` | Speed/rawWPM timeline charts (`ResultChart`, `DashboardChart`) | Active (lazy-loaded via `next/dynamic`) |
| `zod` | `^4.4.3` | Request schema validation (`app/api/results/route.ts` only) | Partially utilized |
| `lucide-react` | `^1.20.0` | UI iconography | Active |
| `canvas-confetti` | `^1.9.4` | Post-test confetti celebration (`ResultScreen`) | Active |
| `tailwindcss` / `@tailwindcss/postcss` | `^4` | CSS-first Tailwind v4 via `@theme` in `app/globals.css` | Active (with missing token aliases) |
| `typescript` | `^5` | Static type checking (`strict: true` in `tsconfig.json`) | Active (`npx tsc --noEmit` passed) |
| `eslint` / `eslint-config-next` | `^9` / `16.2.9` | Flat config (`eslint.config.mjs`) with Core Web Vitals & TS rules | Failing (`111 problems`) |
| Test Runner (`vitest`, `jest`, `playwright`) | *None* | Automated unit/integration/E2E testing | **Missing** |

### 1.2 Folder Structure & Architectural Patterns
All 75 tracked files follow Next.js 16 App Router conventions (no `src/` directory; `@/*` path alias maps to `./*` in [tsconfig.json](file:///c:/Users/rudra/TyProX/tsconfig.json)):
- `app/`: App Router routes (`/` landing page, `/typing`, `/leaderboard`, `/dashboard`, `/dashboard/performance-lab`, `/login`, `/profile`, `/showcase`, `/challenge/[id]`, `/u/[username]`), metadata routes (`app/robots.ts`, `app/sitemap.ts`), global styles/layout (`app/globals.css`, `app/layout.tsx`), and API/Auth route handlers (`app/api/*`, `app/auth/callback/route.ts`).
- `components/`: Feature-grouped client components (`auth/`, `dashboard/`, `home/`, `typing/`, `ui/`, plus `components/navbar.tsx`).
- `stores/`: Three Zustand stores (`typing-store.ts`, `user-store.ts`, `toast-store.ts`).
- `workers/`: Browser Web Worker (`analytics.worker.ts`) instantiated inside `stores/typing-store.ts`.
- `utils/` & `constants/`: Deterministic `cyrb128`/`mulberry32` text generator (`text-generator.ts`) and word/quote/code arrays (`dictionaries.ts`).
- `lib/`: Supabase SSR/browser/middleware helpers (`lib/supabase/*`), unused legacy singleton (`lib/supabase.ts`), and custom logger (`lib/logger.ts`).
- `supabase/migrations/`: SQL schema (`20260618000000_init_schema.sql`, `20260619000000_audit_hardening.sql`, `20260620100000_leaderboard_view.sql`, and consolidated `FULL_SCHEMA.sql`).
- `proxy.ts`: Next.js 16 replacement for `middleware.ts` (verified compliant against [16-proxy.md](file:///c:/Users/rudra/TyProX/node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md)).
- **Orphaned / Non-Standard Files in Repo:** [app/page.tsx.modified](file:///c:/Users/rudra/TyProX/app/page.tsx.modified) (486-line previous landing page), unused `create-next-app` SVGs in `public/` (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`), conflicting [public/robots.txt](file:///c:/Users/rudra/TyProX/public/robots.txt) alongside [app/robots.ts](file:///c:/Users/rudra/TyProX/app/robots.ts), unlinked 1,236-line [app/showcase/page.tsx](file:///c:/Users/rudra/TyProX/app/showcase/page.tsx), and [components/ui/skeleton.tsx](file:///c:/Users/rudra/TyProX/components/ui/skeleton.tsx) (never imported).

### 1.3 Routing & Server/Client Component Boundaries
Per `npm run build` output (`next build` 16.2.9 Turbopack):
- **Static Prerendered Shells (`○`):** `/`, `/_not-found`, `/dashboard`, `/dashboard/performance-lab`, `/leaderboard`, `/login`, `/profile`, `/robots.txt`, `/showcase`, `/sitemap.xml`, `/typing`.
- **Dynamic Server-Rendered (`ƒ`):** `/challenge/[id]`, `/u/[username]`, `/auth/callback`, and `/api/*`.
- **Architectural Issue:** Every page file under `app/` begins with `'use client';` (including public landing `/`, `/leaderboard`, `/u/[username]`, and `/challenge/[id]`). As a result, Next.js renders empty/loading shells on initial SSR and shifts data fetching, profile queries, and public stat aggregation onto the client browser (`createClient()`), forfeiting Server Component streaming, cacheable public metadata (`generateMetadata` for `/u/[username]` and `/challenge/[id]`), and smaller JS bundles (per [05-server-and-client-components.md](file:///c:/Users/rudra/TyProX/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md)).

### 1.4 State Management
- **Typing State ([stores/typing-store.ts](file:///c:/Users/rudra/TyProX/stores/typing-store.ts)):** Global Zustand singleton holding test config (`duration`, `mode`, `seed`), live progress (`status`, `targetText`, `userInput`, `currentIndex`, `timeLeft`, `wpm`, `rawWpm`, `accuracy`, `combo`, `maxCombo`), final `result`, and a module-level `workerInstance` and `timerInterval`. Because `seed` is global state and only cleared by `resetTest()`, completing or visiting `/challenge/[id]` and navigating via `<Link>` to `/typing` leaks the challenge seed into subsequent practice sessions.
- **User & Preferences State ([stores/user-store.ts](file:///c:/Users/rudra/TyProX/stores/user-store.ts)):** Persists `preferences` (`theme`, `font_family`, `volume`) and `guestHistory` (capped at 100 entries) to `localStorage` under `'user-store'`. Session/profile hydration happens inside [components/navbar.tsx](file:///c:/Users/rudra/TyProX/components/navbar.tsx#L71-L171) instead of a dedicated root Auth Provider, meaning session initialization only runs when `<Navbar />` is mounted.
- **Toast State ([stores/toast-store.ts](file:///c:/Users/rudra/TyProX/stores/toast-store.ts)):** Minimal client queue with `Math.random()` IDs and uncleaned 4s auto-dismiss timeouts.

### 1.5 Styling System & Design Tokens
- Configured via Tailwind v4 `@import "tailwindcss";` and `@theme` in [app/globals.css](file:///c:/Users/rudra/TyProX/app/globals.css#L1-L101), paired with `:root` / `.dark` CSS custom properties and `next/font/google` (`Inter`, `Space Grotesk`, `JetBrains Mono`) in [app/layout.tsx](file:///c:/Users/rudra/TyProX/app/layout.tsx#L8-L24).
- **Theme Token Drift:** The design migrated partially from a Neobrutalist/Bauhaus palette (with aliases `--color-bauhaus-red`, `--color-bauhaus-yellow`, `--color-bauhaus-blue` in `globals.css:22-27`) and an indigo phase (`rgba(99, 102, 241, ...)` shadows in `globals.css:215-216`, `login/page.tsx`, `profile/page.tsx`, `leaderboard/page.tsx`, `analytics.tsx`) toward an orange (`#FF5C00`) editorial system, leaving contradictory styles across routes.
- **First-Visit Theme Desync:** [app/layout.tsx](file:///c:/Users/rudra/TyProX/app/layout.tsx#L90-L93) defaults new visitors (`!localStorage.getItem('user-store')`) to `.dark` in DOM via `<Script strategy="beforeInteractive">`, while [stores/user-store.ts](file:///c:/Users/rudra/TyProX/stores/user-store.ts#L52) initializes `preferences.theme: 'light'`.

### 1.6 Environment, Build & Deployment Configuration
- **Environment Variables:** Verified `.env.local` defines only two keys (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, values intentionally not read/exposed). `NEXT_PUBLIC_SITE_URL` referenced by [app/robots.ts](file:///c:/Users/rudra/TyProX/app/robots.ts#L4) and [app/sitemap.ts](file:///c:/Users/rudra/TyProX/app/sitemap.ts#L5) falls back to `https://typrox.vercel.app`. There is no `.env.example`, and no server-only `SUPABASE_SERVICE_ROLE_KEY`.
- **Build & Image Config ([next.config.ts](file:///c:/Users/rudra/TyProX/next.config.ts)):** Only configures `images.remotePatterns` for `lh3.googleusercontent.com` and `avatars.githubusercontent.com`. `optimizePackageImports`, security headers (CSP, `X-Frame-Options`, `Referrer-Policy`), and `next/image` coverage for arbitrary avatar URLs are absent.
- **Deployment Target:** Configured implicitly for Vercel (README/fallback URLs `typrox.vercel.app`), though `public/robots.txt` still cites `https://typrox.com/sitemap.xml` and `OAUTH_SETUP.md` hardcodes Supabase ref `gbovkejymfeiqgverzfr`.

---

## 2. Typing Engine Audit

### 2.1 Metrics Math & Exploits
1. **Elapsed Time Exploit & `duration` Discrepancy (Critical):**  
   In [workers/analytics.worker.ts](file:///c:/Users/rudra/TyProX/workers/analytics.worker.ts#L99-L108), `FINALIZE` computes `totalElapsedMs = lastKeystrokeTime - startTime`, `totalElapsedSecs = Math.max(1, Math.round(totalElapsedMs / 1000))`, and `elapsedMins = Math.max(0.001, totalElapsedMs / 60000)`. Meanwhile, [components/typing/result-screen.tsx](file:///c:/Users/rudra/TyProX/components/typing/result-screen.tsx#L49) submits the *store's configured `duration`* (`15`/`30`/`60`/`120`) to `/api/results` while rendering `{result.duration}s` on screen (`line 217`). Typing **1 correct character** on a 60s test and waiting out the countdown produces `totalElapsedMs = 0` -> `elapsedMins = 0.001` -> `(1 / 5) / 0.001 = 200 WPM`, saved to Supabase under `duration: 60`!
2. **Gross (Raw) WPM & Accuracy Erase Corrected Mistakes (High):**  
   [workers/analytics.worker.ts](file:///c:/Users/rudra/TyProX/workers/analytics.worker.ts#L24-L32, L56-L79, L105-L118) tracks state in `correctMap = new Map<number, boolean>()`. On `Backspace` (`type: 'delete'`), `correctMap.delete(event.index)` erases the slot from both `correctChars` and `rawInputs`. Consequently, a user can make 30 typos, backspace them, finish with 0 uncorrected errors, and achieve **100% accuracy** and an artificially lowered `rawWpm` equal to net `wpm`. Standard typing telemetry computes accuracy against *all input keystrokes* (`correctKeystrokes / totalInputKeystrokes`) or `(totalChars - errors) / totalChars` while distinguishing raw speed (`allInputKeystrokes / 5 / minutes`) from net WPM (`rawWpm - uncorrectedErrors / minutes` or `currentlyCorrectChars / 5 / minutes`).
3. **Timer Drift & Pause Desync (High):**  
   [stores/typing-store.ts](file:///c:/Users/rudra/TyProX/stores/typing-store.ts#L185-L201, L276-L304) tracks countdown time via `setInterval(..., 1000)` decrementing an integer `timeLeft` rather than comparing against `performance.now() - startTimestamp`. Browser tab throttling or event loop jitter causes wall-clock drift. Additionally, `pauseTest` / `resumeTest` stops `timeLeft` without adjusting `startTime` in `analytics.worker.ts`, causing any pause to crush final WPM while displaying normal duration.
4. **Consistency Formula Sensitive to Pauses & Micro-Bursts (Medium):**  
   [workers/analytics.worker.ts](file:///c:/Users/rudra/TyProX/workers/analytics.worker.ts#L121-L138) defines `consistency = Math.max(0, Math.min(100, Math.round(100 * (1 - stdDev / meanInterval))))` using raw inter-keystroke intervals of *correct* keys (unbounded, unlike `keySpeeds` which ignores pauses `> 5s`). A single 2-second hesitation yields high `stdDev / meanInterval > 1` -> `0%` consistency even if 98% of typing was steady. Using per-second WPM buckets or capping inter-key outliers (as Monkeytype does) produces meaningful rhythm scores.
5. **Text Generation, Spaces & Early Completion in Quotes/Code (Medium):**  
   - [utils/text-generator.ts](file:///c:/Users/rudra/TyProX/utils/text-generator.ts#L96-L109) selects a single short quote (e.g., 32–39 chars in `QUOTES`, [constants/dictionaries.ts](file:///c:/Users/rudra/TyProX/constants/dictionaries.ts#L171-L185)) regardless of whether a 15s or 120s timer is selected, ending 120s quote tests in ~4 seconds while submitting `duration: 120` to `/api/results`.
   - `code` mode (`line 109`) joins snippets with double spaces (`items.join('  ')`), whereas [components/typing/text-display.tsx](file:///c:/Users/rudra/TyProX/components/typing/text-display.tsx#L20) executes `targetText.split(' ')`, creating empty `""` word nodes and extra phantom gap spans between snippets.
   - `Math.max(50, Math.ceil(durationLimit * 3.5))` (`line 39`) yields ~210 words for a 60s test; elite typists (>210 WPM bursts in 15s = 53 words vs 53 generated) can hit the end of text early.
6. **Input Capture, Mobile IME & Keystroke Handling (High):**  
   - [components/typing/typing-container.tsx](file:///c:/Users/rudra/TyProX/components/typing/typing-container.tsx#L88-L112) binds a controlled empty `<textarea value="">` and reads `e.target.value.slice(-1)`. Multi-character inputs (paste, autocorrect replacement, swipe keyboards, IME composition) drop all characters except the final one. On Android virtual keyboards, `Backspace` frequently dispatches `KeyboardEvent.key === 'Unidentified'` on an empty textarea and never fires `handleBackspace`.
   - Pressing `Enter` inserts `'\n'`, which fails expected `' '` matching in single-line paragraphs; pressing any printable key globally (`line 127`) steals focus away from navbar/buttons to the hidden textarea.
   - [components/typing/typing-container.tsx](file:///c:/Users/rudra/TyProX/components/typing/typing-container.tsx#L285-L289) hides the countdown timer and live stats with `opacity-0 -translate-y-4 pointer-events-none absolute w-full` whenever `status === 'running'`.

---

## 3. Performance, Bundle & Testing Inspection

### 3.1 Build, Bundle & Asset Metrics
- **Production Build (`npm run build`):** Executed successfully (`next build` 16.2.9 Turbopack, exit code `0`, 20 routes built).
- **Static Chunks on Disk (`.next/static/chunks/`):** 38 files totaling **1,953,980 bytes (~1.91 MB uncompressed JS + CSS across all routes)**. Top chunks: `329.7 KB`, `242.1 KB`, `221.0 KB`, `143.3 KB`, `131.8 KB`, `110.0 KB`, and `101.8 KB` CSS. Exact per-route transferred gzip sizes were not measured because `@next/bundle-analyzer` / `next experimental-analyze` was not configured or executed.
- **Route Code-Splitting:** Recharts (`ResultChart`, `DashboardChart`) and landing sub-sections (`ComparisonSection`, `AnalyticsSection`, `AchievementsSection`, `FAQSection`) are wrapped in `next/dynamic`, though home sub-sections use `{ ssr: true }` inside a `'use client'` root page ([app/page.tsx](file:///c:/Users/rudra/TyProX/app/page.tsx#L12-L15)), meaning they still ship in client bundles on `/`.

### 3.2 Runtime Performance Hotspots
- **`Hero3D` Continuous Timers ([components/home/hero-3d.tsx](file:///c:/Users/rudra/TyProX/components/home/hero-3d.tsx#L263-L270, L350-L404)):** Runs three perpetual intervals: typing simulator (`250ms`), camera idle bob (`45ms`), and Rainbow RGB hue cycling (`40ms` = 25 full React parent re-renders/sec across 61 `Keycap` components + 4 `HUDPanel`s). None pause when offscreen (`IntersectionObserver`), when tab is hidden, or when `prefersReducedMotion` is enabled (`prefersReducedMotion` is only checked on mousemove!).
- **`TextDisplay` Per-Keystroke DOM/Framer-Motion Overhead ([components/typing/text-display.tsx](file:///c:/Users/rudra/TyProX/components/typing/text-display.tsx#L66-L115)):** Renders every character of the entire test (~2,500 chars for 120s tests) as `<motion.span>` nodes inside the tree and triggers `activeWordRef.current.offsetTop` on active word change.
- **Worker Algorithmic Scaling ([workers/analytics.worker.ts](file:///c:/Users/rudra/TyProX/workers/analytics.worker.ts#L11, L24-L32, L146-L167)):** Despite the comment `Running counters — O(1)`, `getRunningCounts()` loops over the entire `correctMap` on every keystroke (`O(N)` per key, `O(N²)` per session), and the `FINALIZE` timeline loop iterates `s = 1..totalElapsedSecs` rebuilding a `Map` over all `keystrokes` (`O(S * N)`).
- **`ReplayPlayer` Render Loop ([components/typing/replay-player.tsx](file:///c:/Users/rudra/TyProX/components/typing/replay-player.tsx#L31-L98)):** Calls `setIsPlaying(false)` inside a `setCurrentTime` state updater (`line 63`) and replays the full array from `t = 0` inside `useEffect` (`O(N)` per animation frame).

### 3.3 Automated Testing, TypeScript & Lint Results
- **Automated Tests:** **0 test files exist** (`git ls-files | Select-String 'test|spec'` matched only `app/api/test-supabase/route.ts`). No unit tests cover typing math, PRNG determinism, anti-cheat checks, streaks, or API contracts.
- **TypeScript (`npx tsc --noEmit`):** **Passed (exit code `0`)**. Note: strictness is weakened by explicit `any` types across components, APIs, and stores.
- **ESLint (`npm run lint`):** **Failed (exit code `1`) — 111 problems (55 errors, 56 warnings)**:
  - `@typescript-eslint/no-explicit-any`: 26 errors across API routes, pages, `navbar.tsx`, `user-store.ts`, `logger.ts`, `username-modal.tsx`.
  - `react-hooks/set-state-in-effect`: 14 errors (`leaderboard/page.tsx`, `login/page.tsx`, `dashboard/page.tsx`, `performance-lab/page.tsx`, `challenge/[id]/page.tsx`, `username-modal.tsx`, `navbar.tsx`, `cat-companion.tsx`, `replay-player.tsx`, `result-screen.tsx`).
  - `react/no-unescaped-entities`: 6 errors in `performance-lab/page.tsx`, plus errors in `showcase/page.tsx` and React Compiler hooks (`react-hooks/immutability` in `replay-player.tsx:70`, `react-hooks/purity` in `cat-companion.tsx:381`).
  - Warnings: 56 warnings (mostly `@typescript-eslint/no-unused-vars`, `react-hooks/exhaustive-deps`, and unused eslint-disable in `analytics.worker.ts`).
- **Missing Boundary Files & Unused UI:** Zero `error.tsx` or `loading.tsx` files exist under `app/`. [components/ui/skeleton.tsx](file:///c:/Users/rudra/TyProX/components/ui/skeleton.tsx) is unused while pages render inconsistent spinner blocks.

---

## 4. Detailed Project & Architecture Findings

### PA-01 — Typing Worker Elapsed-Time Exploit & Store Duration Mismatch
- **Priority:** `Critical` (`Verified`)
- **File Path:** [workers/analytics.worker.ts](file:///c:/Users/rudra/TyProX/workers/analytics.worker.ts#L99-L108), [components/typing/result-screen.tsx](file:///c:/Users/rudra/TyProX/components/typing/result-screen.tsx#L49)
- **Relevant Component / Function:** `self.onmessage` (`FINALIZE` handler), `ResultScreen` submission `useEffect`
- **Evidence:** Worker computes `totalElapsedMs = lastKeystrokeTime - startTime` (`line 100`) and `elapsedMins = Math.max(0.001, totalElapsedMs / 60000)` (`line 102`), returning `duration: Math.max(1, Math.round(totalElapsedMs / 1000))`. Meanwhile `ResultScreen` sends Zustand's configured `duration` (`15`/`30`/`60`/`120`, `line 49`) instead of `result.duration` to `/api/results`.
- **Impact:** Typing 1 character (`t = 0`) and waiting for a 60s timer to expire produces `200 WPM` (`0.2 / 0.001`) recorded under `duration: 60` on global leaderboards. Finishing a 39-char quote in 4 seconds on a `120s` setting records `120s` in Postgres for a 4-second run.
- **Recommended Solution:** For timed expiry, pass and use the actual active timer duration (`durationLimit * 1000`); for end-of-text completion (`nextIndex >= targetText.length`), use `endTimestamp - startTime` measured at completion time, not `lastKeystrokeTime`. Reject mode/duration mismatches in `/api/results` and persist true elapsed duration.

### PA-02 — Accuracy & Raw WPM Ignore Corrected Mistakes
- **Priority:** `High` (`Verified`)
- **File Path:** [workers/analytics.worker.ts](file:///c:/Users/rudra/TyProX/workers/analytics.worker.ts#L24-L32, L56-L79, L105-L118)
- **Relevant Component / Function:** `getRunningCounts`, `KEYSTROKE` and `FINALIZE` handlers
- **Evidence:** On `event.type === 'delete'`, `correctMap.delete(event.index)` removes the deleted character from `correctMap`. `getRunningCounts()` iterates over `correctMap`, so `rawInputs` equals *currently occupied buffer length* rather than total typed inputs.
- **Impact:** All backspaced errors vanish from accuracy and raw WPM calculations, misrepresenting typing precision and misleading users practicing deliberate accuracy.
- **Recommended Solution:** Track cumulative `totalInputKeystrokes`, `correctInputKeystrokes`, and `uncorrectedErrors` in O(1) counters alongside `correctMap`. Compute `rawWpm = (totalInputKeystrokes / 5) / elapsedMins`, `accuracy = (correctInputKeystrokes / totalInputKeystrokes) * 100`, and Net WPM with explicit penalty or net correct characters.

### PA-03 — Interval-Based Timer Drift & Pause Timing Corruption
- **Priority:** `High` (`Verified`)
- **File Path:** [stores/typing-store.ts](file:///c:/Users/rudra/TyProX/stores/typing-store.ts#L185-L201, L276-L304)
- **Relevant Component / Function:** `useTypingStore` (`handleInput`, `pauseTest`, `resumeTest`)
- **Evidence:** Timer uses `setInterval(..., 1000)` decrementing integer `timeLeft` (`set({ timeLeft: timeLeft - 1 })`). `pauseTest` clears the interval without notifying `analytics.worker.ts`. Furthermore, `pauseTest` and `resumeTest` have zero callers in UI components, while `worker` `ERROR` responses (`analytics.worker.ts:95`) are unhandled by `handleWorkerMessage` (`typing-store.ts:82-102`).
- **Impact:** Background tab throttling skews timed tests; invoking `pauseTest`/`resumeTest` corrupts WPM by including paused wall-clock time; and if `FINALIZE` ever occurs with zero keystrokes, UI remains stuck in `'running'`/`0s` because `type: 'ERROR'` is ignored.
- **Recommended Solution:** Compute remaining time from `endAt = performance.now() + duration * 1000` on a `100ms`–`250ms` check interval, track accumulated pause duration in the worker (or remove unused pause APIs until implemented cleanly), and handle `type: 'ERROR'` in `handleWorkerMessage`.

### PA-04 — Non-Modular Worker Complexity & `FINALIZE` Scaling
- **Priority:** `Medium` (`Verified`)
- **File Path:** [workers/analytics.worker.ts](file:///c:/Users/rudra/TyProX/workers/analytics.worker.ts#L11, L24-L32, L146-L167)
- **Relevant Component / Function:** `getRunningCounts`, `FINALIZE` timeline calculation
- **Evidence:** Comment claims `O(1) per keystroke`, yet `getRunningCounts()` loops across every entry in `correctMap` on every single keystroke (`O(N)` per keystroke), and `FINALIZE` loops `s = 1..totalElapsedSecs` iterating `keystrokes` from index `0` each second (`O(S * N)`). Line 144 allocates unused `inputKeystrokes`.
- **Impact:** On 120s high-WPM sessions (~1,500–2,500 keystrokes), `FINALIZE` executes up to 300,000 map operations synchronously before displaying results.
- **Recommended Solution:** Maintain incremental `O(1)` integer counters (`correctCount`, `occupiedCount`) updated directly in `KEYSTROKE`, and perform a single linear sweep (`O(N)`) over `keystrokes` while emitting per-second snapshots.

### PA-05 — Universal `'use client'` Pages & `Navbar`-Coupled Auth Lifecycle
- **Priority:** `High` (`Verified`)
- **File Path:** [components/navbar.tsx](file:///c:/Users/rudra/TyProX/components/navbar.tsx#L71-L171), [app/page.tsx](file:///c:/Users/rudra/TyProX/app/page.tsx#L1), [app/u/[username]/page.tsx](file:///c:/Users/rudra/TyProX/app/u/[username]/page.tsx#L1)
- **Relevant Component / Function:** `Navbar` auth `useEffect`, all `app/**/page.tsx` routes
- **Evidence:** All 10 App Router page files declare `'use client'` on line 1. Auth session lookup (`supabase.auth.getSession()`), `onAuthStateChange()`, and fallback `ensureProfileExists()` execute only inside `Navbar`'s `useEffect`.
- **Impact:** Routes without SSR data (`/` landing page, `/u/[username]`, `/leaderboard`, `/challenge/[id]`) cannot stream server-fetched Postgres data or dynamic OpenGraph metadata (`generateMetadata`), ship unnecessary client Supabase/UI bundles, and depend on `Navbar` being mounted for `useUserStore.session` hydration.
- **Recommended Solution:** Move public data fetching and SEO metadata to Server Components on `/`, `/leaderboard`, `/u/[username]`, and `/challenge/[id]`, isolate interactivity into leaf Client Components, and extract auth session hydration into a dedicated root `<AuthProvider>` using `getUser()` + server-verified initial state.

### PA-06 — Zero Automated Tests & Failing Lint Suite
- **Priority:** `Critical` (`Verified`)
- **File Path:** Repository-wide ([package.json](file:///c:/Users/rudra/TyProX/package.json), ESLint execution across `app/`, `components/`, `lib/`, `stores/`, `workers/`)
- **Relevant Component / Function:** Project QA & CI scripts
- **Evidence:** `git ls-files` contains zero unit, integration, or E2E test files (`package.json` lacks a `test` script or test runner). Running `npm run lint` failed (exit code `1`) with **111 problems (55 errors, 56 warnings)**.
- **Impact:** Mathematical regressions (such as the `lastKeystrokeTime` WPM bug), auth edge cases, and React 19 hook rules go undetected across commits, blocking strict CI gates.
- **Recommended Solution:** Add Vitest for typing engine math, PRNG text generation, and API validation unit tests plus Playwright smoke tests for critical flows; resolve all 55 ESLint errors and enforce `lint` + `test` + `tsc` in CI.

### PA-07 — `ResultScreen` Double Submission & Unbounded Confetti Loop
- **Priority:** `High` (`Verified`)
- **File Path:** [components/typing/result-screen.tsx](file:///c:/Users/rudra/TyProX/components/typing/result-screen.tsx#L33-L105)
- **Relevant Component / Function:** `ResultScreen` submission `useEffect`
- **Evidence:** `useEffect` lacks a `submittedRef` guard and depends on `[result, session, addGuestResult, seed, mode, duration]`. Confetti runs `requestAnimationFrame(frame)` for 3,000ms with no `cancelAnimationFrame` on unmount and no check for `prefers-reduced-motion`.
- **Impact:** In React StrictMode dev or if `session` updates while on the result screen, `POST /api/results` or `addGuestResult` triggers twice, creating duplicate history entries. Unmounting early leaves confetti running.
- **Recommended Solution:** Track submission with a `useRef` keyed to the unique run object/ID, move submission cleanly into the test-completion handler (or idempotent API key), cancel `requestAnimationFrame` on cleanup, and respect `prefers-reduced-motion`.

### PA-08 — Mobile & IME Input Failure in `TypingContainer`
- **Priority:** `High` (`Verified`)
- **File Path:** [components/typing/typing-container.tsx](file:///c:/Users/rudra/TyProX/components/typing/typing-container.tsx#L88-L138, L323-L337)
- **Relevant Component / Function:** `TypingContainer` (`handleChange`, `handleKeyDown`, `handleGlobalKey`)
- **Evidence:** Controlled `<textarea value="">` clears `e.target.value` on every `onChange` and passes only `value.slice(-1)` to `handleInput`.
- **Impact:** Mobile virtual keyboards using swipe/autocorrect/IME drop characters, Android Gboard `Backspace` often fires `key === 'Unidentified'` on empty inputs without triggering `handleBackspace`, and global `keydown` redirects printable keys (including `Space`) away from interactive buttons/controls into the textarea.
- **Recommended Solution:** Handle `onBeforeInput` / `compositionstart` / `compositionend` (or maintain a non-empty buffer / compare `inputType === 'deleteContentBackward'`), ignore global `keydown` when focus is on interactive controls (`button`, `a`, `input`, `select`), and handle multi-char commits cleanly.

### PA-09 — Missing Error Boundaries, Conflicting Robots & Non-Production Config Hygiene
- **Priority:** `Medium` (`Verified`)
- **File Path:** [app/robots.ts](file:///c:/Users/rudra/TyProX/app/robots.ts), [public/robots.txt](file:///c:/Users/rudra/TyProX/public/robots.txt), [next.config.ts](file:///c:/Users/rudra/TyProX/next.config.ts), [README.md](file:///c:/Users/rudra/TyProX/README.md#L42), [OAUTH_SETUP.md](file:///c:/Users/rudra/TyProX/OAUTH_SETUP.md)
- **Relevant Component / Function:** Deployment metadata & project documentation
- **Evidence:** `.next/server/app/robots.txt.body` confirms `app/robots.ts` overrides `public/robots.txt`, leaving `public/robots.txt` (`typrox.com`) conflicting. No `app/error.tsx` or `app/global-error.tsx` exists. `README.md:42` links to `file:///c:/Users/rudra/practice/OAUTH_SETUP.md`, which exposes a Supabase project ref. `next.config.ts` lacks `images.remotePatterns` fallback handling for non-Google/GitHub avatars and security headers.
- **Impact:** Uncaught client exceptions crash the route without recovery UI; stale `robots.txt` and broken local file URLs confuse contributors and crawlers; non-allowlisted avatar URLs on `leaderboard/page.tsx` can throw runtime `next/image` errors.
- **Recommended Solution:** Delete `public/robots.txt`, add route-level `error.tsx` and `loading.tsx`, configure `.env.example` + `NEXT_PUBLIC_SITE_URL`, fix relative doc links, and add safe HTTP security headers + fallback avatar error handling.

---

## 5. Recommended Implementation Order

Execute remediation in five sequenced phases so security and correctness underpin future growth features:

1. **Phase 1 — Security & Competitive Integrity (Blockers)**
   - Lock down Postgres RLS & privileges (`REVOKE ALL` / remove `anon` inserts on `test_results`, `replays`, `challenge_links`, `streaks` UPDATE, `user_achievements` INSERT; add `WHERE user_id IS NOT NULL` & `security_invoker` on `leaderboard_view`).
   - Delete or guard `/api/debug/supabase` and `/api/test-supabase`; fix Open Redirect in `/auth/callback`; remove `?demo=true` bypasses from `middleware.ts`, `navbar.tsx`, and `/api/leaderboard`.
   - Recompute `wpm`, `rawWpm`, `accuracy`, `consistency`, `errorCount`, `backspaceCount`, and `duration` **server-side** in `POST /api/results` from `(seed, mode, durationLimit, telemetry)`, remove client-side direct `test_results` inserts (`handleSyncHistory`), and fix the `lastKeystrokeTime` WPM exploit.
2. **Phase 2 — Core Typing Engine & UX Restoration**
   - Un-hide live stats (`Remaining`, `WPM`, `Accuracy`, `Combo`) during active runs and stabilize layout height.
   - Remove future-word `blur-[2px]` in `TextDisplay`, fix `code` double-space splitting, enforce proper text length for `quotes`/`code`/`words`, and fix mobile/IME `<textarea>` input + Backspace handling.
   - Fix `ResultScreen` duplicate-submit guard, real "Personal Best" calculation from history, `CatCompanion` `localStorage` wipe race, and streak Day-1/stale-achievement bugs in `/api/results`.
3. **Phase 3 — Engineering Quality, Performance & Repo Hygiene**
   - Remove dead/orphaned artifacts (`app/page.tsx.modified`, `lib/supabase.ts`, `public/robots.txt`, template SVGs in `public/`), gate or remove `/showcase`, link `/profile` or integrate settings cleanly, and wire `font_family` + `volume` (or remove non-functional controls).
   - Add Vitest unit tests (worker math, PRNG text gen, score verification) and resolve all 55 ESLint errors.
   - Throttle/pause `Hero3D` animations (`IntersectionObserver`, `prefersReducedMotion`), convert `TextDisplay` character nodes away from per-char Framer Motion overhead, move `/`, `/u/[username]`, `/leaderboard`, and `/challenge/[id]` data loading to Server Components, and enforce security headers + `error.tsx`.
4. **Phase 4 — Editorial Design System Unification**
   - Unify all pages onto the editorial `#FF5C00` token system (eliminate leftover Bauhaus `border-3`/hard shadows and indigo glow colors), fix missing CSS tokens (`warning`, `neutral-850`, `surface-hover`, `bg-noise-overlay`), fix `#FF5C00` button text contrast (`AA >= 4.5:1`), fix initial dark/light preference sync, remove fake online counts/testimonials, and add WCAG dialog/ARIA semantics.
5. **Phase 5 — Platform Vision Execution (Duolingo + Chess.com + GitHub)**
   - Implement wired `daily_challenges` & `user_challenge_progress` (Duolingo daily lessons/guided drills), persist opponent submissions & head-to-head history on `challenge_links` + add ELO/rating ladders (Chess.com competition), and add contribution heatmaps, replay links on profiles, and follow/activity feeds on `/u/[username]` (GitHub social identity).

