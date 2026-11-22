# PulseOps backend: structure and configuration plan (PULSE-67)

**Status:** Plan, revision 2. Waiting for Majd's review. No backend code exists yet. Implementation was authorized on 21 Nov 2026 (section 0).
**Author:** Mirla · **Reviewer:** Majd
**Parent:** PULSE-28 (S1-09 Express backend foundation)
**Follows:**
- **Product:** PRD v1.1 Draft (Notion: https://www.notion.so/41a4cd9e492d80429fe9fca7d4197128), requirements R1–R5 and rules BR-01 to BR-05.
- **Data:** the database design in PULSE-25 (`docs/database/`, PR #1).
- **Stack:** the root README (Node 24.22.3, Express 5, TypeScript, Zod, Prisma, Vitest). **PostgreSQL is 18.7** (section 4).

## What changed since revision 1 (response to the PR #2 review)

| # | Review point | Where |
|---|---|---|
| 1 | Tests used the dev database | Separate `TEST_DATABASE_URL`, a fail-fast guard that runs before any setup or reset, and exact commands (section 5) |
| 2 | Clean checkout, `db:check` and build output | `db:generate` is an explicit setup step; `db:check` was added; `tsconfig.build.json` emits `dist/server.js` and leaves tests out (sections 2, 3, 6) |
| 3 | URL policy only covered IPv4 | Full IPv4 and IPv6 blocklist, IPv4-mapped and NAT64 addresses, DNS pinning against rebinding, every redirect hop re-checked, explicit timeouts and size limits (section 8) |
| 4 | PostgreSQL 18.7 and Prisma | Decision recorded, Prisma pinned exactly, migration parity check against `verify.sql` (sections 4 and 6) |
| 5 | PRD R1–R5 alignment | Modules mapped to requirements. **No automatic incident closing.** Severity, notes and owner-only resolution after recovery (section 7) |
| 6 | Open TDD decisions | Listed in section 10 as open. The folder layout does not decide them |

---

## 0. Implementation authorization (required before any code)

PULSE-28 says implementation authorization must be recorded before coding starts. It was recorded on 21 Nov 2026 (table below), so PULSE-68 and PULSE-69 can start. Open design questions (section 10) continue as follow-ups and are not blockers.

| Item | Value |
|---|---|
| Approved by (name / role) | Carlo Efrem, team lead, following the TechTalks instruction (21 Nov) that all teams start implementation |
| Date | 2026-11-21 |
| Where it is recorded (Jira comment / Notion link) | Jira comment on [PULSE-28](https://pulseops-internship.atlassian.net/browse/PULSE-28) |
| Scope approved | Initialize `backend/` as described below: PULSE-68 (server + health endpoint) and PULSE-69 (DB connection + first migration) |

## 1. Folder structure

```text
backend/
├── src/                        # Everything that ships. Compiled to dist/ (section 3)
│   ├── server.ts               # Starts the HTTP server. The only file that opens a port
│   ├── app.ts                  # Builds the Express app (middleware + routes). Exported for tests
│   ├── config/env.ts           # Loads and validates environment variables with Zod. Fails at startup
│   ├── db/prisma.ts            # One shared PrismaClient
│   ├── routes/
│   │   ├── index.ts            # Mounts every router under /api
│   │   └── health.routes.ts    # GET /api/health
│   ├── modules/                # One folder per feature: *.routes.ts → *.controller.ts → *.service.ts, plus *.schemas.ts (Zod)
│   │   ├── auth/               # R1
│   │   ├── monitors/           # R2 (CRUD, duplicate-URL check, URL policy at create/edit)
│   │   ├── checks/             # R3 (manual check endpoint, result history for R4)
│   │   ├── incidents/          # R5 (list/view, notes, owner resolve)
│   │   └── dashboard/          # R4 (read-only summaries)
│   ├── monitoring/             # Shared by manual checks and the worker
│   │   ├── urlPolicy.ts        # Section 8: allowed URLs and IP addresses
│   │   ├── httpCheck.ts        # Performs one check with timeouts, limits and redirect handling
│   │   └── completeCheck.ts    # Saves a result + updates status/incidents (docs/database section 4)
│   ├── worker/scheduler.ts     # Claims due monitors and runs checks (process model decided in PULSE-24)
│   ├── lib/ids.ts              # BIGINT <-> decimal string helpers (IDs are strings in JSON)
│   └── middleware/             # notFound.ts, errorHandler.ts, validate.ts, requireAuth.ts
├── scripts/                    # Dev tooling, not compiled into dist/
│   ├── db-check.ts             # SELECT 1 through Prisma; exits 1 on failure
│   └── test-db.ts              # Guard + migrate the TEST database (section 5)
├── prisma/
│   ├── schema.prisma
│   └── migrations/             # Versioned, committed. May contain hand-written SQL (section 6)
├── tests/
│   ├── setup/guard.ts          # Refuses to run tests against a non-test database
│   ├── setup/global-setup.ts   # Runs the guard before anything touches a database
│   ├── setup/reset.ts          # Empties tables between tests (only after the guard passed)
│   ├── unit/                   # e.g. urlPolicy.test.ts (no database)
│   └── integration/            # e.g. health.test.ts, monitors.test.ts (test database)
├── .env.example                # Placeholders only (committed)
├── .env                        # Real local values. NOT committed (.gitignore: .env, .env.*)
├── package.json / package-lock.json
├── tsconfig.json               # Editor + typecheck: src, scripts, tests. No output
├── tsconfig.build.json         # Build: src only → dist/
└── vitest.config.ts
```

**Why this layout**
- **`app.ts` and `server.ts` are separate**, so tests can import the app without opening a port.
- **Feature folders**: route (HTTP) → controller (input/output) → service (logic + database), one per PRD requirement.
- **`monitoring/` is shared** by the manual check endpoint (R3) and the scheduled worker, so both follow the same result rules (PRD "Reliability" check).
- **Only `src/` is built.** Scripts and tests stay out of `dist/`.

## 2. npm scripts (`backend/package.json`)

| Script | Command | Purpose |
|---|---|---|
| `dev` | `tsx watch src/server.ts` | Run locally; restarts on save |
| `build` | `tsc -p tsconfig.build.json` | Compile `src/` to `dist/` (`dist/server.js`) |
| `start` | `node dist/server.js` | Run the compiled build |
| `typecheck` | `tsc -p tsconfig.json` | Type errors in src, scripts and tests (`noEmit`) |
| `db:generate` | `prisma generate` | Generate Prisma Client. **Required after `npm ci`** and after schema changes |
| `db:migrate` | `prisma migrate dev` | Create or apply migrations on your **dev** database |
| `db:deploy` | `prisma migrate deploy` | Apply committed migrations only (clean checkout, CI) |
| `db:check` | `tsx scripts/db-check.ts` | Database connectivity check (PULSE-69/73). Prints `db ok` or exits 1 |
| `db:studio` | `prisma studio` | Browse local data |
| `db:test:prepare` | `tsx scripts/test-db.ts` | Guard, then apply migrations to the **test** database |
| `pretest` | `npm run db:test:prepare` | Runs automatically before `npm test` |
| `test` | `vitest run` | All tests once |
| `test:unit` | `vitest run tests/unit` | Unit tests only (no database needed) |

Module format: ES modules (`"type": "module"`), with `module` and `moduleResolution` set to `NodeNext`, and `strict: true`.

We don't rely on a `postinstall` hook to generate Prisma Client. Generating it is a written, explicit step, so a clean checkout behaves the same for everyone.

## 3. TypeScript build configuration

`tsconfig.json`: used by the editor, `typecheck` and `tsx`.
```jsonc
{
  "compilerOptions": {
    "target": "ES2023", "module": "NodeNext", "moduleResolution": "NodeNext",
    "strict": true, "esModuleInterop": true, "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "scripts", "tests", "vitest.config.ts"]
}
```

`tsconfig.build.json`: used only by `npm run build`.
```jsonc
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "noEmit": false, "rootDir": "src", "outDir": "dist", "sourceMap": true },
  "include": ["src"],
  "exclude": ["**/*.test.ts"]
}
```
With `rootDir: "src"`, `src/server.ts` compiles to **`dist/server.js`**, not `dist/src/server.js`. Tests and scripts are never compiled into `dist/`. This was checked with TypeScript 5.9 on a small sample project. `typecheck` passed, and the build produced only `dist/server.js` and `dist/routes/*.js`, with no test or script files. Re-check it with the TypeScript version pinned in PULSE-68.

## 4. Environment variables and PostgreSQL

**PostgreSQL 18.7 for everyone.** The team chose it on 18 Nov 2026, replacing the README's 17.x, and the decision is recorded on PULSE-45. The root README is updated in PR #3; until that merges, `main` still says 17.

`backend/.env.example` (committed, placeholders only):
```dotenv
NODE_ENV=development
PORT=3001
FRONTEND_ORIGIN="http://localhost:5173"

# Your local PostgreSQL 18.7. Copy this file to .env and fill in YOUR user/password.
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/pulseops_dev"
# Used ONLY by tests. Must be a different database whose name ends in _test.
TEST_DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/pulseops_test"
```

| Variable | Required | Rule (Zod, `src/config/env.ts`) |
|---|---|---|
| `NODE_ENV` | no | `development` \| `test` \| `production`, default `development` |
| `PORT` | no | integer, default `3001` |
| `FRONTEND_ORIGIN` | yes | valid URL |
| `DATABASE_URL` | yes | starts with `postgresql://` |
| `TEST_DATABASE_URL` | tests only | starts with `postgresql://`; checked by the test guard (section 5) |

Later, when their features arrive: authentication settings (the method is undecided, section 10) and worker settings.

**Rules**
- Never commit `.env`, and never paste a real password into a PR, Jira or Notion.
- Every new variable goes into `.env.example` **and** `env.ts` in the same PR.

## 5. Tests use their own database (review point 1)

**Guard** (`tests/setup/guard.ts`). It runs **before** any migration, reset or test touches a database. It stops with a clear error unless **all** of these are true:
1. `TEST_DATABASE_URL` is set and parses as a `postgresql://` URL.
2. Its database name ends with **`_test`**.
3. Its host is local (`localhost`, `127.0.0.1` or `::1`).
4. It is **not** the same database as `DATABASE_URL`: the host, port and database name are compared.
5. `NODE_ENV` is not `production`.

After the guard passes, the test process sets `DATABASE_URL = TEST_DATABASE_URL` **before** Prisma Client is imported. That makes the app and Prisma use only the test database.

**Where the guard runs**
- `scripts/test-db.ts` (`db:test:prepare`) runs the guard, then runs `prisma migrate deploy` with `DATABASE_URL` set to the test URL.
- Vitest `globalSetup` runs the guard again, so even a direct `npx vitest` call is protected.
- `tests/setup/reset.ts` empties the tables (`TRUNCATE … RESTART IDENTITY CASCADE`) between integration tests. It refuses to run unless the guard already passed in this process.

**Exact commands** (from `backend/`, after section 6's setup):
```powershell
# one time: create the database in pgAdmin, named pulseops_test, and put its URL in .env as TEST_DATABASE_URL
npm run db:test:prepare   # guard + migrations on pulseops_test
npm test                  # runs db:test:prepare again (pretest), then all tests
npm run test:unit         # unit tests only, no database needed
```

The guard itself gets unit tests:
- the dev database is rejected
- a name without `_test` is rejected
- a remote host is rejected
- production mode is rejected
- the same database as `DATABASE_URL` is rejected

## 6. Clean checkout, migrations and Prisma (review points 2 and 4)

**From a clean checkout** (from `backend/`):
```powershell
copy .env.example .env    # then edit .env with your own user/password
npm ci
npm run db:generate       # Prisma Client: required, npm ci does not do it for us
npm run db:deploy         # apply committed migrations to pulseops_dev
npm run db:check          # expect: db ok
npm run dev               # then open http://localhost:3001/api/health → {"status":"ok"}
```

**Prisma rules**
- **Exact version pin.** PULSE-69 installs `prisma` and `@prisma/client` with **one exact, identical version** (no `^` or `~`). The chosen version is written in the PULSE-69 PR. Upgrades get their own PR.
- **Constraints Prisma can't express.** The database design (`docs/database/README.md`, section 6) uses CHECK constraints, a `lower(email)` expression index, partial (unique) indexes, a composite FK with `ON DELETE SET NULL (first_check_id)`, and a generated column. If the pinned Prisma version doesn't support one of them natively, create the migration with `--create-only`, add the SQL from `docs/database/schema.sql` by hand, and review it in the PR.
- **Parity check before merging any migration PR:**
  1. Apply all migrations to an empty database (`db:test:prepare` does this).
  2. Run `docs/database/verify.sql`, which must print `ALL CHECKS PASSED`.
  3. Compare the result with `schema.sql`, for example with `prisma migrate diff` or `pg_dump --schema-only`. Any difference must be explained in the PR.
- **IDs.** Prisma returns `BIGINT` as JavaScript `bigint`. `src/lib/ids.ts` converts IDs to and from decimal strings at the API boundary, and the API never sends a `Number` ID.
- **Schema changes:** run `npm run db:migrate -- --name <short_name>`, and commit `schema.prisma` and the new migration together. Never edit a migration that's already merged.

## 7. How the backend follows the PRD (review point 5)

| PRD | Backend behaviour |
|---|---|
| R1, BR-01 | Every route except register, login and health needs a signed-in user. Every query is filtered by owner. Someone else's resource returns `404` |
| R2, BR-02 | Create and edit validate the URL with the URL policy (section 8) and compute `url_normalized`. A duplicate for the same user returns `409` (from the database's unique constraint, so it's also safe under concurrency). Two users may monitor the same URL |
| R3 | A manual check endpoint and the scheduled worker both call `monitoring/httpCheck.ts` + `completeCheck.ts`. Each result records trigger, outcome, `duration_ms`, and HTTP status and latency **only if a response arrived** |
| R4 | The dashboard reads `current_status` (`unknown` = "not yet checked"), the latest results and history |
| R5, BR-03 | A failing applied check opens **one** incident (database partial unique index). Repeated failures don't create duplicates |
| R5, BR-04 | **A successful check never closes an incident.** It only records `recovered_at`. `POST …/incidents/:id/resolve` is owner-only and returns `409` while there is no recovery evidence; the database enforces the same rule |
| R5 | Notes: an owner-only create and list. Severity is shown as stored (the rule is a PROPOSAL in the database design) |
| BR-05 | Nothing deletes history in the MVP |

Endpoint health (`monitors.current_status`) and incident state (`incidents.status`) are separate, and only the newest result updates them (database design, section 4).

**Health endpoint (PULSE-68).** `GET /api/health` → `200 {"status":"ok"}`. It doesn't touch the database, so it stays fast. Database connectivity is checked by `npm run db:check`, and by an automated test in PULSE-73.

**Error format** (final shapes in PULSE-26): `{ "error": { "code": "…", "message": "…", "details": [] } }`. The codes are:
- 400: validation
- 401: not signed in
- 404: not found or not yours
- 409: duplicate URL, or resolving before recovery
- 500: generic message; details are only logged on the server

## 8. Monitoring URL policy (SSRF protection, BR-02) (review point 3)

The same policy runs **at create/edit** (returns `400` with a clear message, and no check is sent) and **again at every check**, because DNS can change. At check time, a blocked target is recorded as outcome `blocked` and no request is sent.

**1. URL shape** (parsed with the WHATWG `URL` parser, which also normalizes odd IP spellings such as `http://2130706433/` or `http://0x7f.1/`):
- The scheme must be `http` or `https`.
- No username or password in the URL.
- The host must not be `localhost` or end in `.localhost`.
- The URL must be at most 2048 characters.

**2. Resolve, then check every address.** Resolve **all** A and AAAA records. If **any** address is in a blocked range, the whole URL is blocked.

| Family | Blocked ranges |
|---|---|
| IPv4 | `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10` (CGNAT), `127.0.0.0/8`, `169.254.0.0/16` (link-local, incl. cloud metadata `169.254.169.254`), `172.16.0.0/12`, `192.0.0.0/24`, `192.0.2.0/24`, `192.168.0.0/16`, `198.18.0.0/15`, `198.51.100.0/24`, `203.0.113.0/24`, `224.0.0.0/4` (multicast), `240.0.0.0/4` (reserved, incl. `255.255.255.255`) |
| IPv6 | `::/128`, `::1/128` (loopback), `fc00::/7` (unique-local), `fe80::/10` (link-local), `ff00::/8` (multicast), `2001:db8::/32` (documentation), `100::/64` (discard) |
| IPv6 that carries IPv4 | `::ffff:0:0/96` (IPv4-mapped), `64:ff9b::/96` (NAT64) and `2002::/16` (6to4): **extract the embedded IPv4 address and apply the IPv4 rules** |

The implementation should use a maintained IP-parsing library (for example `ipaddr.js`) rather than string matching. The exact library is chosen in the implementation PR.

**3. Pin the address (prevents DNS rebinding).** The HTTP request connects **to the address that was just checked**, and passes it through the HTTP client's custom `lookup`/`connect` hook. The original host name is still sent as the `Host` header and TLS server name. A second DNS lookup between "check" and "connect" can therefore never swap in a private address.

**4. Redirects.** Automatic redirect following is **off**. The checker follows redirects itself, up to **5 hops**:
- Each `Location` is resolved against the current URL and goes through **steps 1–3 again**.
- A blocked hop ends the check as `blocked`.
- More than 5 hops ends it as `http_error` ("too many redirects").
- No cookies or credentials are carried between hops.

**5. Limits**

| Limit | Value |
|---|---|
| Total time per check (DNS + connect + all redirects + headers) | the monitor's `timeout_ms` (1000–30000 ms). Then the check is cancelled as `timeout` |
| Response body read | at most **64 KB**, then the connection is closed. Only the status is needed |
| Response headers | the Node.js default limit (16 KB) |
| Redirect hops | 5 |
| Request | `GET` or `HEAD` only, no request body, a fixed `User-Agent: PulseOps-Monitor`, no user cookies or auth headers |

**6. Tests** (unit, no network). Each blocked range above, IPv4-mapped and NAT64 forms, and odd IPv4 spellings are rejected. A public host that resolves to one public and one private address is rejected. A redirect to a private address is rejected. Over 5 hops fails, and a slow response times out. Real public addresses are allowed.

## 9. Other security rules
- Validate every request with Zod before it reaches a service.
- Never log request bodies, passwords, tokens or `.env` values.
- CORS allows only `FRONTEND_ORIGIN`, and the JSON body limit is 100 KB.

## 10. Decisions this plan does NOT make (TDD preparation checklist)

| Decision | Status / owner |
|---|---|
| Who authorizes implementation, and where it is recorded (section 0) | **Resolved:** Carlo, 21 Nov 2026, on PULSE-28 |
| Authentication method (session cookie vs JWT in an httpOnly cookie) | Open (TDD) |
| Worker process model and concurrency (inside the API process, or separate) | Open (PULSE-24, Majd). The claim and completion procedure works either way |
| Response-time semantics when there is no HTTP response | Open (PRD; Carlo with Majd and Mirla) |
| Severity values and rule | Open (PRD; Carlo with Gaelle and Mirla) |
| URL equivalence (duplicate rules) | Proposal in the database design, section 3.3 (Gaelle with Mirla) |
| Check interval default and history retention | Open (PRD; Carlo with Majd and Mirla) |
| Allowed ports for monitored URLs (any port vs only 80/443) | Open, a new question from this plan |
| Deployment target | Open (TDD) |
| GitHub Actions CI (`typecheck`, `test:unit`, and parity check) in Sprint 1 | Open |

## 11. Review checklist (PULSE-67 / PULSE-28)
- [x] Server structure, scripts and example configuration are documented
- [x] PostgreSQL 18.7 setup and `DATABASE_URL` / `TEST_DATABASE_URL` placeholders are documented; credentials stay out of Git
- [x] Test isolation, clean-checkout sequence, build output and URL policy are specified
- [x] Implementation authorization recorded (section 0)
- [ ] Majd reviews this plan; the open decisions in section 10 are settled in the TDD
