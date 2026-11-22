# PulseOps backend

Express 5 + TypeScript REST API with Prisma 7 and PostgreSQL 18.7. The full design is in [`docs/backend/README.md`](../docs/backend/README.md) (PR #2), and the database design is in `docs/database/` (PR #1).

If PowerShell blocks npm scripts, use `npm.cmd` instead of `npm`.

## First-time setup (clean checkout)

1. In pgAdmin, create two databases on your PostgreSQL 18.7: `pulseops_dev` and `pulseops_test`.
2. From `backend/`:
   ```powershell
   Copy-Item .env.example .env   # then put YOUR user/password in DATABASE_URL and TEST_DATABASE_URL
   npm ci
   npm run db:generate           # required: generates Prisma Client (npm ci does not)
   npm run db:deploy             # creates the tables in pulseops_dev
   npm run db:check              # expect: db ok: database=pulseops_dev postgres=18.7 ...
   npm run dev                   # http://localhost:3001
   ```
3. Open `http://localhost:3001/api/health`. You should see `{"status":"ok"}`.

## Tests

```powershell
npm test                    # unit + API tests; the database tests are skipped
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
| `npm test` | All tests except the database ones |
| `npm run test:db` | Database connectivity tests (needs `TEST_DATABASE_URL`) |
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

Never commit `.env`. It is already in `.gitignore`.

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

Unknown routes return `404 {"error":{"code":"NOT_FOUND",...}}`, and malformed JSON returns `400 INVALID_JSON`.
