-- ================================================================
-- TyProX 2.0 Security Hardening & Schema Reconciliation Migration
-- Status: PREPARED ONLY (DO NOT EXECUTE WITHOUT PRODUCTION INSPECTION
--         AND SUPABASE_SERVICE_ROLE_KEY PROVISIONED IN ENVIRONMENT)
-- ================================================================

-- 1. ADD IDEMPOTENCY & VERIFICATION METADATA COLUMNS SAFELY
ALTER TABLE public.test_results
    ADD COLUMN IF NOT EXISTS client_run_id UUID,
    ADD COLUMN IF NOT EXISTS generator_version SMALLINT DEFAULT 1 NOT NULL,
    ADD COLUMN IF NOT EXISTS is_ranked BOOLEAN DEFAULT TRUE NOT NULL;

ALTER TABLE public.test_results
    DROP CONSTRAINT IF EXISTS test_results_client_run_id_key;

ALTER TABLE public.streaks
    ALTER COLUMN last_active_date DROP DEFAULT,
    ALTER COLUMN last_active_date DROP NOT NULL;

ALTER TABLE public.profiles
    ALTER COLUMN font_family SET DEFAULT 'jetbrains-mono';

-- 2. INDEXES FOR VERIFIED LEADERBOARDS, SCOPED IDEMPOTENCY & BOUNDED USER QUERIES
DROP INDEX IF EXISTS public.test_results_client_run_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_test_results_user_client_run_id
    ON public.test_results(user_id, client_run_id)
    WHERE user_id IS NOT NULL AND client_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_test_results_created_at_desc
    ON public.test_results(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_test_results_leaderboard
    ON public.test_results(mode, duration, is_invalidated, wpm DESC)
    WHERE user_id IS NOT NULL AND is_invalidated = FALSE;

-- 3. LEAST-PRIVILEGE SCHEMA & TABLE GRANTS
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON
    public.profiles,
    public.test_results,
    public.replays,
    public.streaks,
    public.daily_challenges,
    public.challenge_links,
    public.user_challenge_progress,
    public.achievements,
    public.user_achievements
TO anon, authenticated;

GRANT UPDATE (display_name, avatar_url, theme, font_family, username, updated_at)
    ON public.profiles TO authenticated;

-- 4. DROP PERMISSIVE CLIENT WRITE RLS POLICIES
DROP POLICY IF EXISTS "Authenticated users or server can insert results" ON public.test_results;
DROP POLICY IF EXISTS "Test results are readable by everyone" ON public.test_results;

CREATE POLICY "Verified public or own test results readable"
    ON public.test_results FOR SELECT
    USING ((is_invalidated = FALSE AND user_id IS NOT NULL) OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can insert replays (verified via API)" ON public.replays;
DROP POLICY IF EXISTS "Replays are readable by everyone" ON public.replays;

CREATE POLICY "Users can read their own replays"
    ON public.replays FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.test_results tr
            WHERE tr.id = test_result_id
              AND tr.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update their own streaks" ON public.streaks;
DROP POLICY IF EXISTS "Trigger can insert streaks" ON public.streaks;

DROP POLICY IF EXISTS "Anyone can insert challenge links" ON public.challenge_links;
DROP POLICY IF EXISTS "Authenticated users can create challenge links" ON public.challenge_links;
DROP POLICY IF EXISTS "Challenge links are readable by everyone" ON public.challenge_links;

CREATE POLICY "Non-expired challenge links are readable"
    ON public.challenge_links FOR SELECT
    USING (expires_at > timezone('utc'::text, now()));

DROP POLICY IF EXISTS "Users can log their own challenge progress" ON public.user_challenge_progress;
DROP POLICY IF EXISTS "Users can insert their own achievements" ON public.user_achievements;

DROP POLICY IF EXISTS "Users can update their own profiles" ON public.profiles;
CREATE POLICY "Users can update their own profiles safely"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id
        AND username ~ '^[a-z0-9_]{3,24}$'
    );

-- 5. HARDENED LEADERBOARD VIEW (SECURITY INVOKER + NON-NULL USERS)
DROP VIEW IF EXISTS public.leaderboard_view;
CREATE OR REPLACE VIEW public.leaderboard_view
WITH (security_invoker = true) AS
SELECT DISTINCT ON (tr.user_id, tr.mode, tr.duration)
    tr.id,
    tr.user_id,
    tr.wpm,
    tr.accuracy,
    tr.consistency,
    tr.mode,
    tr.duration,
    tr.is_invalidated,
    tr.created_at,
    p.username,
    p.display_name,
    p.avatar_url
FROM public.test_results tr
JOIN public.profiles p ON p.id = tr.user_id
WHERE tr.is_invalidated = FALSE
  AND tr.user_id IS NOT NULL
  AND tr.is_ranked = TRUE
ORDER BY tr.user_id, tr.mode, tr.duration, tr.wpm DESC, tr.accuracy DESC, tr.created_at ASC;

GRANT SELECT ON public.leaderboard_view TO anon, authenticated, service_role;

-- 6. HARDENED HANDLE_NEW_USER TRIGGER (SAFE SEARCH PATH + COLLISION HANDLING)
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
    display_val TEXT;
BEGIN
    fallback_suffix := substring(replace(NEW.id::text, '-', ''), 1, 8);
    raw_handle := COALESCE(
        NEW.raw_user_meta_data->>'username',
        NEW.raw_user_meta_data->>'user_name',
        NEW.raw_user_meta_data->>'preferred_username',
        'user_' || fallback_suffix
    );

    clean_handle := regexp_replace(lower(trim(raw_handle)), '[^a-z0-9_]', '', 'g');
    IF char_length(clean_handle) < 3 THEN
        clean_handle := 'user_' || fallback_suffix;
    END IF;
    candidate_handle := substring(clean_handle, 1, 24);

    IF EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate_handle) THEN
        candidate_handle := substring(clean_handle, 1, 18) || '_' || substring(fallback_suffix, 1, 5);
    END IF;

    display_val := COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''),
        NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
        candidate_handle
    );

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

    INSERT INTO public.streaks (user_id, current_streak, longest_streak, last_active_date)
    VALUES (NEW.id, 0, 0, NULL)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- 7. NON-DESTRUCTIVE ACHIEVEMENTS (ALL 11 CATALOG CODES) & REALTIME RECONCILIATION
