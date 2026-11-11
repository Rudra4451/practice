# TyProX

> *"Every keystroke makes you better."*

TyProX is a deliberate typing skill development and competitive benchmarking platform built with **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS v4**, **Zustand**, and **Supabase**.

## Core Features

- **Server-Verified Typing Engine:** Deterministic PRNG prompts (`words`, `quotes`, `numbers`, `punctuation`, `code`), zero-lag keystroke telemetry (`Web Worker` analytics), per-second consistency curves, paste-guarded test inputs, and replay playback.
- **Structured Curriculum (`/learn`):** Guided skill progression modules spanning Home Row foundations through code syntax, gated by accuracy targets (`>= 92%`) and 3-star ratings.
- **Daily Challenge (`/daily`):** Synchronized UTC seed prompt shared across all typists with countdown timer and personal best tracking.
- **Performance Lab (`/dashboard/performance-lab`):** Replay-verified keyboard heatmap, finger load distribution, slowest bigram transitions, and targeted weak-key practice drills.
- **Competitive Leaderboards (`/leaderboard`):** Verified rankings filtered by mode, duration, and timeframe, backed by public typist profiles (`/u/[username]`) and 1v1 challenge links (`/challenge/[id]`).

## Tech Stack

- **Framework:** Next.js 16.4 (`App Router`, `proxy.ts` session middleware)
- **Language:** TypeScript (strict), React 19
- **Styling:** Tailwind CSS v4 + WCAG AA verified dark & light design tokens
- **State:** Zustand v5 (`useTypingStore`, `useUserStore`, `useToastStore`)
- **Backend & Auth:** Supabase Postgres, Row Level Security, Realtime, SSR cookies, Google/GitHub OAuth
- **Testing:** Vitest + React Testing Library + Playwright E2E + PostgreSQL 16 migration harness

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `.env.local` and supply your project values (never commit `.env.local`):
   ```bash
   cp .env.example .env.local
   ```
   - `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase public anon key
   - `NEXT_PUBLIC_SITE_URL`: Canonical origin used for metadata, `sitemap.xml`, `robots.txt`, and origin validation (e.g. `http://localhost:3000` locally, production origin in hosting)
   - `SUPABASE_SERVICE_ROLE_KEY`: Server-only secret required in production for verified result/challenge RPC writes and onboarding username assignment (never exposed to browser bundles or committed to Git)

   See [OAUTH_SETUP.md](./OAUTH_SETUP.md) for configuring Google/GitHub OAuth providers and Supabase redirect URLs.

3. **Run development server:**
   ```bash
   npm run dev
   ```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start local development server |
| `npm run build` | Run Next.js production build (default Turbopack) |
| `npx next build --webpack` | Run Next.js production build with Webpack parity type validation |
| `npm run start` | Serve built production application |
| `npm run lint` | Run ESLint across the repository |
| `npm run typecheck` | Run strict `tsc --noEmit --incremental false` |
| `npm run test:unit` | Execute Vitest unit, component, and API route tests |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:db` | Run the 3-scenario PostgreSQL 16 migration & RLS verification harness (`tests/db/run-pg-verification.sh`) |
| `npm run test:e2e` | Run Playwright Chromium end-to-end tests on isolated `http://127.0.0.1:3105` |

## CI & Production Database Cutover Gate

- **[`.github/workflows/ci-app-quality.yml`](.github/workflows/ci-app-quality.yml):** Runs workflow line-ending validation, `typecheck`, `lint`, `test:unit`, `next build --webpack`, `npm run build`, and Playwright Chromium E2E tests.
- **[`.github/workflows/ci-postgres-verification.yml`](.github/workflows/ci-postgres-verification.yml):** Boots PostgreSQL 16 in Docker and executes all 3 scenarios in `tests/db/run-pg-verification.sh` (clean bootstrap, legacy `FULL_SCHEMA.sql` upgrade, and drift/idempotent rerun verification).
- **Production Database Gate:** Schema hardening (`supabase/migrations/20260621000000_typrox_2_hardening.sql` and `20260622000000_learning_and_competitive_ecosystem.sql`) must be reviewed, backed up, and applied by the database owner alongside provisioning `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SITE_URL` in hosting before cutting over production.
