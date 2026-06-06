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
@secure()
param storageAccountKey string
param storageAccountName string
@secure()
param revalidationSecret string
@secure()
param googleOauthClientId string
@secure()
param googleOauthClientSecret string
@secure()
param lobApiKey string = ''

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
    enabledForTemplateDeployment: true  // required so ARM can resolve KV parameter references
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
  properties: { value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};AccountKey=${storageAccountKey};EndpointSuffix=core.windows.net' }
}

// Next.js ISR revalidation HMAC secret (shared with frontend-public).
resource secretRevalidation 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kv
  name: 'REVALIDATION-SECRET'
  properties: { value: revalidationSecret }
}

// Google OAuth (Sheets guest sync). Client id is not strictly a secret, but kept
// in Key Vault so the full OAuth credential set lives in one audited place.
resource secretGoogleClientId 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kv
  name: 'GOOGLE-OAUTH-CLIENT-ID'
  properties: { value: googleOauthClientId }
}

resource secretGoogleClientSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kv
  name: 'GOOGLE-OAUTH-CLIENT-SECRET'
  properties: { value: googleOauthClientSecret }
}

// Lob print-mail API key. Live feature; empty default keeps non-prod deploys clean.
resource secretLob 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kv
  name: 'LOB-API-KEY'
  properties: { value: lobApiKey }
}

output name string = kv.name
output uri string = kv.properties.vaultUri
