// Azure Front Door Standard fronting public media (issues #246 / #375).
//
// ADOPTS the existing portal-created profile 'altarwed-cdn'. Every resource name
// below matches the deployed resource exactly (including the '-82d1' suffix Azure
// generated for the custom domain), so an incremental deployment updates the
// resources in place instead of creating duplicates. This closes the IaC drift
// where the profile existed in Azure but nowhere in this repo.
//
// The ONE intentional change from the deployed state: cacheConfiguration on the
// route. As deployed, caching was disabled (X-Cache: CONFIG_NOCACHE on every
// response), which paid the AFD base fee (~USD 35/month) for a pass-through proxy
// with zero edge value. With caching on, guest image views are served from the
// edge and Azure bills origin egress on cache misses only.
//
// Trade-off vs Cloudflare free (see docs/DECISION-cdn-front-door.md): AFD costs a
// base fee but lives in IaC, gives health probes now and a managed WAF later, and
// was already purchased and domain-validated when this module was written.
// Deleting it to save the fee would have traded tracked infrastructure for
// dashboard click-ops.

@description('Front Door profile name; must match the deployed profile to adopt it')
param profileName string = 'altarwed-cdn'

@description('Endpoint name; must match the deployed endpoint')
param endpointName string = 'altarwed-media'

@description('Origin hostname (the public blob storage account)')
param originHost string

@description('Custom domain that fronts the origin')
param customDomainHost string = 'media.altarwed.com'

resource profile 'Microsoft.Cdn/profiles@2024-02-01' = {
  name: profileName
  location: 'Global'
  sku: {
    name: 'Standard_AzureFrontDoor'
  }
  properties: {
    originResponseTimeoutSeconds: 60
  }
}

resource endpoint 'Microsoft.Cdn/profiles/afdEndpoints@2024-02-01' = {
  parent: profile
  name: endpointName
  location: 'Global'
  properties: {
    enabledState: 'Enabled'
  }
}

resource originGroup 'Microsoft.Cdn/profiles/originGroups@2024-02-01' = {
  parent: profile
  name: 'default-origin-group'
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    healthProbeSettings: {
      // Probe a real, always-present sentinel blob over HTTPS. The previous probe
      // (HEAD / over plain HTTP) hit the storage account root, which returns 400
      // (no container in the path), and with secure-transfer-required the HTTP
      // probe fails outright, so the only origin sat permanently "unhealthy" and
      // the health signal was noise. Upload the sentinel ONCE before applying:
      //   az storage blob upload --account-name altarwedprodstorage \
      //     -c altarwed-media -n healthz.txt --data 'ok' --overwrite
      probePath: '/altarwed-media/healthz.txt'
      probeRequestType: 'HEAD'
      probeProtocol: 'Https'
      probeIntervalInSeconds: 100
    }
    sessionAffinityState: 'Disabled'
  }
}

resource origin 'Microsoft.Cdn/profiles/originGroups/origins@2024-02-01' = {
  parent: originGroup
  name: 'default-origin'
  properties: {
    hostName: originHost
    originHostHeader: originHost
    httpPort: 80
    httpsPort: 443
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
    enforceCertificateNameCheck: true
  }
}

resource customDomain 'Microsoft.Cdn/profiles/customDomains@2024-02-01' = {
  parent: profile
  name: 'media-altarwed-com-82d1'
  properties: {
    hostName: customDomainHost
    tlsSettings: {
      certificateType: 'ManagedCertificate'
      minimumTlsVersion: 'TLS12'
    }
  }
}

resource route 'Microsoft.Cdn/profiles/afdEndpoints/routes@2024-02-01' = {
  parent: endpoint
  name: 'default-route'
  properties: {
    customDomains: [
      {
        id: customDomain.id
      }
    ]
    originGroup: {
      id: originGroup.id
    }
    supportedProtocols: [
      'Http'
      'Https'
    ]
    patternsToMatch: [
      '/*'
    ]
    forwardingProtocol: 'MatchRequest'
    linkToDefaultDomain: 'Enabled'
    httpsRedirect: 'Enabled'
    enabledState: 'Enabled'
    // The whole point of the profile. Blob storage sends no Cache-Control by
    // default, so Front Door applies its own default edge TTL; uploads write to
    // unique blob paths, so long edge lifetimes are safe. If a blob is ever
    // overwritten in place, purge with:
    //   az afd endpoint purge -g altarwed-rg --profile-name altarwed-cdn \
    //     --endpoint-name altarwed-media --content-paths '/*'
    // IgnoreQueryString: blob URLs carry no meaningful query params, so one cache
    // entry per path maximizes hit rate. Compression only helps text-like types;
    // JPEG/PNG/WebP are already compressed and are excluded on purpose.
    // COUPLING (security review, 2026-08-03): IgnoreQueryString is safe ONLY
    // while the blob container stays anonymous-read with unguessable UUID paths.
    // If media ever moves to per-file SAS-token URLs, this setting caches one
    // caller's authorized blob under the bare path and serves it to everyone,
    // and strips the SAS from origin fetches. Change to UseQueryString in the
    // same PR that introduces SAS, or the cache leaks authorized content.
    cacheConfiguration: {
      queryStringCachingBehavior: 'IgnoreQueryString'
      compressionSettings: {
        isCompressionEnabled: true
        contentTypesToCompress: [
          'application/javascript'
          'application/json'
          'application/xml'
          'image/svg+xml'
          'text/css'
          'text/html'
          'text/plain'
        ]
      }
    }
  }
}

output endpointHostName string = endpoint.properties.hostName
