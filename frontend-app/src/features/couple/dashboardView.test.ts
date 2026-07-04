import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { resolveDashboardView } from './dashboardView'

// Regression guard for issue #240: the couple dashboard used to route to the
// onboarding wizard only on a 404. A successful load that resolved with no
// website record fell through to a half-empty dashboard, and (separately) there
// was no guard keeping the wizard from flashing mid-fetch. vitest runs in a node
// environment here (no jsdom / testing-library), so the behavior is verified via
// the pure gate function plus a source-level assertion that CoupleDashboard wires
// it correctly. Each case below fails on the pre-fix inline gate and passes now.
function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

describe('resolveDashboardView state matrix (#240)', () => {
  it('renders the loading view (never the wizard) while the query is in flight', () => {
    // The pre-fix bug scenario for a flash: no data yet, but if the gate keyed
    // off "no website" it would show onboarding before the answer arrives.
    expect(
      resolveDashboardView({ isLoading: true, isNotFound: false, hasError: false, hasWebsite: false }),
    ).toBe('loading')
  })

  it('does not flash the wizard even if a transient error shape arrives mid-fetch', () => {
    // isLoading wins over every other signal, including a stale error object.
    expect(
      resolveDashboardView({ isLoading: true, isNotFound: true, hasError: true, hasWebsite: false }),
    ).toBe('loading')
  })

  it('shows the onboarding wizard on a 404 (couple never created a website)', () => {
    expect(
      resolveDashboardView({ isLoading: false, isNotFound: true, hasError: false, hasWebsite: false }),
    ).toBe('onboarding')
  })

  it('shows the onboarding wizard on a successful load that resolved with no website (the #240 bug)', () => {
    // This is the exact case that previously fell through to a half-empty
    // dashboard: clean load, no 404, no error, but no website record.
    expect(
      resolveDashboardView({ isLoading: false, isNotFound: false, hasError: false, hasWebsite: false }),
    ).toBe('onboarding')
  })

  it('shows the dashboard when a website record is present', () => {
    expect(
      resolveDashboardView({ isLoading: false, isNotFound: false, hasError: false, hasWebsite: true }),
    ).toBe('dashboard')
  })

  it('shows the error state (NOT the wizard) on a transient 5xx / network error', () => {
    // An established couple whose website exists must not be swept into
    // onboarding because the API hiccuped. hasWebsite is false here only because
    // the failed query has no data, which is precisely why we must not onboard.
    expect(
      resolveDashboardView({ isLoading: false, isNotFound: false, hasError: true, hasWebsite: false }),
    ).toBe('error')
  })

  it('never returns onboarding for a non-404 error regardless of the hasWebsite flag', () => {
    const withData = resolveDashboardView({ isLoading: false, isNotFound: false, hasError: true, hasWebsite: true })
    const withoutData = resolveDashboardView({ isLoading: false, isNotFound: false, hasError: true, hasWebsite: false })
    expect(withData).not.toBe('onboarding')
    expect(withoutData).not.toBe('onboarding')
    expect(withData).toBe('error')
    expect(withoutData).toBe('error')
  })
})

describe('CoupleDashboard wires the gate (#240)', () => {
  const src = read('features/couple/CoupleDashboard.tsx')

  it('routes onboarding through resolveDashboardView, not an inline 404-only check', () => {
    expect(src).toContain("import { resolveDashboardView } from '@/features/couple/dashboardView'")
    expect(src).toContain('const view = resolveDashboardView({')
    expect(src).toContain("if (view === 'onboarding') {")
  })

  it('feeds a non-404 error into hasError so a transient error never onboards', () => {
    expect(src).toContain('hasError: Boolean(siteError) && !isNotFound')
  })

  it('drives the wizard off the gate result, not the raw not-found flag', () => {
    // The old code returned <OnboardingWizard /> guarded by `if (isNotFound)`.
    // That inner 404-only return is what this fix removes.
    expect(src).not.toContain('if (isNotFound) return <OnboardingWizard />')
  })
})
