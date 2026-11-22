# PulseOps backend

Express 5 + TypeScript REST API. The full design is in [`docs/backend/README.md`](../docs/backend/README.md) (PR #2).

## Run it locally

From `backend/`:

```powershell
Copy-Item .env.example .env   # then edit .env with your own values
npm ci
npm run dev                   # http://localhost:3001
```

Open `http://localhost:3001/api/health`. You should see `{"status":"ok"}`.

If PowerShell blocks npm scripts, use `npm.cmd` instead of `npm`.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start with auto-restart on save (tsx) |
| `npm run build` | Compile `src/` to `dist/` |
| `npm start` | Run the compiled build (`dist/server.js`) |
| `npm run typecheck` | Type errors in `src/` and `tests/` |
| `npm test` | Run all tests once (Vitest) |

## Environment variables

Validated at startup by `src/config/env.ts`. The server stops with a clear message if one is missing.

| Variable | Required | Default |
|---|---|---|
| `NODE_ENV` | no | `development` |
| `PORT` | no | `3001` |
| `FRONTEND_ORIGIN` | yes | none. The only origin allowed by CORS |
| `DATABASE_URL` | yes | none. Your local PostgreSQL 18.7 (used from PULSE-69) |

Never commit `.env`. It is already in `.gitignore`.

## Endpoints

| Method | Path | Response |
|---|---|---|
| GET | `/api/health` | `200 {"status":"ok"}`. Does not touch the database |

Unknown routes return `404 {"error":{"code":"NOT_FOUND",...}}`, and malformed JSON returns `400 INVALID_JSON`.
