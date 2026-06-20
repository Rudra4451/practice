-- ================================================================
-- TyProX FULL DATABASE SCHEMA
-- ================================================================
-- HOW TO USE:
-- 1. Open Supabase Dashboard → SQL Editor → New Query
-- 2. Paste this ENTIRE file
-- 3. Click "Run"
-- 4. Verify: Go to Table Editor and confirm all tables appear
-- ================================================================

-- 1. ENABLE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. CREATE TABLES

-- PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(30) UNIQUE NOT NULL,
    display_name VARCHAR(50),
    avatar_url TEXT,
    theme VARCHAR(50) DEFAULT 'dark' NOT NULL,
    font_family VARCHAR(50) DEFAULT 'ibm-plex-mono' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT username_min_length CHECK (char_length(username) >= 3)
);

-- TEST RESULTS
CREATE TABLE IF NOT EXISTS public.test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    wpm REAL NOT NULL,
    raw_wpm REAL NOT NULL,
    accuracy REAL NOT NULL,
    consistency REAL NOT NULL,
    error_count INTEGER NOT NULL,
    backspace_count INTEGER NOT NULL,
    mode VARCHAR(20) NOT NULL,
    duration INTEGER NOT NULL,
    seed VARCHAR(64) NOT NULL,
    is_invalidated BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- REPLAYS
CREATE TABLE IF NOT EXISTS public.replays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_result_id UUID UNIQUE NOT NULL REFERENCES public.test_results(id) ON DELETE CASCADE,
    telemetry JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- STREAKS
CREATE TABLE IF NOT EXISTS public.streaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    current_streak INTEGER DEFAULT 0 NOT NULL,
    longest_streak INTEGER DEFAULT 0 NOT NULL,
    last_active_date DATE DEFAULT CURRENT_DATE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- DAILY CHALLENGES
CREATE TABLE IF NOT EXISTS public.daily_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_date DATE UNIQUE NOT NULL DEFAULT CURRENT_DATE,
    mode VARCHAR(20) NOT NULL,
    duration INTEGER NOT NULL,
    seed VARCHAR(64) NOT NULL,
    text_content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- CHALLENGE LINKS (LOBBIES)
CREATE TABLE IF NOT EXISTS public.challenge_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    creator_wpm REAL,
    creator_accuracy REAL,
    mode VARCHAR(20) NOT NULL,
    duration INTEGER NOT NULL,
    seed VARCHAR(64) NOT NULL,
    text_content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc'::text, now()) + interval '7 days') NOT NULL
);

-- USER CHALLENGE PROGRESS
CREATE TABLE IF NOT EXISTS public.user_challenge_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    challenge_id UUID NOT NULL REFERENCES public.daily_challenges(id) ON DELETE CASCADE,
    test_result_id UUID REFERENCES public.test_results(id) ON DELETE CASCADE,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_challenge UNIQUE (user_id, challenge_id)
);

-- ACHIEVEMENTS
CREATE TABLE IF NOT EXISTS public.achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255) NOT NULL,
    criteria JSONB NOT NULL,
    icon_path TEXT NOT NULL
);

-- USER ACHIEVEMENTS
CREATE TABLE IF NOT EXISTS public.user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_achievement UNIQUE (user_id, achievement_id)
);


-- ================================================================
-- 3. ENABLE ROW LEVEL SECURITY (RLS)
-- ================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_challenge_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;


-- ================================================================
-- 4. CREATE RLS POLICIES (DROP FIRST FOR IDEMPOTENCY)
-- ================================================================

-- Profiles
DROP POLICY IF EXISTS "Profiles are readable by everyone" ON public.profiles;
CREATE POLICY "Profiles are readable by everyone"
    ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own profiles" ON public.profiles;
CREATE POLICY "Users can update their own profiles"
    ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Test Results
DROP POLICY IF EXISTS "Test results are readable by everyone" ON public.test_results;
CREATE POLICY "Test results are readable by everyone"
    ON public.test_results FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users or server can insert results" ON public.test_results;
CREATE POLICY "Authenticated users or server can insert results"
    ON public.test_results FOR INSERT
    WITH CHECK ((auth.uid() = user_id) OR (user_id IS NULL AND auth.uid() IS NULL));

-- Replays
DROP POLICY IF EXISTS "Replays are readable by everyone" ON public.replays;
CREATE POLICY "Replays are readable by everyone"
    ON public.replays FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert replays (verified via API)" ON public.replays;
CREATE POLICY "Anyone can insert replays (verified via API)"
    ON public.replays FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.test_results
            WHERE id = test_result_id
              AND ((user_id = auth.uid()) OR (user_id IS NULL AND auth.uid() IS NULL))
        )
    );

-- Streaks
DROP POLICY IF EXISTS "Streaks are readable by everyone" ON public.streaks;
CREATE POLICY "Streaks are readable by everyone"
    ON public.streaks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own streaks" ON public.streaks;
CREATE POLICY "Users can update their own streaks"
    ON public.streaks FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Trigger can insert streaks" ON public.streaks;
CREATE POLICY "Trigger can insert streaks"
    ON public.streaks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Daily Challenges
DROP POLICY IF EXISTS "Daily challenges are readable by everyone" ON public.daily_challenges;
CREATE POLICY "Daily challenges are readable by everyone"
    ON public.daily_challenges FOR SELECT USING (true);

