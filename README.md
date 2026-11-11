# TyProX

> *"Every keystroke makes you better."*

TyProX is a full-stack typing practice, structured skill curriculum, and competitive benchmarking web application built with Next.js App Router, TypeScript, Tailwind CSS v4, Zustand, and Supabase.

---

## 1. What TyProX Does

TyProX combines a deterministic client/server typing test engine with offline-friendly guest storage and optional cloud synchronization:

- **Anonymous visitors** can practice across all typing modes, complete the 12-module curriculum, inspect replay-based keyboard/finger analytics in Performance Lab, and store session telemetry in browser `localStorage` without creating an account.
- **Authenticated users** (via Google or GitHub OAuth) sync verified ranked runs from raw keystroke telemetry on the server (`POST /api/results` and `POST /api/results/sync`), unlock database achievements, maintain UTC streaks, publish public profiles (`/u/[username]`), compete on verified leaderboards (`/leaderboard`), and generate 7-day 1v1 challenge links (`/challenge/[id]`).

---

## 2. Core Features

Verified directly against application source code:

- **Typing Practice Arena (`/typing`):**
  - Five ranked modes (`words`, `quotes`, `numbers`, `punctuation`, `code`) across `15s`, `30s`, `60s`, and `120s` brackets, plus unranked `drill`, `lesson`, and `daily` modes.
  - Deterministic PRNG prompt generation from a shared `seed` (`lib/typing/text-generator.ts`), Web Worker telemetry computation (`workers/analytics.worker.ts`) with main-thread fallback, paste blocking (`onPaste`), mechanical/soft/typewriter audio synthesis (`lib/audio/keystroke-sound.ts`), per-second WPM timeline charts (`recharts`), and interactive keystroke replay playback (`ReplayPlayer`).
- **Landing Showcase (`/`):**
  - Interactive 3D-perspective ANSI 60% hero keyboard (`components/home/hero-3d.tsx`) responding to physical key presses with RGB lighting modes, plus visual comparisons, achievement showcases, and FAQ.
- **Structured Curriculum (`/learn`, `/learn/[slug]`):**
  - 12 progressive lessons organized across 4 tracks (`Foundations`, `Fluency`, `Precision`, `Developer`) in `constants/curriculum.ts`, gated sequentially behind `>= 92%` accuracy targets and scored with 1–3 star mastery ratings.
- **Daily UTC Challenge (`/daily`):**
  - Shared daily prompt keyed deterministically to the current UTC date (`daily-YYYY-MM-DD`) with a live countdown to the next UTC midnight reset and local/cloud completion tracking.
- **Performance Lab (`/dashboard/performance-lab`):**
  - Reconstructs key-speed heatmaps, most-missed keys, left/right hand load balance, individual finger workload distribution, and slowest bigram transitions from saved telemetry (`lib/typing/replay-analyzer.ts`), launching targeted practice drills (`/typing?mode=drill&targets=...`).
- **Leaderboards, Profiles & 1v1 Challenges:**
  - **Leaderboards (`/leaderboard` & `GET /api/leaderboard`):** Filterable by mode, duration, and timeframe (`daily`, `weekly`, `all_time`), backed by `public.leaderboard_view` and live updates via Supabase Realtime when configured.
  - **Public Profiles (`/u/[username]`):** Aggregated ranked WPM stats, streaks, achievement badges, and recent verified runs.
  - **1v1 Challenge Links (`/challenge/[id]` & `POST /api/challenges`):** 7-day shareable challenge rooms pinned to the creator's exact `(mode, duration, seed)` and target score.
  - **Dashboard & Preferences (`/dashboard`, `/profile`):** Personal trends, guest-to-cloud history batch synchronization, one-time locked custom username onboarding (`UsernameModal`), dark/light theme selection, monospace typing fonts (`JetBrains Mono`, `IBM Plex Mono`, `Geist Mono`), sound settings, and the optional session-end Focus Cat companion (`CatCompanion`).

---

## 3. Product Preview & Visual Assets

- Static image screenshots are intentionally not checked into the repository.
- Custom vector achievement badge icons (`default.svg`, `speed_{50,75,80,100,120,140,150}.svg`, `streak_{3,7,14,30}.svg`) live in [`public/achievements/`](./public/achievements/).
- Interactive screens (including the 3D CSS hero keyboard, typing workspace, replay player, and Performance Lab heatmaps) can be previewed live by running the local server via `npm run dev`.

---

## 4. Technology Stack

