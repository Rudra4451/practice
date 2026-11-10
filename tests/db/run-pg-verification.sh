#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)

PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGPASSWORD="${PGPASSWORD:-postgres}"
export PGHOST PGPORT PGUSER PGPASSWORD

if ! command -v psql >/dev/null 2>&1; then
  if command -v docker >/dev/null 2>&1; then
    echo "psql not found on host; delegating verification to ephemeral postgres:16-alpine container via docker-compose.db.yml..."
    exec docker compose -f "$REPO_ROOT/docker-compose.db.yml" run --rm verify
  fi
  echo "ERROR: Neither 'psql' nor 'docker' is available on this host. Cannot execute PostgreSQL 16 verification." >&2
  exit 127
fi

if command -v pg_isready >/dev/null 2>&1; then
  attempt=0
  until pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 30 ]; then
      echo "ERROR: PostgreSQL at $PGHOST:$PGPORT did not become ready within 30s." >&2
      exit 1
    fi
    sleep 1
  done
fi

PG_VERSION_FULL=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -q -t -A -v ON_ERROR_STOP=1 -c "SELECT version();")
PG_VERSION_NUM=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -q -t -A -v ON_ERROR_STOP=1 -c "SHOW server_version_num;")
echo "Target PostgreSQL server: $PG_VERSION_FULL (server_version_num=$PG_VERSION_NUM)"
if [ "$PG_VERSION_NUM" -lt 160000 ]; then
  echo "ERROR: Expected PostgreSQL 16+ (server_version_num >= 160000), got $PG_VERSION_NUM." >&2
  exit 1
fi

# Verify supabase/migrations directory hygiene (strict 14-digit timestamp filenames, no stray reference scripts)
for mig in "$REPO_ROOT/supabase/migrations/"*; do
  [ -e "$mig" ] || continue
  mig_base=$(basename "$mig")
  case "$mig_base" in
    [0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]_*.sql) ;;
    *)
      echo "ERROR: Unexpected non-timestamped file inside supabase/migrations/: $mig_base" >&2
      exit 1
      ;;
  esac
done

if [ ! -f "$REPO_ROOT/supabase/reference/FULL_SCHEMA.sql" ]; then
  echo "ERROR: Missing reference fixture supabase/reference/FULL_SCHEMA.sql" >&2
  exit 1
fi

if [ -e "$REPO_ROOT/supabase/migrations/FULL_SCHEMA.sql" ] \
   || [ -e "$REPO_ROOT/supabase/migrations/20260623000000_atomic_result_persistence_and_idempotency.sql" ] \
   || [ -e "$REPO_ROOT/supabase/migrations/20260624000000_phase1c_security_and_streak_fixes.sql" ]; then
  echo "ERROR: Deprecated unapplied migration script or FULL_SCHEMA.sql still exists in supabase/migrations/." >&2
  exit 1
fi

TEST_DB_CLEAN="typrox_verify_clean_$$"
TEST_DB_LEGACY="typrox_verify_legacy_$$"
TEST_DB_RERUN="typrox_verify_rerun_$$"
RACE_OUT_1=$(mktemp)
RACE_OUT_2=$(mktemp)
RACE_ERR_1=$(mktemp)
RACE_ERR_2=$(mktemp)
PID1=""
PID2=""

cleanup() {
  if [ -n "${PID1:-}" ]; then
    kill "$PID1" >/dev/null 2>&1 || true
    wait "$PID1" >/dev/null 2>&1 || true
  fi
  if [ -n "${PID2:-}" ]; then
    kill "$PID2" >/dev/null 2>&1 || true
    wait "$PID2" >/dev/null 2>&1 || true
  fi
  rm -f "${RACE_OUT_1:-}" "${RACE_OUT_2:-}" "${RACE_ERR_1:-}" "${RACE_ERR_2:-}"
  for db in "$TEST_DB_CLEAN" "$TEST_DB_LEGACY" "$TEST_DB_RERUN"; do
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 \
      -c "DROP DATABASE IF EXISTS \"$db\" WITH (FORCE);" >/dev/null 2>&1 || true
  done
}
trap cleanup EXIT INT TERM

