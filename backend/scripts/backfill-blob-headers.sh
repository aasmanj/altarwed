#!/usr/bin/env bash
#
# backfill-blob-headers.sh -- one-time backfill of per-blob HTTP headers (issue #75)
#
# New uploads get Content-Type (magic-byte validated), Content-Disposition: inline, and
# Cache-Control: immutable at write time (AzureBlobStorageAdapter.buildHeaders). Blobs stored
# BEFORE that change have only a Content-Type. This script stamps the same Content-Disposition
# and Cache-Control onto every existing blob, preserving each blob's stored Content-Type.
#
# Why an az CLI script and not an admin endpoint: this is a one-time maintenance task. An
# admin-gated endpoint would be a permanent authenticated attack surface that needs auth wiring,
# review, and a deploy, and then lives in prod forever for a job that runs once. The script runs
# under the operator's own Azure RBAC identity (auditable in the activity log), is dry-run by
# default, and is idempotent: re-running it skips blobs that already carry both headers, so an
# interrupted run can simply be restarted.
#
# IMPORTANT gotcha this script handles: the underlying Set Blob Properties operation CLEARS any
# content setting you do not pass. Every update therefore re-sends the blob's current
# Content-Type (and Content-MD5 / Content-Encoding / Content-Language when present) alongside
# the two new headers. A blob with a missing or application/octet-stream Content-Type gets one
# derived from its file extension (.jpg/.jpeg/.png/.webp).
#
# Usage:
#   ./backfill-blob-headers.sh --account-name <storageAccount> [--container <name>] [--apply]
#
#   --account-name   Storage account (e.g. altarwedprodstorage). Required.
#   --container      Blob container. Default: altarwed-media.
#   --apply          Actually write changes. Without it the script only prints what it WOULD do.
#
# Prerequisites: az CLI logged in (az login) with Storage Blob Data Contributor (or key access)
# on the account, and jq. Uses --auth-mode login (Azure AD), never an account key on the CLI.
#
# Example (dry run first, then apply):
#   ./backfill-blob-headers.sh --account-name altarwedprodstorage
#   ./backfill-blob-headers.sh --account-name altarwedprodstorage --apply
#
# Note: the dry run never invokes "az storage blob update", so the first --apply run is the
# first time the flags are exercised. --content-cache needs a recent az CLI (older releases
# call it --content-cache-control). After the first applied blob, spot-check it with
#   az storage blob show --account-name <acct> --container-name <c> --name <blob> \
#     --auth-mode login --query properties.contentSettings
# before letting the loop finish, and verify contentMd5 round-tripped unchanged.

set -euo pipefail

CACHE_CONTROL="public, max-age=31536000, immutable"
ACCOUNT_NAME=""
CONTAINER="altarwed-media"
APPLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --account-name) ACCOUNT_NAME="$2"; shift 2 ;;
    --container)    CONTAINER="$2"; shift 2 ;;
    --apply)        APPLY=true; shift ;;
    -h|--help)      grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$ACCOUNT_NAME" ]]; then
  echo "ERROR: --account-name is required (e.g. --account-name altarwedprodstorage)" >&2
  exit 1
fi
command -v az >/dev/null || { echo "ERROR: az CLI not found" >&2; exit 1; }
command -v jq >/dev/null || { echo "ERROR: jq not found" >&2; exit 1; }

if ! $APPLY; then
  echo "DRY RUN (no changes will be made; pass --apply to write)"
fi
echo "Account: $ACCOUNT_NAME  Container: $CONTAINER"

# Mirrors AzureBlobStorageAdapter.dispositionFilename: last path segment, allowlist
# [A-Za-z0-9._-], no leading dots, 100-char tail, fallback "download".
sanitize_filename() {
  local name="${1##*/}"
  name="${name##*\\}"
  name="$(printf '%s' "$name" | tr -cd 'A-Za-z0-9._-')"
  name="$(printf '%s' "$name" | sed 's/^\.*//')"
  # Keep the 100-char tail (bash returns "" for a negative offset past the start, so guard).
  if (( ${#name} > 100 )); then name="${name: -100}"; fi
  [[ -z "$name" ]] && name="download"
  printf '%s' "$name"
}

content_type_for_extension() {
  case "${1,,}" in
    *.jpg|*.jpeg) echo "image/jpeg" ;;
    *.png)        echo "image/png" ;;
    *.webp)       echo "image/webp" ;;
    *)            echo "" ;;
  esac
}

