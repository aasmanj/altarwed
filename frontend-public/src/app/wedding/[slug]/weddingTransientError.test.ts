import { describe, it, expect, afterEach, vi } from 'vitest'
import { getWedding } from '@/app/wedding/[slug]/data'

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
