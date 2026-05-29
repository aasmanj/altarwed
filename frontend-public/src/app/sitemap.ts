import { MetadataRoute } from 'next'

const BASE_URL = 'https://www.altarwed.com'

// Static pages with their priorities and change frequencies.
// High-priority SEO pages are listed first so they get crawled earliest.
const STATIC_PAGES: MetadataRoute.Sitemap = [
  {
    url: BASE_URL,
    changeFrequency: 'weekly',
    priority: 1.0,
  },
  {
    url: `${BASE_URL}/blog`,
    changeFrequency: 'daily',
    priority: 0.9,
  },
  // Flagship SEO blog posts, high priority so Google discovers them quickly
  {
    url: `${BASE_URL}/blog/bible-verses-for-weddings`,
    changeFrequency: 'monthly',
    priority: 0.9,
  },
  {
    url: `${BASE_URL}/blog/christian-wedding-vows`,
    changeFrequency: 'monthly',
    priority: 0.9,
  },
  {
    url: `${BASE_URL}/blog/christian-wedding-planning-checklist`,
    changeFrequency: 'monthly',
    priority: 0.8,
  },
  {
    url: `${BASE_URL}/blog/christian-wedding-ceremony-order`,
    changeFrequency: 'monthly',
    priority: 0.8,
  },
  {
    url: `${BASE_URL}/vendors`,
    changeFrequency: 'daily',
    priority: 0.8,
  },
  {
    url: `${BASE_URL}/find-wedding`,
    changeFrequency: 'daily',
    priority: 0.7,
  },
  {
    url: `${BASE_URL}/resources`,
    changeFrequency: 'monthly',
    priority: 0.6,
  },
  {
    url: `${BASE_URL}/privacy`,
    changeFrequency: 'yearly',
    priority: 0.3,
  },
  {
    url: `${BASE_URL}/terms`,
    changeFrequency: 'yearly',
    priority: 0.3,
  },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL

  // ── Dynamic blog posts ──────────────────────────────────────────────────────
  // Fetch all published posts from the API so new posts appear in the sitemap
  // within one ISR cycle without a redeployment.
  let blogPages: MetadataRoute.Sitemap = []
  if (apiUrl) {
    try {
      const res = await fetch(`${apiUrl}/api/v1/blog/posts`, {
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) {
        const posts: { slug: string; updatedAt: string }[] = await res.json()
        const staticBlogSlugs = new Set([
          'bible-verses-for-weddings',
          'christian-wedding-vows',
          'christian-wedding-planning-checklist',
          'christian-wedding-ceremony-order',
        ])
        // Only add posts not already in the static list above to avoid duplicates
        blogPages = posts
          .filter((p) => !staticBlogSlugs.has(p.slug))
          .map((post) => ({
            url: `${BASE_URL}/blog/${post.slug}`,
            lastModified: new Date(post.updatedAt),
            changeFrequency: 'monthly' as const,
            priority: 0.7,
          }))
      }
    } catch {
      // API down, static pages still included, blog dynamic entries skipped
    }
  }

  // ── Dynamic wedding website pages ───────────────────────────────────────────
  // Only published, non-deleted sites; rebuilt at most once per hour.
  let weddingPages: MetadataRoute.Sitemap = []
  if (apiUrl) {
    try {
      const res = await fetch(`${apiUrl}/api/v1/wedding-websites/published`, {
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) {
        const websites: { slug: string; updatedAt: string }[] = await res.json()
        weddingPages = websites.map((site) => ({
          url: `${BASE_URL}/wedding/${site.slug}`,
          lastModified: new Date(site.updatedAt),
          changeFrequency: 'weekly' as const,
          priority: 0.8,
        }))
      }
    } catch {
      // API down, wedding pages skipped, static pages still served
    }
  }

  return [...STATIC_PAGES, ...blogPages, ...weddingPages]
}
