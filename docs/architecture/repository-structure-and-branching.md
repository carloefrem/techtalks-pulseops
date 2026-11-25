# PulseOps – Repository Structure and Branching Conventions

## 1. Proposed Folder Structure

PulseOps will use a monorepo structure, keeping the frontend, backend, monitoring worker, and documentation in one GitHub repository.

techtalks-pulseops/
│
├── frontend/                 # React application (planned)
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── services/
│       ├── hooks/
│       └── assets/
│
├── backend/                  # Express REST API (existing)
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   ├── prisma/
│   └── tests/
│
├── monitoring-worker/        # Background monitoring (planned)
│   └── src/
│       ├── jobs/
│       ├── services/
│       └── config/
│
├── docs/                     # Project documentation
│   └── architecture/
│
├── .gitignore
├── README.md
└── .env.example

### Folder Responsibilities

| Folder | Responsibility |
|---|---|
| frontend/ | React user interface |
| backend/ | Express API and business logic |
| monitoring-worker/ | Background monitoring tasks |
| docs/ | Technical documentation |
| prisma/ | Database schema and migrations |
| tests/ | Automated testing |

Note: Existing folders are identified separately from planned folders. The structure can evolve as development progresses.

## 2. Branching Conventions

The team will use a main-based branching workflow.

### Branch Naming Format

`<type>/<JIRA-ID>-<short-description>`

### Branch Types

| Type | Purpose | Example |
|---|---|---|
| feature/ | New functionality | feature/PULSE-75-user-auth |
| fix/ | Bug fixes | fix/PULSE-76-login-error |
| docs/ | Documentation | docs/PULSE-77-api-documentation |
| refactor/ | Code improvements | refactor/PULSE-78-cleanup |
| test/ | Testing | test/PULSE-79-api-tests |
| chore/ | Maintenance | chore/PULSE-80-dependencies |

### Development Workflow

1. Start from the latest main branch.
2. Create a branch for the assigned Jira task.
3. Implement the changes.
4. Test the changes.
5. Push the branch to GitHub.
6. Open a Pull Request targeting main.
7. Request a review from another developer.
8. Merge after approval and successful checks.

### Branching Rules

- Developers should not commit directly to main.
- Each Jira task should have its own branch.
- Every branch must include its Jira ticket ID.
- Pull Requests must be reviewed before merging.
- Merged branches should be deleted.
- Developers should keep their branches synchronized with main.

## 3. Benefits

- Keeps the repository organized.
- Separates frontend, backend, and monitoring responsibilities.
- Makes collaboration easier.
- Connects Git branches to Jira tasks.
- Reduces the risk of unreviewed changes.