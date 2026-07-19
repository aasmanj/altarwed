# PLAN: Staging-slot + swap deploys for the backend (issue #379)

## Current state

- `deploy-backend.yml` deploys the JAR straight to `altarwed-prod-api`
  (`azure/webapps-deploy@v3` with `AZURE_APP_SERVICE_PUBLISH_PROFILE`, job "deploy"),
  then smoke-tests AFTER the deploy (SHA gate on `/actuator/info`, controller probes).
  A bad build or migration is already serving prod by the time the smoke test fails,
  and there is no auto-revert.
- The Bicep already stages the fix: `modules/app-service.bicep` provisions a `staging`
  slot with an identical `siteConfig`/appSettings variable (drift-proof by
  construction), and `main.bicep` grants the slot's own SystemAssigned identity Key
  Vault access (`keyVaultAccessSlot`). PR #283 merged this along with a P1v3 plan.

## The tier question (check first)

`infrastructure/CLAUDE.md` says the live App Service is B2; `modules/app-service-plan.bicep`
declares P1v3. Bicep is NOT auto-applied (the JAR deploy ships only the JAR), so the
live plan may still be B2, and Basic tier supports zero deployment slots (slots need
Standard or higher; PremiumV3 allows 20). Verify what prod actually runs:

```bash
az appservice plan show -g altarwed-rg -n altarwed-prod-plan --query "{sku:sku.name,tier:sku.tier,capacity:sku.capacity}"
az webapp deployment slot list -g altarwed-rg -n altarwed-prod-api -o table
```

If the plan is still B2: applying `main.bicep`
(`az deployment group create --resource-group altarwed-rg --template-file main.bicep --parameters @parameters.json`)
upgrades to P1v3 and creates the slot. That is a spend step (P1v3 Linux is roughly
USD 80-85/month vs ~USD 35 for B2; verify current pricing) and is Jordan-only. It also
serves #376, which needs P1v3 for autoscale anyway.

## Target pipeline (describe only; do NOT edit workflows in this PR)

Changes to `.github/workflows/deploy-backend.yml`:

1. Job "deploy": add `slot-name: staging` to the `azure/webapps-deploy@v3` step and
   switch its credential to a slot publish profile (new GitHub secret
   `AZURE_APP_SERVICE_STAGING_PUBLISH_PROFILE`, downloaded from the slot's Deployment
   Center; the existing prod publish profile does not authenticate to the slot).
   Alternative: move the job to `azure/login` with OIDC and drop publish profiles
   entirely, which the swap step needs anyway.
2. Job "smoke-test": retarget both steps at the slot host
   `https://altarwed-prod-api-staging.azurewebsites.net` (SHA gate on
   `/actuator/info`, then the controller probes). This is the health-check gate
   BEFORE any production traffic sees the build.
3. New job "swap" (needs: smoke-test), using `azure/login`:

   ```bash
   az webapp deployment slot swap -g altarwed-rg -n altarwed-prod-api \
     --slot staging --target-slot production
   ```

4. New job "verify-prod" (needs: swap): rerun the SHA gate against
   `https://altarwed-prod-api.azurewebsites.net/actuator/info` to confirm the swap
   actually promoted the new commit, then the controller probes once more.

No sticky (slot-specific) settings are needed: the Bicep intentionally shares one
appSettings definition between prod and slot, which is what makes the swap safe.

## The Flyway caveat (do not skip this)

Flyway runs at application boot, so the SLOT boot migrates the SHARED prod database
before the swap. Old code (still serving prod) then runs against the new schema during
the smoke-test window. Two consequences:

- Migrations must stay backward compatible (expand/contract: add columns nullable,
  backfill, only drop in a later release). This is already the safe discipline, the
  slot model just makes it mandatory instead of aspirational.
- A migration failure now surfaces as a slot boot failure. The smoke test fails, the
  swap never runs, prod keeps serving. That is the whole point: today the same failure
  is a prod outage.

## Rollback

A swap is its own rollback. The previous build is sitting on the staging slot after a
swap, warm:

```bash
az webapp deployment slot swap -g altarwed-rg -n altarwed-prod-api \
  --slot staging --target-slot production
```

Seconds, not minutes, and no rebuild. Schema rollbacks are NOT covered (Flyway is
irreversible per project rules); backward-compatible migrations are what makes the
code-level swap-back safe.

## Sequence for Jordan

1. Verify live tier and slot existence (commands above).
2. If B2: apply `main.bicep` (spend decision). Confirm slot KV references resolve
   (slot -> Environment variables -> green checks).
3. Download the slot publish profile, add the GitHub secret (or set up OIDC
   `azure/login`, preferred).
4. Approve a follow-up PR making the workflow changes in the section above
   (agent-implementable, ~half a day including a dry run).
5. First slot deploy: watch the slot boot logs once, end to end, before trusting it.
