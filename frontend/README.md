# PulseOps frontend

React 19 + Vite + TypeScript + Tailwind CSS 4. The design and the reasons behind it are in [docs/frontend/README.md](../docs/frontend/README.md) (PULSE-64).

Created with `npm create vite@9.3.4 frontend -- --template react-ts` (PULSE-65). From now on `package-lock.json` pins every version.

## Run it

Requires Node.js 24.22.3 or newer (`node -v`).

```powershell
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173.

- **Backend not running:** the page shows **API: unavailable**, the API base URL and a **Retry** button.
- **Backend running** (`npm run dev` in `backend/`, see [backend/README.md](../backend/README.md)): the page shows **API: online**.

If PowerShell blocks npm scripts, use `npm.cmd` instead.

## Configuration

`VITE_API_BASE_URL` defaults to `/api`, which the Vite dev server forwards to `http://localhost:3001`, so you don't need an env file. To change it, copy `.env.example` to `.env.local` (never committed).

Everything starting with `VITE_` is built into the JavaScript and is **public**. Never put a secret in it.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server on port 5173 (fails instead of moving to another port) |
| `npm test` | Run all tests once (Vitest + React Testing Library, jsdom) |
| `npm run test:watch` | Tests in watch mode |
| `npm run typecheck` | Type errors only |
| `npm run lint` | oxlint (the linter the Vite template now ships) |
| `npm run build` | Type-check, then build to `dist/` |
| `npm run preview` | Serve the built `dist/` locally |

Run `npm test` and `npm run build` before opening a PR.

## Layout

```text
src/
├── main.tsx              Entry: <App /> inside BrowserRouter
├── App.tsx               Routes: "/" and a not-found page
├── config/env.ts         Reads and checks VITE_API_BASE_URL
├── api/client.ts         The only place that calls fetch (timeout, credentials, ApiError)
├── api/health.ts         GET /api/health → online / unavailable / unexpected
├── components/           ApiStatus, StatusBadge
├── pages/                HomePage, NotFoundPage
└── test/setup.ts         jest-dom matchers
```

Tests sit next to the file they test (`ApiStatus.test.tsx` beside `ApiStatus.tsx`).
