-- 1. ENABLE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. CREATE TABLES

-- PROFILES
CREATE TABLE public.profiles (
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
CREATE TABLE public.test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    wpm REAL NOT NULL,
    raw_wpm REAL NOT NULL,
    accuracy REAL NOT NULL,
    consistency REAL NOT NULL,
    error_count INTEGER NOT NULL,
    backspace_count INTEGER NOT NULL,
    mode VARCHAR(20) NOT NULL, -- 'words', 'quotes', 'numbers', 'punctuation', 'code'
    duration INTEGER NOT NULL, -- seconds
    seed VARCHAR(64) NOT NULL,
    is_invalidated BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- REPLAYS
CREATE TABLE public.replays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_result_id UUID UNIQUE NOT NULL REFERENCES public.test_results(id) ON DELETE CASCADE,
    telemetry JSONB NOT NULL, -- Array of [[delta_ms, key_code, type, caret]]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- STREAKS
CREATE TABLE public.streaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    current_streak INTEGER DEFAULT 0 NOT NULL,
    longest_streak INTEGER DEFAULT 0 NOT NULL,
    last_active_date DATE DEFAULT CURRENT_DATE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- DAILY CHALLENGES
CREATE TABLE public.daily_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_date DATE UNIQUE NOT NULL DEFAULT CURRENT_DATE,
    mode VARCHAR(20) NOT NULL,
    duration INTEGER NOT NULL,
    seed VARCHAR(64) NOT NULL,
    text_content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- CHALLENGE LINKS (LOBBIES)
CREATE TABLE public.challenge_links (
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
CREATE TABLE public.user_challenge_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    challenge_id UUID NOT NULL REFERENCES public.daily_challenges(id) ON DELETE CASCADE,
    test_result_id UUID REFERENCES public.test_results(id) ON DELETE CASCADE,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_challenge UNIQUE (user_id, challenge_id)
);

-- ACHIEVEMENTS
CREATE TABLE public.achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL, -- e.g. 'SPEED_50', 'STREAK_7'
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255) NOT NULL,
    criteria JSONB NOT NULL,
    icon_path TEXT NOT NULL
);

-- USER ACHIEVEMENTS
CREATE TABLE public.user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_achievement UNIQUE (user_id, achievement_id)
);

-- 3. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_challenge_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- 4. CREATE RLS POLICIES

-- Profiles
CREATE POLICY "Profiles are readable by everyone" 
    ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profiles" 
    ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profiles" 
    ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Test Results
CREATE POLICY "Test results are readable by everyone" 
    ON public.test_results FOR SELECT USING (true);
CREATE POLICY "Authenticated users or server can insert results" 
    ON public.test_results FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

-- Replays
CREATE POLICY "Replays are readable by everyone" 
    ON public.replays FOR SELECT USING (true);
CREATE POLICY "Anyone can insert replays (verified via API)" 
    ON public.replays FOR INSERT WITH CHECK (true);

-- Streaks
CREATE POLICY "Streaks are readable by everyone" 
    ON public.streaks FOR SELECT USING (true);
CREATE POLICY "Users can update their own streaks" 
    ON public.streaks FOR UPDATE USING (auth.uid() = user_id);

-- Daily Challenges
CREATE POLICY "Daily challenges are readable by everyone" 
    ON public.daily_challenges FOR SELECT USING (true);

-- Challenge Links
CREATE POLICY "Challenge links are readable by everyone" 
    ON public.challenge_links FOR SELECT USING (true);
CREATE POLICY "Anyone can insert challenge links" 
    ON public.challenge_links FOR INSERT WITH CHECK (true);

-- Challenge Progress
CREATE POLICY "Challenge progress is readable by everyone" 
    ON public.user_challenge_progress FOR SELECT USING (true);
CREATE POLICY "Users can log their own challenge progress" 
    ON public.user_challenge_progress FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Achievements & User Achievements
CREATE POLICY "Achievements are readable by everyone" 
    ON public.achievements FOR SELECT USING (true);
CREATE POLICY "User achievements are readable by everyone" 
    ON public.user_achievements FOR SELECT USING (true);

-- 5. CREATE INDEXES FOR OPTIMIZED LOADING (created_at DESC / UI lookups)
CREATE INDEX idx_test_results_created_at_desc ON public.test_results(user_id, created_at DESC);
CREATE INDEX idx_challenge_links_created_at_desc ON public.challenge_links(created_at DESC);
CREATE INDEX idx_daily_challenges_date_desc ON public.daily_challenges(challenge_date DESC);
CREATE INDEX idx_replays_test_id ON public.replays(test_result_id);
CREATE INDEX idx_profiles_username_trgm ON public.profiles USING gin (username gin_trgm_ops);

-- 6. AUTOMATED NEW USER PROFILE SYNC TRIGGER
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

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