create_ephemeral_db() {
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS \"$1\" WITH (FORCE);" >/dev/null
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 \
    -c "CREATE DATABASE \"$1\";" >/dev/null
}

apply_sql_file() {
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$1" -v ON_ERROR_STOP=1 -f "$2" >/dev/null
}

# ============================================================================
# SCENARIO 1: CLEAN BOOTSTRAP (20260618..20260622) + FULL SUITE + CONTENTION
# ============================================================================
echo "[Scenario 1/3] Creating clean verification database: $TEST_DB_CLEAN"
create_ephemeral_db "$TEST_DB_CLEAN"

echo "[Scenario 1/3] Applying compatibility shim and migrations 20260618..20260622..."
for sql_file in \
  "$REPO_ROOT/tests/db/supabase_shim.sql" \
  "$REPO_ROOT/supabase/migrations/20260618000000_init_schema.sql" \
  "$REPO_ROOT/supabase/migrations/20260619000000_audit_hardening.sql" \
  "$REPO_ROOT/supabase/migrations/20260620100000_leaderboard_view.sql" \
  "$REPO_ROOT/supabase/migrations/20260621000000_typrox_2_hardening.sql" \
  "$REPO_ROOT/supabase/migrations/20260622000000_learning_and_competitive_ecosystem.sql"
do
  echo "  -> $(basename "$sql_file")"
  apply_sql_file "$TEST_DB_CLEAN" "$sql_file"
done

echo "[Scenario 1/3] Running SQL invariant suite (verify_migrations.sql)..."
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB_CLEAN" -v ON_ERROR_STOP=1 -f "$REPO_ROOT/tests/db/verify_migrations.sql"

echo "[Scenario 1/3] Running deterministic 2-worker concurrent duplicate-submission contention test..."
RACE_USER="66666666-6666-4666-8666-666666666666"
RACE_RUN_ID="77777777-7777-4777-8777-777777777777"

psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB_CLEAN" -v ON_ERROR_STOP=1 >/dev/null <<EOF
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('$RACE_USER', 'race@typrox.test', '{"username":"race_worker"}'::jsonb);

