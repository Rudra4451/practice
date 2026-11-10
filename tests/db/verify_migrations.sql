-- ============================================================================
-- Real PostgreSQL 16 Verification Suite for TyProX Migrations (20260618..20260624)
-- ============================================================================
-- Executes across isolated transactions under explicit database roles:
--   * postgres (catalog metadata & test fixture/cleanup only; NEVER security views/RLS proofs)
--   * anon (strictly zero JWT subject, verified auth.uid() IS NULL)
--   * authenticated (verified per-user auth.uid(), column/table privileges & RLS)
--   * service_role (verified privileged RPCs & username onboarding path)
-- Fails immediately (\set ON_ERROR_STOP on) on any violated security or data invariant.
-- ============================================================================

\set ON_ERROR_STOP on

-- ============================================================================
-- TX 1: CATALOG INVARIANTS (ROLES, POLICIES, GRANTS, FUNCTIONS, VIEWS, INDEXES)
-- ============================================================================
BEGIN;
DO $$
DECLARE
  v_bad_count INTEGER;
  v_priv_cols TEXT[];
  v_view_cols TEXT[];
  v_view_def TEXT;
  v_sec_invoker BOOLEAN;
  v_prosecdef BOOLEAN;
  v_proconfig TEXT[];
  v_proc_oid OID;
