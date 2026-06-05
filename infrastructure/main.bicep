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

@description('From-address for transactional email (matches live prod)')
param resendFromEmail string = 'hello@altarwed.com'

@description('Email address that receives monitoring alerts')
param alertEmail string = 'aasmanj@gmail.com'

@description('Base URL of the authenticated SPA')
param appBaseUrl string = 'https://app.altarwed.com'

@description('Base URL of the public Next.js site')
param nextjsBaseUrl string = 'https://www.altarwed.com'

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

// ── App Service (Spring Boot) ────────────────────────────────────────────────
module appService 'modules/app-service.bicep' = {
  name: 'appService'
  params: {
    name: '${prefix}-api'
    location: location
    planId: appServicePlan.outputs.planId
    keyVaultName: keyVault.outputs.name
    appInsightsConnectionString: observability.outputs.connectionString
    adminEmails: adminEmails
    resendFromEmail: resendFromEmail
    appBaseUrl: appBaseUrl
    nextjsBaseUrl: nextjsBaseUrl
    googleOauthRedirectUri: googleOauthRedirectUri
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