CREATE TABLE public.test_race_evidence (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  worker1_backend_pid INTEGER NOT NULL,
  worker2_blocked_observed BOOLEAN NOT NULL DEFAULT FALSE,
  observed_wait_event TEXT,
  observed_at TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION public.test_race_barrier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS \$fn\$
DECLARE
  v_wait_event TEXT;
  v_attempts INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(4200, 99002);

  FOR v_attempts IN 1..160 LOOP
    SELECT sa.wait_event
    INTO v_wait_event
    FROM pg_stat_activity sa
    WHERE sa.datname = current_database()
      AND sa.pid <> pg_backend_pid()
      AND sa.application_name = 'typrox_race_worker_2'
      AND sa.state = 'active'
      AND sa.wait_event_type = 'Lock'
      AND sa.wait_event IN ('transactionid', 'tuple')
    LIMIT 1;

    IF v_wait_event IS NOT NULL THEN
      INSERT INTO public.test_race_evidence (
        id, worker1_backend_pid, worker2_blocked_observed, observed_wait_event, observed_at
      )
      VALUES (1, pg_backend_pid(), TRUE, v_wait_event, clock_timestamp())
      ON CONFLICT (id) DO UPDATE
      SET worker2_blocked_observed = TRUE,
          observed_wait_event = EXCLUDED.observed_wait_event,
          observed_at = EXCLUDED.observed_at;
      RETURN NEW;
    END IF;

    PERFORM pg_sleep(0.05);
  END LOOP;

  RAISE EXCEPTION 'RACE_BARRIER_TIMEOUT: Worker 2 never entered unique-index Lock contention within 8s';
END;
\$fn\$;

DROP TRIGGER IF EXISTS trg_test_race_barrier ON public.test_results;
CREATE TRIGGER trg_test_race_barrier
  AFTER INSERT ON public.test_results
  FOR EACH ROW
  WHEN (NEW.seed = 'race_seed_1' AND NEW.user_id = '$RACE_USER'::uuid)
  EXECUTE FUNCTION public.test_race_barrier();
EOF

psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB_CLEAN" -q -t -A -v ON_ERROR_STOP=1 <<EOF > "$RACE_OUT_1" 2> "$RACE_ERR_1" &
SET statement_timeout = '15s';
SET lock_timeout = '10s';
SET application_name = 'typrox_race_worker_1';
BEGIN;
SET LOCAL ROLE service_role;
SELECT public.submit_verified_result('$RACE_USER'::uuid, 92, 95, 98, 92, 0, 0, 'words', 30, 'race_seed_1', '$RACE_RUN_ID'::uuid, '[{"t":0,"k":"r","y":0,"i":0},{"t":135,"k":"a","y":0,"i":1}]'::jsonb, TRUE)::text;
COMMIT;
EOF
PID1=$!

psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB_CLEAN" -q -t -A -v ON_ERROR_STOP=1 <<EOF > "$RACE_OUT_2" 2> "$RACE_ERR_2" &
SET statement_timeout = '15s';
SET lock_timeout = '10s';
SET application_name = 'typrox_race_worker_2';
DO \$wait_barrier\$
DECLARE
  v_attempts INTEGER;
  v_ready BOOLEAN := FALSE;
BEGIN
  FOR v_attempts IN 1..160 LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_locks l
      JOIN pg_database d ON d.oid = l.database
      WHERE d.datname = current_database()
        AND l.locktype = 'advisory'
        AND l.classid = 4200
        AND l.objid = 99002
        AND l.granted = TRUE
    ) THEN
      v_ready := TRUE;
      EXIT;
    END IF;
    PERFORM pg_sleep(0.05);
  END LOOP;

  IF NOT v_ready THEN
    RAISE EXCEPTION 'WORKER2_BARRIER_TIMEOUT: Worker 1 never held barrier advisory lock (4200, 99002)';
  END IF;
END \$wait_barrier\$;
BEGIN;
SET LOCAL ROLE service_role;
SELECT public.submit_verified_result('$RACE_USER'::uuid, 92, 95, 98, 92, 0, 0, 'words', 30, 'race_seed_1', '$RACE_RUN_ID'::uuid, '[{"t":0,"k":"r","y":0,"i":0},{"t":135,"k":"a","y":0,"i":1}]'::jsonb, TRUE)::text;
COMMIT;
EOF
PID2=$!

RC1=0
RC2=0
wait "$PID1" || RC1=$?
PID1=""
wait "$PID2" || RC2=$?
PID2=""

if [ "$RC1" -ne 0 ] || [ "$RC2" -ne 0 ]; then
  echo "ERROR: Concurrent race workers failed (worker1_exit=$RC1, worker2_exit=$RC2)." >&2
  cat "$RACE_OUT_1" "$RACE_ERR_1" "$RACE_OUT_2" "$RACE_ERR_2" >&2 || true
  exit 1
fi

OUT1=$(tr -d '\r\n' < "$RACE_OUT_1")
OUT2=$(tr -d '\r\n' < "$RACE_OUT_2")
OUT1_SQL=$(printf '%s' "$OUT1" | sed "s/'/''/g")
OUT2_SQL=$(printf '%s' "$OUT2" | sed "s/'/''/g")

CONTENTION_EVENT=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB_CLEAN" -q -t -A -v ON_ERROR_STOP=1 <<EOF
DO \$\$
DECLARE
  v_results INTEGER;
  v_replays INTEGER;
  v_streak INTEGER;
  v_achievements INTEGER;
  v_evidence public.test_race_evidence%ROWTYPE;
  v_j1 JSONB := '${OUT1_SQL}'::jsonb;
  v_j2 JSONB := '${OUT2_SQL}'::jsonb;
