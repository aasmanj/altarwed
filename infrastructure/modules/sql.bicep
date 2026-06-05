param serverName string
param databaseName string
param location string
param adminUsername string
@secure()
param adminPassword string

resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' = {
  name: serverName
  location: location
  properties: {
    administratorLogin: adminUsername
    administratorLoginPassword: adminPassword
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
  }
}

// Allow Azure services (App Service) to reach the SQL server
resource allowAzureServices 'Microsoft.Sql/servers/firewallRules@2023-08-01-preview' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource database 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sqlServer
  name: databaseName
  location: location
  // Standard S3 (100 DTU). Basic (5 DTU / 2 GB) was a hard launch ceiling for the
  // "thousands of sites at launch" goal. S3 gives ~20x the throughput at a flat
  // ~$147/mo, and with ISR caching absorbing public reads it carries low-tens-of-
  // thousands of sites. Always-on App Service means serverless auto-pause never
  // fires, so the DTU model is cheaper here than GP_Serverless.
  // Upgrade path: S4 -> S6 -> S9 -> Premium -> Hyperscale (vCore) for the millions endgame.
  sku: {
    name: 'S3'
    tier: 'Standard'
    capacity: 100  // DTU
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: 268435456000  // 250 GB (S3 ceiling)
  }
}

var jdbcUrl = 'jdbc:sqlserver://${sqlServer.properties.fullyQualifiedDomainName}:1433;database=${databaseName};encrypt=true;trustServerCertificate=false;loginTimeout=30'

output serverFqdn string = sqlServer.properties.fullyQualifiedDomainName
output connectionString string = jdbcUrl
