// Sitemap generation helpers for the public site.
//
// Google hard-caps a single sitemap at 50,000 URLs / 50MB and rejects the whole
// file once it goes past that limit. At our 50k-100k+ published-site growth
// target a single flat sitemap.xml would silently stop being indexed, which
// kills the organic-growth loop (every couple's public site is the SEO engine).
//
// We therefore paginate every URL into child sitemaps that each stay under the
// cap and expose a sitemap index that lists them, mirroring Next.js App Router's
// generateSitemaps /sitemap/<id>.xml URL scheme. These helpers are intentionally
// framework-free (no next imports) so the pagination and XML serialization can
// be unit tested directly in CI without a Next runtime.

import { CEREMONY_GUIDES } from '@/app/ceremony-templates/data'

export const BASE_URL = 'https://www.altarwed.com'

// Google's documented per-sitemap ceiling. A child sitemap may hold up to this
// many URLs (the limit is inclusive), so we page on it exactly.
export const SITEMAP_URL_LIMIT = 50000

export type ChangeFrequency =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never'

export interface SitemapUrl {
  url: string
  lastModified?: string
  changeFrequency?: ChangeFrequency
  priority?: number
}

// Minimal shape returned by the blog-posts and published-wedding endpoints.
export interface SlugSummary {
  slug: string
  updatedAt: string
}

// Static pages with their priorities and change frequencies. High-priority SEO
// pages are listed first so they get crawled earliest. These are known at build
// time and always live in the first child sitemap.
export const STATIC_PAGES: SitemapUrl[] = [
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
  // Flagship SEO blog posts, high priority so Google discovers them quickly.
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
    url: `${BASE_URL}/ceremony-templates`,
    changeFrequency: 'monthly',
    priority: 0.8,
  },
  // Programmatic ceremony-template pages, one per authored denomination. Defined
  // in code (data.ts), so they are known at build and listed statically here.
  // Mirrors the shape the old metadata sitemap emitted; dropping these silently
  // pulls every /ceremony-templates/[denomination] guide out of the sitemap.
  ...CEREMONY_GUIDES.map((g) => ({
    url: `${BASE_URL}/ceremony-templates/${g.slug}`,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  })),
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

// Blog slugs that are already listed statically above; skip them when mapping
// the dynamic blog feed so they are not duplicated in the sitemap.
export const STATIC_BLOG_SLUGS = new Set([
  'bible-verses-for-weddings',
  'christian-wedding-vows',
  'christian-wedding-planning-checklist',
  'christian-wedding-ceremony-order',
])

export function buildBlogUrls(posts: SlugSummary[]): SitemapUrl[] {
  return posts
    .filter((post) => !STATIC_BLOG_SLUGS.has(post.slug))
    .map((post) => ({
      url: `${BASE_URL}/blog/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }))
}

export function buildWeddingUrls(sites: SlugSummary[]): SitemapUrl[] {
  return sites.map((site) => ({
    url: `${BASE_URL}/wedding/${site.slug}`,
    lastModified: site.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))
}

// Number of child sitemaps needed to hold `total` URLs. Always at least 1 so the
// index references /sitemap/0.xml even when the site is brand new (Google
// tolerates an index that points at a single, possibly small, child sitemap).
export function sitemapPageCount(total: number, limit = SITEMAP_URL_LIMIT): number {
  if (total <= 0) {
    return 1
  }
  return Math.ceil(total / limit)
}

// Split URLs into child-sitemap-sized pages, each at most `limit` long. Always
// returns at least one page so /sitemap/0.xml renders even with zero URLs.
export function paginateSitemapUrls(
  urls: SitemapUrl[],
  limit = SITEMAP_URL_LIMIT,
): SitemapUrl[][] {
  if (urls.length === 0) {
    return [[]]
  }
  const pages: SitemapUrl[][] = []
  for (let i = 0; i < urls.length; i += limit) {
    pages.push(urls.slice(i, i + limit))
  }
  return pages
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Serialize one child sitemap document (<urlset>).
export function renderUrlset(urls: SitemapUrl[]): string {
  const body = urls
    .map((entry) => {
      const parts = [`<loc>${escapeXml(entry.url)}</loc>`]
      if (entry.lastModified) {
        parts.push(`<lastmod>${escapeXml(entry.lastModified)}</lastmod>`)
      }
      if (entry.changeFrequency) {
        parts.push(`<changefreq>${entry.changeFrequency}</changefreq>`)
      }
      if (typeof entry.priority === 'number') {
        parts.push(`<priority>${entry.priority}</priority>`)
      }
      return `<url>${parts.join('')}</url>`
    })
    .join('')
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    body +
    '</urlset>'
  )
}

// Serialize the sitemap index (<sitemapindex>) that lists `count` child sitemaps
// at /sitemap/<id>.xml, mirroring the generateSitemaps URL scheme.
export function renderSitemapIndex(
  count: number,
  baseUrl = BASE_URL,
  lastModified?: string,
): string {
  const safeCount = Math.max(1, count)
  const body = Array.from({ length: safeCount }, (_unused, id) => {
    const loc = `<loc>${escapeXml(`${baseUrl}/sitemap/${id}.xml`)}</loc>`
    const lastmod = lastModified
      ? `<lastmod>${escapeXml(lastModified)}</lastmod>`
      : ''
    return `<sitemap>${loc}${lastmod}</sitemap>`
  }).join('')
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    body +
    '</sitemapindex>'
  )
}

// Parse a child-sitemap id segment ("0.xml" -> 0, "3" -> 3). Returns null for
// anything that is not a non-negative integer id so the route can 404 cleanly.
export function parseSitemapId(segment: string): number | null {
  const match = /^(\d+)(?:\.xml)?$/.exec(segment)
  if (!match) {
    return null
  }
  return Number(match[1])
}
