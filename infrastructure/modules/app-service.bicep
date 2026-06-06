param name string
param location string
param planId string
param keyVaultName string
param appInsightsConnectionString string
param adminEmails string
param adminAlertEmail string
param resendFromEmail string
param appBaseUrl string
param nextjsBaseUrl string
param googleOauthRedirectUri string

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
      alwaysOn: true
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
        // ── Secrets reconciled into IaC as Key Vault references ──────────────
        {
          name: 'RESEND_API_KEY'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=RESEND-API-KEY)'
        }
        {
          name: 'REVALIDATION_SECRET'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=REVALIDATION-SECRET)'
        }
        {
          name: 'GOOGLE_OAUTH_CLIENT_ID'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=GOOGLE-OAUTH-CLIENT-ID)'
        }
        {
          name: 'GOOGLE_OAUTH_CLIENT_SECRET'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=GOOGLE-OAUTH-CLIENT-SECRET)'
        }
        {
          name: 'LOB_API_KEY'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=LOB-API-KEY)'
        }
        {
          name: 'UNSUBSCRIBE_SECRET'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=UNSUBSCRIBE-SECRET)'
        }
        {
          name: 'POSTAL_ADDRESS'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=POSTAL-ADDRESS)'
        }
        {
          name: 'META_PIXEL_ID'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=META-PIXEL-ID)'
        }
        {
          name: 'META_CAPI_ACCESS_TOKEN'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=META-CAPI-ACCESS-TOKEN)'
        }
        {
          name: 'API_BASE_URL'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=API-BASE-URL)'
        }
        // ── Non-secret config reconciled into IaC ───────────────────────────
        {
          name: 'ADMIN_EMAILS'
          value: adminEmails
        }
        {
          name: 'ADMIN_ALERT_EMAIL'
          value: adminAlertEmail
        }
        {
          name: 'RESEND_FROM_EMAIL'
          value: resendFromEmail
        }
        {
          name: 'APP_BASE_URL'
          value: appBaseUrl
        }
        {
          name: 'NEXTJS_BASE_URL'
          value: nextjsBaseUrl
        }
        {
          name: 'GOOGLE_OAUTH_REDIRECT_URI'
          value: googleOauthRedirectUri
        }
        // ── Application Insights (Java 3.x agent auto-instrumentation) ───────
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        {
          name: 'ApplicationInsightsAgent_EXTENSION_VERSION'
          value: '~3'
        }
        {
          name: 'XDT_MicrosoftApplicationInsights_Mode'
          value: 'recommended'
        }
      ]
    }
  }
}

output url string = 'https://${appService.properties.defaultHostName}'
output principalId string = appService.identity.principalId
