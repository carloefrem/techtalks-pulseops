# PulseOps repository workflow (PULSE-22)

How the team branches, reviews and merges. `main` branch protection was enabled by Carlo on Nov 21, 2026 (see *Merge rules*).

## Before starting

Read the relevant parts of the PRD, TDD and API contract (`docs/api/`) and link them in Jira. Keep unknown decisions explicit. Implementation was authorized on Nov 21, 2026 (recorded in PULSE-27/PULSE-28), so application code can be written.

Pull the latest main branch and create a branch containing the actual Jira key:

```powershell
git switch main
git pull --ff-only
git switch -c docs/PULSE-51-workflow-notes
```

Branch names are `<type>/PULSE-<id>-<short-name>`, with type `feature`, `fix`, `docs`, `test` or `chore`. Configure your own Git name and email; do not use another member's identity.

## Commit and review

1. Make a focused change, check the diff and run relevant verification.
2. Commit as `type(scope): summary (PULSE-<id>)`, e.g. `feat(backend): auth API (PULSE-87)` or `docs(api): record session decision (PULSE-87)`.
3. Push the branch and open a PR using the repository template.
4. Link the PR in Jira and request the designated teammate's review.
5. Resolve requested changes and obtain review of the latest revision.
6. Merge only after approval and applicable checks pass (see *Merge rules*). Update Jira with evidence.
7. Each developer confirms their own checkout and setup; an agent review does not establish that every teammate has reproduced it.

Do not commit real .env files, tokens, passwords, dependencies or build output. Use npm ci once committed package-lock.json files exist.

## Merge rules

`main` is protected (enabled Nov 21, 2026):

- A pull request is required; nobody pushes to `main` directly.
- **1 approving review** from someone other than the author.
- **New commits dismiss earlier approvals**, so ask for a re-review after pushing changes.
- **All review conversations must be resolved** before merging.

Then:

- The **author** merges, using **Squash and merge**, so each PR becomes one commit on `main` titled `type(scope): summary (PULSE-<id>) (#<PR>)`.
- **Delete the branch** after merging (GitHub offers a button).
- Move the Jira ticket to Done and add the merge link.

Never self-approve or treat "mergeable" as proof that something works. Until CI exists (PULSE-102), write the commands you ran and their results in the PR.

## PRs that depend on other open PRs

Prefer branching from `main`. When a PR has to build on another open PR:

1. Branch from the other PR's branch and set it as the **base** of your PR, so the diff shows only your changes.
2. Say so at the top of the PR description and under *Follow-up* (e.g. "Stacked on #16").
3. After the base PR is squash-merged, change your PR's base to `main` and replay only your own commits:
   `git rebase --onto origin/main <last commit of the old base>`, then `git push --force-with-lease` on **your own** branch.
   A squash merge creates a new commit, so a plain rebase or merge would show conflicts with your own already-merged changes.

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

The table covers the Sprint 1 foundations; for later work the reviewer is named on each Jira ticket. The task assignee remains responsible for supplying evidence and resolving feedback. Review does not imply permission to merge unrelated work.