BEGIN
  SELECT * INTO v_evidence FROM public.test_race_evidence WHERE id = 1;
  IF NOT FOUND OR NOT v_evidence.worker2_blocked_observed OR v_evidence.observed_wait_event NOT IN ('transactionid', 'tuple') THEN
    RAISE EXCEPTION 'Deterministic lock contention was NOT proven in pg_stat_activity (evidence=%)', v_evidence;
  END IF;

  SELECT COUNT(*) INTO v_results
  FROM public.test_results
  WHERE user_id = '$RACE_USER'::uuid AND client_run_id = '$RACE_RUN_ID'::uuid;
  SELECT COUNT(*) INTO v_replays
  FROM public.replays rp
  JOIN public.test_results tr ON tr.id = rp.test_result_id
  WHERE tr.user_id = '$RACE_USER'::uuid;
  SELECT current_streak INTO v_streak
  FROM public.streaks
  WHERE user_id = '$RACE_USER'::uuid;
  SELECT COUNT(*) INTO v_achievements
  FROM public.user_achievements
  WHERE user_id = '$RACE_USER'::uuid;

  IF v_results <> 1 THEN RAISE EXCEPTION 'Concurrent race created % test_results rows instead of 1', v_results; END IF;
  IF v_replays <> 1 THEN RAISE EXCEPTION 'Concurrent race created % replays rows instead of 1', v_replays; END IF;
  IF v_streak <> 1 THEN RAISE EXCEPTION 'Concurrent race produced streak=% instead of 1', v_streak; END IF;
  IF v_achievements <> 3 THEN RAISE EXCEPTION 'Concurrent race produced % unlocked user_achievements instead of 3', v_achievements; END IF;

  IF (v_j1->'result'->>'id') IS DISTINCT FROM (v_j2->'result'->>'id') THEN
    RAISE EXCEPTION 'Concurrent workers returned mismatched result IDs: % vs %', v_j1->'result'->>'id', v_j2->'result'->>'id';
  END IF;

  IF (v_j1->>'deduplicated')::boolean IS NOT FALSE
     OR (v_j1->>'recoveredPartialWrite')::boolean IS NOT FALSE
     OR (v_j1->>'streakDays')::integer <> 1
     OR jsonb_array_length(v_j1->'unlocked') < 1
     OR NOT ((v_j1->'unlocked') @> '["Bronze Fingers"]'::jsonb)
     OR NOT ((v_j1->'unlocked') @> '["Silver Fingers"]'::jsonb) THEN
    RAISE EXCEPTION 'Worker 1 (winner) payload invariant violated: %', v_j1;
  END IF;

  IF (v_j2->>'deduplicated')::boolean IS NOT TRUE
     OR (v_j2->>'recoveredPartialWrite')::boolean IS NOT FALSE
     OR (v_j2->>'streakDays')::integer <> 1
     OR (v_j2->'unlocked') <> '[]'::jsonb THEN
    RAISE EXCEPTION 'Worker 2 (duplicate contention loser) payload invariant violated: %', v_j2;
  END IF;
END \$\$;

SELECT observed_wait_event FROM public.test_race_evidence WHERE id = 1;
EOF
)

psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB_CLEAN" -v ON_ERROR_STOP=1 -c "
  DROP TRIGGER IF EXISTS trg_test_race_barrier ON public.test_results;
  DROP FUNCTION IF EXISTS public.test_race_barrier();
  DROP TABLE IF EXISTS public.test_race_evidence;
" >/dev/null
echo "  -> Deterministic contention proven via pg_stat_activity Lock wait_event='$CONTENTION_EVENT'."

# ============================================================================
# SCENARIO 2: FULL_SCHEMA.sql LEGACY BASELINE + DIRTY HISTORICAL DATA UPGRADE
# ============================================================================
echo "[Scenario 2/3] Creating FULL_SCHEMA.sql upgrade verification database: $TEST_DB_LEGACY"
create_ephemeral_db "$TEST_DB_LEGACY"

apply_sql_file "$TEST_DB_LEGACY" "$REPO_ROOT/tests/db/supabase_shim.sql"
apply_sql_file "$TEST_DB_LEGACY" "$REPO_ROOT/supabase/reference/FULL_SCHEMA.sql"

