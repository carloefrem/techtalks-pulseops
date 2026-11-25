# PulseOps backend

Express 5 + TypeScript REST API with Prisma 7 and PostgreSQL 18.7. The full design is in [`docs/backend/README.md`](../docs/backend/README.md) (PR #2), and the database design is in `docs/database/` (PR #1).

If PowerShell blocks npm scripts, use `npm.cmd` instead of `npm`.

## First-time setup (clean checkout)

1. In pgAdmin, create two databases on your PostgreSQL 18.7: `pulseops_dev` and `pulseops_test`.
2. From `backend/`:
   ```powershell
   Copy-Item .env.example .env   # then put YOUR user/password in DATABASE_URL and TEST_DATABASE_URL, and set JWT_SECRET (see below)
   npm ci
   npm run db:generate           # required: generates Prisma Client (npm ci does not)
   npm run db:deploy             # creates the tables in pulseops_dev
   npm run db:check              # expect: db ok: database=pulseops_dev postgres=18.7 ...
   npm run dev                   # http://localhost:3001
   ```
3. Open `http://localhost:3001/api/health`. You should see `{"status":"ok"}`.

## Tests

```powershell
npm test                    # all tests; database tests run only if TEST_DATABASE_URL is set in .env
npm run db:test:prepare     # one time / after new migrations: migrates pulseops_test
npm run test:db             # database tests (uses TEST_DATABASE_URL only)
```

**Safety guard:** database tests and `db:test:prepare` refuse to run unless `TEST_DATABASE_URL`:
- is a local database whose name ends in `_test`
- is not the same database as `DATABASE_URL`
- is not used with `NODE_ENV=production`

After connecting, the tests also check that the server really is serving that `_test` database. Your dev data can't be touched by tests.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start with auto-restart on save |
| `npm run build` / `npm start` | Compile `src/` to `dist/` / run `dist/server.js` |
| `npm run typecheck` | Type errors in `src/`, `scripts/` and `tests/` |
| `npm test` | All tests (database tests are skipped when `TEST_DATABASE_URL` is not set) |
| `npm run test:db` | Database tests: connectivity and the auth user store (needs `TEST_DATABASE_URL`) |
| `npm run db:generate` | Generate Prisma Client into `src/generated/` (not committed) |
| `npm run db:deploy` | Apply committed migrations to `DATABASE_URL` |
| `npm run db:migrate` | Create a new migration in development (read the generated SQL before committing) |
| `npm run db:check` | Connectivity check: prints `db ok ...` or exits with code 1 |
| `npm run db:test:prepare` | Guard + apply migrations to `TEST_DATABASE_URL` |
| `npm run db:studio` | Browse your local data |

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV` | no | default `development` |
| `PORT` | no | default `3001` |
| `FRONTEND_ORIGIN` | yes | the only origin allowed by CORS |
| `DATABASE_URL` | yes | your `pulseops_dev` database |
| `TEST_DATABASE_URL` | tests only | your `pulseops_test` database |
| `TRUST_PROXY` | no | default `0`. Number of reverse proxies in front of the API; set `1` when deployed behind a host's proxy so rate limits see real client IPs |
| `JWT_SECRET` | yes | signs login sessions; at least 32 random characters. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |

Never commit `.env`. It is already in `.gitignore`.

## Security (PULSE-111)

- **Headers:** `helmet` with a strict CSP (`default-src 'none'`), since the API serves only JSON. No `X-Powered-By`.
- **CORS:** only `FRONTEND_ORIGIN` gets `Access-Control-*` headers (with credentials). Any other origin gets none.
- **Body size:** JSON bodies over 100 kb get `413 PAYLOAD_TOO_LARGE`.
- **Rate limits:** `POST /api/auth/login` and `/register` share 10 requests per 15 minutes per client IP, then `429 RATE_LIMITED` with `Retry-After`. `manualCheckRateLimiter()` (6 per minute per signed-in user) is ready for `POST /api/monitors/:id/checks` (PULSE-92): mount it after `requireAuth`.

## Database and migrations

- The first migration (`prisma/migrations/20261122000000_init`) is `docs/database/schema.sql` from PR #1, copied verbatim. It's hand-written because Prisma can't express the CHECK constraints, partial indexes and the `ON DELETE SET NULL (first_check_id)` foreign key.
- `prisma/schema.prisma` describes the same tables for Prisma Client. On a freshly migrated database,
  `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` prints `This is an empty migration.` (no drift).
- Prisma and `@prisma/client` are pinned to **7.10.1**. Upgrades get their own PR.
- IDs come back from Prisma as JavaScript `bigint`. Convert them to strings in API responses.

## Endpoints

| Method | Path | Response |
|---|---|---|
| GET | `/api/health` | `200 {"status":"ok"}`. Does not touch the database |
| POST | `/api/auth/register` | `201 {"user":{...}}` and sets the session cookie. `409 EMAIL_TAKEN`, `400 VALIDATION_ERROR` |
| POST | `/api/auth/login` | `200 {"user":{...}}` and sets the session cookie. `401 INVALID_CREDENTIALS` |
| POST | `/api/auth/logout` | `204`, clears the session cookie |
| GET | `/api/auth/me` | `200 {"user":{...}}`, or `401 UNAUTHENTICATED` without a valid session |

**Sessions (PULSE-87):** a signed JWT (HS256, 7 days) in the `pulseops_session` cookie: `HttpOnly`, `SameSite=Lax`, `Path=/api`, and `Secure` in production. The frontend never reads it; it only sends requests with `credentials: "include"`. Protected routes use `requireAuth`, which puts the user's ID in `res.locals.userId`.

Unknown routes return `404 {"error":{"code":"NOT_FOUND",...}}`, and malformed JSON returns `400 INVALID_JSON`.
