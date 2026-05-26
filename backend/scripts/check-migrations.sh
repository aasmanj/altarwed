#!/usr/bin/env bash
# Validate Flyway migration filenames before they hit a real database.
#
# Catches three failure modes that otherwise only surface at Spring boot:
#   1. Two files share a version number (e.g. two V33__*.sql).
#      Flyway refuses to start: "Found more than one migration with version N".
#   2. The version sequence has a gap (e.g. V33 then V35, no V34).
#      Not fatal to Flyway, but almost always indicates a missed merge or rename.
#   3. A filename does not match V{number}__{description}.sql.
#      Flyway silently skips these; the migration never runs.
#
# Exit non-zero on any failure so CI blocks the merge/deploy.

set -euo pipefail

MIGRATION_DIR="${1:-$(dirname "$0")/../src/main/resources/db/migration}"

if [[ ! -d "$MIGRATION_DIR" ]]; then
  echo "check-migrations: directory not found: $MIGRATION_DIR" >&2
  exit 2
fi

shopt -s nullglob
files=("$MIGRATION_DIR"/*.sql)
shopt -u nullglob

if [[ ${#files[@]} -eq 0 ]]; then
  echo "check-migrations: no .sql files in $MIGRATION_DIR" >&2
  exit 2
fi

declare -A seen_versions
declare -a versions
malformed=()

for path in "${files[@]}"; do
  name="$(basename "$path")"
  if [[ "$name" =~ ^V([0-9]+)__[A-Za-z0-9_]+\.sql$ ]]; then
    v="${BASH_REMATCH[1]}"
    versions+=("$v")
    if [[ -n "${seen_versions[$v]:-}" ]]; then
      seen_versions[$v]="${seen_versions[$v]}|$name"
    else
      seen_versions[$v]="$name"
    fi
  else
    malformed+=("$name")
  fi
done

fail=0

if [[ ${#malformed[@]} -gt 0 ]]; then
  echo "check-migrations: malformed filenames (Flyway will skip these):" >&2
  printf '  - %s\n' "${malformed[@]}" >&2
  fail=1
fi

for v in "${!seen_versions[@]}"; do
  if [[ "${seen_versions[$v]}" == *"|"* ]]; then
    echo "check-migrations: version $v has multiple files:" >&2
    IFS='|' read -ra dupes <<< "${seen_versions[$v]}"
    printf '  - %s\n' "${dupes[@]}" >&2
    fail=1
  fi
done

sorted=($(printf '%s\n' "${versions[@]}" | sort -n -u))
prev=0
for v in "${sorted[@]}"; do
  if (( prev > 0 && v != prev + 1 )); then
    echo "check-migrations: gap in version sequence: V${prev} -> V${v}" >&2
    fail=1
  fi
  prev=$v
done

if [[ $fail -ne 0 ]]; then
  exit 1
fi

echo "check-migrations: ${#files[@]} migrations, V1..V${prev}, no duplicates or gaps."
