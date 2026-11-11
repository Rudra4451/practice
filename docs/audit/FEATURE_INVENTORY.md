# TyProX — Feature Inventory & Vision Gap Analysis

**Audit Date:** 2026-11-10  
**Methodology:** Every feature below was verified directly across UI components, Zustand stores, Web Workers, API routes, Next.js Proxy middleware, and Supabase SQL migrations. No feature was assumed functional solely from a navigation link, button, or database table.

---

## 1. Comprehensive Feature Classification Matrix

**Classification Key:**
- **Fully functional:** End-to-end implemented and operational (subject to documented security/math/UX bugs noted in Section 2).
- **Partially functional:** Real implementation exists, but key behaviors are buggy, incomplete, or disconnected.
- **UI-only:** Controls, forms, or database tables exist without connected runtime behavior.
- **Using mock or hardcoded data:** Displays fabricated/static/simulated numbers or unbacked demo data.
- **Broken or inaccessible:** Fails at runtime, corrupts data, or has zero UI navigation paths.

| Feature Area | Classification | Primary Evidence | Notes / Caveats |
|---|---|---|---|
| **Core Timed Typing Test (`words`, `numbers`, `punctuation`, `quotes`, `code`)** | Partially functional | [typing-container.tsx](file:///c:/Users/rudra/TyProX/components/typing/typing-container.tsx), [typing-store.ts](file:///c:/Users/rudra/TyProX/stores/typing-store.ts), [text-generator.ts](file:///c:/Users/rudra/TyProX/utils/text-generator.ts) | Typing works on desktop, but live timer/stats disappear while typing (`opacity-0`), future words blur after +4 words, mobile/IME input & Android Backspace break, and `quotes`/`code` ignore duration length |
| **WPM, Accuracy & Consistency Metrics** | Partially functional | [analytics.worker.ts](file:///c:/Users/rudra/TyProX/workers/analytics.worker.ts), [result-screen.tsx](file:///c:/Users/rudra/TyProX/components/typing/result-screen.tsx) | Calculates live & final metrics in a Web Worker, but `lastKeystrokeTime` exploit produces up to 200 WPM, backspaced typos vanish from accuracy/raw WPM, and `ResultScreen` hardcodes `"Personal Best"` for `wpm > 80` |
| **Post-Test Breakdown & Speed Timeline Chart** | Fully functional | [result-screen.tsx](file:///c:/Users/rudra/TyProX/components/typing/result-screen.tsx), [result-chart.tsx](file:///c:/Users/rudra/TyProX/components/typing/result-chart.tsx) | Real Recharts net/raw WPM chart + top weak keys; minor duplicate labels (`Errors` = `Mistakes registered`) and strict-mode double submit risk |
| **Keystroke Replay Player** | Partially functional | [replay-player.tsx](file:///c:/Users/rudra/TyProX/components/typing/replay-player.tsx) | Play/pause/scrub/`1x-4x` speed works, but only immediately after a test on `ResultScreen` (saved DB replays cannot be replayed from Dashboard or `/u/[username]`); React Compiler immutability violation (`animate` circular `useCallback`) & `setIsPlaying` inside state updater |
| **Guest History & Cloud Sync** | Partially functional | [user-store.ts](file:///c:/Users/rudra/TyProX/stores/user-store.ts), [dashboard/page.tsx](file:///c:/Users/rudra/TyProX/app/dashboard/page.tsx#L297-L346) | Guest results persist in `localStorage` (up to 100); `Sync History` pushes directly to Supabase client-side, bypassing `/api/results` anti-cheat, streak increments, replays, and achievements |
| **Authentication (Google/GitHub OAuth, Magic Link, Sign Out)** | Partially functional | [login/page.tsx](file:///c:/Users/rudra/TyProX/app/login/page.tsx), [callback/route.ts](file:///c:/Users/rudra/TyProX/app/auth/callback/route.ts), [signout/route.ts](file:///c:/Users/rudra/TyProX/app/api/auth/signout/route.ts) | Flows exist and compile cleanly; relies on external Supabase provider config (Assumption); broken by `?demo=true` bypass, Open Redirect on `next`, and Navbar `getSession()` coupling |
| **Username Onboarding Modal & Profile Editing** | Partially functional | [username-modal.tsx](file:///c:/Users/rudra/TyProX/components/auth/username-modal.tsx), [api/profile/route.ts](file:///c:/Users/rudra/TyProX/app/api/profile/route.ts) | Onboarding modal triggers on `^user_[0-9a-f]{8}$` and updates Supabase; Dashboard edits `display_name`; `handle_new_user()` SQL trigger risks OAuth username collision failure |
| **Public User Profiles (`/u/[username]`)** | Fully functional | [app/u/[username]/page.tsx](file:///c:/Users/rudra/TyProX/app/u/[username]/page.tsx) | Queries real Supabase `profiles`, `test_results`, `streaks`, and `user_achievements` (renders client-side with zero SSR/SEO or replay links) |
| **Global Leaderboards & Realtime Updates** | Partially functional | [leaderboard/page.tsx](file:///c:/Users/rudra/TyProX/app/leaderboard/page.tsx), [api/leaderboard/route.ts](file:///c:/Users/rudra/TyProX/app/api/leaderboard/route.ts), [20260620100000_leaderboard_view.sql](file:///c:/Users/rudra/TyProX/supabase/migrations/20260620100000_leaderboard_view.sql) | Queries real deduplicated `leaderboard_view` + Supabase Realtime, filters by timeframe/mode/duration; compromised by unverified score submissions, anonymous `user_id IS NULL` rows, and `?demo` mock override; shows simulated `"Demo Rankings"` when empty |
| **User Dashboard (`/dashboard`)** | Partially functional | [app/dashboard/page.tsx](file:///c:/Users/rudra/TyProX/app/dashboard/page.tsx), [dashboard-chart.tsx](file:///c:/Users/rudra/TyProX/components/dashboard/dashboard-chart.tsx) | Aggregates real DB or guest history, renders Recharts trend (`<=30` runs), mode/duration filters, sorting, and live updates; includes `?demo=true` mock generator and dead `syncSuccess` state |
| **Performance Lab (`/dashboard/performance-lab`)** | Partially functional | [performance-lab/page.tsx](file:///c:/Users/rudra/TyProX/app/dashboard/performance-lab/page.tsx) | Signed-in users get real client-side key heatmap, hand balance, slow bigrams, and weak keys from last 15 `replays`; however, `fingerLoads` is computed and discarded, unauthenticated users see blurred mockup + CTA, and `?demo=true` injects mock telemetry |
| **1v1 Challenge Lobbies (`/challenge/[id]`)** | Partially functional | [challenge/[id]/page.tsx](file:///c:/Users/rudra/TyProX/app/challenge/[id]/page.tsx), [result-screen.tsx](file:///c:/Users/rudra/TyProX/components/typing/result-screen.tsx#L109-L146) | Creates DB `challenge_links` & deterministic race against creator WPM; **never saves challenger's score/replay to Supabase**, never records opponent result on lobby, and ignores `expires_at` |
| **Daily Streaks & Database Achievements** | Broken / Partially functional | [api/results/route.ts](file:///c:/Users/rudra/TyProX/app/api/results/route.ts#L113-L188), [FULL_SCHEMA.sql](file:///c:/Users/rudra/TyProX/supabase/migrations/FULL_SCHEMA.sql#L56-L63, L276-L285) | Day-1 streak initializes to `0` (`CURRENT_DATE` == `today`, skipped on save!) and stays `0`; achievement evaluation uses stale pre-update `streakRow.current_streak`; seeded `/achievements/*.svg` icons are missing from `public/` |
| **Cat Companion Collectibles & Unlock System** | Broken / Partially functional | [cat-companion.tsx](file:///c:/Users/rudra/TyProX/components/typing/cat-companion.tsx#L301-L372) | Renders 15 SVG cats & drawer, but two `useEffect` hooks race on mount so unlocking a new cat overwrites previously saved cats in `localStorage` back to starter 3; `ResultScreen` never passes `streakDays`, locking cats to day-1 accessories |
| **Profile Settings & Preferences (`/profile`)** | Broken / Partially functional & Inaccessible | [app/profile/page.tsx](file:///c:/Users/rudra/TyProX/app/profile/page.tsx), [stores/user-store.ts](file:///c:/Users/rudra/TyProX/stores/user-store.ts) | **No link in the app navigates to `/profile`** (inaccessible via UI). Only **Theme** works (local only, not synced to DB); **Font Family** (`ibm-plex-mono` / `geist-mono`) and **Audio Feedback Volume** (`0–1`) are **UI-only** stubs with zero implementation |
| **Dark / Light Theme Switcher** | Partially functional | [navbar.tsx](file:///c:/Users/rudra/TyProX/components/navbar.tsx#L173-L176), [layout.tsx](file:///c:/Users/rudra/TyProX/app/layout.tsx#L75-L97) | Toggles `.dark` class in DOM & `localStorage`; initial visit defaults DOM to `.dark` while Zustand defaults to `'light'`, inverting the toggle icon until clicked; not synced with Supabase `profiles.theme` |
| **Hero 3D Keyboard (`Hero3D`)** | Partially functional + Mock HUD | [components/home/hero-3d.tsx](file:///c:/Users/rudra/TyProX/components/home/hero-3d.tsx) | Interactive mouse-tilt, RGB switcher, automated key-press animation, and collectible cat button work, but all 4 HUD panels (`128 wpm`, `98.7%`, `21 days`, `#142`) and floating trails are **hardcoded mock data** |
| **Responsive Navigation (`Navbar`)** | Partially functional | [components/navbar.tsx](file:///c:/Users/rudra/TyProX/components/navbar.tsx) | Desktop/mobile links and hamburger drawer work; displays **simulated fake `"online"` counter** (`350–550`), omits `/profile` link, and couples auth/profile DB initialization |
| **Landing Page Social Proof, XP Badges & Chart Mock** | Using mock or hardcoded data | [app/page.tsx](file:///c:/Users/rudra/TyProX/app/page.tsx#L130-L169), [achievements.tsx](file:///c:/Users/rudra/TyProX/components/home/achievements.tsx), [analytics.tsx](file:///c:/Users/rudra/TyProX/components/home/analytics.tsx) | Hardcoded fake testimonials (`Alex M.`, `Sarah C.`), fictional `100–200 XP` badges (`Consistent Pace` doesn't exist in DB), and static CSS bar chart (`96`) |
| **Daily Challenges (`daily_challenges`, `user_challenge_progress`)** | UI-only / Dead DB Schema | [FULL_SCHEMA.sql](file:///c:/Users/rudra/TyProX/supabase/migrations/FULL_SCHEMA.sql#L66-L74, L91-L98) | SQL tables, RLS policies, and indexes exist with **zero UI, API routes, or client queries** |
| **Pause / Resume Typing Session** | UI-only / Dead Store Actions | [typing-store.ts](file:///c:/Users/rudra/TyProX/stores/typing-store.ts#L58-L59, L276-L304) | `pauseTest` / `resumeTest` defined on store, never invoked anywhere in UI |
| **Interactive Product Showcase (`/showcase`)** | Orphaned & Mock/Hardcoded | [app/showcase/page.tsx](file:///c:/Users/rudra/TyProX/app/showcase/page.tsx) | 1,236-line scripted tour using 100% mock user (`Rudra Pratap Swain`) & simulated leaderboard; unlinked from navigation |

---

## 2. Detailed Feature Findings

### FI-01 — `/profile` Route Inaccessible in Navigation; Font & Sound Controls Are UI-Only Stubs
- **Priority:** `High` (`Verified`)
- **File Path:** [app/profile/page.tsx](file:///c:/Users/rudra/TyProX/app/profile/page.tsx#L11-L135), [components/navbar.tsx](file:///c:/Users/rudra/TyProX/components/navbar.tsx#L249-L355), [app/layout.tsx](file:///c:/Users/rudra/TyProX/app/layout.tsx#L8-L24), [app/globals.css](file:///c:/Users/rudra/TyProX/app/globals.css#L31)
- **Relevant Component / Function:** `ProfileSettingsPage` (`handleThemeChange`, `handleFontChange`, `handleVolumeChange`), `Navbar`
- **Evidence:** `git grep` across the entire repo confirms zero `<Link href="/profile">` or `router.push('/profile')` references. Inside `ProfileSettingsPage`, `preferences.font_family` offers `'ibm-plex-mono'` and `'geist-mono'`, neither of which is imported in `app/layout.tsx` (which loads `JetBrains_Mono`) or read by `TextDisplay`/`TypingContainer`. `preferences.volume` updates Zustand only — zero Web Audio API or `<audio>` code exists in the repo. Neither setting persists to Supabase `profiles` (`/api/profile` only patches `displayName`).
- **Impact:** Users cannot discover settings from navigation, and directly navigating to `/profile` exposes two non-functional settings controls that mislead users.
- **Recommended Solution:** Add a Settings link (`/profile`) in `Navbar` user controls/mobile menu, remove or implement WebAudio keystroke sound synthesis + real loaded font CSS variables, and persist `theme` and `font_family` via `PATCH /api/profile`.

### FI-02 — Streak Counter Initialization & Achievement Evaluation Bugs
- **Priority:** `High` (`Verified`)
- **File Path:** [app/api/results/route.ts](file:///c:/Users/rudra/TyProX/app/api/results/route.ts#L114-L188), [supabase/migrations/FULL_SCHEMA.sql](file:///c:/Users/rudra/TyProX/supabase/migrations/FULL_SCHEMA.sql#L56-L63, L259)
- **Relevant Component / Function:** `POST /api/results`, `public.handle_new_user()` trigger
- **Evidence:** `streaks.last_active_date` defaults to `CURRENT_DATE` and `current_streak` defaults to `0` (`FULL_SCHEMA.sql:59-61`). When a newly signed-up user completes tests on Day 1, `lastActive === today` (`results/route.ts:126`), skipping the streak update block so `current_streak` remains `0` in Postgres! On Day 2 (`diffDays === 1`), `currentStreak` increments `0 -> 1`, while achievement evaluation (`line 174`) checks stale `streakRow?.current_streak || 1` instead of the updated `currentStreak` (meaning `STREAK_3` unlocks one day late). Also, `today` uses server UTC (`toISOString().split('T')[0]`) rather than user calendar days, and seeded `/achievements/*.svg` files do not exist in `public/`.
- **Impact:** New users stay stuck at a `0` day streak on signup day, streak achievements trigger off-by-one day late, and achievement icons referenced in SQL resolve to 404s if rendered.
- **Recommended Solution:** Initialize `current_streak = 0, last_active_date = NULL` (or treat `current_streak === 0 && lastActive === today` as `current_streak = 1`), evaluate achievements against the updated `currentStreak`, use atomic SQL `INSERT ... ON CONFLICT DO NOTHING`, and add real badge icons or SVG components.

### FI-03 — 1v1 Challenge Completions Do Not Save Results or Record Head-to-Head Outcomes
- **Priority:** `High` (`Verified`)
- **File Path:** [app/challenge/[id]/page.tsx](file:///c:/Users/rudra/TyProX/app/challenge/%5Bid%5D/page.tsx#L38-L81, L159-L169)
- **Relevant Component / Function:** `ChallengePage` (`fetchChallenge`, `handleStartChallenge`, game completion effect)
- **Evidence:** When `status === 'completed'`, `useEffect` switches `gameState` from `'typing'` (`<TypingContainer />`) directly to `'comparison'`. Because `<ResultScreen />` is never mounted on `/challenge/[id]`, neither `POST /api/results` nor `addGuestResult` is ever called. Additionally, `challenge.expires_at` (`FULL_SCHEMA.sql:87`) is never checked (`fetchChallenge` accepts expired rows).
- **Impact:** Completing a 1v1 challenge awards zero dashboard history, zero streak credit, zero leaderboard eligibility, and leaves no persistent record of the duel result for the creator; expired links remain playable indefinitely.
- **Recommended Solution:** Extract score submission into an explicit completion flow or shared hook called once on `status === 'completed'`, enforce `expires_at > now()` in both SQL RLS/query and `ChallengePage`, and persist challenge attempt/winner records in a dedicated table.

### FI-04 — Cat Companion `localStorage` Overwrite Race & Missing `streakDays` Prop
- **Priority:** `Medium` (`Verified`)
- **File Path:** [components/typing/cat-companion.tsx](file:///c:/Users/rudra/TyProX/components/typing/cat-companion.tsx#L296-L372), [components/typing/result-screen.tsx](file:///c:/Users/rudra/TyProX/components/typing/result-screen.tsx#L224-L228)
- **Relevant Component / Function:** `CatCompanion` initialization & unlock `useEffect`, `ResultScreen`
- **Evidence:** Effect 1 (`lines 301-315`) calls `setUnlockedIds(JSON.parse(localUnlocked))`. Effect 2 (`lines 342-372`) executes in the same render pass with the initial state closure `unlockedIds = ['orange', 'void', 'white']` (and intentionally omits `unlockedIds` from its dependency array, triggering an `exhaustive-deps` lint warning), then executes `localStorage.setItem('typrox_cats_unlocked', JSON.stringify([...unlockedIds, targetUnlock.id]))`. Meanwhile `ResultScreen` renders `<CatCompanion>` without passing `streakDays`, locking the default to `1`.
- **Impact:** Unlocking a cat on any subsequent visit silently wipes previously unlocked cats from `localStorage`; streak accessories (`headphones`, `hoodie`, `golden-auras`) never unlock in real sessions.
- **Recommended Solution:** Lazy-initialize `unlockedIds` directly from `localStorage` (or hydrate inside a single effect using functional state updates / ref guard) and pass the user's actual streak count into `<CatCompanion streakDays={...} />`.

### FI-05 — Fabricated Metrics Across Landing Page, Navbar, ResultScreen & Login
- **Priority:** `High` (`Verified`)
- **File Path:** [components/navbar.tsx](file:///c:/Users/rudra/TyProX/components/navbar.tsx#L29-L59, L279-L285), [app/page.tsx](file:///c:/Users/rudra/TyProX/app/page.tsx#L130-L170), [components/typing/result-screen.tsx](file:///c:/Users/rudra/TyProX/components/typing/result-screen.tsx#L186-L190), [components/home/achievements.tsx](file:///c:/Users/rudra/TyProX/components/home/achievements.tsx#L22-L24), [components/home/hero-3d.tsx](file:///c:/Users/rudra/TyProX/components/home/hero-3d.tsx#L581-L608)
- **Relevant Component / Function:** `Navbar` online counter, `Home` testimonials, `ResultScreen` PB badge, `AchievementsSection`, `Hero3D` `HUDPanel`s
- **Evidence:**
  - `Navbar`: `Math.floor(Math.random() * 201) + 350` mutates every 6–10s labeled `"online"`.
  - `ResultScreen`: `result.wpm > 80` displays `"Personal Best"` regardless of user's actual PB (showing "Personal Best" for an 81 WPM run even if the user averages 140 WPM).
  - `Home`: Hardcoded testimonials (`Alex M.`, `Sarah C.`).
  - `AchievementsSection`: Displays `100 XP`, `150 XP`, `200 XP` and `Consistent Pace` — none of which exist in `public.achievements`.
  - `LoginCard`: Displays `"Simulated Profile"` (`#48`, `142 WPM`, `1,428` tests).
- **Impact:** Erodes user trust when discovered (especially showing `"Personal Best"` on mediocre runs or mismatched XP rewards vs the actual database achievements).
- **Recommended Solution:** Remove simulated online counters and fabricated testimonials (or clearly label illustrative previews), compute real Personal Best by comparing against the user's prior max WPM per `(mode, duration)`, and align home achievement cards with actual database definitions.

### FI-06 — Leaderboard Empty State & Unrendered Performance Lab Metrics
- **Priority:** `Medium` (`Verified`)
- **File Path:** [app/leaderboard/page.tsx](file:///c:/Users/rudra/TyProX/app/leaderboard/page.tsx#L232-L270), [app/dashboard/performance-lab/page.tsx](file:///c:/Users/rudra/TyProX/app/dashboard/performance-lab/page.tsx#L40, L178)
- **Relevant Component / Function:** `LeaderboardPage` empty fallback, `PerformanceLabPage` (`fingerLoads`)
- **Evidence:** When a mode/duration filter returns zero real rows, `LeaderboardPage` renders hardcoded `"Demo Rankings"` (`speed_demon 148`, `rhythm_master 126`, `swift_fingers 108`). In `PerformanceLabPage`, `fingerHits` are mapped for every key (`FINGER_MAP`) and saved via `setFingerLoads(fingerHits)` (`line 178`), yet `fingerLoads` is never rendered anywhere in JSX (flagged by ESLint unused-var warning). Moreover, `PerformanceLabPage` assumes `curr.y === 1` means `prev.k` was the mistyped key (`line 145`), misattributing keys if the user typed multiple letters before backspacing or deleted multiple chars sequentially.
- **Impact:** Empty leaderboard categories look populated by bots; per-finger load analytics work is wasted on the CPU without UI value; and `PerformanceLabPage` weak-key stats miscount multi-backspace sequences.
- **Recommended Solution:** Render an honest empty-state CTA on `LeaderboardPage` without fake entries, visualize `fingerLoads` in a finger-balance breakdown chart (while checking signed-in gating properly), and compute weak keys from `expectedKey !== typedKey` during text replay reconstruction against `seed`.

### FI-07 — Saved Database Replays Cannot Be Viewed in Dashboard or Public Profile
- **Priority:** `Medium` (`Verified`)
- **File Path:** [app/dashboard/page.tsx](file:///c:/Users/rudra/TyProX/app/dashboard/page.tsx#L679-L734), [app/u/[username]/page.tsx](file:///c:/Users/rudra/TyProX/app/u/%5Busername%5D/page.tsx), [components/typing/replay-player.tsx](file:///c:/Users/rudra/TyProX/components/typing/replay-player.tsx)
- **Relevant Component / Function:** `Dashboard` history table, `PublicProfilePage`, `ReplayPlayer`
- **Evidence:** `POST /api/results` persists `telemetry` in `public.replays` for every authenticated run, yet neither `Dashboard` (`History Log`) nor `/u/[username]` links a row to a replay viewer. `ReplayPlayer` is only mounted ephemerally inside `ResultScreen`.
- **Impact:** Heavy `JSONB` keystroke payloads accumulate in Postgres (`replays`) with no way for users or spectators to inspect past run replays.
- **Recommended Solution:** Add a `"Watch Replay"` action on Dashboard runs and public top runs (fetching the single replay row on demand and reconstructing `targetText` via `generateText(run.seed, run.mode, run.duration)`).

---

## 3. Product Vision Gap Analysis (Duolingo + Chess.com + GitHub)

| Vision Pillar | Desired Capability | Current Implementation State | Gap Assessment |
|---|---|---|---|
| **Duolingo-style Structured Learning & Progression** | Curriculum levels, guided drills (home row, numbers, code syntax), XP/levels, daily quests, forgiving streak freeze, weak-key targeted drills | `daily_challenges` & `user_challenge_progress` exist in SQL only (dead); `Weak Key Drills` in Performance Lab is read-only text (`"Drill these characters"` without a clickable link to start a custom drill); Home page advertises nonexistent `XP`; Streaks break on Day 1 | **Severe Gap (~15% implemented):** No structured courses, no XP/level model, no daily challenge UI, no drill generator |
| **Chess.com-style Competition, Rankings & Challenges** | Verified ELO/skill ratings, seasonal divisions/leagues, matchmaking / live 1v1 lobbies, rematch & win/loss records, strict anti-cheat & server adjudication | Async seed `challenge_links` allow racing a target WPM (without saving challenger result or opponent scoreboard); static tier badges (`Bronze`–`Grandmaster`) are just WPM thresholds on `/leaderboard`; anti-cheat trivially bypassed | **Significant Gap (~25% implemented):** No rating/ELO system, no real-time WebSocket head-to-head race, no verified anti-cheat, no persistent challenge match history |
| **GitHub-style Profiles, Activity & Community** | Contribution/practice calendar heatmap, pinned records, shareable replay links, followers/friends leaderboard, bio/gear setup, community comparison | `/u/[username]` displays 4 aggregate numbers, active streak, and achievement list; no activity heatmap, no recent tests table, no replay viewing, no bio/keyboard metadata, no follow/search/compare features | **Major Gap (~20% implemented):** Basic stat card exists on `/u/[username]`, but lacks activity visualization and social graph |

