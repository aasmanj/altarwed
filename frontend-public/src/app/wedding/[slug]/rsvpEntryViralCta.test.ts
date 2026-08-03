import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Source-level guards for issue #550. Two things must hold after the change:
// (1) the wedding RSVP entry page (the highest-traffic guest surface) carries a
//     discreet, always-reachable "Created on AltarWed" affordance tagged with its
//     own utm_campaign=rsvp-entry, and
// (2) every viral CTA anchor is instrumented through ViralCtaLink so a click fires
//     the consent-gated Meta Pixel Lead event with the surface tag. vitest runs in a
//     node environment here (no jsdom), so we assert on the load-bearing JSX.
function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

describe('wedding RSVP entry viral affordance (issue #550 item 2)', () => {
  const rsvpEntry = read('app/wedding/[slug]/rsvp/page.tsx')

  it('adds a discreet Created on AltarWed affordance near the RSVP entry', () => {
    expect(rsvpEntry).toContain('Created on AltarWed')
    expect(rsvpEntry).toContain('Make your own Christian wedding website for free')
  })

  it('tags the affordance with its own measurable campaign', () => {
    expect(rsvpEntry).toContain('utm_campaign=rsvp-entry')
    expect(rsvpEntry).toContain('source="rsvp-entry"')
  })

  it('routes the affordance through ViralCtaLink so the click is pixel-instrumented', () => {
    expect(rsvpEntry).toContain('ViralCtaLink')
  })

  it('uses no em dashes', () => {
    expect(rsvpEntry).not.toContain('—')
  })
})

describe('viral CTA pixel instrumentation wiring (issue #550 item 1)', () => {
  const footer = read('app/wedding/[slug]/layout.tsx')
  const rsvpForm = read('app/rsvp/[token]/RsvpForm.tsx')

  it('instruments the wedding footer CTA with the viral-footer source', () => {
    expect(footer).toContain('ViralCtaLink')
    expect(footer).toContain('source="viral-footer"')
    // The bare, uninstrumented anchor for this CTA must be gone.
    expect(footer).not.toMatch(/<a\s+href="https:\/\/app\.altarwed\.com\/register\?utm_source=wedding-site&utm_medium=referral&utm_campaign=viral-footer"/)
  })

  it('instruments the RSVP thank-you CTA with the rsvp-thankyou source', () => {
    expect(rsvpForm).toContain('ViralCtaLink')
    expect(rsvpForm).toContain('source="rsvp-thankyou"')
    // Preserve the existing href + copy so open PR #560 merges cleanly.
    expect(rsvpForm).toContain(
      'https://app.altarwed.com/register?utm_source=wedding-site&utm_medium=referral&utm_campaign=rsvp-thankyou',
    )
    expect(rsvpForm).toContain('Create your Christian wedding website for free')
  })
})
