import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Session } from '@supabase/supabase-js';
import type { CompressedTelemetryPoint } from '@/lib/typing/metrics';
import type { LessonProgressRecord } from '@/constants/curriculum';

export interface UserPreferences {
  theme: 'light' | 'dark';
  font_family: string;
  volume: number;
}

export interface UserProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  theme: string;
  font_family: string;
  created_at: string;
}

export type GuestSyncStatus = 'pending' | 'held' | 'rejected' | 'synced';

export const MAX_GUEST_SYNC_RETRIES = 3;

export interface GuestResult {
  id: string;
  clientRunId?: string;
  wpm: number;
  raw_wpm: number;
  accuracy: number;
  consistency: number;
  error_count: number;
  backspace_count: number;
  mode: string;
  duration: number;
  seed: string;
  isRanked?: boolean;
  telemetry?: CompressedTelemetryPoint[];
  created_at: string;
  syncStatus?: GuestSyncStatus;
  syncRejectionReason?: string;
  syncRejectedAt?: string;
  syncAttemptCount?: number;
}

export interface DailyCompletionRecord {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
  completedAt: string;
}

interface UserState {
  session: Session | null;
  profile: UserProfile | null;
  preferences: UserPreferences;
  guestHistory: GuestResult[];
  lessonProgress: Record<string, LessonProgressRecord>;
  dailyCompletions: Record<string, DailyCompletionRecord>;
  setSession: (session: Session | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  addGuestResult: (result: GuestResult) => void;
  removeGuestResults: (ids: string[]) => void;
  markGuestResultsRejected: (ids: string[], reasons?: Record<string, string>) => void;
  markGuestResultsHeld: (ids: string[], reasons?: Record<string, string>) => void;
  recordGuestSyncFailures: (ids: string[], reason?: string) => void;
  markGuestResultsSynced: (ids: string[]) => void;
  retryRejectedGuestResults: (ids?: string[]) => void;
  clearGuestHistory: () => void;
  recordLessonAttempt: (
    slug: string,
    outcome: { wpm: number; accuracy: number; stars: number; completed: boolean }
  ) => void;
  recordDailyCompletion: (utcDate: string, record: DailyCompletionRecord) => void;
}

function applyThemeAndFontToDocument(prefs: UserPreferences) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (prefs.theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  root.dataset.typingFont = prefs.font_family;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      session: null,
      profile: null,
      preferences: {
        theme: 'dark',
        font_family: 'jetbrains-mono',
        volume: 0.5,
      },
      guestHistory: [],
      lessonProgress: {},
      dailyCompletions: {},

      setSession: (session) => set({ session }),

      setProfile: (profile) => set({ profile }),

      updatePreferences: (prefs) => {
        const currentPrefs = get().preferences;
        const newPrefs = { ...currentPrefs, ...prefs };
        applyThemeAndFontToDocument(newPrefs);
        set({ preferences: newPrefs });
      },

      addGuestResult: (result) => {
        const currentHistory = get().guestHistory;
        if (
          (result.clientRunId &&
            currentHistory.some((item) => item.clientRunId === result.clientRunId)) ||
          currentHistory.some((item) => item.id === result.id)
        ) {
          return;
        }

        const nextHistory = [result, ...currentHistory].slice(0, 100);
        set({ guestHistory: nextHistory });
      },

      removeGuestResults: (ids) => {
        if (ids.length === 0) return;
        const removeSet = new Set(ids);
        const currentHistory = get().guestHistory;
        const retained = currentHistory.filter((item) => {
          const stableKey = item.clientRunId ?? item.id;
          return !removeSet.has(stableKey) && !removeSet.has(item.id);
        });
        set({ guestHistory: retained });
      },

      markGuestResultsRejected: (ids, reasons) => {
        if (ids.length === 0) return;
        const rejectedSet = new Set(ids);
        const rejectedAt = new Date().toISOString();
        set({
          guestHistory: get().guestHistory.map((item) => {
            const stableKey = item.clientRunId ?? item.id;
            if (!rejectedSet.has(stableKey) && !rejectedSet.has(item.id)) {
              return item;
            }
            const reason =
              reasons?.[stableKey] ??
              reasons?.[item.id] ??
              item.syncRejectionReason ??
              'Run failed server verification and was paused from automatic sync.';
            return {
              ...item,
              syncStatus: 'rejected',
              syncRejectionReason: reason,
              syncRejectedAt: rejectedAt,
            };
          }),
        });
      },

      markGuestResultsHeld: (ids, reasons) => {
        if (ids.length === 0) return;
        const heldSet = new Set(ids);
        const heldAt = new Date().toISOString();
        set({
          guestHistory: get().guestHistory.map((item) => {
            const stableKey = item.clientRunId ?? item.id;
            if (!heldSet.has(stableKey) && !heldSet.has(item.id)) {
              return item;
            }
            const reason =
              reasons?.[stableKey] ??
              reasons?.[item.id] ??
              item.syncRejectionReason ??
              'Run sync paused temporarily after repeated retry failures.';
            return {
              ...item,
              syncStatus: 'held',
              syncRejectionReason: reason,
              syncRejectedAt: heldAt,
            };
          }),
        });
      },

      recordGuestSyncFailures: (ids, reason) => {
        if (ids.length === 0) return;
        const failedSet = new Set(ids);
        const failedAt = new Date().toISOString();
        set({
          guestHistory: get().guestHistory.map((item) => {
            const stableKey = item.clientRunId ?? item.id;
            if (!failedSet.has(stableKey) && !failedSet.has(item.id)) {
              return item;
            }
            if (item.syncStatus === 'rejected' || item.syncStatus === 'synced') {
              return item;
            }
            const nextAttempts = (item.syncAttemptCount ?? 0) + 1;
            const shouldHold = nextAttempts >= MAX_GUEST_SYNC_RETRIES;
            return {
              ...item,
              syncAttemptCount: nextAttempts,
              syncStatus: shouldHold ? 'held' : 'pending',
              ...(shouldHold
                ? {
                    syncRejectionReason:
                      reason ||
                      'Repeated transient sync failures occurred. Paused locally until Retry Held Runs.',
                    syncRejectedAt: failedAt,
                  }
                : {}),
            };
          }),
        });
      },

      markGuestResultsSynced: (ids) => {
        if (ids.length === 0) return;
        const syncedSet = new Set(ids);
        set({
          guestHistory: get().guestHistory.map((item) => {
            const stableKey = item.clientRunId ?? item.id;
            if (!syncedSet.has(stableKey) && !syncedSet.has(item.id)) {
              return item;
            }
            const next: GuestResult = { ...item, syncStatus: 'synced' };
            delete next.syncAttemptCount;
            delete next.syncRejectionReason;
            delete next.syncRejectedAt;
            return next;
          }),
        });
      },

      retryRejectedGuestResults: (ids) => {
        const targetSet = ids && ids.length > 0 ? new Set(ids) : null;
        set({
          guestHistory: get().guestHistory.map((item) => {
            if (item.syncStatus !== 'rejected' && item.syncStatus !== 'held') return item;
            const stableKey = item.clientRunId ?? item.id;
            if (targetSet && !targetSet.has(stableKey) && !targetSet.has(item.id)) {
              return item;
            }
            const next: GuestResult = { ...item, syncStatus: 'pending' };
            delete next.syncRejectionReason;
            delete next.syncRejectedAt;
            delete next.syncAttemptCount;
            return next;
          }),
        });
      },

      clearGuestHistory: () => set({ guestHistory: [] }),

      recordLessonAttempt: (slug, outcome) => {
        const existing = get().lessonProgress[slug];
        const updated: LessonProgressRecord = {
          bestWpm: Math.max(existing?.bestWpm ?? 0, outcome.wpm),
          bestAccuracy: Math.max(existing?.bestAccuracy ?? 0, outcome.accuracy),
          stars: Math.max(existing?.stars ?? 0, outcome.stars),
          completed: Boolean(existing?.completed || outcome.completed),
          attempts: (existing?.attempts ?? 0) + 1,
          lastAttemptAt: new Date().toISOString(),
        };

        set({
          lessonProgress: {
            ...get().lessonProgress,
            [slug]: updated,
          },
        });
      },

      recordDailyCompletion: (utcDate, record) => {
        const existing = get().dailyCompletions[utcDate];
        const bestRecord =
          !existing ||
          record.wpm > existing.wpm ||
          (record.wpm === existing.wpm && record.accuracy > existing.accuracy)
            ? record
            : existing;

        const entries = Object.entries({
          ...get().dailyCompletions,
          [utcDate]: bestRecord,
        })
          .sort(([a], [b]) => (a > b ? -1 : 1))
          .slice(0, 60);

        set({
          dailyCompletions: Object.fromEntries(entries),
        });
      },
    }),
    {
      name: 'user-store',
      partialize: (state) => ({
        preferences: state.preferences,
        guestHistory: state.guestHistory,
        lessonProgress: state.lessonProgress,
        dailyCompletions: state.dailyCompletions,
      }),
    }
  )
);
