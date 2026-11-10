# TyProX Product Feature Specifications (Phase 5)

**Document Status:** Planning Only (No code edits or SQL migrations executed)  
**Product Vision:** Deliberate practice (Duolingo) + verified competitive ratings & duels (Chess.com) + public proof-of-practice community profiles (GitHub).  
**Prerequisite Gates:**
- **Competitive Integrity Gate:** Every ranked, XP, rating, challenge, or daily-leaderboard feature (`SPEC-5.3`–`SPEC-5.8`) is strictly blocked until Phase 1 server verification & RLS hardening (`SEC-1.4`, `SEC-1.5`, `SEC-1.6`) are live and tested.
- **Analytics Integrity Gate:** Personalized drills & weak-key diagnostics (`SPEC-5.1`, `SPEC-5.2`) require Phase 2 cumulative accuracy/keystroke fixes (`ENG-2.1`, `ENG-2.3`).
- **UI Consistency Gate:** New learning/social/profile routes follow the Phase 4 editorial design tokens (`DES-4.1`–`DES-4.3`) rather than adding fourth-style bloat.

**Primary Audit Sources:** [FEATURE_INVENTORY.md](file:///c:/Users/rudra/TyProX/docs/audit/FEATURE_INVENTORY.md), [PROJECT_AUDIT.md](file:///c:/Users/rudra/TyProX/docs/audit/PROJECT_AUDIT.md)

---

## PILLAR 1: LEARNING ECOSYSTEM (DUOLINGO-INSPIRED DELIBERATE PRACTICE)

### SPEC-5.1: Seed-Verified Weak-Key Detection & Clickable Targeted Drills
- **Audit Reference:** `FI-06`, [app/dashboard/performance-lab/page.tsx](file:///c:/Users/rudra/TyProX/app/dashboard/performance-lab/page.tsx#L143-L149, L412-L429)
- **Problem:** Performance Lab calculates slow bigrams and weak keys by guessing `prev.k` whenever `curr.y === 1` (`delete`), misattributing keys across multi-character typos/multi-backspaces and skipping uncorrected mistakes. Furthermore, `"Top error keys (Drill these characters in Custom Mode)"` is non-interactive dead copy (`FI-06`).
- **Root Cause:** Replay analyzer fails to align keystrokes against reconstructed `targetText = generateText(seed, mode, duration)`, and `useTypingStore` lacks a `'drill'` practice target generator.
- **Proposed Solution:**
  1. Create shared pure replay analyzer [lib/typing/replay-analyzer.ts](file:///c:/Users/rudra/TyProX/lib/typing/replay-analyzer.ts) imported by Performance Lab (or computed server-side inside `lib/data/performance-lab.ts`): fetch last `15` verified runs including `{ seed, mode, duration, generator_version }`, reconstruct `targetText`, and align every `y === 0` input against expected `targetText[item.i]` to compute true per-key error rate (`errors / totalExpectedHits`) + median transition delay (`slowBigrams`, filtering pauses `> 1500ms`).
  2. Add **Custom Drill Mode** (`mode = 'drill'` — explicitly **excluded from global public leaderboards** cleanly via `is_ranked = false`):
     - Clicking any weak key or bigram CTA on `/dashboard/performance-lab` OR `"Drill weak keys"` on `ResultScreen` launches `/typing?mode=drill&targets=q,z,wa,lo`.
     - Pure drill generator builds weighted dictionary sequences containing 70%+ high-frequency English words rich in the target letters/bigrams so the typist practices real finger transitions instead of gibberish strings.
- **Files/Components Affected:** `lib/typing/replay-analyzer.ts` (new), `lib/typing/text-generator.ts` (`drill` mode helper), `stores/typing-store.ts`, `app/typing/page.tsx`, `app/dashboard/performance-lab/page.tsx`, `components/typing/result-screen.tsx`.
- **Database Changes:**
  - *Local Migrations / Snapshot / Production DB:* Add optional `generator_version SMALLINT DEFAULT 1` and `is_ranked BOOLEAN DEFAULT true` on `public.test_results` (allowing `drill` & `lesson` runs to save into personal history + streaks without polluting standard mode leaderboards!). Note `mode VARCHAR(20)` already accommodates `'drill'` and `'lesson'`.
- **Security Implications:** Drill mode routes through `POST /api/results` with `is_ranked: false`; server checks `targets` charset (`^[a-z0-9,.;:'"/-]{1,32}$`) cleanly via Zod and rejects malformed URL targets.
- **Dependencies:** `SEC-1.4`, `ENG-2.1`, `ENG-2.3`, `ENG-3.3`, `DES-4.3`.
- **Testing Requirements:** Vitest tests on `replay-analyzer.ts` comparing expected mismatch vs multi-backspace recovery accuracy; `generateDrillText(['q','z'])` frequency verification; API verification test confirming `drill` runs do NOT appear in `leaderboard_view`.
- **Acceptance Criteria:** Weak keys count exact expected character misses (not blindly `prev.k` on `Backspace`); clicking `"Drill Weak Keys"` immediately loads targeted typing session; drill runs track personal speed/streak without contaminating competitive leaderboards.
- **Priority:** `High`
- **Estimated Complexity:** `M`

---

### SPEC-5.2: Structured Curriculum (`/learn` Paths & Progressive Typing Lessons)
- **Audit Reference:** Vision Gap Section 3 (`FEATURE_INVENTORY.md:113`)
- **Problem:** Beginners and intermediate typists only have unguided 15–120s random dictionaries; there is no progressive path teaching proper key clusters, capitalization, numbers, or developer syntax.
- **Root Cause:** Application built strictly around random-word speed testing with no curriculum tables or progression route.
- **Proposed Solution:**
  1. Introduce **4 Focused Learning Paths** (~20–24 progressive lessons total, stored declaratively or seeded cleanly in DB):
     - **Path 1 — Touch Typing Foundations:** Home Row (`asdf jkl;`), Home + `e/i/r/u`, Top Row, Bottom Row, Full Alphabet Precision.
     - **Path 2 — Mechanics & Punctuation:** Capitalization & Shift discipline, commas/periods/quotes, hyphens & apostrophes.
     - **Path 3 — Numbers & Technical Prose:** Home row + top-row numerals, mixed decimals/formulas, common dev variables (`camelCase` / `snake_case`).
     - **Path 4 — Code Fluency:** Brackets/braces (`() [] {}`), arrow/operator idioms (`=> !== ===`), clean TypeScript/SQL single-line patterns.
  2. **Mastery Gates (Anti-Bad-Habit Design):**
     - Lesson completion yields 1–3 Stars based on `(minAccuracy >= 92%..97%, targetWpm >= threshold)`. Accuracy gate (`>= 90%`) is **mandatory** so mashing keys fast cannot falsely clear a lesson!
     - Store lesson runs with `mode = 'lesson'`, `is_ranked = false` cleanly via verified `POST /api/results` -> unlock next lesson & stars in `user_lesson_progress`.
- **Files/Components Affected:** `constants/curriculum.ts` (new structured lessons), `app/learn/page.tsx` (Server Component lesson map), `app/learn/[slug]/page.tsx` (focused typing runner reusing `TypingContainer` & `ResultScreen`), `app/api/results/route.ts`, `components/navbar.tsx` (add `"Learn"` nav link).
- **Database Changes:**
  - *Local Migrations / Production DB:* Create `public.user_lesson_progress (id UUID PK, user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, lesson_slug VARCHAR(64) NOT NULL, stars SMALLINT CHECK (stars BETWEEN 1 AND 3), best_wpm REAL NOT NULL, best_accuracy REAL NOT NULL, completed_at TIMESTAMPTZ, UNIQUE (user_id, lesson_slug))`. RLS: `SELECT` public/own (`auth.uid() = user_id`), **client `INSERT`/`UPDATE` revoked** (server-written via `POST /api/results`!).
  - *Snapshot (`FULL_SCHEMA.sql`):* Updated / reconciled in Phase 5 migration.
- **Security Implications:** Lesson stars & completion evaluated purely server-side from verified telemetry (`verifier.ts`); users cannot forge skipped curriculum unlocks via browser console.
- **Dependencies:** `SEC-1.4`, `SEC-1.5`, `ENG-2.1`, `ENG-2.4`.
- **Testing Requirements:** Vitest tests verifying lesson pass/fail criteria (high WPM at 82% accuracy fails; steady 96% accuracy clears); Playwright journey opening `/learn`, completing Lesson 1, and verifying Star unlock persistence.
- **Acceptance Criteria:** Learners can follow sequential unlocked modules on `/learn`, practice exact curated finger drills on `/learn/[slug]`, and see persistent stars/best WPM saved upon valid accuracy+speed completion.
- **Priority:** `Medium`
- **Estimated Complexity:** `L`

---

### SPEC-5.3: Server-Enforced XP, Levels, Daily Streak Freeze & Timezone Awareness
- **Audit Reference:** `FI-02`, `FI-05`, `SEC-02`
- **Problem:** Home page advertises XP (`100–200 XP`) that does not exist anywhere in Postgres or `/api/results`; missing a single travel/busy day wipes a 30-day streak with zero grace mechanism; streaks currently hardcode UTC server midnight without user calendar context.
- **Root Cause:** Unimplemented progression schema and MVP UTC date diff check (`results/route.ts:114`).
- **Proposed Solution:**
  1. **Authentic XP & Level Model:**
     - Deterministic progression formula calculated **strictly inside `POST /api/results` (`service_role`)**:
       - Base run XP: `Math.round((activeDurationSecs / 15) * 10 * accuracyFactor)` (e.g., 30s run at 96% acc ≈ `20 XP`; invalid/zero-effort <5s runs earn `0 XP`).
       - Daily first-test bonus (`+25 XP` once per calendar day) + Daily Challenge clear bonus (`+50 XP`) + Achievement unlock bonus (`+50..150 XP`).
       - Daily XP soft-cap guard against mindless 15s spam grinding (e.g. full XP for first 20 runs/day, reduced afterward) cleanly documented in UI!
       - Level curve: clean monotonic XP curve (`xpForLevel(L) = 100 * L * (L + 1) / 2` or progressive ladder).
  2. **Streak Calendar Consistency & Freeze Token:**
     - Persist optional `timezone VARCHAR(64) DEFAULT 'UTC'` on `profiles` (validated against `Intl.supportedValuesOf('timeZone')` in `PATCH /api/profile`) so calendar boundaries match the user's local midnight cleanly without allowing arbitrary client timestamp forging!
     - Award `1` **Streak Freeze** token automatically for every `7`-day consecutive streak milestone (capped at max `2` stored tokens on `streaks.freeze_tokens`), automatically protecting a single 1-day missed gap (`diffDays === 2 && freeze_tokens > 0` decrements `freeze_tokens`, preserves streak, logs `last_freeze_used_at`).
- **Files/Components Affected:** `lib/progression/xp.ts` (new pure XP & level calculator), `app/api/results/route.ts`, `app/api/profile/route.ts`, `app/dashboard/page.tsx` (show Level badge, XP bar, Freeze indicator), `app/u/[username]/page.tsx`, `components/home/achievements.tsx` (sync real XP rewards once live).
- **Database Changes:**
  - *Local Migrations / Production DB:* Add `xp INTEGER DEFAULT 0 NOT NULL`, `level INTEGER DEFAULT 1 NOT NULL` to `public.profiles` (or dedicated `public.user_progression`), add `timezone VARCHAR(64) DEFAULT 'UTC'` on `profiles`, add `freeze_tokens SMALLINT DEFAULT 0 NOT NULL CHECK (freeze_tokens BETWEEN 0 AND 2)` + `last_freeze_used_date DATE` to `public.streaks`. All progression columns write-protected (`REVOKE UPDATE` on XP/level/freeze columns — server-written only!).
- **Security Implications:** Critical column protection: authenticated users updating `display_name`/`theme` in `profiles` MUST NOT be able to `PATCH` `xp` or `level` directly via PostgREST! Protect via RLS + separate `user_progression` table with `SELECT`-only client access (`service_role` writes only) — **putting `xp`/`level` in a dedicated `public.user_progression` table is far cleaner and 100% immune to column-level `profiles UPDATE` leaks!**
- **Dependencies:** `SEC-1.4`, `SEC-1.5` (streak Day-1 bug already fixed), `DES-4.4`.
- **Testing Requirements:** Vitest tests on `lib/progression/xp.ts` (level boundaries, accuracy penalty, daily cap) and streak freeze transitions (`diffDays === 1`, `diffDays === 2` with 1 token vs 0 tokens, `diffDays >= 3` reset).
- **Acceptance Criteria:** Completing verified runs increments XP and Level cleanly on Dashboard; missing exactly 1 day while holding a Streak Freeze preserves `current_streak`; client cannot modify XP/level/streak via Supabase SDK.
- **Priority:** `Medium`
- **Estimated Complexity:** `M`

---

### SPEC-5.4: Wire Up Daily Challenges (`daily_challenges` & `user_challenge_progress`)
- **Audit Reference:** Feature Matrix (`FEATURE_INVENTORY.md:38`), [FULL_SCHEMA.sql](file:///c:/Users/rudra/TyProX/supabase/migrations/FULL_SCHEMA.sql#L66-L74, L91-L98)
- **Problem:** `daily_challenges` and `user_challenge_progress` tables, RLS policies, and indexes exist cleanly in Postgres with zero backend generation, zero UI cards, and zero completion paths.
- **Root Cause:** Unfinished beta schema artifact.
- **Proposed Solution:**
  1. **Deterministic Daily Challenge Loader (`getOrCreateTodayChallenge` in `lib/data/daily-challenge.ts`):**
     - On request to `/daily` or `/dashboard` (via `createAdminClient()` idempotent `INSERT ... ON CONFLICT (challenge_date) DO NOTHING`), lazily materialize today's UTC daily challenge using deterministic seed derived cleanly from `UTC YYYY-MM-DD` (rotating mode `words`/`quotes`/`punctuation`/`code` across weekdays, e.g., Monday = Words 60s, Wednesday = Punctuation 30s, Friday = Code 30s!). Lazy idempotent creation removes brittle external cron dependency while guaranteeing every player worldwide races the **exact same daily text & duration**.
  2. **Dedicated Runner & Daily Leaderboard:**
     - Add `/daily` (or mode pill / featured Daily Challenge card on `/dashboard` + `/typing?daily=YYYY-MM-DD`).
     - Passing `dailyChallengeId` into verified `POST /api/results` records completion atomically into `user_challenge_progress (user_id, challenge_id, test_result_id)` on the player's **first valid attempt** (`ON CONFLICT (user_id, challenge_id) DO NOTHING`, or allow retries updating `test_result_id` if rules permit — recommend recording best attempt cleanly OR counting first official attempt; specify **"First official run counts for Daily Leaderboard; unlimited practice after"** cleanly in UI!).
     - Render real-time **Today's Daily Standings** tab inside `/leaderboard` & `/daily`.
- **Files/Components Affected:** `lib/data/daily-challenge.ts` (new `server-only`), `app/daily/page.tsx` (new), `components/daily/daily-challenge-runner.tsx` (new), `app/api/results/route.ts`, `app/dashboard/page.tsx` (Today's Challenge banner), `app/leaderboard/page.tsx` (Daily Challenge tab).
- **Database Changes:**
  - *Existing Local & Snapshot:* `public.daily_challenges` & `public.user_challenge_progress` already exist!
  - *Security Reconciliation:* In `SEC-1.5` forward migration, ensure client `INSERT` policy on `user_challenge_progress` is **dropped** so completions only insert server-side via `POST /api/results` (`createAdminClient()`). Add index `idx_challenge_progress_challenge_id ON public.user_challenge_progress (challenge_id)`.
- **Security Implications:** Removes ability to insert `user_challenge_progress` pointing to another user's `test_result_id` or fake completion without actually typing today's seed.
- **Dependencies:** `SEC-1.4`, `SEC-1.5`, `SPEC-5.3` (`+50 XP` daily clear bonus).
- **Testing Requirements:** Vitest test verifying `POST /api/results` rejects mismatched `seed`/`mode` if `dailyChallengeId` doesn't match `daily_challenges` row; Playwright test launching `/daily`, completing challenge, and appearing in Daily Standings.
- **Acceptance Criteria:** Visiting `/daily` serves the exact same text challenge to any user on that UTC date; completing it marks `"Completed Today"` on Dashboard, awards Daily XP, and places verified score in Daily Standings.
- **Priority:** `Medium`
- **Estimated Complexity:** `M`

---

## PILLAR 2: COMPETITIVE ECOSYSTEM (CHESS.COM-INSPIRED RANKINGS & DUELS)

### SPEC-5.5: Persistent 1v1 Challenge Match Records, Opponent Scoreboard & Rematches
- **Audit Reference:** `FI-03`, `SEC-08`, [app/challenge/[id]/page.tsx](file:///c:/Users/rudra/TyProX/app/challenge/%5Bid%5D/page.tsx)
- **Problem:** Challenging someone via `/challenge/[id]` never submits the challenger's run to `POST /api/results`, saves zero duel outcome in Postgres, leaves the creator unaware anyone played, and omits rematch links.
- **Root Cause:** `ChallengePage` switched to `'comparison'` view purely in local memory without server attempt persistence.
- **Proposed Solution:**
  1. Create `public.challenge_attempts (id UUID PK, challenge_id UUID REFERENCES challenge_links(id) ON DELETE CASCADE, participant_id UUID REFERENCES profiles(id) ON DELETE SET NULL, test_result_id UUID REFERENCES test_results(id) ON DELETE CASCADE, participant_wpm REAL NOT NULL, participant_accuracy REAL NOT NULL, outcome VARCHAR(10) CHECK (outcome IN ('win', 'loss', 'tie')), created_at TIMESTAMPTZ)`.
  2. When challenger completes `/challenge/[id]`, submit via `POST /api/results` with `challengeLinkId`. Server verifies telemetry against the exact `challenge_links.(seed, mode, duration)`, persists `test_results` + `replays`, computes authoritative win/loss/tie delta vs `(creator_wpm, creator_accuracy)`, and records `challenge_attempts`.
  3. On `/challenge/[id]` lobby & comparison view, render real verified **Match History / Contenders Board** for that link (preventing expired links cleanly) + `"Rematch with Same Settings"` CTA (creates fresh challenge link with swapped challenger as creator if signed in!). Track cumulative W/L/T duel summary on Dashboard & `/u/[username]`.
- **Files/Components Affected:** `app/api/results/route.ts`, `app/challenge/[id]/page.tsx`, `components/challenge/challenge-client.tsx`, `lib/data/challenge.ts`, `app/dashboard/page.tsx`, `app/u/[username]/page.tsx`.
- **Database Changes:**
  - *Local Migrations / Production DB:* Add `public.challenge_attempts` table + indexes `(challenge_id, participant_wpm DESC)` and `(participant_id, created_at DESC)`. RLS: `SELECT` allowed for non-expired challenge attempts (`EXISTS (SELECT 1 FROM challenge_links cl WHERE cl.id = challenge_id AND cl.expires_at > now())` or own attempts); writes exclusively via `service_role`.
- **Security Implications:** Impossible to spoof victory or forge challenge attempt rows without verified matching seed telemetry. Prevent self-farming W/L record by blocking `challenge_links.creator_id === user.id` from incrementing win-loss stats against yourself (`outcome = 'self_practice'` instead of counting toward duel wins!).
- **Dependencies:** `SEC-1.4`, `SEC-1.5`, `SEC-1.6` (`POST /api/challenges`), `ENG-2.5`.
- **Testing Requirements:** Vitest test checking self-challenge does not inflate duel win count; Playwright test running challenger end-to-end -> reload `/challenge/[id]` -> persisted attempt visible on contender board.
- **Acceptance Criteria:** Finishing a `/challenge/[id]` race saves user's test result, updates streaks, records opponent outcome in `challenge_attempts`, ignores expired links (`expires_at <= now()`), and shows live contenders + W/L record cleanly.
- **Priority:** `High`
- **Estimated Complexity:** `M`

---

### SPEC-5.6: Verified Skill Rating (ELO / Performance Index) & Quarterly Seasons
- **Audit Reference:** Vision Gap Section 3 (`FEATURE_INVENTORY.md:114`)
- **Problem:** Current Leaderboard ranks (`Bronze` -> `Grandmaster`) simply reflect a user's single lucky 15-second peak run (`> 140 WPM`), with no seasonal progression, consistency/accuracy weighting, provisional minimum sample, or multi-test skill rating.
- **Root Cause:** Naive static WPM threshold helper inside `app/leaderboard/page.tsx`.
- **Proposed Solution:**
  1. **Unified Performance Rating (`rating` scale `400..3000`, e.g., starting `1000` provisional):**
     - Design clean transparent **TyProX Skill Index (TSI)** updated **server-side** after each verified ranked run (`is_ranked = true`, `duration >= 30s` or weighted by duration: `15s` small K-factor, `30s/60s/120s` full weight):
       - Calculate single-run Performance Score: $P = (\text{WPM} \times 10) \times (\text{Accuracy} / 100)^2 \times (0.85 + 0.15 \times \text{Consistency}/100)$ (rewarding **fast + accurate + steady** typing — rushing 140 WPM at 82% accuracy scores lower than controlled 115 WPM at 98.5%!).
       - Update user's **Weighted Rolling Skill Rating** (EMA / Glicko-inspired convergence: fast adjustment in first `5` ranked placement runs -> `"Provisional"` badge until `5` verified ranked runs completed, then smooth ELO-style delta `+14` / `-6` around user's recent 10-run consistency + 1v1 duel bonuses!).
  2. **Quarterly Seasons:**
     - Add `public.seasons (id, slug, name, starts_at, ends_at, is_active)` and `public.season_standings (season_id, user_id, rating, peak_rating, rated_runs, wins, losses, rank_tier, updated_at)`.
     - Allow `/leaderboard` toggling between **Verified Peak Speed (Single Run by Mode/Duration)** AND **Season Rating Ladder** (plus **Peak Rating History** badge on profiles when a season closes).
- **Files/Components Affected:** `lib/progression/rating.ts` (new pure rating math), `app/api/results/route.ts`, `lib/data/leaderboard.ts`, `app/leaderboard/page.tsx`, `app/dashboard/page.tsx`, `app/u/[username]/page.tsx`.
- **Database Changes:**
  - *Local Migrations / Production DB:* Add `seasons` & `season_standings` tables with `UNIQUE (season_id, user_id)`. RLS: public `SELECT`, zero client write grants (`service_role` only).
- **Security Implications:** Rating adjustments computed strictly server-side from verified telemetry runs (`is_invalidated = false`, `is_ranked = true`); accuracy penalty squared prevents chaotic speed-mashing inflation.
- **Dependencies:** `SEC-1.4`, `SEC-1.5`, `SPEC-5.5`.
- **Testing Requirements:** Vitest tests on `lib/progression/rating.ts` verifying accuracy penalty superiority (`115 WPM @ 98.5%` > `140 WPM @ 82%`), provisional `< 5` runs indicator, and bounded step deltas.
- **Acceptance Criteria:** Users complete 5 placement tests to earn an active Seasonal Rating & Tier; `/leaderboard` offers both Speed Records and Season Rating Ladder cleanly backed by verified runs.
- **Priority:** `Medium`
- **Estimated Complexity:** `L`

---

### SPEC-5.7: Lightweight Friends & Rivalry Tracking
- **Audit Reference:** Product Vision ("Chess.com competition & rivalries", "GitHub profiles & community participation")
- **Problem:** Players can only compete on a global anonymized list or one-off manual links; there is no way to follow teammates/friends or filter leaderboards to rivals.
- **Root Cause:** Zero social graph table or friend filter exists.
- **Proposed Solution:**
  1. Add lean asymmetric `public.follows (follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE, following_id UUID REFERENCES profiles(id) ON DELETE CASCADE, created_at TIMESTAMPTZ, PRIMARY KEY (follower_id, following_id), CHECK (follower_id <> following_id))`.
  2. On `/u/[username]`, provide a crisp **Follow / Unfollow** toggle (via validated `POST/DELETE /api/follows` with per-user count cap e.g. `<= 250` follows + rate limit) and show Follower / Following counts cleanly.
  3. On `/leaderboard`, add **"Following" scope toggle** alongside Global rankings, letting users race peers/friends directly and challenge them cleanly via share links. (Notice: explicitly omit public spammy activity comment feeds or direct messaging to stay crisp, fast, and moderation-free!).
- **Files/Components Affected:** `app/api/follows/route.ts` (new), `lib/data/{profile,leaderboard}.ts`, `app/u/[username]/page.tsx`, `components/profile/follow-button.tsx` (new), `app/leaderboard/page.tsx`.
- **Database Changes:** Add `public.follows` table + index `(following_id)`. RLS: `SELECT` public (`true`), `INSERT` (`auth.uid() = follower_id`), `DELETE` (`auth.uid() = follower_id`).
- **Security Implications:** Reject self-follows in SQL CHECK & API; cap maximum follow count in API (`<= 250`) to prevent social spam abuse.
- **Dependencies:** `ENG-3.3` (`/u/[username]` RSC), `SEC-1.6`.
- **Testing Requirements:** Vitest/API check rejecting self-follow (`400`); SQL RLS check confirming User B cannot follow on behalf of User A; Playwright toggling Follow on `/u/[username]` and viewing filtered Friends tab on `/leaderboard`.
- **Acceptance Criteria:** Users can follow/unfollow other profiles, see rival scores on `"Following"` Leaderboard filter, and view Follower/Following counts on public profiles.
- **Priority:** `Low`
- **Estimated Complexity:** `M`

---

## PILLAR 3: COMMUNITY ECOSYSTEM (GITHUB-INSPIRED PROFILES, HEATMAPS & REPLAYS)

### SPEC-5.8: Public Profile Overhaul (`/u/[username]`) with 365-Day Activity Heatmap & Personal Bests Matrix
- **Audit Reference:** `FI-07`, `TD-08`, Vision Gap Section 3 (`FEATURE_INVENTORY.md:115`)
- **Problem:** `/u/[username]` shows only 4 flat lifetime averages, active streak, and achievement badges loaded unboundedly client-side (`TD-08`) — lacking GitHub-style calendar activity proof, Personal Best matrix across `(mode, duration)`, duel record, or bio/gear metadata.
- **Root Cause:** Initial profile page fetched raw rows into client state with minimal visualization.
- **Proposed Solution:**
  1. Extend `public.profiles` cleanly with optional public identity metadata (`bio VARCHAR(160)`, `keyboard_setup VARCHAR(80)` — e.g. `"HHKB Pro Hybrid · Topre 45g"`) editable via `/profile` + `PATCH /api/profile`.
  2. Server-side aggregated DTO in [lib/data/profile.ts](file:///c:/Users/rudra/TyProX/lib/data/profile.ts) returns bounded public projection:
     - **365-Day Practice Activity Heatmap:** SQL `DATE_TRUNC('day', created_at AT TIME ZONE COALESCE(profile.timezone, 'UTC'))` grouping verified `test_results` (`COUNT(*)`, `MAX(wpm)` per day over trailing 365 days -> `< 365` compact JSON points instead of 10,000 raw rows!). Rendered with clean accessible SVG grid & signal-orange (`#FF5C00`) intensity steps (`0`, `1–2`, `3–5`, `6–10`, `11+` runs/day) matching GitHub heatmap clarity!
     - **Personal Bests Matrix:** Top verified WPM + accuracy per `(words/quotes/punctuation/code/numbers)` x `(15s/30s/60s/120s)`.
     - **Season Rating & 1v1 Duel Record (`W-L-T`) + Streak + Earned Badges**.
     - **Curated Recent & Top Verified Runs Table** with direct `"Watch Replay"` link (`SPEC-5.9`).
- **Files/Components Affected:** `lib/data/profile.ts`, `app/u/[username]/page.tsx`, `components/profile/{activity-heatmap,pb-matrix,public-profile-client}.tsx` (new/updated), `app/profile/page.tsx`, `app/api/profile/route.ts`.
- **Database Changes:** Add optional `bio VARCHAR(160)`, `keyboard_setup VARCHAR(80)` to `public.profiles` + SQL RPC/view `get_user_activity_heatmap(p_user_id UUID)` indexed by `(user_id, created_at DESC)`.
- **Security Implications:** Strictly strips email, auth UID details when unnecessary, and excluded/invalidated runs (`is_invalidated = false` only); `bio`/`keyboard_setup` plain-text sanitized (React escapes JSX safely; trim/length-cap in Zod).
- **Dependencies:** `ENG-3.3` (`/u/[username]` RSC), `SEC-1.5` (RLS tightening), `DES-4.3`.
- **Testing Requirements:** Vitest tests on heatmap 365-day bucket formatter (leap year/empty days alignment); Playwright inspecting `/u/[username]` heatmap & PB matrix at mobile + desktop breakpoints.
- **Acceptance Criteria:** `/u/[username]` renders crisp SSR HTML + OpenGraph card, 365-day orange contribution heatmap with hover/focus day counts, `(mode, duration)` PB grid, and optional gear/bio without loading thousands of raw rows client-side.
- **Priority:** `Medium`
- **Estimated Complexity:** `M`

---

### SPEC-5.9: Shareable Keystroke Replay Viewer (`/replay/[id]` & Dashboard/Profile Replay Links)
- **Audit Reference:** `FI-07`, `TD-06`, `SEC-06`
- **Problem:** Heavy `JSONB` `replays` accumulate for every saved authenticated run, yet users can ONLY view `ReplayPlayer` ephemerally right after completing a test on `ResultScreen` — impossible to inspect past replays from Dashboard or share replays on public profiles! Meanwhile tightening `replays` `SELECT` RLS (`SEC-1.5`) protects private telemetry from mass scraping while still needing controlled access for shareable runs.
- **Root Cause:** No standalone `/replay/[id]` route or controlled replay fetch API, and `ReplayPlayer` relies on in-memory Zustand `targetText` instead of reconstructing text from `(seed, mode, duration, generator_version)`.
- **Proposed Solution:**
  1. **Controlled Replay Read Boundary:**
     - Direct Postgres `replays` `SELECT` remains restricted (`auth.uid() = owner`) against anonymous mass-table scraping (`SEC-06` / `SEC-1.5`).
     - Add dedicated Next Server Component / Route DTO `getReplayByResultId(testResultId)` using `createAdminClient()` **after verifying**:
       - `test_results.is_invalidated === false` AND
       - EITHER caller owns the run (`user.id === result.user_id`) **OR** the run belongs to a public user profile (`user_id IS NOT NULL`, non-practice-private if profile/privacy flag added) — returning ONLY sanitized visual playback DTO `{ username, wpm, accuracy, duration, mode, targetText, telemetry }` without raw server metadata or internal flags.
  2. **Standalone `/replay/[id]` Route + Dashboard/Profile Integration:**
     - Create `/replay/[id]` (`app/replay/[id]/page.tsx`) with `generateMetadata` (`"@user typed 132 WPM (99% Acc) on TyProX"`), mounting refactored `O(1)`-scrub `ReplayPlayer` (`TD-06`) initialized from server-reconstructed `targetText = generateText(run.seed, run.mode, run.duration, run.generator_version)`.
     - Add `"Watch Replay"` link on every row of Dashboard history log and Public Profile Top/Recent runs table + copyable `"Share Replay"` button right inside `ResultScreen`!
- **Files/Components Affected:** `lib/data/replay.ts` (new `server-only`), `app/replay/[id]/page.tsx` (new), `components/typing/replay-player.tsx` (props & share button), `app/dashboard/page.tsx`, `app/u/[username]/page.tsx`, `components/typing/result-screen.tsx`.
- **Database Changes:** Relies on `generator_version` column on `test_results` (`ENG-2.3` / `SPEC-5.1`) so `v1` vs `v2` quote/code seeds reconstruct exact historical target text faithfully!
- **Security Implications:** Blocks bulk anonymous `SELECT * FROM replays` PostgREST table dumps while safely exposing single curated run playback by UUID (`122`-bit non-enumerable v4 UUID!). Also add optional `is_public_replay BOOLEAN DEFAULT true` or privacy toggle in `/profile` if users prefer private runs!
- **Dependencies:** `SEC-1.5` (RLS tightening), `ENG-2.3` (`generator_version`), `ENG-3.1` (`ReplayPlayer` refactor), `DES-4.3`.
- **Testing Requirements:** Vitest test on `getReplayByResultId` denying invalidated runs (`is_invalidated = true`) -> returns `null` (`404`); Playwright clicking `"Watch Replay"` from Dashboard history -> navigating to `/replay/[id]` -> pressing Play & scrubbing timeline smoothly.
- **Acceptance Criteria:** Past runs in Dashboard and Top runs on `/u/[username]` open playable `/replay/[id]` links showing accurate character-by-character playback, speed slider (`0.5x–4x`), and copyable share URL; invalidated runs return `404`.
- **Priority:** `Medium`
- **Estimated Complexity:** `M`

---

### SPEC-5.10: Side-by-Side Typist Comparison (`/compare`) & Expanded Real Achievements
- **Audit Reference:** `FI-02`, Vision Gap Section 3 (`FEATURE_INVENTORY.md:115`)
- **Problem:** Users viewing someone on the leaderboard or public profile have no direct side-by-side comparison tool across modes/durations or head-to-head challenges; seeded achievements only cover speed/streak and omit accuracy, challenge, and versatility milestones.
- **Root Cause:** Comparison UI only existed inside ephemeral `/challenge/[id]` result cards; achievement seeds limited to 8 early entries.
- **Proposed Solution:**
  1. **Comparison View (`/compare?a=username1&b=username2`):** Server Component fetches safe public profile DTOs + PB matrix + Season Rating + verified head-to-head challenge stats between `userA` and `userB`, rendering crisp delta bars (`+12 WPM`, `+1.8% Acc`, faster mode strengths) plus 1-click `"Compare with Me"` button on `/u/[username]` when signed in!
  2. **Expanded Verifiable Achievements Migration:** Add accuracy/milestone badges evaluated identically server-side in `POST /api/results` (e.g., `ACC_99_FIRST` — `100% Accuracy on >= 30s run`, `CENTURY_TESTS` — `100 verified tests completed`, `POLYGLOT` — `>= 60 WPM across all 5 modes`, `DUELIST_10` — `10 verified 1v1 challenge wins`), backed by real vector SVGs in `public/achievements/`.
- **Files/Components Affected:** `app/compare/page.tsx` (new), `lib/data/compare.ts` (new), `app/u/[username]/page.tsx` (`Compare with Me` button), `app/api/results/route.ts` (achievement evaluators), `public/achievements/*.svg`.
- **Database Changes:**
  - *Local Migrations / Production DB:* `INSERT INTO public.achievements (...) ON CONFLICT (code) DO NOTHING;` seed extension for new achievement badges + `criteria` evaluator branches in server API.
- **Security Implications:** All new achievements strictly computed server-side inside `POST /api/results` (`createAdminClient`); `/compare` queries strictly public non-invalidated DTO projections.
- **Dependencies:** `SPEC-5.5`, `SPEC-5.6`, `SPEC-5.8`, `ENG-3.2` (SVG achievement assets).
- **Testing Requirements:** Vitest unit tests verifying each new achievement trigger (`ACC_99`, `POLYGLOT`, `DUELIST_10`); Playwright comparing two seeded profiles via `/compare?a=alpha&b=beta`.
- **Acceptance Criteria:** Clicking `"Compare"` from any `/u/[username]` opens `/compare` displaying real mode PBs and delta metrics; completing milestone criteria unlocks vector badges cleanly without broken icons.
- **Priority:** `Low`
- **Estimated Complexity:** `M`

