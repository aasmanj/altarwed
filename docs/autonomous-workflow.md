# Autonomous issue-driven development workflow

A supervised-autonomy system: GitHub issues are the backlog, Claude agents draft the work, the
existing review fleet gates quality, and Jordan is the merge/deploy gate. Designed for production
hardening (bugs and edge cases) ahead of a marketing push, on a prod that runs Jordan's real
wedding, where merge-to-`main` auto-deploys.

## The roster
| Role | Who | Writes code? |
|---|---|---|
| PM / backlog grooming | `issue-triage` agent | No (edits issues via `gh`) |
| IC engineer | `implementer` agent | Yes (DRAFT PRs only) |
| Orchestrator / release mgr | `work-backlog` skill (and the nightly cloud routine) | No |
| QA | `verifier-api` / `verifier-web` / `run-altarwed` skills | n/a |
| Senior reviewers | `deep-review` (code/security/architecture/legal/ux auditors) | No |
| Final merge + deploy | **Jordan** | n/a |

## The loop
1. **You** open an issue (rough is fine) using a template at `.github/ISSUE_TEMPLATE/`. It lands
   labeled `needs-triage`.
2. **`issue-triage`** rewrites it into a spec (acceptance criteria, scope, labels) and routes it:
   `agent-ready`, `human-only`, or `needs-info`.
3. **`work-backlog`** (on-demand locally, or the nightly cloud routine) picks the top
   `agent-ready` issues by priority, dispatches **`implementer`** one at a time, runs a scoped
   review on each PR, and decides merge handling.
4. **Almost everything stays a DRAFT PR you merge.** Only plain-docs PRs (`*.md` / `docs/`, and
   never `.claude/**`, `.github/**`, or `CLAUDE.md`) can auto-merge, after a clean review and green
   CI; plain docs trigger no deploy. Everything else, including test-only changes (which still trip
   a deploy path filter) and any runtime code, stays a DRAFT you merge. Merging runtime code
   auto-deploys to prod.

## One-time setup
```bash
bash scripts/setup-issue-workflow.sh
```
Creates the label taxonomy, enables native auto-merge, and protects `main` (requires the 5 CI
checks; admins exempt so Jordan keeps an emergency hotfix path for the live wedding).

## Running it
- **Triage a new issue:** ask Claude to "run issue-triage on #N".
- **Work the backlog on-demand (full local verification):** `/work-backlog` (or "work the
  backlog"). Optional arg = max issues this run (default 2, cap 3). Locally you can run
  `run-altarwed` + the verifiers for real behavioral checks before marking a PR ready for review.
- **Dry run:** `/work-backlog dry-run`.

## The nightly cloud routine (set up with /schedule)
The cloud runner works unattended while your machine is off, but it **cannot** boot the local
Docker stack, so it cannot run `verifier-api`/`verifier-web`. That is why the `implementer` writes
CI-runnable tests on every change and why cloud-produced runtime PRs always stay DRAFT.

To create it: run `/schedule` and create a routine, nightly (e.g. 02:00), whose prompt is roughly:

> Run the work-backlog orchestrator: triage any `needs-triage` issues, then process up to 2
> `agent-ready` issues (bugs before features, by priority). Open DRAFT PRs. Only plain-docs PRs
> (`*.md` / `docs/`, never `.claude/**`, `.github/**`, or `CLAUDE.md`) may be set to auto-merge;
> everything else stays a DRAFT. Never touch human-only issues. Report the PRs opened.

Prerequisite: the cloud agent environment must have **GitHub connected** (same requirement as the
blog drafter routine). Without it, the routine cannot read issues or open PRs.

## Safety rules (non-negotiable)
- Agents open **DRAFT** PRs. Auto-merge only for plain-docs diffs (never policy/CI/runtime files).
- `human-only` lane (agents refuse and escalate): secrets, Key Vault, `infrastructure/`, auth /
  `SecurityConfig` / JWT / IDOR guards, destructive or data-migrating Flyway migrations, payments.
- Branch protection requires all 5 CI checks before any merge.
- Every fix ships with a test that fails before and passes after.
- Every issue names the metric it serves (couples-shipped / vendor signups / SEO) or a live bug it
  fixes, or it gets starved.
