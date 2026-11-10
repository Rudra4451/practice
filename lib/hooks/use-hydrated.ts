'use client';

import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

/**
 * Returns false on SSR & initial client hydration pass, then true after hydration.
 * Prevents React hydration mismatches when reading persisted localStorage/clock state.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

