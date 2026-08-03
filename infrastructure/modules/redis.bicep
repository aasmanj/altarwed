// Azure Cache for Redis for cross-instance shared state (issues #109 / #414 / #376).
//
// Backs the Bucket4j rate-limit buckets, the RSVP find-invitation throttle, and
// the Google OAuth CSRF state store (PR #454) so that running more than one App
// Service instance no longer multiplies rate limits or breaks OAuth callbacks.
//
// SKU choice: Basic C0 (~USD 16/month). Basic has no replica and no SLA, which is
// acceptable here ON PURPOSE: everything stored is ephemeral throttle/CSRF state.
// If the cache restarts, buckets refill and in-flight OAuth handshakes retry;
// nothing durable is lost. Upgrade to Standard C0 (adds a replica + SLA) only if
// cache restarts observably degrade rate limiting in prod.
//
// This module also writes the REDIS-URL secret into Key Vault, so the app-service
// module's @Microsoft.KeyVault(...) reference for REDIS_URL always resolves and
// the access key never appears in template parameters or outputs.

param name string
param location string

@description('Key Vault that receives the REDIS-URL connection secret')
param keyVaultName string

@description('''App Service outbound IPs allowed through the Redis firewall. Basic tier cannot
VNet-inject, so IP firewall rules are the only network control: the moment ANY rule exists,
Azure denies every other public IP, closing the internet-reachable-key-only exposure flagged in
the 2026-08-03 security review. Populate from:
  az webapp show -g altarwed-rg -n altarwed-prod-api --query possibleOutboundIpAddresses -o tsv
then split on commas. Left empty the cache stays open to the internet (key-only), so treat the
two-phase apply (deploy, fetch IPs, redeploy with this set) as part of the Redis cutover.
NOTE: the outbound IP SET CHANGES when the plan tier changes (B2 to P1v3), so refresh this
parameter and re-apply after any planSku change or the app loses Redis connectivity.''')
param allowedClientIps array = []

resource redis 'Microsoft.Cache/redis@2024-03-01' = {
  name: name
  location: location
  properties: {
    sku: {
      name: 'Basic'
      family: 'C'
      capacity: 0
    }
    // TLS only: the connection URL uses rediss:// on 6380; the plaintext 6379
    // port stays closed.
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
  }
}

// One allow rule per App Service outbound IP; see the allowedClientIps description
// for why this exists and how to populate it. Rule names must be alphanumeric.
resource firewallRules 'Microsoft.Cache/redis/firewallRules@2024-03-01' = [for (ip, i) in allowedClientIps: {
  parent: redis
  name: 'appservice${i}'
  properties: {
    startIP: ip
    endIP: ip
  }
}]

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

// rediss://:{access-key}@{host}:6380/0, the exact shape RedisSharedStateConfig
// expects in REDIS_URL (see backend application.yml `altarwed.redis.url`).
resource redisUrlSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kv
  name: 'REDIS-URL'
  properties: {
    value: 'rediss://:${redis.listKeys().primaryKey}@${redis.properties.hostName}:6380/0'
  }
}

output hostName string = redis.properties.hostName
