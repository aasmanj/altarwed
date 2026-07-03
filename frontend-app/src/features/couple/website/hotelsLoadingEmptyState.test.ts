import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { shouldShowNoHotelsEmptyState } from './HotelTab'

// Behavioral guard for issue #187: the Travel drawer section must not flash "No
// hotels added yet" while the hotels query is still loading (the array defaults
// to [] before the request resolves, so an empty array on its own is
// ambiguous). vitest runs in a node environment here (no jsdom /
// testing-library), so we assert on the pure decision predicate plus the
// load-bearing JSX wiring. Each assertion fails on the pre-fix source and
// passes after, which is the contract for this fix.
function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

describe('hotels loading empty-state gating (#187)', () => {
  it('does NOT show the empty state while loading, even with an empty array', () => {
    // isLoading true, array still empty (the pre-fix bug scenario).
    expect(shouldShowNoHotelsEmptyState(0, true, false)).toBe(false)
  })

  it('DOES show the empty state once loading completes with a genuinely empty array', () => {
    expect(shouldShowNoHotelsEmptyState(0, false, false)).toBe(true)
  })

  it('never shows the empty state when hotels exist', () => {
    expect(shouldShowNoHotelsEmptyState(2, false, false)).toBe(false)
    expect(shouldShowNoHotelsEmptyState(2, true, false)).toBe(false)
  })

  it('never shows the empty state while the couple is adding their first hotel', () => {
    // editingId === 'new' -> isAddingNew true: the add form is shown instead.
    expect(shouldShowNoHotelsEmptyState(0, false, true)).toBe(false)
  })

  it('gates the empty state on the loading-aware predicate in HotelTab', () => {
    const src = read('features/couple/website/HotelTab.tsx')
    // The empty-state copy is rendered only via the predicate, and a distinct
    // loading branch covers the pending state.
    expect(src).toContain('shouldShowNoHotelsEmptyState(hotels.length, isLoading, editingId === \'new\')')
    expect(src).toContain('No hotels added yet.')
    expect(src).toContain('Loading hotels…')
  })

  it('wires isLoading from useHotels into HotelTab in the travel drawer section', () => {
    // Issue #181: the classic editor (a second call site here) was retired;
    // the page-builder's travel drawer is now the only place HotelTab is used.
    const drawer = read('features/couple/website/blocks/WebsiteSectionDrawer.tsx')
    expect(drawer).toContain('isLoading: hotelsLoading } = useHotels(websiteId)')
    expect(drawer).toContain('isLoading={hotelsLoading}')
  })
})
