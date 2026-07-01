import { describe, it, expect } from 'vitest'
import { formatWeddingDate, formatShortDate } from './date'

// Issue #111 routed SaveTheDatePage and the CommunicationsPage postcard preview through these
// helpers instead of `new Date(str + 'T12:00:00')`. These assertions lock the exact output each
// surface renders so a future edit cannot silently change the format or reintroduce the
// timezone off-by-one that raw `new Date('YYYY-MM-DD')` causes in negative-UTC-offset zones.
describe('formatShortDate', () => {
  it('renders "Month D, YYYY" with no weekday, matching the printed postcard (MMMM d, yyyy)', () => {
    expect(formatShortDate('2027-06-05')).toBe('June 5, 2027')
  })

  it('parses a YYYY-MM-DD string as local noon so the day never rolls backward', () => {
    // A naive `new Date('2027-01-01')` is UTC midnight, which is Dec 31 in the Americas.
    expect(formatShortDate('2027-01-01')).toBe('January 1, 2027')
  })
})

describe('formatWeddingDate', () => {
  it('renders the long weekday form used by the save-the-date email preview', () => {
    expect(formatWeddingDate('2027-06-05')).toMatch(
      /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday), June 5, 2027$/,
    )
  })
})
