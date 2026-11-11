# TyProX Testing Strategy & Acceptance Criteria Plan

**Document Status:** Planning Only (Zero packages installed, zero test files created)  
**Target Stack:** Next.js 16.2.9 (`App Router` + Turbopack), React 19.2.4, TypeScript 5 (`strict`), Zustand 5, Supabase SSR/Postgres, Vitest, Playwright  
**Next.js 16 Alignment:** Follows repository bundled documentation [vitest.md](file:///c:/Users/rudra/TyProX/node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md) and [playwright.md](file:///c:/Users/rudra/TyProX/node_modules/next/dist/docs/01-app/02-guides/testing/playwright.md).  
**Primary Audit Sources:** [PROJECT_AUDIT.md](file:///c:/Users/rudra/TyProX/docs/audit/PROJECT_AUDIT.md), [SECURITY_REVIEW.md](file:///c:/Users/rudra/TyProX/docs/audit/SECURITY_REVIEW.md), [TECHNICAL_DEBT.md](file:///c:/Users/rudra/TyProX/docs/audit/TECHNICAL_DEBT.md)

---

## 1. Architecture-Appropriate Testing Strategy

Per Next.js 16 testing guidance:
- **Use Vitest (`@vitejs/plugin-react` + `vite-tsconfig-paths` + `jsdom`/`node`)** for:
  1. Pure TypeScript domain engines (`lib/typing/metrics.ts`, `lib/typing/text-generator.ts`, `lib/typing/verifier.ts`, `lib/typing/replay-analyzer.ts`, `lib/security/redirect.ts`, `lib/progression/xp.ts`, `lib/progression/rating.ts`).
  2. Zod input schemas & Next.js Route Handler contract tests (`POST /api/results`, `POST /api/challenges`, `PATCH /api/profile`, `GET /api/leaderboard`, `GET /auth/callback`) with cleanly injected/mocked Supabase clients.
  3. Zustand stores (`useTypingStore` timer deadlines & reset state, `useUserStore` persistence & guest telemetry capping).
  4. Synchronous Client Components (`TextDisplay`, `UsernameModal`, `ResultScreen`, `CatCompanion`, `ReplayPlayer`).
- **Do NOT abuse Vitest/JSDOM for `async` React Server Components** (explicit Next 16 limitation noted in `vitest.md:9`) **or Web Worker binary bundles**: test `async` RSC routes, CSS theme hydration, real Web Worker message passing, mobile viewport bounds, and cross-route redirects using **Playwright**.
- **Verify PostgreSQL RLS & Views Directly at Database Level:** Run parameterized role-switching (`SET LOCAL ROLE anon` / `SET LOCAL ROLE authenticated` + simulated JWT claims) checks in SQL staging/CI against Supabase Postgres to guarantee client isolation independent of Node mocks.

### 1.1 Recommended Tooling & Scripts (To Be Added in Batch 1.1 / Batch 3.4)
- **Vitest DevDependencies:** `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `vite-tsconfig-paths`.
- **Playwright DevDependency:** `@playwright/test` (`npx playwright install chromium` baseline + `firefox`/`webkit` optional matrix).
- **Proposed `package.json` Scripts:**
  - `"typecheck": "tsc --noEmit"`
  - `"lint": "eslint ."` (already present, enforce zero-error/zero-warning exit 0)
  - `"test:unit": "vitest run"`
  - `"test:watch": "vitest"`
  - `"test:e2e": "playwright test"`
  - `"check": "npm run typecheck && npm run lint && npm run test:unit && npm run build"`

---

## 2. Detailed Test Matrix Across Architectural Layers

### 2.1 Unit & Domain Math Suite (Vitest — Node / Pure TS)

| Test Suite File (Planned) | Covered Module | Required Assertions & Edge Cases | Linked Phase / Task |
|---|---|---|---|
| `__tests__/security/redirect.test.ts` | `lib/security/redirect.ts` | Rejects `https://evil.com`, `//evil.com`, `/\evil.com`, `/%2f/evil.com`, `javascript:alert(1)`, `@evil.com`, newlines; preserves `/dashboard`, `/typing?mode=words&duration=30`, `/challenge/<uuid>` | `SEC-1.2` |
| `__tests__/typing/text-generator.test.ts` | `lib/typing/text-generator.ts` | Deterministic identical output per `(seed, mode, duration)`; `createSeed()` 12-hex pattern never empty across 1,000 runs; **0 occurrences of double space `'  '`** in `code` or any mode; `quotes` & `words` meet minimum char capacity for `15s`..`120s` | `ENG-2.3` |
| `__tests__/typing/metrics.test.ts` | `lib/typing/metrics.ts` | **1-char 60s exploit check** -> `wpm === 0`, `duration === 60`; backspaced typos stay counted in `totalInputKeystrokes` reducing Accuracy & raising Raw WPM cleanly; early text completion uses `max(1000, endTime - startTime)`; `O(N+S)` timeline accuracy; 2,500-keystroke `120s` run finalizes in `< 15ms` | `ENG-2.1` |
| `__tests__/typing/verifier.test.ts` | `lib/typing/verifier.ts` | Empty `telemetry: []` rejected (`400`); `< 10` keystrokes rejected when incomplete; cursor teleport `item.i !== cursor` rejected; non-monotonic timestamp `item.t < prev.t` rejected; `k.length > 1` rejected for `y === 0`; zero-jitter/low-IQR autotyper `< 2.5ms` stdDev rejected; inhuman `< 20ms` sustained 15-key burst rejected; recomputed `wpm`/`accuracy` ignores forged client totals | `SEC-1.4` |
| `__tests__/typing/replay-analyzer.test.ts` | `lib/typing/replay-analyzer.ts` | Compares reconstructed `targetText` vs `telemetry` inputs accurately; multi-char typo followed by multi-backspace counts each true expected character error accurately (fixing `prev.k` bug) | `SPEC-5.1` |
| `__tests__/progression/xp-and-rating.test.ts` | `lib/progression/xp.ts`, `lib/progression/rating.ts` | Day-1 streak init `0 -> 1`; same-day repeat keeps `1`; `diffDays === 1` increments + unlocks `STREAK_3` on same request; Streak Freeze saves `diffDays === 2`; accuracy-weighted Performance Rating beats low-accuracy mashing (`115 @ 98.5% > 140 @ 82%`); provisional `< 5` tests gating; self-duel never increments wins | `SEC-1.4`, `SPEC-5.3`, `SPEC-5.5`, `SPEC-5.6` |

### 2.2 Route Handler & Store Contract Tests (Vitest — Mocked Supabase / Fake Timers)

| Test Suite File (Planned) | Target | Required Assertions & Edge Cases | Linked Phase / Task |
|---|---|---|---|
| `__tests__/api/results.route.test.ts` | `app/api/results/route.ts` | Rejects unauthenticated (`401`); rejects forged `{ wpm: 350, telemetry: [] }` (`400`); inserts server-verified metrics via `createAdminClient()`; handles duplicate `clientRunId` idempotently (`200`, 1 DB row); enforces per-user cooldown rate limit (`429`); masks DB exception strings (`500`) | `SEC-1.4`, `SEC-1.7`, `ENG-2.5` |
| `__tests__/api/leaderboard.route.test.ts` | `app/api/leaderboard/route.ts` | Rejects `?duration=abc`, `?duration=999`, `?mode=hack` with `400`; ignores `?demo=true` & `?demo=false` (never returns mock `speed_demon`); masks Postgres error details on `500` | `SEC-1.3`, `SEC-1.7` |
| `__tests__/api/profile.route.test.ts` | `app/api/profile/route.ts` | Rejects short (`ab`), uppercase/symbol, or reserved (`admin`) usernames (`400`); validates `theme`, `font_family`, `timezone` enums; returns `409` on collision cleanly | `SEC-1.6` |
| `__tests__/api/challenges.route.test.ts` | `app/api/challenges/route.ts` | Rejects unowned `testResultId` (`403`/`404`); copies creator WPM exclusively from DB `test_results` (ignores client body speed) | `SEC-1.6` |
| `__tests__/stores/typing-store.test.ts` | `stores/typing-store.ts` | `performance.now()` timer catches up across simulated throttled interval gaps (`vi.useFakeTimers`); `ERROR` worker payload exits `'running'` cleanly; `startTestWithConfig` sets atomic state cleanly | `ENG-2.2` |
| `__tests__/stores/user-store.test.ts` | `stores/user-store.ts` | Default `preferences.theme === 'dark'`; `guestHistory` retains telemetry for recent 30 runs and caps total history at 100 | `ENG-2.5`, `DES-4.1` |

### 2.3 Client Component Unit Tests (Vitest + React Testing Library)

| Test Suite File (Planned) | Component | Required Assertions | Linked Phase / Task |
|---|---|---|---|
| `__tests__/components/typing-container.test.tsx` | `TypingContainer` | Android `beforeinput` `deleteContentBackward` triggers `handleBackspace` cleanly; `compositionstart`/`compositionend` commits multi-char token `"hello"` sequentially; focus on external `<button>` preserves Space/Enter activation cleanly without stealing focus | `ENG-2.4` |
| `__tests__/components/text-display.test.tsx` | `TextDisplay` | Zero words > `+4` carry `blur-[2px]`; `code` single-space separation renders zero blank phantom word spans | `ENG-2.3`, `DES-4.2` |
| `__tests__/components/result-screen.test.tsx` | `ResultScreen` | Wrapped in `<React.StrictMode>`: triggers `POST /api/results` or `addGuestResult` **strictly once** per `runId`; displays `"Personal Best"` only when strictly surpassing prior best (not arbitrary `wpm > 80`); renders real accuracy breakdown without duplicate `"Mistakes registered"` | `ENG-2.5`, `DES-4.2` |
| `__tests__/components/cat-companion.test.tsx` | `CatCompanion` | Preserves existing `localStorage['typrox_cats_unlocked']` items when unlocking a new milestone cat | `ENG-2.5` |
| `__tests__/components/username-modal.test.tsx` | `UsernameModal` | Has `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, autofocuses username field, traps Tab inside dialog | `DES-4.3` |

### 2.4 End-to-End Integration & UI Resilience Tests (Playwright)

Executed against built production app (`npm run build && npm run start`):

1. **Security & Route Boundary Spec (`tests/e2e/security.spec.ts`):**
   - `GET /api/debug/supabase` and `GET /api/test-supabase` return `404`.
   - `GET /auth/callback?next=https://evil.com` & `//evil.com` never issue `Location` header pointing off-origin.
   - `GET /dashboard?demo=true` & `GET /profile` with manual `typrox_demo_logged_in=true` cookie redirect to `/login`.
   - Security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`) present on `/` & `/typing`.
2. **Core Typing Loop & Web Worker Spec (`tests/e2e/typing-arena.spec.ts`):**
   - Visit `/typing?mode=words&duration=15`; record initial Y coordinate of `[aria-label="Typing input area"]`; type first character -> verify Y coordinate shift `<= 1px` (`UX-01`), verify countdown & live WPM remain visible & readable (`opacity: 1`).
   - Verify words past index `+4` have zero CSS `blur` filter (`UX-02`).
   - Complete 1-character + wait 15s test via fake clock or short test -> ResultScreen WPM is `0`, NOT `200`.
   - Switch to `code` & `quotes` -> verify no double spaces `'  '` in rendered target text and adequate prompt length for duration.
3. **Theme Hydration, Accessibility & Mobile Breakpoint Spec (`tests/e2e/responsive-theme.spec.ts`):**
   - Clear `localStorage`: initial load renders `.dark` class with matching **Sun** toggle icon; single click switches to light mode (`#F5F5F7`), **Navbar**, `Hero3D`, `CatCompanion`, and **Leaderboard** show zero contrast or dark-on-dark regressions.
   - Audit mobile `375x812` across `/`, `/typing`, `/leaderboard`, `/dashboard`, `/login`, `/profile`: verify `document.documentElement.scrollWidth <= window.innerWidth` (0 horizontal overflow!), mode pills wrap cleanly without clipping, mobile navigation drawer toggles cleanly with updated `aria-expanded`.
   - Tab-key walkthrough on `/`, `/typing`, and `/login` confirming visible `:focus-visible` indicator and zero keyboard trap on interactive buttons.
4. **Public SSR, Navigation & Challenge/Replay Flows (`tests/e2e/public-flows.spec.ts`):**
   - `/` loads without fabricated `"Alex M."` testimonials, without Navbar `"online"` simulation, and pauses offscreen `Hero3D` animation intervals cleanly.
   - `/leaderboard` renders honest empty CTA or verified records, switches tabs without `NaN` crashes, links cleanly to `/u/[username]`.
   - `/profile` accessible from nav (authenticated mock/staging test) with working font switcher + WebAudio sound volume slider.
   - Expired `/challenge/<expired-uuid>` displays clean expiration recovery page.

---

## 3. PostgreSQL Row Level Security (RLS) Verification Checklist

Execute inside local/staging Supabase (`supabase test db` or SQL Editor rollback transaction `BEGIN; ... ROLLBACK;`) immediately after applying `20260621000000_security_hardening_reconcile.sql`:

```sql
BEGIN;
-- 1. Verify anon cannot insert/update/delete any sensitive table
SET LOCAL ROLE anon;
-- Expected: permission denied / new row violates RLS (42501) on EVERY command below:
-- INSERT INTO public.test_results (wpm, raw_wpm, accuracy, consistency, error_count, backspace_count, mode, duration, seed) VALUES (300, 300, 100, 100, 0, 0, 'words', 30, 'forged');
-- INSERT INTO public.challenge_links (mode, duration, seed) VALUES ('words', 30, 'forged');

-- 2. Verify anon cannot dump replays telemetry table
SELECT count(*) FROM public.replays; -- Expected: 0 rows

-- 3. Verify authenticated user cannot spoof scores, streaks, achievements, or challenges via PostgREST
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
-- Expected 42501 on all 4 commands:
-- INSERT INTO public.test_results (user_id, wpm, raw_wpm, accuracy, consistency, error_count, backspace_count, mode, duration, seed) VALUES ('00000000-0000-0000-0000-000000000001', 350, 350, 100, 100, 0, 0, 'words', 30, 'forged');
-- UPDATE public.streaks SET current_streak = 999 WHERE user_id = '00000000-0000-0000-0000-000000000001';
-- INSERT INTO public.user_achievements (user_id, achievement_id) SELECT '00000000-0000-0000-0000-000000000001', id FROM public.achievements LIMIT 1;
-- INSERT INTO public.challenge_links (creator_id, creator_wpm, mode, duration, seed) VALUES ('00000000-0000-0000-0000-000000000001', 350, 'words', 30, 'forged');

-- 4. Verify leaderboard_view excludes anonymous & invalidated rows
RESET ROLE;
SELECT count(*) FROM public.leaderboard_view WHERE user_id IS NULL OR is_invalidated = true; -- Expected: 0
ROLLBACK;
```

---

## 4. Phase Exit & Acceptance Gate Criteria Summary

No downstream phase starts until the preceding phase passes **all** gate assertions below:

| Phase | Mandatory Exit Acceptance Gates | Automated Gate Command |
|---|---|---|
| **Phase 1: Security & Integrity** | 1. Direct PostgREST inserts to `test_results`, `replays`, `streaks`, `user_achievements`, `challenge_links` return `42501` under `anon` and `authenticated`.<br>2. `POST /api/results` recomputes all metrics server-side from verified `(seed, telemetry)` and blocks empty/forged/1-char exploit telemetry.<br>3. `/api/debug/supabase`, `/api/test-supabase` return `404`; `?demo=true` bypass returns `307` to `/login`; `/auth/callback` blocks off-origin redirects.<br>4. Production DB read-only audit run cleanly + `__debug_test__` purged + `leaderboard_view` uses `security_invoker=true`. | `npm run typecheck && npm run test:unit && npm run build` + RLS verification transaction + Playwright security spec |
| **Phase 2: Typing Engine Reliability** | 1. Client live/final metrics match server verifier identically across worked Cases A, B, C.<br>2. Countdown driven by `performance.now()` deadline; no `'  '` double-space bugs; multi-quote length scales with timer.<br>3. Android Gboard `deleteContentBackward`, IME composition, and desktop focus exemption verified.<br>4. Zero duplicate StrictMode POSTs; authentic PB delta check; `/challenge/[id]` saves challenger run; `CatCompanion` preserves unlocks. | `npm run test:unit` (metrics, text-gen, stores, RTL) + Playwright `typing-arena.spec.ts` |
| **Phase 3: Engineering Quality & Perf** | 1. `npm run lint` exits `0` (**0 errors, 0 warnings**).<br>2. Zero explicit `any` types; full generated DB types; all React 19 compiler/effect errors resolved.<br>3. Dead artifacts removed; `/profile` linked & functional; public routes use Server Component DAL + `generateMetadata`; `Hero3D` offscreen interval count = `0`; `error.tsx` & `loading.tsx` skeletons present.<br>4. Security headers verified cleanly in response. | `npm run typecheck && npm run lint && npm run test:unit && npm run build && npm run test:e2e` |
| **Phase 4: Design System & UX** | 1. Zero broken tokens (`warning`, `surface-hover`, `neutral-850`, `bauhaus-*`, indigo shadows).<br>2. Primary orange CTA contrast `>= 6.5:1` (`#0F0F10` on `#FF5C00`); muted ink `>= 4.5:1` both modes; theme toggle aligned from initial load.<br>3. Active typing preserves timer/WPM visibility with zero layout shift (`<= 1px`) and zero look-ahead blur.<br>4. Unified editorial cards on all routes; full modal/menu ARIA semantics; zero `375px` mobile horizontal overflow; zero fake testimonials/metrics. | Playwright `responsive-theme.spec.ts` + visual review in Light & Dark modes across desktop (`1280px`) & mobile (`375px`) |
| **Phase 5: Product Differentiation** | 1. Verified weak-key telemetry drives working `?mode=drill` exercises.<br>2. `/learn` progression saves server-verified stars/completions gated by accuracy.<br>3. `user_progression` XP/Level + Streak Freeze + `/daily` daily challenge operate purely server-side without column tamper.<br>4. `challenge_attempts`, Seasonal Rating Ladder, `follows`, 365-day `/u/[username]` heatmap, `/replay/[id]` viewer, and `/compare` work cleanly at verified data scale. | Full Vitest + Playwright E2E suite + RLS validation on all new Phase 5 tables (`user_lesson_progress`, `user_progression`, `challenge_attempts`, `season_standings`, `follows`) |

