# TyProX Coding & Engineering Standards

## 1. Anti-Pattern Rules (Non-Negotiable)
1. **Zero Input Latency**: Input processing must never run on the main UI thread during typing tests. Use Web Workers.
2. **The One-Key Rule**: Typing surfaces must autofocus instantly upon landing or single keypress. Never block input viewports with modal popups.
3. **No Copied Layouts**: Keep TyProX visual identity distinct—mechanical keycaps (`18px` radius, `4px` travel, `6px` elevation) and blueprint grid aesthetics.
4. **Deterministic Telemetry**: Math models must run client-side using deterministic formulas.
5. **Absolute Accessibility**: All components must support full keyboard navigation (`Tab`, `Escape`, `Enter`, Space) and ARIA attributes.

## 2. TypeScript & React Guidelines
- Enforce strict typing (`noImplicitAny`, strict null checks).
- Avoid `any` types; define domain interfaces in `src/types/` or feature `types.ts`.
- Prefer functional React 19 components with explicit prop interfaces.

## 3. Tailwind CSS & Design Tokens
- Use design tokens from `@/design-system/tokens`.
- Enforce keycap tokens (`rounded-[18px]`, `shadow-[0_6px_0_var(--border)]`, `duration-140`).
