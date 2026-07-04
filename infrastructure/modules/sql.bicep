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
  // Standard S3 (100 DTU). Basic (5 DTU / 2 GB) was a hard launch ceiling. S2 (50
  // DTU) carried the single-instance launch, but scaling the App Service plan past
  // one instance changes the math on the database side and forces this bump.
  //
  // HIKARI SESSION MATH (why S3 pairs with scale-out): each backend instance opens
  // its own HikariCP pool of 20 connections (application.yml maximum-pool-size: 20),
  // and every pooled connection is a live SQL session. Connections are PER INSTANCE
  // and do not coordinate, so total held sessions = 20 x instanceCount. At the
  // autoscale ceiling of 3 instances that is 60 sessions, all of which can be
  // executing at once. The DTU tier caps concurrent workers (in-flight requests),
  // not just sessions: S2 allows ~120 concurrent workers / 240 sessions, S3 lifts
  // that to ~200 workers / 400 sessions AND doubles the DTU budget (50 -> 100). The
  // binding constraint under scale-out is DTU throughput, not the session count:
  // 2-3 instances writing concurrently would queue on S2's 50-DTU budget long
  // before they exhaust sessions, so S3 buys the DTU headroom that keeps those
  // pooled connections from starving each other. Keep this in lockstep with the
  // plan capacity: raising instances without raising the DTU tier just moves the
  // bottleneck from CPU to the database.
  // Scaling up is an ONLINE operation (brief failover): when the DTU-utilization
  // metric sits above ~75-80%, bump S3 (100) -> S4 (200); past that, migrate to the
  // vCore General Purpose model -> Hyperscale for the millions endgame.
  sku: {
    name: 'S3'
    tier: 'Standard'
    capacity: 100  // DTU
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
