// AltarWed, Core Azure Infrastructure
// Deploy: az deployment group create --resource-group altarwed-rg --template-file main.bicep --parameters @parameters.json

@description('Environment name (prod, staging)')
param environment string = 'prod'

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('SQL Server admin username')
param sqlAdminUsername string

@description('SQL Server admin password')
@secure()
param sqlAdminPassword string

@description('JWT secret for token signing')
@secure()
param jwtSecret string

@description('Resend API key for email')
@secure()
param resendApiKey string

@description('Next.js ISR revalidation HMAC secret')
@secure()
param revalidationSecret string

@description('Google OAuth client id (Sheets guest sync)')
@secure()
param googleOauthClientId string

@description('Google OAuth client secret (Sheets guest sync)')
@secure()
param googleOauthClientSecret string

@description('Lob print-mail API key (optional)')
@secure()
param lobApiKey string = ''

@description('Comma-separated admin emails')
param adminEmails string = 'aasmanj@gmail.com'

@description('Email address that receives vendor registration alerts')
param adminAlertEmail string = 'hello@altarwed.com'

@description('From-address for transactional email (matches live prod)')
param resendFromEmail string = 'hello@altarwed.com'

// CUTOVER GATE: applying this value points every save-the-date and RSVP invite at
// invites.altarwed.com. That subdomain MUST be SPF/DKIM-verified in Resend first, or
// Resend 4xx-rejects every invite send. It is verified as of the cutover; keep it
// verified. Infra Bicep is not auto-deployed (the JAR deploy does not apply it), so
// the live value is set manually via `az webapp config appsettings set`; this default
// documents the intended prod state and keeps a manual infra apply consistent with it.
@description('From-address for guest-facing invite mail (save-the-dates, RSVP invites). Own subdomain isolates invite deliverability from the root domain.')
param resendInvitesFromEmail string = 'hello@invites.altarwed.com'

@description('Email address that receives monitoring alerts')
param alertEmail string = 'aasmanj@gmail.com'

@description('Base URL of the authenticated SPA')
param appBaseUrl string = 'https://app.altarwed.com'

@description('Base URL of the public Next.js site')
param nextjsBaseUrl string = 'https://www.altarwed.com'

@description('Numeric Google Cloud project number, used as the Picker app id (not a secret)')
param googlePickerAppId string = ''

// App Service Plan instance count. Default is 2 (issue #376: capacity 1 meant any
// crash or in-place deploy restart was a full API outage). The old "keep at 1"
// guard existed because the rate limiter and Resend pacer were in-memory and
// per-instance; issue #109 shipped (PR #454) and this template now provisions the
// Redis they share (modules/redis.bicep) and wires REDIS_URL, so multi-instance is
// safe. Autoscale (modules/app-service-plan.bicep) is enabled in the same change,
// floor 2, ceiling 3.
@description('App Service Plan instance count baseline; autoscale may add up to the ceiling of 3.')
@minValue(1)
@maxValue(3)
param appServicePlanCapacity int = 2

var appName = 'altarwed'
var prefix = '${appName}-${environment}'
// Derived from the App Service name pattern below, so observability can reference
// the API host without creating a dependency cycle on the appService module.
var apiBaseUrl = 'https://${prefix}-api.azurewebsites.net'
var googleOauthRedirectUri = '${apiBaseUrl}/api/v1/integrations/google-sheets/callback'

// ── App Service Plan ────────────────────────────────────────────────────────
module appServicePlan 'modules/app-service-plan.bicep' = {
  name: 'appServicePlan'
  params: {
    name: '${prefix}-plan'
    location: location
    capacity: appServicePlanCapacity
  }
}

// ── Azure SQL ───────────────────────────────────────────────────────────────
module sql 'modules/sql.bicep' = {
  name: 'sql'
  params: {
    serverName: '${prefix}-sql'
    databaseName: 'altarwed'
    location: location
    adminUsername: sqlAdminUsername
    adminPassword: sqlAdminPassword
  }
}

// ── Key Vault ───────────────────────────────────────────────────────────────
module keyVault 'modules/keyvault.bicep' = {
  name: 'keyVault'
  params: {
    name: '${prefix}-kv'
    location: location
    sqlConnectionString: sql.outputs.connectionString
    sqlUsername: sqlAdminUsername
    sqlPassword: sqlAdminPassword
    jwtSecret: jwtSecret
    resendApiKey: resendApiKey
    storageAccountKey: storage.outputs.accountKey
    storageAccountName: storage.outputs.accountName
    revalidationSecret: revalidationSecret
    googleOauthClientId: googleOauthClientId
    googleOauthClientSecret: googleOauthClientSecret
    lobApiKey: lobApiKey
  }
}

