import { describe, it, expect } from 'vitest'
import {
  BASE_URL,
  SITEMAP_URL_LIMIT,
  STATIC_PAGES,
  buildBlogUrls,
  buildWeddingUrls,
  paginateSitemapUrls,
  parseSitemapId,
  renderSitemapIndex,
  renderUrlset,
  sitemapPageCount,
  type SitemapUrl,
  type SlugSummary,
} from './sitemap'
import { CEREMONY_GUIDES } from '@/app/ceremony-templates/data'

// Issue #151: a single flat sitemap.xml breaks Google's 50,000-URL cap once the
// platform approaches its 50k-100k+ published-site growth target. These tests
// lock in the sitemap-index + paginated-child-sitemap behavior. They import the
// new @/lib/sitemap module, so they fail to even resolve before the fix and pass
// after it lands.

function makeWeddingSites(count: number): SlugSummary[] {
  return Array.from({ length: count }, (_unused, i) => ({
    slug: `couple-${i}`,
    updatedAt: '2026-01-01T00:00:00.000Z',
  }))
}

describe('sitemapPageCount', () => {
  it('returns 1 for an empty site so /sitemap/0.xml always exists', () => {
    expect(sitemapPageCount(0)).toBe(1)
  })

  it('keeps a single child sitemap while under the cap', () => {
    expect(sitemapPageCount(SITEMAP_URL_LIMIT)).toBe(1)
    expect(sitemapPageCount(1)).toBe(1)
  })

  it('adds child sitemaps once the URL count exceeds the cap', () => {
    expect(sitemapPageCount(SITEMAP_URL_LIMIT + 1)).toBe(2)
    expect(sitemapPageCount(60_000)).toBe(2)
    expect(sitemapPageCount(120_000)).toBe(3)
  })
})

describe('paginateSitemapUrls', () => {
  it('folds a small URL set into a single page', () => {
    const urls: SitemapUrl[] = [...STATIC_PAGES, ...buildWeddingUrls(makeWeddingSites(3))]
    const pages = paginateSitemapUrls(urls)
    expect(pages).toHaveLength(1)
    expect(pages[0]).toHaveLength(urls.length)
  })

  it('always returns at least one (empty) page', () => {
    expect(paginateSitemapUrls([])).toEqual([[]])
  })

  it('splits a 60,000-site catalog into multiple pages each under the cap', () => {
    const urls: SitemapUrl[] = [
      ...STATIC_PAGES,
      ...buildWeddingUrls(makeWeddingSites(60_000)),
    ]
    const pages = paginateSitemapUrls(urls)

    // Multiple child sitemaps for a large count...
    expect(pages.length).toBeGreaterThan(1)
    // ...each within Google's 50,000-URL cap...
    for (const page of pages) {
      expect(page.length).toBeLessThanOrEqual(SITEMAP_URL_LIMIT)
    }
    // ...and no URL lost or duplicated across the split.
    const total = pages.reduce((sum, page) => sum + page.length, 0)
    expect(total).toBe(urls.length)
    // Static pages stay first, in the first child sitemap.
    expect(pages[0][0].url).toBe(STATIC_PAGES[0].url)
  })
})

describe('renderSitemapIndex', () => {
  it('produces a valid sitemap index listing each child sitemap URL', () => {
    const xml = renderSitemapIndex(2)
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<sitemapindex')
    expect(xml).toContain(`<loc>${BASE_URL}/sitemap/0.xml</loc>`)
    expect(xml).toContain(`<loc>${BASE_URL}/sitemap/1.xml</loc>`)
    expect((xml.match(/<sitemap>/g) ?? []).length).toBe(2)
  })

  it('still references one child sitemap for a small (single-page) site', () => {
    const xml = renderSitemapIndex(sitemapPageCount(STATIC_PAGES.length))
    expect((xml.match(/<sitemap>/g) ?? []).length).toBe(1)
    expect(xml).toContain(`<loc>${BASE_URL}/sitemap/0.xml</loc>`)
    expect(xml).not.toContain('/sitemap/1.xml')
  })
})

describe('renderUrlset', () => {
  it('serializes URLs into a urlset with loc, lastmod, changefreq and priority', () => {
    const xml = renderUrlset(buildWeddingUrls(makeWeddingSites(1)))
    expect(xml).toContain('<urlset')
    expect(xml).toContain(`<loc>${BASE_URL}/wedding/couple-0</loc>`)
    expect(xml).toContain('<changefreq>weekly</changefreq>')
    expect(xml).toContain('<priority>0.8</priority>')
    expect(xml).toContain('<lastmod>2026-01-01T00:00:00.000Z</lastmod>')
  })

  it('xml-escapes ampersands in URLs so the document stays well formed', () => {
    const xml = renderUrlset([{ url: `${BASE_URL}/wedding/tom-and-jerry?a=1&b=2` }])
    expect(xml).toContain('&amp;')
    expect(xml).not.toMatch(/[^p];b=2/) // raw "&b=2" must not survive
  })
})

describe('STATIC_PAGES ceremony-template guides', () => {
  // Regression guard: the programmatic /ceremony-templates/[denomination] guides
  // (catholic, baptist, non-denominational) are real statically-generated pages
  // with Article JSON-LD. An earlier refactor dropped the CEREMONY_GUIDES mapping
  // and silently pulled every individual guide out of the sitemap while leaving
  // the /ceremony-templates index in place. Assert each authored guide slug is
  // present so that regression cannot recur unnoticed.
  it('lists every CEREMONY_GUIDES slug as a static page entry', () => {
    for (const guide of CEREMONY_GUIDES) {
      const expectedUrl = `${BASE_URL}/ceremony-templates/${guide.slug}`
      const entry = STATIC_PAGES.find((page) => page.url === expectedUrl)
      expect(entry, `missing sitemap entry for ${expectedUrl}`).toBeDefined()
      expect(entry?.changeFrequency).toBe('monthly')
      expect(entry?.priority).toBe(0.8)
    }
  })

  it('renders every ceremony-guide URL into the serialized child sitemap', () => {
    const xml = renderUrlset(STATIC_PAGES)
    for (const guide of CEREMONY_GUIDES) {
      expect(xml).toContain(
        `<loc>${BASE_URL}/ceremony-templates/${guide.slug}</loc>`,
      )
    }
  })
})

describe('buildBlogUrls', () => {
  it('drops slugs already listed as static pages to avoid duplicates', () => {
    const urls = buildBlogUrls([
      { slug: 'christian-wedding-vows', updatedAt: '2026-01-01T00:00:00.000Z' },
      { slug: 'a-fresh-post', updatedAt: '2026-01-01T00:00:00.000Z' },
    ])
    expect(urls).toHaveLength(1)
    expect(urls[0].url).toBe(`${BASE_URL}/blog/a-fresh-post`)
  })
})

describe('parseSitemapId', () => {
  it('parses the /sitemap/<id>.xml segment to a page index', () => {
    expect(parseSitemapId('0.xml')).toBe(0)
    expect(parseSitemapId('12.xml')).toBe(12)
    expect(parseSitemapId('3')).toBe(3)
  })

  it('rejects non-numeric or malformed ids', () => {
    expect(parseSitemapId('abc')).toBeNull()
    expect(parseSitemapId('-1')).toBeNull()
    expect(parseSitemapId('1.2.xml')).toBeNull()
    expect(parseSitemapId('')).toBeNull()
  })
})