BEGIN
  -- 1A. Ensure simulated client roles & service_role exist with least-privilege / intended flags
  SELECT COUNT(*) INTO v_bad_count
  FROM pg_roles
  WHERE rolname IN ('anon', 'authenticated')
    AND NOT rolsuper
    AND NOT rolbypassrls
    AND NOT rolcanlogin
    AND NOT rolinherit;
  IF v_bad_count <> 2 THEN
    RAISE EXCEPTION 'anon and authenticated must be non-superuser, NOLOGIN, NOINHERIT, non-BYPASSRLS roles (valid=%)', v_bad_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'service_role' AND rolbypassrls AND NOT rolcanlogin AND NOT rolinherit
  ) THEN
    RAISE EXCEPTION 'service_role must exist with NOLOGIN, NOINHERIT, BYPASSRLS';
  END IF;

  -- Assert all 12 public tables exist with RLS enabled
  SELECT COUNT(*) INTO v_bad_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND rowsecurity = TRUE
    AND tablename IN (
      'profiles', 'test_results', 'replays', 'streaks', 'daily_challenges',
      'challenge_links', 'user_challenge_progress', 'achievements', 'user_achievements',
      'user_progression', 'user_lesson_progress', 'challenge_attempts'
    );
  IF v_bad_count <> 12 THEN
    RAISE EXCEPTION 'Expected all 12 public tables to have RLS enabled, got %', v_bad_count;
  END IF;

  -- 1B. Assert legacy permissive/obsolete RLS policies were dropped (pg_policies)
  SELECT COUNT(*) INTO v_bad_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      (tablename = 'test_results' AND policyname IN ('Authenticated users or server can insert results', 'Test results are readable by everyone'))
      OR (tablename = 'replays' AND policyname IN ('Anyone can insert replays (verified via API)', 'Replays are readable by everyone'))
      OR (tablename = 'streaks' AND policyname IN ('Users can update their own streaks', 'Trigger can insert streaks'))
      OR (tablename = 'challenge_links' AND policyname IN ('Anyone can insert challenge links', 'Authenticated users can create challenge links', 'Challenge links are readable by everyone'))
      OR (tablename = 'user_challenge_progress' AND policyname = 'Users can log their own challenge progress')
      OR (tablename = 'user_achievements' AND policyname = 'Users can insert their own achievements')
      OR (tablename = 'profiles' AND policyname = 'Users can update their own profiles')
    );
  IF v_bad_count <> 0 THEN
    RAISE EXCEPTION 'Found % obsolete permissive RLS policy/policies still active in pg_policies', v_bad_count;
  END IF;

  -- Assert NO non-SELECT policy exists outside public.profiles
  SELECT COUNT(*) INTO v_bad_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename <> 'profiles'
    AND cmd <> 'SELECT';
  IF v_bad_count <> 0 THEN
    RAISE EXCEPTION 'Expected zero client DML policies outside public.profiles, found %', v_bad_count;
  END IF;

  -- Assert profiles UPDATE policy strictly checks auth.uid() = id (not old username regex workaround)
  SELECT COUNT(*) INTO v_bad_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND cmd = 'UPDATE'
    AND policyname = 'Users can update their own profiles safely'
    AND position('auth.uid() = id' IN COALESCE(qual, '')) > 0
    AND position('auth.uid() = id' IN COALESCE(with_check, '')) > 0
    AND position('username' IN COALESCE(with_check, '')) = 0;
  IF v_bad_count <> 1 THEN
    RAISE EXCEPTION 'Expected hardened profiles UPDATE policy in pg_policies (match count=%)', v_bad_count;
  END IF;

  -- Assert required privacy policies exist in pg_policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='test_results' AND cmd='SELECT' AND policyname='Verified public or own test results readable') THEN
    RAISE EXCEPTION 'Missing hardened SELECT policy on public.test_results';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='replays' AND cmd='SELECT' AND policyname='Users can read their own replays') THEN
    RAISE EXCEPTION 'Missing owner-only SELECT policy on public.replays';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='challenge_links' AND cmd='SELECT' AND policyname='Non-expired challenge links are readable') THEN
    RAISE EXCEPTION 'Missing expiry SELECT policy on public.challenge_links';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_lesson_progress' AND cmd='SELECT' AND policyname='Users can read own lesson progress') THEN
    RAISE EXCEPTION 'Missing owner-only SELECT policy on public.user_lesson_progress';
  END IF;

  -- 1C. Assert table & column grants (anon: SELECT only; authenticated: SELECT + narrow profiles UPDATE without username)
  SELECT COUNT(*) INTO v_bad_count
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND grantee = 'anon'
    AND privilege_type <> 'SELECT';
  IF v_bad_count <> 0 THEN
    RAISE EXCEPTION 'anon must hold ONLY SELECT privileges in schema public (found % non-SELECT grants)', v_bad_count;
  END IF;

  SELECT COUNT(*) INTO v_bad_count
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND grantee = 'authenticated'
    AND privilege_type <> 'SELECT'
    AND NOT (table_name = 'profiles' AND privilege_type = 'UPDATE');
  IF v_bad_count <> 0 THEN
    RAISE EXCEPTION 'authenticated holds disallowed table grants in schema public (count=%)', v_bad_count;
  END IF;

  SELECT ARRAY_AGG(column_name::text ORDER BY column_name::text)
  INTO v_priv_cols
  FROM information_schema.column_privileges
  WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND grantee = 'authenticated'
    AND privilege_type = 'UPDATE';
  IF v_priv_cols IS DISTINCT FROM ARRAY['avatar_url', 'display_name', 'font_family', 'theme', 'updated_at'] THEN
    RAISE EXCEPTION 'authenticated UPDATE columns on public.profiles drifted: %', v_priv_cols;
  END IF;

  -- 1D. Assert SECURITY DEFINER search_path & EXECUTE lockdowns
  SELECT p.oid, p.prosecdef, p.proconfig
  INTO v_proc_oid, v_prosecdef, v_proconfig
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'submit_verified_result';
  IF v_proc_oid IS NULL OR NOT v_prosecdef OR NOT ('search_path=public' = ANY(COALESCE(v_proconfig, ARRAY[]::text[]))) THEN
    RAISE EXCEPTION 'submit_verified_result must be SECURITY DEFINER SET search_path = public';
  END IF;
  IF has_function_privilege('anon', v_proc_oid, 'EXECUTE')
     OR has_function_privilege('authenticated', v_proc_oid, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_proc_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'submit_verified_result EXECUTE privileges violated (anon/auth must be denied, service_role allowed)';
  END IF;

  SELECT p.oid, p.prosecdef, p.proconfig
  INTO v_proc_oid, v_prosecdef, v_proconfig
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'handle_new_user';
  IF v_proc_oid IS NULL OR NOT v_prosecdef OR NOT ('search_path=public' = ANY(COALESCE(v_proconfig, ARRAY[]::text[]))) THEN
    RAISE EXCEPTION 'handle_new_user must be SECURITY DEFINER SET search_path = public';
  END IF;
  IF has_function_privilege('anon', v_proc_oid, 'EXECUTE')
     OR has_function_privilege('authenticated', v_proc_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'handle_new_user EXECUTE must be revoked from anon/authenticated';
  END IF;

  SELECT p.oid INTO v_proc_oid
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'enforce_profile_username_integrity';
  IF has_function_privilege('anon', v_proc_oid, 'EXECUTE')
     OR has_function_privilege('authenticated', v_proc_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'enforce_profile_username_integrity EXECUTE must be revoked from anon/authenticated';
  END IF;

  -- 1E. Assert leaderboard_view uses security_invoker = true, grants SELECT, filters private/unranked/invalidated, exposes only public columns
  SELECT COALESCE(bool_or(opt = 'security_invoker=true'), FALSE)
  INTO v_sec_invoker
  FROM pg_class c
  CROSS JOIN LATERAL unnest(COALESCE(c.reloptions, ARRAY[]::text[])) AS opt
  WHERE c.relname = 'leaderboard_view' AND c.relnamespace = 'public'::regnamespace AND c.relkind = 'v';
  IF NOT v_sec_invoker THEN
    RAISE EXCEPTION 'leaderboard_view must specify security_invoker = true';
  END IF;

  IF NOT has_table_privilege('anon', 'public.leaderboard_view', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.leaderboard_view', 'SELECT') THEN
    RAISE EXCEPTION 'anon and authenticated must retain SELECT on leaderboard_view';
  END IF;

  v_view_def := lower(pg_get_viewdef('public.leaderboard_view'::regclass, true));
  IF position('is_invalidated' IN v_view_def) = 0
     OR position('user_id' IN v_view_def) = 0
     OR position('is_ranked' IN v_view_def) = 0 THEN
    RAISE EXCEPTION 'leaderboard_view definition missing mandatory filters: %', v_view_def;
  END IF;

  SELECT ARRAY_AGG(column_name::text ORDER BY ordinal_position)
  INTO v_view_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'leaderboard_view';
  IF v_view_cols IS DISTINCT FROM ARRAY[
    'id', 'user_id', 'wpm', 'accuracy', 'consistency', 'mode', 'duration',
    'is_invalidated', 'created_at', 'username', 'display_name', 'avatar_url'
  ] THEN
    RAISE EXCEPTION 'leaderboard_view exposed unexpected column set: %', v_view_cols;
  END IF;

  -- 1F. Assert indexes, achievements & realtime publication
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'test_results_client_run_id_key'
  ) THEN
    RAISE EXCEPTION 'Legacy unscoped index/constraint test_results_client_run_id_key must be dropped';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class ic
    JOIN pg_index ix ON ix.indexrelid = ic.oid
    JOIN pg_namespace n ON n.oid = ic.relnamespace
    WHERE n.nspname = 'public'
      AND ic.relname = 'idx_test_results_user_client_run_id'
      AND ix.indisunique = TRUE
      AND ix.indpred IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Missing partial UNIQUE index idx_test_results_user_client_run_id';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class ic
    JOIN pg_index ix ON ix.indexrelid = ic.oid
    JOIN pg_namespace n ON n.oid = ic.relnamespace
    WHERE n.nspname = 'public'
      AND ic.relname = 'idx_test_results_leaderboard'
      AND ix.indpred IS NOT NULL
      AND pg_get_expr(ix.indpred, ix.indrelid) ILIKE '%user_id IS NOT NULL%'
      AND pg_get_expr(ix.indpred, ix.indrelid) ILIKE '%is_invalidated%'
  ) THEN
    RAISE EXCEPTION 'Missing partial filtered index idx_test_results_leaderboard';
  END IF;

  IF (SELECT COUNT(*) FROM public.achievements) <> 11 THEN
    RAISE EXCEPTION 'Expected 11 seeded achievement definitions, got %', (SELECT COUNT(*) FROM public.achievements);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'test_results'
  ) THEN
    RAISE EXCEPTION 'public.test_results missing from supabase_realtime publication';
  END IF;
END $$;
COMMIT;

-- ============================================================================
-- TX 2: TEST FIXTURES, SIGNUP TRIGGER COLLISION STRESS & ROLLBACK TRIGGER SETUP
-- ============================================================================
BEGIN;
CREATE OR REPLACE FUNCTION public.test_force_replay_failure()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.telemetry::text LIKE '%force_replay_fail%' THEN
    RAISE EXCEPTION 'SIMULATED_REPLAY_WRITE_FAILURE' USING ERRCODE = '50000';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_test_force_replay_failure ON public.replays;
CREATE TRIGGER trg_test_force_replay_failure
  BEFORE INSERT ON public.replays
  FOR EACH ROW
  EXECUTE FUNCTION public.test_force_replay_failure();

CREATE TABLE public._verify_state (
  key TEXT PRIMARY KEY,
  val_uuid UUID
);

DO $$
DECLARE
  v_user_a UUID := '11111111-1111-4111-8111-111111111111';
  v_user_b UUID := '22222222-2222-4222-8222-222222222222';
  v_user_reserved UUID := '33333333-3333-4333-8333-333333333333';
  v_user_placeholder UUID := '44444444-4444-4444-8444-444444444444';
  v_user_dup_a UUID := '55555555-5555-4555-8555-555555555551';
  v_user_dup_b UUID := '55555555-5555-4555-8555-555555555552';
  v_idx INTEGER;
  v_count INTEGER;
  v_username_res TEXT;
  v_username_ph TEXT;
  v_streak_row public.streaks%ROWTYPE;
BEGIN
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES
    (v_user_a, 'alpha@typrox.test', '{"username": "typer_alpha", "display_name": "Alpha Typist"}'::jsonb),
    (v_user_b, 'beta@typrox.test', '{"display_name": "Beta Typist"}'::jsonb),
    (v_user_reserved, 'res@typrox.test', '{"username": "admin"}'::jsonb),
    (v_user_placeholder, 'ph@typrox.test', '{"username": "user_1234abcd"}'::jsonb),
    (v_user_dup_a, 'dupa@typrox.test', '{"username": "samehandle"}'::jsonb),
    (v_user_dup_b, 'dupb@typrox.test', '{"username": "samehandle"}'::jsonb);

  -- 20 rapid identical OAuth metadata signups (exhausting simple retries cleanly)
  FOR v_idx IN 1..20 LOOP
    INSERT INTO auth.users (id, email, raw_user_meta_data)
    VALUES (
      gen_random_uuid(),
      'collide_' || v_idx::text || '@typrox.test',
      '{"username": "storm_handle"}'::jsonb
    );
  END LOOP;

  SELECT COUNT(*) INTO v_count FROM public.profiles WHERE username LIKE 'storm_handle%';
  IF v_count <> 20 THEN
    RAISE EXCEPTION 'Expected 20 distinct profiles for storm_handle collision burst, got %', v_count;
  END IF;

  SELECT username INTO v_username_res FROM public.profiles WHERE id = v_user_reserved;
  IF v_username_res !~ '^user_[0-9a-f]{8}' THEN
    RAISE EXCEPTION 'Reserved metadata username was not sanitized to temp prefix: %', v_username_res;
  END IF;

  SELECT username INTO v_username_ph FROM public.profiles WHERE id = v_user_placeholder;
  IF v_username_ph <> 'user_44444444' AND v_username_ph !~ '^user_44444444_[0-9a-f]{8}$' THEN
    RAISE EXCEPTION 'Placeholder spoofing metadata was not re-derived from auth user id: %', v_username_ph;
  END IF;

  SELECT * INTO v_streak_row FROM public.streaks WHERE user_id = v_user_a;
  IF v_streak_row.current_streak <> 0 OR v_streak_row.last_active_date IS NOT NULL THEN
    RAISE EXCEPTION 'New user streak must initialize to 0 with NULL last_active_date';
  END IF;
END $$;
COMMIT;

-- ============================================================================
-- TX 3 & TX 4: AUTHENTICATION IDENTITY ISOLATION ACROSS TX & ROLE BOUNDARIES
-- ============================================================================
BEGIN;
DO $$
DECLARE
  v_user_a UUID := '11111111-1111-4111-8111-111111111111';
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  IF current_user <> 'authenticated' OR auth.role() <> 'authenticated' OR auth.uid() IS DISTINCT FROM v_user_a THEN
    RAISE EXCEPTION 'TX3 failed to establish authenticated identity for user_a (current_user=%, uid=%)', current_user, auth.uid();
  END IF;
END $$;
COMMIT;

BEGIN;
DO $$
DECLARE
  v_user_a UUID := '11111111-1111-4111-8111-111111111111';
  v_user_b UUID := '22222222-2222-4222-8222-222222222222';
  v_raised BOOLEAN;
  v_count INTEGER;
BEGIN
  -- 4A. Fresh transaction MUST NOT retain previous transaction JWT subject
  IF current_user <> 'postgres' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Cross-transaction identity leakage detected: current_user=%, auth.uid()=%', current_user, auth.uid();
  END IF;

  -- 4B. Switching to authenticated without JWT claim must keep auth.uid() NULL
  SET LOCAL ROLE authenticated;
  IF current_user <> 'authenticated' OR auth.role() <> 'authenticated' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'authenticated without JWT sub claim must yield auth.uid() IS NULL, got %', auth.uid();
  END IF;

  -- 4C. Setting user_b establishes user_b, and switching to anon MUST yield auth.uid() IS NULL
  PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);
  IF auth.uid() IS DISTINCT FROM v_user_b THEN
    RAISE EXCEPTION 'Expected auth.uid() = user_b, got %', auth.uid();
  END IF;

  SET LOCAL ROLE anon;
  IF current_user <> 'anon' OR auth.role() <> 'anon' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'anon role inherited non-NULL auth.uid() across role switch: %', auth.uid();
  END IF;

  -- Even with an explicitly injected stale GUC while running as anon, auth.uid() must remain NULL
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'anon role must NEVER return a non-NULL auth.uid(), got %', auth.uid();
  END IF;

  -- 4D. Client roles cannot read auth.users directly
  v_raised := FALSE;
  BEGIN
    SELECT COUNT(*) INTO v_count FROM auth.users;
  EXCEPTION WHEN insufficient_privilege THEN
    v_raised := TRUE;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'anon must not be allowed to SELECT auth.users';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  SET LOCAL ROLE authenticated;
  v_raised := FALSE;
  BEGIN
    SELECT COUNT(*) INTO v_count FROM auth.users;
  EXCEPTION WHEN insufficient_privilege THEN
    v_raised := TRUE;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'authenticated must not be allowed to SELECT auth.users';
  END IF;
