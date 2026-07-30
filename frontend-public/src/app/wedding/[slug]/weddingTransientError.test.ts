import { describe, it, expect, afterEach, vi } from 'vitest'
import { getWedding, getPublishedWedding } from '@/app/wedding/[slug]/data'

// Behavioral guard for issue #148: a published wedding site rendered the terminal
// "this wedding doesn't exist" notFound() page on ANY non-404 error, because
// getWedding returned null for 5xx/network/timeout as well as a real 404. That
// false 404 landed on the platform's core SEO/ad surface during a backend blip.
//
// getWedding now returns null ONLY for a genuine 404 (so the caller still renders
// notFound() for a site that truly does not exist) and THROWS on every transient
// failure, so Next serves the stale ISR cache (stale-while-revalidate) or a
// generic error boundary instead of a false not-found. Each 5xx/network case here
// fails on the pre-fix source (which returned null) and passes after.

function mockFetch(impl: () => Promise<Response> | Response) {
  vi.stubGlobal('fetch', vi.fn(impl))
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const validPayload = {
  id: 'w1',
  slug: 'sam-and-alex',
  isPublished: true,
  partnerOneName: 'Alex',
  partnerTwoName: 'Sam',
  weddingDate: null,
}

describe('getWedding error classification (issue #148)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns the wedding on a 200 response', async () => {
    mockFetch(() => jsonResponse(200, validPayload))
    const wedding = await getWedding('sam-and-alex')
    expect(wedding?.slug).toBe('sam-and-alex')
  })

  it('returns null on a genuine 404 so the caller renders notFound()', async () => {
    mockFetch(() => jsonResponse(404, { message: 'not found' }))
    const wedding = await getWedding('does-not-exist')
    expect(wedding).toBeNull()
  })

  it('throws on a 500 instead of returning null (no false notFound during outage)', async () => {
    mockFetch(() => jsonResponse(500, { message: 'boom' }))
    await expect(getWedding('sam-and-alex')).rejects.toThrow()
    // Exactly one fetch: a 5xx must never be rerouted into the unpublished-draft
    // probe (that would resurrect the #148 soft-404 during an outage).
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('throws on a 503 cold start instead of returning null', async () => {
    mockFetch(() => jsonResponse(503, { message: 'starting up' }))
    await expect(getWedding('sam-and-alex')).rejects.toThrow()
  })

  it('throws on a network error / timeout instead of returning null', async () => {
    mockFetch(() => Promise.reject(new Error('network timeout')))
    await expect(getWedding('sam-and-alex')).rejects.toThrow()
  })

  it('throws on a malformed 200 body instead of returning null', async () => {
    mockFetch(
      () =>
        new Response('not json', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )
    await expect(getWedding('sam-and-alex')).rejects.toThrow()
  })
})

// The backend 404s /slug/{slug} for BOTH missing sites and unpublished drafts
// (issue #91), so getWedding disambiguates through the public /preview endpoint.
// An unpublished draft must reach the layout (which renders ComingSoon on
// isPublished=false) instead of returning null and burning a bare 404 on a URL
// the couple may already have shared with guests.
describe('getWedding unpublished-draft fallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const draftPayload = { ...validPayload, isPublished: false }

  function mockFetchByUrl(impl: (url: string) => Promise<Response> | Response) {
    vi.stubGlobal('fetch', vi.fn((url: RequestInfo | URL) => impl(String(url))))
  }

  it('returns the draft when /slug 404s but /preview serves an unpublished site', async () => {
    const seen: string[] = []
    mockFetchByUrl((url) => {
      seen.push(url)
      return url.endsWith('/api/v1/wedding-websites/preview/sam-and-alex')
        ? jsonResponse(200, draftPayload)
        : jsonResponse(404, { message: 'not found' })
    })
    const wedding = await getWedding('sam-and-alex')
    expect(wedding?.isPublished).toBe(false)
    expect(wedding?.slug).toBe('sam-and-alex')
    // The probe must hit the preview endpoint for the SAME slug, nothing else.
    expect(seen.filter(u => u.includes('/preview/'))).toEqual([
      expect.stringMatching(/\/api\/v1\/wedding-websites\/preview\/sam-and-alex$/),
    ])
  })

  it('returns null when the /preview probe answers non-ok (500)', async () => {
    mockFetchByUrl((url) =>
      url.includes('/preview/')
        ? jsonResponse(500, { message: 'boom' })
        : jsonResponse(404, { message: 'not found' }),
    )
    const wedding = await getWedding('sam-and-alex')
    expect(wedding).toBeNull()
  })

  it('returns null when the /preview probe 200s with a misshapen body (no isPublished boolean)', async () => {
    mockFetchByUrl((url) =>
      url.includes('/preview/')
        ? jsonResponse(200, { error: 'unexpected envelope' })
        : jsonResponse(404, { message: 'not found' }),
    )
    const wedding = await getWedding('sam-and-alex')
    expect(wedding).toBeNull()
  })

  it('returns null when /slug and /preview both 404 (site truly does not exist)', async () => {
    mockFetchByUrl(() => jsonResponse(404, { message: 'not found' }))
    const wedding = await getWedding('does-not-exist')
    expect(wedding).toBeNull()
  })

  it('returns null when the /preview probe fails transiently (no throw after a definitive /slug 404)', async () => {
    mockFetchByUrl((url) =>
      url.includes('/preview/')
        ? Promise.reject(new Error('network timeout'))
        : jsonResponse(404, { message: 'not found' }),
    )
    const wedding = await getWedding('sam-and-alex')
    expect(wedding).toBeNull()
  })

  it('does not probe /preview in fresh mode (already hit /preview directly)', async () => {
    const fetchMock = vi.fn(() => jsonResponse(404, { message: 'not found' }))
    vi.stubGlobal('fetch', fetchMock)
    const wedding = await getWedding('sam-and-alex', true)
    expect(wedding).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

// getPublishedWedding is the tab pages' gate (see draftPageGate.test.ts for the
// source scan that forces every page through it). Published sites pass through,
// drafts collapse to null (page renders nothing), missing sites throw notFound.
describe('getPublishedWedding tab-page gate', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns the wedding for a published site', async () => {
    mockFetch(() => jsonResponse(200, validPayload))
    const wedding = await getPublishedWedding('sam-and-alex')
    expect(wedding?.slug).toBe('sam-and-alex')
  })

  it('returns null (render nothing) for an unpublished draft', async () => {
    vi.stubGlobal('fetch', vi.fn((url: RequestInfo | URL) =>
      String(url).includes('/preview/')
        ? jsonResponse(200, { ...validPayload, isPublished: false })
        : jsonResponse(404, { message: 'not found' }),
    ))
    const wedding = await getPublishedWedding('sam-and-alex')
    expect(wedding).toBeNull()
  })

  it('throws notFound for a site that does not exist', async () => {
    mockFetch(() => jsonResponse(404, { message: 'not found' }))
    await expect(getPublishedWedding('does-not-exist')).rejects.toThrow()
  })
})
