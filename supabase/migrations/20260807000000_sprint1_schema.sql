-- ================================================================
-- TyProX SPRINT 1 PRODUCTION DATABASE SCHEMA MIGRATION
-- ================================================================

-- 1. ENABLE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. SESSIONS METADATA TABLE
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    last_workspace VARCHAR(100) DEFAULT 'default' NOT NULL,
    active_mode VARCHAR(20) DEFAULT 'words' NOT NULL,
    active_duration INTEGER DEFAULT 30 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TYPING DNA HEATMAP TABLE
CREATE TABLE IF NOT EXISTS public.typing_dna (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    alphabet_speeds JSONB NOT NULL DEFAULT '{}'::jsonb,
    bigram_speeds JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_frequencies JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. USER SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    theme VARCHAR(50) DEFAULT 'dark' NOT NULL,
    font_family VARCHAR(50) DEFAULT 'ibm-plex-mono' NOT NULL,
    volume REAL DEFAULT 0.5 NOT NULL,
    caret_style VARCHAR(20) DEFAULT 'line' NOT NULL,
    smooth_caret BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.typing_dna ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 6. RLS POLICIES
DROP POLICY IF EXISTS "Users can read their own sessions" ON public.sessions;
CREATE POLICY "Users can read their own sessions"
    ON public.sessions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert/update their own sessions" ON public.sessions;
CREATE POLICY "Users can insert/update their own sessions"
    ON public.sessions FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Typing DNA is readable by everyone" ON public.typing_dna;
CREATE POLICY "Typing DNA is readable by everyone"
    ON public.typing_dna FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own typing DNA" ON public.typing_dna;
CREATE POLICY "Users can update their own typing DNA"
    ON public.typing_dna FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Settings are readable by owners" ON public.settings;
CREATE POLICY "Settings are readable by owners"
    ON public.settings FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own settings" ON public.settings;
CREATE POLICY "Users can update their own settings"
    ON public.settings FOR ALL USING (auth.uid() = user_id);

-- 7. INDEXES
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_typing_dna_user ON public.typing_dna(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_user ON public.settings(user_id);
