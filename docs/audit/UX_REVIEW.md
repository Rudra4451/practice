# TyProX — UI/UX & Editorial Design Audit

**Audit Date:** 2026-11-10  
**Design Target Evaluated Against:** Premium, minimal, modern editorial typography aesthetic — clean spacing rhythm, clear visual hierarchy, restraint on decorative effects, responsive mobile usability, and WCAG 2.1 AA accessibility.

---

## 1. Visual System & Page-by-Page Overview

| Route | Aesthetic Alignment | Primary UX / Visual Issues |
|---|---|---|
| `/` ([app/page.tsx](../../app/page.tsx), [hero-3d.tsx](../../components/home/hero-3d.tsx)) | Mixed Editorial / Tech Promo | Hero 3D keyboard clips/overlaps negative-positioned HUDs on smaller widths; perpetual floating text trails + continuous vibration/rainbow flicker (`40ms`) distract from headline; fake testimonials; dark radial vignette hardcoded to `rgba(15,15,16,0.95)` looks muddy in light mode |
| `/typing` ([typing-container.tsx](../../components/typing/typing-container.tsx), [text-display.tsx](../../components/typing/text-display.tsx), [result-screen.tsx](../../components/typing/result-screen.tsx)) | Clean Concept, Severely Broken Live States | **Live timer & WPM vanish (`opacity-0 absolute`) when typing begins**; future words past `+4` are blurred (`opacity-10 blur-[2px]`); mobile keyboard/IME breaks; ResultScreen shows false `"Personal Best"` when `wpm > 80`; duplicate error rows; animated CatCompanion mascot clashes with minimal editorial tone |
| `/leaderboard` ([leaderboard/page.tsx](../../app/leaderboard/page.tsx)) | Hybrid Editorial / Bauhaus / Indigo Glow | Undefined `text-warning` class breaks Gold rank styling & Rank 1 trophy; empty state switches into thick `border-2`/`border-3` Bauhaus boxes (`bg-bauhaus-yellow`, `bg-bauhaus-red`); leftover indigo drop-shadow; uppercase bold tracking everywhere reduces legibility |
| `/dashboard` ([dashboard/page.tsx](../../app/dashboard/page.tsx)) | Modern Bento Cards, Dense Uppercase Micro-Text | `text-warning` icon broken; tiny `9px`/`10px` uppercase bold labels; redundant `"Recent Runs"` list immediately above `"Complete History Log"` table; no replay link per row; emoji placeholders (`⌨️`, `🔒`) |
| `/dashboard/performance-lab` ([performance-lab/page.tsx](../../app/dashboard/performance-lab/page.tsx)) | Full Unmigrated Neobrutalist Style | Sharp `border-3 border-border`, zero border-radius boxes, `bg-bauhaus-red`, dense uppercase labels — completely visually disconnected from `/` and `/typing` |
| `/login` ([login/page.tsx](../../app/login/page.tsx)) | Glass Card + Indigo Legacy | Leftover indigo focus shadows; bottom-right ambient `bg-warning/20` token missing; `"Simulated Profile"` card adds visual noise rather than clear value |
| `/profile` ([profile/page.tsx](../../app/profile/page.tsx)) | Orphaned Glass Form + Indigo Legacy | **No link to `/profile` exists anywhere**; fonts & volume sliders do nothing; uses `<a>` instead of Next `<Link>`; indigo drop-shadows |
| `/challenge/[id]` & `/u/[username]` | Full Unmigrated Neobrutalist Style | `border-3 border-border`, square sharp boxes, `bg-bauhaus-yellow`, bouncing/spinning icons (`animate-bounce`, `animate-spin` on static `Sparkles`!), completely inconsistent with `/typing` |
| `/showcase` (`showcase/page.tsx`) | Orphaned Bauhaus Deck | Unlinked 1,236-line Neobrutalist tour with completely incompatible yellow/red square aesthetic |
| **Global Modals & Toasts** ([username-modal.tsx](../../components/auth/username-modal.tsx), [toast-container.tsx](../../components/ui/toast-container.tsx)) | Heavy Neobrutalist | `border-3`, `shadow-[8px_8px_0px_0px_var(--border)]`, decorative `bg-bauhaus-yellow`/`bg-bauhaus-red` corner shapes, modal lacks ARIA dialog semantics & focus trap |

