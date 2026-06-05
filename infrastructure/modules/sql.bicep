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
  // Standard S2 (50 DTU). Basic (5 DTU / 2 GB) was a hard launch ceiling. S2 is the
  // disciplined pre-revenue choice: ~10x Basic at ~$75/mo, and with ISR caching
  // absorbing public reads (only revalidation queries hit SQL) it carries a quiet
  // launch comfortably. Always-on App Service means serverless auto-pause never
  // fires, so the DTU model is cheaper here than GP_Serverless.
  // Scaling up is an ONLINE operation (brief failover): when the DTU-utilization
  // metric sits above ~75-80%, bump S3 (100) -> S4 (200); past that, migrate to the
  // vCore General Purpose model -> Hyperscale for the millions endgame.
  sku: {
    name: 'S2'
    tier: 'Standard'
    capacity: 50  // DTU
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: 268435456000  // 250 GB (S2 storage ceiling; media lives in Blob, not SQL)
  }
}

var jdbcUrl = 'jdbc:sqlserver://${sqlServer.properties.fullyQualifiedDomainName}:1433;database=${databaseName};encrypt=true;trustServerCertificate=false;loginTimeout=30'

output serverFqdn string = sqlServer.properties.fullyQualifiedDomainName
output connectionString string = jdbcUrl
output databaseId string = database.id
