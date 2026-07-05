import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { shouldSkeletonGuestStats } from './GuestListPage'

// Behavioral guard for issue #309(B): computeGuestStats runs against the
// `guests = []` default while the query is still loading, so the Total /
// Attending / Declined / Pending cards rendered real-looking 0s and then popped
// to the true counts. The fix gates the numbers on the loading state and shows
// a motion-safe pulse skeleton instead. vitest runs in a node environment here
// (no jsdom / testing-library), so we assert on the pure predicate plus the
// load-bearing JSX wiring. Each assertion fails on the pre-fix source and passes
// after, which is the contract for this fix.
function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

describe('guest stat cards loading skeleton (#309B)', () => {
  it('skeletons the stat row while the guest query is loading', () => {
    expect(shouldSkeletonGuestStats(true)).toBe(true)
  })

  it('shows the real numbers once loading completes', () => {
    expect(shouldSkeletonGuestStats(false)).toBe(false)
  })

  it('wires the skeleton branch and motion-safe pulse into GuestListPage', () => {
    const src = read('features/couple/guests/GuestListPage.tsx')
    // The stat row branches on the loading predicate before rendering numbers.
    expect(src).toContain('shouldSkeletonGuestStats(isLoading)')
    // Skeleton placeholders use a motion-safe pulse (respects reduced motion).
    expect(src).toContain('motion-safe:animate-pulse')
    // The same four labels render in both branches so there is no layout shift.
    expect(src).toContain("const GUEST_STAT_LABELS = ['Total', 'Attending', 'Declined', 'Pending'] as const")
  })
})
