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

TEST_DB="typrox_verify_$$"
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
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS \"$TEST_DB\" WITH (FORCE);" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "[1/4] Creating ephemeral verification database: $TEST_DB"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS \"$TEST_DB\" WITH (FORCE);" >/dev/null
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE \"$TEST_DB\";" >/dev/null

echo "[2/4] Applying Supabase compatibility shim and migrations 20260618..20260624..."
for sql_file in \
  "$REPO_ROOT/tests/db/supabase_shim.sql" \
  "$REPO_ROOT/supabase/migrations/20260618000000_init_schema.sql" \
  "$REPO_ROOT/supabase/migrations/20260619000000_audit_hardening.sql" \
  "$REPO_ROOT/supabase/migrations/20260620100000_leaderboard_view.sql" \
  "$REPO_ROOT/supabase/migrations/20260621000000_typrox_2_hardening.sql" \
  "$REPO_ROOT/supabase/migrations/20260622000000_learning_and_competitive_ecosystem.sql" \
  "$REPO_ROOT/supabase/migrations/20260623000000_atomic_result_persistence_and_idempotency.sql" \
  "$REPO_ROOT/supabase/migrations/20260624000000_phase1c_security_and_streak_fixes.sql"
do
  echo "  -> $(basename "$sql_file")"
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB" -v ON_ERROR_STOP=1 -f "$sql_file" >/dev/null
done

echo "[3/4] Running SQL invariant verification suite (verify_migrations.sql)..."
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB" -v ON_ERROR_STOP=1 -f "$REPO_ROOT/tests/db/verify_migrations.sql"

echo "[4/4] Running deterministic 2-worker concurrent duplicate-submission contention test..."
RACE_USER="66666666-6666-4666-8666-666666666666"
RACE_RUN_ID="77777777-7777-4777-8777-777777777777"

psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB" -v ON_ERROR_STOP=1 >/dev/null <<EOF
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
  -- Publish transaction-scoped advisory lock BEFORE committing Worker 1 so
  -- Worker 2 enters Step 3C only while Worker 1's uncommitted row holds the index lock.
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

psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB" -q -t -A -v ON_ERROR_STOP=1 <<EOF > "$RACE_OUT_1" 2> "$RACE_ERR_1" &
SET statement_timeout = '15s';
SET lock_timeout = '10s';
SET application_name = 'typrox_race_worker_1';
BEGIN;
SET LOCAL ROLE service_role;
SELECT public.submit_verified_result('$RACE_USER'::uuid, 92, 95, 98, 92, 0, 0, 'words', 30, 'race_seed_1', '$RACE_RUN_ID'::uuid, '[{"t":0,"k":"r","y":0,"i":0},{"t":135,"k":"a","y":0,"i":1}]'::jsonb, TRUE)::text;
COMMIT;
EOF
PID1=$!

psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB" -q -t -A -v ON_ERROR_STOP=1 <<EOF > "$RACE_OUT_2" 2> "$RACE_ERR_2" &
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
  echo "--- Worker 1 stdout ---" >&2
  cat "$RACE_OUT_1" >&2 || true
  echo "--- Worker 1 stderr ---" >&2
  cat "$RACE_ERR_1" >&2 || true
  echo "--- Worker 2 stdout ---" >&2
  cat "$RACE_OUT_2" >&2 || true
  echo "--- Worker 2 stderr ---" >&2
  cat "$RACE_ERR_2" >&2 || true
  exit 1
fi

OUT1=$(tr -d '\r\n' < "$RACE_OUT_1")
OUT2=$(tr -d '\r\n' < "$RACE_OUT_2")
OUT1_SQL=$(printf '%s' "$OUT1" | sed "s/'/''/g")
OUT2_SQL=$(printf '%s' "$OUT2" | sed "s/'/''/g")

CONTENTION_EVENT=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB" -q -t -A -v ON_ERROR_STOP=1 <<EOF
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

  IF v_results <> 1 THEN
    RAISE EXCEPTION 'Concurrent race created % test_results rows instead of 1', v_results;
  END IF;
  IF v_replays <> 1 THEN
    RAISE EXCEPTION 'Concurrent race created % replays rows instead of 1', v_replays;
  END IF;
  IF v_streak <> 1 THEN
    RAISE EXCEPTION 'Concurrent race produced streak=% instead of 1', v_streak;
  END IF;
  IF v_achievements <> 3 THEN
    RAISE EXCEPTION 'Concurrent race produced % unlocked user_achievements instead of 3', v_achievements;
  END IF;

  IF (v_j1->'result'->>'id') IS DISTINCT FROM (v_j2->'result'->>'id') THEN
    RAISE EXCEPTION 'Concurrent workers returned mismatched result IDs: % vs %', v_j1->'result'->>'id', v_j2->'result'->>'id';
  END IF;

  IF (v_j1->>'deduplicated')::boolean IS NOT FALSE
     OR (v_j1->>'recoveredPartialWrite')::boolean IS NOT FALSE
     OR (v_j1->>'streakDays')::integer <> 1
     OR jsonb_array_length(v_j1->'unlocked') < 1
     OR NOT ((v_j1->'unlocked') @> '["Bronze Fingers"]'::jsonb) THEN
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

psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB" -v ON_ERROR_STOP=1 -c "
  DROP TRIGGER IF EXISTS trg_test_race_barrier ON public.test_results;
  DROP FUNCTION IF EXISTS public.test_race_barrier();
  DROP TABLE IF EXISTS public.test_race_evidence;
" >/dev/null

echo "  -> Deterministic contention proven via pg_stat_activity Lock wait_event='$CONTENTION_EVENT' (1 result, 1 replay, streak=1, loser unlocked=[])."
echo "SUCCESS: All PostgreSQL 16 migrations (20260618..20260624), security boundaries, and deterministic concurrency invariants passed."
