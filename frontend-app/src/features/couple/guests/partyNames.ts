import type { Guest } from './useGuests'

// Issue #238: the Party / household input is free text, so typing "The Smith
// Family" for one guest and "Smith Family" for the next silently creates two
// households that will not RSVP together. This helper feeds a <datalist> of the
// households that already exist in the loaded guest list, so picking an existing
// one is the natural gesture and a near-miss typo becomes visible (the couple
// sees the existing option in the dropdown). This is a suggestion, not a
// constraint: the input stays free text so a brand-new household can still be
// typed.
//
// Extracted as a pure function so the suggestion set is unit-testable in CI's
// node-environment vitest without rendering the component.
export function distinctPartyNames(guests: Guest[]): string[] {
  // Dedupe case-insensitively on the trimmed value so "Smith Family" and
  // "smith family" collapse to a single suggestion, while keeping the first
  // spelling the couple actually typed. Genuinely different strings
  // ("Smith Family" vs "The Smith Family") stay as separate options on purpose:
  // surfacing both side by side is exactly the signal that they diverged.
  const byKey = new Map<string, string>()
  for (const guest of guests) {
    const name = guest.partyName?.trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (!byKey.has(key)) byKey.set(key, name)
  }
  return [...byKey.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  )
}
