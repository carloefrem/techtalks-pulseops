# PulseOps repository workflow (PULSE-22)

Proposed for team review. This document does not assert that GitHub protection settings are enabled.

## Before starting

Read the current PRD, TDD and API contract and link the relevant sections in Jira. Keep unknown decisions explicit. Record the implementation authorization required by PULSE-27/PULSE-28 before initializing application code.

Pull the latest main branch and create a branch containing the actual Jira key:

```powershell
git switch main
git pull --ff-only
git switch -c feature/PULSE-51-workflow-practice
```

Use feature/, fix/ or docs/ as appropriate. Configure your own Git name and email; do not use another member's identity.

## Commit and review

1. Make a focused change, check the diff and run relevant verification.
2. Commit with a descriptive message including the Jira key.
3. Push the branch and open a PR using the repository template.
4. Link the PR in Jira and request the designated teammate's review.
5. Resolve requested changes and obtain review of the latest revision.
6. Merge only after approval and applicable checks pass. Update Jira with evidence.
7. Each developer confirms their own checkout and setup; an agent review does not establish that every teammate has reproduced it.

Do not commit real .env files, tokens, passwords, dependencies or build output. Use npm ci once committed package-lock.json files exist.

## Manual merge safeguard

Use the steps above even if GitHub does not enforce them. Never self-approve or treat a PR being mergeable as evidence of correctness. If no CI exists, document the relevant manual verification and its limits.

On November 19, 2026 the rulesets endpoint returned an empty list. The integration could not read legacy main-branch protection (403), so legacy protection remains unverified. A repository administrator should confirm it separately; this review does not change permissions or protection settings.

## Review ownership

| Work | Primary | Reviewer |
|---|---|---|
| Repository/workflow | Carlo | Majd |
| Database design | Mirla | Carlo |
| Architecture | Majd | Gaelle |
| API contract | Gaelle | Majd |
| Frontend foundation | Gaelle | Mirla |
| Backend foundation | Mirla | Majd |
| Integration/testing | Majd | Carlo |

The task assignee remains responsible for supplying evidence and resolving feedback. Review does not imply implementation approval or permission to merge unrelated work.
