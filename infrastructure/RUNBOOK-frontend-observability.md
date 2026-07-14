# Runbook: Application Insights for the Static Web Apps (issue #422)

During the 2026-07-13 outage there were zero Next.js server logs in Azure, so diagnosis meant
rebuilding the deployed commit locally and running `next start` to see the stack trace. Wiring
the landing app to Application Insights turns that 30-minute rebuild into a 2-minute log read.

The App Insights resource already exists: `altarwed-prod-insights` (workspace-based, in
`altarwed-rg`), provisioned by `modules/observability.bicep`. This runbook connects the
Static Web Apps to it.

## The two SWAs are not equivalent for this

| SWA | Runtime | Setting does what |
|---|---|---|
| `altarwed-landing` (altarwed.com, Next.js hybrid) | Node SSR server runs in SWA | `APPLICATIONINSIGHTS_CONNECTION_STRING` auto-instruments the SSR server, so unhandled SSR exceptions and traces flow to App Insights. **This is the load-bearing fix.** |
| `altarwed-prod-app` (app.altarwed.com, React + Vite) | Pure static client bundle, no server | A runtime SWA app setting is **inert**: a client bundle cannot read SWA app settings, and Vite bakes env vars at build time (`VITE_*`). Setting it here produces no logs. |

Conclusion: set the connection string on `altarwed-landing` (below). Do **not** cargo-cult it
onto `altarwed-prod-app`, it would be a no-op. If browser-side telemetry for the SPA is wanted
later, that is a separate task: add the App Insights JS SDK and feed it a `VITE_` build var, do
not rely on a runtime app setting.

`altarwed-landing` lives in resource group `altarwed-landing_group` and is intentionally NOT in
`main.bicep` (see `infrastructure/CLAUDE.md`), so this is a manual `az` step, not a Bicep apply.

## Steps (run once, Jordan / Azure operator)

```bash
# 1. Read the connection string from the existing App Insights resource.
#    It is a resource property, not a stored secret, so this is safe to fetch on demand.
CONN=$(az monitor app-insights component show \
  --app altarwed-prod-insights \
  --resource-group altarwed-rg \
  --query connectionString -o tsv)

# 2. Set it on the Next.js landing SWA. This merges into existing app settings
#    (REVALIDATION_SECRET, RESEND_API_KEY, RESEND_AUDIENCE_ID, NEXT_PUBLIC_FB_PIXEL_ID).
az staticwebapp appsettings set \
  --name altarwed-landing \
  --resource-group altarwed-landing_group \
  --setting-names APPLICATIONINSIGHTS_CONNECTION_STRING="$CONN"

# 3. Confirm it landed (value is masked in the portal; this lists the keys).
az staticwebapp appsettings list \
  --name altarwed-landing \
  --resource-group altarwed-landing_group -o table
```

The connection string never enters the repo or a workflow file, it is read from Azure and set
directly, so the "no connection string committed" acceptance criterion holds.

## Verify traces actually flow

1. Trigger an SSR render on the live site (load `https://altarwed.com/` and a
   `/wedding/<slug>` page).
2. In the portal, open `altarwed-prod-insights` > Logs and run:
   ```kusto
   union traces, requests, exceptions
   | where timestamp > ago(15m)
   | order by timestamp desc
   ```
   SSR requests/traces should appear within a few minutes. If nothing shows after ~10 minutes,
   the SWA may need a redeploy to pick up the new setting (push a no-op commit or re-run
   `deploy-landing.yml`).

## Why this is not automated in the deploy workflow

`.github/workflows/deploy-landing.yml` authenticates only with the SWA deploy token
(`AZURE_STATIC_WEB_APPS_API_TOKEN`), which cannot run `az staticwebapp appsettings set`. Doing
this in CI would require adding full Azure service-principal credentials as GitHub secrets, a
larger surface than a one-time manual set is worth. Revisit if frontend app settings start
changing often.
