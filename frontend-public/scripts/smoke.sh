#!/usr/bin/env bash
# Boot smoke test for the built Next.js app (issue #421).
#
# `next build` proves compilation, not that the router can serve a request:
# on 2026-07-13 a dynamic-slug-name conflict (/vendors/[id] vs
# /vendors/[category]) built green, deployed green, and then threw on every
# request in production. This script is the gate that turns that class of
# failure into a red check: it starts the production server and asserts the
# router actually answers.
#
# Checks are hermetic on purpose (no backend API dependency), so the gate
# cannot flake on upstream availability:
#   1. GET /            -> 200 (homepage renders; any router-boot error 500s this)
#   2. GET /smoke-404-* -> 404 (route matching + not-found render both work;
#                          a matcher crash returns 500 for unknown paths too)
#
# Usage: scripts/smoke.sh   (run from frontend-public/ after `next build`)
set -euo pipefail

PORT="${SMOKE_PORT:-4123}"
LOG="$(mktemp)"

# Refuse to run against a port that already answers: the checks would hit
# whatever stale server holds it and pass vacuously, hiding a dead build.
if curl -s -o /dev/null --max-time 2 "http://localhost:$PORT/"; then
  echo "SMOKE FAIL: port $PORT is already in use; refusing to test a server this script did not start" >&2
  exit 1
fi

# Invoke the next bin through node directly (not npx) so SERVER_PID is the
# actual server process and the trap reliably kills it, not a wrapper.
node node_modules/next/dist/bin/next start -p "$PORT" >"$LOG" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

# Wait for the server to accept connections (up to 60s).
for _ in $(seq 1 60); do
  if curl -s -o /dev/null --max-time 2 "http://localhost:$PORT/"; then
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "SMOKE FAIL: next start exited before accepting connections" >&2
    cat "$LOG" >&2
    exit 1
  fi
  sleep 1
done

fail=0
check() {
  local path="$1" expected="$2"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "http://localhost:$PORT$path")
  if [ "$code" = "$expected" ]; then
    echo "SMOKE OK:   $path -> $code"
  else
    echo "SMOKE FAIL: $path -> $code (expected $expected)" >&2
    fail=1
  fi
}

check "/" 200
check "/smoke-nonexistent-path-421" 404

if [ "$fail" -ne 0 ]; then
  echo "--- next start log ---" >&2
  cat "$LOG" >&2
  exit 1
fi

echo "Smoke test passed: server boots and routes."
