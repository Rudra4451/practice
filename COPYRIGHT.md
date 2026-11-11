# Copyright & Ownership Notice

> [!IMPORTANT]
> **Owner-Approval Gate:** Confirm and replace `[Copyright Owner]` below with the verified legal owner name or entity (Git history author: `Rudra Pratap Swain`; GitHub repository owner: [`Rudra4451`](https://github.com/Rudra4451)) before publishing final proprietary terms. This notice is not legal advice.

```text
Copyright © 2026 [Copyright Owner]. All rights reserved.

The TyProX source code, original designs, branding, documentation, and original
project assets are proprietary unless otherwise stated.

No permission is granted to reproduce, redistribute, commercially exploit, or
create derivative works from these materials without prior written permission
from the copyright owner, subject to applicable law and third-party licences.
```

---

## 1. Repository Licensing & Visibility Status

- **Repository URL:** `https://github.com/Rudra4451/practice`
- **GitHub Visibility (Verified):** `PUBLIC` (`isPrivate: false`)
- **Open-Source License:** **None (`licenseInfo: null`)** — intentionally no MIT, Apache-2.0, GPL, BSD, or other permissive/copyleft grant is present.
- **Legal Effect of an Absent License:** Under default copyright law, the absence of an open-source license means **all rights remain reserved** by the copyright owner. No permission is granted to copy, modify, redistribute, sell, or publish derivative works, subject only to statutory exceptions under applicable law and GitHub's Terms of Service (which allow GitHub users to view and fork public repositories).
- **Important Technical Limitation (Public vs. Private Visibility):** Making a GitHub repository `PUBLIC` means anyone on the internet can view and `git clone` the tracked source code regardless of copyright notices, disclaimers, or client-side obfuscation. **If keeping the source code confidential is a priority, change the repository visibility to `PRIVATE`** in GitHub repository settings (this change requires explicit owner approval and was intentionally not modified autonomously).

---

## 2. Third-Party Code, Packages, Icons & Fonts

The copyright claim above covers **only** original TyProX source code, UI compositions, original showcase video/poster visual scenes ([`docs/media/typrox-launch.jpg`](./docs/media/typrox-launch.jpg) and visual UI scenes in [`docs/media/typrox-launch.mp4`](./docs/media/typrox-launch.mp4)), custom SVG badges (`public/achievements/*.svg`), database migrations/harness scripts, and project documentation authored for this repository. TyProX incorporates third-party open-source packages, icons, fonts, and showcase audio tracks whose respective licenses apply and remain intact.

### 2.1 Direct Runtime Dependencies (`package.json`)

| Package | Version Range | License | Role in TyProX |
|---|---|---|---|
| `next` | `^16.4.6` | MIT | Next.js App Router framework, server routes & proxy middleware |
| `react` | `19.2.4` | MIT | React UI runtime |
| `react-dom` | `19.2.4` | MIT | React DOM renderer |
| `@supabase/supabase-js` | `^2.108.2` | MIT | Supabase client & server API SDK |
| `@supabase/ssr` | `^0.12.0` | MIT | Cookie-based SSR & proxy session management |
| `zustand` | `^5.0.14` | MIT | Client typing, user preference & toast stores |
| `zod` | `^4.4.3` | MIT | Runtime payload and parameter schema validation |
| `framer-motion` | `^12.40.0` | MIT | Motion animations and UI transitions |
| `recharts` | `^3.8.1` | MIT | Result WPM/raw-WPM timeline and dashboard charts |
| `lucide-react` | `^1.20.0` | ISC | UI vector icon components |
| `canvas-confetti` | `^1.9.4` | ISC | Milestone / personal-best visual celebration effect |
| `server-only` | `^0.0.1` | MIT | Build-time guard preventing server module import in client bundles |

### 2.2 Direct Development & Testing Dependencies (`package.json`)

| Package | Version Range | License | Role |
|---|---|---|---|
| `typescript` | `^5` | Apache-2.0 | Static TypeScript compiler |
| `@playwright/test` | `^1.65.0` | Apache-2.0 | End-to-end Chromium browser verification |
| `vitest` | `^5.1.0` | MIT | Unit, component & route handler test runner |
| `@vitejs/plugin-react` | `^6.3.0` | MIT | React transform plugin for Vitest |
| `@testing-library/react` | `^16.3.3` | MIT | React component test utilities |
| `@testing-library/dom` | `^10.4.2` | MIT | DOM query peer dependency for Testing Library |
| `jsdom` | `^31.0.0` | MIT | Simulated browser DOM environment for Vitest |
| `eslint` | `^9` | MIT | Linter engine |
| `eslint-config-next` | `^16.4.6` | MIT | Next.js Core Web Vitals & TypeScript ESLint rules |
| `tailwindcss` | `^4` | MIT | CSS utility compiler |
| `@tailwindcss/postcss` | `^4` | MIT | Tailwind v4 PostCSS plugin |
| `@types/node` | `^24.19.2` | MIT | Node.js type definitions |
| `@types/react` | `^19` | MIT | React type definitions |
| `@types/react-dom` | `^19` | MIT | React DOM type definitions |
| `@types/canvas-confetti` | `^1.9.0` | MIT | Type definitions for `canvas-confetti` |

### 2.3 Notable Transitive Packages (`package-lock.json`)

While the vast majority of transitive packages are licensed under MIT, ISC, Apache-2.0, BSD-2-Clause, BSD-3-Clause, 0BSD, or Unlicense, lockfile inspection confirms the following additional licenses in the dependency graph:

- **`@img/sharp-libvips-*`** *(optional runtime dependency of `next` image optimization)*: **`LGPL-3.0-or-later`** (and `Apache-2.0 AND LGPL-3.0-or-later` / `Apache-2.0 AND LGPL-3.0-or-later AND MIT` on `@img/sharp-{win32,wasm32}*`). Note that standard dynamic/optional use under Next.js respects their upstream license terms; consult legal counsel if distributing compiled native `sharp` binaries offline.
- **`caniuse-lite`** *(runtime CSS/browser data)*: **`CC-BY-4.0`**.
- **`lightningcss` / `lightningcss-*`** *(dev/build Tailwind CSS v4 dependency)* & **`axe-core`** *(dev test dependency)*: **`MPL-2.0`**.
- **Other dev-only transitive licenses:** `BlueOak-1.0.0` (`minimatch` under `@typescript-eslint/typescript-estree`, `lru-cache` under `jsdom`), `Python-2.0` (`argparse`), and `CC0-1.0` (`language-subtag-registry`).

### 2.4 Fonts (`next/font/google`)

Typography loaded in [`app/layout.tsx`](./app/layout.tsx) via `next/font/google` uses open font families (`Inter`, `Space Grotesk`, `JetBrains Mono`, `IBM Plex Mono`, and `Geist Mono`), served under their respective upstream open font licenses (such as SIL Open Font License 1.1). No ownership is claimed over those typefaces.

### 2.5 Showcase Video Audio & Embedded Typefaces (`docs/media/`)

The product showcase media ([`docs/media/typrox-launch.mp4`](./docs/media/typrox-launch.mp4) and [`docs/media/typrox-launch.jpg`](./docs/media/typrox-launch.jpg)) uses the following third-party audio and font assets alongside original TyProX UI visuals (none of these third-party tracks or fonts are claimed as proprietary):

- **Background Music:** *"Happy Beats / Business Moves Vol. 12"* by **Sascha Ende** (`ende.app`), licensed under **CC BY 4.0** (`https://ende.app/en/standard-license`) — required attribution: **`Music: Sascha Ende, ende.app (CC BY 4.0)`**.
- **Sound Effects (SFX):** UI, impact, and card transition SFX from **Kenney.nl**, and typing keystroke SFX from *Keyboard Soundpack #1* (`unicae_games`), licensed under **CC0 1.0** (Public Domain Dedication).
- **Embedded Video Typefaces:** `Space Grotesk`, `Inter`, and `JetBrains Mono` rendered in the video frames are licensed under the **SIL Open Font License 1.1**.

