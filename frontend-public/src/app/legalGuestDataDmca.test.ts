import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Source-level guard for issue #243 (legal audit 2026-07-03, P1-3 and P1-6). The three
// added clauses are static legal copy rendered server-side, so the behavioral contract is
// simply that the required sections and the guest-request email routing exist in the page
// source. vitest runs here in a plain node environment (no jsdom), so we assert on the
// rendered source strings. Each assertion fails on the pre-#243 source and passes after.

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

const CONTACT_EMAIL = 'hello@altarwed.com'

describe('legal text updates #243 (frontend-public)', () => {
  const terms = read('app/terms/page.tsx')
  const privacy = read('app/privacy/page.tsx')

  it('terms adds a guest-information controller/processor subsection with an authority warranty', () => {
    expect(terms).toContain('Guest Information You Add')
    // Controller/processor allocation and the authority-warranty language.
    expect(terms).toContain('data controller')
    expect(terms).toContain('data processor')
    expect(terms).toMatch(/authority and any consent or permission required/)
  })

  it('terms adds a DMCA copyright-complaints section that names a designated agent', () => {
    expect(terms).toContain('Copyright Complaints (DMCA)')
    expect(terms).toContain('Digital Millennium Copyright Act')
    expect(terms).toContain('designated agent')
    // The takedown notice routes to the contact address as the agent.
    expect(terms).toContain('${CONTACT_EMAIL}')
    expect(terms).toContain('counter-notice')
  })

  it('privacy adds a guest deletion-request path routing to the contact email with the couple looped in', () => {
    expect(privacy).toContain('Guests whose information a couple added')
    // Guest requests route to the shared contact address...
    expect(privacy).toContain('${CONTACT_EMAIL}')
    // ...and the couple who added the data is coordinated with, not bypassed.
    expect(privacy).toMatch(/coordinate with the couple/)
    expect(privacy).toMatch(/refer your request to them/)
  })

  it('both pages resolve the contact email constant to the shared inbox', () => {
    expect(terms).toContain(`const CONTACT_EMAIL = '${CONTACT_EMAIL}'`)
    expect(privacy).toContain(`const CONTACT_EMAIL = '${CONTACT_EMAIL}'`)
  })

  it('no raw em dash characters appear in either legal page', () => {
    // The subprocessor list uses the &mdash; HTML entity, never a raw em dash character,
    // and #243 must keep it that way per the house no-em-dash rule.
    expect(terms).not.toContain('—')
    expect(privacy).not.toContain('—')
  })
})
