// Wires Application Insights into the Next.js SSR server so unhandled server-side
// exceptions and requests flow to the altarwed-prod-insights instance (issue #422).
//
// Azure Static Web Apps does NOT auto-instrument Next.js the way Azure App Service
// auto-instruments the Java backend (App Service runs a codeless App Insights agent;
// SWA has no equivalent), so the SDK must be started in code. Next.js calls register()
// once when the server process boots.
//
// The connection string is injected as a runtime SWA app setting, not committed here
// (see infrastructure/RUNBOOK-frontend-observability.md). When it is absent (local dev,
// preview builds, the CI boot smoke gate) this is a clean no-op, so nothing crashes and
// no telemetry is sent.
export async function register() {
  if (
    process.env.NEXT_RUNTIME === 'nodejs' &&
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING
  ) {
    // We use the package's v3 API (useAzureMonitor) instead of the v2 shim
    // (setup().start()) because the shim gives no way to set the cloud role name:
    //
    // - The classic v2 write `client.context.tags[cloudRole] = ...` is a silent no-op
    //   in v3 (verified against prod: 10 days of telemetry, zero rows under the
    //   intended role).
    // - OTEL_SERVICE_NAME does not work either: the SDK's Azure resource detector
    //   sets service.name from WEBSITE_SITE_NAME (the SWA's internal
    //   `staticwebapps-<guid>` name) and is merged AFTER the env resource, so the
    //   env var loses.
    //
    // The only thing that outranks the detectors is an explicit `resource` in the
    // options, which is also Microsoft's documented way to set the role on the
    // OpenTelemetry-based SDK. We keep the applicationinsights package (rather than
    // calling @azure/monitor-opentelemetry directly) because its useAzureMonitor
    // wrapper is what adds uncaught-exception and console-log auto-collection, the
    // telemetry #422 exists for.
    const { useAzureMonitor } = await import('applicationinsights');
    const { resourceFromAttributes } = await import('@opentelemetry/resources');
    const { ATTR_SERVICE_NAME } = await import('@opentelemetry/semantic-conventions');
    // The `use` prefix is Azure SDK naming, not a React hook; this runs once in the
    // Node SSR runtime, so the rules-of-hooks lint does not apply.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAzureMonitor({
      azureMonitorExporterOptions: {
        connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
      },
      enableLiveMetrics: false,
      // Labels this app's telemetry `altarwed-landing` so it is legible alongside
      // the `altarwed-prod-api` backend role.
      resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: 'altarwed-landing' }),
    });
  }
}
