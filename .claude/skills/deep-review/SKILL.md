---
name: deep-review
description: Local multi-agent deep review of a change, a free stand-in for the billed cloud ultrareview. Fans out to AltarWed's specialized review agents (code-reviewer, security-auditor, architecture-auditor, legal-compliance-auditor, ux-auditor) in parallel against the same diff, each attacking from its own angle, then synthesizes one deduplicated, cross-validated, prioritized risk register. Use before merging any non-trivial branch or PR.
---

# deep-review

A poor-founder's ultrareview. `/ultrareview` (now `/code-review ultra`) spins up agents in
the cloud and bills for it; this does the same shape of work using the review agents already
defined in `.claude/agents/`, which run on the existing plan at no extra cost. The value over a
single `code-reviewer` pass is **breadth and cross-validation**: independent agents look at the
same change through different lenses, and a finding raised by two of them is high-confidence
signal, not one reviewer's hunch.

Invoke deliberately, before a merge, not on every save. Each agent spawn is a fresh cold context
(it re-derives understanding of the diff), so this is the expensive-but-thorough path. That is
the point.

## Step 1: Establish the scope

Resolve `$ARGUMENTS`:
- A number (e.g. `3`) -> a GitHub PR. `gh pr checkout <n>` (or `gh pr diff <n>`), review that PR's diff.
- `staged` -> review `git diff --staged`.
- empty -> review the current branch against `main`: `git diff main...HEAD`.

Confirm the scope in one line (branch/PR, file count) before fanning out. If the diff is empty,
stop and say so.

## Step 2: Select the lenses (smart fan-out)

Read the diff yourself first (it is cheap and tells you which angles matter). Then pick the
agents to launch. **Always** run `code-reviewer` and `security-auditor`. Add the others only when
the diff actually touches their domain, so you do not burn context on an irrelevant lens:

| Add this agent | When the diff touches |
|---|---|
| `legal-compliance-auditor` | PII collection, email/marketing sends, consent/opt-out, cookies, affiliate links, payments, ToS/privacy copy |
| `architecture-auditor` | a new table or migration, an external integration, a hot-path query, caching, a new async/scheduled job, anything scale-sensitive |
| `ux-auditor` | a user-facing frontend flow (new screen, empty/loading/error state, form, mobile layout, copy) |

Name the selected set and the one-line reason for each before launching.

## Step 3: Fan out in parallel

Launch every selected agent **in a single message** (multiple `Agent` tool calls together) so
they run concurrently. Give each the SAME diff scope and this contract:

- "Review ONLY this change and its immediate blast radius, not the whole system. Run
  `git diff main...HEAD` (or the PR diff) to see it."
- A one-paragraph summary of what the change does and why (so the agent does not re-derive intent).
- The specific angle you want from this agent (security: the new attack surface; legal: the exact
  regulation at stake; architecture: the scale cliff / data-layer risk; ux: the friction).
- "Return a prioritized list (blocker / should-fix / nit) with `file:line` and concrete
  remediation. Be adversarial. Cite the diff, do not theorize about code you have not read."
- "Do not run builds or tests; do not edit files. Read and report only."

## Step 4: Synthesize (this is the part that mimics ultrareview)

Do not just concatenate the agents' outputs. Merge them:

1. **Deduplicate.** Collapse the same finding raised by multiple agents into one entry. List which
   agents raised it.
2. **Cross-validate.** A finding independently raised by 2+ agents is HIGH confidence, surface it
   first. A lone finding is worth less; say so.
3. **Resolve conflicts.** If two agents disagree (one says ship, one says block), adjudicate with
   your own read of the code and explain the call.
4. **Re-rank by real severity**, not by how loud the agent was. A security-auditor "nit" can
   outrank a ux "should-fix." Apply the AltarWed lens: data safety and deliverability/compliance
   outrank polish.
5. **Drop false positives.** If an agent flags something the diff already handles, cut it and note
   why (briefly).

## Step 5: Report

```
## deep-review verdict: [SHIP / FIX FIRST / RECONSIDER]
Lenses run: code-reviewer, security-auditor, ... (and why)

## Blockers (fix before merge)
- [agents that raised it · confidence] file:line — what's wrong, why it matters, the fix

## Should fix
- ...

## Nits
- ...

## Cross-validated (raised by 2+ lenses)
- the high-signal findings, called out explicitly

## What's solid
- one or two genuine callouts, skip if nothing stands out
```

Then offer to apply the fixes. Do NOT commit, push, or edit files as part of the review itself,
reporting and acting are separate steps (same rule as a real review).

## Cost note
Four agents in parallel is roughly four cold reviews worth of tokens. Cheaper than the cloud
ultrareview (which bills separately) and on-plan, but not free in tokens. Run it at the
merge gate, lean on the single `code-reviewer` agent for routine pre-push passes.