echo "[Scenario 2/3] Seeding legacy production-like anomalies, rogue SQL function & stuck streak..."
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB_LEGACY" -v ON_ERROR_STOP=1 >/dev/null <<'EOF'
DO $$
DECLARE
  v_indpred PG_NODE_TREE;
BEGIN
  SELECT ix.indpred INTO v_indpred
  FROM pg_class ic
  JOIN pg_index ix ON ix.indexrelid = ic.oid
  JOIN pg_namespace n ON n.oid = ic.relnamespace
  WHERE n.nspname = 'public' AND ic.relname = 'idx_test_results_leaderboard';

  IF v_indpred IS NOT NULL THEN
    RAISE EXCEPTION 'Expected FULL_SCHEMA.sql baseline idx_test_results_leaderboard to be unfiltered';
  END IF;
END $$;

-- Simulate unexpected out-of-band SQL Editor helper function granted to PUBLIC/anon/authenticated
CREATE OR REPLACE FUNCTION public.legacy_sql_editor_helper()
RETURNS TEXT
LANGUAGE SQL
AS $$
  SELECT 'exposed_before_hardening'::text;
$$;
GRANT ALL ON FUNCTION public.legacy_sql_editor_helper() TO PUBLIC, anon, authenticated;

-- Seed two legacy users (one with mixed-case handle; both start with streak=0 and non-null last_active_date)
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  ('99990001-9999-4999-8999-999900010001', 'legacy1@typrox.test', '{"username": "LegacyMixed", "display_name": "Legacy One"}'::jsonb),
  ('99990002-9999-4999-8999-999900020002', 'legacy2@typrox.test', '{"display_name": "Legacy Two"}'::jsonb);

-- Seed 8 legacy test_results rows mirroring BATCH_1_1A anomalies + valid ranked baseline
INSERT INTO public.test_results (id, user_id, wpm, raw_wpm, accuracy, consistency, error_count, backspace_count, mode, duration, seed, is_invalidated, created_at)
VALUES
  ('99991001-9999-4999-8999-999910010001', NULL, 62, 65, 96, 88, 1, 0, 'words', 30, 'legacy_debug', FALSE, timezone('utc'::text, now()) - interval '90 days'),
  ('99991002-9999-4999-8999-999910020002', '99990001-9999-4999-8999-999900010001', 80, 200, 100, 90, 0, 0, 'words', 30, 'legacy_1key', FALSE, timezone('utc'::text, now()) - interval '89 days'),
  ('99991003-9999-4999-8999-999910030003', '99990001-9999-4999-8999-999900010001', 45, 226, 4, 15, 543, 0, 'words', 30, 'legacy_spam', FALSE, timezone('utc'::text, now()) - interval '88 days'),
  ('99991004-9999-4999-8999-999910040004', '99990001-9999-4999-8999-999900010001', 90, 95, 97, 92, 0, 0, 'words', 30, 'legacy_fast_abort', FALSE, timezone('utc'::text, now()) - interval '87 days'),
  ('99991005-9999-4999-8999-999910050005', '99990001-9999-4999-8999-999900010001', 94, 96, 98, 93, 0, 0, 'quotes', 30, 'legacy_short_quote', FALSE, timezone('utc'::text, now()) - interval '86 days'),
  ('99991006-9999-4999-8999-999910060006', '99990001-9999-4999-8999-999900010001', 85, 88, 96, 91, 1, 1, 'words', 30, 'legacy_tuple_short', FALSE, timezone('utc'::text, now()) - interval '85 days'),
  ('99991007-9999-4999-8999-999910070007', '99990001-9999-4999-8999-999900010001', 72, 75, 96, 91, 1, 1, 'words', 30, 'legacy_valid_words', FALSE, timezone('utc'::text, now()) - interval '84 days'),
  ('99991008-9999-4999-8999-999910080008', '99990001-9999-4999-8999-999900010001', 72, 75, 96, 91, 1, 1, 'words', 30, 'legacy_valid_words', FALSE, timezone('utc'::text, now()) - interval '84 days');

