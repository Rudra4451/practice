# TyProX: End-to-End System Architecture, UI/UX Engine & Technical Specification (A-Z Blueprint)

> **Document Version**: `1.0.0 (Production Blueprint)`  
> **Target Framework**: `Next.js 16.2.9 (App Router) / React 19.2.4 / TypeScript 5 / TailwindCSS v4 / Supabase`  
> **PDF File**: [TyProX_Full_Architecture_and_System_Blueprint.pdf](file:///c:/Users/rudra/practice/TyProX_Full_Architecture_and_System_Blueprint.pdf)

---

## Table of Contents
1. [Executive Overview & Product Vision](#1-executive-overview--product-vision)
2. [System Architecture Blueprint & Technology Stack](#2-system-architecture-blueprint--technology-stack)
3. [UI / UX Architecture & Design Tokens](#3-ui--ux-architecture--design-tokens)
4. [State Management & Decoupled Web Worker Telemetry](#4-state-management--decoupled-web-worker-telemetry)
5. [Database Architecture & Full PostgreSQL Schema](#5-database-architecture--full-postgresql-schema)
6. [API Specifications & Server Security Matrix](#6-api-specifications--server-security-matrix)
7. [Anti-Cheat Mechanics & Mathematical Formulas](#7-anti-cheat-mechanics--mathematical-formulas)
8. [Virtual Cat Companion Ecosystem](#8-virtual-cat-companion-ecosystem)
9. [Deployment, Performance & Security Audit](#9-deployment-performance--security-audit)

---

## 1. Executive Overview & Product Vision

**TyProX** is a next-generation, high-frequency analytical typing platform designed to deliver zero-latency input capture, microsecond-accurate keystroke telemetry, micro-animation feedback loops, and competitive gamified engagement.

### Core Architectural Philosophy
- **Zero-Input Latency**: User typing input is captured using a transparent focus-trap `<textarea>` that bypasses heavy React re-renders during active keystrokes, decoupling the DOM input layer from analytical processing.
- **Off-Thread Analytics**: Keystroke calculations (WPM, Raw WPM, Accuracy, Relative Standard Deviation / Consistency, and key/bigram bottleneck analysis) run asynchronously in a dedicated Web Worker ([analytics.worker.ts](file:///c:/Users/rudra/practice/workers/analytics.worker.ts)).
- **Rich Gamified Retention**: Integrated virtual cat companions ([cat-companion.tsx](file:///c:/Users/rudra/practice/components/typing/cat-companion.tsx)), rank tier progression (Grandmaster to Bronze), daily active streak tracking, and unlockable achievement badges.
- **Robust Anti-Cheat Infrastructure**: Server-side mathematical validation detects mechanical autotypers via millisecond standard deviation analysis (`stdDev < 1.5ms`).

---

## 2. System Architecture Blueprint & Technology Stack

```mermaid
graph TD
    ClientUI["React 19 / Next.js 16 UI Layer"] -->|Dispatches Keystrokes| WebWorker["analytics.worker.ts (Background Worker)"]
    WebWorker -->|TICK (O(1) WPM/Acc)| ClientUI
    WebWorker -->|FINALIZE (Timeline + RSD)| ClientUI
    ClientUI -->|POST /api/results| ServerAPI["Next.js Server API Route"]
    ServerAPI -->|Zod Validation + Anti-Cheat| SecurityEngine["Timing Standard Deviation Check"]
    SecurityEngine -->|Valid Run| SupabaseDB[("Supabase PostgreSQL Database")]
    SupabaseDB -->|Realtime Subscriptions| LeaderboardUI["Leaderboard Page (Postgres Change Listener)"]
```

### Technology Stack Summary Table

| Component | Library / Framework | Version | Technical Purpose & Role |
| :--- | :--- | :--- | :--- |
| **Framework** | Next.js (App Router) | `16.2.9` | Server Components, API routes, SSR, SEO metadata |
| **UI Library** | React | `19.2.4` | Concurrent UI rendering, hooks, custom refs |
| **Language** | TypeScript | `5.x` | End-to-end type safety & schema interfaces |
| **Styling Engine** | TailwindCSS + CSS Variables | `v4.0` | Design token system, glassmorphism utilities, dark mode |
| **State Management**| Zustand + Persistence | `5.0.14` | Client-side reactive state & local storage persistence |
| **Background Math** | Web Worker API | Native | Off-thread keystroke math, WPM/RSD timeline generation |
| **Database & Auth** | Supabase (PostgreSQL + SSR) | `^2.108.2` | Row Level Security (RLS), OAuth, triggers, realtime |
| **Visualizations** | Recharts + Framer Motion | `^3.8.1` | Second-by-second performance timeline & animations |

---

## 3. UI / UX Architecture & Design Tokens

### Design System Tokens (`app/globals.css`)
TyProX uses standard HSL-tailored design tokens supporting seamless Dark and Light theme switching:

- **Primary Colors**: Dark Surface (`#171717`), Accent Orange (`#FF5C00`), Error Red (`#E03E3E`), Success Green (`#2ECC71`).
- **Typography Scale**:
  - `Space Grotesk`: Modern Display typography (`.font-display`).
  - `JetBrains Mono`: Monospaced typing viewport (`.typing-font`).
  - `Inter`: Standard body text (`var(--font-sans)`).
- **Glassmorphism System**: Custom CSS utilities `.glass` (`backdrop-filter: blur(16px); background: var(--surface-glass);`) and `.glass-subtle`.
- **Dynamic Ambient Glow**: The typing engine dynamically scales a blurred background glow (`filter: blur(140px)`) proportional to the user's live WPM score.

### Key UI Components Map

#### 1. Typing Engine Container ([typing-container.tsx](file:///c:/Users/rudra/practice/components/typing/typing-container.tsx))
- Controls test initialization, active test state, global hotkeys (`Esc` to restart, `Tab` focus blocking, printable key auto-focusing).
- Displays live statistics cards with backdrop blur: Remaining Time, WPM, Accuracy %, Active Streak.

#### 2. Text Rendering Viewport ([text-display.tsx](file:///c:/Users/rudra/practice/components/typing/text-display.tsx))
- Renders text broken into tokenized words and individual character `<span>` elements with active line auto-scrolling (`scrollTop` calculation).
- Renders animated vertical cursor caret with glowing accent shadow (`shadow-[0_0_8px_var(--accent)]`).

#### 3. Keystroke Replay Player ([replay-player.tsx](file:///c:/Users/rudra/practice/components/typing/replay-player.tsx))
- Reproduces test runs frame-by-frame via `requestAnimationFrame`.
- Supports progress scrubbing slider and variable playback speeds (`1x`, `1.5x`, `2x`, `4x`).

#### 4. Global Leaderboard ([app/leaderboard/page.tsx](file:///c:/Users/rudra/practice/app/leaderboard/page.tsx))
- Categorizes users into competitive Rank Tiers:
  - **Grandmaster**: `≥ 140 WPM`
  - **Master**: `≥ 120 WPM`
  - **Diamond**: `≥ 100 WPM`
  - **Platinum**: `≥ 80 WPM`
  - **Gold**: `≥ 60 WPM`
  - **Silver**: `≥ 40 WPM`
  - **Bronze**: `< 40 WPM`

---

## 4. State Management & Decoupled Web Worker Telemetry

```
[Typing Viewport] ---> (KeyDown Event) ---> handleInput() in useTypingStore
                                                |
                                    Worker.postMessage({ KEYSTROKE })
                                                |
                                      [analytics.worker.ts]
                                      ├── O(1) correctMap update
                                      └── postMessage({ TICK: wpm, accuracy })
                                                |
                                    [Zustand State Update]
```

### Zustand Stores Overview
1. **`useTypingStore`** ([typing-store.ts](file:///c:/Users/rudra/practice/stores/typing-store.ts)): Manages configuration (`duration`, `mode`, `seed`), live status (`'idle' | 'running' | 'completed' | 'paused'`), real-time stats (`wpm`, `accuracy`, `combo`, `maxCombo`), and final test results.
2. **`useUserStore`** ([user-store.ts](file:///c:/Users/rudra/practice/stores/user-store.ts)): Persists session auth, user profiles, preferences (theme, font), and up to 100 guest test runs locally.
3. **`useToastStore`** ([toast-store.ts](file:///c:/Users/rudra/practice/stores/toast-store.ts)): Manages toast alert popups.

### Web Worker Engine ([analytics.worker.ts](file:///c:/Users/rudra/practice/workers/analytics.worker.ts))
- Keeps an $O(1)$ running position map (`correctMap = new Map<number, boolean>()`) to calculate live WPM and accuracy without scanning arrays.
- On `FINALIZE`:
  - **RSD Consistency**: Computes relative standard deviation across inter-keystroke intervals.
  - **Timeline Building**: Generates second-by-second WPM snapshots for Recharts.
  - **Performance Lab Metrics**: Identifies top error keys, key speed averages, and two-letter bigram transition speeds.

---

## 5. Database Architecture & Full PostgreSQL Schema

### Entity-Relationship Architecture

```
[auth.users] (Supabase Auth)
     │
     └── ON DELETE CASCADE ──► [public.profiles]
                                    │
                                    ├── ON DELETE CASCADE ──► [public.test_results] ◄── ON DELETE CASCADE ── [public.replays]
                                    ├── ON DELETE CASCADE ──► [public.streaks]
                                    ├── ON DELETE CASCADE ──► [public.user_achievements]
                                    └── ON DELETE SET NULL  ──► [public.challenge_links]
```

### Full SQL Schema ([FULL_SCHEMA.sql](file:///c:/Users/rudra/practice/supabase/migrations/FULL_SCHEMA.sql))

```sql
-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(30) UNIQUE NOT NULL,
    display_name VARCHAR(50),
    avatar_url TEXT,
    theme VARCHAR(50) DEFAULT 'dark' NOT NULL,
    font_family VARCHAR(50) DEFAULT 'ibm-plex-mono' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT username_min_length CHECK (char_length(username) >= 3)
);

-- 2. TEST RESULTS TABLE
CREATE TABLE IF NOT EXISTS public.test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    wpm REAL NOT NULL,
    raw_wpm REAL NOT NULL,
    accuracy REAL NOT NULL,
    consistency REAL NOT NULL,
    error_count INTEGER NOT NULL,
    backspace_count INTEGER NOT NULL,
    mode VARCHAR(20) NOT NULL,
    duration INTEGER NOT NULL,
    seed VARCHAR(64) NOT NULL,
    is_invalidated BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. REPLAYS TABLE (Telemetry payload)
CREATE TABLE IF NOT EXISTS public.replays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_result_id UUID UNIQUE NOT NULL REFERENCES public.test_results(id) ON DELETE CASCADE,
    telemetry JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. STREAKS TABLE
CREATE TABLE IF NOT EXISTS public.streaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    current_streak INTEGER DEFAULT 0 NOT NULL,
    longest_streak INTEGER DEFAULT 0 NOT NULL,
    last_active_date DATE DEFAULT CURRENT_DATE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. LEADERBOARD VIEW
CREATE OR REPLACE VIEW public.leaderboard_view AS
SELECT DISTINCT ON (user_id, mode, duration)
  id, user_id, wpm, accuracy, consistency, mode, duration, is_invalidated, created_at
FROM public.test_results
WHERE is_invalidated = false
ORDER BY user_id, mode, duration, wpm DESC;
```

---

## 6. API Specifications & Server Security Matrix

### `POST /api/results` Endpoint Breakdown ([route.ts](file:///c:/Users/rudra/practice/app/api/results/route.ts))

- **Payload Validation**: Validates schema via Zod (`submitResultSchema`).
- **Anti-Cheat Verification**:
  - Validates telemetry array monotonic time ordering (`item.t >= lastTime`).
  - Calculates inter-keystroke interval standard deviation. If `stdDev < 1.5ms`, the system flags mechanical scripting and returns `400 Bad Request`.
- **Daily Streak Update Logic**:
  $$\Delta \text{Days} = \text{Date}(\text{today}) - \text{Date}(\text{last\_active\_date})$$
  - If $\Delta \text{Days} == 1 \implies \text{current\_streak} = \text{current\_streak} + 1$
  - If $\Delta \text{Days} > 1 \implies \text{current\_streak} = 1$
- **Achievement Unlock Engine**: Automatically checks user achievements against predefined thresholds (e.g. `SPEED_50`, `SPEED_100`, `STREAK_7`).

---

## 7. Anti-Cheat Mechanics & Mathematical Formulas

### Core Metrics Mathematical Definitions

1. **Net Words Per Minute (WPM)**:
   $$\text{WPM} = \frac{\text{Correct Characters} / 5}{\text{Duration in Minutes}}$$

2. **Raw Words Per Minute (Raw WPM)**:
   $$\text{Raw WPM} = \frac{\text{Total Inputs Occupied} / 5}{\text{Duration in Minutes}}$$

3. **Accuracy Percentage**:
   $$\text{Accuracy (\%)} = \left( \frac{\text{Correct Characters}}{\text{Total Inputs Occupied}} \right) \times 100$$

4. **Consistency Score (Relative Standard Deviation / RSD)**:
   Given inter-keystroke intervals $\Delta t_i = t_i - t_{i-1}$:
   $$\mu = \frac{1}{N} \sum_{i=1}^N \Delta t_i, \quad \sigma^2 = \frac{1}{N} \sum_{i=1}^N (\Delta t_i - \mu)^2$$
   $$\text{RSD} = \frac{\sigma}{\mu}$$
   $$\text{Consistency} = \max\left(0, \min\left(100, \text{Math.round}\left(100 \times (1 - \text{RSD})\right)\right)\right)$$

5. **Deterministic Seed PRNG Generation**:
   Deterministic pseudo-random text generation utilizes string hash `cyrb128` mapped to 32-bit generator `mulberry32`:
   $$\text{cyrb128}(\text{seed}) \longrightarrow \text{mulberry32}(a) \longrightarrow \text{Deterministic Word Selection}$$

---

## 8. Virtual Cat Companion Ecosystem

The **Cat Companion Engine** ([cat-companion.tsx](file:///c:/Users/rudra/practice/components/typing/cat-companion.tsx)) provides 12 collectible animated cat companions:

```
┌─────────────────────────────────────────────────────────────┐
│                       Silly Cheddar                         │
│                    Color: #FF9F43 (Orange)                  │
│  Dialogue (100% Acc): "100%? That deserves a tuna slice!"   │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                        Void Shadow                          │
│                    Color: #1E1E24 (Dark)                    │
│  Dialogue (120+ WPM): "Flawless. A glitch in the matrix."   │
└─────────────────────────────────────────────────────────────┘
```

| Cat ID | Name | Color / Accent | Specialty & Dialogue Trait |
| :--- | :--- | :--- | :--- |
| `orange` | Silly Cheddar | `#FF9F43` / `#FF5C00` | Playful food quotes & tuna slice rewards |
| `void` | Void Shadow | `#1E1E24` / `#7F8C8D` | Calm sarcasm & dark aura quotes |
| `white` | Kind Marshmallow | `#F5F6FA` / `#9C88FF` | Warm encouragement & sweet smiles |
| `grey` | Coach Sergeant | `#7F8C8D` / `#2C3E50` | Performance discipline & drill quotes |
| `cyber` | Cyber Punk | `#00F2FE` / `#4FACFE` | Tech overclocks & clean sync praise |
| `golden` | Golden Emperor | `#FFD700` / `#FFA500` | Grandmaster victory crowns & royal aura |

---

## 9. Deployment, Performance & Security Audit

- **Production Build**: Verified using `next build` with dynamic imports (`dynamic(() => import(...), { ssr: false })`) for heavy Recharts modules to minimize initial bundle size.
- **Search Engine Optimization (SEO)**: Includes dynamic OpenGraph metadata, XML sitemap generation ([sitemap.ts](file:///c:/Users/rudra/practice/app/sitemap.ts)), and crawler instructions ([robots.ts](file:///c:/Users/rudra/practice/app/robots.ts)).
- **PDF Export Generated**: The full PDF document has been compiled and saved to [TyProX_Full_Architecture_and_System_Blueprint.pdf](file:///c:/Users/rudra/practice/TyProX_Full_Architecture_and_System_Blueprint.pdf).

---
*End of Specification Document — TyProX System Architecture Blueprint.*
