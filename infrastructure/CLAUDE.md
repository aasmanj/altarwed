
# Infrastructure, AltarWed (Azure Bicep IaC)

Azure resources defined as Bicep. `main.bicep` composes modules under `modules/`. Some
resources are managed separately and are intentionally NOT in `main.bicep` (see below).

## Azure Resources (prod, resource group `altarwed-rg`)
- **App Service** (backend Spring Boot JAR, B2 tier): `altarwed-prod-api`
- **Azure SQL**: `altarwed-prod-sql` (primary database, SQL Server dialect)
- **Azure Blob Storage**: `altarwedprodstorage`, container `altarwed-media`, connection string
  via `AZURE_STORAGE_CONNECTION_STRING`. Container public access = "Blob" so image URLs are
  publicly readable. Vendor logos under `vendor-logos/{vendorId}/`.
- **Azure Key Vault**: `altarwed-prod-kv` — ALL secrets (never hardcode). All 16 secrets present.
- **Azure CDN**: static assets and media delivery.
- **Azure Application Insights**: observability (parses MDC fields from stdout; see
  `backend/CLAUDE.md` Observability Rules).

### Static Web Apps (two, managed differently)
- **frontend-public (Next.js)**: `altarwed-landing` in `altarwed-landing_group`.
  **NOT in main.bicep** — managed separately. Deployed by `.github/deploy-landing.yml` using
  the `AZURE_STATIC_WEB_APPS_API_TOKEN` secret. Runtime app settings (all set):
  `REVALIDATION_SECRET`, `RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, `NEXT_PUBLIC_FB_PIXEL_ID`, plus
  `APPLICATIONINSIGHTS_CONNECTION_STRING` for SSR server logs (issue #422; set via
  `az staticwebapp appsettings set`, see `RUNBOOK-frontend-observability.md`). Because this SWA is
  not in Bicep, App-Insights wiring is a manual az step, not a Bicep apply.
- **frontend-app (React/Vite)**: `altarwed-prod-app` in `altarwed-rg`. **In main.bicep.**
  Deployed by `.github/deploy-app.yml` using `AZURE_STATIC_WEB_APPS_APP_API_TOKEN`.

## Cloudflare (click-ops, NOT in IaC)
Cloudflare proxies the `altarwed.com` zone in front of Azure. Two behaviors live only in the
Cloudflare dashboard, with no representation in this repo:
- **Apex to www canonical redirect**: a Single Redirect rule named "Apex to www canonical"
  (wildcard `https://altarwed.com/*` to `https://www.altarwed.com/${1}`, 308, preserve query
  string), added 2026-07-18. The `redirects()` block in `frontend-public/next.config.ts`
  (PR #432) looks like it does this but no-ops in prod: the Cloudflare/Azure proxy chain
  rewrites the `Host` header before it reaches the Next.js server, so the host match never
  fires. It stays in the repo only as a fallback. The edge rule is the live fix.
- **Always Use HTTPS**: upgrades `http://` requests at the edge (301) before the rule above.

## The env-var → Bicep contract (critical, enforced by code-reviewer)
**Every new backend env var must be added to `modules/app-service.bicep` `appSettings` in the
same PR that introduces it.** Backend code that references a new env var (`@Value`,
`System.getenv`, `application.yml`) without a matching Bicep entry works locally and crashes in
prod on the next deploy. A missing var with no default crashes the JVM at startup before the
health endpoint exists (happened 2026-06-05). See `backend/CLAUDE.md` "Environment Variable
Rules" for the code-side rule (safe defaults via `${X:}`).

## Reliability / scale-up path
Spare no expense within reason. Current: B2 App Service. Upgrade path when traffic grows:
B2 → P1v3 (auto-scale), add Azure Front Door (CDN + global failover), Azure SQL Business
Critical tier. Do not over-provision prematurely.

## Rules
- Never hardcode secrets, API keys, or connection strings — Key Vault references only.
- Secrets are referenced in Bicep via Key Vault; the KV reference pattern is in `reference_azure_resources` memory.
