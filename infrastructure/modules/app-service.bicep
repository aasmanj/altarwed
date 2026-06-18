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
param googlePickerAppId string

// Custom domain api.altarwed.com is bound to this App Service with a free
// App Service Managed Certificate (SNI SSL). It is intentionally NOT declared
// here: the managed cert can only be issued after the hostname is bound and the
// DNS records (CNAME api -> *.azurewebsites.net, TXT asuid.api -> the site's
// customDomainVerificationId) exist, so a single declarative pass cannot create
// all three in order. Managed out-of-band and reproducible via:
//   az webapp config hostname add  --webapp-name <name> -g <rg> --hostname api.altarwed.com
//   az webapp config ssl create    -g <rg> --name <name> --hostname api.altarwed.com
//   az webapp config ssl bind      -g <rg> --name <name> --certificate-thumbprint <tb> --ssl-type SNI
// Putting the API on the altarwed.com registrable domain makes it same-site with
// the SPA (app.altarwed.com) so the HttpOnly refresh cookie is first-party, not a
// third-party cookie that Safari/Firefox/Chrome drop on the cross-site refresh call.
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
          name: 'BLOB_PUBLIC_BASE_URL'
          value: 'https://media.altarwed.com'
        }
        {
          name: 'CORS_ALLOWED_ORIGINS'
          value: 'https://altarwed.com,https://www.altarwed.com,https://app.altarwed.com'
        }
        {
          name: 'COOKIE_SECURE'
          value: 'true'
        }
        {
          name: 'COOKIE_SAME_SITE'
          value: 'None'
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
          // Outbound Resend send rate (req/sec) per instance; keep under the 5/sec
          // account cap. Bump when the Resend plan is upgraded.
          name: 'RESEND_RATE_LIMIT_PER_SECOND'
          value: '2'
        }
        {
          // Svix signing secret for the Resend delivery webhook (whsec_...). Requires
          // a RESEND-WEBHOOK-SECRET secret in Key Vault; until set, the webhook fails
          // closed (rejects all events) rather than trusting unsigned bounces.
          name: 'RESEND_WEBHOOK_SECRET'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=RESEND-WEBHOOK-SECRET)'
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
          name: 'STRIPE_SECRET_KEY'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=STRIPE-SECRET-KEY)'
        }
        {
          name: 'STRIPE_WEBHOOK_SECRET'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=STRIPE-WEBHOOK-SECRET)'
        }
        {
          name: 'STRIPE_PRICE_PRO_MONTHLY'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=STRIPE-PRICE-PRO-MONTHLY)'
        }
        {
          name: 'STRIPE_PRICE_PRO_ANNUAL'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=STRIPE-PRICE-PRO-ANNUAL)'
        }
        {
          // Browser API key for the Google Picker (restricted to our referrers +
          // Picker/Sheets APIs). Low-sensitivity but kept in Key Vault for parity.
          name: 'GOOGLE_PICKER_API_KEY'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=GOOGLE-PICKER-API-KEY)'
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
        {
          // Numeric Cloud project number, not a secret.
          name: 'GOOGLE_PICKER_APP_ID'
          value: googlePickerAppId
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