END $$;
COMMIT;

-- ============================================================================
-- TX 5: PRIVILEGED service_role USERNAME INTEGRITY PATH (PATCH /api/profile)
-- ============================================================================
BEGIN;
DO $$
DECLARE
  v_user_b UUID := '22222222-2222-4222-8222-222222222222';
  v_username_b TEXT;
  v_raised BOOLEAN;
BEGIN
  SET LOCAL ROLE service_role;

  v_raised := FALSE;
  BEGIN
    UPDATE public.profiles SET username = 'ab' WHERE id = v_user_b;
  EXCEPTION WHEN SQLSTATE '23514' THEN
    v_raised := TRUE;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'Expected 23514 for short username under service_role';
  END IF;

  v_raised := FALSE;
  BEGIN
    UPDATE public.profiles SET username = 'ADMIN' WHERE id = v_user_b;
  EXCEPTION WHEN SQLSTATE '23514' THEN
    v_raised := TRUE;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'Expected 23514 for reserved username under service_role';
  END IF;

  v_raised := FALSE;
  BEGIN
    UPDATE public.profiles SET username = 'user_deadbeef' WHERE id = v_user_b;
  EXCEPTION WHEN SQLSTATE '23514' THEN
    v_raised := TRUE;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'Expected 23514 for placeholder handle under service_role';
  END IF;

  -- Onboarding transition from temp user_22222222 succeeds and normalizes mixed case
  UPDATE public.profiles SET username = 'Beta_Verified' WHERE id = v_user_b;
  SELECT username INTO v_username_b FROM public.profiles WHERE id = v_user_b;
  IF v_username_b <> 'beta_verified' THEN
    RAISE EXCEPTION 'Expected normalized username beta_verified, got %', v_username_b;
  END IF;

  -- Subsequent rename blocked by trg_enforce_profile_username_integrity (42501 USERNAME_LOCKED)
  v_raised := FALSE;
  BEGIN
    UPDATE public.profiles SET username = 'beta_second' WHERE id = v_user_b;
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_raised := TRUE;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'Expected 42501 USERNAME_LOCKED on second rename under service_role';
  END IF;
END $$;
COMMIT;

