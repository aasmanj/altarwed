import {
  STATIC_PAGES,
  buildBlogUrls,
  buildWeddingUrls,
  type SitemapUrl,
  type SlugSummary,
} from './sitemap'

// Fetch a slug feed (blog posts or published wedding sites) from the API. Kept
// resilient: any failure returns an empty list so the sitemap still serves its
// static pages instead of 500ing. Responses are cached for one hour (revalidate)
// so the same feed is fetched once per ISR cycle and reused across the sitemap
// index request and every child-sitemap request.
async function fetchSlugFeed(url: string): Promise<SlugSummary[]> {
  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      return []
    }
    const data = await res.json()
    return Array.isArray(data) ? (data as SlugSummary[]) : []
  } catch {
    return []
  }
}

// Page size for the published-wedding feed. Must match the backend's server-side
// ceiling (WeddingWebsiteService.MAX_SITEMAP_PAGE_SIZE): the loader treats a page
// with fewer than this many rows as the last page, so a smaller value here would
// stop early and drop sites from the sitemap.
const WEDDING_FEED_PAGE_SIZE = 1000

// Hard stop on the number of pages we will walk, so a misbehaving API (one that
// keeps returning full pages) can never spin an unbounded fetch loop during an ISR
// render. 1000 pages * 1000 rows covers a million published sites, far beyond the
// current catalog; hitting it means something is wrong upstream, not a real feed.
const WEDDING_FEED_MAX_PAGES = 1000

// Walk the paginated published-wedding feed (issue #241) until a short page signals
// the end, concatenating every page. The backend orders by id, so paging is stable
// and no site is duplicated or skipped across page boundaries.
async function fetchPublishedWeddingSites(apiUrl: string): Promise<SlugSummary[]> {
  const sites: SlugSummary[] = []
  for (let page = 0; page < WEDDING_FEED_MAX_PAGES; page++) {
    const batch = await fetchSlugFeed(
      `${apiUrl}/api/v1/wedding-websites/published?page=${page}&size=${WEDDING_FEED_PAGE_SIZE}`,
    )
    sites.push(...batch)
    if (batch.length < WEDDING_FEED_PAGE_SIZE) {
      break
    }
  }
  return sites
}

// Build the full, ordered list of public URLs (static pages, then dynamic blog
// posts, then published wedding sites). The sitemap index and child sitemaps are
// both derived from this single list so they can never disagree on pagination.
export async function loadSitemapUrls(): Promise<SitemapUrl[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL

  let blogPosts: SlugSummary[] = []
  let weddingSites: SlugSummary[] = []
  if (apiUrl) {
    blogPosts = await fetchSlugFeed(`${apiUrl}/api/v1/blog/posts`)
    weddingSites = await fetchPublishedWeddingSites(apiUrl)
  }

  return [
    ...STATIC_PAGES,
    ...buildBlogUrls(blogPosts),
    ...buildWeddingUrls(weddingSites),
  ]
}
