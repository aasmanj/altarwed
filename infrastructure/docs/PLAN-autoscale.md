# PLAN: App Service scale-out and autoscale (issue #376, blocked on Redis #109)

## Status: blocked, and the block is real

Do not raise capacity yet. Three pieces of state are in-memory and per-instance:

- Rate-limit buckets: `RateLimitingFilter` keeps Bucket4j buckets in a
  `ConcurrentHashMap`; N instances = N times the attacker allowance on login/RSVP.
- Resend send pacer: `RESEND_RATE_LIMIT_PER_SECOND=2` per instance
  (`modules/app-service.bicep:90`); 2 instances = 4/sec, 3 = 6/sec against the 5/sec
  Resend account cap, so scale-out can start bouncing invite email.
- OAuth CSRF state: `GoogleOAuthService` holds the state map in-process; a Google
  callback landing on the other instance fails with `invalid_state`. The per-wedding
  find-invitation throttle (#412) is likewise process-local and weakens by N.

Issue #109 moves these to Azure Cache for Redis (Basic C0, ~USD 16/month). A PR
introducing the store abstraction (in-memory implementation now, Redis implementation
behind it) is in flight; #109 completes when the Redis-backed store is wired and the
cache is provisioned in Bicep.

## What is already staged (merged via PR #283, not yet applied to Azure)

- `modules/app-service-plan.bicep` declares P1v3 with `capacity` param default 1 and a
  fully written autoscale resource that is `enabled: false` on purpose.
- Autoscale rule shape (review it there, it is ready): scale OUT +1 when average CPU
  > 65% over 5 minutes (cooldown 5 min); scale IN -1 when average CPU < 30% over 10
  minutes (cooldown 10 min); floor 1, ceiling 3. Asymmetric windows prevent flapping.
  CPU is the right metric because signup/login BCrypt-12 hashing is the dominant
  CPU cost.
- `modules/sql.bicep` already bumped the DB to S3 (100 DTU) with the Hikari math
  documented inline: 20 connections per instance, 60 sessions at the 3-instance
  ceiling, and S3's DTU budget is what keeps them from starving each other.

## Target state (execute only after #109 ships)

1. Provision Redis (Bicep module, agent-implementable with the #109 PR), point the
   rate-limit store, Resend pacer, OAuth state, and find-invitation throttle at it.
2. In ONE change, per the guard comments in `main.bicep:71-79`:
   - set `appServicePlanCapacity` to 2 (baseline 2 instances: an instance recycle or
     deploy is no longer a full API outage, which is the HA point of #376), and
   - flip the autoscale resource to `enabled: true` with minimum 2, maximum 3
     (adjust the profile's `minimum`/`default` from 1 to 2 in the same edit).
3. Apply: `az deployment group create --resource-group altarwed-rg --template-file main.bicep --parameters @parameters.json` (Jordan; spend step: second P1v3 instance
   roughly doubles the plan cost, plus ~USD 16/month Redis).
4. Verify after apply:
   - two instances serving: App Insights `requests | summarize dcount(cloud_RoleInstance)`;
   - rate limits still correct globally (hammer the login limiter from one IP and
     confirm the cap does not double);
   - Resend send rate under 5/sec during a save-the-date batch;
   - Google Sheets connect flow completes (OAuth state now shared).

## Ordering with the other launch items

Redis (#109) -> capacity 2 + autoscale (this doc) is independent of the slot-swap
pipeline (#379) but shares the P1v3 prerequisite. Do the P1v3/Bicep apply once and
both fall out of it. The CDN decision (#246/#375) reduces how often autoscale is
needed at all; it does not replace the baseline-2 HA goal.
