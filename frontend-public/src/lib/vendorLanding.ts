// Helpers for the indexable /wedding-vendors/[category]/[city] SEO landing pages
// (issue #369, re-landed under a collision-safe route in #419). These pages target
// the highest-intent searches ("christian wedding photographer dallas"), which the
// query-param-only directory (/vendors?...) can never rank for, and they give the
// paid "priority placement" tier a page that actually ranks.
//
// The route lives at /wedding-vendors/ (NOT /vendors/) on purpose: Next.js forbids
// two different dynamic slug names at the same path segment, so a second dynamic
// route under /vendors/ (which already owns /vendors/[id]) throws at runtime on
// every request. /wedding-vendors is also a keyword-rich, SEO-valuable URL.
//
// This module is intentionally framework-free (no next imports) so the slug math,
// title/description copy, and JSON-LD builder can be unit tested directly in CI
// without a Next runtime, the same convention `src/lib/sitemap.ts` follows.

import { BASE_URL, type SitemapUrl } from './sitemap'

// Canonical vendor categories, mirroring the backend VendorCategory enum
// (backend/src/main/java/com/altarwed/domain/model/VendorCategory.java). A slug
// that does not map to one of these is not a real category, so the route 404s.
export const VENDOR_CATEGORY_LABELS: Record<string, string> = {
  PHOTOGRAPHER:    'Photographer',
  VIDEOGRAPHER:    'Videographer',
  FLORIST:         'Florist',
  CATERER:         'Caterer',
  VENUE:           'Venue',
  OFFICIANT:       'Officiant',
  MUSIC:           'Music',
  CAKE:            'Cake',
  HAIR_AND_MAKEUP: 'Hair & Makeup',
  INVITATION:      'Invitations',
  TRANSPORTATION:  'Transportation',
  COORDINATOR:     'Coordinator',
  ALTERATIONS:     'Alterations',
  COUNSELING:      'Pre-Marital Counseling',
  OTHER:           'Other',
}

// Plural, human noun used in the page <h1>, <title>, and meta description. Kept
// separate from the singular label so the primary keyword reads naturally
// ("Christian Wedding Photographers in Dallas"), which is what couples type.
export const VENDOR_CATEGORY_PLURALS: Record<string, string> = {
  PHOTOGRAPHER:    'Photographers',
  VIDEOGRAPHER:    'Videographers',
  FLORIST:         'Florists',
  CATERER:         'Caterers',
  VENUE:           'Venues',
  OFFICIANT:       'Officiants',
  MUSIC:           'Musicians',
  CAKE:            'Cake Bakers',
  HAIR_AND_MAKEUP: 'Hair & Makeup Artists',
  INVITATION:      'Invitation Designers',
  TRANSPORTATION:  'Transportation Services',
  COORDINATOR:     'Wedding Coordinators',
  ALTERATIONS:     'Alterations Services',
  COUNSELING:      'Pre-Marital Counselors',
  OTHER:           'Wedding Vendors',
}

// Lowercase, hyphenated slug from any free-text value. Collapses every run of
// non-alphanumerics into a single hyphen and trims leading/trailing hyphens, so
// "Fort Worth" -> "fort-worth" and "St. Louis" -> "st-louis".
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Category enum value ("HAIR_AND_MAKEUP") -> URL slug ("hair-and-makeup").
export function categorySlug(category: string): string {
  return category.toLowerCase().replace(/_/g, '-')
}

// URL slug -> category enum value, or null if it is not a known category. Used by
// the route to reject junk paths with a 404 instead of rendering an empty page.
export function categoryFromSlug(slug: string): string | null {
  const enumValue = slug.toUpperCase().replace(/-/g, '_')
  return Object.prototype.hasOwnProperty.call(VENDOR_CATEGORY_LABELS, enumValue)
    ? enumValue
    : null
}

// City slug for the URL. City only (no state): the backend directory query filters
// on city with a case-insensitive exact match and cannot filter by state
// (VendorJpaRepository.findDirectory), so the landing page reproduces exactly what
// the API returns by keying on city alone.
export function citySlug(city: string): string {
  return slugify(city)
}

// De-slugify a city slug back to the query string the backend expects
// ("fort-worth" -> "fort worth"). The directory query lowercases both sides, so
// case does not matter here.
export function cityFromSlug(slug: string): string {
  return slug.replace(/-/g, ' ').trim()
}

// A city is "landing-eligible" only when its slug round-trips back to the stored
// city string (case-insensitive). Slugifying is lossy for punctuation ("St. Louis"
// -> "st-louis" -> "st louis"), and the backend match is exact, so a lossy city
// would 404. We therefore only ever emit a landing URL (in the sitemap and in the
// /vendors filter chips) for cities that round-trip, keeping the sitemap and the
// rendered page perfectly consistent. Lossy cities still appear in the query-param
// directory, just not as a standalone indexable page.
export function isLandingEligibleCity(city: string): boolean {
  const slug = citySlug(city)
  return slug.length > 0 && cityFromSlug(slug) === city.trim().toLowerCase()
}

