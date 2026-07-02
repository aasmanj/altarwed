import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GET as getIndex } from '@/app/sitemap.xml/route'
import { GET as getChild } from '@/app/sitemap/[id]/route'
import { SITEMAP_URL_LIMIT } from './sitemap'

// End-to-end wiring test for issue #151: with a mocked large published-site
// count the /sitemap.xml route must return a sitemap index referencing multiple
// child sitemaps, and each /sitemap/<id>.xml child must stay under Google's cap.
// The published-wedding feed is mocked so no live API is needed in CI.

const PUBLISHED_COUNT = 60_000

function mockFetch(publishedCount: number) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/wedding-websites/published')) {
      const sites = Array.from({ length: publishedCount }, (_unused, i) => ({
        slug: `couple-${i}`,
        updatedAt: '2026-01-01T00:00:00.000Z',
      }))
      return new Response(JSON.stringify(sites), { status: 200 })
    }
    // Blog feed (or anything else) is empty for this test.
    return new Response(JSON.stringify([]), { status: 200 })
  })
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = 'https://api.test.altarwed.com'
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('sitemap routes with a 60,000-site catalog', () => {
  it('serves a sitemap index referencing multiple child sitemaps', async () => {
    vi.stubGlobal('fetch', mockFetch(PUBLISHED_COUNT))

    const res = await getIndex()
    expect(res.headers.get('Content-Type')).toBe('application/xml')
    const xml = await res.text()

    expect(xml).toContain('<sitemapindex')
    const childCount = (xml.match(/<sitemap>/g) ?? []).length
    expect(childCount).toBeGreaterThan(1)
    expect(childCount).toBe(Math.ceil(PUBLISHED_COUNT / SITEMAP_URL_LIMIT))
    expect(xml).toContain('/sitemap/0.xml')
    expect(xml).toContain('/sitemap/1.xml')
  })

  it('serves each child sitemap under the 50,000-URL cap', async () => {
    vi.stubGlobal('fetch', mockFetch(PUBLISHED_COUNT))

    const first = await getChild(new Request('https://www.altarwed.com/sitemap/0.xml'), {
      params: Promise.resolve({ id: '0.xml' }),
    })
    const firstXml = await first.text()
    expect(first.headers.get('Content-Type')).toBe('application/xml')
    expect(firstXml).toContain('<urlset')
    const firstUrlCount = (firstXml.match(/<url>/g) ?? []).length
    expect(firstUrlCount).toBeLessThanOrEqual(SITEMAP_URL_LIMIT)
    expect(firstUrlCount).toBe(SITEMAP_URL_LIMIT)

    const second = await getChild(new Request('https://www.altarwed.com/sitemap/1.xml'), {
      params: Promise.resolve({ id: '1.xml' }),
    })
    const secondXml = await second.text()
    const secondUrlCount = (secondXml.match(/<url>/g) ?? []).length
    expect(secondUrlCount).toBeGreaterThan(0)
    expect(secondUrlCount).toBeLessThanOrEqual(SITEMAP_URL_LIMIT)
  })

  it('404s an out-of-range or malformed child sitemap id', async () => {
    vi.stubGlobal('fetch', mockFetch(10))

    const outOfRange = await getChild(new Request('https://www.altarwed.com/sitemap/9.xml'), {
      params: Promise.resolve({ id: '9.xml' }),
    })
    expect(outOfRange.status).toBe(404)

    const malformed = await getChild(new Request('https://www.altarwed.com/sitemap/oops.xml'), {
      params: Promise.resolve({ id: 'oops.xml' }),
    })
    expect(malformed.status).toBe(404)
  })
})