INSERT INTO public.achievements (code, name, description, criteria, icon_path) VALUES
  ('SPEED_50', 'Bronze Fingers', 'Reach 50 WPM with at least 90% accuracy', '{"type": "speed", "wpm": 50, "accuracy": 90}', '/achievements/speed_50.svg'),
  ('SPEED_75', 'Swift Fingers', 'Reach 75 WPM with at least 93% accuracy', '{"type": "speed", "wpm": 75, "accuracy": 93}', '/achievements/speed_75.svg'),
  ('SPEED_80', 'Silver Fingers', 'Reach 80 WPM with at least 92% accuracy', '{"type": "speed", "wpm": 80, "accuracy": 92}', '/achievements/speed_80.svg'),
  ('SPEED_100', 'Gold Fingers', 'Reach 100 WPM with at least 95% accuracy', '{"type": "speed", "wpm": 100, "accuracy": 95}', '/achievements/speed_100.svg'),
  ('SPEED_120', 'Platinum Fingers', 'Reach 120 WPM with at least 96% accuracy', '{"type": "speed", "wpm": 120, "accuracy": 96}', '/achievements/speed_120.svg'),
  ('SPEED_140', 'Grandmaster Typist', 'Reach 140 WPM with at least 97% accuracy', '{"type": "speed", "wpm": 140, "accuracy": 97}', '/achievements/speed_140.svg'),
  ('SPEED_150', 'Fingers of Fire', 'Reach 150 WPM with at least 97% accuracy', '{"type": "speed", "wpm": 150, "accuracy": 97}', '/achievements/speed_150.svg'),
  ('STREAK_3', 'Consistency Start', 'Maintain a 3-day typing streak', '{"type": "streak", "days": 3}', '/achievements/streak_3.svg'),
  ('STREAK_7', 'Weekly Habit', 'Maintain a 7-day typing streak', '{"type": "streak", "days": 7}', '/achievements/streak_7.svg'),
  ('STREAK_14', 'Fortnight Dedication', 'Maintain a 14-day typing streak', '{"type": "streak", "days": 14}', '/achievements/streak_14.svg'),
  ('STREAK_30', 'Typing Legend', 'Maintain a 30-day typing streak', '{"type": "streak", "days": 30}', '/achievements/streak_30.svg')
ON CONFLICT (code) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'test_results'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.test_results;
  END IF;
END $$;