| Layer | Technologies |
|---|---|
| **Framework & Routing** | Next.js `16.4.6` (App Router, `proxy.ts` session middleware, Route Handlers) |
| **UI & Styling** | React `19.2.4`, TypeScript `5`, Tailwind CSS `v4`, Framer Motion, Lucide React, Recharts, Canvas Confetti |
| **Client State & Workers** | Zustand `v5` (`useTypingStore`, `useUserStore`, `useToastStore`), Web Worker analytics |
| **Backend & Database** | Supabase PostgreSQL, Row Level Security (`RLS`), PL/pgSQL `SECURITY DEFINER` RPCs, `@supabase/ssr` + `@supabase/supabase-js`, Zod `v4` |
| **Testing & CI** | Vitest + Testing Library + jsdom, Playwright (Chromium E2E), Docker/PostgreSQL 16 verification harness, GitHub Actions |

---

## 5. Architecture Overview

1. **Client & Store Layer (`components/`, `stores/`, `workers/`):** Captures keystrokes with high-resolution relative timestamps (`t`, `k`, `y`, `i`), updates live metrics via `workers/analytics.worker.ts`, and persists guest runs in browser `localStorage`.
2. **Next.js Proxy & App Layer (`proxy.ts`, `app/`):** Refreshes Supabase SSR auth cookies through `lib/supabase/middleware.ts` without blocking guest-capable routes, while Server Components load public leaderboards, profiles, and active challenge rooms.
3. **API & Verification Layer (`app/api/`, `lib/security/`, `lib/typing/verifier.ts`):**
   - Validates `Origin` headers and JSON byte bounds (`lib/security/http.ts`), authenticates sessions with `supabase.auth.getUser()`, validates payloads with `zod`, enforces rate limits (`lib/security/rate-limit.ts`), regenerates prompts server-side from `(seed, mode, duration)`, checks cursor continuity and physical plausibility bounds, and delegates authoritative persistence to `persistVerifiedResult()` (`lib/typing/persistence.ts`).
4. **PostgreSQL & RLS Layer (`supabase/migrations/`):**
   - Client roles (`anon`, `authenticated`) have read-only access to approved views/tables (plus strictly column-scoped `profiles` preference updates).
   - Ranked writes, replay persistence, streak advancement, and achievement unlocking execute atomically inside `public.submit_verified_result(...)` via `SUPABASE_SERVICE_ROLE_KEY`.

---

## 6. Project Structure

```text
.
├── app/                         # Next.js App Router pages, API routes, metadata & error boundaries
│   ├── api/                     # Route Handlers (/api/auth/signout, /challenges, /leaderboard, /profile, /results, /results/sync)
│   ├── auth/callback/           # OAuth PKCE code exchange & sanitized redirect route
│   └── ...                      # Page routes (/, /typing, /learn, /daily, /leaderboard, /dashboard, /profile, /challenge/[id], /u/[username])
├── components/                  # React components grouped by feature (home, typing, learn, daily, dashboard, leaderboard, auth, ui)
├── constants/                   # Curriculum lessons (curriculum.ts) and word/quote/code prompt corpora (dictionaries.ts)
├── lib/                         # Core domain logic: typing metrics/verifier/persistence, security helpers, Supabase clients, data loaders
├── stores/                      # Zustand state stores (typing-store.ts, user-store.ts, toast-store.ts)
├── workers/                     # Web Worker keystroke analytics (analytics.worker.ts)
├── types/                       # TypeScript Supabase schema types (database.ts)
├── supabase/
│   ├── migrations/              # Ordered SQL migrations (20260618 through 20260622)
│   └── reference/               # Legacy baseline snapshot (FULL_SCHEMA.sql — reference only)
├── __tests__/                   # Vitest unit, component, and API route test suites
├── tests/
│   ├── db/                      # PostgreSQL 16 Docker migration & RLS verification harness
│   └── e2e/                     # Playwright Chromium E2E test suite
├── public/achievements/         # 12 SVG badge icons
├── docs/                        # Documentation index, security audit, roadmaps, and baseline audits
├── COPYRIGHT.md                 # Proprietary notice, visibility status & third-party license list
└── OAUTH_SETUP.md               # Step-by-step Google/GitHub OAuth + Supabase callback configuration
```

---

## 7. Local Development Setup

### Prerequisites

- **Node.js `22+`** (matches `.github/workflows/ci-app-quality.yml`) and `npm`
- **A Supabase project** (or placeholder env values when developing UI-only views offline)
- **Docker** *(optional, only required to execute the PostgreSQL 16 database test harness locally via `npm run test:db`)*

### Steps

```bash
git clone https://github.com/Rudra4451/practice.git
cd practice
npm install
cp .env.example .env.local
```

Populate `.env.local` with your Supabase development project credentials (never commit `.env.local`), then start the dev server:

```bash
npm run dev
```

Open `http://localhost:3000`. Guest typing, curriculum, daily prompt, and local Performance Lab analytics operate immediately even without signing in; OAuth login, ranked cloud submission, and shared leaderboards require valid Supabase credentials.

---

## 8. Environment Variables

Defined in [`.env.example`](./.env.example):

