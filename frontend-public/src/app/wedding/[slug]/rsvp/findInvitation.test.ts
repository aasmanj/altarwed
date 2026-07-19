import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { MIN_QUERY_LENGTH, buildFindUrl } from './FindInvitationWidget'

// Issue #89: the RSVP find-invitation search is the one unauthenticated endpoint
// that mints a live RSVP capability token from a bare name guess. Two independent
// hardenings landed here: the minimum query length was raised from 2 to 4 (a
// 2-character "contains" match returns real guests for common prefixes), and a
// Cloudflare Turnstile captcha token is now sent with every search.
//
// vitest runs in a node environment here (no jsdom / testing-library), so the
// pure buildFindUrl/MIN_QUERY_LENGTH contract is asserted directly; the widget's
// DOM/script-loading behavior (rendering the Turnstile div, resetting after each
// search) is verified by source-level wiring assertions below.

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

describe('MIN_QUERY_LENGTH (issue #89)', () => {
  it('is raised to 4, not the old 2, to rule out short high-yield guesses', () => {
    expect(MIN_QUERY_LENGTH).toBe(4)
  })
})

describe('buildFindUrl (issue #89)', () => {
  it('includes the captchaToken param when a token is present', () => {
    const url = buildFindUrl('https://api.altarwed.com', 'sam-and-alex', 'Jordan', 'tok_123')
    const parsed = new URL(url)
    expect(parsed.pathname).toBe('/api/v1/guests/rsvp/find')
    expect(parsed.searchParams.get('slug')).toBe('sam-and-alex')
    expect(parsed.searchParams.get('name')).toBe('Jordan')
    expect(parsed.searchParams.get('captchaToken')).toBe('tok_123')
  })

  it('omits captchaToken entirely (not an empty string) when no token exists', () => {
    // Distinguishes "Turnstile not configured / not yet resolved" from "explicitly
    // sent an empty token", which would otherwise look identical to the backend but
    // reads worse in logs and is simply not what actually happened client-side.
    const url = buildFindUrl('https://api.altarwed.com', 'sam-and-alex', 'Jordan', '')
    const parsed = new URL(url)
    expect(parsed.searchParams.has('captchaToken')).toBe(false)
  })
})

// Issue #100 extracted the widget mechanics (script loading, single-use token
// reset, bounded ready-gate, never-re-latch guard) into the shared useTurnstile
// hook so the vendor inquiry form gets the identical behavior. The invariants
// below are unchanged from #89; only where they live moved: hook-level
// assertions now read lib/useTurnstile.tsx, form-level ones still read the widget.
describe('FindInvitationWidget wiring (issue #89)', () => {
  const src = read('app/wedding/[slug]/rsvp/FindInvitationWidget.tsx')
  const hookSrc = read('lib/useTurnstile.tsx')

  it('renders the Turnstile widget only when a site key is configured', () => {
    expect(hookSrc).toContain('process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY')
    expect(hookSrc).toContain('siteKey ? (')
    expect(hookSrc).toContain('challenges.cloudflare.com/turnstile/v0/api.js')
    expect(src).toContain('{turnstileSlot}')
  })

  it('resets the captcha widget after every search attempt (token is single-use)', () => {
    expect(src).toContain('resetCaptcha()')
  })

  it('rejects a query shorter than MIN_QUERY_LENGTH before calling the API', () => {
    expect(src).toContain('trimmed.length < MIN_QUERY_LENGTH')
  })

  it('disables the Find button until a captcha token is ready, with a bounded timeout', () => {
    // A review of the first version of this widget found the submit button was
    // gated only on query length, so a guest could submit before Turnstile's
    // challenge resolved and silently get a 400 with no useful explanation.
    // waitingOnCaptcha must gate the button AND time out rather than trap a
    // guest forever if Cloudflare's script never loads.
    expect(src).toContain('|| waitingOnCaptcha')
    expect(hookSrc).toContain('turnstileGaveUp')
    expect(hookSrc).toContain('TURNSTILE_READY_TIMEOUT_MS')
  })

  it('shows a visible status while waiting on the captcha, not a silent disabled button', () => {
    expect(src).toContain("Verifying you&apos;re human...")
  })

  it('never lets the give-up timeout re-latch once a token has ever arrived', () => {
    // A review found the first version of this timeout fired unconditionally at
    // 6s regardless of whether a token had already been received, permanently
    // disabling the ready-gate for the rest of the session the moment a
    // post-search resetCaptcha() briefly cleared the token. The fix tracks
    // whether a token has EVER arrived in a ref and only allows the timeout to
    // set turnstileGaveUp when that ref is still false.
    expect(hookSrc).toContain('everReceivedTokenRef')
    expect(hookSrc).toContain('if (!everReceivedTokenRef.current) setTurnstileGaveUp(true)')
  })
})

describe('no-match copy (issue #331)', () => {
  const src = read('app/wedding/[slug]/rsvp/FindInvitationWidget.tsx')

  it('shows the softer single-sentence not-found copy inside a role=status box', () => {
    expect(src).toContain(
      'Oops! We&apos;re having trouble finding your invite. Please try another spelling of your name or contact the couple',
    )
  })

  it('no longer shows either of the old two-paragraph strings', () => {
    expect(src).not.toContain('No invitation found')
    expect(src).not.toContain(
      'Try a different spelling, or contact the couple directly to make sure you&apos;re on the guest list.',
    )
  })
})
