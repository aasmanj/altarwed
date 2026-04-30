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
  sku: {
    name: 'Basic'
    tier: 'Basic'
    capacity: 5
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: 2147483648  // 2 GB
  }
}

var jdbcUrl = 'jdbc:sqlserver://${sqlServer.properties.fullyQualifiedDomainName}:1433;database=${databaseName};encrypt=true;trustServerCertificate=false;loginTimeout=30'

output serverFqdn string = sqlServer.properties.fullyQualifiedDomainName
output connectionString string = jdbcUrl