INSERT INTO public.replays (test_result_id, telemetry)
VALUES
  ('99991002-9999-4999-8999-999910020002', '[{"t":0,"k":"a","y":0,"i":0}]'::jsonb),
  ('99991003-9999-4999-8999-999910030003', '[{"t":0,"k":"a"},{"t":2000,"k":"b"},{"t":4000,"k":"c"},{"t":6000,"k":"d"},{"t":8000,"k":"e"},{"t":10000,"k":"f"},{"t":12000,"k":"g"},{"t":14000,"k":"h"},{"t":16000,"k":"i"},{"t":18000,"k":"j"}]'::jsonb),
  ('99991004-9999-4999-8999-999910040004', '[{"t":0,"k":"a"},{"t":270,"k":"b"},{"t":541,"k":"c"}]'::jsonb),
  ('99991005-9999-4999-8999-999910050005', '[{"t":0,"k":"a"},{"t":360,"k":"b"},{"t":720,"k":"c"},{"t":1080,"k":"d"},{"t":1440,"k":"e"},{"t":1800,"k":"f"},{"t":2160,"k":"g"},{"t":2520,"k":"h"},{"t":2880,"k":"i"},{"t":3240,"k":"j"},{"t":3600,"k":"k"},{"t":3974,"k":"l"}]'::jsonb),
  ('99991006-9999-4999-8999-999910060006', '[[0,"a",1,0],[240,"b",1,1],[240,"c",1,2],[240,"d",1,3],[240,"e",1,4],[240,"f",1,5],[240,"g",1,6],[240,"h",1,7],[240,"i",1,8],[240,"j",1,9],[240,"k",1,10]]'::jsonb),
  ('99991007-9999-4999-8999-999910070007', '[{"t":0,"k":"a"},{"t":1000,"k":"b"},{"t":2000,"k":"c"},{"t":3000,"k":"d"},{"t":4000,"k":"e"},{"t":5000,"k":"f"},{"t":6000,"k":"g"},{"t":7000,"k":"h"},{"t":8000,"k":"i"},{"t":9000,"k":"j"},{"t":10000,"k":"k"},{"t":11000,"k":"l"}]'::jsonb),
  ('99991008-9999-4999-8999-999910080008', '[{"t":0,"k":"a"},{"t":1000,"k":"b"},{"t":2000,"k":"c"},{"t":3000,"k":"d"},{"t":4000,"k":"e"},{"t":5000,"k":"f"},{"t":6000,"k":"g"},{"t":7000,"k":"h"},{"t":8000,"k":"i"},{"t":9000,"k":"j"},{"t":10000,"k":"k"},{"t":11000,"k":"l"}]'::jsonb);
EOF

echo "[Scenario 2/3] Upgrading FULL_SCHEMA.sql DB with 20260621..20260622..."
apply_sql_file "$TEST_DB_LEGACY" "$REPO_ROOT/supabase/migrations/20260621000000_typrox_2_hardening.sql"
apply_sql_file "$TEST_DB_LEGACY" "$REPO_ROOT/supabase/migrations/20260622000000_learning_and_competitive_ecosystem.sql"

