$ErrorActionPreference = 'Stop'
$payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
$cmd = $payload.tool_input.command

if ($cmd -notmatch '\bgit\s+push\b') { exit 0 }
if ($env:SKIP_REVIEW -eq '1') { exit 0 }

$reason = @'
About to git push. Stop and run the code-reviewer subagent on the changes being pushed BEFORE retrying.

Workflow:
  1. Use the Agent tool with subagent_type=code-reviewer, prompt: "Review the commits about to be pushed (git log origin/main..HEAD and git diff origin/main...HEAD)."
  2. Address any "Must fix" findings.
  3. Bypass this hook to push: in PowerShell run `$env:SKIP_REVIEW='1'` first, push, then `$env:SKIP_REVIEW=$null`. In Bash use `SKIP_REVIEW=1 git push`.

Skip the review only for trivial pushes (typo fix, doc-only, config tweak). Default is review.
'@

$out = @{
  hookSpecificOutput = @{
    hookEventName        = 'PreToolUse'
    permissionDecision   = 'deny'
    permissionDecisionReason = $reason
  }
} | ConvertTo-Json -Depth 5

Write-Output $out
exit 0
