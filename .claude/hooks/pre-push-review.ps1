$ErrorActionPreference = 'Stop'
$payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
$cmd = $payload.tool_input.command

if ($cmd -notmatch '\bgit\s+push\b') { exit 0 }

# File-based bypass: create .claude/.skip-review-once to push without review.
# The file is deleted after one use so it can't be left permanently.
$skipFile = [System.IO.Path]::GetFullPath((Join-Path (Join-Path $PSScriptRoot '..') '.skip-review-once'))
if (Test-Path $skipFile) {
  Remove-Item $skipFile -Force
  exit 0
}

$reason = @'
About to git push. Run the code-reviewer on the changes being pushed first.

Workflow:
  1. Review the diff: git log origin/main..HEAD --oneline and git diff origin/main...HEAD
  2. Address any blockers.
  3. To bypass once (e.g. after you have reviewed): create the file
     .claude/.skip-review-once  (empty file is fine), then retry the push.
     The file is deleted automatically after one use.

     PowerShell: New-Item .claude\.skip-review-once -ItemType File -Force
     Bash:       touch .claude/.skip-review-once

Skip only for trivial pushes (typo, doc-only, config). Default is review.
'@

# If the push touches frontend-public/, also nudge for /verify (browser render check).
# Best-effort: a git failure here must never block the existing review gate.
try {
  $repoRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($PSScriptRoot, '..', '..'))
  $changed = & git -C $repoRoot diff --name-only origin/main...HEAD 2>$null
  if ($LASTEXITCODE -ne 0) { $changed = & git -C $repoRoot diff --name-only HEAD 2>$null }
  if ($changed -match '(?m)^frontend-public/') {
    $reason += @'


This push touches frontend-public/ (the public SEO site). Also run /verify to confirm the
page actually renders in a browser before pushing, and run `npm run lint` in frontend-public/
to catch accessibility violations. The same .skip-review-once bypass covers both checks.
'@
  }
} catch { }

$out = [ordered]@{
  hookSpecificOutput = [ordered]@{
    hookEventName             = 'PreToolUse'
    permissionDecision        = 'deny'
    permissionDecisionReason  = $reason
  }
} | ConvertTo-Json -Depth 5

Write-Output $out
exit 0