echo "[Scenario 2/3] Verifying non-destructive quarantine, mixed-case prefs, function sweep & self-healing streak..."
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB_LEGACY" -v ON_ERROR_STOP=1 >/dev/null <<'EOF'
BEGIN;
DO $$
DECLARE
  v_total INTEGER;
  v_unranked INTEGER;
  v_ranked INTEGER;
  v_invalidated INTEGER;
  v_ach_name TEXT;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.test_results;
  SELECT COUNT(*) INTO v_invalidated FROM public.test_results WHERE is_invalidated = TRUE;
  SELECT COUNT(*) INTO v_unranked FROM public.test_results WHERE is_ranked = FALSE;
  SELECT COUNT(*) INTO v_ranked FROM public.test_results WHERE is_ranked = TRUE;

  IF v_total <> 8 OR v_invalidated <> 0 OR v_unranked <> 6 OR v_ranked <> 2 THEN
    RAISE EXCEPTION 'Non-destructive quarantine counts mismatched (total=%, invalid=%, unranked=%, ranked=%)', v_total, v_invalidated, v_unranked, v_ranked;
  END IF;

  IF EXISTS (SELECT 1 FROM public.test_results WHERE id IN (
      '99991001-9999-4999-8999-999910010001'::uuid,
      '99991002-9999-4999-8999-999910020002'::uuid,
      '99991003-9999-4999-8999-999910030003'::uuid,
      '99991004-9999-4999-8999-999910040004'::uuid,
      '99991005-9999-4999-8999-999910050005'::uuid,
      '99991006-9999-4999-8999-999910060006'::uuid
  ) AND is_ranked = TRUE) THEN
    RAISE EXCEPTION 'At least one Category A-F / short-tuple outlier remained ranked';
  END IF;

  IF EXISTS (SELECT 1 FROM public.test_results WHERE id IN (
      '99991007-9999-4999-8999-999910070007'::uuid,
      '99991008-9999-4999-8999-999910080008'::uuid
  ) AND is_ranked = FALSE) THEN
    RAISE EXCEPTION 'Valid legacy ranked runs were falsely unranked';
  END IF;

  SELECT name INTO v_ach_name FROM public.achievements WHERE code = 'SPEED_50';
  IF v_ach_name IS DISTINCT FROM 'Keyboard Apprentice' THEN
    RAISE EXCEPTION 'ON CONFLICT (code) DO NOTHING failed to preserve existing FULL_SCHEMA achievement name: %', v_ach_name;
  END IF;
END $$;
COMMIT;

BEGIN;
DO $$
DECLARE
  v_count INTEGER;
  v_raised BOOLEAN;
  v_wpm REAL;
BEGIN
  SET LOCAL ROLE anon;
  SELECT COUNT(*), MAX(wpm) INTO v_count, v_wpm
  FROM public.leaderboard_view
  WHERE user_id = '99990001-9999-4999-8999-999900010001'::uuid;
  IF v_count <> 1 OR v_wpm IS DISTINCT FROM 72 THEN
    RAISE EXCEPTION 'Expected exactly 1 valid 72 WPM entry for legacy user (count=%, wpm=%)', v_count, v_wpm;
  END IF;

  v_raised := FALSE;
  BEGIN
    PERFORM public.legacy_sql_editor_helper();
  EXCEPTION WHEN insufficient_privilege THEN
    v_raised := TRUE;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'Dynamic pg_proc sweep failed to revoke anon EXECUTE on legacy_sql_editor_helper';
  END IF;
END $$;
COMMIT;

BEGIN;
DO $$
DECLARE
  v_legacy_user UUID := '99990001-9999-4999-8999-999900010001';
  v_row_count INTEGER;
  v_raised BOOLEAN;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', v_legacy_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  -- Mixed-case legacy username must still allow own non-username profile updates
  UPDATE public.profiles SET display_name = 'Legacy Kept', theme = 'light' WHERE id = v_legacy_user;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count <> 1 THEN
    RAISE EXCEPTION 'Legacy mixed-case profile preference update failed (rows=%)', v_row_count;
  END IF;

  v_raised := FALSE;
  BEGIN
    PERFORM public.legacy_sql_editor_helper();
  EXCEPTION WHEN insufficient_privilege THEN
    v_raised := TRUE;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'Dynamic pg_proc sweep failed to revoke authenticated EXECUTE on legacy_sql_editor_helper';
  END IF;
END $$;
COMMIT;

BEGIN;
DO $$
DECLARE
  v_legacy_user UUID := '99990001-9999-4999-8999-999900010001';
  v_resp JSONB;
BEGIN
  SET LOCAL ROLE service_role;
  v_resp := public.submit_verified_result(
    v_legacy_user, 65, 68, 97, 92, 0, 1, 'quotes', 30, 'legacy_quote_follow',
    '99992001-9999-4999-8999-999920010001'::uuid,
    '[{"t":0,"k":"a","y":0,"i":0},{"t":150,"k":"b","y":0,"i":1}]'::jsonb,
    TRUE
  );
  IF (v_resp->>'streakDays')::integer <> 1
     OR (v_resp->>'isPersonalBest')::boolean IS NOT TRUE
     OR (v_resp->'previousBestWpm') <> 'null'::jsonb THEN
    RAISE EXCEPTION 'Legacy user streak self-heal or quarantined PB exclusion failed: %', v_resp;
  END IF;