// ── Observability (App Insights + Log Analytics + alerts) ────────────────────
module observability 'modules/observability.bicep' = {
  name: 'observability'
  params: {
    prefix: prefix
    location: location
    alertEmail: alertEmail
    apiBaseUrl: apiBaseUrl
    sqlDatabaseId: sql.outputs.databaseId
  }
}

// ── Blob Storage ─────────────────────────────────────────────────────────────
module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: {
    name: '${appName}${environment}storage'
    location: location
  }
}

// ── Azure Cache for Redis (shared throttle/CSRF state, issues #109/#414/#376) ─
// Writes the REDIS-URL secret into Key Vault; the appService module below reads
// it via a Key Vault reference, hence its explicit dependsOn.
module redis 'modules/redis.bicep' = {
  name: 'redis'
  params: {
    name: '${prefix}-redis'
    location: location
    keyVaultName: keyVault.outputs.name
  }
}

// ── Azure Front Door (edge cache for public media, issues #246/#375) ─────────
// Adopts the existing 'altarwed-cdn' profile (was portal-created, untracked) and
// enables caching on the media.altarwed.com route. Names inside the module match
// the deployed resources exactly so this is an in-place update, not a rebuild.
module frontDoor 'modules/frontdoor.bicep' = {
  name: 'frontDoor'
  params: {
    originHost: '${storage.outputs.accountName}.blob.core.windows.net'
  }
}

// ── App Service (Spring Boot) ────────────────────────────────────────────────
module appService 'modules/app-service.bicep' = {
  name: 'appService'
  // The REDIS_URL app setting is a Key Vault reference to the REDIS-URL secret
  // created by the redis module; deploy the cache and secret first so the app
  // never boots with an unresolved reference.
  dependsOn: [
    redis
  ]
  params: {
    name: '${prefix}-api'
    location: location
    planId: appServicePlan.outputs.planId
    keyVaultName: keyVault.outputs.name
    appInsightsConnectionString: observability.outputs.connectionString
    adminEmails: adminEmails
    adminAlertEmail: adminAlertEmail
    resendFromEmail: resendFromEmail
    resendInvitesFromEmail: resendInvitesFromEmail
    appBaseUrl: appBaseUrl
    nextjsBaseUrl: nextjsBaseUrl
    googleOauthRedirectUri: googleOauthRedirectUri
    googlePickerAppId: googlePickerAppId
  }
}

// ── Grant App Service access to Key Vault ───────────────────────────────────
module keyVaultAccess 'modules/keyvault-access.bicep' = {
  name: 'keyVaultAccess'
  params: {
    keyVaultName: keyVault.outputs.name
    principalId: appService.outputs.principalId
  }
}

// The staging deployment slot has its own SystemAssigned identity (a distinct
// principal from prod), so it needs the same Key Vault Secrets User grant for its
// @Microsoft.KeyVault(...) app-setting references to resolve. Without this the slot
// boots but every secret read fails.
module keyVaultAccessSlot 'modules/keyvault-access.bicep' = {
  name: 'keyVaultAccessSlot'
  params: {
    keyVaultName: keyVault.outputs.name
    principalId: appService.outputs.slotPrincipalId
  }
}

// ── Frontend App Static Web App ──────────────────────────────────────────────
// Hosts the React + Vite authenticated dashboard (couples & vendors).
// SKU = Standard: required for custom auth providers and custom domains later.
module frontendApp 'modules/static-web-app.bicep' = {
  name: 'frontendApp'
  params: {
    name: '${prefix}-app'
    location: location
    sku: 'Standard'
  }
}

// ── Outputs ──────────────────────────────────────────────────────────────────
output appServiceUrl string = appService.outputs.url
output sqlServerFqdn string = sql.outputs.serverFqdn
output keyVaultUri string = keyVault.outputs.uri
output storageAccountName string = storage.outputs.accountName
output appInsightsName string = observability.outputs.appInsightsName
output frontendAppUrl string = 'https://${frontendApp.outputs.defaultHostname}'
@description('Add this value as GitHub secret: AZURE_STATIC_WEB_APPS_APP_API_TOKEN')
output frontendAppDeployToken string = frontendApp.outputs.deployToken
