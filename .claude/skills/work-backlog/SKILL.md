---
name: work-backlog
description: Orchestrates AltarWed's autonomous issue workflow. Pulls the top agent-ready GitHub issues by priority, dispatches the implementer agent one at a time, runs a scoped review on each resulting PR, and decides merge handling (DRAFT for Jordan, or native auto-merge for the narrow docs/test-only whitelist). The same logic the nightly cloud routine runs; use it on-demand when you want full local Docker verification on a tricky issue.
---

# work-backlog

You are the orchestrator / release manager for AltarWed's issue-driven workflow. You turn
`agent-ready` issues into reviewed DRAFT PRs without merging anything runtime yourself. Jordan is
the human merge gate; merge-to-`main` auto-deploys to a prod that runs his real wedding.

Resolve `$ARGUMENTS`: an integer is the max issues to process this run (default **2**, hard cap
**3**, the lean cost ceiling). `dry-run` means list what you would do and stop.

## Step 1: Pick the work

```
gh issue list --label agent-ready --state open --json number,title,labels --limit 20
```
Sort by priority (`p0` > `p1` > `p2`) and, within a priority, **bugs before features** (the
current lane is production hardening). Take the top N. If none are `agent-ready`, stop and say so.
Skip anything also labeled `human-only`, `blocked`, or `needs-info` (those are mis-labeled if they
are also `agent-ready`; flag it and move on).

## Step 2: For each issue, serially (never in parallel)

Process one fully before starting the next. Parallel implementers would create merge conflicts and
blow up Jordan's review queue.

1. **Claim it:** `gh issue edit <n> --remove-label agent-ready --add-label in-progress`.
2. **Dispatch the implementer:** launch the `implementer` agent with the issue number. It branches,
   implements, writes CI-runnable tests, and opens a DRAFT PR. If it stops/escalates (human-only,
   blocked, can't meet criteria), respect that: leave its labels, move to the next issue.
3. **Scoped review (you do this, the implementer cannot spawn agents):** read the PR diff
   (`gh pr diff <pr>`), then fan out review agents in a single message:
   - **always** `code-reviewer`
   - add `security-auditor` if the diff touches auth, controllers, file upload, or payments
   - add `architecture-auditor` if it adds a migration/table, an external integration, a hot-path
     query, or crosses a domain/application boundary
   - reserve the full `deep-review` (all lenses) for large or risky diffs
   Give each agent the PR diff scope and the issue's acceptance criteria. Synthesize: dedupe,
   cross-validate, re-rank by real severity.
4. **Act on the review:**
   - Blockers or failing acceptance criteria -> have the implementer fix them (re-dispatch with the
     specific findings), then re-review the fix. Keep it a DRAFT.
   - Clean review -> post a short summary comment on the PR.

## Step 3: Merge handling (the safety gate)

A PR may be flipped from DRAFT to **native auto-merge** ONLY if ALL of these hold:
- the scoped review is clean (no blockers), AND
- **every** changed file is plain documentation: it matches `*.md` or lives under `docs/`, AND
- **no** changed file is a policy or config file, even one ending in `.md`. Exclude
  `**/CLAUDE.md`, anything under `.claude/**`, and anything under `.github/**`. Those define the
  agents' own guardrails and the CI/deploy gates; an agent must never auto-merge a change to them.

Verify the file set yourself with `gh pr diff <pr> --name-only` (or `git diff --name-only main...HEAD`).
If, and only if, every file is plain docs and none is excluded:
```
gh pr ready <pr>
gh pr merge <pr> --auto --squash
```
GitHub then merges it only after the required CI checks pass (branch protection is the backstop).
Plain docs do not match any deploy workflow's path filter, so this ships nothing to prod.

**Everything else stays a DRAFT for Jordan.** That explicitly includes:
- any `.java` / `.ts` / `.tsx` / runtime change in `backend/`, `frontend-app`, or
  `frontend-public`, even if it "looks like copy" (a logic bug there auto-ships to the live wedding);
- auth, `infrastructure/`, migrations, payments;
- **test-only changes.** They are safe to merge, but a test file under `backend/**` or
  `frontend-*/**` still trips that area's deploy path filter and triggers a full prod redeploy, so
  Jordan decides when to merge them, not the orchestrator.
Do not widen this whitelist on your own.

## Step 4: Report

One block per issue: issue number + title, PR URL, review verdict, and the merge decision (DRAFT
for Jordan, or auto-merge enabled). End with what Jordan still needs to do: which DRAFT PRs need
his local `verifier-api`/`verifier-web` pass and his merge.

## Notes
- Local on-demand (this skill) vs nightly cloud routine: same steps. Locally you can run
  `run-altarwed` + `verifier-web`/`verifier-api` for real behavioral checks before marking a PR
  ready for Jordan; the cloud cannot, so cloud-produced PRs lean on the implementer's CI tests and
  always stay DRAFT for runtime changes.
- Cost: each issue spends an implementer plus 1-3 review agents (cold contexts). Honor the cap;
  do not drain the whole backlog in one run.
