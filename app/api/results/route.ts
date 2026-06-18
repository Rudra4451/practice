import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const telemetrySchema = z.object({
  t: z.number(),
  k: z.string(),
  y: z.number(), // 0 = input, 1 = delete
  i: z.number(),
});

const submitResultSchema = z.object({
  wpm: z.number().min(0).max(350),
  rawWpm: z.number().min(0).max(350),
  accuracy: z.number().min(0).max(100),
  consistency: z.number().min(0).max(100),
  errorCount: z.number().min(0),
  backspaceCount: z.number().min(0),
  mode: z.enum(['words', 'quotes', 'numbers', 'punctuation', 'code']),
  duration: z.number().min(1).max(300),
  seed: z.string().max(64),
  telemetry: z.array(telemetrySchema).max(10000), // cap at 10k events (~3min at 55wpm)
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = submitResultSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload schema.' }, { status: 400 });
    }

    const {
      wpm,
      rawWpm,
      accuracy,
      consistency,
      errorCount,
      backspaceCount,
      mode,
      duration,
      seed,
      telemetry,
    } = parsed.data;

    // 1. Anti-Cheat: Validate timing and telemetry logic
    if (telemetry.length > 0) {
      let lastTime = 0;
      const deltas: number[] = [];

      for (let i = 0; i < telemetry.length; i++) {
        const item = telemetry[i];
        if (item.t < lastTime) {
          return NextResponse.json({ error: 'Cheat detected: timeline anomaly.' }, { status: 400 });
        }
        if (i > 0) {
          deltas.push(item.t - lastTime);
        }
        lastTime = item.t;
      }

      // Check Timing Regularity (Autotyper standard dev check)
      if (deltas.length > 10) {
        const meanDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
        const variance = deltas.reduce((a, b) => a + Math.pow(b - meanDelta, 2), 0) / deltas.length;
        const stdDev = Math.sqrt(variance);

        // Human fingers have timing jitter. A standard dev < 1.5ms indicates mechanical scripting.
        if (stdDev < 1.5) {
          return NextResponse.json({ error: 'Cheat detected: suspicious typing regularity.' }, { status: 400 });
        }
      }
    }

    // 2. Establish Session Context
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let savedResult = null;
    const newlyUnlockedAchievements: string[] = [];

    if (user) {
      // 3. Write Test Result
      const { data: dbResult, error: dbErr } = await supabase
        .from('test_results')
        .insert({
          user_id: user.id,
          wpm,
          raw_wpm: rawWpm,
          accuracy,
          consistency,
          error_count: errorCount,
          backspace_count: backspaceCount,
          mode,
          duration,
          seed,
        })
        .select()
        .single();

      if (dbErr || !dbResult) {
        return NextResponse.json({ error: 'Database saving failed.' }, { status: 500 });
      }
      savedResult = dbResult;

      // 4. Save Compressed Replay Telemetry
      await supabase.from('replays').insert({
        test_result_id: dbResult.id,
        telemetry,
      });

      // 5. Update Daily Streak
      const today = new Date().toISOString().split('T')[0];
      const { data: streakRow } = await supabase
        .from('streaks')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (streakRow) {
        let currentStreak = streakRow.current_streak;
        let longestStreak = streakRow.longest_streak;
        const lastActive = streakRow.last_active_date;

        if (lastActive !== today) {
          const date1 = new Date(lastActive);
          const date2 = new Date(today);
          const diffMs = date2.getTime() - date1.getTime();
          const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

          if (diffDays === 1) {
            currentStreak++;
          } else if (diffDays > 1) {
            currentStreak = 1;
          }
          // diffDays === 0 can't happen since lastActive !== today

          longestStreak = Math.max(currentStreak, longestStreak);

          await supabase
            .from('streaks')
            .update({
              current_streak: currentStreak,
              longest_streak: longestStreak,
              last_active_date: today,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', user.id);
        }
        // If lastActive === today, streak is already counted — no update needed
      }

      // 6. Evaluate Achievement Triggers
      const { data: currentAchievements } = await supabase
        .from('user_achievements')
        .select('achievement_id')
        .eq('user_id', user.id); // CRITICAL: filter by user_id
      const unlockedIds = new Set(currentAchievements?.map((a) => a.achievement_id) || []);

      // Get system achievements list
      const { data: allAchievements } = await supabase.from('achievements').select('*');
      
      if (allAchievements) {
        for (const ach of allAchievements) {
          if (unlockedIds.has(ach.id)) continue;

          let triggerUnlock = false;
          const criteria = ach.criteria;

          if (criteria.type === 'speed' && wpm >= criteria.wpm && accuracy >= criteria.accuracy) {
            triggerUnlock = true;
          } else if (criteria.type === 'streak') {
            const currentStreakVal = streakRow?.current_streak || 1;
            if (currentStreakVal >= criteria.days) {
              triggerUnlock = true;
            }
          }

          if (triggerUnlock) {
            await supabase.from('user_achievements').insert({
              user_id: user.id,
              achievement_id: ach.id,
            });
            newlyUnlockedAchievements.push(ach.name);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      result: savedResult,
      unlocked: newlyUnlockedAchievements,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error.' }, { status: 500 });
  }
}
