import {
  STATIC_PAGES,
  buildBlogUrls,
  buildWeddingUrls,
  type SitemapUrl,
  type SlugSummary,
} from './sitemap'
import {
  VENDOR_CATEGORY_LABELS,
  buildVendorLandingUrls,
  toVendorLandingCombos,
} from './vendorLanding'

// Fetch a slug feed (blog posts or published wedding sites) from the API. Returns
// null on ANY failure (non-2xx, timeout, network, malformed body) and an array
// (possibly empty) only on a successful response. That distinction is load-bearing
// for the paginated wedding walk below: an empty array is a legitimately empty last
// page, whereas null is a failed page that must NOT be mistaken for end-of-feed.
// Responses are cached for one hour (revalidate) so the same feed is fetched once
// per ISR cycle and reused across the sitemap index and every child-sitemap request.
async function fetchSlugFeed(url: string): Promise<SlugSummary[] | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      return null
    }
    const data = await res.json()
    return Array.isArray(data) ? (data as SlugSummary[]) : null
  } catch {
    return null
  }
}

// Page size for the published-wedding feed. Must equal the backend's server-side
// ceiling (WeddingWebsiteService.MAX_SITEMAP_PAGE_SIZE, backend/src/main/java/com/
// altarwed/application/service/WeddingWebsiteService.java): the loader treats a page
// with fewer than this many rows as the last page, so if this drifts below the server
// clamp the walk would stop after page 0 and silently drop most sites. The two
// constants are cross-checked by sitemapFeedPageSize.test.ts so drift fails CI.
export const WEDDING_FEED_PAGE_SIZE = 1000

// Hard stop on the number of pages we will walk, so a misbehaving API (one that
// keeps returning full pages) can never spin an unbounded fetch loop during an ISR
// render. 1000 pages * 1000 rows covers a million published sites, far beyond the
// current catalog; hitting it means something is wrong upstream, not a real feed.
const WEDDING_FEED_MAX_PAGES = 1000

// Walk the paginated published-wedding feed (issue #241) until a short page signals
// the end, concatenating every page. The backend orders by id, so paging is stable
// and no site is duplicated or skipped across page boundaries.
//
// Fails closed: if any page errors (fetchSlugFeed returns null) we THROW rather than
// return the pages gathered so far. A partial list would look healthy and get cached
// for the full 3600s revalidate window, silently dropping every site past the failed
// page. Throwing aborts the ISR render so Next keeps serving the last good cached
// sitemap (stale but complete), which is strictly better than truncated-but-fresh.
async function fetchPublishedWeddingSites(apiUrl: string): Promise<SlugSummary[]> {
  const sites: SlugSummary[] = []
  for (let page = 0; page < WEDDING_FEED_MAX_PAGES; page++) {
    const batch = await fetchSlugFeed(
      `${apiUrl}/api/v1/wedding-websites/published?page=${page}&size=${WEDDING_FEED_PAGE_SIZE}`,
    )
    if (batch === null) {
      throw new Error(
        `published-wedding sitemap feed failed at page ${page}; aborting to preserve the last good sitemap`,
      )
    }
    sites.push(...batch)
    if (batch.length < WEDDING_FEED_PAGE_SIZE) {
      break
    }
  }
  return sites
}

// Directory row we care about for landing-page discovery. The public vendor
// directory returns far more per vendor, but only category + city drive the
// /vendors/[category]/[city] URLs.
interface VendorDirectoryRow {
  category: string
  city: string
}

// Page size and page cap for the vendor directory walk. The backend caps a single
// directory query at 50 rows per page (VendorService.MAX_PAGE_SIZE) and 100 rows
// total (VendorRepository.MAX_SEARCH_RESULTS), so two pages of 50 exhaust the
// window the API will ever return for one category.
const VENDOR_FEED_PAGE_SIZE = 50
const VENDOR_FEED_MAX_PAGES = 2

