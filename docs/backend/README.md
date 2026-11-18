# PulseOps backend: structure and configuration plan (PULSE-67)

**Status:** Plan, waiting for Majd's review. No backend code exists yet.
**Author:** Mirla · **Reviewer:** Majd
**Parent:** PULSE-28 (S1-09 Express backend foundation)
**Follows:** the stack in the root [README](../../README.md) (Node 24.22.3, Express 5, TypeScript, Zod, CORS, dotenv, Prisma, PostgreSQL 18.7, Vitest), and the database design in PULSE-25 (`docs/database/`).

---

## 0. Implementation authorization (required before any code)

PULSE-28 says implementation authorization must be recorded before coding starts. Until this table is filled in, only this plan exists. No `backend/` folder is created and no packages are installed.

| Item | Value |
|---|---|
| Approved by (name / role) | _pending_ |
| Date | _pending_ |
| Where it is recorded (Jira comment / Notion link) | _pending_ |
| Scope approved | Initialize `backend/` as described below, including PULSE-68 (health endpoint) and PULSE-69 (DB connection + first migration) |

---

## 1. Folder structure

```text
backend/
├── src/
│   ├── server.ts              # Starts the HTTP server (app.listen). The only file that opens a port
│   ├── app.ts                 # Builds the Express app: middleware + routes. Exported, so tests can use it without a port
│   ├── config/
│   │   └── env.ts             # Reads .env and validates it with Zod. Stops at startup if anything is missing
│   ├── db/
│   │   └── prisma.ts          # One shared PrismaClient instance
│   ├── routes/
│   │   ├── index.ts           # Mounts every router under /api
│   │   └── health.routes.ts   # GET /api/health
│   ├── modules/               # One folder per feature (added in later sprints)
│   │   └── monitors/          #   e.g. monitors.routes.ts, .controller.ts, .service.ts, .schemas.ts
│   ├── middleware/
│   │   ├── notFound.ts        # 404 JSON for unknown routes
│   │   ├── errorHandler.ts    # Turns every error into the shared JSON error format (section 5)
│   │   └── validate.ts        # Validates the body/query/params of a request against a Zod schema
│   └── worker/                # Scheduled HTTP checks (later; design decided in PULSE-24)
├── prisma/
│   ├── schema.prisma          # Prisma version of docs/database/schema.sql
│   └── migrations/            # Versioned migrations, committed to Git
├── tests/
│   └── health.test.ts         # Calls GET /api/health on app.ts and expects 200 { status: "ok" }
├── .env.example               # Placeholder values only (committed)
├── .env                       # Real local values (NOT committed; already in .gitignore)
├── package.json
├── package-lock.json          # Committed, so everyone can run `npm ci`
└── tsconfig.json
```

**Why this layout**
- **`app.ts` and `server.ts` are separate**, so tests can import the app and send requests to it without starting a real server.
- **Feature folders (`modules/`)** keep everything about one feature together: route → controller (HTTP in/out) → service (logic + database). When Gaelle's API contract (PULSE-26) adds routes, each one has an obvious home.
- **Config is validated in one place.** A missing `DATABASE_URL` fails immediately with a clear message, not later with a confusing database error.

## 2. npm scripts (`backend/package.json`)

| Script | Command | Purpose |
|---|---|---|
| `dev` | `tsx watch src/server.ts` | Run locally; restarts on save |
| `build` | `tsc -p tsconfig.json` | Compile to `dist/` (already in .gitignore) |
| `start` | `node dist/server.js` | Run the compiled build |
| `typecheck` | `tsc --noEmit` | Type errors only, no output |
| `test` | `vitest run` | Run tests once (CI and before a PR) |
| `test:watch` | `vitest` | Tests in watch mode |
| `db:migrate` | `prisma migrate dev` | Create or apply migrations on your local database |
| `db:deploy` | `prisma migrate deploy` | Apply committed migrations only (clean checkout, CI) |
| `db:generate` | `prisma generate` | Regenerate the Prisma client after editing the schema |
| `db:studio` | `prisma studio` | Browse local data |

Module format: ES modules (`"type": "module"` in package.json, with `module`/`moduleResolution` set to `NodeNext` in tsconfig). `strict: true`.

## 3. Environment variables

