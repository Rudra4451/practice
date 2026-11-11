# TyProX Technical Implementation Plan (Phase 2 & Phase 3)

**Document Status:** Planning Only (No code edits, dependency installations, or migrations executed)  
**Scope:** Phase 2 (Typing Engine Reliability) and Phase 3 (Engineering Quality, Performance, Architecture & Repo Hygiene)  
**Prerequisite Gate:** Phase 1 score verification, demo bypass removal, and security infrastructure must precede competitive exposure; Phase 2 engine reliability must precede Phase 5 analytics and curriculum expansion.  
**Primary Audit Sources:** [PROJECT_AUDIT.md](../../docs/audit/PROJECT_AUDIT.md), [FEATURE_INVENTORY.md](../../docs/audit/FEATURE_INVENTORY.md), [TECHNICAL_DEBT.md](../../docs/audit/TECHNICAL_DEBT.md)

---

## PART A: PHASE 2 — TYPING ENGINE RELIABILITY

### ENG-2.1: Unified Mathematical Definitions & Isomorphic Engine Module
- **Audit Reference:** `PA-01`, `PA-02`, `PA-04`, `SEC-01`
- **Problem:**
  1. [workers/analytics.worker.ts](../../workers/analytics.worker.ts#L100-L108) computes `totalElapsedMs = lastKeystrokeTime - startTime` and `elapsedMins = Math.max(0.001, totalElapsedMs / 60000)`. Typing 1 character at `t = 0` and idling until a 60s countdown finishes awards `200 WPM` (`0.2 / 0.001`), while submitting `duration: 60` from Zustand (`ResultScreen`).
  2. Backspacing errors calls `correctMap.delete(event.index)` (`line 59`), wiping corrected mistakes from both `rawInputs` and accuracy calculations. Typists who backspace 40 errors finish with misleading `100%` accuracy and artificially low `rawWpm`.
  3. Consistency uses unclipped inter-keystroke intervals of correct keys (`consistency = round(100 * (1 - stdDev / mean))`); a single 2s pause drives consistency straight to `0%`.
  4. `getRunningCounts()` loops over `correctMap` (`O(N)` per keystroke), and `FINALIZE` loops `s = 1..totalElapsedSecs` replaying all keystrokes from index `0` (`O(S * N)`).
- **Root Cause:** Engine math lives exclusively inside a worker message switch with mutable map scans, absent shared pure functions, missing cumulative keystroke counters, and naive timestamp subtraction.
- **Proposed Solution & Mathematical Specifications:**
  Create pure, dependency-free TypeScript module [lib/typing/metrics.ts](../../lib/typing/metrics.ts) consumed equally by `workers/analytics.worker.ts`, server `lib/typing/verifier.ts`, and Vitest:

  1. **Elapsed Time ($T_{\text{ms}}$ and $T_{\text{min}}$):**
     Let $t_0$ be timestamp of the first input event, $t_{\text{end}}$ be the completion timestamp, $\Delta_{\text{limit}} = \text{durationLimit} \times 1000$, and $r_{\text{reason}} \in \{\text{'timer'}, \text{'text\_complete'}\}$:
     $$T_{\text{ms}} = \begin{cases} \Delta_{\text{limit}} & \text{if } r_{\text{reason}} = \text{'timer'} \\ \max(1000,\; t_{\text{end}} - t_0) & \text{if } r_{\text{reason}} = \text{'text\_complete'} \end{cases}$$
     $$T_{\text{secs}} = \max(1,\; \text{round}(T_{\text{ms}} / 1000)), \qquad T_{\text{min}} = \frac{T_{\text{ms}}}{60000}$$
     *During live `TICK` snapshots:* $T_{\text{live,ms}} = \max(500,\; t_{\text{now}} - t_0)$ (note: clamping minimum `500ms` instead of `100ms` prevents initial first-keystroke `600 WPM` jitter flash).

  2. **Cumulative Counters (O(1) per keystroke):**
     Track on every `KEYSTROKE` event:
     - $K_{\text{total}}$ (`totalInputKeystrokes`): incremented on every `type === 'input'`. Never decremented on `delete`.
     - $K_{\text{correct}}$ (`correctInputKeystrokes`): incremented on `type === 'input'` when `key === expectedKey`. Never decremented on `delete`.
     - $C_{\text{buffer}}$ (`correctBufferChars`): maintained incrementally in $O(1)$ on `correctMap.set(idx, match)` / `.delete(idx)`.
     - $E_{\text{uncorrected}}$ (`uncorrectedErrors`): positions currently occupied (`correctMap.get(idx) === false`), updated in $O(1)$.
     - $E_{\text{corrected}}$ (`correctedErrors`): $(K_{\text{total}} - K_{\text{correct}}) - \text{countOfEverIncorrectRemaining}$ or simpler direct counter: track total erroneous inputs $E_{\text{total}} = K_{\text{total}} - K_{\text{correct}}$ alongside $B_{\text{count}}$ (`backspaceCount`).

  3. **Net WPM, Raw (Gross) WPM & Accuracy:**
     $$\text{Net WPM} = \max\left(0,\; \text{round}\left(\frac{C_{\text{buffer}} / 5}{T_{\text{min}}}\right)\right)$$
     $$\text{Raw WPM} = \max\left(0,\; \text{round}\left(\frac{K_{\text{total}} / 5}{T_{\text{min}}}\right)\right)$$
     $$\text{Accuracy (\%)} = \begin{cases} 100 & \text{if } K_{\text{total}} = 0 \\ \text{round\_to\_1dp}\left(\frac{K_{\text{correct}}}{K_{\text{total}}} \times 100\right) & \text{otherwise} \end{cases}$$
     *Why this preserves user clarity while fixing the exploit:* Standard 5-char words divide cleanly by $5 \cdot T_{\text{min}}$. Any uncorrected character reduces $C_{\text{buffer}}$ (hence Net WPM), while corrected typos do **not** drop Net WPM twice—yet **do** preserve honest lower Accuracy and higher Raw WPM! Note: check existing DB types: `test_results.wpm`, `raw_wpm`, `accuracy`, `consistency` are Postgres `REAL` floats, so 1-decimal precision on accuracy (`98.4%`) stores cleanly without schema alteration.

  4. **Consistency (Outlier-Resistant Per-Second Rhythm):**
     Replace raw full-run inter-key interval RSD with **per-second active WPM variation** (with outlier pause capping at `2500ms` if `< 4` seconds elapsed):
     - Given timeline raw/net speeds per second $\{v_1, v_2, \dots, v_S\}$ for active typing seconds ($S \ge 3$):
       $$\mu_v = \frac{1}{S}\sum_{s=1}^S v_s, \qquad \sigma_v = \sqrt{\frac{1}{S}\sum_{s=1}^S (v_s - \mu_v)^2}$$
       $$\text{Consistency (\%)} = \text{clamp}_{0..100}\left(\text{round}\left(100 \times \left(1 - \frac{\sigma_v}{\mu_v}\right)\right)\right)$$
     - Why per-second speed variation works better: instantaneous micro-pauses inside a single second average within the 1-second speed bucket instead of blowing up single-interval RSD to `0%`.

  5. **Worked Numerical Test Cases (Mandated Reference Oracle):**
     - **Case A (1-Char 60s Exploit Attempt):** $durationLimit = 60$, `targetText` length $= 300$, single keystroke `'t'` matching `targetText[0]` at $t=0$, ended via timer (`r = 'timer'`). $T_{\text{ms}} = 60000$, $T_{\text{min}} = 1.0$, $C_{\text{buffer}} = 1$, $K_{\text{total}} = 1 \implies \text{Net WPM} = 0$, $\text{Raw WPM} = 0$, $\text{Accuracy} = 100\%$, $\text{duration} = 60$. (Replaces old buggy `200 WPM`).
     - **Case B (Backspaced Typos Accuracy Check):** $30\text{s}$ run ($T_{\text{min}} = 0.5$). User types 150 keystrokes (`K_total = 150`), of which 15 were wrong chars immediately corrected via 15 `Backspace`s (`K_correct = 135`, final clean buffer `C_buffer = 120` chars, `E_uncorrected = 0`).
       - $\text{Net WPM} = (120 / 5) / 0.5 = 48\text{ WPM}$
       - $\text{Raw WPM} = (150 / 5) / 0.5 = 60\text{ WPM}$
       - $\text{Accuracy} = (135 / 150) \times 100 = 90.0\%$
       - (Old engine erroneously reported Raw WPM `48` and Accuracy `100%`).
     - **Case C (Early Text Completion):** `quotes` mode with 180-char text, `durationLimit = 60`, user types last char cleanly (`cursor === 180`) at $t_{\text{end}} = 18000\text{ ms}$ ($0.3\text{ min}$), `C_buffer = 180`, `K_total = 180`.
       - $T_{\text{secs}} = 18\text{s}$, $\text{Net WPM} = (180 / 5) / 0.3 = 120\text{ WPM}$. Persisted DB `duration` = `18` (never fake `60s`).

  6. **Linear $O(N + S)$ Timeline & Analytics Sweep:**
     In `FINALIZE`, process `keystrokes` in a single forward pass advancing a running pointer `kIdx` across `s = 1..T_secs`, updating running counters incrementally (`O(N + S)` instead of `O(S * N)`).

- **Files/Components Affected:** `lib/typing/metrics.ts` (new), `workers/analytics.worker.ts`, `stores/typing-store.ts` (pass `completionReason` & `elapsedDurationMs` on `FINALIZE`), `components/typing/result-screen.tsx` (submit `result.duration` instead of config `duration`!).
- **Database Changes:** None required for columns (`REAL` supports `90.0`), though Phase 1 `verifier.ts` must import identical `lib/typing/metrics.ts`.
- **Security Implications:** Closes `lastKeystrokeTime` WPM inflation on both client and server simultaneously.
- **Dependencies:** Deployed atomically with `SEC-1.4` (`lib/typing/verifier.ts`) so client display matches server verification byte-for-byte.
- **Testing Requirements:** Exhaustive Vitest unit suite on `lib/typing/metrics.ts` testing Cases A, B, C plus zero-keystroke, all-errors, boundary `0`/`100` accuracy, and 2,500-keystroke 120s performance benchmark (`< 15ms`).
- **Acceptance Criteria:** Live worker metrics and server verifier return identical `wpm`, `rawWpm`, `accuracy`, `consistency`, `errorCount`, and `duration` on identical telemetry streams; 1-char idle 60s run computes `0 WPM`.
- **Priority:** `Critical`
- **Estimated Complexity:** `M`

---

### ENG-2.2: Drift-Free `performance.now()` Timer, Pause Policy & Worker Error Recovery
- **Audit Reference:** `PA-03`, `TD-05`
- **Problem:**
  1. `stores/typing-store.ts` decrements integer `timeLeft` inside `setInterval(..., 1000)`, causing wall-clock drift when browser tabs sleep or throttle JS timers.
  2. Dead `pauseTest` / `resumeTest` methods stop the interval without telling `analytics.worker.ts` (corrupting elapsed time if ever wired).
  3. `analytics.worker.ts` emits `{ type: 'ERROR' }` when finalizing 0 keystrokes, which `handleWorkerMessage` silently drops, leaving UI frozen in `'running'` state with `timeLeft: 0`.
- **Root Cause:** Naive tick counter instead of high-resolution timestamp deadline (`endAtMs`), half-implemented pause APIs, and missing `ERROR` branch in store message listener.
- **Proposed Solution:**
  1. Store `endAtMs` (`performance.now() + duration * 1000`) when transitioning `idle -> running`. Poll every `100ms` via `setInterval` and update store `timeLeft = Math.max(0, Math.ceil((endAtMs - performance.now()) / 1000))` only when integer second value changes. When `performance.now() >= endAtMs`, clear interval and send `{ type: 'FINALIZE', payload: { reason: 'timer', endTime: endAtMs } }`.
  2. **Pause Policy Decision:** Remove `pauseTest` and `resumeTest` from `useTypingStore` cleanly (zero UI callers exist, and pausing mid-test invalidates continuous WPM fairness on competitive leaderboards—users press `Esc` or Restart instead; re-visit only for future unranked lessons if explicitly needed).
  3. Handle `type === 'ERROR'` in `handleWorkerMessage`: cleanly reset test to `'idle'` (or surface non-blocking notice via `useToastStore`) rather than deadlocking the UI.
  4. Validate URL query params (`?mode`, `?duration`, `?seed`) via Zod in [app/typing/page.tsx](../../app/typing/page.tsx#L15-L38) before touching `useTypingStore`, eliminate duplicate `startTest()` double-run on mount when URL params are passed, and clear `challenge` seed when leaving `/challenge/[id]`.
- **Files/Components Affected:** `stores/typing-store.ts`, `app/typing/page.tsx`, `app/challenge/[id]/page.tsx`, `components/typing/typing-container.tsx`.
- **Database Changes:** None.
- **Security Implications:** Ensures wall-clock integrity on client matches timed boundaries expected by server anti-cheat.
- **Dependencies:** `ENG-2.1`.
- **Testing Requirements:** Vitest fake-timers test advancing system clock over throttle gaps (verifying `timeLeft` catches up accurately and triggers `FINALIZE` at `duration * 1000`); invalid `?duration=abc&mode=xyz` query param store hydration test.
- **Acceptance Criteria:** Tab backgrounding or 250ms timer jitter cannot extend a 15s test beyond wall-clock deadline; malformed `/typing` query params safely default without `NaN`; `0`-keystroke finalization never hangs UI.
- **Priority:** `High`
- **Estimated Complexity:** `M`

---

### ENG-2.3: Deterministic Text Generation Fixes (`quotes`, `code`, Capacity & Seed Entropy)
- **Audit Reference:** `PA-05` / Typing Engine 2.5, `TD-05`, `SEC-01`
- **Problem:**
  1. `quotes` picks 1 short quote (32–39 chars in `QUOTES`, finishing 120s quote tests in ~4 seconds while pretending duration was 120s).
  2. `code` joins snippets with **double spaces** (`items.join('  ')`), causing `TextDisplay.split(' ')` (`text-display.tsx:20`) to create empty word nodes and double spacing glitches.
  3. `wordCount` ceiling (`durationLimit * 3.5`, ~210 WPM) can run short if an elite typist hits burst >210 WPM on 15s runs.
  4. Seed generator `Math.random().toString(36).substring(7)` produces weak ~5–6 char entropy (can even return empty string `""` occasionally on round floats!).
- **Root Cause:** Unscaled single-quote lookup, accidental `'  '` delimiter typo in `text-generator.ts:109`, conservative word multiplier, and `Math.random` `.substring(7)`.
- **Proposed Solution:**
  1. Move `cyrb128`, `mulberry32`, `generateText`, and `createSeed()` into shared [lib/typing/text-generator.ts](../../lib/typing/text-generator.ts) (preserving `utils/text-generator.ts` as thin re-export if external refs remain).
  2. **`quotes` mode:** Concatenate shuffled non-repeating quotes joined by single `' '` until total character length reaches `Math.max(120, Math.ceil(durationLimit * 18))` (~216 WPM ceiling), **or** truncate cleanly on full quote boundary after target length. Expand [constants/dictionaries.ts](../../constants/dictionaries.ts) `QUOTES` safely with additional clean public-domain literary/typing passages if needed so 120s quote runs never repeat the same quote immediately.
  3. **`code` mode:** Fix `items.join('  ')` -> `items.join(' ')` and scale `snippetsCount` so total length exceeds `durationLimit * 15` chars. Ensure every code snippet contains single ASCII spaces and no embedded newlines `\n`.
  4. **`words` / `numbers` / `punctuation`:** Bump `wordCount = Math.max(65, Math.ceil(durationLimit * 4.8))` (~288 WPM safety capacity) and normalize multiple whitespace guards.
  5. **Cryptographic Seed Generation:** Replace `Math.random().toString(36).substring(7)` with `crypto.randomUUID().replace(/-/g, '').slice(0, 12)` (`createSeed()`), guaranteeing non-empty 12-hex-char deterministic seeds (`48` bits) usable server and client side.
- **Files/Components Affected:** `lib/typing/text-generator.ts` (new), `utils/text-generator.ts`, `constants/dictionaries.ts`, `stores/typing-store.ts`.
- **Database Changes:** Because changing `generateText` for `quotes` and `code` changes reconstructed text for historical seeds, record `generator_version = 2` (default `1` for existing historical rows) in `test_results` (added alongside `SEC-1.4` migration) so future replay viewers render both v1 historical replays and v2 replays accurately!
- **Security Implications:** Essential alignment between browser text generation and server `lib/typing/verifier.ts` text reconstruction (`SEC-1.4`).
- **Dependencies:** Must land in coordination with `SEC-1.4` server verifier.
- **Testing Requirements:** Vitest determinism tests verifying identical strings on repeated calls for every mode (`words`, `quotes`, `numbers`, `punctuation`, `code`) across `15, 30, 60, 120s`; zero double spaces `'  '`; `createSeed()` always matches `/^[a-f0-9]{12}$/`; minimum character coverage thresholds met per duration.
- **Acceptance Criteria:** No mode contains double consecutive spaces (`'  '`); 120s quote and code runs contain sufficient text for >180 WPM continuous typing; zero empty seeds possible.
- **Priority:** `High`
- **Estimated Complexity:** `S`

---

### ENG-2.4: Mobile Virtual Keyboard, IME Composition & Focus/Shortcut Isolation
- **Audit Reference:** `PA-08`, `UX-06`
- **Problem:**
  1. Controlled `<textarea value="">` slicing `e.target.value.slice(-1)` (`typing-container.tsx:91`) drops multi-character inputs from mobile swipe keyboards, autocorrect predictions, dead keys, and IME composition.
  2. Android virtual keyboards (e.g., Gboard) frequently emit `KeyboardEvent.key === 'Unidentified'` on `Backspace` over an empty `<textarea>`, making deletion impossible on Android phones.
  3. Global `window.addEventListener('keydown', handleGlobalKey)` (`line 116`) steals focus on `Space` or any printable key even when focus sits intentionally on a `<button>`, `<a href>`, `<select>`, or navigation link! Pressing `Enter` inserts `'\n'` instead of cleanly ignoring or submitting.
- **Root Cause:** Legacy desktop-only `<textarea value="">` key-slicing trick lacking `InputEvent.inputType`, CompositionEvent guards, and interactive element focus exclusions.
- **Proposed Solution:**
  1. Replace brittle `value=""` + `.slice(-1)` with **sentinel-character diffing + `beforeinput` / `composition` lifecycle** inside [components/typing/typing-container.tsx](../../components/typing/typing-container.tsx):
     - Keep an invisible sentinel value (e.g., `'\u200B'` or track `lastValueRef`) inside an uncontrolled/ref-managed `<textarea>` **or** handle `onBeforeInput` (`e.nativeEvent.inputType === 'deleteContentBackward'`) + fallback `onChange` diffing against sentinel `'\u200B'`:
       - If sentinel is deleted (`value === ''`) or `inputType === 'deleteContentBackward'`: fire `handleBackspace()` (even when Android emits `key === 'Unidentified'`!) and restore sentinel cleanly.
       - On `compositionstart`: mark `isComposingRef.current = true`; commit completed string character-by-character on `compositionend` (`for (const ch of data) handleInput(ch)`) before resetting textarea value to sentinel!
       - On regular multi-char swipe/autocorrect input (`!isComposingRef.current`): strip leading sentinel, normalize smart quotes/dashes if needed or iterate UTF-16 characters sequentially (`for (const ch of inserted)`), and normalize `\r`/`\n` appropriately (`ignore` or reject `Enter` instead of corrupting text buffer with invisible `'\n'`). Avoid `e.target.value = ''` side-effect breaking cursor selection cleanly by setting value to single sentinel `' '` / `'\u200B'` + `setSelectionRange(1, 1)` so mobile Backspace ALWAYS has a deletable character!
     - Prevent double-firing between `onKeyDown('Backspace')` and `onBeforeInput('deleteContentBackward')` via clean per-event guard (`handledBackspaceInKeyDownRef` or handling backspace consistently in `onBeforeInput` / `onChange` sentinel deletion while `e.preventDefault()` on desktop `Backspace` keeps desktop fast path deterministic!). Document exact state transition matrix clearly before coding.
  2. **Interactive Focus Exemption:** Inside `handleGlobalKey`, ignore events if `e.target` or `document.activeElement` matches interactive elements (`button, a, input, select, textarea, [role="button"], [role="dialog"]`), AND skip printable auto-focus when `status === 'completed'` (ResultScreen)! Keep `Escape` explicitly scoped to `/typing` reset only when no modal is open (`[role="dialog"]`).
- **Files/Components Affected:** `components/typing/typing-container.tsx`.
- **Database Changes:** None.
- **Security Implications:** Multi-char committed tokens send sequential single-char `KEYSTROKE` events cleanly to worker & telemetry schema (maintaining compatibility with server `k.length === 1` rule!).
- **Dependencies:** `ENG-2.2`.
- **Testing Requirements:** Vitest/RTL test simulating multi-character input (`"the "`), Japanese/dead-key `compositionstart` -> `compositionend`, empty/sentinel Android `Backspace` (`inputType: 'deleteContentBackward'` with `key: 'Unidentified'`), and keyboard `Enter`/`Space` activation on `<Button>` controls in `TypingContainer` without hijacking focus. Playwright mobile-emulation touch focus & typing test.
- **Acceptance Criteria:** Typing on iOS Safari & Android Chrome/Gboard registers word completions and Backspaces accurately; Tab + Space/Enter operates Navbar and mode buttons cleanly without pulling focus to typing arena; `Enter` does not insert broken `'\n'` glyphs.
- **Priority:** `High`
- **Estimated Complexity:** `M`

---

### ENG-2.5: Result Submission Idempotency, Real Personal Best, Metrics Breakdown & Cat Companion Fix
- **Audit Reference:** `PA-07`, `FI-03`, `FI-04`, `FI-05`, `TD-07`, `UX-08`
- **Problem:**
  1. `ResultScreen` `useEffect` lacks a per-run idempotency guard (`result` + `session` dep changes or StrictMode remounts submit twice).
  2. `"Personal Best"` badge triggers whenever `result.wpm > 80` (`result-screen.tsx:186`).
  3. `"Errors (uncorrected)"` and `"Mistakes registered"` display the exact same `result.errorCount`, while `"Characters typed"` displays `userInput.length` (`post-backspace`) rather than total keystrokes.
  4. Confetti `requestAnimationFrame(frame)` never cancels on unmount and ignores `prefers-reduced-motion`.
  5. `/challenge/[id]` transitions to `'comparison'` without submitting challenger's score to Supabase or saving replay/streak progress (`FI-03`).
  6. `CatCompanion` has two `useEffect` races wiping `localStorage` unlocks on mount, `ResultScreen` omits `streakDays`, and `useMemo` calls `Math.random()` (`TD-07`, `FI-04`).
- **Root Cause:** Coupling persistence side effects to component mount effect without `runId` guards, missing prior-PB lookup, incomplete challenge wiring, and impure hook dependencies.
- **Proposed Solution:**
  1. **Run ID & Idempotent Persistence Hook (`useSubmitResult` or completion callback):** Generate `runId = crypto.randomUUID()` when typing starts (`first keystroke` -> `clientRunId`). `ResultScreen` (and `ChallengePage` completion!) invokes submission **at most once per `runId`** guarded via `submittedRunIdRef`, sending `clientRunId` + `telemetry` to `POST /api/results` (which enforces DB idempotency on `client_run_id`).
  2. **Guest Telemetry Retention (`stores/user-store.ts`):** Update `GuestResult` schema to store compressed `telemetry` (capped e.g. last 30 guest runs with telemetry, pruning telemetry from older runs >30 while keeping summary rows up to 100 so `localStorage` quota stays `< 500 KB`). Enables future cloud sync (`handleSyncHistory`) via verified `POST /api/results`!
  3. **Authentic Personal Best Check:** Query previous max WPM for `(mode, duration)` (either returned cleanly in `POST /api/results` response `{ isPersonalBest: boolean, previousBestWpm: number | null }` for signed-in users, or computed synchronously from `guestHistory` prior runs for guests!). Remove `result.wpm > 80` entirely!
  4. **Clear Result Breakdown Metrics & Safe Confetti:**
     - Display: `Raw Speed` (`rawWpm WPM`), `Keystrokes (Correct / Total)` (`correctInputKeystrokes / totalInputKeystrokes`), `Uncorrected Errors`, `Backspaces Pressed`. Remove duplicate `"Mistakes registered"` row.
     - Confetti: Only run on **real Personal Best** or high accuracy milestone, check `window.matchMedia('(prefers-reduced-motion: reduce)').matches`, load `canvas-confetti` dynamically on trigger, and store rAF ID in `rafRef` + call `cancelAnimationFrame` on unmount cleanup.
  5. **Challenge Submission Wiring (`FI-03`):** When `ChallengePage` enters `status === 'completed'`, submit the verified run through `POST /api/results` (passing `challengeId` cleanly in Phase 5, and saving to user dashboard/streaks immediately in Phase 2!), clear `seed` in Zustand on unmount (`useEffect(() => () => setSeed(''), ...)`).
  6. **Fix `CatCompanion` (`TD-07`, `FI-04`):** Lazy-initialize `unlockedIds` via external `useSyncExternalStore` / single hydration guard, pass real `streakDays` fetched/passed from `ResultScreen` / `useUserStore` / `/api/results` response, replace `Math.random()` in `useMemo` with deterministic index `(wpm + errorCount) % quotes.length`.
- **Files/Components Affected:** `stores/typing-store.ts`, `stores/user-store.ts`, `components/typing/result-screen.tsx`, `app/challenge/[id]/page.tsx`, `components/typing/cat-companion.tsx`, `app/api/results/route.ts`.
- **Database Changes:** `client_run_id UUID UNIQUE` on `test_results` (shared with `SEC-1.4`).
- **Security Implications:** Guarantees strict 1-to-1 correspondence between completed runs and database writes; challenges credit real verified runs instead of vanishing.
- **Dependencies:** `SEC-1.4`, `ENG-2.1`.
- **Testing Requirements:** Vitest/RTL StrictMode double-render test proving `POST /api/results` fires once; PB badge logic unit test (`85 WPM` with prior `120 WPM` shows `false`; `121 WPM` shows `true`); `CatCompanion` preserve-existing-unlocks test.
- **Acceptance Criteria:** Reloading or React StrictMode mount creates 0 duplicate DB/guest rows; `"Personal Best"` reflects real prior PB; `CatCompanion` never wipes unlocked cats; finishing a 1v1 challenge saves to user history cleanly.
- **Priority:** `High`
- **Estimated Complexity:** `M`

---

## PART B: PHASE 3 — ENGINEERING QUALITY, ARCHITECTURE & PERFORMANCE

### ENG-3.1: Zero ESLint Errors/Warnings & End-to-End TypeScript Strictness
- **Audit Reference:** `TD-01`, `PA-06`
- **Problem:** `npm run lint` fails with **111 problems (55 errors, 56 warnings)** including 26 `@typescript-eslint/no-explicit-any` errors across API routes/stores/components, 14 `react-hooks/set-state-in-effect` errors, React 19 Compiler errors (`react-hooks/immutability` in `ReplayPlayer`, `react-hooks/purity` in `CatCompanion`), 6 `react/no-unescaped-entities` in `PerformanceLabPage`, and 56 dead imports/warnings. Zero automated tests exist.
- **Root Cause:** Rapid prototyping bypassing hook rules, using `any` instead of generated Supabase schema types, and no CI lint/test check.
- **Proposed Solution:**
  1. **Generate Strict Supabase Types:** Create [types/database.ts](../../types/database.ts) (`supabase gen types typescript` schema mirror) and parameterize `createClient<Database>()` across `lib/supabase/{client,server,admin,middleware}.ts`.
  2. **Eliminate All 26 `any` Types:** Replace `session: any` in `useUserStore` with `Session | null` from `@supabase/supabase-js`; replace `catch (err: any)` with `catch (err: unknown)` + type guards (`err instanceof Error`); define strict row/join interfaces for `LeaderboardEntry`, `ChallengeLinkRow`, `TestResultRow`, `ReplayRow`, and `DashboardStats`.
  3. **Fix All React 19 Compiler & Effect Violations (14 `set-state-in-effect` + `immutability` + `purity`):**
     - `app/dashboard/page.tsx`: Convert derived `stats` computation into `useMemo` (removing `setStats` inside `useEffect`). Load async data cleanly inside async effect callbacks (`let cancelled = false`).
     - `app/challenge/[id]/page.tsx`: Derive/transition `'comparison'` state or trigger in completion handler without chaining `setState` synchronously inside effect body.
     - `components/typing/replay-player.tsx`: Fix recursive `animate` (`react-hooks/immutability` line 70) by defining rAF callback inside `useEffect([isPlaying, durationMs])` using `requestAnimationFrame` cleanly and handling stop outside `setCurrentTime` updater. Compute `replayInput` / `replayIndex` cleanly via `useMemo` using precomputed checkpoint snapshots (fixing both `set-state-in-effect` AND `O(N)` per-frame CPU spike, `TD-06`!).
     - `components/auth/username-modal.tsx`, `app/login/page.tsx`, `app/leaderboard/page.tsx`, `app/dashboard/performance-lab/page.tsx`, `components/navbar.tsx`, `components/typing/result-screen.tsx`, `components/typing/cat-companion.tsx`: Refactor sync state resets into key-based resets, event handlers, or lazy initializers.
  4. **Fix Escaped JSX Entities & Clean Unused Warnings:** Fix quotes in `PerformanceLabPage` (`&apos;`/`&quot;` or clean copy), remove all unused imports in `app/page.tsx` (8 unused vars), unused vars in `analytics.worker.ts`, and missing deps.
- **Files/Components Affected:** `types/database.ts` (new), `lib/supabase/*.ts`, `lib/logger.ts`, `stores/user-store.ts`, `app/api/**/*.ts`, `app/page.tsx`, `app/login/page.tsx`, `app/leaderboard/page.tsx`, `app/dashboard/page.tsx`, `app/dashboard/performance-lab/page.tsx`, `app/challenge/[id]/page.tsx`, `app/u/[username]/page.tsx`, `app/typing/page.tsx`, `components/navbar.tsx`, `components/auth/username-modal.tsx`, `components/typing/{replay-player,cat-companion,result-screen}.tsx`, `workers/analytics.worker.ts`.
- **Database Changes:** None.
- **Security Implications:** Typed DB contracts and `unknown` catch narrowing prevent accidental object-shape leakage and unsafe runtime property accesses.
- **Dependencies:** `SEC-1.1` (removes debug/test routes so no stale files remain to lint), `ENG-2.5`.
- **Testing Requirements:** `npm run lint` passes with `0 errors` and `0 warnings`; `npx tsc --noEmit` exits `0`; Vitest + Playwright cover refactored hooks (`ReplayPlayer` scrubbing, `Dashboard` memoized stats).
- **Acceptance Criteria:** `npm run lint` exits `0` with zero errors and zero warnings across entire workspace.
- **Priority:** `High`
- **Estimated Complexity:** `L`

---

### ENG-3.2: Repository Hygiene, Dead Files, Functional Settings (`/profile`) & `/showcase` Disposition
- **Audit Reference:** `TD-02`, `FI-01`, `PA-09`
- **Problem:**
  1. Dead/conflicting files in repo: `app/page.tsx.modified` (486-line unused Bauhaus landing backup), `lib/supabase.ts` (0 consumers), `public/robots.txt` (conflicts with `app/robots.ts` domain), unused starter SVGs (`public/{file,globe,next,vercel,window}.svg`).
  2. Seeded achievement paths `/achievements/speed_50.svg` etc. resolve to `404` (`public/achievements/` does not exist).
  3. [components/ui/skeleton.tsx](../../components/ui/skeleton.tsx) (`Skeleton`, `SkeletonText`, `SkeletonCard`) has `0` consumers while pages hand-roll spin loaders.
  4. [app/profile/page.tsx](../../app/profile/page.tsx) has **zero inbound navigation links**, uses raw `<a>` instead of `<Link>`, and exposes `font_family` (`ibm-plex-mono` / `geist-mono`) and `volume` (`0..1`) controls that do **zero** runtime work (while preferences fail to persist to Supabase `profiles`).
  5. `app/showcase/page.tsx` is an unlinked 1,236-line hardcoded mock tour.
  6. [README.md](../../README.md#L42) uses local machine `file:///c:/Users/rudra/practice/OAUTH_SETUP.md` link and there is no `.env.example`.
- **Root Cause:** Incremental refactor leftovers, unlinked settings view, and incomplete preferences implementation.
- **Proposed Solution:**
  1. Delete orphaned files: `app/page.tsx.modified`, `lib/supabase.ts`, `public/robots.txt`, `public/{file,globe,next,vercel,window}.svg`. Add clean `.env.example` documenting `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, and server-only `SUPABASE_SERVICE_ROLE_KEY`. Fix `README.md` link (`./OAUTH_SETUP.md`) and clean hardcoded project ref or mark `[your-project-ref]` in `OAUTH_SETUP.md` if appropriate.
  2. Create real SVG badge assets under `public/achievements/` (matching all 8 DB codes `speed_50.svg`..`streak_30.svg` with clean `#FF5C00`/monochrome geometry).
  3. **Settings & Preferences Completion (`/profile` + Navbar + DB Sync):**
     - Link `/profile` cleanly inside `Navbar` user menu & mobile drawer.
     - Wire `font_family` cleanly in [app/layout.tsx](../../app/layout.tsx) & [app/globals.css](../../app/globals.css): actually load `JetBrains_Mono`, `IBM_Plex_Mono` (and/or `Geist_Mono` / `Fira_Code`) CSS variables, bind selected `--typing-font-active` to `document.documentElement` & `TextDisplay`, and set default `font_family` consistently to `'jetbrains-mono'`.
     - Wire `volume` cleanly using lightweight zero-dependency **Web Audio API click synthesizer** (`lib/audio/keystroke-sound.ts` — soft muted mechanical thock/click gated cleanly by `volume > 0` without shipping MP3 audio payloads!).
     - Sync updated `theme` and `font_family` via `PATCH /api/profile` when signed in (hydration loads DB preferences -> applies cleanly to DOM & Zustand store). Replace `<a href="/typing">` with Next `<Button href="/typing">`.
  4. **`/showcase` Disposition (Requires Owner Confirmation):**
     - *Recommended:* Remove `app/showcase/page.tsx` from production bundle (users already interact with real `Hero3D` on `/` and live unauthenticated `/typing` sandbox) to eliminate 1,236 lines of duplicated Bauhaus mock UI (`UX-03`).
     - *Alternative:* If owner wishes to keep an interactive guided walkthrough, refactor behind feature flag or rewrite using shared editorial components in Phase 4/5 instead of duplicated hardcoded arrays.
- **Files/Components Affected:** Deleted dead files, `.env.example` (new), `README.md`, `public/achievements/*.svg` (new), `lib/audio/keystroke-sound.ts` (new), `app/layout.tsx`, `app/globals.css`, `app/profile/page.tsx`, `components/navbar.tsx`, `stores/user-store.ts`, `app/showcase/page.tsx` (per owner decision).
- **Database Changes:** Align default `profiles.font_family` in DB/API if changing default from `'ibm-plex-mono'` to `'jetbrains-mono'` (`ALTER TABLE public.profiles ALTER COLUMN font_family SET DEFAULT 'jetbrains-mono';` + support existing `'ibm-plex-mono'` seamlessly via CSS variable mapping!).
- **Security Implications:** Removes unused client singleton `lib/supabase.ts`; ensures profile settings serialize through authenticated `PATCH /api/profile`.
- **Dependencies:** `SEC-1.6`.
- **Testing Requirements:** Vitest test for `lib/audio/keystroke-sound.ts` safe no-op when `AudioContext` missing or `volume === 0`; Playwright check navigating to `/profile`, switching font + theme, reloading, and confirming persisted styling.
- **Acceptance Criteria:** Zero dead unreferenced files; `/robots.txt` served exclusively by `app/robots.ts`; all 8 seeded achievement icon URLs return HTTP `200`; `/profile` reachable from nav with 100% functional Theme, Font Family, and Keystroke Audio Volume controls.
- **Priority:** `Medium`
- **Estimated Complexity:** `M`

---

### ENG-3.3: Server/Client Component Boundaries, Auth Provider Extraction, Pagination & Realtime Cleanup
- **Audit Reference:** `PA-05`, `TD-08`, `SEC-06`, `SEC-08`
- **Problem:**
  1. All 10 page files declare `'use client'`, causing empty loading shells on initial HTML, client-side DB waterfalls, zero `generateMetadata` OpenGraph previews for `/u/[username]` and `/challenge/[id]`, and bloated client bundles.
  2. Auth hydration + `onAuthStateChange` + `ensureProfileExists()` live strictly inside `<Navbar />` (`components/navbar.tsx:71-171`).
  3. `/u/[username]` and `/dashboard` execute unbounded `.select('*')` across a user's full lifetime `test_results`.
  4. `PerformanceLabPage` subscribes to `postgres_changes` (`INSERT` on `replays`) **with zero filter**, refetching user replays whenever *any* user worldwide submits a test (`performance-lab/page.tsx:211-216`).
- **Root Cause:** Client-first SPA habit carried into Next.js App Router, lack of a Data Access Layer (`data-security.md` guidance), and unbounded PostgREST queries.
- **Proposed Solution:**
  1. **Root `<AuthProvider>` (`components/providers/auth-provider.tsx`):** Move session verification (`supabase.auth.getUser()`), profile fetch, DB preference hydration, and `onAuthStateChange` into a lightweight root provider mounted in `app/layout.tsx`. Keep `<Navbar />` cleanly focused on UI rendering + theme/logout actions. Remove client `ensureProfileExists` Band-Aid fallback once `handle_new_user()` trigger (`SEC-1.5`) is hardened (or keep graceful read-only retry without trusting client insert).
  2. **Convert Public Routes to React Server Components + Data Access Layer (`lib/data/*.ts`, `import 'server-only'`):**
     - `app/page.tsx` (`/`): Server Component outer shell rendering static editorial copy, streaming dynamic live home sections + client `Hero3D` leaf (`components/home/hero-3d.tsx`). Note: home dynamic sections in `/` (`comparison.tsx`, `analytics.tsx`, `achievements.tsx`, `faq.tsx`) can become zero-JS Server Components except where subtle interactive FAQ accordion / counters need `'use client'`!
     - `app/leaderboard/page.tsx`: Server Component reads initial URL filters (`searchParams`) & fetches initial top 50 leaderboard page cleanly on the server, passing typed initial DTO + filter props to `<LeaderboardClient />` (keeping live filter swaps & Supabase Realtime channel cleanly inside leaf client).
     - `app/u/[username]/page.tsx`: Server Component fetches public profile + **aggregated SQL summary metrics** (bounded query / view `user_profile_summary`) + top recent runs (`limit 20`) + streak + unlocked achievements + exports `generateMetadata` (`TyProX | <displayName> (@<username>) - <bestWpm> WPM`).
     - `app/challenge/[id]/page.tsx`: Server Component validates non-expired `challenge_links` (`expires_at > now()`), fetches creator display fields, exports `generateMetadata` (`Challenge from @<creator> - Beat <wpm> WPM`), and passes safe props to `<ChallengeArenaClient />` (or `notFound()` when invalid/expired).
  3. **Paginate `/dashboard` & Fix Unfiltered Realtime:**
     - Create server-assisted / paginated dashboard loader (`limit 25` per page + total/aggregate summary RPC `get_user_dashboard_stats(p_user_id)` so average WPM, best WPM, total tests, and consistency don't require downloading 5,000 lifetime rows to browser JS!). Keep initial trend chart capped cleanly to recent `30` runs via `.limit(30)`.
     - Fix `PerformanceLabPage` Realtime subscription (`TD-08`): replace unfiltered `table: 'replays'` listener with `filter: \`user_id=eq.\${user.id}\`` on `table: 'test_results'` (`event: 'INSERT'`), debounced slightly (`500ms`) before reloading recent 15 replays so `replays` row insert has committed cleanly!
- **Files/Components Affected:** `components/providers/auth-provider.tsx` (new), `lib/data/{leaderboard,profile,challenge,dashboard}.ts` (new, `server-only`), `components/navbar.tsx`, `app/layout.tsx`, `app/page.tsx`, `app/leaderboard/page.tsx` + `components/leaderboard/leaderboard-client.tsx`, `app/u/[username]/page.tsx` + `components/profile/public-profile-client.tsx`, `app/challenge/[id]/page.tsx` + `components/challenge/challenge-client.tsx`, `app/dashboard/page.tsx`, `app/dashboard/performance-lab/page.tsx`.
- **Database Changes:** Add optional Postgres helper function/view `public.get_user_dashboard_summary` (or compute in `lib/data/` cleanly with indexed `LIMIT` + aggregate SQL). Ensure `idx_test_results_created_at_desc` covers bounded recent queries cleanly.
- **Security Implications:** Follows Next.js 16 `data-security.md` DAL pattern cleanly (`server-only` sanitization ensures private fields like auth emails are never serialized into Server Component RSC props; pairs nicely with tightened `replays`/`test_results` RLS!).
- **Dependencies:** `SEC-1.5` (RLS hardening), `ENG-3.1` (typed Supabase queries).
- **Testing Requirements:** Playwright verifying SSR HTML contains profile username/stats without client hydration flicker, OpenGraph `<meta>` tags on `/u/[username]` & `/challenge/[id]`, expired challenge returns clean error UI, Dashboard pagination loads page 2 without full-table download.
- **Acceptance Criteria:** Initial HTML for `/`, `/leaderboard`, `/u/[username]`, `/challenge/[id]` renders meaningful SSR content (zero empty loading spinners on public landing/profile metadata); only interactive islands declare `'use client'`; `PerformanceLabPage` receives 0 cross-user Realtime broadcasts.
- **Priority:** `Medium`
- **Estimated Complexity:** `L`

---

### ENG-3.4: Client Performance, Bundle Size Reduction, Error Boundaries & HTTP Headers
- **Audit Reference:** `PA-04`, `PA-09`, `TD-02`, `UX-06`, `package-bundling.md`, `10-error-handling.md`
- **Problem:**
  1. `Hero3D` runs 3 unconditional intervals (`250ms` typing, `45ms` camera bob, `40ms` rainbow RGB cycling causing **25 full parent + 61 child Keycap React re-renders per second**), ignoring tab visibility, offscreen scroll state, and `prefers-reduced-motion`.
  2. `TextDisplay` mounts up to ~2,500 `<motion.span>` instances simultaneously with spring/tween scale transitions per character.
  3. Zero `error.tsx` or `global-error.tsx` boundaries exist under `app/`; `Skeleton` components exist unused.
  4. `next.config.ts` lacks `optimizePackageImports`, security headers, and safe fallback handling when third-party OAuth `avatar_url` comes from an unallowlisted host on `next/image`.
- **Root Cause:** Continuous React state timers instead of CSS/rAF/visibility-aware animations, excessive Framer Motion wrapping on high-frequency DOM nodes, missing App Router error files, and unexamined Turbopack bundle tree.
- **Proposed Solution:**
  1. **Bundle Baseline & Config (`next.config.ts`):** Run `npx next experimental-analyze --output` pre/post Phase 3 refactor; configure `experimental.optimizePackageImports: ['lucide-react', 'recharts', 'framer-motion']` (verify Next 16 compatibility); wrap `canvas-confetti` in lazy `await import('canvas-confetti')` inside `ResultScreen` (saves ~10 KB initial typing chunk). Also convert Home static components cleanly to Server Components (`ENG-3.3`) so `/` drops unnecessary hydration JS.
  2. **Throttle/Optimize `Hero3D` ([components/home/hero-3d.tsx](../../components/home/hero-3d.tsx)):**
     - Add `IntersectionObserver` (`rootMargin: '100px'`) + `document.visibilitychange` + `window.matchMedia('(prefers-reduced-motion: reduce)')` so idle simulation and bobbing **halt completely** when scrolled out of view, when tab is hidden, or when reduced motion is enabled.
     - Replace 40ms React state `setRgbHue` loop (25 re-renders/s across 61 keycaps!) with pure CSS `@keyframes` hue-rotate filter or CSS custom property transition on the chassis wrapper — zero React re-renders during RGB mode!
  3. **High-Frequency Typing DOM Optimization (`TextDisplay`):**
     - Replace `<motion.span>` per character with native lightweight `<span>` nodes using subtle CSS color transitions (`transition-colors duration-75`).
     - Optionally virtualize/window visible paragraph slices or track scroll via lightweight cached word line offsets (avoiding `offsetTop` forced synchronous reflow inside frequent renders by checking word change cleanly inside `useEffect` / `IntersectionObserver`).
  4. **Error Boundaries & Skeleton Adoption (`10-error-handling.md`):**
     - Add [app/error.tsx](../../app/error.tsx) (`'use client'`, reset CTA + clean editorial fallback), [app/global-error.tsx](../../app/global-error.tsx), and route `loading.tsx` files (`/dashboard/loading.tsx`, `/leaderboard/loading.tsx`, `/u/[username]/loading.tsx`, `/dashboard/performance-lab/loading.tsx`) built with [components/ui/skeleton.tsx](../../components/ui/skeleton.tsx).
  5. **Safe Image / Avatar Rendering:** Create reusable `<UserAvatar src={...} name={...} size={...} />` wrapper wrapping `next/image` with clean `onError` state fallback to crisp monochrome initials avatar (eliminates `next/image` runtime exceptions on arbitrary OAuth hosts!).
- **Files/Components Affected:** `next.config.ts`, `components/home/hero-3d.tsx`, `components/typing/text-display.tsx`, `components/typing/result-screen.tsx`, `components/ui/avatar.tsx` (new), `app/{error,global-error}.tsx` (new), route `loading.tsx` files (new).
- **Database Changes:** None.
- **Security Implications:** Safe `onError` avatar fallback prevents UI crash from arbitrary profile image hosts; error boundaries prevent raw client stack trace exposure.
- **Dependencies:** `ENG-3.1`, `ENG-3.3`.
- **Testing Requirements:** Measure Chrome/Playwright CPU idle frame render count when `Hero3D` scrolled offscreen (`0` interval re-renders); verify `TextDisplay` typing keystroke frame latency `< 4ms` on 120s text; run `npx next experimental-analyze --output` to verify reduced client JS chunk footprint on `/` and `/typing`.
- **Acceptance Criteria:** `Hero3D` renders 0 React updates per second when offscreen or under `prefers-reduced-motion`; `TextDisplay` uses zero `<motion.span>` per-character wrappers; error boundaries recover cleanly without losing shell navigation; `Avatar` degrades smoothly on broken URLs.
- **Priority:** `Medium`
- **Estimated Complexity:** `M`

---

### ENG-3.5: Automated Test Infrastructure Setup (Vitest + Playwright)
- **Audit Reference:** `PA-06`, `TD-01`
- **Problem:** Zero test runner, test script, unit tests, or E2E tests exist anywhere in the repository (`0` files).
- **Root Cause:** Features built without automated test infrastructure.
- **Proposed Solution:** Configure **Vitest** (Node/JSDOM for pure TS engine, verifier, anti-cheat rules, PRNG text gen, Zod schemas, Zustand stores, sync Client Components) + **Playwright** (full browser Chrome/mobile emulation for Web Worker typing runs, focus/IME, dark/light hydration, auth redirects, Leaderboard/Challenge flows) strictly following Next 16 guides (`vitest.md` and `playwright.md`). **Full configuration, devDependencies, scripts, and test specifications are detailed in [TESTING_AND_ACCEPTANCE_CRITERIA.md](../../docs/roadmap/TESTING_AND_ACCEPTANCE_CRITERIA.md).**
- **Files/Components Affected:** `package.json` (devDependencies + `test`, `test:unit`, `test:e2e`, `typecheck` scripts), `vitest.config.mts`, `playwright.config.ts`, `__tests__/**`, `tests/e2e/**`.
- **Database Changes:** None (unit/API tests mock Supabase client cleanly; optional staging Supabase test suite run manually/CI secrets).
- **Security Implications:** Enables regression gates on every anti-cheat rule, Open Redirect sanitizer, and schema validation check.
- **Dependencies:** Phase 1 & Phase 2 core refactors (`metrics.ts`, `verifier.ts`, `text-generator.ts`, `redirect.ts`) expose cleanly testable pure interfaces.
- **Testing Requirements:** Run `npm run test:unit` cleanly in `< 5s`; run `npm run test:e2e` against `next build && next start`.
- **Acceptance Criteria:** `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build`, and `npm run test:e2e` execute cleanly and pass in CI.
- **Priority:** `Critical` (Bootstrap Vitest early alongside Phase 1/2 tasks so security & math fixes ship **with** tests from Day 1!)
- **Estimated Complexity:** `M`

