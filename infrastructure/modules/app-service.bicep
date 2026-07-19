param name string
param location string
param planId string
param keyVaultName string
param appInsightsConnectionString string
param adminEmails string
param adminAlertEmail string
param resendFromEmail string
param resendInvitesFromEmail string
param appBaseUrl string
param nextjsBaseUrl string
param googleOauthRedirectUri string
param googlePickerAppId string

// App settings are hoisted into a variable so the production site AND the staging
// deployment slot share one identical definition. A slot that drifts from prod
// config is the classic zero-downtime-swap footgun (swap succeeds, prod picks up a
// setting that was only ever tested on the slot, or vice versa). One source of
// truth keeps the swap safe.
var appSettings = [
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
  {
    // Seconds the platform waits after SIGTERM before SIGKILL on stop/restart/deploy.
    // Default is 5s, too short for Spring's graceful drain (server.shutdown=graceful,
    // spring.lifecycle.timeout-per-shutdown-phase=20s). Set above that 20s so in-flight
    // requests drain cleanly instead of the container being torn down mid-request
    // (the NoClassDefFoundError storm + public-site 504 on every restart).
    name: 'WEBSITES_CONTAINER_STOP_TIME_LIMIT'
    value: '30'
  }
  // ── Secrets reconciled into IaC as Key Vault references ──────────────
  {
    name: 'RESEND_API_KEY'
    value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=RESEND-API-KEY)'
  }
  {
    // Outbound Resend send rate (req/sec) PER INSTANCE; keep under the 5/sec
    // account cap. This pacer is in-memory and does not coordinate across
    // instances, so total send rate = this value x instanceCount. At the
    // committed capacity of 1 that is 2/sec (safe); scaling out multiplies it,
    // which is why plan capacity stays at 1 until issue #109 (Redis) moves the
    // pacer to a shared store. Bump when the Resend plan is upgraded.
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
    // Cloudflare Turnstile secret key for the RSVP find-invitation captcha (issue
    // #89). Deliberately a literal empty string, NOT a Key Vault reference: a
    // @Microsoft.KeyVault(...) pointer to a secret that doesn't exist yet does not
    // resolve to an empty string, it passes the literal unresolved reference text
    // through as the value, which CloudflareTurnstileAdapter would treat as a
    // configured (but garbage) secret and fail every RSVP search closed. Once a real
    // Cloudflare Turnstile site exists, create TURNSTILE-SECRET-KEY in Key Vault with
    // its real value FIRST, then switch this line to the same KV-reference pattern as
    // REVALIDATION_SECRET above.
    name: 'TURNSTILE_SECRET_KEY'
    value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=TURNSTILE-SECRET-KEY)'
  }
  {
    // Shared-state Redis URL for the per-IP rate limiter, RSVP search throttle, and
    // Google OAuth CSRF state (issues #109/#414). Deliberately a literal empty string
    // until an Azure Cache for Redis is provisioned (Jordan's spend decision, see the
    // #109 PR for the az CLI steps): empty keeps today's in-memory per-instance stores,
    // which is correct at App Service capacity 1. NOT yet a Key Vault reference for the
    // same reason as TURNSTILE_SECRET_KEY above: an unresolved KV pointer passes its
    // literal reference text through as the value, which RedisClient.create() would
    // treat as a (garbage) connection URL and crash startup. The URL embeds the cache
    // access key, so once the cache exists, create a REDIS-URL secret in Key Vault
    // (rediss://:{access-key}@{cache-name}.redis.cache.windows.net:6380/0) FIRST, then
    // switch this line to the KV-reference pattern used by REVALIDATION_SECRET. Must be
    // set before scaling plan capacity past 1.
    name: 'REDIS_URL'
    value: ''
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
    // AES-256 key (base64, 32 bytes) for TokenEncryptionService, which encrypts stored
    // Google OAuth access/refresh tokens at rest (issue #42). Unlike TURNSTILE_SECRET_KEY
    // above, an unresolved KV reference is safe to READ here: TokenEncryptionService
    // base64-decodes and length-checks the value before trusting it, so garbage/placeholder
    // text is rejected with a startup WARN rather than treated as a valid key.
    //
    // RELEASE ORDERING (required, not optional): deploy-backend.yml ships only the JAR, not
    // this Bicep (see reference_infra_deploy_gotcha memory). If the code deploy lands before
    // GOOGLE-OAUTH-TOKEN-ENCRYPTION-KEY exists in Key Vault AND this app setting is applied
    // (via `az deployment group create` or `az webapp config appsettings set`), the key is
    // absent, every encrypt() fail-closes, and the 15-min Google Sheets poller
    // (GoogleSheetPollingJob) starts failing sync for EVERY already-connected couple on
    // their next token refresh -- a live feature going dark, not a new one failing to turn
    // on. Create the Key Vault secret and apply this app setting BEFORE OR IN THE SAME
    // DEPLOY WINDOW as the backend JAR that references it.
    name: 'GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY'
    value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=GOOGLE-OAUTH-TOKEN-ENCRYPTION-KEY)'
  }
  {
    name: 'LOB_API_KEY'
    value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=LOB-API-KEY)'
  }
  {
    // Issue #52: signs Lob's mail-piece lifecycle webhooks (LobWebhookVerifier). Until set,
    // the webhook fails closed (rejects all events) rather than trusting an unsigned
    // delivery-status update, same reasoning as RESEND_WEBHOOK_SECRET above. Jordan must
    // configure the webhook URL in Lob's dashboard and set this Key Vault secret before
    // delivery status will populate.
    name: 'LOB_WEBHOOK_SECRET'
    value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=LOB-WEBHOOK-SECRET)'
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
    // Issue #370 pricing ladder: Premium tier Stripe price ids. Deliberately EMPTY (not a Key
    // Vault reference) until Jordan creates the Premium product/prices in the Stripe dashboard:
    // an unresolved Key Vault reference would surface the literal reference string as the env
    // var value, which the backend would treat as a configured (garbage) price id and the UI
    // would render a Premium tier whose checkout can only fail. Blank keeps the tier fully
    // hidden (backend allow-list fails closed, subscription page never renders the tier), so
    // prod behavior is unchanged until launch. To launch: create the Key Vault secrets
    // STRIPE-PRICE-PREMIUM-MONTHLY / STRIPE-PRICE-PREMIUM-ANNUAL, then replace these values
    // with Key Vault references matching STRIPE_PRICE_PRO_MONTHLY above.
    name: 'STRIPE_PRICE_PREMIUM_MONTHLY'
    value: ''
  }
  {
    name: 'STRIPE_PRICE_PREMIUM_ANNUAL'
    value: ''
  }
  {
    // Vendor comp promo code. Not a secret (shared with friends/first vendors), so a plain
    // value, not a Key Vault reference. Change here (or override the app setting) to rotate.
    // application.yml defaults this to FREEVENDOR, so the feature is live even before infra apply.
    name: 'VENDOR_PROMO_CODE'
    value: 'FREEVENDOR'
  }
  {
    // Founding vendor program: first N verified vendors get auto-verified for a free period.
    // Set to 0 to close the program. application.yml defaults: cap=25, period=12 months.
    name: 'VENDOR_FOUNDING_CAP'
    value: '25'
  }
  {
    name: 'VENDOR_FOUNDING_PERIOD_MONTHS'
    value: '12'
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
    name: 'RESEND_INVITES_FROM_EMAIL'
    value: resendInvitesFromEmail
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

// Shared site config for the production site and the staging slot. Identical config
// is what makes a slot swap a true zero-downtime cutover: the slot is a warm,
// production-identical copy that you deploy the new JAR to, health-check, then swap.
var siteConfig = {
  linuxFxVersion: 'JAVA|21-java21'
  alwaysOn: true
  ftpsState: 'Disabled'
  minTlsVersion: '1.2'
  appSettings: appSettings
}

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
    siteConfig: siteConfig
  }
}

