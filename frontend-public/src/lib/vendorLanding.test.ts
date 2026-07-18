import { describe, it, expect } from 'vitest'
import {
  categorySlug,
  categoryFromSlug,
  citySlug,
  cityFromSlug,
  isLandingEligibleCity,
  vendorLandingPath,
  locationLabel,
  titleCaseFromSlug,
  landingTitle,
  landingDescription,
  landingCanonical,
  buildLandingItemListJsonLd,
  toVendorLandingCombos,
  buildVendorLandingUrls,
} from './vendorLanding'
import { BASE_URL } from './sitemap'

// Issue #369 (re-landed under /wedding-vendors in #419): indexable
// /wedding-vendors/[category]/[city] SEO landing pages. This module is
// framework-free, so these unit tests exercise every load-bearing rule (slug
// round-tripping, keyword metadata, ItemList JSON-LD, sitemap URLs) directly in
// CI with no Next runtime. They import the @/lib/vendorLanding module, so they
// fail to resolve before the change and pass after it lands.

describe('category slugs', () => {
  it('maps a single-word category enum to a lowercase slug and back', () => {
    expect(categorySlug('PHOTOGRAPHER')).toBe('photographer')
    expect(categoryFromSlug('photographer')).toBe('PHOTOGRAPHER')
  })

  it('maps a multi-word category enum with underscores to a hyphen slug and back', () => {
    expect(categorySlug('HAIR_AND_MAKEUP')).toBe('hair-and-makeup')
    expect(categoryFromSlug('hair-and-makeup')).toBe('HAIR_AND_MAKEUP')
  })

  it('rejects a slug that is not a real category so the route can 404', () => {
    expect(categoryFromSlug('not-a-category')).toBeNull()
    expect(categoryFromSlug('')).toBeNull()
  })
})

describe('city slugs and landing eligibility', () => {
  it('slugifies and de-slugifies a simple single-word city', () => {
    expect(citySlug('Dallas')).toBe('dallas')
    expect(cityFromSlug('dallas')).toBe('dallas')
    expect(isLandingEligibleCity('Dallas')).toBe(true)
  })

  it('slugifies a two-word city into a hyphen slug that round-trips', () => {
    expect(citySlug('Fort Worth')).toBe('fort-worth')
    expect(cityFromSlug('fort-worth')).toBe('fort worth')
    expect(isLandingEligibleCity('Fort Worth')).toBe(true)
  })

  it('treats a city whose slug is lossy (punctuation) as NOT landing-eligible', () => {
    // "St. Louis" -> "st-louis" -> "st louis" != "st. louis". A landing page would
    // 404 against the backend's exact city match, so it must be excluded.
    expect(isLandingEligibleCity('St. Louis')).toBe(false)
    expect(isLandingEligibleCity('Winston-Salem')).toBe(false)
  })

  it('vendorLandingPath returns a /wedding-vendors path for eligible cities and null otherwise', () => {
    expect(vendorLandingPath('PHOTOGRAPHER', 'Dallas')).toBe('/wedding-vendors/photographer/dallas')
    expect(vendorLandingPath('HAIR_AND_MAKEUP', 'Fort Worth')).toBe('/wedding-vendors/hair-and-makeup/fort-worth')
    expect(vendorLandingPath('PHOTOGRAPHER', 'St. Louis')).toBeNull()
  })
})

describe('location label', () => {
  it('appends the state when every vendor shares one', () => {
    expect(locationLabel('Dallas', ['TX', 'TX'])).toBe('Dallas, TX')
  })

  it('omits the state when vendors span multiple states', () => {
    expect(locationLabel('Dallas', ['TX', 'GA'])).toBe('Dallas')
  })

  it('title-cases a city from its slug for the fallback display', () => {
    expect(titleCaseFromSlug('fort-worth')).toBe('Fort Worth')
  })
})

describe('metadata copy', () => {
  it('builds a keyword-first title with the plural category noun', () => {
    expect(landingTitle('PHOTOGRAPHER', 'Dallas, TX')).toBe(
      'Christian Wedding Photographers in Dallas, TX | AltarWed',
    )
  })

  it('keeps the description under 155 characters', () => {
    const desc = landingDescription('HAIR_AND_MAKEUP', 'Fort Worth, TX')
    expect(desc.length).toBeLessThanOrEqual(155)
    expect(desc).toContain('Fort Worth, TX')
    expect(desc.toLowerCase()).toContain('christian')
  })

  it('builds an absolute canonical URL on the apex host under /wedding-vendors', () => {
    expect(landingCanonical('photographer', 'dallas')).toBe(
      `${BASE_URL}/wedding-vendors/photographer/dallas`,
    )
  })
})

describe('ItemList JSON-LD', () => {
  it('emits a positioned ItemList that links each vendor to its /vendors/[id] detail page', () => {
    const jsonLd = buildLandingItemListJsonLd('PHOTOGRAPHER', 'Dallas, TX', [
      { id: 'v1', businessName: 'Grace Photography' },
      { id: 'v2', businessName: 'Covenant Studios' },
    ])
    expect(jsonLd['@type']).toBe('ItemList')
    expect(jsonLd.numberOfItems).toBe(2)
    const items = jsonLd.itemListElement as Array<Record<string, unknown>>
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      '@type': 'ListItem',
      position: 1,
      url: `${BASE_URL}/vendors/v1`,
      name: 'Grace Photography',
    })
    expect(items[1].position).toBe(2)
    expect(items[1].url).toBe(`${BASE_URL}/vendors/v2`)
  })
})

describe('sitemap combos', () => {
  it('dedupes rows into distinct, sorted, landing-eligible combos', () => {
    const combos = toVendorLandingCombos([
      { category: 'PHOTOGRAPHER', city: 'Dallas' },
      { category: 'PHOTOGRAPHER', city: 'Dallas' }, // duplicate
      { category: 'FLORIST', city: 'Fort Worth' },
      { category: 'PHOTOGRAPHER', city: 'St. Louis' }, // lossy, excluded
      { category: 'NOT_A_CATEGORY', city: 'Dallas' }, // unknown, excluded
      { category: 'PHOTOGRAPHER', city: '' }, // blank, excluded
    ])
    expect(combos).toEqual([
      { categorySlug: 'florist', citySlug: 'fort-worth' },
      { categorySlug: 'photographer', citySlug: 'dallas' },
    ])
  })

  it('builds weekly /wedding-vendors sitemap URLs on the apex host for each combo', () => {
    const urls = buildVendorLandingUrls([
      { categorySlug: 'photographer', citySlug: 'dallas' },
    ])
    expect(urls).toHaveLength(1)
    expect(urls[0]).toMatchObject({
      url: `${BASE_URL}/wedding-vendors/photographer/dallas`,
      changeFrequency: 'weekly',
      priority: 0.7,
    })
  })
})