-- ============================================================================
-- TX 6: AUTHENTICATED ROLE PERMISSIONS, COLUMN GRANTS & DML LOCKDOWN
-- ============================================================================
BEGIN;
DO $$
DECLARE
  v_user_a UUID := '11111111-1111-4111-8111-111111111111';
  v_user_b UUID := '22222222-2222-4222-8222-222222222222';
  v_user_reserved UUID := '33333333-3333-4333-8333-333333333333';
  v_telemetry JSONB := '[{"t":0,"k":"a","y":0,"i":0}]'::jsonb;
  v_raised BOOLEAN;
  v_row_count INTEGER;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  IF auth.uid() IS DISTINCT FROM v_user_b THEN
    RAISE EXCEPTION 'Identity setup failed for user_b';
  END IF;

  -- Allowed: own non-username profile settings update
  UPDATE public.profiles
  SET display_name = 'Beta Renamed', theme = 'light', font_family = 'geist-mono', updated_at = timezone('utc'::text, now())
  WHERE id = v_user_b;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count <> 1 THEN
    RAISE EXCEPTION 'Expected authenticated user_b own-profile preference update to affect 1 row, got %', v_row_count;
  END IF;

  -- Cross-user profile UPDATE must affect 0 rows under RLS
  UPDATE public.profiles SET display_name = 'Tampered Alpha' WHERE id = v_user_a;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count <> 0 THEN
    RAISE EXCEPTION 'Cross-user profiles UPDATE modified % rows (RLS violation)', v_row_count;
  END IF;

  -- Direct username update blocked even for temp-handle user
  PERFORM set_config('request.jwt.claim.sub', v_user_reserved::text, true);
  v_raised := FALSE;
  BEGIN
    UPDATE public.profiles SET username = 'bypass_try' WHERE id = v_user_reserved;
  EXCEPTION WHEN insufficient_privilege THEN
    v_raised := TRUE;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'authenticated must not be allowed to UPDATE profiles.username';
  END IF;

  -- Prohibited direct DML across all client-locked public tables
  v_raised := FALSE;
  BEGIN
    INSERT INTO public.profiles (id, username) VALUES (v_user_reserved, 'bad_profile_ins');
  EXCEPTION WHEN insufficient_privilege THEN v_raised := TRUE; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'authenticated must not INSERT public.profiles'; END IF;

  v_raised := FALSE;
  BEGIN
    INSERT INTO public.test_results (user_id, wpm, raw_wpm, accuracy, consistency, error_count, backspace_count, mode, duration, seed)
    VALUES (v_user_reserved, 200, 200, 100, 100, 0, 0, 'words', 30, 'cheat');
  EXCEPTION WHEN insufficient_privilege THEN v_raised := TRUE; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'authenticated must not INSERT public.test_results'; END IF;

  v_raised := FALSE;
  BEGIN
    INSERT INTO public.replays (test_result_id, telemetry) VALUES (gen_random_uuid(), v_telemetry);
  EXCEPTION WHEN insufficient_privilege THEN v_raised := TRUE; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'authenticated must not INSERT public.replays'; END IF;

  v_raised := FALSE;
  BEGIN
    UPDATE public.streaks SET current_streak = 999 WHERE user_id = v_user_reserved;
  EXCEPTION WHEN insufficient_privilege THEN v_raised := TRUE; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'authenticated must not UPDATE public.streaks'; END IF;

  v_raised := FALSE;
  BEGIN
    INSERT INTO public.challenge_links (creator_id, creator_wpm, creator_accuracy, mode, duration, seed)
    VALUES (v_user_reserved, 250, 100, 'words', 30, 'cheat_chal');
  EXCEPTION WHEN insufficient_privilege THEN v_raised := TRUE; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'authenticated must not INSERT public.challenge_links'; END IF;

  v_raised := FALSE;
  BEGIN
    INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (v_user_reserved, gen_random_uuid());
  EXCEPTION WHEN insufficient_privilege THEN v_raised := TRUE; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'authenticated must not INSERT public.user_achievements'; END IF;

  v_raised := FALSE;
  BEGIN
    INSERT INTO public.user_challenge_progress (user_id, challenge_id) VALUES (v_user_reserved, gen_random_uuid());
  EXCEPTION WHEN insufficient_privilege THEN v_raised := TRUE; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'authenticated must not INSERT public.user_challenge_progress'; END IF;

  v_raised := FALSE;
  BEGIN
    INSERT INTO public.daily_challenges (challenge_date, mode, duration, seed) VALUES (CURRENT_DATE, 'words', 30, 'cheat_daily');
  EXCEPTION WHEN insufficient_privilege THEN v_raised := TRUE; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'authenticated must not INSERT public.daily_challenges'; END IF;

  v_raised := FALSE;
  BEGIN
    INSERT INTO public.achievements (code, name, description, criteria, icon_path) VALUES ('HACK', 'Hack', 'Hack', '{}'::jsonb, '/h.svg');
  EXCEPTION WHEN insufficient_privilege THEN v_raised := TRUE; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'authenticated must not INSERT public.achievements'; END IF;

  v_raised := FALSE;
  BEGIN
    INSERT INTO public.user_progression (user_id, total_xp, level) VALUES (v_user_reserved, 9999, 99);
  EXCEPTION WHEN insufficient_privilege THEN v_raised := TRUE; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'authenticated must not INSERT public.user_progression'; END IF;

  v_raised := FALSE;
  BEGIN
    INSERT INTO public.user_lesson_progress (user_id, lesson_slug, best_wpm, best_accuracy, stars, completed)
    VALUES (v_user_reserved, 'hack', 200, 100, 3, TRUE);
  EXCEPTION WHEN insufficient_privilege THEN v_raised := TRUE; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'authenticated must not INSERT public.user_lesson_progress'; END IF;

  v_raised := FALSE;
  BEGIN
    INSERT INTO public.challenge_attempts (challenge_id, challenger_id, wpm, accuracy, won)
    VALUES (gen_random_uuid(), v_user_reserved, 200, 100, TRUE);
  EXCEPTION WHEN insufficient_privilege THEN v_raised := TRUE; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'authenticated must not INSERT public.challenge_attempts'; END IF;

  v_raised := FALSE;
  BEGIN
    DELETE FROM public.profiles WHERE id = v_user_reserved;
  EXCEPTION WHEN insufficient_privilege THEN v_raised := TRUE; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'authenticated must not DELETE public.profiles'; END IF;

  v_raised := FALSE;
  BEGIN
    DELETE FROM public.test_results WHERE user_id = v_user_reserved;
  EXCEPTION WHEN insufficient_privilege THEN v_raised := TRUE; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'authenticated must not DELETE public.test_results'; END IF;

  v_raised := FALSE;
  BEGIN
    PERFORM public.submit_verified_result(
      v_user_reserved, 220, 220, 100, 100, 0, 0, 'words', 30, 'rpc_cheat', gen_random_uuid(), v_telemetry, TRUE
    );
  EXCEPTION WHEN insufficient_privilege THEN v_raised := TRUE; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'authenticated must not EXECUTE submit_verified_result'; END IF;
END $$;
COMMIT;

-- ============================================================================
-- TX 7: ANON ROLE EXHAUSTIVE DML DENIAL (ALL 12 TABLES + RPC)
-- ============================================================================
BEGIN;
DO $$
DECLARE
  v_user_a UUID := '11111111-1111-4111-8111-111111111111';
  v_telemetry JSONB := '[{"t":0,"k":"a","y":0,"i":0}]'::jsonb;
  v_raised BOOLEAN;
