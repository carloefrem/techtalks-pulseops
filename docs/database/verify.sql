-- PulseOps schema verification (PULSE-25). Negative and positive cases.
-- How to run: on an EMPTY scratch database, first run schema.sql, then this file
-- (pgAdmin Query Tool, or: psql -d pulseops_scratch -f schema.sql -f verify.sql).
-- Every check prints "PASS ..." as a NOTICE; the first failure stops with an ERROR.
-- Everything runs inside one transaction that is rolled back at the end, so no data is left behind.

BEGIN;

-- expect_error(label, sql, sqlstate): passes only if the SQL fails with that error code.
CREATE FUNCTION pg_temp.expect_error(label text, stmt text, code text) RETURNS void AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = code THEN RAISE NOTICE 'PASS (rejected) %', label; RETURN; END IF;
    RAISE EXCEPTION 'FAIL %: expected %, got % (%)', label, code, SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'FAIL %: statement was accepted', label;
END $$ LANGUAGE plpgsql;

CREATE FUNCTION pg_temp.expect(label text, ok boolean) RETURNS void AS $$
BEGIN
  IF ok THEN RAISE NOTICE 'PASS %', label; ELSE RAISE EXCEPTION 'FAIL %', label; END IF;
END $$ LANGUAGE plpgsql;

-- Fixed IDs keep the cases readable.
INSERT INTO users (id, email, password_hash) OVERRIDING SYSTEM VALUE
  VALUES (101, 'Owner@Example.com', 'h'), (102, 'other@example.com', 'h');
INSERT INTO monitors (id, user_id, name, url, url_normalized) OVERRIDING SYSTEM VALUE VALUES
  (201, 101, 'api',   'https://Example.com:443/health', 'https://example.com/health'),
  (202, 101, 'other', 'https://other.test/',            'https://other.test/'),
  (203, 102, 'b-api', 'https://example.com/health',     'https://example.com/health');  -- other user, same URL: allowed
INSERT INTO check_results (id, monitor_id, trigger, checked_at, outcome, http_status, duration_ms, response_time_ms, error_message)
  OVERRIDING SYSTEM VALUE VALUES
  (301, 201, 'scheduled', now() - interval '10 min', 'timeout', NULL, 10000, NULL, 'timeout after 10s'),
  (302, 202, 'scheduled', now() - interval '10 min', 'up',      200,   120,  110,  NULL);

-- Ownership and duplicates (R1, R2, BR-01)
SELECT pg_temp.expect_error('duplicate email, different case',
  $q$INSERT INTO users (email, password_hash) VALUES ('owner@example.com', 'h')$q$, '23505');
SELECT pg_temp.expect_error('same user adds the same URL twice',
  $q$INSERT INTO monitors (user_id, name, url, url_normalized) VALUES (101, 'dup', 'https://example.com/health', 'https://example.com/health')$q$, '23505');
SELECT pg_temp.expect_error('edit a monitor into a duplicate URL',
  $q$UPDATE monitors SET url_normalized = 'https://other.test/' WHERE id = 201$q$, '23505');
SELECT pg_temp.expect_error('non-http URL',
  $q$INSERT INTO monitors (user_id, name, url, url_normalized) VALUES (101, 'x', 'ftp://x', 'ftp://x')$q$, '23514');

-- Honest check results (no fabricated latency)
SELECT pg_temp.expect_error('timeout with a response time',
  $q$INSERT INTO check_results (monitor_id, trigger, checked_at, outcome, duration_ms, response_time_ms) VALUES (201, 'manual', now(), 'timeout', 10000, 500)$q$, '23514');
SELECT pg_temp.expect_error('up without an HTTP status',
  $q$INSERT INTO check_results (monitor_id, trigger, checked_at, outcome, duration_ms) VALUES (201, 'manual', now(), 'up', 100)$q$, '23514');
SELECT pg_temp.expect_error('response time longer than the attempt',
  $q$INSERT INTO check_results (monitor_id, trigger, checked_at, outcome, http_status, duration_ms, response_time_ms) VALUES (201, 'manual', now(), 'up', 200, 100, 150)$q$, '23514');

-- Same-monitor invariant: an incident's first check must belong to the same monitor
SELECT pg_temp.expect_error('incident on monitor 201 pointing at a check of monitor 202',
  $q$INSERT INTO incidents (monitor_id, severity, started_at, first_check_id) VALUES (201, 'critical', now() - interval '10 min', 302)$q$, '23503');

-- Incident lifecycle (R5, BR-03, BR-04)
INSERT INTO incidents (id, monitor_id, severity, started_at, first_check_id, cause) OVERRIDING SYSTEM VALUE
  VALUES (401, 201, 'critical', now() - interval '10 min', 301, 'timeout after 10s');
SELECT pg_temp.expect_error('second open incident for the same monitor',
  $q$INSERT INTO incidents (monitor_id, severity, started_at) VALUES (201, 'major', now())$q$, '23505');
SELECT pg_temp.expect_error('re-point an existing incident at another monitor''s check',
  $q$UPDATE incidents SET first_check_id = 302 WHERE id = 401$q$, '23503');
SELECT pg_temp.expect_error('owner resolves while the endpoint is still failing',
  $q$UPDATE incidents SET status = 'resolved', resolved_at = now() WHERE id = 401$q$, '23514');
SELECT pg_temp.expect_error('status resolved without resolved_at',
  $q$UPDATE incidents SET status = 'resolved', recovered_at = now() - interval '1 min' WHERE id = 401$q$, '23514');
UPDATE incidents SET recovered_at = now() - interval '1 min' WHERE id = 401;   -- worker records recovery
SELECT pg_temp.expect('recovery alone does not close the incident',
  (SELECT status = 'open' FROM incidents WHERE id = 401));
UPDATE incidents SET status = 'resolved', resolved_at = now() WHERE id = 401;   -- owner resolves
SELECT pg_temp.expect('owner can resolve after recovery',
  (SELECT status = 'resolved' FROM incidents WHERE id = 401));

-- Notes
INSERT INTO incident_notes (incident_id, body) VALUES (401, 'Restarted the container');
SELECT pg_temp.expect_error('blank note',
  $q$INSERT INTO incident_notes (incident_id, body) VALUES (401, '   ')$q$, '23514');

-- Stale completion: an older result finishing late must not overwrite newer state
UPDATE monitors SET current_status = 'up', last_checked_at = now() - interval '1 min' WHERE id = 202;
UPDATE monitors SET current_status = 'down', last_checked_at = now() - interval '5 min'
  WHERE id = 202 AND (last_checked_at IS NULL OR last_checked_at < now() - interval '5 min');
SELECT pg_temp.expect('stale result does not change current_status',
  (SELECT current_status = 'up' FROM monitors WHERE id = 202));

-- Deleting history keeps the incident and its cause
DELETE FROM check_results WHERE id = 301;
SELECT pg_temp.expect('deleting the first check nulls only first_check_id',
  (SELECT monitor_id = 201 AND first_check_id IS NULL AND cause IS NOT NULL FROM incidents WHERE id = 401));

-- Cascades
DELETE FROM users WHERE id = 101;
SELECT pg_temp.expect('deleting a user removes their monitors, incidents and notes',
  NOT EXISTS (SELECT 1 FROM monitors WHERE user_id = 101)
  AND NOT EXISTS (SELECT 1 FROM incidents WHERE id = 401)
  AND NOT EXISTS (SELECT 1 FROM incident_notes WHERE incident_id = 401));

DO $$ BEGIN RAISE NOTICE 'ALL CHECKS PASSED'; END $$;
ROLLBACK;
