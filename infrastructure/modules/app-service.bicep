param name string
param location string
param planId string
param keyVaultName string

resource appService 'Microsoft.Web/sites@2023-12-01' = {
  name: name
  location: location
  identity: {
    type: 'SystemAssigned'  // needed for Key Vault RBAC
  }
  properties: {
    serverFarmId: planId
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'JAVA|21-java21'
      alwaysOn: false  // F1 free tier does not support AlwaysOn; upgrade plan to B1+ to enable
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      appSettings: [
        {
          name: 'AZURE_SQL_URL'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=AZURE-SQL-URL)'
        }
        {
          name: 'AZURE_SQL_USERNAME'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=AZURE-SQL-USERNAME)'
        }
        {
          name: 'AZURE_SQL_PASSWORD'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=AZURE-SQL-PASSWORD)'
        }
        {
          name: 'JWT_SECRET'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=JWT-SECRET)'
        }
        {
          name: 'AZURE_STORAGE_CONNECTION_STRING'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=AZURE-STORAGE-CONNECTION-STRING)'
        }
        {
          name: 'AZURE_STORAGE_CONTAINER_NAME'
          value: 'altarwed-media'
        }
        {
          name: 'CORS_ALLOWED_ORIGINS'
          value: 'https://altarwed.com,https://www.altarwed.com,https://app.altarwed.com'
        }
        {
          name: 'SPRING_PROFILES_ACTIVE'
          value: 'prod'
        }
        {
          name: 'WEBSITES_PORT'
          value: '8080'
        }
      ]
    }
  }
}

output url string = 'https://${appService.properties.defaultHostName}'
output principalId string = appService.identity.principalId
