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

// ── Log-based alerts on money / data-loss paths (issue #382) ─────────────────
// The metric alerts above only see exceptions and availability; a caught-and-logged
// Stripe or email failure never throws, so a wrong subscription state or a silently
// dropped email would page nobody. These query the App Insights `traces` table
// (logback via the Java agent; severityLevel 2=WARN, 3=ERROR) for the specific
// logger message prefixes the backend uses on those paths. Message prefixes are a
// contract with backend log statements ("stripe ...", "print order ...",
// "email outbox ..."); renaming those log messages must update these queries.
// Cost note: log alerts at 15-minute frequency bill ~USD 1.5/rule/month.

resource stripeFailureAlert 'Microsoft.Insights/scheduledQueryRules@2022-06-15' = {
  name: '${prefix}-stripe-failures'
  location: location
  properties: {
    description: 'Stripe adapter errors or webhook processing failures. A webhook failure can leave a vendor subscription in the wrong state with no user-visible symptom.'
    severity: 1
    enabled: true
    evaluationFrequency: 'PT15M'
    windowSize: 'PT15M'
    scopes: [ appInsights.id ]
    autoMitigate: true
    criteria: {
      allOf: [
        {
          // Adapter errors log at ERROR; webhook processing failures log at WARN
          // (the controller returns 200 to stop Stripe retries, so WARN is the
          // only trace of the loss). Invalid-signature WARNs are excluded: bots
          // posting garbage to the endpoint are noise, not a money-path failure.
          query: '''
traces
| where message startswith "stripe"
| where severityLevel >= 3 or message has "stripe webhook processing failed"
'''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [ actionGroup.id ]
    }
  }
}

resource printOrderFailureAlert 'Microsoft.Insights/scheduledQueryRules@2022-06-15' = {
  name: '${prefix}-print-order-failures'
  location: location
  properties: {
    description: 'Print order pipeline errors or Lob webhook processing failures. A failed batch or webhook means a couple paid for postcards that never mail.'
    severity: 1
    enabled: true
    evaluationFrequency: 'PT15M'
    windowSize: 'PT15M'
    scopes: [ appInsights.id ]
    autoMitigate: true
    criteria: {
      allOf: [
        {
          query: '''
traces
| where (message startswith "print order" and severityLevel >= 3)
    or message has "lob webhook processing failed"
'''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [ actionGroup.id ]
    }
  }
}

resource emailLossAlert 'Microsoft.Insights/scheduledQueryRules@2022-06-15' = {
  name: '${prefix}-email-loss'
  location: location
  properties: {
    description: 'Email outbox errors, exhausted retries, or Resend webhook failures. Each hit is an RSVP/invite email that was silently dropped or whose delivery state is now unknown.'
    severity: 2
    enabled: true
    evaluationFrequency: 'PT15M'
    windowSize: 'PT15M'
    scopes: [ appInsights.id ]
    autoMitigate: true
    criteria: {
      allOf: [
        {
          // "send exhausted" is WARN but terminal: the outbox row is out of
          // retries and the email is lost. Ordinary "will retry" WARNs are
          // excluded because the retry path handles them.
          query: '''
traces
| where (severityLevel >= 3 and (message startswith "email outbox" or message startswith "resend webhook"))
    or message has "email outbox send exhausted"
'''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [ actionGroup.id ]
    }
  }
}

// ── RSVP-path failures (issue #553) ──────────────────────────────────────────
// Jordan's invitations mailed 2026-08-02, so a broken RSVP flow this week is a
// launch emergency, not a background metric. The existing metric alerts only fire
// on availability loss or exception-rate >20/15min; a deterministic per-guest 500
// (one malformed token, one constraint the service check missed) repeats a handful
// of times and never crosses that global rate, so today it pages nobody.
//
// Signal: two ERROR trace messages the backend GlobalExceptionHandler emits for the
// only two failure modes that matter here -- "unhandled exception, exceptionType=..."
// (handleUnexpected, every catch-all 500) and "data integrity violation"
// (handleDataIntegrityViolation, a DB constraint that slipped past a service check).
// Those messages are global, so we correlate to the RSVP flow via operation_Name /
// url: the App Insights Java agent stamps every trace emitted during a request with
// that request's operation context, and the RSVP endpoints live under
// /api/v1/guests/rsvp. Message prefixes and the path are a contract with the backend;
// renaming either must update this query.
//
// Threshold is GreaterThanOrEqual 2 (not >0 like the money-path rules) precisely
// because a deterministic single-guest failure repeats: 2 in 15 min separates a real
// broken path from a lone transient blip, while still paging fast during the mail-out
// window. Severity 1 to page, same tier as the availability and money-path alerts.
//
// Not covered here on purpose: "email outbox send exhausted" (a lost RSVP-confirmation
// email) is already caught by the emailLossAlert rule above; duplicating it would
// double-page for one failure. This rule is only the RSVP request-path server errors.
//
// NOTE: like the #540 alert trio, this resource only exists in Azure after the next
// main.bicep apply (az deployment group create); that apply is tracked in PR #547's
// runbook. Adding it to Bicep does not create it in prod on its own.
resource rsvpFailureAlert 'Microsoft.Insights/scheduledQueryRules@2022-06-15' = {
  name: '${prefix}-rsvp-failures'
  location: location
  properties: {
    description: 'Server errors on the guest RSVP path (unhandled exception or data integrity violation traces correlated to /guests/rsvp). During the invitation mail-out window a broken RSVP flow must page immediately.'
    severity: 1
    enabled: true
    evaluationFrequency: 'PT15M'
    windowSize: 'PT15M'
    scopes: [ appInsights.id ]
    autoMitigate: true
    criteria: {
      allOf: [
        {
          query: '''
traces
| where operation_Name has "/guests/rsvp" or tostring(customDimensions.url) has "/guests/rsvp"
| where severityLevel >= 3
| where message startswith "unhandled exception" or message startswith "data integrity violation"
'''
          timeAggregation: 'Count'
          operator: 'GreaterThanOrEqual'
          threshold: 2
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [ actionGroup.id ]
    }
  }
}

output connectionString string = appInsights.properties.ConnectionString
output appInsightsName string = appInsights.name
output workspaceId string = workspace.id
