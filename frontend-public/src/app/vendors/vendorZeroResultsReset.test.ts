import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Source-level guard for issue #229 (vendor directory zero-results is a dead
// end). vitest runs in a plain node environment here (no jsdom /
// testing-library), matching the other frontend-public tests, so we assert on
// the load-bearing markup of the file the fix touches rather than rendering.
//
// Before the fix the zero-results branch always rendered "No vendors listed yet
// in this area" plus only the vendor-signup CTA. A couple who filtered to
// Florist + a small city hit a dead end: no way to tell which filters were
// active and no one-click reset, so they concluded the directory was empty and
// left. The fix splits the branch: when filters are active it names them, softens
// the copy, and adds a "Clear all filters" link back to the unfiltered /vendors;
// when no filters are active it keeps the genuine empty-directory copy.
function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

describe('Vendor directory zero-results offers a clear-filters reset (#229)', () => {
  const src = read('app/vendors/page.tsx')

  it('branches the zero-results state on whether filters are active', () => {
    // The fix distinguishes a filter miss from a genuinely empty directory.
    expect(src).toContain('const hasActiveFilters = activeFilters.length > 0')
    expect(src).toContain('total === 0 ? (')
    expect(src).toContain('hasActiveFilters ? (')
  })

  it('collects the active category, city, and price filters for display', () => {
    expect(src).toContain('if (category) activeFilters.push(CATEGORY_LABELS[category] ?? category)')
    expect(src).toContain('if (city) activeFilters.push(`"${city}"`)')
    expect(src).toContain('if (tier) activeFilters.push(`Price ${tier}`)')
    // The active filters are surfaced to the visitor, not just computed.
    expect(src).toContain('{activeFilters.join(\', \')}')
  })

  it('softens the copy for a filter miss instead of implying no vendors exist', () => {
    expect(src).toContain('No vendors match these filters yet.')
  })

  it('renders a one-click reset back to the unfiltered directory', () => {
    // The reset drops every query param by linking to the bare /vendors route.
    const filterBranch = src.slice(src.indexOf('No vendors match these filters yet.'))
    const clearIndex = filterBranch.indexOf('Clear all filters')
    const resetHref = filterBranch.indexOf('href="/vendors"')
    expect(clearIndex).toBeGreaterThan(-1)
    expect(resetHref).toBeGreaterThan(-1)
    expect(resetHref).toBeLessThan(clearIndex)
  })

  it('keeps the vendor-signup CTA as a secondary action in the filter-miss state', () => {
    const filterBranch = src.slice(
      src.indexOf('No vendors match these filters yet.'),
      src.indexOf('No vendors listed yet'),
    )
    expect(filterBranch).toContain('https://app.altarwed.com/register/vendor')
    // The signup CTA sits after the reset action, keeping it secondary.
    expect(filterBranch.indexOf('Clear all filters'))
      .toBeLessThan(filterBranch.indexOf('List your business'))
  })

  it('keeps genuine empty-directory copy when no filters are active', () => {
    expect(src).toContain('No vendors listed yet')
  })
})
