import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { STATIC_PAGES } from '@/lib/sitemap'

// Behavioral guard for issue #373: the public /for-vendors landing page. Before this
// change the route did not exist, so every assertion below fails on the pre-change tree
// (no file to read, route absent from the sitemap and nav) and passes after.
//
// vitest runs here in a plain node environment (no jsdom / testing-library), so we assert
// on the load-bearing source the page ships: metadata, SSR-ability, JSON-LD, value props,
// tier pricing, and the vendor-register CTA. This mirrors the existing source-level page
// tests (resourcesAffiliateDisclosure, goldCtaContrast) that verify markup-only pages.

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

const VENDOR_REGISTER_URL = 'https://app.altarwed.com/register/vendor'

describe('for-vendors landing page #373', () => {
  const page = read('app/for-vendors/page.tsx')

  it('is server-rendered (no client boundary) for SEO', () => {
    // A public SEO page must render on the server. A "use client" directive would opt it
    // out of SSG/SSR, so its absence is the contract.
    expect(page).not.toContain("'use client'")
    expect(page).not.toContain('"use client"')
  })

  it('exports SEO metadata with a keyword title, description, canonical, and Open Graph', () => {
    expect(page).toContain('export const metadata')
    expect(page).toContain('List Your Christian Wedding Business')
    expect(page).toContain('canonical:')
    expect(page).toContain('https://www.altarwed.com/for-vendors')
    expect(page).toContain('openGraph:')
    // Description stays under Google's ~155-char truncation guideline.
    const descMatch = page.match(/description:\s*\n?\s*'([^']+)'/)
    expect(descMatch).not.toBeNull()
    expect(descMatch![1].length).toBeLessThanOrEqual(155)
  })

  it('emits Product + Offer JSON-LD carrying the tier prices', () => {
    expect(page).toContain('application/ld+json')
    expect(page).toContain("'@type': 'Product'")
    expect(page).toContain("'@type': 'Offer'")
    // Both live tiers are represented: free ($0) and Pro ($29).
    expect(page).toContain("price: '0'")
    expect(page).toContain("price: '29'")
    expect(page).toContain("priceCurrency: 'USD'")
  })

  it('renders exactly one h1 and steps headings down without skipping', () => {
    const h1Count = (page.match(/<h1[\s>]/g) ?? []).length
    expect(h1Count).toBe(1)
    // Section headings are h2, not h3+, so the outline never skips a level.
    expect(page).toContain('<h2')
  })

  it('sells value props for vendors', () => {
    expect(page).toContain('VALUE_PROPS')
    expect(page).toContain('Why vendors join AltarWed')
    expect(page).toContain('faith-aligned audience')
    expect(page).toContain('SEO reach that compounds')
  })

  it('shows directory-reach proof', () => {
    expect(page).toContain('REACH_PROOF')
    expect(page).toContain('An audience that keeps growing')
    expect(page).toContain('Indexed by Google')
  })

  it('shows tier pricing with the live free and Pro numbers', () => {
    expect(page).toContain('Free listing')
    expect(page).toContain("name: 'Pro'")
    expect(page).toContain("price: '$0'")
    expect(page).toContain("price: '$29'")
    // The annual price is quoted so the page mirrors the dashboard billing exactly.
    expect(page).toContain('$290 per year')
  })

  it('links every CTA to the vendor registration flow', () => {
    // The page must give a prospect a way to sign up as a vendor. The register URL is a
    // single named constant reused by every CTA, so we assert the literal is defined and
    // that it is referenced by multiple anchors (hero, tier CTAs in the map, final CTA).
    expect(page).toContain(`const VENDOR_REGISTER_URL = '${VENDOR_REGISTER_URL}'`)
    const anchorRefs = (page.match(/href=\{VENDOR_REGISTER_URL\}/g) ?? []).length
    expect(anchorRefs).toBeGreaterThanOrEqual(3)
  })

  it('keeps gold CTA buttons on the AA-compliant dark-brown text, never white', () => {
    // Same WCAG 1.4.3 guard the homepage uses: white on gold measures ~2.07:1 and fails.
    expect(page).toContain('bg-[#d4af6a] text-[#3b2f2f]')
    expect(page).not.toContain('bg-[#d4af6a] text-white')
  })

  it('uses no em dashes anywhere in the page copy', () => {
    expect(page).not.toContain('—')
  })

  it('is listed in the sitemap static pages', () => {
    const urls = STATIC_PAGES.map((p) => p.url)
    expect(urls).toContain('https://www.altarwed.com/for-vendors')
  })

  it('is linked from the site nav header', () => {
    const header = read('components/SiteHeader.tsx')
    expect(header).toContain('href="/for-vendors"')
  })
})
