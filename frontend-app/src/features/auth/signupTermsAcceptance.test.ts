import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Issue #219 (P0): signup relied on pure browsewrap with no Terms/Privacy link or
// affirmative acceptance on either registration form. This asserts the sign-in-wrap
// line and both links now render directly above the submit button on the couple
// (RegisterPage) and vendor (RegisterVendorPage) registration paths.
//
// frontend-app's vitest runs in a plain node environment (no jsdom / testing-library),
// so, matching the sibling hardening tests (formInputLabels.test.ts, goldCtaContrast),
// the contract is verified with source-level assertions on the load-bearing markup.
// Each assertion fails on the pre-fix source and passes after.

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

// Collapse JSX whitespace so a line broken across multiple source lines still
// matches as one continuous sentence.
function normalize(src: string): string {
  return src.replace(/\s+/g, ' ')
}

const TERMS_LINK = 'https://www.altarwed.com/terms'
const PRIVACY_LINK = 'https://www.altarwed.com/privacy'

describe('Couple RegisterPage terms/privacy acceptance (issue #219)', () => {
  const src = read('features/auth/RegisterPage.tsx')
  const flat = normalize(src)

  it('renders the full sign-in-wrap line including the guest-authority clause', () => {
    expect(flat).toContain('By creating an account you agree to our')
    expect(flat).toContain(
      'you confirm you have the authority to add the guests you invite through AltarWed.',
    )
  })

  it('links Terms of Service to the terms page in a new tab', () => {
    expect(flat).toContain(`href="${TERMS_LINK}"`)
    expect(flat).toContain('Terms of Service')
  })

  it('links Privacy Policy to the privacy page in a new tab', () => {
    expect(flat).toContain(`href="${PRIVACY_LINK}"`)
    expect(flat).toContain('Privacy Policy')
  })

  it('opens both links safely with target _blank and rel noopener noreferrer', () => {
    const anchors = src.match(/<a[\s\S]*?<\/a>/g) ?? []
    const legal = anchors.filter(
      a => a.includes(TERMS_LINK) || a.includes(PRIVACY_LINK),
    )
    expect(legal.length).toBe(2)
    for (const a of legal) {
      expect(a).toContain('target="_blank"')
      expect(a).toContain('rel="noopener noreferrer"')
    }
  })

  it('does not use the low-contrast text-stone-400 utility', () => {
    expect(src).not.toContain('text-stone-400')
  })
})

describe('Vendor RegisterVendorPage terms/privacy acceptance (issue #219)', () => {
  const src = read('features/vendor/RegisterVendorPage.tsx')
  const flat = normalize(src)

  it('renders the sign-in-wrap line without the couple guest clause', () => {
    expect(flat).toContain('By creating an account you agree to our')
    // The guest-authority clause is couple-only and must not appear for vendors.
    expect(flat).not.toContain('the guests you invite through AltarWed')
  })

  it('links Terms of Service to the terms page', () => {
    expect(flat).toContain(`href="${TERMS_LINK}"`)
    expect(flat).toContain('Terms of Service')
  })

  it('links Privacy Policy to the privacy page', () => {
    expect(flat).toContain(`href="${PRIVACY_LINK}"`)
    expect(flat).toContain('Privacy Policy')
  })

  it('opens both links safely with target _blank and rel noopener noreferrer', () => {
    const anchors = src.match(/<a[\s\S]*?<\/a>/g) ?? []
    const legal = anchors.filter(
      a => a.includes(TERMS_LINK) || a.includes(PRIVACY_LINK),
    )
    expect(legal.length).toBe(2)
    for (const a of legal) {
      expect(a).toContain('target="_blank"')
      expect(a).toContain('rel="noopener noreferrer"')
    }
  })

  it('does not use the low-contrast text-stone-400 utility', () => {
    expect(src).not.toContain('text-stone-400')
  })
})
