param name string
param location string
param sqlConnectionString string
param sqlUsername string
@secure()
param sqlPassword string
@secure()
param jwtSecret string
@secure()
param resendApiKey string
param storageConnectionString string

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: name
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true  // use RBAC, not access policies
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enabledForDeployment: false
    enabledForTemplateDeployment: false
    enabledForDiskEncryption: false
  }
}

resource secretSqlUrl 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kv
  name: 'AZURE-SQL-URL'
  properties: { value: sqlConnectionString }
}

resource secretSqlUser 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kv
  name: 'AZURE-SQL-USERNAME'
  properties: { value: sqlUsername }
}

resource secretSqlPass 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kv
  name: 'AZURE-SQL-PASSWORD'
  properties: { value: sqlPassword }
}

resource secretJwt 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kv
  name: 'JWT-SECRET'
  properties: { value: jwtSecret }
}

resource secretResend 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kv
  name: 'RESEND-API-KEY'
  properties: { value: resendApiKey }
}

resource secretStorage 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kv
  name: 'AZURE-STORAGE-CONNECTION-STRING'
  properties: { value: storageConnectionString }
}

output name string = kv.name
output uri string = kv.properties.vaultUri
