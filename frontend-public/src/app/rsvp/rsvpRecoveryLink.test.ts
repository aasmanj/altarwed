import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Source-level guards for issue #225 (RSVP recovery path + privacy notice). vitest
// runs in a node environment here (no jsdom / testing-library), matching the sibling
// rsvp tests, so we assert on the load-bearing JSX rather than rendering. The emailed
// RSVP link is single-use, so both the post-submit confirmation screen and the
// dead-link screen must point guests at the working find-your-invitation finder, and
// the submit surface must disclose that responses are shared with the couple. Each
// assertion fails on the pre-fix source and passes after.
function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

describe('RSVP recovery link + privacy notice (issue #225)', () => {
  const form = read('app/rsvp/[token]/RsvpForm.tsx')
  const page = read('app/rsvp/[token]/page.tsx')

  it('confirmation screen offers a find-your-invitation recovery path', () => {
    // The "done" state must invite guests to change their answer and link to the
    // finder, not leave the dead emailed link as the only route back.
    expect(form).toContain('Need to change your response?')
    expect(form).toContain('Find your invitation')
    // Uses the wedding-scoped finder when the slug is known, name search otherwise.
    expect(form).toContain('`/wedding/${weddingSlug}/rsvp`')
    expect(form).toContain("'/find-wedding'")
  })

  it('expired/used-link screen shows the same working recovery link', () => {
    // Alongside "contact the couple directly", the terminal invalid-token screen
    // must offer the name-search finder (no slug is available on a dead token).
    expect(page).toContain('find your invitation')
    expect(page).toContain('href="/find-wedding"')
    // The existing contact-the-couple copy stays; recovery is additive.
    expect(page).toContain('contact the couple directly')
  })

  it('submit surface carries a privacy notice linking to /privacy', () => {
    expect(page).toContain('Your responses are shared with the couple.')
    expect(page).toContain('how AltarWed handles your information')
    expect(page).toContain('href="/privacy"')
  })

  it('recovery and privacy links use no em dashes', () => {
    for (const src of [form, page]) {
      expect(src).not.toContain('—')
    }
  })
})
