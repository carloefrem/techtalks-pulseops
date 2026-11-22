# PulseOps frontend: structure and setup plan (PULSE-64)

**Status:** Plan, waiting for Mirla's review. No frontend code exists yet.
**Author:** Gaelle · **Reviewer:** Mirla
**Parent:** PULSE-27 (S1-08 Prepare React frontend foundation)
**Follows:** the stack in the root [README](../../README.md) (Node 24.22.3, React 19, TypeScript, Vite, Tailwind CSS 4, React Router, Recharts, Lucide React, Vitest, React Testing Library, jsdom), the backend plan in PR #2 (`docs/backend/`) and the API contract in PULSE-26 (`docs/api/`).

---

## 0. Implementation authorization (required before any code)

PULSE-27 says implementation authorization must be recorded before coding starts. It was recorded on Nov 21, 2026 (table below). Per that comment, coding on PULSE-65 / PULSE-72 starts once this PR is merged. Until then, only this plan exists: no `frontend/` folder is created and no packages are installed.

| Item | Value |
|---|---|
| Approved by (name / role) | Carlo Efrem, team lead, following the TechTalks instruction (Nov 21) that all teams start implementation |
| Date | 2026-11-21 |
| Where it is recorded (Jira comment / Notion link) | Jira comment on [PULSE-27](https://pulseops-internship.atlassian.net/browse/PULSE-27); also Carlo's review comment on PR #6 |
| Scope approved | Initialize `frontend/` as described below, including PULSE-65 (starter page) and PULSE-72 (health status and unavailable state) |

---

## 1. Folder structure

```text
frontend/
├── index.html
├── public/
├── src/
│   ├── main.tsx               # Entry point: renders <App /> inside the router
│   ├── App.tsx                # Route table (section 5)
│   ├── index.css              # Tailwind import: @import "tailwindcss";
│   ├── config/
│   │   └── env.ts             # Reads VITE_API_BASE_URL once, with a default (section 3)
│   ├── api/
│   │   ├── client.ts          # One fetch wrapper: base URL, credentials, JSON, error shape (section 6)
│   │   ├── types.ts           # TypeScript types copied from docs/api/openapi.yaml
│   │   ├── health.ts          # getHealth()
│   │   ├── auth.ts            # register, login, logout, me (later)
│   │   ├── monitors.ts        # monitors + checks (later)
│   │   └── incidents.ts       # incidents + notes + resolve (later)
│   ├── pages/                 # One file per route
│   │   ├── HomePage.tsx       # Starter page with API status (PULSE-65 / PULSE-72)
│   │   └── NotFoundPage.tsx
│   ├── components/            # Reusable UI pieces
│   │   ├── StatusBadge.tsx    #   up / down / unknown ("not yet checked")
│   │   └── ApiStatus.tsx      #   shows the health result or the unavailable state
│   ├── features/              # Feature folders added in later sprints
│   │   └── monitors/          #   e.g. MonitorList.tsx, MonitorForm.tsx, useMonitors.ts
│   ├── hooks/                 # Shared hooks
│   └── test/
│       └── setup.ts           # Adds @testing-library/jest-dom matchers
├── .env.example               # Placeholder values only (committed)
├── .env.local                 # Your own overrides (NOT committed; already in .gitignore)
├── package.json
├── package-lock.json          # Committed, so everyone can run `npm ci`
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
└── vite.config.ts             # React + Tailwind plugins, /api proxy, Vitest config
```

**Why this layout**
- **All HTTP calls go through `api/client.ts`.** Pages and components never call `fetch` directly, so the base URL, cookies and error handling live in one place.
- **`api/` mirrors the API contract**, one file per group of routes in `docs/api/README.md` section 5. When a route changes, there's one obvious place to update.
- **`pages/` vs `features/`** matches the backend's `modules/` idea in PR #2: a page puts features together on a route, and each feature keeps its components and hooks in one folder.
- **Config is read in one place** (`config/env.ts`), the same as the backend's `config/env.ts`.

## 2. Dependencies

These are the packages already listed in the root README section 8. No new ones are added. Exact versions are fixed by `package-lock.json` when the project is initialized.

| Package | Type | Why |
|---|---|---|
| `react`, `react-dom` | runtime | React 19 (from the Vite `react-ts` template) |
| `react-router-dom` | runtime | Pages and redirects (login, dashboard, monitor detail) |
| `recharts` | runtime | Response-time chart on the monitor page (later) |
| `lucide-react` | runtime | Icons |
| `tailwindcss`, `@tailwindcss/vite` | dev* | Tailwind CSS 4 through its Vite plugin |
| `typescript`, `vite`, `@vitejs/plugin-react` | dev | From the template |
| `vitest`, `jsdom` | dev | Test runner and browser-like environment |
| `@testing-library/react`, `@testing-library/jest-dom` | dev | Component tests |

\* The root README installs `tailwindcss` and `@tailwindcss/vite` without `-D`. They're only needed at build time, so this plan puts them in `devDependencies`. Decided: `devDependencies` (open question 5, resolved).

Not planned for the MVP: a state-management library (Redux, Zustand), a data-fetching library (React Query), or a UI kit. They can be proposed later if the plain hooks get hard to manage.

## 3. Environment variables

`frontend/.env.example` (committed; placeholders only):

```dotenv
# Base URL of the backend API, as seen by the browser.
# Default "/api" uses the Vite dev proxy (see below). Only change it if the backend runs elsewhere.
VITE_API_BASE_URL="/api"
```

| Variable | Required | Rule (checked in `config/env.ts`) |
|---|---|---|
| `VITE_API_BASE_URL` | no | Default `/api`. Either a path starting with `/` or an `http(s)://` URL. No trailing slash |

**Dev proxy.** In `vite.config.ts`, requests to `/api` are forwarded to the backend:

```ts
server: {
  port: 5173,
  proxy: { "/api": "http://localhost:3001" },
},
```

This means the browser sees the frontend and the API as the **same origin** (`http://localhost:5173`). The session cookie from the API contract (`docs/api/README.md` section 3) then works without any CORS or `SameSite` issues in development. The backend's `FRONTEND_ORIGIN="http://localhost:5173"` and CORS settings from PR #2 stay in place for any setup that calls the API directly.

**Rules**
- **Everything starting with `VITE_` is built into the JavaScript and is public.** Never put a secret, password or token in a frontend env file.
- Never commit `.env.local`. The root `.gitignore` already ignores `.env` and `.env.*`, but not `.env.example`.
- Every new variable is added to `.env.example` **and** `config/env.ts` in the same PR.

## 4. npm scripts (`frontend/package.json`)

| Script | Command | Purpose |
|---|---|---|
| `dev` | `vite` | Run locally on `http://localhost:5173`; reloads on save |
| `build` | `tsc -b && vite build` | Type-check, then build to `dist/` (already in .gitignore) |
| `preview` | `vite preview` | Serve the built `dist/` locally to check it |
| `typecheck` | `tsc -b --noEmit` | Type errors only |
| `lint` | `eslint .` | From the Vite template |
| `test` | `vitest run` | Run tests once (CI and before a PR) |
| `test:watch` | `vitest` | Tests in watch mode |

Vitest config lives in `vite.config.ts`: `environment: "jsdom"`, `setupFiles: ["./src/test/setup.ts"]`.

## 5. Pages and routes

Each page lists the API calls it uses, from `docs/api/README.md` section 5. Only the first row is part of Sprint 1.

| Path | Page | API calls | Task |
|---|---|---|---|
| `/` | Starter page with API status | `GET /api/health` | PULSE-65, PULSE-72 |
| `/register`, `/login` | Sign up / sign in | `POST /api/auth/register`, `POST /api/auth/login` | later (R1) |
| `/dashboard` | My monitors with status and latest response time | `GET /api/monitors` | later (R2, R4) |
| `/monitors/new`, `/monitors/:id/edit` | Add / edit form | `POST`, `PATCH /api/monitors/...` | later (R2) |
| `/monitors/:id` | Detail: history, chart, manual check | `GET /api/monitors/:id`, `GET`/`POST .../checks` | later (R3, R4) |
| `/incidents`, `/incidents/:id` | Incident list, detail, notes, resolve | `GET /api/incidents...`, `POST .../notes`, `POST .../resolve` | later (R5) |
| `*` | Not found | – | PULSE-65 |

**Protected routes.** Every route except `/`, `/login` and `/register` calls `GET /api/auth/me` first. A `401` sends the user to `/login` (PRD section 3, "Unauthorized action"). This is a convenience only; the backend's ownership checks are what actually protect the data.

## 6. API client rules (`api/client.ts`)

- Every request uses `VITE_API_BASE_URL`, `credentials: "include"` and `Content-Type: application/json`.
- The frontend never stores a token in `localStorage` or reads the session cookie. The cookie is `HttpOnly`.
- A non-2xx response is turned into one `ApiError { status, code, message, details }`, matching the error shape in PR #2 / PULSE-26. Components switch on `code` (e.g. `DUPLICATE_MONITOR_URL`), never on the English `message`.
- A network failure (backend not running, connection refused) becomes `ApiError { status: 0, code: "NETWORK_ERROR" }`. This is a frontend-only code, so pages can show "API unavailable" instead of crashing.
- IDs stay **strings** everywhere (`docs/api/README.md` section 1). Never `Number(id)`.
- Every request has a timeout (proposal: 15 s) using `AbortController`, so a stuck request doesn't leave the page loading forever.
- `responseTimeMs` and `httpStatus` can be `null`. The UI shows "no response" and never `0 ms`.

## 7. Starter page and health status (PULSE-65 / PULSE-72)

The first page proves the frontend runs and can reach the backend.

| Backend state | What `GET /api/health` returns | What the page shows |
|---|---|---|
| Running | `200 { "status": "ok" }` | "API: online" with a green badge |
| Not running / proxy can't connect | Network error, or `502`/`504` from the dev proxy | "API: unavailable" with a red badge, the base URL being used, and a **Retry** button |
| Something else | Any other status or body | "API: unexpected response (status N)" |
| Request in progress | – | "Checking API…" |

The page never shows a raw error stack. The health check does not touch the database (PR #2 section 5), so "online" means the API process is running, not that PostgreSQL is reachable.

Tests (`ApiStatus.test.tsx`) mock `fetch` and check all four states.

## 8. Setup on a clean checkout (once authorized and the lockfile is committed)

1. Install Node.js 24.22.3 (see the root README). Check with `node -v`.
2. From the repository root:
   ```powershell
   cd frontend
   npm ci
   Copy-Item .env.example .env.local   # optional; the default already works with the proxy
   npm run dev
   ```
3. Open `http://localhost:5173`. Without the backend running, the page shows "API: unavailable". With the backend running (`npm run dev` in `backend/`, PR #2 section 4), it shows "API: online".
4. Run `npm test` and `npm run build`. Both must pass before opening a PR.

If PowerShell blocks npm scripts, use `npm.cmd` instead, as the root README says.

**Initializing (one time, by the assigned person only, after section 0 is filled in):** follow root README section 8, then add `vite.config.ts` (React + Tailwind plugins, proxy, Vitest), `src/index.css` with `@import "tailwindcss";`, `src/test/setup.ts`, `.env.example` and the scripts in section 4. Commit `package-lock.json` in the same PR.

## 9. Security notes for the frontend

- No secrets in any `VITE_` variable or in the source code.
- No token in `localStorage` or `sessionStorage`. The session lives only in the `HttpOnly` cookie.
- Render user-entered text (monitor names, URLs, incident notes) as normal React text. Never use `dangerouslySetInnerHTML`.
- Show monitored URLs as text, not as clickable links, in the MVP, so a stored URL can't be used as a `javascript:` link. The backend also rejects non-http(s) URLs.
- Hiding a page in the frontend is not access control. Access control is the backend's job (BR-01).

## 10. Open questions (for Mirla and the team)

1. ~~Who gives the implementation authorization in section 0, and where is it recorded?~~ **Resolved (Nov 21):** Carlo (team lead), recorded in PULSE-27 and PULSE-28. See section 0.
2. ~~**Track compliance:** is React with Vite (not Next.js) acceptable for the "React.js / Next.js" track?~~ **Resolved (Nov 21):** yes. The approved proposal is the React.js track, so React + Vite is fine (Carlo, PR #6 review).
3. Should `npm create vite@latest` be pinned to a specific version, so the template doesn't change between now and initialization? The lockfile only pins packages after the project exists.
4. ~~Tests next to the file or in a separate `tests/` folder?~~ **Resolved (Nov 21):** next to the file (`ApiStatus.test.tsx` beside `ApiStatus.tsx`), the default this plan proposed (Carlo, PR #6 review).
5. ~~Tailwind packages in `dependencies` or `devDependencies`?~~ **Resolved (Nov 21):** `devDependencies`, the default this plan proposed (Carlo, PR #6 review).
6. Dashboard refresh: poll `GET /api/monitors` every 30 s while the page is open? (Also PULSE-26 Q9.)
7. Is GitHub Actions CI (`typecheck` + `test` + `build`) in scope for Sprint 1? (Same as PR #2 Q4.)

## 11. Review checklist (PULSE-64 / PULSE-27)

- [x] Planned folders, dependencies and scripts are documented (sections 1, 2, 4)
- [x] API base URL configuration is documented with placeholders only, no secrets (section 3)
- [x] Implementation authorization recorded (section 0)
- [ ] Mirla reviews this plan; the PR is linked in Jira
- [ ] After authorization: a clean checkout installs from the lockfile and starts (PULSE-65), and Mirla reproduces it