| Variable | Scope | Required When | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Public** (client + server) | Always for Supabase connectivity (dummy `https://example.supabase.co` works for CI/offline builds) | Base URL of your Supabase project (`https://<ref>.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Public** (client + server) | Always for Supabase connectivity | Public anonymous key for RLS-scoped browser and SSR reads. |
| `NEXT_PUBLIC_SITE_URL` | **Public** (client + server) | **Required in production** (defaults to `http://localhost:3000` in `.env.example`, falls back to `https://typrox.vercel.app` in `lib/seo/site-url.ts`) | Canonical origin used for SEO `metadataBase`, `sitemap.xml`, `robots.txt`, and server-side same-origin `Origin` checks. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-Only (Secret)** | **Required in production** and after applying `20260621`+ hardening migrations | Powers `createAdminClient()` for atomic `submit_verified_result(...)` RPC calls, one-time username assignment, and 1v1 challenge inserts. |

### Local vs. Production Differences

- **Never** expose `SUPABASE_SERVICE_ROLE_KEY` with a `NEXT_PUBLIC_` prefix or bundle it into client code (`lib/supabase/admin.ts` enforces `import 'server-only'`).
- In **development (`NODE_ENV !== 'production'`)**, if `SUPABASE_SERVICE_ROLE_KEY` is omitted, `resolvePrivilegedWriteClient()` logs a one-time security warning and allows caller-session fallback against pre-hardening schemas. In **production (`NODE_ENV === 'production'`)**, missing `SUPABASE_SERVICE_ROLE_KEY` **fails closed** with HTTP `503 ADMIN_CONFIG_MISSING` on privileged write endpoints (`POST /api/results`, `POST /api/results/sync`, `POST /api/challenges`, and username updates on `PATCH /api/profile`).

---

## 9. Supabase Setup & Database Migrations

Apply migrations in strict chronological order against your target **staging or development** Supabase database first. **Never run unverified migrations directly against a production database without taking a verified backup, inspecting live objects (`pg_policies`, `pg_proc`), and confirming green CI on the PostgreSQL 16 verification suite.**

### Ordered Migrations (`supabase/migrations/`)

1. `supabase/migrations/20260618000000_init_schema.sql` — Base tables (`profiles`, `test_results`, `replays`, `streaks`, `daily_challenges`, `challenge_links`, `user_challenge_progress`, `achievements`, `user_achievements`), initial RLS policies, and auth signup trigger.
2. `supabase/migrations/20260619000000_audit_hardening.sql` — Initial invalidation flag (`is_invalidated`) and challenge/constraint hardening.
3. `supabase/migrations/20260620100000_leaderboard_view.sql` — Ranked `public.leaderboard_view` query optimization.
4. `supabase/migrations/20260621000000_typrox_2_hardening.sql` — Consolidated atomic (`BEGIN; ... COMMIT;`) hardening transaction: `client_run_id` / `is_ranked` columns, historical outlier quarantine (`is_ranked = FALSE`), least-privilege column/table grants, privacy RLS on `replays`, `SECURITY INVOKER` `leaderboard_view`, reserved/locked username triggers, dynamic `pg_proc` `EXECUTE` revocation, and atomic `submit_verified_result(...)` RPC.
5. `supabase/migrations/20260622000000_learning_and_competitive_ecosystem.sql` — Ecosystem tables (`user_progression`, `user_lesson_progress`, `challenge_attempts`), select-only client grants, and non-expired challenge read policies.

> [!NOTE]
> [`supabase/reference/FULL_SCHEMA.sql`](./supabase/reference/FULL_SCHEMA.sql) is a legacy reference snapshot retained solely for historical comparison and migration-upgrade testing (`tests/db/verify_migrations.sql`). Do **not** place it in `supabase/migrations/` or run it on an active database.

Using the Supabase CLI on a linked project:

```bash
supabase db push
```

Verify post-migration schema cache reload if running SQL manually:

```sql
NOTIFY pgrst, 'reload schema';
```

---

## 10. Authentication Configuration

TyProX uses **Google** and **GitHub** OAuth via Supabase Auth with server-validated sessions (`/auth/callback` + `supabase.auth.getUser()`).

1. Follow the full step-by-step instructions in [OAUTH_SETUP.md](./OAUTH_SETUP.md).
2. In Supabase **Authentication -> URL Configuration**, set **Site URL** to your primary origin and add explicit **Redirect URLs** for `http://localhost:3000/auth/callback` and your production origin's `/auth/callback`.
3. `?next=` redirect targets are sanitized strictly on the server via `sanitizeRedirectPath()` (`lib/security/redirect.ts`) to prevent open redirects.
4. Newly registered accounts receive a temporary handle (`user_<hex>`) from `handle_new_user()`, triggering a one-time username onboarding modal that locks permanently once chosen.

---

## 11. Testing Instructions

| Command | Scope & Prerequisites |
|---|---|
| `npm run test:unit` | Runs all 27 Vitest suites (`__tests__/`) across security utilities, API route handlers, typing engine/verifier, stores, and React components (no external DB required). |
| `npm run test:watch` | Runs Vitest interactively during development. |
| `npm run test:e2e` | Launches an isolated built production server (`npx next start -H 127.0.0.1 -p 3105`) and runs Playwright Chromium E2E tests (`tests/e2e/typrox.spec.ts`). Requires a completed `npm run build` first. Note: Against a live `.env.local` with Google/GitHub avatar URLs on leaderboards, Playwright requires outbound CDN connectivity within `5s` for `<img>` checks; offline CI runs with `NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co`. |
| `npm run test:db` | Executes `sh tests/db/run-pg-verification.sh` against PostgreSQL 16 (Clean Bootstrap, `FULL_SCHEMA.sql` Baseline Upgrade, and Drift/Idempotency scenarios). Requires **Docker** (`docker compose -f docker-compose.db.yml run --rm verify`) or Linux `psql`/`pg_isready` + POSIX `sh`. |

---

## 12. Build and Lint Commands

```bash
npm run typecheck            # tsc --noEmit --incremental false
npm run lint                 # ESLint across app & tests
npx next build --webpack     # Production Webpack parity build
npm run build                # Default Next.js Turbopack production build
npm run start                # Serve production build locally
```

CI workflows in [`.github/workflows/`](./.github/workflows/) enforce these checks on pushes and pull requests (`quality-and-e2e` and `verify-postgres-16`).

---

## 13. Deployment Instructions

1. **Hosting Environment (e.g., Vercel):**
   - Connect the repository and ensure Node `22` build runtime.
   - Set **all** environment variables in your hosting project settings: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` (exact canonical `https://...` domain), and `SUPABASE_SERVICE_ROLE_KEY` (server-only, encrypted).
2. **Database & Deployment Coordination:**
   - The Next.js `lib/data/` and `lib/typing/` modules contain backward-compatible column/view fallbacks so deploying the app **before** applying `20260621`+`20260622` avoids `PGRST200`/`PGRST205` outages during cutover, provided `SUPABASE_SERVICE_ROLE_KEY` is already configured.
   - Always test migrations in staging or via CI PostgreSQL 16 verification first, back up production data before schema changes, and reload PostgREST schema cache (`NOTIFY pgrst, 'reload schema';`) after applying migrations.
3. **OAuth Callback Allowlist:** Confirm your deployed `https://<your-domain>/auth/callback` URL is allowlisted under Supabase **Authentication -> URL Configuration**.

---

## 14. Security Information

- Ranked scores are recomputed and anti-cheat-checked server-side from keystroke telemetry; anonymous/client-supplied WPM summaries are never persisted as verified runs.
- Privileged database writes fail closed (`503`) in production if `SUPABASE_SERVICE_ROLE_KEY` is absent; direct `authenticated`/`anon` client writes to scores, replays, streaks, achievements, and `profiles.username` are revoked at PostgreSQL + RLS level.
- Mutating routes validate same-origin `Origin` headers, bound JSON body bytes before parsing, and enforce rate limits.
- HTTP responses include CSP (`Content-Security-Policy`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy`.
- Full security audit, dependency findings, and GitHub protection status are documented in [`docs/security/SECURITY_AND_OWNERSHIP.md`](./docs/security/SECURITY_AND_OWNERSHIP.md).

---

## 15. Contribution Policy

This is a proprietary personal software project with all rights reserved. External pull requests, redistribution, commercial use, or derivative works are not solicited or permitted without prior written permission from the copyright owner.

---

## 16. Licensing and Copyright

- **Repository License:** None (proprietary — intentionally no MIT, Apache, GPL, BSD, or other permissive license).
- Absent an open-source license, no permission to copy, modify, redistribute, or create derivative works is granted, subject to applicable law and third-party dependency licenses.
- See [`COPYRIGHT.md`](./COPYRIGHT.md) for the formal notice, owner-approval gate (`[Copyright Owner]`), public-vs-private GitHub visibility considerations, and full third-party open-source attribution list (`MIT`, `ISC`, `Apache-2.0`, optional `@img/sharp*` `LGPL-3.0-or-later`, `CC-BY-4.0`, `MPL-2.0`, and open fonts).

---

## 17. Contact & Project Ownership

- **Repository:** [`github.com/Rudra4451/practice`](https://github.com/Rudra4451/practice)
- **GitHub Maintainer Account:** [`@Rudra4451`](https://github.com/Rudra4451)
- **Legal Copyright Owner:** `[Copyright Owner]` *(pending final owner confirmation in [`COPYRIGHT.md`](./COPYRIGHT.md); commit history author recorded as Rudra Pratap Swain)*.
