# TyProX — Security & Backend Review

**Audit Date:** 2026-11-10  
**Scope:** API route handlers, Supabase SSR/browser/proxy auth boundaries, PostgreSQL schema, Row Level Security (RLS) policies, score verification, leaderboard tamper resistance, privacy/data exposure, and environment configuration.  
**Confidentiality Note:** `.env.local` values were never read or printed; only presence of key names (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) was verified.

---

## 1. Verification Boundaries

- **Verified:** All backend files (`app/api/**`, `app/auth/callback/route.ts`, `lib/supabase/**`, `proxy.ts`), SQL definitions (`supabase/migrations/**`), and client Supabase SDK calls (`app/**`, `components/**`).
- **Assumption / External:** Live Supabase Auth Dashboard settings (email rate limits, OTP expiration, OAuth redirect URL allowlists, Postgres roles, and whether `20260619` + `20260620` or `FULL_SCHEMA.sql` is applied in production) reside outside the local workspace and cannot be verified statically.

---

## 2. Detailed Security Findings

### SEC-01 — Complete Absence of Server-Side Score Verification & Telemetry Anti-Cheat Bypass
- **Priority:** `Critical` (`Verified`)
- **File Path:** [app/api/results/route.ts](../../app/api/results/route.ts#L12-L98), [app/dashboard/page.tsx](../../app/dashboard/page.tsx#L311-L328)
- **Relevant Component / Function:** `POST` in `app/api/results/route.ts`, `handleSyncHistory` in `app/dashboard/page.tsx`
- **Evidence:**
  1. `POST /api/results` accepts `wpm` (`0..350`), `rawWpm` (`0..350`), `accuracy` (`0..100`), `consistency` (`0..100`), `errorCount`, `backspaceCount`, `mode`, `duration` (`1..300`), `seed`, and `telemetry` directly from client JSON and writes the client's numbers to `test_results` without ever re-generating text from `seed` or recomputing metrics from `telemetry`.
  2. Line 48 wraps all anti-cheat logic inside `if (telemetry.length > 0)`, and line 64 gates regularity checks on `if (deltas.length > 10)`. Sending `telemetry: []` alongside `wpm: 350, rawWpm: 350, accuracy: 100, consistency: 100, duration: 30` passes Zod and inserts directly onto the global leaderboard. Even when telemetry is supplied, adding random `>=2ms` jitter defeats `stdDev < 1.5`, and `k` is unchecked (`z.string()` unbounded) and never compared against `generateText(seed, mode, duration)`.
  3. Worse, [app/dashboard/page.tsx](../../app/dashboard/page.tsx#L327) demonstrates that authenticated users can call `supabase.from('test_results').insert(payload)` directly from browser JS — completely bypassing `/api/results` and its anti-cheat checks!
- **Impact:** Anyone can forge #1 leaderboard scores (`350 WPM`, `100%` accuracy) with a single `curl` / browser console call, unlocking every speed achievement and corrupting competitive integrity.
- **Recommended Solution:** Revoke client `INSERT` on `public.test_results` and `public.replays` (`anon` and `authenticated` should only write via a server endpoint using `SUPABASE_SERVICE_ROLE_KEY`, or via a Postgres `SECURITY DEFINER` RPC). Inside `POST /api/results`, enforce minimum telemetry length (`>= 10` keystrokes & duration bounds), validate `k.length <= 1` (or `'Backspace'`), reconstruct expected text deterministically from `(seed, mode, duration)`, re-compute WPM/rawWpm/accuracy/consistency/errorCount/duration server-side, reject impossible inter-key intervals (`<15ms` sustained / zero variance / inhuman bursts), and migrate `handleSyncHistory` to route through the same verified API.

### SEC-02 — Permissive SQL Privileges (`GRANT ALL`) & Self-Tamperable RLS Policies
- **Priority:** `Critical` (`Verified`)
- **File Path:** [supabase/migrations/FULL_SCHEMA.sql](../../supabase/reference/FULL_SCHEMA.sql#L157-L229,L292-L295,L320-L335), [supabase/migrations/20260619000000_audit_hardening.sql](../../supabase/migrations/20260619000000_audit_hardening.sql#L4-L31)
- **Relevant Component / Function:** RLS policies on `test_results`, `replays`, `streaks`, `user_achievements`, `challenge_links`, `leaderboard_view`, and schema `GRANT ALL`
- **Evidence:**
  1. Line 293 executes `GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;` (granting `DELETE`/`TRUNCATE`/`REFERENCES`/`TRIGGER` privileges at the PostgreSQL role level, leaving security solely on RLS omission rather than least privilege).
  2. `test_results` (`line 160`), `replays` (`line 174`), and `challenge_links` (`line 205`) INSERT policies allow `(user_id IS NULL AND auth.uid() IS NULL)` (or `creator_id IS NULL AND auth.uid() IS NULL`), permitting unauthenticated `anon` requests to flood Postgres with arbitrary rows (`replays.telemetry` JSONB bloat, fake guest challenge lobbies).
  3. `streaks` policy `"Users can update their own streaks"` (`line 185`: `FOR UPDATE USING (auth.uid() = user_id)`) allows any signed-in user to execute `supabase.from('streaks').update({ current_streak: 9999, longest_streak: 9999 })` from DevTools.
  4. `user_achievements` policy `"Users can insert their own achievements"` (`line 228`: `WITH CHECK (auth.uid() = user_id)`) lets any signed-in user unlock `Grandmaster Typist` and `Monthly Champion` directly via PostgREST.
  5. `leaderboard_view` (`line 320-333`) omits `WHERE user_id IS NOT NULL` (potentially ranking anonymous `NULL` user results together under `DISTINCT ON (user_id, ...)` if inserted) and is created without `WITH (security_invoker = true)` (executing with view owner permissions in Postgres).
  6. Note `achievements` table also uses default privileges if `GRANT ALL` ran; RLS on `achievements` only has a `SELECT` policy so writes fail, yet explicit least-privilege grants are best practice.
- **Impact:** Arbitrary database spam by anonymous users, direct forgery of streaks and achievements by any user, and bypass of `/api/results` via direct PostgREST table inserts.
- **Recommended Solution:** Replace `GRANT ALL` with granular `SELECT` grants + explicit server-side service-role or `SECURITY DEFINER` RPC functions for mutations; remove `anon` write policies (`auth.uid() IS NULL`); drop `streaks` UPDATE, `user_achievements` INSERT, and direct `test_results` / `replays` client INSERT policies; and rebuild `leaderboard_view` with `WITH (security_invoker = true)` and `WHERE is_invalidated = false AND user_id IS NOT NULL`.

### SEC-03 — Open Redirect Vulnerability in OAuth Callback Route
- **Priority:** `High` (`Verified`)
- **File Path:** [app/auth/callback/route.ts](../../app/auth/callback/route.ts#L7-L14)
- **Relevant Component / Function:** `GET` handler
- **Evidence:**
  ```ts
  const next = requestUrl.searchParams.get('next') ?? '/dashboard';
  // ...
  return NextResponse.redirect(new URL(next, request.url));
  ```
  `new URL('https://attacker.example', 'https://typrox.com/auth/callback')` or `new URL('//attacker.example', ...)` resolves to the external origin without validation.
- **Impact:** Attackers can craft phishing OAuth callback links that leverage the trusted domain to bounce authenticated users to malicious sites immediately after Supabase session exchange.
- **Recommended Solution:** Validate that `next` starts with a single `/` and does not start with `//` or contain backslashes/protocol schemes (`const safeNext = next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/dashboard'`).

### SEC-04 — Unauthenticated Public Debug/Test API Routes Leak Metadata & Pollute Database
- **Priority:** `High` (`Verified`)
- **File Path:** `app/api/debug/supabase/route.ts`, `app/api/test-supabase/route.ts`
- **Relevant Component / Function:** `GET /api/debug/supabase`, `GET /api/test-supabase`
- **Evidence:**
  1. Both endpoints are publicly reachable in production (`npm run build` lists both as active dynamic routes with zero `NODE_ENV` or admin auth guard).
  2. `debug/supabase` exposes env prefixes, `NODE_ENV`, exact row counts for all 9 tables, error codes/hints, and echoes the caller's full profile, user ID, email, and auth provider.
  3. On every GET, `debug/supabase` (`lines 96-122`) inserts a guest row (`seed: '__debug_test__'`) into `test_results` and then calls `.delete().eq('seed', '__debug_test__')` — **which silently fails under RLS** because `test_results` has **zero DELETE policy**, leaving permanent junk rows in `test_results`!
  4. `test-supabase` (`line 38`) exposes the full `NEXT_PUBLIC_SUPABASE_URL` and raw Postgres error structures.
- **Impact:** Reconnaissance exposure (table counts, schema hints, error details) and unauthenticated database write amplification / pollution via repeated GET requests to `/api/debug/supabase`.
- **Recommended Solution:** Remove both debug routes before production deployment (or gate strictly behind `process.env.NODE_ENV === 'development'`). Delete existing `__debug_test__` rows from `test_results`.

### SEC-05 — Middleware & API Auth Bypass via `?demo=true` Query/Cookie Parameters
- **Priority:** `High` (`Verified`)
- **File Path:** [lib/supabase/middleware.ts](../../lib/supabase/middleware.ts#L48-L54), [app/api/leaderboard/route.ts](../../app/api/leaderboard/route.ts#L13-L54)
- **Relevant Component / Function:** `updateSession`, `GET /api/leaderboard`
- **Evidence:**
  - `updateSession` (`line 48`) evaluates `const isDemo = request.cookies.get('typrox_demo_logged_in')?.value === 'true' || request.nextUrl.searchParams.get('demo') === 'true';` and skips redirecting unauthenticated requests to `/login` for `/dashboard` and `/profile`.
  - `GET /api/leaderboard` (`line 13`) uses `searchParams.get('demo') !== null` — returning fabricated scores even for `?demo=false` — and `Navbar`/`LoginCard` trust client-settable `localStorage` and non-HttpOnly `document.cookie` (`typrox_demo_logged_in=true`) to mock an authenticated session.
- **Impact:** Anyone can bypass edge route protection simply by appending `?demo=true` or setting an unauthenticated cookie, exposing protected client shells and mocked session states.
- **Recommended Solution:** Remove all `isDemo` auth bypass logic from `proxy`/`updateSession` middleware, `/api/leaderboard`, `Navbar`, and `LoginCard`.

### SEC-06 — Broad Public `SELECT USING (true)` Exposes User History & Full Keystroke Telemetry
- **Priority:** `Medium` (`Verified`)
- **File Path:** [supabase/migrations/FULL_SCHEMA.sql](../../supabase/reference/FULL_SCHEMA.sql#L140-L224)
- **Relevant Component / Function:** RLS `SELECT` policies across `profiles`, `test_results`, `replays`, `streaks`, `user_achievements`
- **Evidence:** Every table carries `FOR SELECT USING (true);` (including raw `replays` containing full keystroke timing telemetry and `test_results` rows with `is_invalidated = true`, as well as `profiles.theme` / `font_family`). Anyone with the public anon key can dump all historical test runs, invalidated anti-cheat flags, and raw keystroke logs for every user via the Supabase REST API.
- **Impact:** Unnecessary behavioral/privacy exposure (keystroke biometric timing patterns in `replays`, full test history even for low-scoring practice runs, invalidated flags) beyond what public profiles or leaderboards require.
- **Recommended Solution:** Restrict `test_results` and `replays` `SELECT` policies so users can read their own rows (`auth.uid() = user_id`), while public leaderboard/profile reads expose only aggregated stats or non-sensitive top runs via curated views (`leaderboard_view`) or API routes.

### SEC-07 — Missing Rate Limiting, Unbounded Payload Sizes & Error Detail Leakage
- **Priority:** `Medium` (`Verified`)
- **File Path:** [app/api/results/route.ts](../../app/api/results/route.ts#L5-L22,L197-L198), [app/api/profile/route.ts](../../app/api/profile/route.ts#L13-L43), [app/api/leaderboard/route.ts](../../app/api/leaderboard/route.ts#L8,L139-L140)
- **Relevant Component / Function:** API route handlers
- **Evidence:**
  1. Zero rate limiting exists on `POST /api/results` or `PATCH /api/profile` (authenticated or unauthenticated callers can spam submissions continuously).
  2. `telemetrySchema` allows `k: z.string()` with no `.max()` length on up to `10,000` objects, and unbounded negative/float numbers on `t` and `i`.
  3. `app/api/leaderboard/route.ts:8` runs `parseInt(duration, 10)` without checking `NaN` or allowlist (`[15, 30, 60, 120]`), causing Postgres integer syntax error `500` on invalid input (`?duration=abc`) and leaking raw `viewError.message` (`line 89`), `fallbackError.message` (`line 117`), `profile/route.ts:35,43`, and `results/route.ts:198`.
  4. `next.config.ts` sets zero HTTP security headers (`Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options` / `frame-ancestors`, `Referrer-Policy`).
- **Impact:** DoS/storage bloat via large `telemetry` JSON payloads, unhandled `500` responses from malformed query parameters, and exposure of internal database error text.
- **Recommended Solution:** Add Zod bounds (`k.max(12)`, non-negative ints, leaderboard query Zod schema), enforce per-user/IP rate limiting (e.g., Upstash Redis or DB timestamp window), return generic error messages in `500` responses while logging full errors server-side, and configure standard security headers in `next.config.ts` / `proxy.ts`.

### SEC-08 — Weak Client Session Verification (`getSession`), OAuth Signup Trigger Collision & Unenforced Challenge Expiry
- **Priority:** `Medium` (`Verified`)
- **File Path:** [components/navbar.tsx](../../components/navbar.tsx#L142), [lib/supabase/auth.ts](../../lib/supabase/auth.ts#L44-L48), [supabase/migrations/FULL_SCHEMA.sql](../../supabase/reference/FULL_SCHEMA.sql#L247-L263), [app/challenge/[id]/page.tsx](../../app/challenge/%5Bid%5D/page.tsx#L42-L54)
- **Relevant Component / Function:** `Navbar` auth check, `handle_new_user()` trigger, `ChallengePage`
- **Evidence:**
  1. `Navbar` (`line 142`) calls `supabase.auth.getSession()` instead of `getUser()` (reading unvalidated cookie/storage claims on client hydration before server verification; note `middleware.ts:43` and `results/route.ts:78` properly use `getUser()`).
  2. `handle_new_user()` (`FULL_SCHEMA.sql:253`) inserts `COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substring(NEW.id::text, 1, 8))` directly into `profiles.username` (`UNIQUE`, min length 3). If an OAuth user's `username` metadata is `< 3` chars or collides with an existing username (e.g., two providers or colliding handles), the `AFTER INSERT ON auth.users` trigger throws a constraint violation and **aborts user signup completely** (`SECURITY DEFINER` function also lacks an explicit `SET search_path = public`).
  3. `ChallengePage` queries `.from('challenge_links').eq('id', id)` without `.gt('expires_at', new Date().toISOString())`, and RLS `SELECT USING (true)` exposes expired challenges.
- **Impact:** OAuth signups can silently fail on username collision/short length; expired 1v1 challenge links remain active indefinitely; `Navbar` trusts unvalidated local session storage until refresh.
- **Recommended Solution:** Standardize auth hydration on `supabase.auth.getUser()`, harden `handle_new_user()` with `SET search_path = public`, length sanitization, and collision fallback (`ON CONFLICT`), and enforce `expires_at > now()` in both `challenge_links` RLS `SELECT` policy and `ChallengePage`.

