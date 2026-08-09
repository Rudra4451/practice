-- ================================================================
-- TyProX SPRINT 3 PRODUCTION DATABASE SCHEMA MIGRATION
-- ================================================================

-- 1. CREATOR PACKS TABLE
CREATE TABLE IF NOT EXISTS public.creator_packs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(30) DEFAULT 'english' NOT NULL,
    content TEXT NOT NULL,
    pack_version VARCHAR(20) DEFAULT '1.0.0' NOT NULL,
    status VARCHAR(20) DEFAULT 'published' NOT NULL,
    parent_resource_id UUID REFERENCES public.creator_packs(id) ON DELETE SET NULL,
    fork_count INTEGER DEFAULT 0 NOT NULL,
    rating_avg REAL DEFAULT 5.0 NOT NULL,
    download_count INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. CLUBS TABLE
CREATE TABLE IF NOT EXISTS public.clubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name VARCHAR(80) UNIQUE NOT NULL,
    description TEXT,
    category VARCHAR(30) DEFAULT 'developer' NOT NULL,
    member_count INTEGER DEFAULT 1 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. CLUB MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.club_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_club_member UNIQUE (club_id, user_id)
);

-- 4. ACTIVITY STREAM TABLE
CREATE TABLE IF NOT EXISTS public.activity_stream (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    actor_username VARCHAR(50) NOT NULL,
    target_entity_id UUID,
    summary TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.creator_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_stream ENABLE ROW LEVEL SECURITY;

-- 6. RLS POLICIES
DROP POLICY IF EXISTS "Creator packs are readable by everyone" ON public.creator_packs;
CREATE POLICY "Creator packs are readable by everyone"
    ON public.creator_packs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owners can update their own creator packs" ON public.creator_packs;
CREATE POLICY "Owners can update their own creator packs"
    ON public.creator_packs FOR ALL USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Clubs are readable by everyone" ON public.clubs;
CREATE POLICY "Clubs are readable by everyone"
    ON public.clubs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Club members are readable by everyone" ON public.club_members;
CREATE POLICY "Club members are readable by everyone"
    ON public.club_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "Activity stream is readable by everyone" ON public.activity_stream;
CREATE POLICY "Activity stream is readable by everyone"
    ON public.activity_stream FOR SELECT USING (true);

-- 7. INDEXES
CREATE INDEX IF NOT EXISTS idx_creator_packs_owner ON public.creator_packs(owner_id);
CREATE INDEX IF NOT EXISTS idx_clubs_name ON public.clubs(name);
CREATE INDEX IF NOT EXISTS idx_activity_stream_created ON public.activity_stream(created_at DESC);
