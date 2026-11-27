
# TechTalks — PulseOps

API Uptime Monitoring & Incident Tracking Platform

**Project:** PulseOps  
**Program:** TechTalks Internship 2026  
**Team:** Carlo, Gaelle, Mirla, Majd  
**Status:** Initial setup and planning

## Contents

1. [Project Overview](#1-project-overview)
2. [Project Links](#2-project-links)
3. [Required Software](#3-required-software)
4. [Verify Installed Software](#4-verify-installed-software)
5. [VS Code Extensions](#5-vs-code-extensions)
6. [Planned Technology Stack](#6-planned-technology-stack)
7. [Repository Structure](#7-repository-structure)
8. [Initialize the Frontend](#8-initialize-the-frontend)
9. [Initialize the Backend](#9-initialize-the-backend)
10. [Install Dependencies on Other Computers](#10-install-dependencies-on-other-computers)
11. [PostgreSQL Setup](#11-postgresql-setup)
12. [Environment Variables](#12-environment-variables)
13. [GitHub Workflow](#13-github-workflow)
14. [Setup Checklist](#14-setup-checklist)
15. [Project Security](#15-project-security)
16. [Documentation](#16-documentation)

## 1. Project Overview

PulseOps is a web application designed to help developers monitor HTTP APIs, track response times, detect failures, and view incidents through a dashboard.

### Planned MVP
- User authentication
- Monitor management (create, view, edit, delete)
- Automated HTTP availability checks
- Check history and latency measurements
- Incident detection and recovery
- Dashboard with monitoring metrics

Final requirements and incident rules must be confirmed in the approved PRD.

## 2. Project Links

- Jira: https://pulseops-internship.atlassian.net/jira
- Notion PRD (v1.1, Draft): https://www.notion.so/41a4cd9e492d80429fe9fca7d4197128
- Notion TDD (template, not yet completed): https://www.notion.so/41b4cd9e492d8039a742d90d649d93b9
- GitHub: This repository

## 3. Required Software

All developers should use Windows 10/11 and the following baseline.

| Software | Version | Download |
|---|---|---|
| VS Code | Latest stable | https://code.visualstudio.com/download |
| Node.js | 24.22.3 | https://nodejs.org/dist/v24.22.3/ |
| npm | 11.19.1 | Included with Node.js; update if needed |
| Git | Team-agreed stable version | https://git-scm.com/install/windows |
| PostgreSQL | 18.7, same version for everyone (changed from 17.x by team decision on 18 Nov 2026, recorded on [PULSE-45](https://pulseops-internship.atlassian.net/browse/PULSE-45)) | https://www.postgresql.org/download/windows/ |
| pgAdmin 4 | Compatible version | https://www.pgadmin.org/download/ |
| Bruno | Latest stable | https://www.usebruno.com/downloads |
| Chrome / Edge | Latest stable | Browser |

### Online Services — No Installation Required

- GitHub: https://github.com
- Jira: https://pulseops-internship.atlassian.net/jira
- Notion: https://www.notion.so

Request access to the shared team workspaces.

### Optional

Docker Desktop: https://www.docker.com/products/docker-desktop/

Docker is not required for the initial setup.

## 4. Verify Installed Software

Open PowerShell and run:

```powershell
node -v
npm -v
git --version
```

Expected Node.js version:

```text
v24.22.3
```

Expected npm version:

```text
11.19.1
```

If npm needs updating:

```powershell
npm install -g npm@11.19.1
```

If PowerShell blocks npm scripts, use `npm.cmd` instead.

### Configure Git

Each developer must configure their own identity:

```powershell
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

## 5. VS Code Extensions

Install these through the Extensions panel:

- ESLint
- Prettier - Code formatter
- Prisma
- Tailwind CSS IntelliSense

Optional:
- GitLens

## 6. Planned Technology Stack

### Frontend
- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- React Router
- Recharts
- Lucide React

### Backend
- Node.js 24
- Express 5
- TypeScript
- Zod
- CORS
- dotenv

### Database
- PostgreSQL 18.7
- Prisma ORM

### Testing
- Vitest
- React Testing Library
- jsdom
- Backend integration tests

Exact npm package versions will be committed in package-lock.json after initialization.

Do not install React, Express, Prisma, or TypeScript globally.

## 7. Repository Structure

```text
techtalks-pulseops/
├── frontend/      # React app
├── backend/       # Express API, Prisma schema and migrations
├── docs/          # Technical design documents
├── .github/       # PR template and CI workflows
├── .nvmrc         # Node.js version
├── .gitignore
└── README.md
```

| Path | Status | Owner task | Notes |
|---|---|---|---|
| `README.md` | Exists | PULSE-22 / PULSE-50 | Overview and setup guide |
| `.gitignore` | Exists | PULSE-22 | Excludes `.env*` (except `.env.example`), `node_modules/` and `dist/` |
| `docs/database/` | Exists ([README](docs/database/README.md), merged in #1) | PULSE-25 | Database design: ERD, tables, indexes, `schema.sql`, `verify.sql` |
| `docs/backend/` | Exists ([README](docs/backend/README.md), merged in #2) | PULSE-67 | Backend folder structure, scripts and env plan |
| `docs/api/` | Exists ([README](docs/api/README.md), merged in #5) | PULSE-26 | REST API contract and `openapi.yaml` |
| `docs/frontend/` | Exists ([README](docs/frontend/README.md), merged in #6) | PULSE-64 | Frontend structure and setup plan |
| `docs/workflow.md` | Exists (this PR, #4) | PULSE-22 / PULSE-51 | Branching, review and merge rules |
| `backend/` | Exists (merged in #7, #8) | PULSE-28 | Express 5 API, Prisma, first migration; see [backend/README.md](backend/README.md) |
| `frontend/` | In review ([PR #9](https://github.com/carloefrem/techtalks-pulseops/pull/9)) | PULSE-27 | React + Vite starter (section 8) |
| `.github/` | Exists (PR template, this PR #4) | PULSE-22 | CI workflow planned in PULSE-102 |
| `.nvmrc` | Planned | PULSE-22 | See below |

Update the **Status** column in the same PR that adds or removes a folder.

The .nvmrc file should contain:

```text
24.22.3
```

## 8. Initialize the Frontend

> **Before running these commands:** implementation authorization for the frontend (PULSE-27) must be recorded in Jira. **Recorded 21 Nov 2026** by Carlo on [PULSE-27](https://pulseops-internship.atlassian.net/browse/PULSE-27); initialization starts once the frontend plan (PR #6) is merged.

Only the assigned setup pair should initialize the application.

From the repository root:

```powershell
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install react-router-dom recharts lucide-react
npm install tailwindcss @tailwindcss/vite
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Configure Tailwind and testing afterward.

## 9. Initialize the Backend

> **Before running these commands:** implementation authorization for the backend (PULSE-28) must be recorded in Jira. **Recorded 21 Nov 2026** by Carlo on [PULSE-28](https://pulseops-internship.atlassian.net/browse/PULSE-28).

Return to the repository root:

```powershell
cd ..
mkdir backend
cd backend
npm init -y
npm install express cors dotenv zod @prisma/client
npm install -D prisma typescript tsx vitest
npm install -D @types/node @types/express @types/cors
npx tsc --init
```

These commands install packages but do not yet create a working Express server.

Prisma configuration, authentication, and API implementation are separate development tasks.

## 10. Install Dependencies on Other Computers

After the application has been initialized and the lockfiles committed, each developer clones the repository.

```powershell
git clone <REPOSITORY-URL>
cd techtalks-pulseops
```

Install the frontend dependencies:

```powershell
cd frontend
npm ci
```

Install the backend dependencies:

```powershell
cd ..\backend
npm ci
```

Use `npm ci` to install dependencies from the committed package-lock.json files.

Do not run these commands until the frontend and backend folders exist.

## 11. PostgreSQL Setup

1. Install PostgreSQL 18.7.
2. Install or open pgAdmin 4.
3. Connect to the local PostgreSQL server.
4. Create a database named `pulseops_dev`.
5. Keep your database password private.

Each developer uses their own local database.

Database schema changes will be shared through Prisma migrations in GitHub.

## 12. Environment Variables

Create backend/.env using the team's documented variables.

Example backend/.env.example:

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/pulseops_dev"
PORT=3001
FRONTEND_ORIGIN="http://localhost:5173"
```

Never commit real .env files or credentials.

## 13. GitHub Workflow

The full rules are in **[docs/workflow.md](docs/workflow.md)**. In short:

1. Branch from the latest `main`: `<type>/PULSE-<id>-<short-name>` (types: `feature`, `fix`, `docs`, `test`, `chore`).
2. Commit as `type(scope): summary (PULSE-<id>)`.
3. Open a PR with the template, link the Jira ticket, and request the reviewer named in Jira.
4. `main` is protected: 1 approval, all conversations resolved; a new commit dismisses earlier approvals.
5. The author merges with **Squash and merge** and deletes the branch, then moves the Jira ticket to Done.

Everyone must contribute to multiple areas of the application, including frontend, backend, database, testing, and documentation.

## 14. Setup Checklist

- [ ] VS Code installed
- [ ] Node.js 24.22.3 verified
- [ ] npm 11.19.1 verified
- [ ] Git installed and configured
- [ ] PostgreSQL 18.7 installed
- [ ] pgAdmin working
- [ ] Bruno installed
- [ ] GitHub repository access confirmed
- [ ] Jira access confirmed
- [ ] Notion access confirmed
- [ ] Repository cloned
- [ ] Frontend dependencies installed when ready
- [ ] Backend dependencies installed when ready
- [ ] Practice branch and Pull Request completed

## 15. Project Security

- Never commit passwords or API keys.
- Never commit .env files.
- Validate all API inputs.
- Enforce user authorization.
- Restrict monitored URLs to safe, approved HTTP(S) targets.
- Use timeouts and protect against requests to internal networks.
- Review code before merging.

## 16. Documentation

Product requirements and technical decisions are maintained in the shared Notion workspace.

Jira is the source of truth for assigned tasks, sprint progress, and acceptance criteria.

GitHub is the source of truth for code, reviews, and versioned technical configuration.

### Technical documents in this repository

| Document | Jira | Status |
|---|---|---|
| [Database design](docs/database/README.md) | PULSE-25 | Merged (#1) |
| [Backend structure and configuration plan](docs/backend/README.md) | PULSE-67 | Merged (#2) |
| [REST API contract](docs/api/README.md) and [OpenAPI spec](docs/api/openapi.yaml) | PULSE-26 | Merged (#5); updated by feature PRs as decisions are made |
| [Frontend structure and setup plan](docs/frontend/README.md) | PULSE-64 | Merged (#6) |
| [Repository workflow](docs/workflow.md) | PULSE-22 | This PR (#4) |
| [PRD and MVP scope](https://www.notion.so/41a4cd9e492d80429fe9fca7d4197128) | PULSE-19 | Notion, v1.1, accepted as the working guide (Nov 21) |
| [System architecture (TDD)](https://www.notion.so/41b4cd9e492d8039a742d90d649d93b9) | PULSE-24 | Notion, architecture sections written; review pending (PULSE-55) |
| [Sprint 01 report](https://app.notion.com/p/4204cd9e492d80cc9d44cac2c7e7c9e4) | PULSE-32 | Notion, submitted to TechTalks on Nov 22 |
