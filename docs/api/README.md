# PulseOps REST API contract (PULSE-26)

**Status:** Draft, waiting for Majd's review. No API code exists yet.
**Author:** Gaelle · **Reviewer:** Majd
**Covers:** PULSE-60 (routes and payloads), PULSE-61 (validation, errors, access rules), PULSE-62 (alignment with the schema and user journey)
**Machine-readable version:** [`openapi.yaml`](openapi.yaml) (OpenAPI 3.0.3). Import it into Bruno with *Collection → Import → OpenAPI V3*.
**Follows:** the [PRD v1.1](https://www.notion.so/41a4cd9e492d80429fe9fca7d4197128) (R1–R5, BR-01–BR-05, section 6 test), the backend conventions in PR #2 (`docs/backend/README.md`, section 5) and the database design in PR #1 (`docs/database/`).

> PR #1 and PR #2 are still open, and the PRD is still a draft. This contract follows the **PRD** wherever the PRD and the current database design disagree.
> Every disagreement is listed in [section 8](#8-conflicts-with-the-database-design-pr-1). Items marked **[Proposal]** need a team decision before implementation.

---

## 0. Implementation authorization

This document is a contract only. Implementation authorization was recorded separately by Carlo (team lead) on Nov 21, 2026, in PULSE-27 (frontend) and PULSE-28 (backend), following the TechTalks instruction that all teams start implementation. The open questions in section 10 are follow-ups, not blockers.

---

## 1. Conventions

These follow `docs/backend/README.md` section 5 (PR #2), which says they must be confirmed by PULSE-26. This contract confirms them.

| Topic | Rule |
|---|---|
| Base path | Every route is under **`/api`**. Local base URL: `http://localhost:3001/api` |
| Format | JSON only (`Content-Type: application/json`). Request body limit `100kb` |
| Field names | `camelCase` in JSON. The database uses `snake_case`; the backend maps between them |
| IDs | Sent as **strings**, e.g. `"id": "42"`. The database uses `BIGINT`, and JavaScript numbers lose precision above 2^53, so the API never sends IDs as numbers |
| Timestamps | ISO 8601 strings in UTC, e.g. `"2026-11-20T09:15:00.000Z"` |
| Empty values | A field with no value is sent as `null`, never left out |
| CORS | Only `FRONTEND_ORIGIN` is allowed, **with credentials** (needed for the session cookie, section 3) |
| Unknown fields | Rejected with `400 VALIDATION_ERROR` (Zod `.strict()`), so typos don't fail silently |

### Error format

Every error uses the single shape from PR #2:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "url must start with http:// or https://",
    "details": [{ "field": "url", "message": "must start with http:// or https://" }]
  }
}
```

- `code` is stable and meant for the frontend to switch on. `message` is for people and may change.
- `details` is always an array. It is empty unless the error is about specific fields.

## 2. Status codes and error codes

| Status | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Body or query parameter fails Zod validation. A malformed ID (`{id}` or `monitorId`) returns `404 NOT_FOUND` instead (section 6.5) |
| 400 | `UNSAFE_URL` | The URL points to a private, internal or otherwise blocked address (BR-02) |
| 401 | `UNAUTHENTICATED` | No valid session on a protected route |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password on login. The same message for both, so it doesn't reveal which one was wrong |
| 404 | `NOT_FOUND` | The resource doesn't exist, **belongs to another user** (ownership rule, section 4), or the ID is malformed (section 6.5) |
| 404 | `ROUTE_NOT_FOUND` | Unknown route (`notFound.ts` in PR #2) |
| 409 | `EMAIL_TAKEN` | Register with an email that already exists (case-insensitive) |
| 409 | `DUPLICATE_MONITOR_NAME` | The user already has a monitor with this name |
| 409 | `DUPLICATE_MONITOR_URL` | The user already monitors an equivalent URL (section 6.3) |
| 409 | `MONITOR_STILL_DOWN` | Resolving an incident while its monitor isn't `up` (BR-04) |
| 409 | `INCIDENT_ALREADY_RESOLVED` | Resolving an incident that is already resolved |
| 429 | `RATE_LIMITED` | **[Proposal]** Too many login attempts or manual checks. Includes a `Retry-After` header |
| 500 | `INTERNAL_ERROR` | Unexpected error. Generic message; details are only logged on the server |

## 3. Authentication

**[Proposal]** PR #2 open question 3 asks whether to use a JWT in an httpOnly cookie or a server session. This contract works with either, because the frontend only ever sees a cookie:

- On register or login, the server sets a cookie named `pulseops_session` with `HttpOnly`, `SameSite=Lax`, `Path=/api`, and `Secure` in production.
- The frontend sends requests with `credentials: "include"`. It never reads or stores a token in JavaScript or `localStorage`.
- Every route except `GET /api/health`, `POST /api/auth/register` and `POST /api/auth/login` requires the cookie. Without it the response is `401 UNAUTHENTICATED`, and the frontend redirects to the login page (PRD section 3, "Unauthorized action").

The backend team picks JWT or session in the TDD. If it's JWT, `JWT_SECRET` is added to `.env.example` as PR #2 already plans.

## 4. Ownership (BR-01)

- Every monitor, check result, incident and incident note belongs to the user who owns the monitor.
- Every query is filtered by the signed-in user, as `docs/database/README.md` section 3 describes.
- **Another user's resource gives `404 NOT_FOUND`, never `403`**, so the API doesn't reveal that it exists. This confirms the rule that PR #1 marked "to be confirmed in PULSE-26".
- This applies to every route with an `{id}`, including the nested ones (`/monitors/{id}/checks`, `/incidents/{id}/notes`, `/incidents/{id}/resolve`).

## 5. Routes

| Method | Path | Auth | Purpose | PRD |
|---|---|---|---|---|
| GET | `/api/health` | no | Service is running (PULSE-68) | – |
| POST | `/api/auth/register` | no | Create an account and sign in | R1 |
| POST | `/api/auth/login` | no | Sign in | R1 |
| POST | `/api/auth/logout` | yes | Sign out | R1 |
| GET | `/api/auth/me` | yes | Current user (used by the frontend on page load) | R1 |
| GET | `/api/monitors` | yes | List my monitors with their latest check (dashboard) | R2, R4 |
| POST | `/api/monitors` | yes | Add a monitor | R2 |
| GET | `/api/monitors/{id}` | yes | One monitor | R2, R4 |
| PATCH | `/api/monitors/{id}` | yes | Edit a monitor (partial update) | R2 |
| DELETE | `/api/monitors/{id}` | yes | Delete a monitor and its history | R2 |
| GET | `/api/monitors/{id}/checks` | yes | Check history, newest first | R3, R4 |
| POST | `/api/monitors/{id}/checks` | yes | Run a manual check now | R3 |
| GET | `/api/incidents` | yes | List my incidents | R5 |
| GET | `/api/incidents/{id}` | yes | One incident with its notes | R5 |
| POST | `/api/incidents/{id}/notes` | yes | Add a note | R5 |
| POST | `/api/incidents/{id}/resolve` | yes | Mark as resolved (only after recovery) | R5, BR-04 |

Full request and response schemas are in [`openapi.yaml`](openapi.yaml). The main payloads follow.

### 5.1 Health

`GET /api/health` → `200`

```json
{ "status": "ok" }
```

Exactly as PR #2 defines it. It doesn't touch the database.

### 5.2 Auth

`POST /api/auth/register`

```json
{ "email": "dev@example.com", "password": "correct-horse-battery", "displayName": "Dev" }
```

→ `201` with the user, and the session cookie set:

```json
{ "user": { "id": "1", "email": "dev@example.com", "displayName": "Dev", "createdAt": "2026-11-20T09:00:00.000Z" } }
```

`POST /api/auth/login` takes `{ "email", "password" }` and returns `200` with the same `{ "user": ... }` body. `GET /api/auth/me` returns the same body. `POST /api/auth/logout` returns `204` and clears the cookie.

The response never contains `password_hash`.

### 5.3 Monitors

`POST /api/monitors`

```json
{
  "name": "Payments API",
  "url": "https://api.example.com/health",
  "httpMethod": "GET",
  "intervalSeconds": 300,
  "timeoutMs": 10000,
  "expectedStatus": null
}
```

Only `name` and `url` are required. The others use the database defaults. → `201` with a Monitor:

```json
{
  "monitor": {
    "id": "42",
    "name": "Payments API",
    "url": "https://api.example.com/health",
    "httpMethod": "GET",
    "intervalSeconds": 300,
    "timeoutMs": 10000,
    "expectedStatus": null,
    "isActive": true,
    "currentStatus": "unknown",
    "lastCheckedAt": null,
    "nextCheckAt": "2026-11-20T09:00:00.000Z",
    "latestCheck": null,
    "openIncidentId": null,
    "createdAt": "2026-11-20T09:00:00.000Z",
    "updatedAt": "2026-11-20T09:00:00.000Z"
  }
}
```

- `currentStatus` is `unknown` until the first check. The frontend shows it as "not yet checked", never as healthy or failed (R4).
- `latestCheck` is the newest CheckResult, or `null`. It gives the dashboard the latest response time without a second request.
- `openIncidentId` is the open incident's ID, or `null`.
- `GET /api/monitors` returns `{ "monitors": [Monitor, ...] }`, ordered by `name`. No pagination for the MVP.
- `PATCH /api/monitors/{id}` accepts any subset of the create fields plus `isActive`. It returns `200` with the updated Monitor.
- `DELETE /api/monitors/{id}` returns `204`. Its checks, incidents and notes are deleted too (cascade, PR #1).

### 5.4 Checks

`GET /api/monitors/{id}/checks?limit=50&before=2026-11-20T09:00:00.000Z`

- `limit`: 1–500, default 50. `before`: optional timestamp cursor; returns checks older than it.
- → `200`:

```json
{
  "checks": [
    {
      "id": "1001",
      "monitorId": "42",
      "checkedAt": "2026-11-20T09:05:00.000Z",
      "isUp": false,
      "httpStatus": null,
      "responseTimeMs": null,
      "durationMs": 10003,
      "errorMessage": "Timed out after 10000 ms"
    }
  ],
  "nextBefore": "2026-11-20T09:05:00.000Z"
}
```

`nextBefore` is the value to pass as `before` for the next page, or `null` when there are no more.

`POST /api/monitors/{id}/checks` runs a check right away, using the same rules as the scheduled worker (PRD "Reliability" check). It waits for the result (at most `timeoutMs`) and returns `201` with `{ "check": CheckResult, "monitor": Monitor }`, so the frontend can refresh both the row and the history. A manual check also opens an incident if it fails, the same as a scheduled one.

`responseTimeMs` is `null` when there was no HTTP response. The API never sends a made-up latency (PRD "Honest failure display"). `durationMs` is always present: the elapsed time of the whole attempt, even when there was no response (database `duration_ms`, PR #1 rev 2). When both are present, `responseTimeMs ≤ durationMs`. The frontend uses it to show "no response after N ms".

### 5.5 Incidents

`GET /api/incidents?status=open&monitorId=42&limit=50&before=...`

- `status`: `open` | `resolved` | omitted for both. `monitorId`: optional filter. Same `limit`/`before` paging as checks.
- → `200` with `{ "incidents": [Incident, ...], "nextBefore": ... }`, newest `startedAt` first.

`GET /api/incidents/{id}` → `200`:

```json
{
  "incident": {
    "id": "7",
    "monitorId": "42",
    "monitorName": "Payments API",
    "monitorCurrentStatus": "up",
    "status": "open",
    "severity": "critical",
    "startedAt": "2026-11-20T09:05:00.000Z",
    "resolvedAt": null,
    "cause": "Timed out after 10000 ms",
    "notes": [
      { "id": "3", "body": "Upstream DB restarted at 09:04.", "createdAt": "2026-11-20T09:10:00.000Z" }
    ],
    "createdAt": "2026-11-20T09:05:00.000Z"
  }
}
```

- `status` is the **workflow** state, set by the user: `open` until the owner resolves it (BR-04).
- `monitorCurrentStatus` is the **health** state, set by checks. The frontend enables the "Resolve" button only when it is `up`.
- `severity` is `critical` or `major` (PULSE-112, Q2). It is set **once**, from the check that opened the incident, and never changes:

  | First failing check `outcome` | Severity | Why |
  |---|---|---|
  | `timeout`, `connection_error`, `dns_error`, `blocked` | `critical` | No HTTP response at all: the endpoint is unreachable |
  | `http_error` | `major` | The server answered, but with an unexpected status |

  These are the values in the database `CHECK` constraint (`docs/database/schema.sql`), so no migration is needed. The rule is coded once in `backend/src/incidents/severity.ts` for the incident worker (PULSE-94).
- In list responses, `notes` is left out to keep them small.

`POST /api/incidents/{id}/notes` with `{ "body": "..." }` (1–2000 characters, trimmed) → `201` with `{ "note": IncidentNote }`.

`POST /api/incidents/{id}/resolve` (no body) →
- `200` with the updated Incident (`status: "resolved"`, `resolvedAt` set to now)
- `409 MONITOR_STILL_DOWN` if the monitor isn't `up` yet
- `409 INCIDENT_ALREADY_RESOLVED` if it was already resolved

## 6. Validation rules

The ranges match the `CHECK` constraints in `docs/database/schema.sql` (PR #1), so the API rejects bad input before the database does.

### 6.1 Auth

| Field | Rule |
|---|---|
| `email` | Valid email, max 254 characters, trimmed and lowercased before saving |
| `password` | 8–72 characters (72 is the bcrypt input limit) |
| `displayName` | Optional, 1–100 characters, trimmed |

### 6.2 Monitors

| Field | Required on create | Rule |
|---|---|---|
| `name` | yes | 1–100 characters, trimmed. Unique per user → `409 DUPLICATE_MONITOR_NAME` |
| `url` | yes | Absolute `http://` or `https://` URL, max 2048 characters, no username/password in the URL. Must pass the safety check (6.4). Unique per user after normalization (6.3) → `409 DUPLICATE_MONITOR_URL` |
| `httpMethod` | no | `GET` (default) or `HEAD` |
| `intervalSeconds` | no | Integer 60–86400, default 300 **[Assumption from PR #1]** |
| `timeoutMs` | no | Integer 1000–30000, default 10000 **[Assumption from PR #1]** |
| `expectedStatus` | no | Integer 100–599, or `null` (any 2xx/3xx counts as up) |
| `isActive` | – (PATCH only) | Boolean. Paused monitors are skipped by the worker |

### 6.3 Duplicate URL rule **[Proposal]**

The PRD asks Gaelle and Mirla to define which URLs count as duplicates. Proposal: two URLs are the same if they're equal after this normalization:

1. Lowercase the scheme and host.
2. Remove the default port (`:80` for http, `:443` for https).
3. Remove the `#fragment`.
4. Treat an empty path as `/`.
5. Keep the rest of the path and the query string exactly as typed (they can be case-sensitive).

So `HTTPS://API.example.com:443/health#top` and `https://api.example.com/health` are duplicates, but `/health` and `/health/` are not. `http://` and `https://` versions of the same host are **different** monitors.

**Decided (Nov 22):** the API stores and returns the URL **as the user typed it** (`url`). The normalized form is stored separately (`url_normalized` in PR #1 rev 2) and is used **only** for the duplicate check. The duplicate check also runs on `PATCH` when `url` changes, and the database's `UNIQUE (user_id, url_normalized)` stops two requests at the same time from both getting through (see section 8).

### 6.4 URL safety (BR-02)

The backend rejects the URL with `400 UNSAFE_URL` if it:

- uses a scheme other than `http`/`https`
- is an IP literal or resolves (DNS) to a loopback, private, link-local or reserved address: `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `0.0.0.0/8`, `::1`, `fc00::/7`, `fe80::/10`, and IPv4-mapped IPv6 forms of these
- uses the hostname `localhost` or ends in `.localhost` / `.internal`

The worker repeats the check **every time it runs a check**, against the address it actually connects to, because DNS can change after the monitor is saved. Redirects aren't followed in the MVP **[Proposal]**: a 3xx is recorded as the response (and counts as up when `expectedStatus` is `null`). This avoids a redirect to an internal address. PR #2 section 6 lists the IPv4 ranges; IPv6 and redirect handling are added here and still need to go into the TDD.

### 6.5 Query parameters

| Param | Rule |
|---|---|
| `limit` | Integer 1–500, default 50 |
| `before` | ISO 8601 timestamp |
| `status` | `open` or `resolved` |
| `monitorId`, `{id}` | String of digits (`^[1-9][0-9]{0,18}$`). Anything else → `404 NOT_FOUND`, not 400, so it behaves the same as a missing ID |

## 7. User journey → API calls (PULSE-62)

This walks through PRD section 3 and the section 6 acceptance test.

| PRD step | What the user does | API calls |
|---|---|---|
| 2 | Registers, logs in | `POST /auth/register` (or `/auth/login`), then `GET /auth/me` on each page load |
| 2 | Adds an endpoint | `POST /monitors` → `400 VALIDATION_ERROR` / `400 UNSAFE_URL` / `409 DUPLICATE_MONITOR_URL` on bad input |
| 3 | Sees status and response time; triggers a check | `GET /monitors` (dashboard), `POST /monitors/{id}/checks` |
| 3 | Scheduled checks run | No API call: the worker writes `check_results`. The dashboard polls `GET /monitors` **[Proposal: every 30 s while the page is open]** |
| 4 | Endpoint fails; opens the dashboard | `GET /monitors` shows `currentStatus: "down"` and `openIncidentId`; `GET /monitors/{id}/checks` for history |
| 5 | Reviews the incident, adds notes | `GET /incidents/{id}`, `POST /incidents/{id}/notes` |
| 6 | Endpoint recovers; marks resolved | `POST /incidents/{id}/resolve` → `200`, or `409 MONITOR_STILL_DOWN` if still failing |
| Test step 6 | User B opens User A's monitor/incident | `GET /monitors/{A's id}` and `GET /incidents/{A's id}` → `404 NOT_FOUND` |

## 8. Conflicts with the database design (PR #1)

PR #1 (`feature/PULSE-25-database-design`) is Mirla's and is still open. This PR doesn't change it. The table below was written against `00eff8e`; the **Status** list underneath records what PR #1 revision 2 (`816db53`, `d82d4a8`) changed.

**Status after PR #1 rev 2 (checked Nov 22):**

- **C1 resolved.** The worker never resolves. A successful check only sets `incidents.recovered_at`; `status`/`resolved_at` are set only by the resolve action, and the database rejects resolving without recovery evidence.
- **C2 resolved (PULSE-112).** The contract now uses the database's `critical` / `major` and its rule (section 5.5). The earlier `low` / `medium` / `high` proposal is dropped.
- **C3 resolved.** `incident_notes` added as suggested.
- **C4 resolved.** `UNIQUE (user_id, url_normalized)`, using the same normalization as 6.3.
- **C5 resolved.** Accounts are kept.
- **C6 aligned.** The partial unique index is now `WHERE status = 'open'`, and re-failure before resolution continues the same incident. Still a team decision (Q3).
- **C7 unchanged.** IDs are strings in the API.
- **Also aligned:** `UNIQUE (user_id, name)` for `409 DUPLICATE_MONITOR_NAME`; `duration_ms` for `durationMs` (Q4).

| # | PRD need | Current PR #1 schema | What the contract assumes | Suggested schema change |
|---|---|---|---|---|
| C1 | **BR-04 / R5:** only the user resolves an incident, after recovery | Worker step 4 sets `resolved_at` automatically on the first successful check | `status` stays `open` until `POST /incidents/{id}/resolve`; the worker never resolves | Remove worker step 4. Resolution sets `resolved_at` only through the API, after checking `monitors.current_status = 'up'` |
| C2 | **R5:** incidents have a severity | No `severity` column | `severity` field on Incident, values ~~**[Proposal]** `low` / `medium` / `high`~~ `critical` / `major` (PULSE-112) | Add `incidents.severity` with a `CHECK`. ~~The rule for choosing it is still open (Q2)~~ Done in PR #1 rev 2; rule in section 5.5 |
| C3 | **R5:** the owner adds notes | No notes table | `IncidentNote { id, body, createdAt }` | New `incident_notes (id, incident_id FK ON DELETE CASCADE, body VARCHAR(2000), created_at)` with an index on `(incident_id, created_at)` |
| C4 | **R2:** duplicate URLs rejected | Unique only on `(user_id, name)`; PR #1 open question 4 | `409 DUPLICATE_MONITOR_URL` after normalization (6.3) | Add `UNIQUE (user_id, url)` on the normalized URL |
| C5 | **R1:** personal accounts | PR #1 open question 1 asks whether accounts are needed | Accounts are required | Close question 1: keep `users` and `user_id` |
| C6 | **BR-03 with C1:** one open incident | The partial unique index on `resolved_at IS NULL` works today **because** of auto-resolve | If the monitor fails again while the old incident is still unresolved, **no new incident** is created; the failure belongs to the open one | Keep the index. Once C1 is applied, the team confirms this re-failure rule (Q3) |
| C7 | IDs in JSON | `BIGINT` | IDs are strings | None. Recorded so the backend serializes them as strings (also listed in the PR #4 review) |

Other PR #1 items (`first_check_id` belonging to the same monitor, worker locking, Prisma parity) don't change the API, so they aren't repeated here.

## 9. PostgreSQL version mismatch (17 vs 18.7)

| Where | Version |
|---|---|
| `main` → `README.md` (sections 3, 6, 11, 14) | **PostgreSQL 17.x** |
| PR #1 `docs/database/schema.sql` header | 18.7 |
| PR #2 `docs/backend/README.md` | 18.7 |
| PR #3 `README.md` | changes 17 → 18.7, described as a "team decision" |

Until PR #3 is merged, `main` tells new teammates to install 17 while the design docs target 18.7. Where the 18.7 decision was made isn't linked anywhere yet (the PR #4 review asks for that record too).

**This contract doesn't depend on the version.** It uses nothing specific to PostgreSQL 18, and PR #1 says its schema also runs on 14+. The team still needs to:
1. Link where the 18.7 decision was recorded (Jira or Notion).
2. Merge PR #3, or correct it, so `main` and the design docs agree before anyone installs PostgreSQL.

## 10. Open questions (for Majd and the team)

| # | Question | Affects | Owner |
|---|---|---|---|
| Q1 | JWT in a cookie or a server session? (PR #2 Q3) | Section 3, `.env.example` | Majd, Mirla |
| Q2 | ~~Severity values and the rule for setting them?~~ **Resolved (PULSE-112):** `critical` when there is no HTTP response (`timeout`, `connection_error`, `dns_error`, `blocked`), `major` for an unexpected status (`http_error`). Set once from the first failing check. Uses the existing database values, so no migration | C2, Incident schema, section 5.5 | – |
| Q3 | If a recovered but unresolved incident's monitor fails again, does it reuse the same incident? (This contract says yes) | C6, worker | Carlo, Majd (PRD) |
| Q4 | ~~Store the elapsed attempt time separately from response latency?~~ **Resolved (Nov 22):** yes. `durationMs` (always present) is added to CheckResult; the database already stores `duration_ms` | Section 5.4 | – |
| Q5 | Do we record a failure type (`timeout`, `dns`, `connection`, `http_status`) on each failed check? (Interview finding UN-2) | CheckResult, `check_results` | Gaelle, Mirla |
| Q6 | Are notes allowed on resolved incidents? (This contract allows it) | Section 5.5 | Team |
| Q7 | Is the duplicate-URL normalization in 6.3 acceptable? | C4 | Gaelle, Mirla |
| Q8 | Rate limits for login and manual checks: values? Carlo's review (Nov 21) recommends implementing the manual-check `429` in the MVP, since each manual check is an outbound request that can block for up to 30 s | `429 RATE_LIMITED`, `POST /monitors/{id}/checks` | Majd |
| Q9 | Dashboard refresh: polling every 30 s for the MVP, or something else? | Frontend (PULSE-27) | Gaelle, Majd |
| Q10 | Deleting a monitor cascades to its checks, incidents and notes (section 5.3), but BR-05 says history stays visible after resolution. Keep the cascade for the MVP and note the limitation, or soft-delete/archive monitors? (Carlo's review: cascade is fine for the MVP if noted) | Section 5.3, C-table, PR #1 | Team |
| Q11 | A paused monitor (`isActive=false`) is never checked again, so its open incident can never reach `currentStatus = up` and can't be resolved. Allow resolving when the monitor is paused, or require a manual check first? The database currently requires `recovered_at` to resolve (PR #1 rev 2), so either choice also changes PR #1 | Sections 5.5, 6.2, BR-04 | Carlo, Gaelle |
| Q12 | With redirects not followed and `expectedStatus = null`, a 3xx (e.g. a redirect to a login or error page) counts as up. Treat 3xx as up only when `expectedStatus` says so, or document the limitation in the UI? | Sections 6.2, 6.4 | Gaelle, Majd |

## 11. Review checklist (PULSE-26 acceptance criteria)

- [x] MVP routes specify methods, paths, inputs and representative responses (sections 5 and `openapi.yaml`) — PULSE-60
- [x] Validation and error status codes/bodies are documented (sections 1, 2, 6) — PULSE-61
- [x] Authentication and ownership requirements are defined (sections 3, 4) — PULSE-61
- [x] Contracts are cross-checked against the database design and core user journey; conflicts and unresolved decisions are recorded (sections 7–10) — PULSE-62
- [ ] Majd reviews; the PR link and unresolved decisions are added to PULSE-26 in Jira
- [ ] `openapi.yaml` imported into Bruno by a reviewer (not run by the author yet)
