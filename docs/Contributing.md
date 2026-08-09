# TyProX Engineering & Contributing Guide

Guide for developers contributing code to the TyProX repository.

## Non-Negotiable Rules
1. **Zero Input Latency**: Keystroke handling must remain under 1ms.
2. **The One-Key Rule**: Landing page must support immediate typing on `Enter`/`Space`/key press without blocking popups.
3. **No Recharts**: All charts must use native SVG + Framer Motion blueprint primitives.
4. **Strict TypeScript & Zero Warnings**: All code must pass `npx tsc --noEmit` with zero errors.
