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

// Precedence matters: loading is checked first so nothing else can win while the
// request is pending, then the two failure shapes are separated (404 onboards,
// any other error shows the error state), and only a clean success decides
// between onboarding (no record) and the dashboard (record present).
export function resolveDashboardView({
  isLoading,
  isNotFound,
  hasError,
  hasWebsite,
}: DashboardGateInput): DashboardView {
  if (isLoading) return 'loading'
  if (isNotFound) return 'onboarding'
  if (hasError) return 'error'
  if (!hasWebsite) return 'onboarding'
  return 'dashboard'
}