---

## 2. Detailed UI/UX & Accessibility Findings

### UX-01 — Active Typing Hides Live Timer & WPM and Causes Layout Jump
- **Priority:** `Critical` (`Verified`)
- **File Path:** [components/typing/typing-container.tsx](../../components/typing/typing-container.tsx#L233-L290,L359-L362)
- **Relevant Component / Function:** `TypingContainer` (Config bar, Real-time stats grid, Control row)
- **Evidence:** On first keypress (`status === 'running'`), the mode/duration bar (`lines 234-237`) and the entire real-time stats grid (`lines 285-289`) apply `opacity-0 -translate-y-4 pointer-events-none absolute w-full`. Because both transition from static flow to `position: absolute`, the typing box abruptly jumps upward mid-keystroke while hiding `Remaining` (`timeLeft`), `WPM`, `Accuracy`, and `Combo`.
- **Impact:** Typists lose visual confirmation of how many seconds remain or how fast they are pacing, and the viewport shifts just as their hands start moving.
- **Recommended Solution:** Keep the live timer (`timeLeft`) and key metrics (`WPM`, `Accuracy`) smoothly visible (minimal monochrome numerals directly above the text box), and reserve fixed height (`invisible` / opacity transition without `position: absolute`) for secondary configuration bars that fade out during focus mode.

### UX-02 — Future Word Blur (`opacity-10 blur-[2px]`) Obstructs Look-Ahead Reading
- **Priority:** `High` (`Verified`)
- **File Path:** [components/typing/text-display.tsx](../../components/typing/text-display.tsx#L70-L78)
- **Relevant Component / Function:** `TextDisplay` word renderer
- **Evidence:**
  ```tsx
  const isFarFutureWord = wordIdx > activeWordIdx + 4;
  // ...
  isFarFutureWord ? 'opacity-10 blur-[2px] pointer-events-none' : ''
  ```
- **Impact:** Skilled typists (>80 WPM) read 1–2 phrases (6–12 words) ahead of their caret. Blurring everything beyond word `+4` forces constant saccadic stalls and slows peak speed.
- **Recommended Solution:** Remove `blur-[2px]` and `opacity-10` on upcoming words; keep upcoming lines crisply readable in muted `text-text-secondary` / `text-text-tertiary` (with active-line focus handled via smooth 3-line viewport scrolling).

### UX-03 — Severe Design System Fragmentation & Unmigrated Bauhaus / Indigo Artifacts
- **Priority:** `High` (`Verified`)
- **File Path:** [app/globals.css](../../app/globals.css#L21-L27,L215-L216), [app/dashboard/performance-lab/page.tsx](../../app/dashboard/performance-lab/page.tsx), [app/challenge/[id]/page.tsx](../../app/challenge/%5Bid%5D/page.tsx), [app/u/[username]/page.tsx](../../app/u/%5Busername%5D/page.tsx), [components/auth/username-modal.tsx](../../components/auth/username-modal.tsx), [components/ui/toast-container.tsx](../../components/ui/toast-container.tsx), [app/login/page.tsx](../../app/login/page.tsx), [app/profile/page.tsx](../../app/profile/page.tsx), [app/leaderboard/page.tsx](../../app/leaderboard/page.tsx), [components/home/analytics.tsx](../../components/home/analytics.tsx)
- **Relevant Component / Function:** Design tokens and cross-page surface styling
- **Evidence:**
  1. TyProX migrated partially to rounded `#FF5C00` cards (`rounded-2xl`, `border`), yet `/dashboard/performance-lab`, `/challenge/[id]`, `/u/[username]`, `/showcase`, `UsernameModal`, `ToastContainer`, and Leaderboard's empty state still render **hard Neobrutalist** boxes (`border-3`, `shadow-[8px_8px_0px_0px_var(--border)]`, square Bauhaus corner blocks).
  2. `globals.css:215-216` (`.animate-glow`), `login/page.tsx` (`lines 128, 173, 248, 267`), `profile/page.tsx` (`lines 32, 50, 60, 82, 92, 130`), `leaderboard/page.tsx` (`line 120`), and `analytics.tsx` (`line 56`) retain leftover **indigo** glow shadows (`rgba(99, 102, 241, ...)`), clashing with `#FF5C00`.
  3. Glassmorphism (`backdrop-blur-md bg-surface/30`) + ambient colored blurs are placed excessively on standard stat cards and forms across `ResultScreen`, `Dashboard`, `Login`, `Profile`, and `Hero3D`.
- **Impact:** Navigating between `/typing` -> `/dashboard` -> `/dashboard/performance-lab` -> `/u/[username]` -> receiving a toast feels like jumping between three unrelated apps and fails the minimal, cohesive editorial direction.
- **Recommended Solution:** Retire `bauhaus-*` aliases, indigo `rgba(99, 102, 241)` shadows, `border-3` hard offsets, and gratuitous ambient blur blobs; unify every route, modal, and toast onto crisp surface hairlines (`1px solid var(--border)`), consistent radii, and disciplined `#FF5C00` accent usage.

### UX-04 — Undefined Tailwind v4 CSS Tokens Silently Drop Styles Across Pages
- **Priority:** `High` (`Verified`)
- **File Path:** [app/globals.css](../../app/globals.css#L3-L101), [app/leaderboard/page.tsx](../../app/leaderboard/page.tsx#L33,L338-L344,L391), [app/dashboard/page.tsx](../../app/dashboard/page.tsx#L525), [app/login/page.tsx](../../app/login/page.tsx#L119), [components/typing/replay-player.tsx](../../components/typing/replay-player.tsx#L187,L196), [components/home/hero-3d.tsx](../../components/home/hero-3d.tsx#L152,L255,L420,L529), [components/typing/cat-companion.tsx](../../components/typing/cat-companion.tsx#L581-L582)
- **Relevant Component / Function:** `@theme` tokens & utility classes
- **Evidence:** The following classes do **not** exist in `@theme` (`app/globals.css`) or Tailwind v4's built-in palette:
  - `text-warning`, `bg-warning/*`, `border-warning/*` (`leaderboard`, `dashboard`, `login` — breaks Gold tier badge, #1 trophy/podium color, and Dashboard streak Zap icon).
  - `hover:bg-surface-hover` (`replay-player.tsx:187, 196`).
  - `bg-neutral-850`, `border-neutral-750` (`hero-3d.tsx:152, 255, 529` — keyboard chassis & pressed keycaps lose intended border/fill colors).
  - `bg-noise-overlay` (`hero-3d.tsx:420`) and `animate-[slide_3s_infinite]` (`cat-companion.tsx:581-582` — no `@keyframes slide` exists).
- **Impact:** Key UI indicators (Rank 1 Gold crown/number, streak icon, Gold rank pill, keyboard frame contrast, button hover states) render unstyled or invisible in light/dark themes.
- **Recommended Solution:** Define semantic `--color-warning` (`:root` & `.dark`) and `--color-surface-hover` in `app/globals.css`, replace `neutral-850`/`neutral-750` with standard tokens (`neutral-800`/`neutral-900` or surface tokens), and remove unused `bg-noise-overlay` / undefined keyframes.

### UX-05 — Light / Dark Mode Hydration State Inversion & Light-Mode Hero Vignette Clash
- **Priority:** `Medium` (`Verified`)
- **File Path:** [app/layout.tsx](../../app/layout.tsx#L75-L97), [stores/user-store.ts](../../stores/user-store.ts#L51-L55), [components/home/hero-3d.tsx](../../components/home/hero-3d.tsx#L419), [components/typing/cat-companion.tsx](../../components/typing/cat-companion.tsx#L603,L653,L684)
- **Relevant Component / Function:** Theme initializer script vs `useUserStore`, `Hero3D`, `CatCompanion`
- **Evidence:** When `localStorage['user-store']` is empty, `layout.tsx:92` adds `class="dark"` to `<html>`, while `useUserStore` initializes `preferences.theme: 'light'`. Consequently, `Navbar` displays the **Moon** icon on a dark page, and the first click sets `theme: 'dark'` with no visible change until clicked a second time. Furthermore, `Hero3D` (`line 419`) renders `bg-radial-[circle_at_center,transparent_40%,rgba(15,15,16,0.95)_100%]` (black perimeter vignette) even on `#F5F5F7` light mode, and `CatCompanion`'s drawer (`line 653`) hardcodes dark `bg-neutral-950/80` with `text-text-primary` (black text on dark background in light mode!).
- **Impact:** Broken theme toggle UX for every first-time visitor, dark vignette muddy edges on light home page, and unreadable black-on-black text inside CatCompanion drawer in light mode.
- **Recommended Solution:** Align default initial theme (`'dark'` in both `<Script>` and `useUserStore` or read DOM class on hydration), use theme-aware CSS variables (`var(--background)`) in `Hero3D` vignettes and `CatCompanion` drawers, and verify every component in both light and dark modes.

### UX-06 — Accessibility Failures: Contrast Ratio, Micro-Typography, Keyboard Focus & Missing ARIA
- **Priority:** `High` (`Verified`)
- **File Path:** [app/globals.css](../../app/globals.css#L50), [components/ui/button.tsx](../../components/ui/button.tsx#L31-L32), [components/auth/username-modal.tsx](../../components/auth/username-modal.tsx#L116-L195), [components/navbar.tsx](../../components/navbar.tsx#L373-L379), [components/typing/typing-container.tsx](../../components/typing/typing-container.tsx#L126-L134,L308-L337), [components/home/hero-3d.tsx](../../components/home/hero-3d.tsx#L263-L404)
- **Relevant Component / Function:** Primary button styling, `UsernameModal`, `Navbar` mobile button, `TypingContainer`, `Hero3D`
- **Evidence:**
  1. **Color Contrast:** `--accent` (`#FF5C00`) with `#FFFFFF` text (`Button` primary, `Dashboard`, `Profile`, `ReplayPlayer`) yields a contrast ratio of **~3.10:1** — failing WCAG 2.1 AA (`4.5:1` for normal/small text like `text-xs` and `text-sm`). Meanwhile `ToastContainer`, `Hero3D`, and `CatCompanion` use dark text (`#000000` / `#0F0F10`) on `#FF5C00` (~6.78:1) inconsistently.
  2. **Micro-Typography & All-Caps Fatigue:** Extensive `text-[7px]`, `text-[8px]`, `text-[9px]`, and `text-[10px]` paired with `font-black uppercase tracking-widest` across `CatCompanion`, `Dashboard`, `Hero3D`, `ResultScreen`, and `PerformanceLab`, plus low-contrast `lowercase` subheading in `Hero3D` (`line 443`).
  3. **Missing Modal & Menu Semantics:** `UsernameModal` lacks `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus trap, and initial autofocus; `Navbar` hamburger button (`line 373`) omits `aria-expanded={mobileMenuOpen}` and `aria-controls`; clickable typing viewport (`TypingContainer:308`) captures focus via non-interactive `<div>` while global `keydown` (`line 127`) intercepts `Space`/letter keys even when focused on buttons/links.
  4. **Reduced Motion Ignored in JS Loops:** `Hero3D` ignores `prefersReducedMotion` for continuous 45ms orbital bob, 250ms key vibration/floating trails, and 40ms rainbow cycling; `ResultScreen` ignores `prefersReducedMotion` on 3s confetti; `ChallengePage:183` spins `<Sparkles className="animate-spin" />` continuously on win.
- **Impact:** Primary CTAs fail AA contrast for low-vision readers, keyboard-only navigation is trapped/hijacked on `/typing`, screen readers receive incomplete state for modals/menus, and motion-sensitive users experience persistent animation.
- **Recommended Solution:** Standardize primary `#FF5C00` buttons on high-contrast dark foreground text (`#0F0F10` / `#111111`) or darken accent (`>= 4.5:1` with white), enforce a `12px` minimum body/label scale, add full ARIA dialog & `aria-expanded` attributes, exempt interactive focus targets from global keystroke capture, and guard all JS animation loops with `prefers-reduced-motion`.

### UX-07 — Mobile Overflow, Cramped Hero3D Keyboard & Desktop-First Tables
- **Priority:** `Medium` (`Verified`)
- **File Path:** [components/home/hero-3d.tsx](../../components/home/hero-3d.tsx#L186-L190,L553-L576), [app/dashboard/page.tsx](../../app/dashboard/page.tsx#L675-L734), [components/typing/typing-container.tsx](../../components/typing/typing-container.tsx#L240-L281)
- **Relevant Component / Function:** `Hero3D` keycap grid & `HUDPanel`, `Dashboard` history table, `TypingContainer` mode/duration selector
- **Evidence:**
  1. `Hero3D` sizes rows via `width: (k.unitWidth / 15) * 100%` alongside `gap-[3.5px]` (`55px` extra width per 15-key row) and `flex-shrink-0` inside a padded chassis, plus `HUDPanel` negative offsets (`left-[-40px]`, `left-[-50px]`, `right-[-40px]`, `right-[-50px]`) which overlap the keyboard or clip under `overflow-hidden` on narrow/tablet viewports. Keycap labels render down to `6px` (`text-[6px]`).
  2. `TypingContainer` renders 5 mode buttons (`words`, `quotes`, `numbers`, `punctuation`, `code`) in one horizontal row without wrap (`line 240`), causing horizontal overflow/cramping on `< 400px` mobile screens.
  3. `Dashboard` renders a 9-column desktop table on mobile with a flashing `"← swipe table to see details →"` notice (`line 675`) instead of clean mobile summary cards.
- **Impact:** Visual clipping and horizontal crowding on phones/narrow viewports, hurting first impressions on the landing page and usability on `/typing` and `/dashboard`.
- **Recommended Solution:** Calculate flex widths subtracting gaps (or CSS Grid `repeat(60, minmax(0, 1fr))` in quarter-u columns), stack/hide floating `HUDPanel`s cleanly below `md`, allow `flex-wrap` on mode pills, and render a concise card/3-column list for mobile run history.

### UX-08 — Duplicate Result Labels, Empty-State Copy & Confusing Navigation Hierarchy
- **Priority:** `Medium` (`Verified`)
- **File Path:** [components/typing/result-screen.tsx](../../components/typing/result-screen.tsx#L256-L270), [app/dashboard/page.tsx](../../app/dashboard/page.tsx#L563-L610), [components/navbar.tsx](../../components/navbar.tsx#L249-L254,L329-L355), [app/profile/page.tsx](../../app/profile/page.tsx#L128-L134)
- **Relevant Component / Function:** `ResultScreen` summary rows, `Dashboard`, `Navbar`, `ProfileSettingsPage`
- **Evidence:**
  - `ResultScreen` displays two separate summary rows — `"Errors (uncorrected)"` (`line 257`) and `"Mistakes registered"` (`line 265`) — bound to the exact same value (`result.errorCount`), while `"Characters typed"` (`line 262`) displays `userInput.length` (post-backspace length rather than total keystrokes).
  - `Dashboard` repeats the exact same runs in `"Recent Runs"` (last 5) and `"Complete History Log"` directly beneath it without distinct drilldown or replay access.
  - Signed-in users see `Practice`, `Leaderboards`, `Dashboard`, `Performance Lab`, and `{username} -> /dashboard` in `Navbar`, with **no route to `/profile` (Settings)** or `/u/{username}` (Public Profile), while `ProfileSettingsPage` uses raw `<a href="/typing">` labeled `"Save & Start Typing"` even though preferences auto-save on click.
- **Impact:** Redundant metrics confuse serious typists analyzing mistakes, signed-in users cannot discover settings or share their own public profile URL cleanly, and navigation duplicates `/dashboard`.
- **Recommended Solution:** Consolidate `Errors` into `Uncorrected Errors` + `Corrected Errors / Total Mistakes`, link signed-in users cleanly to both `/dashboard`, `/u/[username]`, and `/profile` via a clean user dropdown/menu, and rename `ProfileSettingsPage` button to `<Button href="/typing">Back to Practice</Button>`.

