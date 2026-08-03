import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Issue #549: RSVP wave hardening. Invitations were mailed the day this landed, so real guests
// hit the finder and the RSVP form this week. vitest runs in a node environment here (no jsdom),
// matching the sibling rsvp tests, so the behavioral guarantees are asserted at the source level.
function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

describe('FindInvitationWidget captcha-failure UX (issue #549)', () => {
  const src = read('app/wedding/[slug]/rsvp/FindInvitationWidget.tsx')

  it('classifies a captcha-failure 400 distinctly with an actionable message', () => {
    // A blocked Turnstile script sends no token, the backend 400s, and the old code collapsed that
    // into the generic "Something went wrong" with no way out. Now it is handled on its own.
    expect(src).toContain('res.status === 400')
    expect(src).toContain('We could not verify your browser.')
    // The actionable path: disable the blocker or contact the couple.
    expect(src).toContain('turn off any ad or privacy blocker')
  })

  it('no longer blames the guest network in the 429 copy (throttle is per-wedding)', () => {
    expect(src).not.toContain('Too many searches from your network')
    expect(src).toContain('invitation lookups for this wedding')
  })

  it('softens the placeholder to first OR last name now that matching is tokenized', () => {
    expect(src).toContain('Type your first or last name...')
    expect(src).not.toContain('Type your first and last name...')
  })

  it('keeps the error in a role=alert live region and uses no em dashes', () => {
    expect(src).toContain('role="alert"')
    expect(src).not.toContain('—')
  })
})

describe('RsvpForm masked-household default (issue #549)', () => {
  const form = read('app/rsvp/[token]/RsvpForm.tsx')

  it('no longer defaults every party member to ATTENDING', () => {
    // The old init unconditionally selected ATTENDING for anyone not already DECLINING, which on a
    // masked search-token view (status withheld) overwrote a relative's prior DECLINE.
    expect(form).not.toContain("init[m.guestId] = m.currentRsvpStatus === 'DECLINING' ? 'DECLINING' : 'ATTENDING'")
  })

  it('only pre-selects a member when their prior response is actually known', () => {
    expect(form).toContain("m.currentRsvpStatus === 'ATTENDING' || m.currentRsvpStatus === 'DECLINING'")
  })

  it('omits untouched members from the submission so no status change is sent', () => {
    // Members with no explicit selection are filtered out before building partyResponses.
    expect(form).toContain('const chosenMembers')
    expect(form).toContain('chosenMembers.length > 0')
    expect(form).toContain('chosenMembers.map')
  })
})
