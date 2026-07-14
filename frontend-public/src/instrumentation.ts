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
    const appInsights = await import('applicationinsights');
    appInsights
      .setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
      .setSendLiveMetrics(false)
      .start();
  }
}
