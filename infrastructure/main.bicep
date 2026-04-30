// AltarWed — Core Azure Infrastructure
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

var appName = 'altarwed'
var prefix = '${appName}-${environment}'

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
    storageConnectionString: storage.outputs.connectionString
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

// ── Outputs ──────────────────────────────────────────────────────────────────
output appServiceUrl string = appService.outputs.url
output sqlServerFqdn string = sql.outputs.serverFqdn
output keyVaultUri string = keyVault.outputs.uri
output storageAccountName string = storage.outputs.accountName