BEGIN
  SET LOCAL ROLE anon;
  IF current_user <> 'anon' OR auth.role() <> 'anon' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Expected strict anon identity with auth.uid() IS NULL';
  END IF;

  v_raised := FALSE;
  BEGIN
    INSERT INTO public.profiles (id, username) VALUES (gen_random_uuid(), 'anon_bad');
  EXCEPTION WHEN insufficient_privilege THEN v_raised := TRUE; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'anon must not INSERT public.profiles'; END IF;

  v_raised := FALSE;
  BEGIN
    UPDATE public.profiles SET display_name = 'AnonHack' WHERE id = v_user_a;
  EXCEPTION WHEN insufficient_privilege THEN v_raised := TRUE; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'anon must not UPDATE public.profiles'; END IF;

  v_raised := FALSE;
  BEGIN
    INSERT INTO public.test_results (user_id, wpm, raw_wpm, accuracy, consistency, error_count, backspace_count, mode, duration, seed)
    VALUES (NULL, 250, 250, 100, 100, 0, 0, 'words', 30, 'anon_cheat');
  EXCEPTION WHEN insufficient_privilege THEN v_raised := TRUE; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'anon must not INSERT public.test_results'; END IF;

  v_raised := FALSE;
  BEGIN
    INSERT INTO public.replays (test_result_id, telemetry) VALUES (gen_random_uuid(), v_telemetry);
  EXCEPTION WHEN insufficient_privilege THEN v_raised := TRUE; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'anon must not INSERT public.replays'; END IF;

  v_raised := FALSE;
  BEGIN
    UPDATE public.streaks SET current_streak = 100 WHERE user_id = v_user_a;
  EXCEPTION WHEN insufficient_privilege THEN v_raised := TRUE; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'anon must not UPDATE public.streaks'; END IF;

  v_raised := FALSE;
  BEGIN
    INSERT INTO public.challenge_links (creator_id, creator_wpm, creator_accuracy, mode, duration, seed)
    VALUES (NULL, 250, 100, 'words', 30, 'anon_chal');
  EXCEPTION WHEN insufficient_privilege THEN v_raised := TRUE; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'anon must not INSERT public.challenge_links'; END IF;

  v_raised := FALSE;
  BEGIN
    INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (v_user_a, gen_random_uuid());
  EXCEPTION WHEN insufficient_privilege THEN v_raised := TRUE; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'anon must not INSERT public.user_achievements'; END IF;

  v_raised := FALSE;
  BEGIN
    INSERT INTO public.user_challenge_progress (user_id, challenge_id) VALUES (v_user_a, gen_random_uuid());
  EXCEPTION WHEN insufficient_privilege THEN v_raised := TRUE; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'anon must not INSERT public.user_challenge_progress'; END IF;

  v_raised := FALSE;
  BEGIN
    INSERT INTO public.daily_challenges (challenge_date, mode, duration, seed) VALUES (CURRENT_DATE, 'words', 30, 'anon_daily');
  EXCEPTION WHEN insufficient_privilege THEN v_raised := TRUE; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'anon must not INSERT public.daily_challenges'; END IF;

  v_raised := FALSE;
  BEGIN
    INSERT INTO public.achievements (code, name, description, criteria, icon_path) VALUES ('ANON', 'Anon', 'Anon', '{}'::jsonb, '/a.svg');
  EXCEPTION WHEN insufficient_privilege THEN v_raised := TRUE; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'anon must not INSERT public.achievements'; END IF;

  v_raised := FALSE;
  BEGIN
    INSERT INTO public.user_progression (user_id, total_xp, level) VALUES (v_user_a, 100, 2);
  EXCEPTION WHEN insufficient_privilege THEN v_raised := TRUE; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'anon must not INSERT public.user_progression'; END IF;

  v_raised := FALSE;
  BEGIN
    INSERT INTO public.user_lesson_progress (user_id, lesson_slug, best_wpm, best_accuracy, stars, completed)
    VALUES (v_user_a, 'anon-lesson', 50, 95, 1, FALSE);
  EXCEPTION WHEN insufficient_privilege THEN v_raised := TRUE; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'anon must not INSERT public.user_lesson_progress'; END IF;

  v_raised := FALSE;
  BEGIN
    INSERT INTO public.challenge_attempts (challenge_id, challenger_id, wpm, accuracy, won)
    VALUES (gen_random_uuid(), NULL, 50, 95, FALSE);
  EXCEPTION WHEN insufficient_privilege THEN v_raised := TRUE; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'anon must not INSERT public.challenge_attempts'; END IF;

  v_raised := FALSE;
  BEGIN
    DELETE FROM public.profiles WHERE id = v_user_a;
  EXCEPTION WHEN insufficient_privilege THEN v_raised := TRUE; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'anon must not DELETE public.profiles'; END IF;

  v_raised := FALSE;
  BEGIN
    DELETE FROM public.test_results WHERE user_id = v_user_a;
  EXCEPTION WHEN insufficient_privilege THEN v_raised := TRUE; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'anon must not DELETE public.test_results'; END IF;

  v_raised := FALSE;
  BEGIN
    PERFORM public.submit_verified_result(
      v_user_a, 220, 220, 100, 100, 0, 0, 'words', 30, 'anon_rpc_cheat', gen_random_uuid(), v_telemetry, TRUE
    );
  EXCEPTION WHEN insufficient_privilege THEN v_raised := TRUE; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'anon must not EXECUTE submit_verified_result'; END IF;
END $$;
COMMIT;

-- ============================================================================
-- TX 8: SERVICE_ROLE ATOMIC RPC, ROLLBACK, DEDUP STREAK, INVALIDATION & FIXTURES
-- ============================================================================
BEGIN;
DO $$
DECLARE
  v_user_a UUID := '11111111-1111-4111-8111-111111111111';
  v_user_b UUID := '22222222-2222-4222-8222-222222222222';
  v_shared_client_run_id UUID := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_run_a1 UUID := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
  v_run_a2 UUID := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
  v_run_orphan UUID := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  v_run_inv UUID := 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  v_run_inv_sig UUID := 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  v_resp JSONB;
  v_resp_dup JSONB;
  v_resp_rec JSONB;
  v_result_id UUID;
  v_orphan_id UUID;
  v_inv_id UUID;
  v_active_chal_id UUID;
  v_expired_chal_id UUID;
  v_count INTEGER;
  v_streak_row public.streaks%ROWTYPE;
  v_telemetry JSONB := '[{"t":0,"k":"a","y":0,"i":0},{"t":135,"k":"b","y":0,"i":1},{"t":275,"k":"c","y":0,"i":2}]'::jsonb;
  v_other_telemetry JSONB := '[{"t":0,"k":"x","y":0,"i":0},{"t":140,"k":"y","y":0,"i":1}]'::jsonb;
  v_raised BOOLEAN;
