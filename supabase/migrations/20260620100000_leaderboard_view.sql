-- ================================================================
-- LEADERBOARD VIEW MIGRATION
-- ================================================================
-- This view fetches the single highest WPM run for each user, mode,
-- and duration to prevent multiple runs from the same user from
-- cluttering the leaderboard.
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

-- Grant access privileges
GRANT SELECT ON public.leaderboard_view TO anon, authenticated, service_role;
