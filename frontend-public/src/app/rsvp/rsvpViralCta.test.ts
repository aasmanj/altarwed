import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Source-level guards for issue #227 (viral CTA on the highest-intent guest surface).
// vitest runs in a node environment here (no jsdom / testing-library), matching the
// sibling rsvp tests, so we assert on the load-bearing JSX rather than rendering. A
// guest on a token RSVP link is a prime free lead (many are engaged themselves), so
// both the RSVP page footer and the post-submit done state must carry the tagged
// create-your-own CTA. Each assertion fails on the pre-fix source and passes after.
function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

const REGISTER_WITH_CAMPAIGN =
  'https://app.altarwed.com/register?utm_source=wedding-site&utm_medium=referral&utm_campaign=rsvp-thankyou'

describe('RSVP viral CTA (issue #227)', () => {
  const form = read('app/rsvp/[token]/RsvpForm.tsx')
  const page = read('app/rsvp/[token]/page.tsx')

  it('page footer replaces the bare "Powered by" with the tagged CTA to register', () => {
    // The old bare footer had no CTA and no UTM; it must be gone.
    expect(page).not.toContain('Powered by')
    expect(page).toContain('Create your Christian wedding website for free')
    expect(page).toContain(REGISTER_WITH_CAMPAIGN)
  })

  it('post-submit done state carries the same tagged CTA to register', () => {
    // The confirmation screen (shown for all statuses) must invite the guest to
    // create their own site, linking to the register page with the same campaign tag.
    expect(form).toContain('Getting married too?')
    expect(form).toContain(REGISTER_WITH_CAMPAIGN)
  })

  it('both surfaces use utm_campaign=rsvp-thankyou (measurable, distinct)', () => {
    for (const src of [form, page]) {
      expect(src).toContain('utm_campaign=rsvp-thankyou')
    }
  })

  it('neither surface reuses the wedding-footer viral-footer campaign tag', () => {
    // rsvp-thankyou must be a distinct campaign so this surface is measured on its
    // own. The generic wedding-footer (viral-footer) and coming-soon tags belong to
    // other surfaces and must not leak in here.
    for (const src of [form, page]) {
      expect(src).not.toContain('utm_campaign=viral-footer')
      expect(src).not.toContain('utm_campaign=coming-soon')
    }
  })

  it('the CTA copy uses no em dashes', () => {
    for (const src of [form, page]) {
      expect(src).not.toContain('—')
    }
  })
})
