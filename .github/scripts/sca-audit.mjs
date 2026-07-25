#!/usr/bin/env node
// SCA gate (issue #117). Fails CI when a PRODUCTION dependency in any of the
// given workspaces has a high- or critical-severity advisory whose GitHub
// advisory id (GHSA) is not listed in .github/sca-allowlist.txt.
//
// Why a gate: `npm audit` runs in no CI job today, so dependency HIGHs never
// surface until someone runs it by hand. This makes that check a required,
// non-optional step. The allowlist freezes the known backlog (so main stays
// green) while failing on any NEW high/critical, the same ratchet the
// frontend-app lint `--max-warnings` cap uses.
//
// Prod deps only (`--omit=dev`): a vuln in a build/test-only devDependency does
// not ship to a user, and gating on those would drown the signal (dev toolchains
// churn advisories constantly). Moderates and lows are reported for visibility
// but never fail the build.
//
// Usage: node .github/scripts/sca-audit.mjs <workspace-dir> [<workspace-dir> ...]
//   e.g. node .github/scripts/sca-audit.mjs frontend-public frontend-app
//
// Exit codes: 0 = pass, 1 = un-allowlisted high/critical found, 2 = bad usage.

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const workspaces = process.argv.slice(2)
if (workspaces.length === 0) {
  console.error('usage: sca-audit.mjs <workspace-dir> [<workspace-dir> ...]')
  process.exit(2)
}

const here = dirname(fileURLToPath(import.meta.url))
const allowlistPath = join(here, '..', 'sca-allowlist.txt')

// Parse the allowlist: strip inline `#` comments and blank lines, keep GHSA ids.
const allow = new Set(
  readFileSync(allowlistPath, 'utf8')
    .split('\n')
    .map(line => line.replace(/#.*/, '').trim())
    .filter(Boolean),
)

const GATING = new Set(['high', 'critical'])
let failed = false
const seenGating = new Set() // every gating GHSA observed, for stale-entry reporting

for (const ws of workspaces) {
  let raw
  try {
    // npm audit exits non-zero whenever advisories exist, so the vulnerable
    // (expected) path lands in catch. Read stdout from either path.
    raw = execSync('npm audit --omit=dev --json', { cwd: ws, encoding: 'utf8' })
  } catch (err) {
    raw = err.stdout
  }

  let report
  try {
    report = JSON.parse(raw)
  } catch {
    console.error(`[${ws}] FAIL: could not parse \`npm audit --json\` output`)
    failed = true
    continue
  }

  const offenders = new Map() // ghsa -> description (deduped across packages)
  let moderateLow = 0
  for (const vuln of Object.values(report.vulnerabilities ?? {})) {
    for (const via of vuln.via ?? []) {
      if (typeof via !== 'object' || !via.url) continue
      const severity = (via.severity ?? vuln.severity ?? '').toLowerCase()
      if (!GATING.has(severity)) {
        moderateLow++
        continue
      }
      const ghsa = via.url.split('/').pop()
      seenGating.add(ghsa)
      if (!allow.has(ghsa)) {
        offenders.set(ghsa, `${severity.toUpperCase()} ${ghsa} (${via.name}): ${via.title}`)
      }
    }
  }

  if (offenders.size > 0) {
    failed = true
    console.error(`\n[${ws}] FAIL: ${offenders.size} un-allowlisted high/critical advisory(ies) in production deps:`)
    for (const desc of [...offenders.values()].sort()) console.error('  - ' + desc)
  } else {
    console.log(`[${ws}] OK: no un-allowlisted high/critical advisories in production deps (${moderateLow} moderate/low ignored)`)
  }
}

// Allowlisted ids that no longer appear were fixed upstream: report (do not fail)
// so the list can be pruned and never silently rots.
const stale = [...allow].filter(ghsa => !seenGating.has(ghsa))
if (stale.length > 0) {
  console.log(`\nNote: ${stale.length} allowlisted advisory(ies) no longer present, safe to remove from .github/sca-allowlist.txt:`)
  for (const ghsa of stale.sort()) console.log('  - ' + ghsa)
}

if (failed) {
  console.error('\nSCA gate FAILED. Remediate the advisory (npm audit fix, or a dependency upgrade), or,')
  console.error('only after a human decision, add its GHSA id to .github/sca-allowlist.txt with a justification.')
  process.exit(1)
}
console.log('\nSCA gate passed.')
