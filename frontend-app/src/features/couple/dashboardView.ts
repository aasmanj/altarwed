// Single source of truth for what the couple dashboard renders after querying
// the couple's wedding website. Extracted from CoupleDashboard so the decision
// is unit-testable in the repo's node-env test setup (no jsdom / render tree).
//
// Why this exists (issue #240): the old inline gate only routed a 404 to the
// onboarding wizard. A successful load that resolved with no website record
// (null/undefined, e.g. a response-shape change) fell through to a half-empty
// dashboard, which is the worst place to strand a brand-new couple at their
// activation moment. The rules below make every state explicit and auditable.

export type DashboardView = 'loading' | 'onboarding' | 'error' | 'dashboard'

export interface DashboardGateInput {
  // The website query is still in flight. We must decide nothing yet: returning
  // any non-loading view here is exactly what makes the wizard flash before the
  // real answer arrives.
  isLoading: boolean
  // The query failed with HTTP 404: the couple has genuinely never created a
  // website, so onboarding is correct.
  isNotFound: boolean
  // The query failed with a non-404 error (5xx / network). This is transient and
  // ambiguous: we do not know whether a website exists, so we must not sweep an
  // established couple into onboarding because the API hiccuped.
  hasError: boolean
  // A website record came back on a successful load.
  hasWebsite: boolean
}

// Precedence matters, and it is deliberately data-wins:
//   1. isLoading  -> 'loading'   nothing else can win while the request is pending,
//                                so the wizard can never flash mid-fetch.
//   2. hasWebsite -> 'dashboard' if we hold a website record (e.g. cached data),
//                                show the dashboard even if a background refetch is
//                                currently throwing. An established couple must never
//                                be knocked into an error/onboarding view by a
//                                transient hiccup over data we already have.
//   3. isNotFound -> 'onboarding' a genuine 404 with no data: never created a site.
//   4. hasError   -> 'error'     any other failure with no data to fall back on.
//   5. else       -> 'onboarding' clean load, no record: the null-but-not-404 case
//                                (issue #240) that used to fall through to a
//                                half-empty dashboard.
export function resolveDashboardView({
  isLoading,
  isNotFound,
  hasError,
  hasWebsite,
}: DashboardGateInput): DashboardView {
  if (isLoading) return 'loading'
  if (hasWebsite) return 'dashboard'
  if (isNotFound) return 'onboarding'
  if (hasError) return 'error'
  return 'onboarding'
}
