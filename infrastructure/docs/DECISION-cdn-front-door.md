# DECISION: CDN / Front Door for blob media and the public API origin (issues #246, #375)

## Current state (grounded in the repo)

- No CDN exists. `grep` for `Microsoft.Cdn` / Front Door across `infrastructure/`
  returns nothing; `main.bicep` composes app-service, sql, storage, observability,
  keyvault, and SWA modules only. The `infrastructure/CLAUDE.md` line "Azure CDN:
  static assets and media delivery" is IaC drift and should be corrected when this
  decision ships.
- Media: hero images and albums are served directly from public Blob
  (`altarwedprodstorage`, container `altarwed-media`, `storage.bicep` sets
  `publicAccess: 'Blob'`) via `media.altarwed.com`
  (`app-service.bicep` `BLOB_PUBLIC_BASE_URL: 'https://media.altarwed.com'`). Every
  guest view is billed origin egress with zero edge caching.
- API: `altarwed-prod-api` (App Service) takes wedding-page fan-out traffic directly.
- Cloudflare already proxies the `altarwed.com` zone (apex redirect + Always Use HTTPS
  live per `infrastructure/CLAUDE.md`). `media.altarwed.com` and `www.altarwed.com`
  are subdomains of that zone, so Cloudflare CDN is one toggle away, no new vendor.
- The #382 PR adds origin `Cache-Control` (`s-maxage`) headers to the public backend
  GETs. Any of the three CDNs below will respect those headers; without them, API
  responses are uncacheable at the edge no matter which CDN we pick.

## Options

### A. Cloudflare (recommended)

- Cost: $0 on the current plan. Proxying a subdomain in an existing zone is free;
  cached egress from Cloudflare's edge is free. Azure still bills origin egress on
  cache misses only.
- Setup: DNS-only records become proxied (orange cloud); Cloudflare terminates TLS
  with its universal cert, origin stays HTTPS (Full/strict mode).
- Cache keys: URL-based. Blob URLs are content-addressed per upload path, so no
  cache-busting problem for media. For the API, Cloudflare honors origin
  `Cache-Control: s-maxage` once #382 lands; add a Cache Rule scoped to
  `/api/v1/wedding-*` and `/api/v1/vendors*` GETs only.
- Risk: one more hop on the auth API if we proxy `api.altarwed.com`; the HttpOnly
  refresh-cookie flow is unaffected (same host), but the App Service managed
  certificate renewal (bound out-of-band per `app-service.bicep` comment) validates
  via public DNS/HTTP, so verify renewal still succeeds after proxying, or keep
  `api.altarwed.com` DNS-only and cache only the SSR fetch path (see below).

### B. Azure Front Door Standard

- Cost: ~USD 35/month base + roughly USD 0.08 to 0.09/GB egress + per-request fees
  (verify in the pricing calculator; numbers move). Real WAF, rules engine, origin
  failover, health probes. This is the right tool later when we want global failover
  and a managed WAF, which Cloudflare free does not give us on custom rules depth.
- Setup: new Bicep module (`Microsoft.Cdn/profiles` SKU `Standard_AzureFrontDoor`),
  endpoint + origin group per origin (blob, App Service), custom domain binding with
  managed TLS, then CNAME `media` / `api` to the AFD endpoint. Small, implementable
  by the agent once approved.

### C. Azure CDN classic

- Cheaper per GB and no base fee, but the classic CDN SKUs are on a retirement path
  and Microsoft is steering new work to Front Door. Do not build new infrastructure
  on a product being retired. Rejected.

## Cost picture (rough, verify before committing spend)

| Scenario | Direct blob (today) | Cloudflare | AFD Standard |
|---|---|---|---|
| Current scale (<10 GB/mo media) | ~USD 1 | USD 0 | ~USD 36 |
| 10k visitors/day (~600-900 GB/mo media at 2-3 MB/visit) | ~USD 50-80 egress, no cache | ~USD 5-15 residual origin egress | ~USD 85-120 |

## Recommendation

1. Now (before any ad spend, free): proxy `media.altarwed.com` through Cloudflare with
   default static-asset caching. This kills the origin-egress multiplier on viral
   shares for zero dollars and zero new vendors.
2. With #382 merged: add a Cloudflare Cache Rule honoring origin `Cache-Control` for
   the public API GETs on whichever host the SSR fetches use (check the
   `NEXT_PUBLIC_API_URL` GitHub secret: if it points at
   `altarwed-prod-api.azurewebsites.net` rather than `api.altarwed.com`, SSR traffic
   bypasses Cloudflare and only ISR protects the origin; pointing it at
   `api.altarwed.com` proxied brings it under the same edge).
3. Only if #245 verification FAILS or when we need WAF/global failover: add AFD
   Standard in front of the public surface, as a proper Bicep module.
4. Either way: fix the `infrastructure/CLAUDE.md` CDN line to match reality.

Rollback: flip the Cloudflare record back to DNS-only (gray cloud); propagation is
seconds and the origin serves exactly as today. For AFD, repoint the CNAME back to the
origin hostname and delete the profile; keep TTLs at 300s during the transition.

## Jordan-only steps (portal/spend, cannot be automated)

- Cloudflare dashboard: orange-cloud `media.altarwed.com`, set SSL mode Full (strict),
  add the Cache Rule for API paths.
- Decide whether `api.altarwed.com` gets proxied (check managed-cert renewal after).
- Any AFD purchase (~USD 35/month recurring) and its custom-domain validation records.
- Update the `NEXT_PUBLIC_API_URL` GitHub secret if step 2 requires repointing it.

Agent-implementable once decided: the AFD Bicep module, the CLAUDE.md doc fix, and the
#382 Cache-Control headers (already in a PR).