-- Challenge Links
DROP POLICY IF EXISTS "Challenge links are readable by everyone" ON public.challenge_links;
CREATE POLICY "Challenge links are readable by everyone"
    ON public.challenge_links FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create challenge links" ON public.challenge_links;
CREATE POLICY "Authenticated users can create challenge links"
    ON public.challenge_links FOR INSERT
    WITH CHECK ((creator_id = auth.uid()) OR (creator_id IS NULL AND auth.uid() IS NULL));

-- Challenge Progress
DROP POLICY IF EXISTS "Challenge progress is readable by everyone" ON public.user_challenge_progress;
CREATE POLICY "Challenge progress is readable by everyone"
    ON public.user_challenge_progress FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can log their own challenge progress" ON public.user_challenge_progress;
CREATE POLICY "Users can log their own challenge progress"
    ON public.user_challenge_progress FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Achievements & User Achievements
DROP POLICY IF EXISTS "Achievements are readable by everyone" ON public.achievements;
CREATE POLICY "Achievements are readable by everyone"
    ON public.achievements FOR SELECT USING (true);

DROP POLICY IF EXISTS "User achievements are readable by everyone" ON public.user_achievements;
CREATE POLICY "User achievements are readable by everyone"
    ON public.user_achievements FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own achievements" ON public.user_achievements;
CREATE POLICY "Users can insert their own achievements"
    ON public.user_achievements FOR INSERT
    WITH CHECK (auth.uid() = user_id);


-- ================================================================
-- 5. CREATE INDEXES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_test_results_created_at_desc ON public.test_results(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_results_leaderboard ON public.test_results(mode, duration, is_invalidated, wpm DESC);
CREATE INDEX IF NOT EXISTS idx_challenge_links_created_at_desc ON public.challenge_links(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_challenges_date_desc ON public.daily_challenges(challenge_date DESC);
CREATE INDEX IF NOT EXISTS idx_replays_test_id ON public.replays(test_result_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username_trgm ON public.profiles USING gin (username gin_trgm_ops);


-- ================================================================
-- 6. AUTO-CREATE PROFILE ON SIGN-UP (TRIGGER)
-- ================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substring(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- Automatically generate streak tracker row
  INSERT INTO public.streaks (user_id) VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to auth.users table (drop first for safety)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ================================================================
-- 7. SEED ACHIEVEMENTS
-- ================================================================

INSERT INTO public.achievements (code, name, description, criteria, icon_path) VALUES
  ('SPEED_50', 'Keyboard Apprentice', 'Reach 50 WPM with at least 90% accuracy', '{"type": "speed", "wpm": 50, "accuracy": 90}', '/achievements/speed_50.svg'),
  ('SPEED_75', 'Swift Fingers', 'Reach 75 WPM with at least 93% accuracy', '{"type": "speed", "wpm": 75, "accuracy": 93}', '/achievements/speed_75.svg'),
  ('SPEED_100', 'Speed Demon', 'Reach 100 WPM with at least 95% accuracy', '{"type": "speed", "wpm": 100, "accuracy": 95}', '/achievements/speed_100.svg'),
  ('SPEED_120', 'Typing Master', 'Reach 120 WPM with at least 96% accuracy', '{"type": "speed", "wpm": 120, "accuracy": 96}', '/achievements/speed_120.svg'),
  ('SPEED_140', 'Grandmaster Typist', 'Reach 140 WPM with at least 97% accuracy', '{"type": "speed", "wpm": 140, "accuracy": 97}', '/achievements/speed_140.svg'),
  ('STREAK_3', 'Warming Up', 'Maintain a 3-day typing streak', '{"type": "streak", "days": 3}', '/achievements/streak_3.svg'),
  ('STREAK_7', 'Daily Warrior', 'Maintain a 7-day typing streak', '{"type": "streak", "days": 7}', '/achievements/streak_7.svg'),
  ('STREAK_30', 'Monthly Champion', 'Maintain a 30-day typing streak', '{"type": "streak", "days": 30}', '/achievements/streak_30.svg')
ON CONFLICT (code) DO NOTHING;


-- ================================================================
-- 8. GRANT API PRIVILEGES
-- ================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;


-- ================================================================
-- 9. ENABLE SUPABASE REALTIME FOR TEST_RESULTS
-- ================================================================

do $$
begin
  if not exists (
    select 1 
    from pg_publication_tables 
    where pubname = 'supabase_realtime' 
      and schemaname = 'public' 
      and tablename = 'test_results'
  ) then
    alter publication supabase_realtime add table public.test_results;
  end if;
end $$;


-- ================================================================
-- 10. CREATE LEADERBOARD VIEW (Highest WPM run per user, mode, and duration)
-- ================================================================

CREATE OR REPLACE VIEW public.leaderboard_view AS
SELECT DISTINCT ON (user_id, mode, duration)
  id,
  user_id,
  wpm,
  accuracy,
  consistency,
  mode,
  duration,
  is_invalidated,
  created_at
FROM public.test_results
WHERE is_invalidated = false
ORDER BY user_id, mode, duration, wpm DESC;

GRANT SELECT ON public.leaderboard_view TO anon, authenticated, service_role;


-- ================================================================
-- DONE. Verify by checking Table Editor in Supabase Dashboard.
-- All tables/views should now appear: profiles, test_results, replays,
-- streaks, daily_challenges, challenge_links, user_challenge_progress,
-- achievements, user_achievements, leaderboard_view.
-- ================================================================