// Full landing path for a (category, city) pair, or null when the city is not
// landing-eligible so callers can fall back to the query-param directory instead
// of linking to a page that would 404.
export function vendorLandingPath(category: string, city: string): string | null {
  if (!isLandingEligibleCity(city)) {
    return null
  }
  return `/wedding-vendors/${categorySlug(category)}/${citySlug(city)}`
}

// Human "City" or "City, ST" display label. When every matched vendor sits in the
// same state we append it for a richer keyword ("Dallas, TX"); a mixed-state slug
// (rare: "Dallas, TX" and "Dallas, GA") omits the ambiguous state.
export function locationLabel(cityDisplay: string, states: string[]): string {
  const distinct = Array.from(new Set(states.map((s) => s.trim()).filter(Boolean)))
  return distinct.length === 1 ? `${cityDisplay}, ${distinct[0]}` : cityDisplay
}

// Title-cased fallback city display from the slug, used only if no vendor row is
// available to source the real casing from ("fort-worth" -> "Fort Worth").
export function titleCaseFromSlug(slug: string): string {
  return cityFromSlug(slug)
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// Keyword-first <title>. Under Google's roughly 60-char display budget for the
// common case ("Christian Wedding Photographers in Dallas, TX | AltarWed").
export function landingTitle(category: string, location: string): string {
  const plural = VENDOR_CATEGORY_PLURALS[category] ?? 'Wedding Vendors'
  return `Christian Wedding ${plural} in ${location} | AltarWed`
}

// Meta description, kept under 155 chars for the common category/location lengths.
export function landingDescription(category: string, location: string): string {
  const plural = (VENDOR_CATEGORY_PLURALS[category] ?? 'wedding vendors').toLowerCase()
  return `Find faith-aligned Christian wedding ${plural} in ${location}. Browse verified, Christian-owned vendors and send an inquiry on AltarWed.`
}

// Absolute canonical URL for a landing page.
export function landingCanonical(categoryPathSlug: string, cityPathSlug: string): string {
  return `${BASE_URL}/wedding-vendors/${categoryPathSlug}/${cityPathSlug}`
}

export interface LandingListVendor {
  id: string
  businessName: string
}

// schema.org ItemList JSON-LD for the landing page. An ItemList of the vendor
// listings is the correct type for a curated directory page (each ListItem points
// at the vendor's own LocalBusiness detail page at /vendors/[id], which is a real
// indexed route), and it is what earns the rich-result eligibility that a bare
// query-param page cannot.
export function buildLandingItemListJsonLd(
  category: string,
  location: string,
  vendors: LandingListVendor[],
): Record<string, unknown> {
  const plural = VENDOR_CATEGORY_PLURALS[category] ?? 'Wedding Vendors'
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Christian Wedding ${plural} in ${location}`,
    numberOfItems: vendors.length,
    itemListElement: vendors.map((vendor, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${BASE_URL}/vendors/${vendor.id}`,
      name: vendor.businessName,
    })),
  }
}

export interface VendorLandingCombo {
  categorySlug: string
  citySlug: string
}

// Reduce a flat list of vendor (category, city) rows to the distinct, landing
// eligible (categorySlug, citySlug) combos, sorted for stable sitemap output.
// Lossy-slug cities are dropped so every emitted combo has a page that renders.
export function toVendorLandingCombos(
  rows: { category: string; city: string }[],
): VendorLandingCombo[] {
  const seen = new Map<string, VendorLandingCombo>()
  for (const row of rows) {
    if (!row.category || !row.city) continue
    if (!Object.prototype.hasOwnProperty.call(VENDOR_CATEGORY_LABELS, row.category)) continue
    if (!isLandingEligibleCity(row.city)) continue
    const combo: VendorLandingCombo = {
      categorySlug: categorySlug(row.category),
      citySlug: citySlug(row.city),
    }
    seen.set(`${combo.categorySlug}/${combo.citySlug}`, combo)
  }
  return Array.from(seen.values()).sort((a, b) =>
    `${a.categorySlug}/${a.citySlug}`.localeCompare(`${b.categorySlug}/${b.citySlug}`),
  )
}

// Map landing combos to sitemap URLs. weekly/0.7 mirrors the priority the vendor
// directory landing surface deserves: below individual wedding sites (0.8) but
// above generic blog posts, since these are the pages built to rank for
// high-intent local searches.
export function buildVendorLandingUrls(combos: VendorLandingCombo[]): SitemapUrl[] {
  return combos.map((combo) => ({
    url: `${BASE_URL}/wedding-vendors/${combo.categorySlug}/${combo.citySlug}`,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))
}
