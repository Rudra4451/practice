import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}));

import { getPublicProfileByUsername } from '@/lib/data/profile';

describe('getPublicProfileByUsername', () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it('uses escaped .ilike lookup, excludes unranked runs from bestWpm, and resolves >200 run lifetime peak', async () => {
    const ilikeSpy = vi.fn();
    const orderSpies: Array<{ col: string; asc: boolean }> = [];
    const resultsCallArgs: string[] = [];

    const recent200 = Array.from({ length: 200 }, (_, i) => ({
      id: `r-${i}`,
      wpm: i === 0 ? 150 : 70,
      accuracy: 96,
      mode: i === 0 ? 'drill' : 'words',
      duration: 30,
      is_ranked: i !== 0,
      created_at: `2026-10-01T00:00:${String(i % 60).padStart(2, '0')}Z`,
    }));

    createClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              ilike: (col: string, pattern: string) => {
                ilikeSpy(col, pattern);
                return {
                  order: (orderCol: string, opts: { ascending: boolean }) => {
                    orderSpies.push({ col: orderCol, asc: opts.ascending });
                    return {
                      limit: async () => ({
                        data: [
                          {
                            id: 'user-1',
                            username: 'Rudra_Dev',
                            display_name: 'Rudra Dev',
                            avatar_url: null,
                            created_at: '2026-01-01T00:00:00Z',
                          },
                        ],
                        error: null,
                      }),
                    };
                  },
                };
              },
            }),
          };
        }

        if (table === 'test_results') {
          return {
            select: (cols: string) => {
              resultsCallArgs.push(cols);
              if (cols.startsWith('id,')) {
                return {
                  eq: () => ({
                    eq: () => ({
                      order: () => ({
                        limit: async () => ({
                          data: recent200,
                          count: 250,
                          error: null,
                        }),
                      }),
                    }),
                  }),
                };
              }
              return {
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      order: () => ({
                        limit: async () => ({
                          data: [{ wpm: 138, mode: 'words' }],
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              };
            },
          };
        }

        if (table === 'streaks') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { current_streak: 4, longest_streak: 9 },
                  error: null,
                }),
              }),
            }),
          };
        }

        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: [], error: null }),
            }),
          }),
        };
      }),
    });

    const data = await getPublicProfileByUsername('Rudra_Dev');

    expect(ilikeSpy).toHaveBeenCalledWith('username', 'rudra\\_dev');
    expect(orderSpies[0]).toEqual({ col: 'created_at', asc: true });
    expect(data).not.toBeNull();
    // 150 WPM unranked drill must not override 138 WPM lifetime ranked peak
    expect(data?.stats.bestWpm).toBe(138);
    expect(data?.stats.testsCompleted).toBe(250);
    expect(data?.streak).toEqual({ current: 4, longest: 9 });
  });

  it('falls back cleanly when is_ranked column is absent (42703 pre-migration DB) and survives malformed % URI', async () => {
    createClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              ilike: () => ({
                order: () => ({
                  limit: async () => ({
                    data: [
                      {
                        id: 'user-2',
                        username: 'legacy_typist',
                        display_name: null,
                        avatar_url: null,
                        created_at: '2026-01-01T00:00:00Z',
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        if (table === 'test_results') {
          return {
            select: (cols: string) => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: async () => {
                      if (cols.includes('is_ranked')) {
                        return {
                          data: null,
                          count: null,
                          error: { code: '42703', message: 'column test_results.is_ranked does not exist' },
                        };
                      }
                      return {
                        data: [
                          {
                            id: 'r-ranked',
                            wpm: 94,
                            accuracy: 98,
                            mode: 'words',
                            duration: 30,
                            created_at: '2026-06-01T00:00:00Z',
                          },
                          {
                            id: 'r-drill',
                            wpm: 160,
                            accuracy: 99,
                            mode: 'drill',
                            duration: 30,
                            created_at: '2026-06-02T00:00:00Z',
                          },
                        ],
                        count: 2,
                        error: null,
                      };
                    },
                  }),
                }),
              }),
            }),
          };
        }

        if (table === 'streaks') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          };
        }

        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: [], error: null }),
            }),
          }),
        };
      }),
    });

    const data = await getPublicProfileByUsername('%E0%A4%A_broken');
    expect(data).not.toBeNull();
    expect(data?.stats.bestWpm).toBe(94);
  });
});

