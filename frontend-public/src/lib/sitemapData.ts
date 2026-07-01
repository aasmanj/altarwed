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

// Build the full, ordered list of public URLs (static pages, then dynamic blog
// posts, then published wedding sites). The sitemap index and child sitemaps are
// both derived from this single list so they can never disagree on pagination.
export async function loadSitemapUrls(): Promise<SitemapUrl[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL

  let blogPosts: SlugSummary[] = []
  let weddingSites: SlugSummary[] = []
  if (apiUrl) {
    blogPosts = await fetchSlugFeed(`${apiUrl}/api/v1/blog/posts`)
    weddingSites = await fetchSlugFeed(
      `${apiUrl}/api/v1/wedding-websites/published`,
    )
  }

  return [
    ...STATIC_PAGES,
    ...buildBlogUrls(blogPosts),
    ...buildWeddingUrls(weddingSites),
  ]
}
