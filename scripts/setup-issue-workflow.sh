#!/usr/bin/env bash
#
# One-time (idempotent, safe to re-run) setup for AltarWed's autonomous issue workflow.
# Creates the label taxonomy, enables native auto-merge, and protects the main branch so
# nothing reaches the prod that runs Jordan's real wedding without passing CI.
#
# Requires: gh CLI authed with admin on the repo (repo scope). Run from anywhere in the repo.
#
set -euo pipefail

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "Configuring $REPO"

# ── Labels ──────────────────────────────────────────────────────────────────
# --force updates the label if it already exists, so re-running is harmless.
mklabel() { gh label create "$1" --color "$2" --description "$3" --force >/dev/null && echo "  label: $1"; }

# Status (the lifecycle the orchestrator routes on)
mklabel "needs-triage" "ededed" "Raw issue; issue-triage agent should formalize it"
mklabel "agent-ready"  "0e8a16" "Formalized with acceptance criteria; implementer may pick it up"
mklabel "in-progress"  "fbca04" "An agent is actively working this"
mklabel "in-review"    "1d76db" "PR open, awaiting Jordan's review/merge"
mklabel "blocked"      "b60205" "Cannot proceed; needs a decision or dependency"
mklabel "human-only"   "5319e7" "Touches secrets/infra/auth/migrations/payments; Jordan only"
mklabel "needs-info"   "d4c5f9" "Ambiguous; cannot write acceptance criteria yet"

# Type (recreate bug too rather than assume the GitHub default survives)
mklabel "bug"       "d73a4a" "Something is broken or behaves wrong"
mklabel "feature"   "a2eeef" "New user-facing functionality"
mklabel "chore"     "c5def5" "Maintenance, no behavior change"
mklabel "tech-debt" "c5def5" "Refactor / cleanup / hardening"
mklabel "security"  "b60205" "Security-relevant"

# Area
mklabel "area:backend"         "bfdadc" "Spring Boot API"
mklabel "area:frontend-app"    "bfdadc" "React/Vite dashboard SPA"
mklabel "area:frontend-public" "bfdadc" "Next.js public site"
mklabel "area:infra"           "bfdadc" "Azure / Bicep / CI-CD"

# Priority
mklabel "p0" "b60205" "Breaks live wedding usage / prod down"
mklabel "p1" "d93f0b" "Real bug or high-value flow"
mklabel "p2" "fef2c0" "Minor / cosmetic / nice-to-have"

# Metric (the anti-fake-progress gate)
mklabel "metric:couples" "0e8a16" "Moves couples-shipped"
mklabel "metric:vendors" "0e8a16" "Moves vendor signups"
mklabel "metric:seo"     "0e8a16" "Moves SEO / organic traffic"

# ── Native auto-merge on the repo ────────────────────────────────────────────
gh api "repos/$REPO" -X PATCH -F allow_auto_merge=true >/dev/null
echo "  repo: allow_auto_merge=true"

# ── Branch protection on main ────────────────────────────────────────────────
# enforce_admins=false ON PURPOSE: Jordan keeps an emergency escape hatch to merge/push
# a hotfix to his live wedding even if a check is red. Required contexts MUST match the
# ci.yml job names exactly, or PRs can never satisfy them.
gh api "repos/$REPO/branches/main/protection" -X PUT --input - >/dev/null <<'JSON'
{
  "required_status_checks": {
    "strict": false,
    "contexts": [
      "migration-filenames",
      "backend-test",
      "schema-validate",
      "frontend-public-build",
      "frontend-app-build"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
echo "  branch protection: main (5 required checks, admins exempt)"

echo "Done. To undo branch protection: gh api repos/$REPO/branches/main/protection -X DELETE"