`backend/.env.example` (committed; it holds placeholders only):

```dotenv
# Runtime
NODE_ENV=development
PORT=3001

# Frontend allowed by CORS (Vite dev server)
FRONTEND_ORIGIN="http://localhost:5173"

# Local PostgreSQL 18.7. Copy this file to .env and fill in YOUR user/password.
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/pulseops_dev"
```

| Variable | Required | Rule (checked by Zod in `config/env.ts`) |
|---|---|---|
| `NODE_ENV` | no | `development` \| `test` \| `production`, default `development` |
| `PORT` | no | integer, default `3001` |
| `FRONTEND_ORIGIN` | yes | valid URL |
| `DATABASE_URL` | yes | must start with `postgresql://` |

Added later, when their features arrive: `JWT_SECRET` (authentication), plus the worker's check interval and timeouts.

**Rules**
- Never commit `.env`. The root `.gitignore` already ignores `.env` and `.env.*`, but not `.env.example`.
- Never paste a real password into a PR, Jira or Notion.
- Every new variable is added to `.env.example` **and** `config/env.ts` in the same PR.

## 4. PostgreSQL setup (each developer, locally)

1. Install PostgreSQL 18.7 and pgAdmin 4 (see the root README).
2. In pgAdmin, create two databases:
   - `pulseops_dev`, used for running the app
   - `pulseops_test`, used by the tests, so they never touch your dev data
3. Copy `backend/.env.example` to `backend/.env` and put your own Postgres user and password in `DATABASE_URL`.
4. From `backend/`, run:
   ```powershell
   npm ci
   npm run db:deploy
   npm run dev
   ```
5. Check it works: open `http://localhost:3001/api/health`. You should see `{"status":"ok"}`.

**Schema changes:** edit `prisma/schema.prisma`, then run `npm run db:migrate -- --name <short_name>`, and commit both the schema and the new `migrations/` folder in the same PR. Never edit a migration that has already been merged.

## 5. API conventions (to be confirmed by PULSE-26)

- Every route is under **`/api`**.
- JSON only. The body limit is `100kb`.
- **CORS** allows only `FRONTEND_ORIGIN`.
- **Errors** always use one shape:
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "url must start with http(s)://", "details": [] } }
  ```
  | Status | When |
  |---|---|
  | 400 | Invalid body/query (Zod) |
  | 401 | Not signed in |
  | 404 | Not found, **or owned by another user** (see the ownership rule in `docs/database/README.md`) |
  | 409 | Conflict, e.g. a duplicate monitor name |
  | 500 | Unexpected error. The message is generic and the details are only logged on the server |
- Express 5 passes errors from `async` route handlers to `errorHandler` automatically, so no try/catch wrapper is needed.

### Health endpoint (PULSE-68)
- `GET /api/health` → `200` with `{ "status": "ok" }`.
- It does **not** call the database, so it stays fast and still answers while the database is down.
- Database connectivity is checked separately (PULSE-69/PULSE-73), with a reproducible check such as `npm run db:check` that runs `SELECT 1` through Prisma.

## 6. Security notes for the backend
These come from the root README's security section.
- Validate every input with Zod before it reaches a service.
- Filter every monitor, check or incident query by the signed-in user.
- The worker must only call `http(s)` URLs, use timeouts, and refuse private or internal addresses (localhost, 10.x, 172.16–31.x, 192.168.x, 169.254.x) to prevent SSRF.
- Don't log request bodies or secrets.

## 7. Open questions (for Majd and the team)
1. Who gives the implementation authorization in section 0 (the supervisor?), and where is it recorded?
2. Does the monitoring worker run inside the API process (simple, MVP) or as a separate process? This is a PULSE-24 decision.
3. Authentication method: a JWT in an httpOnly cookie, or a session? This affects `JWT_SECRET` and CORS `credentials`.
4. Is GitHub Actions CI (`typecheck` + `test`) in scope for Sprint 1?

## 8. Review checklist (PULSE-67 / PULSE-28)
- [x] Server structure, scripts and example configuration are documented
- [x] PostgreSQL setup and `DATABASE_URL` placeholders are documented; credentials stay out of Git
- [ ] Implementation authorization recorded (section 0)
- [ ] Majd reviews this plan; the PR is linked in Jira