BEGIN
  SET LOCAL ROLE service_role;

  -- Fresh run -> initializes streak=1 and unlocks Bronze Fingers (88 WPM)
  v_resp := public.submit_verified_result(
    v_user_a, 88, 92, 97.5, 91, 1, 2, 'words', 30, 'pgseed_a1', v_run_a1, v_telemetry, TRUE
  );
  v_result_id := (v_resp->'result'->>'id')::uuid;
  INSERT INTO public._verify_state (key, val_uuid) VALUES ('result_a1', v_result_id);

  IF (v_resp->>'deduplicated')::boolean IS NOT FALSE OR (v_resp->>'streakDays')::integer <> 1 THEN
    RAISE EXCEPTION 'Expected fresh run with streakDays=1, got %', v_resp;
  END IF;
  IF NOT (v_resp->'unlocked' @> '["Bronze Fingers"]'::jsonb) THEN
    RAISE EXCEPTION 'Expected Bronze Fingers unlocked on 88 WPM run, got %', v_resp->'unlocked';
  END IF;

  -- Atomic rollback on replay failure leaves 0 orphaned test_results rows
  v_raised := FALSE;
  BEGIN
    PERFORM public.submit_verified_result(
      v_user_a, 90, 95, 98, 92, 0, 0, 'words', 30, 'pgseed_rollback', gen_random_uuid(),
      '[{"t":0,"k":"force_replay_fail","y":0,"i":0}]'::jsonb, TRUE
    );
  EXCEPTION WHEN OTHERS THEN
    v_raised := TRUE;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'Forced replay write failure must fail transaction atomically';
  END IF;
  SELECT COUNT(*) INTO v_count FROM public.test_results WHERE seed = 'pgseed_rollback';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Atomic failure left orphaned test_results row for pgseed_rollback';
  END IF;

  -- Pure duplicate retry across UTC midnight must NOT advance streak or emit achievements
  UPDATE public.test_results SET created_at = timezone('utc'::text, now()) - interval '1 day' WHERE id = v_result_id;
  UPDATE public.streaks SET current_streak = 3, longest_streak = 5, last_active_date = ((timezone('utc'::text, now()))::date - 1) WHERE user_id = v_user_a;

  v_resp_dup := public.submit_verified_result(
    v_user_a, 88, 92, 97.5, 91, 1, 2, 'words', 30, 'pgseed_a1', v_run_a1, v_telemetry, TRUE
  );
  IF (v_resp_dup->>'deduplicated')::boolean IS NOT TRUE
     OR (v_resp_dup->>'recoveredPartialWrite')::boolean IS NOT FALSE
     OR (v_resp_dup->>'streakDays')::integer <> 3
     OR v_resp_dup->'unlocked' <> '[]'::jsonb THEN
    RAISE EXCEPTION 'Pure client_run_id duplicate mutated streak/unlocked unexpectedly: %', v_resp_dup;
  END IF;

  v_resp_dup := public.submit_verified_result(
    v_user_a, 88, 92, 97.5, 91, 1, 2, 'words', 30, 'pgseed_a1', NULL, v_telemetry, TRUE
  );
  IF (v_resp_dup->>'deduplicated')::boolean IS NOT TRUE
     OR (v_resp_dup->>'recoveredPartialWrite')::boolean IS NOT FALSE
     OR (v_resp_dup->>'streakDays')::integer <> 3 THEN
    RAISE EXCEPTION 'Pure signature duplicate mutated streak unexpectedly: %', v_resp_dup;
  END IF;

  SELECT * INTO v_streak_row FROM public.streaks WHERE user_id = v_user_a;
  IF v_streak_row.current_streak <> 3 OR v_streak_row.last_active_date <> ((timezone('utc'::text, now()))::date - 1) THEN
    RAISE EXCEPTION 'Streaks table was mutated during pure duplicate retry: %', v_streak_row;
  END IF;

  -- Orphan partial-write recovery & created_at UTC anchoring + future skew preservation
  v_resp := public.submit_verified_result(
    v_user_a, 94, 96, 98, 93, 0, 1, 'words', 30, 'pgseed_orphan', v_run_orphan, v_telemetry, TRUE
  );
  v_orphan_id := (v_resp->'result'->>'id')::uuid;

  DELETE FROM public.replays WHERE test_result_id = v_orphan_id;
  UPDATE public.test_results SET created_at = timezone('utc'::text, now()) - interval '1 day' WHERE id = v_orphan_id;
  UPDATE public.streaks SET current_streak = 2, longest_streak = 5, last_active_date = ((timezone('utc'::text, now()))::date - 2) WHERE user_id = v_user_a;

  v_resp_rec := public.submit_verified_result(
    v_user_a, 94, 96, 98, 93, 0, 1, 'words', 30, 'pgseed_orphan', v_run_orphan, v_telemetry, TRUE
  );
  IF (v_resp_rec->>'deduplicated')::boolean IS NOT TRUE
     OR (v_resp_rec->>'recoveredPartialWrite')::boolean IS NOT TRUE
     OR (v_resp_rec->>'streakDays')::integer <> 3 THEN
    RAISE EXCEPTION 'Orphan recovery failed to advance streak anchored to created_at: %', v_resp_rec;
  END IF;

  UPDATE public.streaks SET current_streak = 7, longest_streak = 7, last_active_date = ((timezone('utc'::text, now()))::date + 2) WHERE user_id = v_user_a;
  v_resp := public.submit_verified_result(
    v_user_a, 99, 102, 98, 94, 0, 0, 'words', 30, 'pgseed_future', v_run_a2, v_telemetry, TRUE
  );
  SELECT * INTO v_streak_row FROM public.streaks WHERE user_id = v_user_a;
  IF v_streak_row.current_streak <> 7 OR v_streak_row.last_active_date <> ((timezone('utc'::text, now()))::date + 2) THEN
    RAISE EXCEPTION 'Future last_active_date skew was overwritten backwards: %', v_streak_row;
  END IF;

  -- CLIENT_RUN_ID_CONFLICT (seed mismatch & replay mismatch)
  v_raised := FALSE;
  BEGIN
    PERFORM public.submit_verified_result(v_user_a, 88, 92, 97.5, 91, 1, 2, 'words', 30, 'wrong_seed', v_run_a1, v_telemetry, TRUE);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM LIKE '%CLIENT_RUN_ID_CONFLICT%' THEN v_raised := TRUE; END IF;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'Expected CLIENT_RUN_ID_CONFLICT on seed mismatch'; END IF;

  v_raised := FALSE;
  BEGIN
    PERFORM public.submit_verified_result(v_user_a, 88, 92, 97.5, 91, 1, 2, 'words', 30, 'pgseed_a1', v_run_a1, v_other_telemetry, TRUE);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM LIKE '%CLIENT_RUN_ID_CONFLICT%' THEN v_raised := TRUE; END IF;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'Expected CLIENT_RUN_ID_CONFLICT on replay telemetry mismatch'; END IF;

  -- RESULT_INVALIDATED (client_run_id & signature replay denial)
  v_resp := public.submit_verified_result(
    v_user_a, 111, 115, 99, 95, 0, 0, 'words', 30, 'pgseed_inv', v_run_inv, v_telemetry, TRUE
  );
  v_inv_id := (v_resp->'result'->>'id')::uuid;
  INSERT INTO public._verify_state (key, val_uuid) VALUES ('result_inv', v_inv_id);
  UPDATE public.test_results SET is_invalidated = TRUE WHERE id = v_inv_id;

  v_raised := FALSE;
  BEGIN
    PERFORM public.submit_verified_result(v_user_a, 111, 115, 99, 95, 0, 0, 'words', 30, 'pgseed_inv', v_run_inv, v_telemetry, TRUE);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM LIKE '%RESULT_INVALIDATED%' THEN v_raised := TRUE; END IF;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'Expected RESULT_INVALIDATED on client_run_id replay'; END IF;

  v_raised := FALSE;
  BEGIN
    PERFORM public.submit_verified_result(v_user_a, 111, 115, 99, 95, 0, 0, 'words', 30, 'pgseed_inv', v_run_inv_sig, v_telemetry, TRUE);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM LIKE '%RESULT_INVALIDATED%' THEN v_raised := TRUE; END IF;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'Expected RESULT_INVALIDATED on signature replay'; END IF;

  -- Scoped composite unique index allows distinct users with identical client_run_id
  PERFORM public.submit_verified_result(v_user_a, 70, 72, 95, 90, 1, 1, 'words', 15, 'pg_shared_seed', v_shared_client_run_id, v_telemetry, FALSE);
  PERFORM public.submit_verified_result(v_user_b, 75, 78, 96, 91, 1, 0, 'words', 15, 'pg_shared_seed', v_shared_client_run_id, v_telemetry, FALSE);

  -- Populate privacy test fixtures as service_role (unranked, anonymous, challenges, lessons)
  INSERT INTO public.test_results (user_id, wpm, raw_wpm, accuracy, consistency, error_count, backspace_count, mode, duration, seed, is_ranked, is_invalidated)
  VALUES
    (v_user_b, 240, 245, 99, 95, 0, 0, 'words', 30, 'unranked_row', FALSE, FALSE),
    (NULL, 250, 255, 99, 95, 0, 0, 'words', 30, 'anon_row', TRUE, FALSE);

  INSERT INTO public.challenge_links (creator_id, creator_wpm, creator_accuracy, mode, duration, seed, expires_at)
  VALUES (v_user_a, 99, 98, 'words', 30, 'active_chal', timezone('utc'::text, now()) + interval '2 days')
  RETURNING id INTO v_active_chal_id;

  INSERT INTO public.challenge_links (creator_id, creator_wpm, creator_accuracy, mode, duration, seed, expires_at)
  VALUES (v_user_a, 99, 98, 'words', 30, 'expired_chal', timezone('utc'::text, now()) - interval '2 minutes')
  RETURNING id INTO v_expired_chal_id;

  INSERT INTO public._verify_state (key, val_uuid) VALUES
    ('active_chal', v_active_chal_id),
    ('expired_chal', v_expired_chal_id);

  INSERT INTO public.user_lesson_progress (user_id, lesson_slug, best_wpm, best_accuracy, stars, completed)
  VALUES
    (v_user_a, 'home-row-basics', 78, 98, 3, TRUE),
    (v_user_b, 'numbers-drill', 65, 96, 2, TRUE);