// Fetch one page of the public vendor directory for a category. Returns null on
// ANY failure so the caller can skip that category without corrupting the walk;
// an empty page is a legitimate end-of-results, not a failure.
async function fetchVendorDirectoryPage(
  apiUrl: string,
  category: string,
  page: number,
): Promise<{ rows: VendorDirectoryRow[]; total: number } | null> {
  const params = new URLSearchParams({
    category,
    page: String(page),
    size: String(VENDOR_FEED_PAGE_SIZE),
  })
  try {
    const res = await fetch(`${apiUrl}/api/v1/vendors?${params}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const list = Array.isArray(data) ? data : (data.vendors ?? [])
    const total = Array.isArray(data) ? data.length : (data.total ?? list.length)
    const rows: VendorDirectoryRow[] = list.map((v: { category?: string; city?: string }) => ({
      category: v.category ?? '',
      city: v.city ?? '',
    }))
    return { rows, total }
  } catch {
    return null
  }
}

// Discover the distinct, landing-eligible (category, city) combos by walking the
// public directory once per category. We iterate per category (not one unfiltered
// query) because the backend caps every query at 100 rows, so a single global walk
// would only ever surface combos from the 100 most-viewed vendors; per-category
// discovery surfaces up to 100 vendors PER category instead.
//
// Fails soft: a vendor-API blip skips the affected category rather than throwing.
// Vendor landing pages are additive SEO surface, not the core sitemap, so a partial
// vendor list is preferable to dropping the entire (mostly wedding-site) sitemap,
// which is why this coalesces instead of failing closed like the wedding walk.
// NOTE (scale follow-up): once the catalog exceeds ~100 vendors in a single
// category, cities outside that category's top 100 will not be auto-discovered
// here. The durable fix is a dedicated backend endpoint returning DISTINCT active
// (category, city) pairs; tracked as a follow-up on issue #369.
async function fetchVendorLandingCombos(apiUrl: string): Promise<VendorDirectoryRow[]> {
  const rows: VendorDirectoryRow[] = []
  for (const category of Object.keys(VENDOR_CATEGORY_LABELS)) {
    let collected = 0
    for (let page = 0; page < VENDOR_FEED_MAX_PAGES; page++) {
      const result = await fetchVendorDirectoryPage(apiUrl, category, page)
      if (result === null) break
      rows.push(...result.rows)
      collected += result.rows.length
      if (collected >= result.total || result.rows.length < VENDOR_FEED_PAGE_SIZE) break
    }
  }
  return rows
}

// Build the full, ordered list of public URLs (static pages, then dynamic blog
// posts, then published wedding sites, then vendor category/city landing pages).
// The sitemap index and child sitemaps are both derived from this single list so
// they can never disagree on pagination.
export async function loadSitemapUrls(): Promise<SitemapUrl[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL

  let blogPosts: SlugSummary[] = []
  let weddingSites: SlugSummary[] = []
  let vendorLandingUrls: SitemapUrl[] = []
  if (apiUrl) {
    // Blog is a single, unpaginated fetch, so a failure is all-or-nothing (never a
    // silent partial); coalesce null to [] to keep the pre-existing resilient
    // behavior and still serve the static pages and the wedding feed.
    blogPosts = (await fetchSlugFeed(`${apiUrl}/api/v1/blog/posts`)) ?? []
    // The wedding feed is paginated, so it fails closed (throws) instead: a partial
    // list would cache a truncated sitemap for the full revalidate window.
    weddingSites = await fetchPublishedWeddingSites(apiUrl)
    // Vendor landing pages are additive and fail soft (see fetchVendorLandingCombos).
    const combos = toVendorLandingCombos(await fetchVendorLandingCombos(apiUrl))
    vendorLandingUrls = buildVendorLandingUrls(combos)
  }

  return [
    ...STATIC_PAGES,
    ...buildBlogUrls(blogPosts),
    ...buildWeddingUrls(weddingSites),
    ...vendorLandingUrls,
  ]
}