echo "Listing blobs..."
BLOBS_JSON="$(az storage blob list \
  --account-name "$ACCOUNT_NAME" \
  --container-name "$CONTAINER" \
  --auth-mode login \
  --num-results "*" \
  --query '[].{name:name, contentType:properties.contentSettings.contentType, cacheControl:properties.contentSettings.cacheControl, contentDisposition:properties.contentSettings.contentDisposition, contentEncoding:properties.contentSettings.contentEncoding, contentLanguage:properties.contentSettings.contentLanguage, contentMd5:properties.contentSettings.contentMd5}' \
  --output json)"

TOTAL="$(jq 'length' <<<"$BLOBS_JSON")"
echo "Found $TOTAL blob(s)."

UPDATED=0
SKIPPED=0
FAILED=0

while IFS= read -r row; do
  name="$(jq -r '.name' <<<"$row")"
  current_type="$(jq -r '.contentType // ""' <<<"$row")"
  current_cache="$(jq -r '.cacheControl // ""' <<<"$row")"
  current_dispo="$(jq -r '.contentDisposition // ""' <<<"$row")"
  content_md5="$(jq -r '.contentMd5 // ""' <<<"$row")"
  content_encoding="$(jq -r '.contentEncoding // ""' <<<"$row")"
  content_language="$(jq -r '.contentLanguage // ""' <<<"$row")"

  # Idempotency: skip blobs that already carry both target headers.
  if [[ "$current_cache" == "$CACHE_CONTROL" && -n "$current_dispo" ]]; then
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # Preserve the stored type; only derive from the extension when it is missing or the
  # SDK default octet-stream (which is also the sniffable case we want to eliminate).
  target_type="$current_type"
  if [[ -z "$target_type" || "$target_type" == "application/octet-stream" ]]; then
    target_type="$(content_type_for_extension "$name")"
    if [[ -z "$target_type" ]]; then
      echo "SKIP (no stored type and unrecognized extension, review manually): $name"
      SKIPPED=$((SKIPPED + 1))
      continue
    fi
  fi

  disposition="inline; filename=\"$(sanitize_filename "$name")\""

  if ! $APPLY; then
    echo "WOULD UPDATE: $name  type=$target_type  disposition=$disposition"
    UPDATED=$((UPDATED + 1))
    continue
  fi

  # Re-send every present content setting: Set Blob Properties clears whatever is omitted.
  extra_args=()
  [[ -n "$content_md5" ]]      && extra_args+=(--content-md5 "$content_md5")
  [[ -n "$content_encoding" ]] && extra_args+=(--content-encoding "$content_encoding")
  [[ -n "$content_language" ]] && extra_args+=(--content-language "$content_language")

  # ${extra_args[@]+...} guards the common empty-array case, which trips "unbound variable"
  # under set -u on bash < 4.4 (stock macOS ships 3.2). </dev/null stops az from ever consuming
  # the while-loop's stdin.
  if az storage blob update \
      --account-name "$ACCOUNT_NAME" \
      --container-name "$CONTAINER" \
      --auth-mode login \
      --name "$name" \
      --content-type "$target_type" \
      --content-cache "$CACHE_CONTROL" \
      --content-disposition "$disposition" \
      ${extra_args[@]+"${extra_args[@]}"} \
      --output none </dev/null; then
    echo "UPDATED: $name"
    UPDATED=$((UPDATED + 1))
  else
    echo "FAILED: $name (continuing)" >&2
    FAILED=$((FAILED + 1))
  fi
done < <(jq -c '.[]' <<<"$BLOBS_JSON")

echo
if $APPLY; then
  echo "Done. updated=$UPDATED skipped=$SKIPPED failed=$FAILED total=$TOTAL"
  [[ "$FAILED" -gt 0 ]] && exit 1
else
  echo "Dry run complete. would-update=$UPDATED skipped=$SKIPPED total=$TOTAL"
fi
exit 0
