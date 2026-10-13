---
name: Safe Git Workflow
description: Read-only git inspection and this repository's branch, commit and PR policy. Use before proposing any code change, and whenever the task mentions branches, diffs, stashes, worktrees, rebasing, or opening a PR.
---

# Safe Git Workflow

## Where the enforcement actually lives

Command permissions live in `opencode.jsonc` at the repository root, in the
`permissions` array. **That file blocks commands. This file only describes
workflow.**

Do not restate the permitted-command list here. The moment it is duplicated it
becomes a second source of truth that drifts, and an agent reading this skill
would believe a command is permitted because the prose says so. If a command
needs to change, change `opencode.jsonc` and re-read it.

## Before proposing any change, report state

Produce a plain-language pre-flight report and take no other action:

- Repository root, current branch, and HEAD commit with its subject.
- Relationship to the **intended base branch**. Compare against
  `origin/main`, not the local `main` ref — the local ref goes stale and will
  silently understate how far behind the branch is.
- Working-tree status, separated into modified / staged / untracked. Name the
  count, then name anything that could be swept up by a broad stage.
- Stash list, and the branch each stash was taken on.
- Registered worktrees, and whether each is clean.
- An explicit statement of whether the current changes could conflict with the
  work being proposed.

Report; do not fix. Cleaning up a dirty tree is a decision for the human.

## Inspecting state safely

Read `opencode.jsonc` to find out what is permitted. Do not rely on a list
remembered from earlier in the conversation, and do not infer permission from
the fact that a similar command worked once.

Two behaviours worth knowing, both verified in this repository:

- The inspection allowlist is an allowlist, so anything absent from it needs
  approval rather than being silently refused. Approval is not a guarantee —
  see the note below.
- `deny` is absolute. `ask` depends on the client being able to prompt a
  human; in a non-interactive session an `ask` can resolve without blocking,
  so only `deny` is a real boundary.

## Never, under any circumstance

`git push`, `git commit`, `git merge`, `git rebase`, `git clean`,
`git reset` in every form, `git checkout`, `git switch`, `git restore`, the
mutating `git stash` subcommands (`push`, `pop`, `apply`, `store`, `save`,
`clear`, `drop`, `create`), and blanket staging via `git add .` / `-A` /
`--all` / `-u`.

Listing the stash-listing subcommand here as forbidden would be wrong — read
the file rather than trusting a remembered summary. If a task appears to
require a denied command, say so plainly and stop. Do not look for a command
that reaches the same effect by another route.

## Repository policy

From `AGENTS.md` and `docs/team-conventions.md` — these are the human team's
decisions, not defaults to be improved on:

- Work on a short-lived `feature/*`, `fix/*`, `chore/*` or `refactor/*`
  branch, then open a PR into `main`. **Never commit directly to `main`.**
- Dependency updates go in their own PR.
- Conventional-commit subjects: `feat:`, `fix:`, `test:`, `chore:`, `docs:`,
  `ci:`, `refactor:`, `style:`. A non-trivial change gets a body explaining
  why, which invariants were preserved, and how it was verified.
- PRs use the repository template: summary, test plan, checklist, and
  screenshots for UI work.
- **Commit messages carry no AI co-author trailers.** No `Co-Authored-By:`
  line for an assistant, model or agent. This is a project decision that
  overrides the usual default. History that predates the rule keeps its
  trailers deliberately and is left alone.
- Do not rewrite `main` history. PR #77 contains duplicate merge history in
  `main` (both trees identical); it is retained on purpose, and "tidying" it
  would force-push every commit since `d1d9fc3` for no functional gain.

## Preserve work, never resolve over it

If a change would endanger in-flight edits, branch to preserve them rather
than force-resolving over them. Before staging, prefer explicit paths
(`git add <path>`) over any form that sweeps the working tree.

When a task needs a destructive cleanup, and untracked files are present,
those untracked files are frequently real in-progress work from another
session. `git clean` does not distinguish them from build output.

## Common rationalizations

- _"The user approved the task, so the commit is implied."_ Approval of a code
  change is not approval of history mutation. Commit and push stay separate
  decisions.
- _"It's my own work-in-progress, so resetting is safe."_ The dirty tree may
  belong to a different session. Only the human knows.
- _"The branch is behind, so a quick rebase first."_ Rebase rewrites history
  and is one of the most destructive things in this list.
- _"`git add -A` is just a convenience."_ It stages everything in the tree,
  including another contributor's unrelated work.
- _"Nobody reads the commit body."_ It is the only place the reasoning gets
  recorded.
- _"The branch name convention doesn't really matter."_ `AGENTS.md` lists the
  permitted prefixes; a branch outside them does not pass review.

## Red flags

- A proposal to run several git commands chained in one invocation.
- Any mention of `force`, `-f`, `--hard`, `--no-verify`, or `--allow-empty`.
- A suggestion to "just clean up first" while untracked files exist.
- A commit subject outside the permitted prefix list.
- Any suggestion to add a co-author, assistant or model attribution.
- A worktree reported as abandoned without asking the human first.

## Verification

Before any change is proposed, confirm that:

- The pre-flight report was produced and actually read.
- The base-branch comparison used `origin/main`.
- Every command used is on the allowlist, or was explicitly requested.
- No staging, commit, push, merge, rebase, checkout or cleanup was performed.
- If a destructive command is genuinely required, it has been named as a
  blocker rather than worked around.