END $$;
COMMIT;

-- ============================================================================
-- TX 9: ANON ROLE PRIVACY & LEADERBOARD_VIEW SECURITY (NEVER SUPERUSER!)
-- ============================================================================
BEGIN;
DO $$
DECLARE
  v_user_a UUID := '11111111-1111-4111-8111-111111111111';
  v_result_a1 UUID := (SELECT val_uuid FROM public._verify_state WHERE key = 'result_a1');
  v_result_inv UUID := (SELECT val_uuid FROM public._verify_state WHERE key = 'result_inv');
  v_active_chal UUID := (SELECT val_uuid FROM public._verify_state WHERE key = 'active_chal');
  v_expired_chal UUID := (SELECT val_uuid FROM public._verify_state WHERE key = 'expired_chal');
  v_count INTEGER;
  v_lb_username TEXT;
BEGIN
  SET LOCAL ROLE anon;
  IF current_user <> 'anon' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'TX9 must run as anon with NULL auth.uid()';
  END IF;

  -- Replays strictly hidden from anon
  SELECT COUNT(*) INTO v_count FROM public.replays;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'anon must not read any replays (got %)', v_count;
  END IF;

  -- test_results privacy: valid public run visible, invalidated & NULL user_id hidden
  SELECT COUNT(*) INTO v_count FROM public.test_results WHERE id = v_result_a1;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'anon should read valid public non-null run (got %)', v_count;
  END IF;
  SELECT COUNT(*) INTO v_count FROM public.test_results WHERE id = v_result_inv;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'anon leaked invalidated test_result (got %)', v_count;
  END IF;
  SELECT COUNT(*) INTO v_count FROM public.test_results WHERE seed = 'anon_row';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'anon leaked user_id IS NULL test_result (got %)', v_count;
  END IF;

  -- challenge_links expiry enforcement
  SELECT COUNT(*) INTO v_count FROM public.challenge_links WHERE id = v_active_chal;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'anon should read non-expired challenge link (got %)', v_count;
  END IF;
  SELECT COUNT(*) INTO v_count FROM public.challenge_links WHERE id = v_expired_chal;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'anon leaked expired challenge link (got %)', v_count;
  END IF;

  -- user_lesson_progress owner-only RLS hides rows from anon
  SELECT COUNT(*) INTO v_count FROM public.user_lesson_progress;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'anon must not read any user_lesson_progress rows (got %)', v_count;
  END IF;

  -- leaderboard_view queried DIRECTLY as anon
  SELECT COUNT(*) INTO v_count FROM public.leaderboard_view WHERE wpm >= 111;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'anon leaderboard_view leaked invalidated, anonymous, or unranked high WPM row (count=%)', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.leaderboard_view WHERE user_id = v_user_a AND mode = 'words' AND duration = 30;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 deduplicated 30s words entry for user_a under anon (got %)', v_count;
  END IF;

  SELECT username INTO v_lb_username
  FROM public.leaderboard_view
  WHERE user_id = v_user_a AND mode = 'words' AND duration = 30 AND wpm = 99;
  IF v_lb_username IS DISTINCT FROM 'typer_alpha' THEN
    RAISE EXCEPTION 'Expected anon leaderboard_view best 99 WPM score with username typer_alpha, got %', v_lb_username;
  END IF;
END $$;
COMMIT;

