import { describe, it, expect, afterEach, vi } from 'vitest'
import { getRsvpData } from '@/app/rsvp/[token]/getRsvpData'

// Behavioral guard for issue #147: a guest holding a valid, unexpired RSVP token
// was shown the terminal "this link is no longer valid, contact the couple"
// message on ANY non-2xx or network error, including a 5xx cold start or timeout.
// getRsvpData now classifies the failure so the page can render a neutral
// "temporarily unavailable, try again" state for transient errors and reserve the
// terminal copy for a genuine 400/404. Each case fails on the pre-fix source
// (which returned null for every error) and passes after.

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
  guestName: 'Guest',
  coupleNames: 'Sam and Alex',
  weddingDate: null,
  venueName: null,
  venueCity: null,
  venueState: null,
  plusOneAllowed: false,
  weddingSlug: null,
  hasRegistry: false,
  partyMembers: null,
  partyName: null,
  currentRsvpStatus: null,
  currentPlusOneName: null,
  currentDietary: null,
  currentSongRequest: null,
  currentNoteForCouple: null,
  customQuestions: null,
}

describe('getRsvpData error classification (issue #147)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns ok with data on a 200 response', async () => {
    mockFetch(() => jsonResponse(200, validPayload))
    const result = await getRsvpData('good-token')
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.data.coupleNames).toBe('Sam and Alex')
    }
  })

  it('classifies a 404 as an invalid/expired token (terminal copy)', async () => {
    mockFetch(() => jsonResponse(404, { message: 'not found' }))
    const result = await getRsvpData('missing-token')
    expect(result.status).toBe('invalid')
  })

  it('classifies a 400 as an invalid/expired token (terminal copy)', async () => {
    mockFetch(() => jsonResponse(400, { message: 'bad token' }))
    const result = await getRsvpData('bad-token')
    expect(result.status).toBe('invalid')
  })

  it('classifies a 500 as transiently unavailable, not a dead link', async () => {
    mockFetch(() => jsonResponse(500, { message: 'boom' }))
    const result = await getRsvpData('valid-token')
    expect(result.status).toBe('unavailable')
    expect(result.status).not.toBe('invalid')
  })

  it('classifies a 503 cold start as transiently unavailable', async () => {
    mockFetch(() => jsonResponse(503, { message: 'starting up' }))
    const result = await getRsvpData('valid-token')
    expect(result.status).toBe('unavailable')
  })

  it('classifies a network error / timeout as transiently unavailable', async () => {
    mockFetch(() => Promise.reject(new Error('network timeout')))
    const result = await getRsvpData('valid-token')
    expect(result.status).toBe('unavailable')
  })

  it('classifies a malformed 200 body as transiently unavailable, not terminal', async () => {
    mockFetch(
      () =>
        new Response('not json', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )
    const result = await getRsvpData('valid-token')
    expect(result.status).toBe('unavailable')
  })
})

// Source-level guard that the page actually renders the distinct transient state
// and did not collapse both failure classes back into the terminal message.
describe('RSVP page renders a distinct transient-error state (issue #147)', () => {
  it('handles the unavailable branch separately from the invalid branch', async () => {
    const { readFileSync } = await import('fs')
    const path = await import('path')
    const src = readFileSync(
      path.join(process.cwd(), 'src', 'app', 'rsvp', '[token]', 'page.tsx'),
      'utf8',
    )
    expect(src).toContain("result.status === 'unavailable'")
    expect(src).toContain("result.status === 'invalid'")
    expect(src).toContain('try again in a few moments')
    // The terminal "contact the couple" copy must not be the only failure state.
    expect(src).toContain('trouble loading your invitation')
  })
})
