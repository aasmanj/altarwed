# PLAN: Take Azure SQL off the public network (issue #381)

## Current state (from Bicep)

`modules/sql.bicep` on `altarwed-prod-sql`:

- `publicNetworkAccess: 'Enabled'` (line 15)
- Firewall rule `AllowAzureServices` with `0.0.0.0` to `0.0.0.0` (lines 20-27), the
  special rule meaning "any resource in any Azure tenant may attempt a connection".

So a server holding ~1.5M guest PII rows is reachable from every Azure subscription in
the world, gated only by the SQL admin username/password. Defense in depth says the
network should reject strangers before the password is ever tested.

## Options

### Option 1: VNet integration + service endpoint (recommended first step, ~free)

App Service regional VNet integration routes the app's outbound traffic through a
subnet; a `Microsoft.Sql` service endpoint on that subnet plus a SQL virtual network
rule admits only that subnet. Public network access stays technically Enabled, but the
open `AllowAzureServices` rule is deleted, so nothing outside our subnet connects.

- Cost: VNet and service endpoints are free. VNet integration requires Standard+ or
  Premium plan; P1v3 (see `PLAN-slot-swap-deploys.md` tier check) supports it. B2 does
  not, so this is sequenced AFTER the P1v3 move.
- Limitation: not a private endpoint; the SQL FQDN still resolves publicly, the
  firewall just denies everyone else.

### Option 2: Private endpoint + disable public access (full lockdown, later)

Private endpoint (~USD 7-9/month + per-GB processing) plus a `privatelink` DNS zone,
then `publicNetworkAccess: 'Disabled'`. Note: disabling public access blocks
firewall-rule AND service-endpoint paths; only private endpoints work, so this is
all-or-nothing and must come after Option 1 is proven.

### Option 3 (rejected): allowlist App Service outbound IPs

`az webapp show -q outboundIpAddresses` gives the current list, but the set changes on
tier changes, slot swaps in some cases, and scale events. We are about to change tier
(P1v3) and scale out (#376), which is exactly when the allowlist silently breaks prod.
Brittle; do not build on it.

## Sequence that cannot lock prod out (order matters)

1. Create the network (Jordan or agent-drafted Bicep, applied by Jordan):
   VNet + delegated subnet (`Microsoft.Web/serverFarms` delegation) + `Microsoft.Sql`
   service endpoint on the subnet.
2. Enable regional VNet integration on `altarwed-prod-api` AND its `staging` slot
   (the slot boots against the same DB; forget it and slot deploys die at boot):
   `az webapp vnet-integration add -g altarwed-rg -n altarwed-prod-api --vnet <vnet> --subnet <subnet>`
   and the same with `--slot staging`.
3. Add the SQL VNet rule:
   `az sql server vnet-rule create -g altarwed-rg -s altarwed-prod-sql -n app-subnet --vnet-name <vnet> --subnet <subnet>`
4. TEST BEFORE REMOVING ANYTHING. With both the old 0.0.0.0 rule and the new VNet rule
   in place, restart the app and confirm connectivity over the new path:
   - `curl https://altarwed-prod-api.azurewebsites.net/actuator/health` shows `UP`
     (the DB health indicator proves a live connection), and
   - from Kudu SSH: `nc -zv altarwed-prod-sql.database.windows.net 1433`.
5. Only now remove the open rule:
   `az sql server firewall-rule delete -g altarwed-rg -s altarwed-prod-sql -n AllowAzureServices`
6. Re-verify `/actuator/health`, run one write path (e.g. an RSVP on a test wedding),
   and watch App Insights dependency failures for 15 minutes.
7. Reconcile Bicep in a follow-up PR: delete the `allowAzureServices` resource from
   `modules/sql.bicep`, add the VNet resources, so the next `az deployment group create`
   does not resurrect the open rule. (Agent-implementable once the live change works.)
8. If Jordan needs ad-hoc query access from his machine, add a named client-IP firewall
   rule for his IP only; never re-add 0.0.0.0.

Note: CI never talks to prod SQL (Flyway runs at app boot; the pipeline migrates a
throwaway container), so no GitHub-runner allowance is needed.

## Rollback

One command restores today's posture instantly:

```bash
az sql server firewall-rule create -g altarwed-rg -s altarwed-prod-sql \
  -n AllowAzureServices --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0
```

Keep it in the back pocket during step 5-6; connectivity loss shows up within one
health-check interval, and this reverses it in seconds.

## Jordan-only steps

The P1v3 plan prerequisite (spend), applying the VNet Bicep, the az commands in steps
2-5, and the private-endpoint purchase later. The Bicep reconciliation and this doc's
follow-ups are agent work.
