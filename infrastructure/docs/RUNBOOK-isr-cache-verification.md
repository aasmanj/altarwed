# RUNBOOK: Verify ISR cache persistence on Azure SWA (issue #245)

Goal: prove, in about 15 minutes, whether the Next.js ISR cache on the `altarwed-landing`
Static Web App actually persists across requests, deploys, and instance recycles. The
capacity plan assumes `revalidate: 60` absorbs guest reads of `/wedding/[slug]`; each
uncached render fans out ~5 backend calls (`frontend-public/src/app/wedding/[slug]/data.ts`
lines 133, 158, 174, 213, 227). If the cache is per-node and ephemeral, every ad-driven
guest hit becomes ~5 direct calls to the single `altarwed-prod-api` instance.

Prerequisites: a published wedding slug (use Jordan's), `az` CLI logged in, access to
App Insights for `altarwed-prod-api`.

Note on the request path: `www.altarwed.com` is Cloudflare-proxied (see
`infrastructure/CLAUDE.md`). Cloudflare does not cache HTML by default, so expect
`cf-cache-status: DYNAMIC`; the interesting headers come from the Next.js server behind it.

## Step 1: header probe (5 minutes)

Run twice within a few seconds, then a third time after 70+ seconds:

```bash
curl -sI "https://www.altarwed.com/wedding/<slug>" \
  | grep -i -E 'x-nextjs-cache|x-nextjs-prerender|age|cf-cache-status|etag|date'

curl -sI "https://www.altarwed.com/blog/<any-blog-slug>" \
  | grep -i -E 'x-nextjs-cache|x-nextjs-prerender|age|cf-cache-status|etag|date'
```

Reading the headers:

- `x-nextjs-cache: MISS` then `HIT` on the second request = the full route cache is
  working on that node. `HIT` then `STALE` after 60s (wedding) / 3600s (blog,
  `blog/[slug]/page.tsx:9` sets `revalidate = 3600`) is the normal
  stale-while-revalidate cycle: STALE serves the cached page and triggers a background
  regeneration.
- `x-nextjs-prerender: 1` (or a stable `etag` plus a growing `age`) also indicates a
  cached prerender is being served.
- Repeated `MISS` on back-to-back requests = either no persistent cache or a multi-node
  SWA backend where each request lands on a different node with its own empty cache.
  Both are failures for our purpose.
- Headers absent entirely: Azure SWA's managed Next.js hosting may strip `x-nextjs-cache`.
  That is not evidence either way. Fall through to Step 2, which is authoritative.

## Step 2: backend request-count probe (authoritative, 10 minutes)

The ISR cache is only real if the backend does NOT see one fan-out per page view.

1. Hit the wedding page 20 to 30 times over ~2 minutes (browser hard-refreshes or):

```bash
for i in $(seq 1 25); do curl -s -o /dev/null "https://www.altarwed.com/wedding/<slug>"; sleep 5; done
```

2. In App Insights for `altarwed-prod-api` (Logs), run:

```kusto
requests
| where timestamp > ago(10m)
| where name has "wedding-websites/slug" or name has "wedding-page-blocks" or name has "wedding-party" or name has "wedding-photos"
| summarize count() by bin(timestamp, 1m), name
| order by timestamp asc
```

Interpretation:

- PASS: roughly one fan-out batch (~4-5 requests) per 60-second bin, regardless of how
  many page views you generated. The cache absorbs reads.
- FAIL: backend request count tracks page views ~1:1 (25 views -> ~100+ backend
  requests). The ISR assumption has collapsed.

## Step 3: post-deploy invalidation behavior (optional but recommended)

1. Get a `HIT` (or confirm the low backend rate from Step 2).
2. Trigger a redeploy: Actions -> Deploy Landing -> Run workflow (`deploy-landing.yml`),
   or wait for the next merge touching `frontend-public/`.
3. Re-run Step 1 immediately after the deploy completes. Expect `MISS` on the first hit
   (a deploy replaces the build output, so the prerender cache resets; this is normal).
   What matters is that the second hit within 60s is a `HIT` again.
4. Separately, on-demand invalidation already exists and is deploy-independent: the
   backend POSTs to `frontend-public/src/app/api/revalidate/route.ts` (secured by
   `REVALIDATION_SECRET`, set as an SWA app setting) after a website update. Publish a
   trivial change from the dashboard and confirm the public page updates within seconds,
   not after 60s.

## Step 4: instance-recycle behavior

SWA managed functions recycle opaquely; the practical proxy is time. Repeat Step 1 after
an idle gap (30+ minutes). A `HIT` or a single-MISS-then-HIT is fine. If every probe
after idle is a MISS cascade with matching backend fan-out, the cache is ephemeral
per-node memory.

## Decision tree

- Step 2 PASS: ISR persists well enough. Safe to start ad spend without a CDN in front
  of the HTML surface. Still do the media CDN (see `DECISION-cdn-front-door.md`).
- Step 2 FAIL: do NOT start paid traffic. Every viral share hits the single S3-DTU
  database through one API instance ~5x per view. Front the public surface with a CDN
  that caches HTML per `DECISION-cdn-front-door.md` (#375), or as a stopgap raise
  Cloudflare caching on `www.altarwed.com` with a Cache Rule honoring origin
  `Cache-Control` (requires the #382 headers PR so the origin emits `s-maxage`).
- Ambiguous (headers stripped, App Insights noisy): rerun Step 2 during a quiet window;
  the count ratio is the only signal you need to trust.
