-- Hardening of Supabase RLS Policies for TyProX Beta

-- 1. HARDEN TEST RESULTS INSERT POLICY
DROP POLICY IF EXISTS "Authenticated users or server can insert results" ON public.test_results;
CREATE POLICY "Authenticated users or server can insert results" 
    ON public.test_results FOR INSERT 
    WITH CHECK ((auth.uid() = user_id) OR (user_id IS NULL AND auth.uid() IS NULL));

-- 2. HARDEN REPLAYS INSERT POLICY
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

-- 3. HARDEN CHALLENGE LINKS INSERT POLICY
DROP POLICY IF EXISTS "Anyone can insert challenge links" ON public.challenge_links;
CREATE POLICY "Anyone can insert challenge links" 
    ON public.challenge_links FOR INSERT 
    WITH CHECK ((creator_id = auth.uid()) OR (creator_id IS NULL AND auth.uid() IS NULL));

-- 4. ENABLE INSERT FOR USER ACHIEVEMENTS
DROP POLICY IF EXISTS "Users can insert their own achievements" ON public.user_achievements;
CREATE POLICY "Users can insert their own achievements" 
    ON public.user_achievements FOR INSERT 
    WITH CHECK (auth.uid() = user_id);
