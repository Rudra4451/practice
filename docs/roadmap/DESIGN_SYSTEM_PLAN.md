# TyProX Unified Design System & UX Plan (Phase 4)

**Document Status:** Planning Only (No code edits or style rewrites executed)  
**Prerequisite Gate:** Security hardening (Phase 1) and Core Engine + Engineering stability (Phases 2–3) must stabilize before full cross-page visual unification. CSS token repairs (`UX-04`), active typing HUD visibility (`UX-01`), look-ahead blur removal (`UX-02`), and theme hydration sync (`UX-05`) can be staged cleanly alongside/immediately following Phase 2 UX stabilization!  
**Primary Audit Sources:** [UX_REVIEW.md](file:///c:/Users/rudra/TyProX/docs/audit/UX_REVIEW.md), [PROJECT_AUDIT.md](file:///c:/Users/rudra/TyProX/docs/audit/PROJECT_AUDIT.md), [FEATURE_INVENTORY.md](file:///c:/Users/rudra/TyProX/docs/audit/FEATURE_INVENTORY.md)

---

## 1. Visual Direction, Editorial Principles & Anti-Slop Design Read

> **Design Read:** Typing proficiency workspace & competitive precision product for deliberate learners and competitive typists, executed in a warm-accent editorial dark/light surface aesthetic (`ENERGY 2 / RHYTHM 2 / MOTION 1`).

### Core Brand Identity Preserved
- **Signature Accent:** Vibrant Signal Orange `#FF5C00` (used deliberately for primary CTAs, active carets, active indicators, and key WPM highlights — never scattered onto every card border or background blob).
- **Surfaces:**
  - **Dark Editorial Default:** Deep Charcoal `#0F0F10` canvas, `#171717` primary cards, `#202022` elevated controls, `rgba(255, 255, 255, 0.09)` crisp hairline borders.
  - **Clean Light Editorial:** Warm off-white `#F5F5F7` canvas, pure `#FFFFFF` primary cards, `#EBEBED` elevated controls, `rgba(15, 15, 16, 0.10)` hairline borders.
- **Restraint Rules:**
  1. Zero leftover **Neobrutalist/Bauhaus** rules (`border-3`, `rounded-none`, hard `shadow-[8px_8px_0px_0px_var(--border)]`, decorative red/yellow square corner dots).
  2. Zero leftover **Indigo/Purple** glow shadows (`rgba(99, 102, 241, ...)`).
  3. Zero excessive `backdrop-blur-md` glassmorphism on standard bento/stat cards (reserve subtle translucency exclusively for the sticky Navbar & modal backdrop overlay).
  4. Zero ambient colored blur blobs floating behind forms or typing boxes, and zero generic AI copy/fake customer metrics ("Alex M.", "Sarah C.", simulated online counts).
  5. Every visual indicator must communicate genuine state or hierarchy (`tabular-nums` alignment on speeds/ranks, restrained semantic tokens for success/warning/error).

---

## 2. Design Tokens, Contrast Audit & Typography Spec

### DES-4.1: Unified `@theme` Tokens & WCAG 2.1 AA Accessibility Fixes
- **Audit Reference:** `UX-03`, `UX-04`, `UX-05`, `UX-06`
- **Problem:**
  1. Missing CSS variables silently break styling: `text-warning` / `bg-warning/*` (Leaderboard podium/tier & Dashboard Zap), `hover:bg-surface-hover` (ReplayPlayer), `bg-neutral-850` / `border-neutral-750` (Hero3D), `bg-noise-overlay`, and `animate-[slide_3s_infinite]`.
  2. `#FF5C00` + `#FFFFFF` text on primary buttons (`Button`, `Dashboard`, `Profile`, `ReplayPlayer`) yields only **~3.10:1** contrast (failing WCAG AA `4.5:1` for normal/small `12px–14px` text!). Meanwhile `text-tertiary` `#888888` on `#F5F5F7` (~3.26:1) and `#6C6C6C` on `#171717` (~3.57:1) also fail AA on muted labels!
  3. Leftover `bauhaus-*` variables (`globals.css:22-27`) and `.animate-glow` indigo shadow (`line 215`) invite drift.
  4. Initial visit renders DOM `class="dark"` (`layout.tsx:92`) while `useUserStore` initializes `theme: 'light'` (`user-store.ts:52`), showing Moon icon on a dark page.
- **Root Cause:** Incremental theme migration never cleaned old tokens, never audited AA contrast pairs, and mismatched initial SSR script vs store state.
- **Proposed Solution ([app/globals.css](file:///c:/Users/rudra/TyProX/app/globals.css), [components/ui/button.tsx](file:///c:/Users/rudra/TyProX/components/ui/button.tsx), [app/layout.tsx](file:///c:/Users/rudra/TyProX/app/layout.tsx), [stores/user-store.ts](file:///c:/Users/rudra/TyProX/stores/user-store.ts)):**

  | Token | Light (`:root`) | Dark (`.dark`) | Purpose & AA Check |
  |---|---|---|---|
  | `--background` | `#F5F5F7` | `#0F0F10` | Canvas background |
  | `--surface` | `#FFFFFF` | `#171717` | Card / panel base |
  | `--surface-elevated` | `#ECECEE` | `#202022` | Subtle grouped containers |
  | `--surface-hover` | `#E4E4E7` | `#2A2A2D` | Interactive hover state (Fixes `hover:bg-surface-hover`) |
  | `--text-primary` | `#0F0F10` | `#F5F5F5` | Primary ink (`> 16:1`) |
  | `--text-secondary` | `#4B4B52` | `#A5A5AD` | Secondary copy (`>= 7.5:1` AA PASS) |
  | `--text-tertiary` | `#5E5E66` | `#8E8E96` | Captions/timestamps (`>= 5.3:1` AA PASS — fixed from `#888888`/`#6C6C6C`) |
  | `--accent` | `#FF5C00` | `#FF5C00` | Brand fill & large display figures |
  | `--accent-foreground` | `#0F0F10` | `#0F0F10` | **Mandatory ink on `#FF5C00` fills (`~6.78:1` AA PASS!)** |
  | `--accent-ink` | `#B84000` | `#FF7426` | Text-on-surface accent (`~5.1:1` on light `#FFFFFF`, `~7.2:1` on dark `#171717`) |
  | `--success` | `#157347` | `#2ECC71` | Correctness / gain |
  | `--warning` | `#B45309` | `#F59E0B` | Gold rank, caution, streaks (`>= 4.6:1` on light `#FFFFFF`!) |
  | `--error` | `#C81E1E` | `#F87171` | Mistakes & invalid alerts (`>= 5.1:1` AA PASS) |
  | `--border` | `rgba(15, 15, 16, 0.11)` | `rgba(255, 255, 255, 0.10)` | `1px` crisp structural borders |

  - **Primary Button Standard (`components/ui/button.tsx`):** Change `variant="primary"` text color from `text-white` to `text-[var(--accent-foreground)]` (`#0F0F10`) with crisp hover state `#E65300` / `#FF6E1A` (`6.78:1` contrast, consistent with `ToastContainer` & `CatCompanion`). Update `.dark` and `:root` primary shadow without indigo glows.
  - **Typography Floor & Hierarchy:**
    - Establish clean minimum legible font size `12px` (`text-xs`) for all interactive labels, micro-stats, and captions (eliminate `text-[6px]`, `text-[7px]`, `text-[8px]`, `text-[9px]`, and `text-[10px]` except true single-keycap hardware sub-legends if ≥ `10px`).
    - Restrict uppercase wide tracking (`tracking-[0.08em]` max) strictly to concise table headers / stat eyebrows; render descriptive empty states, helper instructions, and banners in normal sentence case (`font-medium` / `font-semibold`).
  - **Initial Theme Sync:** Set default `preferences.theme: 'dark'` in [stores/user-store.ts](file:///c:/Users/rudra/TyProX/stores/user-store.ts#L52) matching `layout.tsx` `<Script>` SSR default (`'dark'`), plus add safe hydration listener reconciling `document.documentElement.classList` on load. Verify every component in both themes (`UX-05`: replace `Hero3D` dark perimeter vignette with `var(--background)` fade and `CatCompanion` `bg-neutral-950/80` with `bg-surface`).
- **Files/Components Affected:** `app/globals.css`, `app/layout.tsx`, `stores/user-store.ts`, `components/ui/button.tsx`, `components/home/hero-3d.tsx`, `components/typing/cat-companion.tsx`, `components/typing/replay-player.tsx`, `app/leaderboard/page.tsx`, `app/dashboard/page.tsx`, `app/login/page.tsx`.
- **Database Changes:** Update default `profiles.theme` remains `'dark'` (already matches `FULL_SCHEMA.sql:23`!).
- **Security Implications:** None directly; guarantees readable security/validation error banners across themes.
- **Dependencies:** `ENG-3.2` (font loading vars in `globals.css` / `layout.tsx`).
- **Testing Requirements:** Automated contrast audit / Playwright checks verifying computed contrast ratio `>= 4.5:1` on primary button, muted text, warning badges, and CatCompanion in **both** light and dark modes; Playwright first-visit icon state test (`html.dark` <-> Sun toggle sync).
- **Acceptance Criteria:** Zero undefined utility classes (`text-warning`, `bg-neutral-850`, `bg-surface-hover`, `bg-noise-overlay`, `bauhaus-*`); zero indigo `rgba(99,102,241)` rules; primary orange CTA contrast `>= 6.5:1`; theme toggle works on single first click.
- **Priority:** `High`
- **Estimated Complexity:** `M`

---

## 3. Page-by-Page UX & Component Remediation

### DES-4.2: Practice Interface (`/typing`), Live Focus HUD & Results Screen (`UX-01`, `UX-02`, `UX-07`, `UX-08`)
- **Audit Reference:** `UX-01`, `UX-02`, `UX-06`, `UX-07`, `UX-08`, `FI-05`
- **Problem:**
  1. During active typing (`status === 'running'`), mode/duration bar AND real-time stats grid collapse with `opacity-0 absolute`, jumping the typing area vertically mid-keystroke and hiding `Remaining` time + `WPM` (`UX-01`).
  2. `TextDisplay` applies `opacity-10 blur-[2px]` to every word beyond `activeWordIdx + 4`, blocking fast typists from reading 6–12 words ahead (`UX-02`).
  3. Top mode selector (`words | quotes | numbers | punctuation | code`) has zero wrapping, overflowing `< 400px` screens (`UX-07`).
  4. `ResultScreen` repeats `errorCount` twice (`Errors (uncorrected)` + `Mistakes registered`), uses `backdrop-blur-md` on stat boxes, and shows fake PB at `> 80 WPM`.
- **Root Cause:** Over-aggressive focus-mode hiding via `position: absolute`, arbitrary `+4` word blur mask, fixed single-row flex config bar, and leftover prototype markup.
- **Proposed Solution:**
  1. **Zero-Jump Practice Arena (`TypingContainer`):**
     - **Reserve Fixed Flow Height:** Mode & Duration config bar sits in a fixed-height top control slot (`min-h-[48px]`). When `status === 'running'`, keep it in normal layout flow at `opacity-0 pointer-events-none select-none` (NO `position: absolute`, NO `-translate-y-4` collapsing height!).
     - **Keep Minimalist Live HUD Always Visible:** Directly above the text viewport, display a clean, distraction-free monochrome numeric bar (`font-mono tabular-nums text-xl md:text-2xl`): `Time Remaining` (accent `#FF5C00` countdown), `WPM` (live), `Accuracy %`, and subtle `Streak / Combo` secondary metric. Zero heavy glass boxes bouncing on/off! During `status === 'idle'`, show `--` cleanly in-place with zero height jump upon first keystroke.
     - **Responsive Controls:** Use `flex-wrap justify-center gap-1` on mode pills for `< 640px` mobile screens with `>= 40px` minimum vertical touch targets.
     - **Subtle Focus Affordance:** Replace pulsing `animate-pulse` bottom overlay on blur with crisp non-pulsing notice badge + clean hairline border change. Remove reactive floating colored blur circle behind typing box (`typing-container.tsx:222-231`).
  2. **Crisp Look-Ahead Reading (`TextDisplay`):**
     - Remove `isFarFutureWord` (`opacity-10 blur-[2px]`) completely! Keep upcoming text cleanly readable in high-legibility muted gray (`--text-secondary` light / `--text-tertiary` brightened AA dark), active word crisp (`--text-primary`), correctly typed words muted cleanly without blur, and errors underlined + highlighted in clean `--error`. Smooth 3-line scrollable viewport tracks active line accurately.
  3. **Clean Result Screen Layout (`ResultScreen`):**
     - Remove `backdrop-blur-md` from the 4 headline KPI bento cards (`bg-surface border border-border rounded-2xl`), display real `isPersonalBest` badge only when strictly beating prior best `(mode, duration)`, render consolidated `Performance Summary` (`Raw Speed`, `Keystrokes Correct / Total`, `Uncorrected Errors`, `Backspaces Pressed`), and render `Weak Keys` with honest normal typography and clickable `"Drill weak keys"` action hook (prepared cleanly for Phase 5).
- **Files/Components Affected:** `components/typing/typing-container.tsx`, `components/typing/text-display.tsx`, `components/typing/result-screen.tsx`.
- **Testing Requirements:** Playwright viewport layout stability test (`boundingBox().y` of `[aria-label="Typing input area"]` remains constant within `1px` from `idle` -> `running` transition); visual inspection confirming look-ahead words `> +4` have `filter: none`; mobile `375px` horizontal overflow check (`scrollWidth <= clientWidth`).
- **Acceptance Criteria:** Typing box does not shift vertically on first keypress; live remaining seconds & WPM stay legible throughout the test; zero blurred future words; zero horizontal scroll on `375px` phones.
- **Priority:** `Critical`
- **Estimated Complexity:** `M`

---

### DES-4.3: Unify Neobrutalist / Indigo Fragmented Routes (`/dashboard/performance-lab`, `/challenge/[id]`, `/u/[username]`, `/login`, `/profile`, Modals & Toasts)
- **Audit Reference:** `UX-03`, `UX-06`, `UX-08`, `FI-06`
- **Problem:**
  1. `PerformanceLabPage`, `ChallengePage`, `PublicProfilePage`, `UsernameModal`, `ToastContainer`, and Leaderboard empty state still use Neobrutalist `border-3`, sharp corners, square Bauhaus blocks, and `shadow-[8px_8px_0px_0px_var(--border)]`.
  2. `LoginPage`, `ProfileSettingsPage`, `LeaderboardPage`, and `Home` `AnalyticsSection` retain legacy indigo glows (`rgba(99,102,241,0.12)`).
  3. `ChallengePage` uses `<Sparkles className="animate-spin" />` and `<div className="animate-bounce">` trophies; `UsernameModal` omits `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and Escape/Tab focus trap; `Navbar` omits `aria-expanded` on mobile toggle and lacks link to `/profile` + clean link to `/u/[username]`.
- **Root Cause:** Partial design migration across pages + omitted ARIA dialog accessibility + unlinked navigation items.
- **Proposed Solution:**
  1. **Unify Visual Surface Tokens Across Every Page & Overlay:**
     - Rewrite `PerformanceLabPage`, `ChallengePage`, `PublicProfilePage`, `UsernameModal`, `ToastContainer`, and Leaderboard empty state from `border-3` hard Bauhaus cards -> clean `bg-surface border border-border rounded-2xl shadow-xs` matching `/typing` and `/dashboard`. Remove decorative yellow/red circle/square dots and bouncing/spinning icons.
     - Remove all inline indigo `rgba(99, 102, 241, ...)` shadow utilities from `login`, `profile`, `leaderboard`, and `analytics`.
     - Replace `animate-pulse` status dots or perpetual animations in empty/win states with crisp static icons or subtle initial fade transition (`MOTION 1`).
  2. **Navigation & Settings Discoverability (`Navbar`, `/profile`, `/dashboard`):**
     - Strip simulated online counter (`350–550`) cleanly from `Navbar` (`FI-05`).
     - Replace duplicate `{username} -> /dashboard` link with a crisp accessible **Account Menu / Dropdown** (`aria-expanded`, `aria-controls`, `Escape` close) linking to: **Dashboard** (`/dashboard`), **Public Profile** (`/u/[username]`), **Settings** (`/profile`), and **Sign Out** (plus expose clean links inside mobile drawer). Add `aria-expanded={mobileMenuOpen}` + `aria-controls="mobile-nav"` on mobile menu trigger.
  3. **Accessible Modal Semantics (`UsernameModal` + Shared Replay Modal):**
     - Wrap modal with `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus trap keeping Tab inside dialog while open, autofocus username input on open, and `Escape` handler (when dismissal permitted; note onboarding enforces username selection gracefully).
  4. **Dashboard & Leaderboard Editorial Cleanup (`UX-07`, `UX-08`, `FI-05`, `FI-06`):**
     - **Dashboard:** Remove redundant `"Recent Runs"` duplicate section directly above `"Complete History Log"`; replace 9-column swipe notice (`← swipe table →`) on `< 768px` viewports with stacked mobile run cards (Mode/Duration, WPM/Acc, Date, Replay trigger) while keeping full `tabular-nums` data table on desktop (`>= md`). Replace `⌨️`/`🔒` emojis with crisp Lucide icons (`Keyboard`, `Lock`).
     - **Leaderboard:** Remove simulated `"Demo Rankings"` fallback on empty filter categories; display honest empty state with CTA button `"Set first verified [mode] [duration] record"`. Replace indigo podium glow with subtle hairline border + `--warning` gold Rank #1 icon.
     - **Performance Lab:** Render computed `fingerLoads` (`FI-06`) as an actual clean 8-finger distribution horizontal bar list alongside `Left vs Right` hand balance! Fix key error calculation from replay reconstruction (`ENG-3.3` / `SPEC-5.1`).
     - **Login Page:** Remove fake `"Simulated Profile"` mock panel (`#48`, `142 WPM`, `1,428` tests, `bg-warning/20` blur); replace right column with crisp value summary of authenticated progression & honest verified benefits (using zero fabricated stats).
- **Files/Components Affected:** `components/navbar.tsx`, `components/auth/username-modal.tsx`, `components/ui/toast-container.tsx`, `app/dashboard/page.tsx`, `app/dashboard/performance-lab/page.tsx`, `app/leaderboard/page.tsx`, `app/login/page.tsx`, `app/profile/page.tsx`, `app/challenge/[id]/page.tsx`, `app/u/[username]/page.tsx`.
- **Database Changes:** None.
- **Security Implications:** Removes misleading mock profile numbers & unauthenticated visual confusion.
- **Dependencies:** `DES-4.1`, `ENG-3.2` (`/profile`), `ENG-3.3` (Server Component props on public pages).
- **Testing Requirements:** Playwright tests for `Navbar` dropdown keyboard/click access to `/profile` and `/u/[username]`; `UsernameModal` `role="dialog"`, Tab trap & ARIA labels check; responsive table->card switch at `375px` & `1280px`; zero horizontal scroll across all routes.
- **Acceptance Criteria:** Visually cohesive surface/radius/border treatment across all 9 routes; zero `border-3` / Bauhaus / indigo classes; accessible modal + mobile nav ARIA state verified; zero fabricated leaderboard/profile numbers.
- **Priority:** `High`
- **Estimated Complexity:** `L`

---

### DES-4.4: Homepage (`/`), Hero 3D Keyboard & Honest Editorial Content (`UX-03`, `UX-06`, `UX-07`, `FI-05`)
- **Audit Reference:** `UX-03`, `UX-05`, `UX-06`, `UX-07`, `FI-05`
- **Problem:**
  1. `Hero3D` sizes key rows via `(k.unitWidth / 15) * 100%` plus `gap-[3.5px]` causing overflow/cramping (`UX-07`); negative-positioned HUD panels (`left-[-40px]`, `right-[-50px]`) clip or collide on tablet/mobile; perpetual floating key trails, rainbow `40ms` flashes, and 250ms vibration distract from headline copy; radial perimeter gradient uses dark `rgba(15,15,16,0.95)` even in light mode; keycap typography dips to `6px` (`text-[6px]`).
  2. Home page contains fabricated testimonials (`Alex M.`, `Sarah C.`) and advertises `100–200 XP` / `Consistent Pace` badges that do not exist in the database (`FI-05`).
  3. Subheading & hero copy styling uses low-contrast/micro text.
- **Root Cause:** Overflow-prone percentage + gap math, showcase-first motion tuning (`MOTION 3` noise inside hero), theme-blind vignette CSS, and ungrounded copy.
- **Proposed Solution:**
  1. **Refactor `Hero3D` Layout & Math (`components/home/hero-3d.tsx`):**
     - Replace fractional `% + gap` width calculation with crisp **60-column CSS Grid** (`grid-template-columns: repeat(60, minmax(0, 1fr))`) mapping quarter-u key widths cleanly (`grid-column: span ${Math.round(k.unitWidth * 4)}`) so total row width is **exact 100%** with zero math clipping!
     - Enforce minimum readable keycap legend typography (`>= 9px` compact hardware sub-legend or hide sub-labels cleanly on `< sm` mobile) and responsive chassis padding.
     - Reposition `HUDPanel` metrics cleanly into an anchored architectural status row beneath/beside the keyboard on `>= lg` (zero overlapping `left-[-50px]` offsets) and clearly label as interactive **Live Preview Telemetry** reflecting the keycap demo typing speed (or real global/personal speed when fetched in Phase 3 RSC!), rather than unlabelled fake user data.
     - Remove continuous vibration jitter and infinite floating char-trail elements; keep clean tactile keycap press depression + subtle highlight pulse on active simulated keystrokes (gated by `IntersectionObserver` + `prefers-reduced-motion`). Fix vignette background to `var(--background)`.
  2. **Honest Editorial Sections (`app/page.tsx`, `components/home/*`):**
     - Remove fabricated testimonials (`Alex M.`, `Sarah C.`) entirely! Replace that section with authentic product mechanics showcase (e.g., how TyProX measures keystroke rhythm, deterministic challenge links, and keyboard analytics) or real verified platform overview metrics if DB public query is enabled in Phase 3.
     - Align `AchievementsSection` cards with the **real database achievements** seeded in `public.achievements` (`Keyboard Apprentice`, `Swift Fingers`, `Speed Demon`, `Warming Up`, etc.) with authentic criteria (`50 WPM / 90% Acc`, `7-day streak`) instead of fictional `Consistent Pace` / `100 XP` placeholders until Phase 5 XP launches!
     - Ensure crisp section vertical rhythm (`ENERGY 2 / RHYTHM 2`) with clear focal point on hero CTA (`"Start Typing Test"` -> `/typing`, `"View Leaderboards"` -> `/leaderboard`).
- **Files/Components Affected:** `app/page.tsx`, `components/home/hero-3d.tsx`, `components/home/achievements.tsx`, `components/home/analytics.tsx`, `components/home/comparison.tsx`, `components/home/faq.tsx`.
- **Database Changes:** Optional public read-only platform counters in Phase 3 (`count(test_results)` if product owner wants real aggregate counts on `/` — never hardcoded numbers!).
- **Security Implications:** None.
- **Dependencies:** `DES-4.1`, `ENG-3.3`, `ENG-3.4` (`Hero3D` IntersectionObserver throttling).
- **Testing Requirements:** Playwright responsive visual/overflow checks on `/` at `375x812`, `768x1024`, and `1440x900` in both light and dark modes (`scrollWidth <= clientWidth`, zero clipped `HUDPanel`s); verify zero testimonials mentioning `Alex M.` or `Sarah C.` remain.
- **Acceptance Criteria:** `Hero3D` fits cleanly within chassis padding across all breakpoints; light-mode `/` shows crisp `#F5F5F7` canvas edges without dark vignette smudging; zero fake testimonials or non-existent XP numbers displayed.
- **Priority:** `Medium`
- **Estimated Complexity:** `M`