END $$;
COMMIT;
EOF

echo "[Scenario 2/3] Running full verify_migrations.sql suite on upgraded FULL_SCHEMA.sql database..."
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB_LEGACY" -v ON_ERROR_STOP=1 -f "$REPO_ROOT/tests/db/verify_migrations.sql"

# ============================================================================
# SCENARIO 3: INDEX DRIFT RECONCILIATION + DOUBLE RERUN IDEMPOTENCY
# ============================================================================
echo "[Scenario 3/3] Creating drift & double-rerun idempotency database: $TEST_DB_RERUN"
create_ephemeral_db "$TEST_DB_RERUN"

for sql_file in \
  "$REPO_ROOT/tests/db/supabase_shim.sql" \
  "$REPO_ROOT/supabase/migrations/20260618000000_init_schema.sql" \
  "$REPO_ROOT/supabase/migrations/20260619000000_audit_hardening.sql" \
  "$REPO_ROOT/supabase/migrations/20260620100000_leaderboard_view.sql" \
  "$REPO_ROOT/supabase/migrations/20260621000000_typrox_2_hardening.sql" \
  "$REPO_ROOT/supabase/migrations/20260622000000_learning_and_competitive_ecosystem.sql"
do
  apply_sql_file "$TEST_DB_RERUN" "$sql_file"
done

echo "[Scenario 3/3] Injecting synthetic index & constraint drift, then executing 2 sequential reruns..."
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB_RERUN" -v ON_ERROR_STOP=1 >/dev/null <<'EOF'
DROP INDEX public.idx_test_results_leaderboard;
CREATE INDEX idx_test_results_leaderboard
  ON public.test_results(mode, duration, is_invalidated, wpm DESC)
  WHERE user_id IS NOT NULL AND is_invalidated = FALSE;
ALTER TABLE public.test_results ADD CONSTRAINT test_results_client_run_id_key UNIQUE (client_run_id);
EOF

apply_sql_file "$TEST_DB_RERUN" "$REPO_ROOT/supabase/migrations/20260621000000_typrox_2_hardening.sql"
apply_sql_file "$TEST_DB_RERUN" "$REPO_ROOT/supabase/migrations/20260622000000_learning_and_competitive_ecosystem.sql"

IDX_OID_BEFORE=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB_RERUN" -q -t -A -v ON_ERROR_STOP=1 \
  -c "SELECT 'public.idx_test_results_leaderboard'::regclass::oid::text;")

apply_sql_file "$TEST_DB_RERUN" "$REPO_ROOT/supabase/migrations/20260621000000_typrox_2_hardening.sql"
apply_sql_file "$TEST_DB_RERUN" "$REPO_ROOT/supabase/migrations/20260622000000_learning_and_competitive_ecosystem.sql"

IDX_OID_AFTER=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB_RERUN" -q -t -A -v ON_ERROR_STOP=1 \
  -c "SELECT 'public.idx_test_results_leaderboard'::regclass::oid::text;")

if [ "$IDX_OID_BEFORE" != "$IDX_OID_AFTER" ]; then
  echo "ERROR: Exact-match idx_test_results_leaderboard was needlessly dropped and rebuilt on clean rerun ($IDX_OID_BEFORE vs $IDX_OID_AFTER)." >&2
  exit 1
fi

echo "[Scenario 3/3] Running full verify_migrations.sql suite after double rerun..."
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB_RERUN" -v ON_ERROR_STOP=1 -f "$REPO_ROOT/tests/db/verify_migrations.sql"

echo "SUCCESS: All PostgreSQL 16 scenarios (Clean + Contention, FULL_SCHEMA Upgrade + Quarantine, Drift + Double Rerun) passed."
