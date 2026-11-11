-- ================================================================
-- TyProX 2.0 Learning & Competitive Ecosystem Migration
-- Status: PREPARED ONLY (APPLY AFTER 20260621000000_typrox_2_hardening.sql)
-- ================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- 1. USER PROGRESSION (XP, LEVELS & MASTERY SUMMARY)
CREATE TABLE IF NOT EXISTS public.user_progression (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    total_xp INTEGER DEFAULT 0 NOT NULL,
    level INTEGER DEFAULT 1 NOT NULL,
    lessons_completed INTEGER DEFAULT 0 NOT NULL,
    daily_completed_count INTEGER DEFAULT 0 NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. CURRICULUM LESSON PROGRESS
CREATE TABLE IF NOT EXISTS public.user_lesson_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    lesson_slug VARCHAR(80) NOT NULL,
    best_wpm REAL DEFAULT 0 NOT NULL,
    best_accuracy REAL DEFAULT 0 NOT NULL,
    stars SMALLINT DEFAULT 0 NOT NULL CHECK (stars >= 0 AND stars <= 3),
    completed BOOLEAN DEFAULT FALSE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_lesson UNIQUE (user_id, lesson_slug)
);

-- 3. CHALLENGE ATTEMPTS (1v1 PERSISTED OUTCOMES)
CREATE TABLE IF NOT EXISTS public.challenge_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES public.challenge_links(id) ON DELETE CASCADE,
    challenger_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    test_result_id UUID REFERENCES public.test_results(id) ON DELETE SET NULL,
    wpm REAL NOT NULL,
    accuracy REAL NOT NULL,
    won BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. ENABLE RLS & SELECT-ONLY CLIENT POLICIES (WRITES VIA SERVICE_ROLE)
ALTER TABLE public.user_progression ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON
    public.user_progression,
    public.user_lesson_progress,
    public.challenge_attempts
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON
    public.user_progression,
    public.user_lesson_progress,
    public.challenge_attempts
TO anon, authenticated;

DROP POLICY IF EXISTS "User progression readable by everyone" ON public.user_progression;
CREATE POLICY "User progression readable by everyone"
    ON public.user_progression FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can read own lesson progress" ON public.user_lesson_progress;
CREATE POLICY "Users can read own lesson progress"
    ON public.user_lesson_progress FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Challenge attempts readable by participants or public" ON public.challenge_attempts;
DROP POLICY IF EXISTS "Active challenge attempts are readable" ON public.challenge_attempts;
CREATE POLICY "Active challenge attempts are readable"
    ON public.challenge_attempts FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.challenge_links cl
            WHERE cl.id = challenge_id
              AND cl.expires_at > timezone('utc'::text, now())
        )
    );

CREATE INDEX IF NOT EXISTS idx_lesson_progress_user
    ON public.user_lesson_progress(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_challenge_attempts_challenge
    ON public.challenge_attempts(challenge_id, created_at DESC);

COMMIT;
