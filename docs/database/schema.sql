-- PulseOps: proposed PostgreSQL schema (PULSE-25, revision 2, draft for review)
-- Target: PostgreSQL 18.7 (team baseline). Requires PostgreSQL 15+ for
-- "ON DELETE SET NULL (column)". Needs no extensions.
-- Aligned with PRD v1.1 (R1-R5, BR-01..BR-05). Items marked PROPOSAL in
-- docs/database/README.md are still product decisions.
-- The backend's versioned migration (PULSE-69) implements this once it is approved.

BEGIN;

-- ---------------------------------------------------------------------------
-- users (R1): people who sign in; each owns their own data (BR-01)
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
-- monitors (R2): one endpoint a user checks
-- ---------------------------------------------------------------------------
CREATE TABLE monitors (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id           BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name              VARCHAR(100) NOT NULL,
    url               TEXT         NOT NULL,          -- as the user typed it
    url_normalized    TEXT         NOT NULL,          -- canonical form, computed by the API (README section 3.3)
    http_method       VARCHAR(4)   NOT NULL DEFAULT 'GET',
    interval_seconds  INTEGER      NOT NULL DEFAULT 300,   -- PROPOSAL: default not agreed yet
    timeout_ms        INTEGER      NOT NULL DEFAULT 10000,
    expected_status   SMALLINT,                       -- NULL = any 2xx/3xx counts as up
    is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
    current_status    VARCHAR(7)   NOT NULL DEFAULT 'unknown',  -- endpoint health only, NOT incident state
    last_checked_at   TIMESTAMPTZ,                    -- checked_at of the newest APPLIED check
    next_check_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT monitors_url_http        CHECK (url ~* '^https?://'),
    CONSTRAINT monitors_url_norm_http   CHECK (url_normalized ~ '^https?://'),
    CONSTRAINT monitors_method          CHECK (http_method IN ('GET', 'HEAD')),
    CONSTRAINT monitors_interval_range  CHECK (interval_seconds BETWEEN 60 AND 86400),
    CONSTRAINT monitors_timeout_range   CHECK (timeout_ms BETWEEN 1000 AND 30000),
    CONSTRAINT monitors_expected_status CHECK (expected_status IS NULL OR expected_status BETWEEN 100 AND 599),
    CONSTRAINT monitors_current_status  CHECK (current_status IN ('unknown', 'up', 'down')),
    -- PRD R2: the same user cannot monitor the same URL twice. Different users may.
    -- Enforced by the database, so two concurrent creates/edits cannot both succeed.
    CONSTRAINT monitors_user_url_uq UNIQUE (user_id, url_normalized),
    -- API contract (PR #5): a user cannot have two monitors with the same name (409 DUPLICATE_MONITOR_NAME).
    CONSTRAINT monitors_user_name_uq UNIQUE (user_id, name)
);

CREATE INDEX monitors_user_idx ON monitors (user_id);
CREATE INDEX monitors_due_idx  ON monitors (next_check_at) WHERE is_active;

-- ---------------------------------------------------------------------------
-- check_results (R3/R4): one row per check attempt, manual or scheduled
-- ---------------------------------------------------------------------------
CREATE TABLE check_results (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    monitor_id        BIGINT      NOT NULL REFERENCES monitors (id) ON DELETE CASCADE,
    trigger           VARCHAR(9)  NOT NULL,           -- 'scheduled' | 'manual'
    checked_at        TIMESTAMPTZ NOT NULL,           -- when the attempt STARTED
    outcome           VARCHAR(16) NOT NULL,
    is_up             BOOLEAN     GENERATED ALWAYS AS (outcome = 'up') STORED,
    http_status       SMALLINT,                       -- only when an HTTP response arrived
    duration_ms       INTEGER     NOT NULL,           -- elapsed attempt time, ALWAYS recorded
    response_time_ms  INTEGER,                        -- HTTP response latency, only when a response arrived
    error_message     VARCHAR(500),
    CONSTRAINT check_results_trigger  CHECK (trigger IN ('scheduled', 'manual')),
    CONSTRAINT check_results_outcome  CHECK (outcome IN ('up', 'http_error', 'timeout',
                                                         'connection_error', 'dns_error', 'blocked')),
    CONSTRAINT check_results_http_status CHECK (http_status IS NULL OR http_status BETWEEN 100 AND 599),
    CONSTRAINT check_results_duration    CHECK (duration_ms >= 0),
    -- An HTTP status and a response latency exist exactly when an HTTP response arrived.
    -- A missing response is never shown as a fabricated latency (PRD "honest failure display").
    CONSTRAINT check_results_response_iff_http CHECK (
        (outcome IN ('up', 'http_error')) = (http_status IS NOT NULL)
        AND (http_status IS NULL) = (response_time_ms IS NULL)),
    CONSTRAINT check_results_latency_le_duration CHECK (
        response_time_ms IS NULL OR (response_time_ms >= 0 AND response_time_ms <= duration_ms)),
    -- Needed so incidents can reference "a check OF THE SAME monitor" (composite FK below).
    CONSTRAINT check_results_monitor_id_uq UNIQUE (monitor_id, id)
);

CREATE INDEX check_results_monitor_time_idx ON check_results (monitor_id, checked_at DESC);
CREATE INDEX check_results_checked_at_idx   ON check_results (checked_at);

-- ---------------------------------------------------------------------------
-- incidents (R5): created automatically on failure, resolved ONLY by the owner
-- after recovery (BR-03, BR-04). Endpoint health lives on monitors; incident
-- workflow state lives here.
-- ---------------------------------------------------------------------------
CREATE TABLE incidents (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    monitor_id      BIGINT       NOT NULL REFERENCES monitors (id) ON DELETE CASCADE,
    status          VARCHAR(8)   NOT NULL DEFAULT 'open',   -- 'open' | 'resolved'
    severity        VARCHAR(8)   NOT NULL,                  -- 'critical' | 'major' (PULSE-112)
    started_at      TIMESTAMPTZ  NOT NULL,                  -- checked_at of the first failing check
    first_check_id  BIGINT,                                 -- that check; NULL only if history was purged
    cause           VARCHAR(500),                           -- copied from the first failing check
    recovered_at    TIMESTAMPTZ,                            -- recovery evidence: newest successful check, NULL while failing
    resolved_at     TIMESTAMPTZ,                            -- set only by the owner's resolve action
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT incidents_status   CHECK (status IN ('open', 'resolved')),
    CONSTRAINT incidents_severity CHECK (severity IN ('critical', 'major')),
    CONSTRAINT incidents_recovered_after_start CHECK (recovered_at IS NULL OR recovered_at >= started_at),
    -- resolved <=> resolved_at is set
    CONSTRAINT incidents_resolved_has_time CHECK ((status = 'resolved') = (resolved_at IS NOT NULL)),
    -- BR-04: can only be resolved after recovery evidence exists
    CONSTRAINT incidents_resolve_needs_recovery CHECK (
        status <> 'resolved' OR (recovered_at IS NOT NULL AND resolved_at >= recovered_at)),
    -- The first check must belong to THIS incident's monitor (same-monitor invariant).
    -- If that check is ever deleted, only first_check_id becomes NULL (PostgreSQL 15+ syntax).
    CONSTRAINT incidents_first_check_same_monitor_fk
        FOREIGN KEY (monitor_id, first_check_id)
        REFERENCES check_results (monitor_id, id)
        ON DELETE SET NULL (first_check_id)
);

-- BR-03: at most ONE open incident per monitor, enforced even under concurrency.
CREATE UNIQUE INDEX incidents_one_open_per_monitor_uq ON incidents (monitor_id) WHERE status = 'open';
CREATE INDEX incidents_monitor_started_idx ON incidents (monitor_id, started_at DESC);
CREATE INDEX incidents_first_check_idx     ON incidents (monitor_id, first_check_id) WHERE first_check_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- incident_notes (R5): persistent notes the owner adds to an incident
-- ---------------------------------------------------------------------------
CREATE TABLE incident_notes (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    incident_id  BIGINT      NOT NULL REFERENCES incidents (id) ON DELETE CASCADE,
    body         TEXT        NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT incident_notes_body_len CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000)
);

CREATE INDEX incident_notes_incident_idx ON incident_notes (incident_id, created_at);

COMMIT;