-- ============================================================================
-- TX 10: AUTHENTICATED USER B CROSS-USER PRIVACY & LEADERBOARD_VIEW BEHAVIOR
-- ============================================================================
BEGIN;
DO $$
DECLARE
  v_user_a UUID := '11111111-1111-4111-8111-111111111111';
  v_user_b UUID := '22222222-2222-4222-8222-222222222222';
  v_result_a1 UUID := (SELECT val_uuid FROM public._verify_state WHERE key = 'result_a1');
  v_result_inv UUID := (SELECT val_uuid FROM public._verify_state WHERE key = 'result_inv');
  v_active_chal UUID := (SELECT val_uuid FROM public._verify_state WHERE key = 'active_chal');
  v_expired_chal UUID := (SELECT val_uuid FROM public._verify_state WHERE key = 'expired_chal');
  v_count INTEGER;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  IF auth.uid() IS DISTINCT FROM v_user_b THEN
    RAISE EXCEPTION 'TX10 identity mismatch';
  END IF;

  -- Replays: user_b sees 0 of user_a replays
  SELECT COUNT(*) INTO v_count FROM public.replays WHERE test_result_id = v_result_a1;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'user_b must not read user_a replay (got %)', v_count;
  END IF;

  -- test_results privacy for user_b
  SELECT COUNT(*) INTO v_count FROM public.test_results WHERE id = v_result_inv;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'user_b leaked user_a invalidated result (got %)', v_count;
  END IF;
  SELECT COUNT(*) INTO v_count FROM public.test_results WHERE seed = 'anon_row';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'user_b leaked user_id IS NULL row (got %)', v_count;
  END IF;
  SELECT COUNT(*) INTO v_count FROM public.test_results WHERE seed = 'unranked_row' AND user_id = v_user_b;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'user_b should read own unranked test_result (got %)', v_count;
  END IF;

  -- challenge_links expiry for user_b
  SELECT COUNT(*) INTO v_count FROM public.challenge_links WHERE id = v_active_chal;
  IF v_count <> 1 THEN RAISE EXCEPTION 'user_b should read active challenge link'; END IF;
  SELECT COUNT(*) INTO v_count FROM public.challenge_links WHERE id = v_expired_chal;
  IF v_count <> 0 THEN RAISE EXCEPTION 'user_b leaked expired challenge link'; END IF;

  -- user_lesson_progress RLS isolation for user_b
  SELECT COUNT(*) INTO v_count FROM public.user_lesson_progress WHERE user_id = v_user_b;
  IF v_count <> 1 THEN RAISE EXCEPTION 'user_b should read own lesson progress'; END IF;
  SELECT COUNT(*) INTO v_count FROM public.user_lesson_progress WHERE user_id = v_user_a;
  IF v_count <> 0 THEN RAISE EXCEPTION 'user_b leaked user_a lesson progress (got %)', v_count; END IF;

  -- leaderboard_view queried DIRECTLY as authenticated user_b
  SELECT COUNT(*) INTO v_count FROM public.leaderboard_view WHERE wpm >= 111;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'authenticated user_b leaderboard_view leaked invalidated/anon/unranked rows (got %)', v_count;
  END IF;
  SELECT COUNT(*) INTO v_count FROM public.leaderboard_view WHERE user_id = v_user_a AND mode = 'words' AND duration = 30 AND wpm = 99;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected user_a top 99 WPM score visible to authenticated user_b (got %)', v_count;
  END IF;
END $$;
COMMIT;

-- ============================================================================
-- TX 11: AUTHENTICATED OWNER A READS & INVALIDATED-FILTER BEHAVIOR IN VIEW
-- ============================================================================
BEGIN;
DO $$
DECLARE
  v_user_a UUID := '11111111-1111-4111-8111-111111111111';
  v_user_b UUID := '22222222-2222-4222-8222-222222222222';
  v_result_a1 UUID := (SELECT val_uuid FROM public._verify_state WHERE key = 'result_a1');
  v_result_inv UUID := (SELECT val_uuid FROM public._verify_state WHERE key = 'result_inv');
  v_count INTEGER;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  IF auth.uid() IS DISTINCT FROM v_user_a THEN
    RAISE EXCEPTION 'TX11 identity mismatch';
  END IF;

  -- Owner reads own replay and own invalidated test_result in base table
  SELECT COUNT(*) INTO v_count FROM public.replays WHERE test_result_id = v_result_a1;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Owner user_a should read own replay (got %)', v_count; END IF;

  SELECT COUNT(*) INTO v_count FROM public.test_results WHERE id = v_result_inv;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Owner user_a should read own invalidated run (got %)', v_count; END IF;

  SELECT COUNT(*) INTO v_count FROM public.test_results WHERE seed = 'anon_row';
  IF v_count <> 0 THEN RAISE EXCEPTION 'user_a must NOT read user_id IS NULL row (got %)', v_count; END IF;

  -- user_lesson_progress owner-only isolation
  SELECT COUNT(*) INTO v_count FROM public.user_lesson_progress WHERE user_id = v_user_a;
  IF v_count <> 1 THEN RAISE EXCEPTION 'user_a should read own lesson progress'; END IF;
  SELECT COUNT(*) INTO v_count FROM public.user_lesson_progress WHERE user_id = v_user_b;
  IF v_count <> 0 THEN RAISE EXCEPTION 'user_a leaked user_b lesson progress (got %)', v_count; END IF;

  -- Even for owner user_a who CAN see own 111 WPM invalidated row in test_results,
  -- leaderboard_view STILL suppresses invalidated rows and surfaces valid 99 WPM best!
  SELECT COUNT(*) INTO v_count FROM public.leaderboard_view WHERE wpm = 111;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'leaderboard_view leaked owner invalidated row to user_a (got %)', v_count;
  END IF;
  SELECT COUNT(*) INTO v_count FROM public.leaderboard_view WHERE user_id = v_user_a AND mode = 'words' AND duration = 30 AND wpm = 99;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected user_a best 99 WPM score in leaderboard_view under user_a (got %)', v_count;
  END IF;
END $$;
COMMIT;

-- ============================================================================
-- TX 12: RUNTIME BEHAVIORAL PROOF OF security_invoker = true ON leaderboard_view
-- ============================================================================
BEGIN;
  REVOKE SELECT ON public.test_results FROM anon;
  DO $$
  DECLARE
    v_raised BOOLEAN := FALSE;
  BEGIN
    SET LOCAL ROLE anon;
    BEGIN
      PERFORM COUNT(*) FROM public.leaderboard_view;
    EXCEPTION WHEN insufficient_privilege THEN
      v_raised := TRUE;
    END;
    IF NOT v_raised THEN
      RAISE EXCEPTION 'leaderboard_view bypassed invoker privilege checks on public.test_results (security_invoker broken)';
    END IF;
  END $$;
ROLLBACK;

-- Confirm normal anon read succeeds cleanly immediately after ROLLBACK
BEGIN;
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SET LOCAL ROLE anon;
  SELECT COUNT(*) INTO v_count FROM public.leaderboard_view;
  IF v_count < 1 THEN
    RAISE EXCEPTION 'Expected leaderboard_view to return valid ranked entries for anon after TX12 rollback, got %', v_count;
  END IF;
END $$;
COMMIT;

-- ============================================================================
-- TX 13: CLEANUP TEST HELPERS & FINAL SIGNAL
-- ============================================================================
BEGIN;
DROP TABLE IF EXISTS public._verify_state;
DROP TRIGGER IF EXISTS trg_test_force_replay_failure ON public.replays;
DROP FUNCTION IF EXISTS public.test_force_replay_failure();
DO $$
BEGIN
  RAISE NOTICE 'ALL_MIGRATION_INVARIANTS_PASSED';
END $$;
COMMIT;
