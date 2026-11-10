-- ============================================================================
-- Local PostgreSQL 16 Supabase Compatibility Shim for Migration Verification
-- ============================================================================
-- Provides minimal auth schema/functions, roles, and publication needed to run
-- TyProX SQL migrations sequentially against a vanilla postgres:16 database.
-- Enforces authentic role identity isolation between anon, authenticated, and
-- service_role so security assertions cannot leak leftover JWT claims.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  raw_user_meta_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

REVOKE ALL ON ALL TABLES IN SCHEMA auth FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE auth.users FROM PUBLIC, anon, authenticated;

-- Mirrors Supabase JWT subject behavior:
-- * `anon` NEVER possesses an authenticated user UUID even if stale GUCs linger.
-- * `authenticated` resolves `request.jwt.claim.sub` (or JSON `request.jwt.claims->>'sub'`),
--   returning NULL when no JWT subject claim is present.
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT CASE
    WHEN current_user = 'anon' THEN NULL::uuid
    ELSE COALESCE(
      NULLIF(current_setting('request.jwt.claim.sub', true), ''),
      NULLIF(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')
    )::uuid
  END;
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT CASE
    WHEN current_user IN ('anon', 'authenticated', 'service_role') THEN current_user::text
    ELSE COALESCE(
      NULLIF(current_setting('request.jwt.claim.role', true), ''),
      NULLIF(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', ''),
      current_user::text
    )
  END;
$$;

REVOKE ALL ON FUNCTION auth.uid() FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth.uid() TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.role() TO postgres, anon, authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Mirrors hosted Supabase default privileges where new postgres functions in public
-- are granted EXECUTE to PUBLIC, anon, authenticated, and service_role unless explicitly revoked.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL PRIVILEGES ON FUNCTIONS TO PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL PRIVILEGES ON FUNCTIONS TO anon, authenticated, service_role;
