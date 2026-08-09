# ADR-004: State Management Architecture

- **Status**: Approved
- **Date**: 2026-08-06
- **Authors**: TyProX Core Engineering Team

## Context
TyProX requires state management across three distinct scopes: global user auth session and settings, active real-time typing engine game loop state, and toast notification alerts.

## Problem
Mixing short-lived keystroke state (which changes on every keypress) with persistent user preferences in a single state store causes unnecessary component re-renders and hydration flash issues during SSR page loads.

## Decision
We enforce a split state management architecture using **Zustand v5** stores and React Context Providers:

1. **`useTypingStore`** (`src/stores/typing-store.ts`): Manages live test status (`idle`, `running`, `completed`), target text, input index, live WPM, accuracy, and combo counters. Transient, unpersisted state.
2. **`useUserStore`** (`src/stores/user-store.ts`): Manages user profile, auth session, guest run history, and preferences. Persisted to `localStorage` via Zustand persistence middleware.
3. **`useToastStore`** (`src/stores/toast-store.ts`): Manages system notification toasts.
4. **`ThemeProvider`** (`src/providers/theme-provider.tsx`): Hydration-safe React context wrapper managing HTML class toggles without layout shifts.

## Alternatives Considered
1. **Redux Toolkit**: Overkill with boilerplates for keypress event streams.
2. **React Context Alone**: Causes entire component tree re-renders on high-frequency state updates.

## Consequences
- **Positive**: High performance, isolated re-renders, clean hydration matching, straightforward persistence.
- **Negative**: Developers must choose the appropriate store for new state properties.