// Staging deployment slot (PremiumV3 allows up to 20 slots; we provision one
// staging slot). This is the
// zero-downtime deploy primitive: publish the new JAR here, let it warm up and pass
// a health check, then swap staging <-> production so live traffic never hits a cold
// or half-started JVM. A crash or bad build stays contained on the slot instead of
// taking prod down mid-campaign, and a swap-back is the instant rollback.
//
// The slot shares the plan (serverFarmId: planId), so it does NOT add its own
// instance and does NOT multiply the in-memory rate limiter / Resend pacer while it
// sits idle; that multiplication only happens when plan capacity itself rises past
// 1, which is gated on issue #109 (see app-service-plan.bicep).
//
// The slot has its own SystemAssigned identity (a distinct principal from prod), so
// it needs its own Key Vault Secrets User grant for the @Microsoft.KeyVault(...)
// references above to resolve. That grant is wired in main.bicep via a second
// keyvault-access module against slotPrincipalId; without it the slot starts but
// every secret reference fails to resolve.
resource stagingSlot 'Microsoft.Web/sites/slots@2023-12-01' = {
  parent: appService
  name: 'staging'
  location: location
  identity: {
    type: 'SystemAssigned'  // distinct principal; granted KV access in main.bicep
  }
  properties: {
    serverFarmId: planId
    httpsOnly: true
    siteConfig: siteConfig
  }
}

output url string = 'https://${appService.properties.defaultHostName}'
output principalId string = appService.identity.principalId
output slotPrincipalId string = stagingSlot.identity.principalId
