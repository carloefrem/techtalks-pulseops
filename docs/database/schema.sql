-- PulseOps: proposed PostgreSQL schema (PULSE-25, draft for review)
-- Target: PostgreSQL 17 (works on 14+). Needs no extensions.
-- This is the design reference. The backend's versioned migration (PULSE-69)
-- implements it once Carlo reviews and approves it.

BEGIN;

-- ---------------------------------------------------------------------------
-- users: people who sign in and own monitors
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email          VARCHAR(254) NOT NULL,
    password_hash  TEXT         NOT NULL,
    display_name   VARCHAR(100),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT users_email_format CHECK (position('@' IN email) > 1)
);

-- Email is unique regardless of case.
CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email));

-- ---------------------------------------------------------------------------
-- monitors: one URL a user wants checked on a schedule
-- ---------------------------------------------------------------------------
CREATE TABLE monitors (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id           BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name              VARCHAR(100) NOT NULL,
    url               TEXT         NOT NULL,
    http_method       VARCHAR(4)   NOT NULL DEFAULT 'GET',
    interval_seconds  INTEGER      NOT NULL DEFAULT 300,
    timeout_ms        INTEGER      NOT NULL DEFAULT 10000,
    expected_status   SMALLINT,                      -- NULL = any 2xx/3xx counts as up
    is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
    current_status    VARCHAR(7)   NOT NULL DEFAULT 'unknown',
    last_checked_at   TIMESTAMPTZ,
    next_check_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT monitors_url_http        CHECK (url ~* '^https?://'),
    CONSTRAINT monitors_method          CHECK (http_method IN ('GET', 'HEAD')),
    CONSTRAINT monitors_interval_range  CHECK (interval_seconds BETWEEN 60 AND 86400),
    CONSTRAINT monitors_timeout_range   CHECK (timeout_ms BETWEEN 1000 AND 30000),
    CONSTRAINT monitors_expected_status CHECK (expected_status IS NULL OR expected_status BETWEEN 100 AND 599),
    CONSTRAINT monitors_current_status  CHECK (current_status IN ('unknown', 'up', 'down')),
    CONSTRAINT monitors_name_per_user_uq UNIQUE (user_id, name)
);

-- Dashboard: list a user's monitors.
CREATE INDEX monitors_user_idx ON monitors (user_id);
-- Worker: find active monitors that are due ("WHERE is_active AND next_check_at <= now()").
CREATE INDEX monitors_due_idx ON monitors (next_check_at) WHERE is_active;

-- ---------------------------------------------------------------------------
-- check_results: one row per check the worker runs (high volume, kept for a limited time)
-- ---------------------------------------------------------------------------
CREATE TABLE check_results (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    monitor_id        BIGINT      NOT NULL REFERENCES monitors (id) ON DELETE CASCADE,
    checked_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_up             BOOLEAN     NOT NULL,
    http_status       SMALLINT,                      -- NULL when no response (timeout, DNS, TLS error)
    response_time_ms  INTEGER,                       -- NULL when no response
    error_message     VARCHAR(500),
    CONSTRAINT check_results_http_status CHECK (http_status IS NULL OR http_status BETWEEN 100 AND 599),
    CONSTRAINT check_results_resp_time   CHECK (response_time_ms IS NULL OR response_time_ms >= 0),
    -- An "up" result must have a real HTTP response.
    CONSTRAINT check_results_up_has_response CHECK (NOT is_up OR (http_status IS NOT NULL AND response_time_ms IS NOT NULL))
);

-- Monitor detail page: latest results and uptime % over a time window.
CREATE INDEX check_results_monitor_time_idx ON check_results (monitor_id, checked_at DESC);
-- Retention job: delete everything older than the cutoff.
CREATE INDEX check_results_checked_at_idx ON check_results (checked_at);

-- ---------------------------------------------------------------------------
-- incidents: a period during which a monitor was down
-- ---------------------------------------------------------------------------
CREATE TABLE incidents (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    monitor_id       BIGINT       NOT NULL REFERENCES monitors (id) ON DELETE CASCADE,
    started_at       TIMESTAMPTZ  NOT NULL,
    resolved_at      TIMESTAMPTZ,                    -- NULL = still open
    -- Kept after the result itself is deleted by retention.
    first_check_id   BIGINT       REFERENCES check_results (id) ON DELETE SET NULL,
    cause            VARCHAR(500),                   -- copied from the first failing check
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT incidents_resolved_after_start CHECK (resolved_at IS NULL OR resolved_at >= started_at)
);

-- At most ONE open incident per monitor.
CREATE UNIQUE INDEX incidents_one_open_per_monitor_uq ON incidents (monitor_id) WHERE resolved_at IS NULL;
-- Incident history for a monitor, newest first.
CREATE INDEX incidents_monitor_started_idx ON incidents (monitor_id, started_at DESC);
-- Supports ON DELETE SET NULL when retention deletes check results.
CREATE INDEX incidents_first_check_idx ON incidents (first_check_id) WHERE first_check_id IS NOT NULL;

COMMIT;
