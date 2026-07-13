import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GET as getChild } from '@/app/sitemap/[id]/route'
import { loadSitemapUrls } from './sitemapData'

// Issue #369: the /vendors/[category]/[city] landing pages must be discoverable in
// the sitemap. This wires the real loadSitemapUrls + child-sitemap route against a
// mocked vendor directory and asserts the landing URLs land in the emitted XML. It
// exercises the new vendor-combo walk in sitemapData, so it fails before the change
// (no such URLs) and passes after.

// Mock the three feeds loadSitemapUrls hits. The vendor directory returns two
// Dallas photographers plus one lossy-city (St. Louis) florist. The published and
// blog feeds are empty so the walk terminates immediately and the test stays fast.
function mockFetch() {
  return vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input.toString()

    if (url.includes('/api/v1/vendors')) {
      const parsed = new URL(url)
      const category = parsed.searchParams.get('category')
      const page = Number(parsed.searchParams.get('page') ?? '0')
      if (page > 0) {
        return new Response(JSON.stringify({ vendors: [], total: 0 }), { status: 200 })
      }
      if (category === 'PHOTOGRAPHER') {
        return new Response(
          JSON.stringify({
            vendors: [
              { category: 'PHOTOGRAPHER', city: 'Dallas', state: 'TX' },
              { category: 'PHOTOGRAPHER', city: 'Dallas', state: 'TX' },
            ],
            total: 2,
          }),
          { status: 200 },
        )
      }
      if (category === 'FLORIST') {
        return new Response(
          JSON.stringify({
            // Lossy slug city: must be excluded from the sitemap.
            vendors: [{ category: 'FLORIST', city: 'St. Louis', state: 'MO' }],
            total: 1,
          }),
          { status: 200 },
        )
      }
      return new Response(JSON.stringify({ vendors: [], total: 0 }), { status: 200 })
    }

    // Wedding + blog feeds empty.
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

describe('sitemap includes vendor category/city landing pages (#369)', () => {
  it('emits a landing URL for a real (category, city) combo', async () => {
    vi.stubGlobal('fetch', mockFetch())
    const urls = await loadSitemapUrls()
    const paths = urls.map((u) => u.url)
    expect(paths).toContain('https://www.altarwed.com/vendors/photographer/dallas')
  })

  it('dedupes duplicate vendors into a single landing URL', async () => {
    vi.stubGlobal('fetch', mockFetch())
    const urls = await loadSitemapUrls()
    const dallas = urls.filter((u) => u.url === 'https://www.altarwed.com/vendors/photographer/dallas')
    expect(dallas).toHaveLength(1)
  })

  it('excludes lossy-slug cities that a landing page could not render', async () => {
    vi.stubGlobal('fetch', mockFetch())
    const urls = await loadSitemapUrls()
    expect(urls.some((u) => u.url.includes('/vendors/florist/'))).toBe(false)
  })

  it('serves the landing URL inside the rendered child sitemap XML', async () => {
    vi.stubGlobal('fetch', mockFetch())
    const res = await getChild(new Request('https://www.altarwed.com/sitemap/0.xml'), {
      params: Promise.resolve({ id: '0.xml' }),
    })
    const xml = await res.text()
    expect(xml).toContain('<loc>https://www.altarwed.com/vendors/photographer/dallas</loc>')
  })
})
