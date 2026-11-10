-- ================================================================
-- TyProX 2.0 Atomic Result Persistence & Scoped Idempotency Migration
-- Status: PREPARED ONLY (DO NOT EXECUTE WITHOUT PRODUCTION APPROVAL
--         AND SUPABASE_SERVICE_ROLE_KEY PROVISIONED IN ENVIRONMENT)
-- Apply Order: AFTER 20260621000000_typrox_2_hardening.sql
-- ================================================================

-- 1. ENSURE (user_id, client_run_id) SCOPED UNIQUENESS WITHOUT GLOBAL COLLISIONS
ALTER TABLE public.test_results
    ADD COLUMN IF NOT EXISTS client_run_id UUID;

DO $$
DECLARE
    v_constraint_name TEXT;
BEGIN
    FOR v_constraint_name IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'test_results'
          AND c.contype = 'u'
          AND array_length(c.conkey, 1) = 1
          AND EXISTS (
              SELECT 1
              FROM pg_attribute a
              WHERE a.attrelid = t.oid
                AND a.attnum = c.conkey[1]
                AND a.attname = 'client_run_id'
          )
    LOOP
        EXECUTE format('ALTER TABLE public.test_results DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
    END LOOP;
END $$;

DROP INDEX IF EXISTS public.test_results_client_run_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_test_results_user_client_run_id
    ON public.test_results(user_id, client_run_id)
    WHERE user_id IS NOT NULL AND client_run_id IS NOT NULL;

-- 2. ATOMIC MULTI-TABLE PERSISTENCE RPC (service_role ONLY)
CREATE OR REPLACE FUNCTION public.submit_verified_result(
    p_user_id UUID,
    p_wpm REAL,
    p_raw_wpm REAL,
    p_accuracy REAL,
    p_consistency REAL,
    p_error_count INTEGER,
    p_backspace_count INTEGER,
    p_mode VARCHAR,
    p_duration INTEGER,
    p_seed VARCHAR,
    p_client_run_id UUID DEFAULT NULL,
    p_telemetry JSONB DEFAULT '[]'::jsonb,
    p_deduplicate_by_signature BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result public.test_results%ROWTYPE;
    v_candidate RECORD;
    v_replay_telemetry JSONB;
    v_deduplicated BOOLEAN := FALSE;
    v_recovered_partial BOOLEAN := FALSE;
    v_prev_best_wpm REAL := NULL;
    v_is_pb BOOLEAN := FALSE;
    v_streak_row public.streaks%ROWTYPE;
    v_today DATE := (timezone('utc'::text, now()))::date;
    v_current_streak INTEGER := 0;
    v_longest_streak INTEGER := 0;
    v_total_tests INTEGER := 1;
    v_unlocked TEXT[] := ARRAY[]::TEXT[];
    v_ach RECORD;
    v_criteria_type TEXT;
    v_should_unlock BOOLEAN;
    v_inserted_ach_id UUID;
    v_recovery_cutoff TIMESTAMPTZ := timezone('utc'::text, now()) - interval '15 minutes';
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'p_user_id is required for verified result persistence.';
    END IF;

    -- 2A. Idempotency lookup scoped strictly to (user_id, client_run_id)
    IF p_client_run_id IS NOT NULL THEN
        SELECT *
        INTO v_result
        FROM public.test_results
        WHERE user_id = p_user_id
          AND client_run_id = p_client_run_id
        LIMIT 1;

        IF FOUND THEN
            v_deduplicated := TRUE;
        END IF;
    END IF;

    -- 2B. Telemetry signature deduplication + <15m orphan partial-write recovery
    IF NOT v_deduplicated AND p_deduplicate_by_signature THEN
        FOR v_candidate IN
            SELECT
                tr.id,
                tr.raw_wpm,
                tr.consistency,
                tr.error_count,
                tr.backspace_count,
                tr.created_at,
                rp.id AS replay_id,
                rp.telemetry AS replay_telemetry
            FROM public.test_results tr
            LEFT JOIN public.replays rp ON rp.test_result_id = tr.id
            WHERE tr.user_id = p_user_id
              AND tr.seed = p_seed
              AND tr.mode = p_mode
              AND tr.duration = p_duration
              AND tr.wpm = p_wpm
              AND tr.accuracy = p_accuracy
              AND tr.is_invalidated = FALSE
            ORDER BY tr.created_at DESC
            LIMIT 5
        LOOP
            IF v_candidate.replay_id IS NOT NULL AND v_candidate.replay_telemetry = p_telemetry THEN
                SELECT * INTO v_result FROM public.test_results WHERE id = v_candidate.id;
                v_deduplicated := TRUE;
                EXIT;
            END IF;

            IF v_candidate.replay_id IS NULL
               AND v_candidate.created_at >= v_recovery_cutoff
               AND v_candidate.raw_wpm = p_raw_wpm
               AND v_candidate.consistency = p_consistency
               AND v_candidate.error_count = p_error_count
               AND v_candidate.backspace_count = p_backspace_count THEN
                SELECT * INTO v_result FROM public.test_results WHERE id = v_candidate.id;
                v_deduplicated := TRUE;
                EXIT;
            END IF;
        END LOOP;
    END IF;

    -- 2C. Atomic INSERT into test_results + replays (native transaction rollback on failure)
    IF NOT v_deduplicated THEN
        BEGIN
            INSERT INTO public.test_results (
                user_id,
                wpm,
                raw_wpm,
                accuracy,
                consistency,
                error_count,
                backspace_count,
                mode,
                duration,
                seed,
                client_run_id,
                is_invalidated
            )
            VALUES (
                p_user_id,
                p_wpm,
                p_raw_wpm,
                p_accuracy,
                p_consistency,
                p_error_count,
                p_backspace_count,
                p_mode,
                p_duration,
                p_seed,
                p_client_run_id,
                FALSE
            )
            RETURNING * INTO v_result;
        EXCEPTION
            WHEN unique_violation THEN
                IF p_client_run_id IS NULL THEN
                    RAISE;
                END IF;

                SELECT *
                INTO v_result
                FROM public.test_results
                WHERE user_id = p_user_id
                  AND client_run_id = p_client_run_id
                LIMIT 1;

                IF NOT FOUND THEN
                    RAISE;
                END IF;

                v_deduplicated := TRUE;
        END;
    END IF;

    IF NOT v_deduplicated THEN
        INSERT INTO public.replays (test_result_id, telemetry)
        VALUES (v_result.id, p_telemetry)
        ON CONFLICT (test_result_id) DO NOTHING;
    ELSE
        SELECT rp.telemetry
        INTO v_replay_telemetry
        FROM public.replays rp
        WHERE rp.test_result_id = v_result.id
        LIMIT 1;

        IF NOT FOUND THEN
            INSERT INTO public.replays (test_result_id, telemetry)
            VALUES (v_result.id, p_telemetry)
            ON CONFLICT (test_result_id) DO NOTHING;
            v_recovered_partial := TRUE;
        END IF;
    END IF;

    -- 2D. Compute real prior Personal Best excluding v_result.id itself
    SELECT tr.wpm
    INTO v_prev_best_wpm
    FROM public.test_results tr
    WHERE tr.user_id = p_user_id
      AND tr.mode = v_result.mode
      AND tr.duration = v_result.duration
      AND tr.is_invalidated = FALSE
      AND tr.id <> v_result.id
    ORDER BY tr.wpm DESC
    LIMIT 1;

    v_is_pb := v_result.wpm > 0 AND (v_prev_best_wpm IS NULL OR v_result.wpm > v_prev_best_wpm);

    -- 2E. Row-locked UTC streak initialization and advancement
    SELECT *
    INTO v_streak_row
    FROM public.streaks s
    WHERE s.user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        BEGIN
            INSERT INTO public.streaks (user_id, current_streak, longest_streak, last_active_date, updated_at)
            VALUES (p_user_id, 1, 1, v_today, timezone('utc'::text, now()))
            RETURNING * INTO v_streak_row;
        EXCEPTION
            WHEN unique_violation THEN
                SELECT *
                INTO v_streak_row
                FROM public.streaks s
                WHERE s.user_id = p_user_id
                FOR UPDATE;
        END;
    END IF;

    IF COALESCE(v_streak_row.current_streak, 0) = 0 OR v_streak_row.last_active_date IS NULL THEN
        v_current_streak := 1;
        v_longest_streak := GREATEST(1, COALESCE(v_streak_row.longest_streak, 0));
        UPDATE public.streaks
        SET current_streak = v_current_streak,
            longest_streak = v_longest_streak,
            last_active_date = v_today,
            updated_at = timezone('utc'::text, now())
        WHERE user_id = p_user_id;
    ELSIF v_streak_row.last_active_date <> v_today THEN
        IF (v_today - v_streak_row.last_active_date) = 1 THEN
            v_current_streak := v_streak_row.current_streak + 1;
        ELSIF (v_today - v_streak_row.last_active_date) > 1 THEN
            v_current_streak := 1;
        ELSE
            v_current_streak := v_streak_row.current_streak;
        END IF;
        v_longest_streak := GREATEST(v_current_streak, COALESCE(v_streak_row.longest_streak, 0));
        UPDATE public.streaks
        SET current_streak = v_current_streak,
            longest_streak = v_longest_streak,
            last_active_date = v_today,
            updated_at = timezone('utc'::text, now())
        WHERE user_id = p_user_id;
    ELSE
        v_current_streak := v_streak_row.current_streak;
    END IF;

    -- 2F. Verified test count & idempotent achievement evaluation
    SELECT COUNT(*)::integer
    INTO v_total_tests
    FROM public.test_results tr
    WHERE tr.user_id = p_user_id
      AND tr.is_invalidated = FALSE;

    FOR v_ach IN
        SELECT a.id, a.name, a.criteria
        FROM public.achievements a
        WHERE NOT EXISTS (
            SELECT 1
            FROM public.user_achievements ua
            WHERE ua.user_id = p_user_id
              AND ua.achievement_id = a.id
        )
    LOOP
        v_criteria_type := v_ach.criteria->>'type';
        v_should_unlock := FALSE;

        IF v_criteria_type = 'speed' AND (v_ach.criteria ? 'wpm') THEN
            v_should_unlock :=
                v_result.wpm >= (v_ach.criteria->>'wpm')::numeric
                AND v_result.accuracy >= COALESCE((v_ach.criteria->>'accuracy')::numeric, 0);
        ELSIF v_criteria_type = 'streak' AND (v_ach.criteria ? 'days') THEN
            v_should_unlock := v_current_streak >= (v_ach.criteria->>'days')::integer;
        ELSIF v_criteria_type = 'accuracy' AND (v_ach.criteria ? 'accuracy') THEN
            v_should_unlock := v_result.accuracy >= (v_ach.criteria->>'accuracy')::numeric;
        ELSIF v_criteria_type = 'tests' AND (v_ach.criteria ? 'count') THEN
            v_should_unlock := v_total_tests >= (v_ach.criteria->>'count')::integer;
        END IF;

        IF v_should_unlock THEN
            INSERT INTO public.user_achievements (user_id, achievement_id)
            VALUES (p_user_id, v_ach.id)
            ON CONFLICT (user_id, achievement_id) DO NOTHING
            RETURNING achievement_id INTO v_inserted_ach_id;

            IF v_inserted_ach_id IS NOT NULL THEN
                v_unlocked := array_append(v_unlocked, v_ach.name::text);
                IF v_deduplicated THEN
                    v_recovered_partial := TRUE;
                END IF;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'result', jsonb_build_object(
            'id', v_result.id,
            'user_id', v_result.user_id,
            'wpm', v_result.wpm,
            'raw_wpm', v_result.raw_wpm,
            'accuracy', v_result.accuracy,
            'consistency', v_result.consistency,
            'error_count', v_result.error_count,
            'backspace_count', v_result.backspace_count,
            'mode', v_result.mode,
            'duration', v_result.duration,
            'seed', v_result.seed,
            'client_run_id', v_result.client_run_id,
            'created_at', v_result.created_at
        ),
        'unlocked', to_jsonb(v_unlocked),
        'previousBestWpm', v_prev_best_wpm,
        'isPersonalBest', v_is_pb,
        'streakDays', v_current_streak,
        'deduplicated', v_deduplicated,
        'recoveredPartialWrite', v_recovered_partial
    );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_verified_result(
    UUID, REAL, REAL, REAL, REAL, INTEGER, INTEGER, VARCHAR, INTEGER, VARCHAR, UUID, JSONB, BOOLEAN
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.submit_verified_result(
    UUID, REAL, REAL, REAL, REAL, INTEGER, INTEGER, VARCHAR, INTEGER, VARCHAR, UUID, JSONB, BOOLEAN
) TO service_role;
