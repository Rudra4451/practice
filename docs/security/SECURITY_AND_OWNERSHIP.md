# TyProX — Final Security Audit, Access Control & GitHub Ownership Report

**Audit Date:** 2026-11-12  
**Branch Reviewed:** `release/typrox-final-cleanup` (branched from `main` @ `45bd21d`)  
**Repository:** `https://github.com/Rudra4451/practice`  
**Production Database & Deployments:** Read-only code/configuration review; zero production SQL executed, zero deployments triggered, and `.env.local` secrets never printed.

---

## 1. Secrets, Environment & Git History Audit

### 1.1 Findings

| Check | Result | Verification Basis |
|---|---|---|
| `.gitignore` coverage | **PASS** | [`.gitignore`](../../.gitignore) ignores `.env*` while whitelisting `!.env.example`, alongside `.next/`, `out/`, `build/`, `*.pem`, `/coverage`, `/test-results/`, `/playwright-report/`. |
| `.env.local` variable hygiene | **PASS** | Exists locally (untracked/gitignored). Contains only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; secret values withheld. |
| `.env.example` placeholder safety | **PASS** | Contains placeholders only (`https://your-project-ref.supabase.co`, `your-supabase-anon-key`, `http://localhost:3000`, and commented `# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key`). |
| OAuth guide sanitization | **FIXED** | [`OAUTH_SETUP.md`](../../OAUTH_SETUP.md) previously hardcoded a specific Supabase project subdomain (`gbovkejymfeiqgverzfr` — public URL ref, not a secret). Replaced with `<your-supabase-project-ref>`. |
| Git history secret scan | **PASS** | Full 50-commit history scanned for JWT/key/token patterns (`eyJhbGciOi`, `BEGIN PRIVATE KEY`, `sk_live_`, `ghp_`, `AIza`, `sbp_`) and historical `.env*` commits: **0 secrets found**; only `.env.example` appears in `.env*` commit history. |
| Service-role bundle isolation | **PASS** | `SUPABASE_SERVICE_ROLE_KEY` and [`lib/supabase/admin.ts`](../../lib/supabase/admin.ts) (`import 'server-only'`) are imported strictly in [`lib/supabase/admin.ts`](../../lib/supabase/admin.ts) and four Server Route Handlers ([`POST /api/results`](../../app/api/results/route.ts), [`POST /api/results/sync`](../../app/api/results/sync/route.ts), [`POST /api/challenges`](../../app/api/challenges/route.ts), [`PATCH /api/profile`](../../app/api/profile/route.ts)). |
| Privileged fail-closed contract | **PASS** | [`resolvePrivilegedWriteClient()`](../../lib/supabase/admin.ts#L105-L129) throws `AdminConfigurationError` (HTTP `503 ADMIN_CONFIG_MISSING`) in `NODE_ENV === 'production'` when `SUPABASE_SERVICE_ROLE_KEY` is absent, never falling back silently to an unprivileged client in production. |

### 1.2 Operational Notes
- `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SITE_URL` must be configured in production hosting (e.g., Vercel Environment Variables) and **never** prefixed with `NEXT_PUBLIC_`.
- No exposed production secret requiring emergency rotation was detected in repository history or tracked files.

---

## 2. Supabase Schema, RLS, RPC & Data Access Audit

Verified directly against [`supabase/migrations/`](../../supabase/migrations/) (`20260618` through `20260622`), [`tests/db/verify_migrations.sql`](../../tests/db/verify_migrations.sql), and application routes:

- **Row Level Security (`RLS`) & Least-Privilege Grants (`20260621` & `20260622`):**
  - RLS enabled across `profiles`, `test_results`, `replays`, `streaks`, `daily_challenges`, `challenge_links`, `user_challenge_progress`, `achievements`, `user_achievements`, `user_progression`, `user_lesson_progress`, and `challenge_attempts`.
  - Direct client `INSERT`/`UPDATE`/`DELETE` grants and permissive policies on `test_results`, `replays`, `streaks`, `challenge_links`, `user_challenge_progress`, `achievements`, `user_achievements`, `user_progression`, `user_lesson_progress`, and `challenge_attempts` are revoked from `PUBLIC`, `anon`, and `authenticated`.
  - Column-level `UPDATE` on `public.profiles` is restricted to `(display_name, avatar_url, theme, font_family, updated_at)` for `authenticated`, preventing direct REST mutation of `profiles.username`.
  - Database trigger `trg_enforce_profile_username_integrity` enforces lowercase alphanumeric+underscore format (`^[a-z0-9_]{3,24}$`), blocks reserved handles (`is_reserved_username`), blocks temporary placeholders (`^user_[0-9a-f]{8}(_[0-9a-f]{4,8})?$`), and locks custom usernames once set (`SQLSTATE 42501`).
- **Telemetry & Replay Privacy:**
  - `public.replays` `SELECT` RLS restricts telemetry access strictly to `tr.user_id = auth.uid()`, preventing anonymous/cross-user keystroke telemetry scraping.
  - `public.test_results` `SELECT` policy exposes only non-invalidated user rows (`is_invalidated = FALSE AND user_id IS NOT NULL`) or the owner's own rows (`auth.uid() = user_id`).
  - `public.challenge_links` and `public.challenge_attempts` `SELECT` policies expose active, non-expired challenges only (`expires_at > now()`).
- **Leaderboard View Security:**
  - `public.leaderboard_view` uses `WITH (security_invoker = true)`, excludes anonymous/invalidated/unranked (`is_ranked = FALSE`) runs, and enforces one highest-WPM entry per `(user_id, mode, duration)`.
- **Routine Execute Privileges & `SECURITY DEFINER` Hardening:**
  - Dynamic `pg_proc` sweep revokes `EXECUTE` on all non-extension `public` routines from `PUBLIC`, `anon`, and `authenticated`.
  - `handle_new_user()` and `submit_verified_result(...)` use `SECURITY DEFINER` with explicit `SET search_path = public, pg_catalog`. `EXECUTE` on `submit_verified_result(...)` and `is_reserved_username(TEXT)` is granted exclusively to `service_role`.
- **PostgreSQL 16 Verification Coverage ([`.github/workflows/ci-postgres-verification.yml`](../../.github/workflows/ci-postgres-verification.yml)):**
  - Note: A CI workflow trigger bug in `ci-postgres-verification.yml` previously restricted `pull_request` execution via `paths:`, which deadlocked required branch-protection status check `verify-postgres-16` on non-SQL PRs. Fixed in this release so `verify-postgres-16` runs on every PR to `main`.

---

## 3. Application API, Anti-Cheat, XSS, Redirect & Header Audit

- **Server-Side Score Verification ([`lib/typing/verifier.ts`](../../lib/typing/verifier.ts)):**
  - Reconstructs prompts deterministically via `generateText(seed, mode, duration)` on the server; never trusts client-reported WPM, raw WPM, or accuracy.
  - Validates monotonic telemetry timestamps, bounded duration windows (`(duration + 20) * 1000` ms), exact character cursor progression, deletion index invariants, sliding 15-keystroke burst speed (`>= 20ms/char` average), constant-cadence autotyper detection (`stdDev < 2.0` ms over `>= 15` intervals), minimum completion duration (`>= 3000ms`), and server-recomputed human ceilings (`wpm <= 260`, `rawWpm <= 320`).
  - Paste actions (`onPaste`) are blocked on [`TypingContainer`](../../components/typing/typing-container.tsx) and [`LessonRunnerClient`](../../components/learn/lesson-runner-client.tsx).
- **CSRF / Same-Origin & Payload Bounds ([`lib/security/http.ts`](../../lib/security/http.ts)):**
  - All state-changing POST/PATCH routes ([`/api/results`](../../app/api/results/route.ts), [`/api/results/sync`](../../app/api/results/sync/route.ts), [`/api/challenges`](../../app/api/challenges/route.ts), [`/api/profile`](../../app/api/profile/route.ts), [`/api/auth/signout`](../../app/api/auth/signout/route.ts)) enforce `assertSameOriginIfPresent()` (`403` on cross-origin or `Origin: null`) and byte-bounded JSON parsing (`16 KiB` small mutations, `512 KiB` single run, `2 MiB` batch sync -> `413 Payload Too Large`).
- **OAuth Redirect & SSR Auth Boundaries:**
  - [`app/auth/callback/route.ts`](../../app/auth/callback/route.ts) sanitizes `?next=` with [`sanitizeRedirectPath()`](../../lib/security/redirect.ts) (rejecting scheme prefixes, protocol-relative `//`, backslashes `\`, multi-pass URL-encoded bypasses, and control characters).
  - [`AuthProvider`](../../components/providers/auth-provider.tsx) authenticates via server-verified `supabase.auth.getUser()`.
  - [`proxy.ts`](../../proxy.ts) + [`lib/supabase/middleware.ts`](../../lib/supabase/middleware.ts) refresh Supabase SSR session cookies safely without leaking unauthenticated writes.
- **XSS & HTTP Security Headers ([`next.config.ts`](../../next.config.ts)):**
  - Zero `target="_blank"` or `window.open` calls exist in application code; the only `dangerouslySetInnerHTML` usage is the static localStorage theme/font bootstrap script in [`app/layout.tsx`](../../app/layout.tsx).
  - Global headers configure `Content-Security-Policy` (`default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, explicit Google/GitHub avatar `img-src` origins), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- **Rate Limiting Caveat (`lib/security/rate-limit.ts`):**
  - `POST /api/results` enforces an `8s` DB-backed submission cooldown alongside idempotent `clientRunId` recovery.
  - `POST /api/results/sync` combines a 10-minute Postgres DB write ceiling (`150` rows) with per-process sliding-window request/item throttling (`5` req / `120` items per min). Challenge/profile/recovery burst limiters also use process-local `Map` windows, which protect single instances cleanly and should be backed by a shared Redis/Upstash store if horizontal multi-instance burst enforcement becomes necessary.

---

## 4. Dependency Vulnerability Audit (`npm audit`)

Verified after removing unused `@testing-library/user-event`:

| Command | Result | Details |
|---|---|---|
| `npm audit --omit=dev` | **0 vulnerabilities** | Clean across all production runtime dependencies. |
| `npm audit` | **7 moderate** | All 7 are dev/build-only transitive `minimatch` ReDoS advisories (`GHSA-3ppc-4f35-3m26`, `GHSA-7r86-cg39-jmmj`, `GHSA-23c5-xmqv-rm74`) nested under `eslint-config-next -> @typescript-eslint/typescript-estree` (not shipped in production bundles or runtime routes). Fixing via semver-major override is deferred until upstream `eslint-config-next` updates `@typescript-eslint` cleanly. |

---

## 5. GitHub Repository Settings & Protections Audit

Inspected read-only via `gh api` against `Rudra4451/practice` on 2026-11-12 (no paid GitHub features purchased; visibility was not altered):

| Setting / Protection | Verified Live Status | Risk / Recommended Owner Action |
|---|---|---|
| **Repository Visibility** | **`PUBLIC`** (`private: false`) | Anyone on GitHub can read and clone full source & git history. **Switch to `PRIVATE`** if source confidentiality is desired (requires explicit owner decision). |
| **Branch Protection (`main`)** | **Enabled** (`strict: true`, `enforce_admins: true`) | Up-to-date branches and admin enforcement are active. |
| **Force Pushes & Branch Deletion** | **Blocked** (`allow_force_pushes: false`, `allow_deletions: false`) | Protected against history rewriting and branch deletion. |
| **Required Status Checks (`main`)** | **Enabled** (`verify-postgres-16`, `quality-and-e2e`) | Both workflows must pass before merge. |
| **Required PR Approving Reviews** | **`0` approvals required** | For single-maintainer work, `0` avoids self-approval deadlock while `enforce_admins` + CI gates guard `main`; enable `>= 1` approving review if adding collaborators. |
| **Secret Scanning & Push Protection** | **Enabled** (`secret_scanning: enabled`, `push_protection: enabled`) | Actively blocks known secret patterns at `git push` time. |
| **Dependabot Vulnerability Alerts** | **Disabled** (`HTTP 404`) | **Recommended:** Enable in GitHub *Settings -> Code security -> Dependabot alerts*. |
| **Dependabot Security Updates** | **Disabled** (`enabled: false`) | **Recommended:** Enable automatic security PRs alongside Dependabot alerts. |
| **GitHub Actions Permissions** | `default_workflow_permissions: read`, **`allowed_actions: all`**, **`sha_pinning_required: false`** | Workflows themselves declare least-privilege `permissions: contents: read` and SHA-pinned `actions/checkout` + `actions/setup-node`. Consider restricting `allowed_actions` / requiring SHA pinning at repo settings level. |

