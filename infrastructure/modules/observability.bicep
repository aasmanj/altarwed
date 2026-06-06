// Observability: Log Analytics workspace + workspace-based Application Insights,
// an action group that emails the founder, and two metric alerts (availability +
// exception rate). Classic (non-workspace) App Insights is retired, so this uses
// the workspace-based model. The App Insights Java 3.x agent on App Service parses
// our logback MDC fields (requestId etc.) into searchable columns automatically.

param prefix string            // e.g. altarwed-prod
param location string
param alertEmail string        // founder email for the action group
param apiBaseUrl string        // https host of the API, for the availability ping
param sqlDatabaseId string     // resource id of the Azure SQL database, for the DTU alert

// ── Log Analytics workspace (the data store App Insights writes to) ──────────
resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${prefix}-logs'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

// ── Application Insights (workspace-based) ───────────────────────────────────
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${prefix}-insights'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: workspace.id
    IngestionMode: 'LogAnalytics'
  }
}

// ── Action group: email the founder on any alert ─────────────────────────────
resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: '${prefix}-alerts'
  location: 'global'
  properties: {
    groupShortName: 'altarwed'
    enabled: true
    emailReceivers: [
      {
        name: 'founder'
        emailAddress: alertEmail
        useCommonAlertSchema: true
      }
    ]
  }
}

// ── Availability: standard ping against the health endpoint ──────────────────
// /actuator/health is whitelisted and exposes liveness. Pinged every 5 min from
// three US regions; alert fires when 2+ locations fail.
resource availabilityTest 'Microsoft.Insights/webtests@2022-06-15' = {
  name: '${prefix}-health'
  location: location
  kind: 'standard'
  tags: {
    // Links the test to the App Insights component in the portal. The value must
    // be literally 'Resource'; the key embeds the component resource id.
    'hidden-link:${appInsights.id}': 'Resource'
  }
  properties: {
    SyntheticMonitorId: '${prefix}-health'
    Name: 'API health'
    Enabled: true
    Frequency: 300
    Timeout: 30
    Kind: 'standard'
    RetryEnabled: true
    Locations: [
      { Id: 'us-il-ch1-azr' }
      { Id: 'us-ca-sjc-azr' }
      { Id: 'us-tx-sn1-azr' }
    ]
    Request: {
      RequestUrl: '${apiBaseUrl}/actuator/health'
      HttpVerb: 'GET'
    }
    ValidationRules: {
      ExpectedHttpStatusCode: 200
      SSLCheck: true
      SSLCertRemainingLifetimeCheck: 7
    }
  }
}

resource availabilityAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${prefix}-availability'
  location: 'global'
  properties: {
    description: 'API health endpoint availability dropped (2+ locations failing).'
    severity: 1
    enabled: true
    scopes: [ availabilityTest.id, appInsights.id ]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.WebtestLocationAvailabilityCriteria'
      webTestId: availabilityTest.id
      componentId: appInsights.id
      failedLocationCount: 2
    }
    actions: [
      { actionGroupId: actionGroup.id }
    ]
  }
}

// ── Exception rate: server-side exceptions over a rolling window ──────────────
resource exceptionAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${prefix}-exception-rate'
  location: 'global'
  properties: {
    description: 'Server exception count exceeded threshold over 15 minutes.'
    severity: 2
    enabled: true
    scopes: [ appInsights.id ]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'Exceptions'
          metricNamespace: 'microsoft.insights/components'
          metricName: 'exceptions/count'
          operator: 'GreaterThan'
          threshold: 20
          timeAggregation: 'Count'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      { actionGroupId: actionGroup.id }
    ]
  }
}

// ── SQL DTU utilization: warn before the database tier saturates ─────────────
// On S2 (50 DTU) the saturation headroom is thin. Alert when average DTU sits high
// over 30 minutes (sustained, not a brief spike) so there is time to scale the
// tier (an online operation) before couples feel it. Tune threshold/window as real
// load is observed; raise the threshold once on a larger tier.
resource sqlDtuAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${prefix}-sql-dtu'
  location: 'global'
  properties: {
    description: 'Azure SQL DTU consumption sustained high; consider scaling the tier.'
    severity: 2
    enabled: true
    scopes: [ sqlDatabaseId ]
    evaluationFrequency: 'PT15M'
    windowSize: 'PT30M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'DtuConsumption'
          metricNamespace: 'Microsoft.Sql/servers/databases'
          metricName: 'dtu_consumption_percent'
          operator: 'GreaterThan'
          threshold: 80
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      { actionGroupId: actionGroup.id }
    ]
  }
}

output connectionString string = appInsights.properties.ConnectionString
output appInsightsName string = appInsights.name
output workspaceId string = workspace.id
