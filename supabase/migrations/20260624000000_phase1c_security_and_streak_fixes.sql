-- ================================================================
-- TyProX 2.0 Phase 1C Corrective Security & Streak Integrity Migration
-- Status: PREPARED ONLY (DO NOT EXECUTE AGAINST PRODUCTION WITHOUT
--         OWNER DB APPROVAL GATE & SUPABASE_SERVICE_ROLE_KEY PROVISIONED)
-- Apply Order: AFTER 20260623000000_atomic_result_persistence_and_idempotency.sql
-- Rationale: Preserves prior migration files (20260618..20260623) verbatim to
--            prevent migration-history checksum drift while remediating:
--            1. Direct authenticated profiles.username PostgREST bypass & reserved-name DB enforcement
--            2. Multi-collision / concurrent race handling in handle_new_user()
--            3. Pure-duplicate streak advancement & future last_active_date rollback in submit_verified_result()
--            4. Invalidated / conflicting client_run_id & signature replay rejection
-- ================================================================

-- 1. LEAST-PRIVILEGE COLUMN GRANTS & USERNAME INTEGRITY GUARD ON public.profiles
REVOKE UPDATE ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (display_name, avatar_url, theme, font_family, updated_at)
    ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Users can update their own profiles safely" ON public.profiles;
CREATE POLICY "Users can update their own profiles safely"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.is_reserved_username(p_username TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
SET search_path = public
AS $$
    SELECT lower(trim(COALESCE(p_username, ''))) = ANY (
        ARRAY[
            'admin',
            'administrator',
            'root',
            'system',
            'support',
            'typrox',
            'api',
            'auth',
            'login',
            'logout',
            'signup',
            'register',
            'dashboard',
            'leaderboard',
            'profile',
            'typing',
            'learn',
            'daily',
            'challenge',
            'challenges',
            'settings',
            'u',
            'null',
            'undefined'
        ]::text[]
    );
$$;

CREATE OR REPLACE FUNCTION public.enforce_profile_username_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_clean TEXT;
    v_old_clean TEXT;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.username IS NOT DISTINCT FROM OLD.username THEN
        RETURN NEW;
    END IF;

    v_clean := lower(trim(COALESCE(NEW.username, '')));

    IF v_clean !~ '^[a-z0-9_]{3,24}$' THEN
        RAISE EXCEPTION 'INVALID_USERNAME_FORMAT: Username must be 3-24 lowercase letters, numbers, or underscores.'
            USING ERRCODE = '23514';
    END IF;

    IF public.is_reserved_username(v_clean) THEN
        RAISE EXCEPTION 'RESERVED_USERNAME: This username is reserved.'
            USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF v_clean ~ '^user_[0-9a-f]{8}(_[0-9a-f]{4,8})?$' THEN
            RAISE EXCEPTION 'RESERVED_USERNAME_PLACEHOLDER: Please choose a custom username.'
                USING ERRCODE = '23514';
        END IF;

        v_old_clean := lower(trim(COALESCE(OLD.username, '')));
        IF v_old_clean <> '' AND v_old_clean !~ '^user_[0-9a-f]{8}(_[0-9a-f]{4,8})?$' THEN
            RAISE EXCEPTION 'USERNAME_LOCKED: Username is locked once set and cannot be changed.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    NEW.username := v_clean;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_profile_username_integrity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_profile_username_integrity ON public.profiles;
CREATE TRIGGER trg_enforce_profile_username_integrity
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_profile_username_integrity();

-- 2. MULTI-COLLISION & CONCURRENCY-SAFE handle_new_user() TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    raw_handle TEXT;
    clean_handle TEXT;
    candidate_handle TEXT;
    fallback_suffix TEXT;
    random_hex TEXT;
    display_val TEXT;
    attempt INTEGER;
    v_inserted BOOLEAN := FALSE;
BEGIN
    fallback_suffix := substring(replace(NEW.id::text, '-', ''), 1, 8);
    raw_handle := COALESCE(
        NEW.raw_user_meta_data->>'username',
        NEW.raw_user_meta_data->>'user_name',
        NEW.raw_user_meta_data->>'preferred_username',
        ''
    );

    clean_handle := regexp_replace(lower(trim(raw_handle)), '[^a-z0-9_]', '', 'g');
    IF char_length(clean_handle) < 3
       OR public.is_reserved_username(clean_handle)
       OR clean_handle ~ '^user_[0-9a-f]{8}(_[0-9a-f]{4,8})?$' THEN
        clean_handle := 'user_' || fallback_suffix;
    END IF;

    display_val := COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''),
        NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
        substring(clean_handle, 1, 50)
    );

    FOR attempt IN 0..15 LOOP
        IF attempt = 0 THEN
            candidate_handle := substring(clean_handle, 1, 24);
        ELSE
            random_hex := substring(
                md5(
                    NEW.id::text || ':' || attempt::text || ':' ||
                    clock_timestamp()::text || ':' || random()::text
                ),
                1,
                8
            );
            candidate_handle := substring(clean_handle, 1, 15) || '_' || random_hex;
        END IF;

        IF EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate_handle) THEN
            CONTINUE;
        END IF;

        BEGIN
            INSERT INTO public.profiles (id, username, display_name, avatar_url, theme, font_family)
            VALUES (
                NEW.id,
                candidate_handle,
                substring(display_val, 1, 50),
                NEW.raw_user_meta_data->>'avatar_url',
                'dark',
                'jetbrains-mono'
            )
            ON CONFLICT (id) DO NOTHING;

            v_inserted := TRUE;
            EXIT;
        EXCEPTION
            WHEN unique_violation THEN
                IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
                    v_inserted := TRUE;
                    EXIT;
                END IF;
                v_inserted := FALSE;
        END;
    END LOOP;

    IF NOT v_inserted THEN
        candidate_handle := 'user_' || fallback_suffix || '_' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 8);
        INSERT INTO public.profiles (id, username, display_name, avatar_url, theme, font_family)
        VALUES (
            NEW.id,
            candidate_handle,
            substring(display_val, 1, 50),
            NEW.raw_user_meta_data->>'avatar_url',
            'dark',
            'jetbrains-mono'
        )
        ON CONFLICT (id) DO NOTHING;
    END IF;

    INSERT INTO public.streaks (user_id, current_streak, longest_streak, last_active_date)
    VALUES (NEW.id, 0, 0, NULL)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 3. HARDENED submit_verified_result() RPC (QUALIFYING STREAKS, INVALIDATION & PAYLOAD PARITY)
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
    v_has_replay BOOLEAN := FALSE;
    v_existing_replay_id UUID;
    v_inserted_replay_id UUID;
    v_deduplicated BOOLEAN := FALSE;
    v_recovered_partial BOOLEAN := FALSE;
    v_qualifies_for_streak BOOLEAN := FALSE;
    v_matched_invalidated_sig BOOLEAN := FALSE;
    v_prev_best_wpm REAL := NULL;
    v_is_pb BOOLEAN := FALSE;
    v_streak_row public.streaks%ROWTYPE;
    v_streak_exists BOOLEAN := FALSE;
    v_today DATE := (timezone('utc'::text, now()))::date;
    v_activity_date DATE := (timezone('utc'::text, now()))::date;
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

    IF p_telemetry IS NULL OR jsonb_typeof(p_telemetry) <> 'array' OR jsonb_array_length(p_telemetry) = 0 THEN
        RAISE EXCEPTION 'Non-empty replay telemetry array is required for verified result persistence.';
    END IF;

    -- 3A. Idempotency lookup scoped strictly to (user_id, client_run_id) without hiding invalidated runs
    IF p_client_run_id IS NOT NULL THEN
        SELECT *
        INTO v_result
        FROM public.test_results
        WHERE user_id = p_user_id
          AND client_run_id = p_client_run_id
        LIMIT 1;

        IF FOUND THEN
            IF v_result.is_invalidated THEN
                RAISE EXCEPTION 'RESULT_INVALIDATED: Run has been invalidated and cannot be finalized or replayed.'
                    USING ERRCODE = 'P0001';
            END IF;

            SELECT rp.telemetry
            INTO v_replay_telemetry
            FROM public.replays rp
            WHERE rp.test_result_id = v_result.id
            LIMIT 1;
            v_has_replay := FOUND;

            IF v_result.mode IS DISTINCT FROM p_mode
               OR v_result.duration IS DISTINCT FROM p_duration
               OR v_result.seed IS DISTINCT FROM p_seed
               OR (v_has_replay AND v_replay_telemetry IS DISTINCT FROM p_telemetry) THEN
                RAISE EXCEPTION 'CLIENT_RUN_ID_CONFLICT: Conflicting payload submitted for existing client_run_id.'
                    USING ERRCODE = 'P0001';
            END IF;

            v_deduplicated := TRUE;
        END IF;
    END IF;

    -- 3B. Telemetry signature check (recognizes valid matches and blocks replay of invalidated runs)
    IF NOT v_deduplicated AND p_deduplicate_by_signature THEN
        FOR v_candidate IN
            SELECT
                tr.id,
                tr.raw_wpm,
                tr.consistency,
                tr.error_count,
                tr.backspace_count,
                tr.is_invalidated,
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
            ORDER BY tr.is_invalidated ASC, tr.created_at DESC
            LIMIT 10
        LOOP
            IF (v_candidate.replay_id IS NOT NULL AND v_candidate.replay_telemetry = p_telemetry)
               OR (
                   v_candidate.replay_id IS NULL
                   AND v_candidate.created_at >= v_recovery_cutoff
                   AND v_candidate.raw_wpm = p_raw_wpm
                   AND v_candidate.consistency = p_consistency
                   AND v_candidate.error_count = p_error_count
                   AND v_candidate.backspace_count = p_backspace_count
               ) THEN
                IF v_candidate.is_invalidated THEN
                    v_matched_invalidated_sig := TRUE;
                ELSE
                    SELECT * INTO v_result FROM public.test_results WHERE id = v_candidate.id;
                    v_deduplicated := TRUE;
                    EXIT;
                END IF;
            END IF;
        END LOOP;

        IF NOT v_deduplicated AND v_matched_invalidated_sig THEN
            RAISE EXCEPTION 'RESULT_INVALIDATED: Run signature corresponds to an invalidated run and cannot be replayed.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    -- 3C. Atomic INSERT into test_results + concurrency-safe unique_violation handling
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

                IF v_result.is_invalidated THEN
                    RAISE EXCEPTION 'RESULT_INVALIDATED: Run has been invalidated and cannot be finalized or replayed.'
                        USING ERRCODE = 'P0001';
                END IF;

                SELECT rp.telemetry
                INTO v_replay_telemetry
                FROM public.replays rp
                WHERE rp.test_result_id = v_result.id
                LIMIT 1;
                v_has_replay := FOUND;

                IF v_result.mode IS DISTINCT FROM p_mode
                   OR v_result.duration IS DISTINCT FROM p_duration
                   OR v_result.seed IS DISTINCT FROM p_seed
                   OR (v_has_replay AND v_replay_telemetry IS DISTINCT FROM p_telemetry) THEN
                    RAISE EXCEPTION 'CLIENT_RUN_ID_CONFLICT: Conflicting payload submitted for existing client_run_id.'
                        USING ERRCODE = 'P0001';
                END IF;

                v_deduplicated := TRUE;
        END;
    END IF;

    -- 3D. Replay persistence / serialized partial-orphan recovery
    IF NOT v_deduplicated THEN
        INSERT INTO public.replays (test_result_id, telemetry)
        VALUES (v_result.id, p_telemetry)
        ON CONFLICT (test_result_id) DO NOTHING;
    ELSE
        PERFORM 1 FROM public.test_results WHERE id = v_result.id FOR UPDATE;

        SELECT rp.id
        INTO v_existing_replay_id
        FROM public.replays rp
        WHERE rp.test_result_id = v_result.id
        LIMIT 1;

        IF NOT FOUND THEN
            INSERT INTO public.replays (test_result_id, telemetry)
            VALUES (v_result.id, p_telemetry)
            ON CONFLICT (test_result_id) DO NOTHING
            RETURNING id INTO v_inserted_replay_id;

            IF v_inserted_replay_id IS NOT NULL THEN
                v_recovered_partial := TRUE;
            END IF;
        END IF;
    END IF;

    -- 3E. Compute prior Personal Best from valid non-invalidated runs excluding v_result.id
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

    -- 3F. Only brand-new persisted runs and recovered replay-less orphans qualify to advance streaks
    v_qualifies_for_streak := (NOT v_deduplicated) OR v_recovered_partial;

    IF NOT v_qualifies_for_streak THEN
        SELECT COALESCE(s.current_streak, 0)
        INTO v_current_streak
        FROM public.streaks s
        WHERE s.user_id = p_user_id;

        IF NOT FOUND THEN
            v_current_streak := 0;
        END IF;
    ELSE
        v_activity_date := CASE
            WHEN v_recovered_partial THEN COALESCE((timezone('utc'::text, v_result.created_at))::date, v_today)
            ELSE v_today
        END;

        SELECT *
        INTO v_streak_row
        FROM public.streaks s
        WHERE s.user_id = p_user_id
        FOR UPDATE;
        v_streak_exists := FOUND;

        IF NOT v_streak_exists THEN
            BEGIN
                INSERT INTO public.streaks (user_id, current_streak, longest_streak, last_active_date, updated_at)
                VALUES (p_user_id, 1, 1, v_activity_date, timezone('utc'::text, now()))
                RETURNING * INTO v_streak_row;
                v_current_streak := v_streak_row.current_streak;
            EXCEPTION
                WHEN unique_violation THEN
                    SELECT *
                    INTO v_streak_row
                    FROM public.streaks s
                    WHERE s.user_id = p_user_id
                    FOR UPDATE;
                    v_streak_exists := FOUND;
            END;
        END IF;

        IF v_streak_exists THEN
            IF COALESCE(v_streak_row.current_streak, 0) <= 0 OR v_streak_row.last_active_date IS NULL THEN
                v_current_streak := 1;
                v_longest_streak := GREATEST(1, COALESCE(v_streak_row.longest_streak, 0));
                UPDATE public.streaks
                SET current_streak = v_current_streak,
                    longest_streak = v_longest_streak,
                    last_active_date = CASE
                        WHEN v_streak_row.last_active_date IS NOT NULL
                             AND v_streak_row.last_active_date > v_activity_date
                        THEN v_streak_row.last_active_date
                        ELSE v_activity_date
                    END,
                    updated_at = timezone('utc'::text, now())
                WHERE user_id = p_user_id;
            ELSIF v_activity_date > v_streak_row.last_active_date THEN
                IF (v_activity_date - v_streak_row.last_active_date) = 1 THEN
                    v_current_streak := v_streak_row.current_streak + 1;
                ELSE
                    v_current_streak := 1;
                END IF;
                v_longest_streak := GREATEST(v_current_streak, COALESCE(v_streak_row.longest_streak, 0));
                UPDATE public.streaks
                SET current_streak = v_current_streak,
                    longest_streak = v_longest_streak,
                    last_active_date = v_activity_date,
                    updated_at = timezone('utc'::text, now())
                WHERE user_id = p_user_id;
            ELSE
                -- Same UTC day OR future last_active_date > v_activity_date: preserve streak and date untouched
                v_current_streak := v_streak_row.current_streak;
            END IF;
        END IF;

        -- 3G. Verified test count & idempotent achievement evaluation (qualifying events only)
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
                END IF;
            END IF;
        END LOOP;
    END IF;

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
