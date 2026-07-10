'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Script from 'next/script'

interface RsvpFindResult {
  maskedName: string
  token: string
}

interface Props {
  slug: string
}

// Cloudflare Turnstile's browser API. Declared narrowly to just the two calls
// this widget uses (render, reset); see window.turnstile docs.
interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string
      callback: (token: string) => void
      'error-callback'?: () => void
      'expired-callback'?: () => void
    },
  ) => string
  reset: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

export const MIN_QUERY_LENGTH = 4

// Pure so the captchaToken-inclusion contract is unit-testable without a DOM: the
// param is only sent when a token exists, never as an empty string (an empty
// captchaToken= would fail verification once Turnstile is configured, exactly
// like a missing one, but sending it explicitly invites confusion in server logs).
export function buildFindUrl(apiBaseUrl: string, slug: string, name: string, captchaToken: string): string {
  const params = new URLSearchParams({ slug, name })
  if (captchaToken) params.set('captchaToken', captchaToken)
  return `${apiBaseUrl}/api/v1/guests/rsvp/find?${params.toString()}`
}

// A Managed Turnstile challenge normally resolves in well under this window; if
// it hasn't by then (Cloudflare outage, network issue, aggressive blocker), stop
// gating the button on it rather than leaving a guest permanently stuck. The
// search itself still runs, backend-enforced: if a captcha secret is actually
// configured, that one search 400s and the existing generic error path handles
// it, which beats a form the guest can never submit.
const TURNSTILE_READY_TIMEOUT_MS = 6000

export default function FindInvitationWidget({ slug }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<RsvpFindResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string>('')
  const [turnstileLoaded, setTurnstileLoaded] = useState(false)
  const [turnstileGaveUp, setTurnstileGaveUp] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const turnstileContainerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  // Issue #89: a real captcha gates the one endpoint that mints an RSVP capability
  // token from a bare name match, so scripted mass-enumeration of a wedding's guest
  // list is impractical. NEXT_PUBLIC_TURNSTILE_SITE_KEY is public by design (Cloudflare
  // site keys are meant to ship to the browser); the secret half never leaves the
  // backend. Unset in an environment with no Turnstile site configured yet, in which
  // case this widget renders nothing and the backend (also unconfigured) verifies
  // every request rather than breaking the feature -- see CloudflareTurnstileAdapter.
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  // Whether Turnstile has EVER produced a token this session. A ref, not state,
  // because the timeout callback below needs its current value without
  // re-running the effect that schedules it. Once true, the 6s "give up" timer
  // must never re-latch turnstileGaveUp: Turnstile demonstrably works in this
  // browser, so a later reset()-in-flight moment (between searches) should not
  // be permanently treated the same as "the script never loaded at all".
  const everReceivedTokenRef = useRef(false)

  // Render the widget explicitly (rather than the implicit `cf-turnstile` div
  // convention) so we can reset it after every search: a Turnstile token is
  // single-use, and re-mounting a fresh widget per search would flash/reflow
  // the layout on every attempt.
  useEffect(() => {
    if (!siteKey || !turnstileLoaded || !turnstileContainerRef.current || widgetIdRef.current) return
    widgetIdRef.current = window.turnstile!.render(turnstileContainerRef.current, {
      sitekey: siteKey,
      callback: token => {
        everReceivedTokenRef.current = true
        setCaptchaToken(token)
      },
      'error-callback': () => setCaptchaToken(''),
      'expired-callback': () => setCaptchaToken(''),
    })
  }, [siteKey, turnstileLoaded])

  // Bounded wait for a token before giving up on gating the button (see
  // TURNSTILE_READY_TIMEOUT_MS above). Cleared on unmount so it never fires
  // after the widget has already produced a token or the page has moved on.
  // Only actually gives up if no token has EVER arrived: without the ref check,
  // this would also fire during the brief window after a post-search reset()
  // (captchaToken momentarily empty again) and permanently disable the
  // ready-gate for the rest of the session even though Turnstile is working fine.
  useEffect(() => {
    if (!siteKey) return
    const timer = setTimeout(() => {
      if (!everReceivedTokenRef.current) setTurnstileGaveUp(true)
    }, TURNSTILE_READY_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [siteKey])

  const resetCaptcha = useCallback(() => {
    if (siteKey && widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current)
    }
    setCaptchaToken('')
  }, [siteKey])

  const waitingOnCaptcha = Boolean(siteKey) && !captchaToken && !turnstileGaveUp

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = query.trim()
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setError(`Please enter at least ${MIN_QUERY_LENGTH} characters.`)
      return
    }

    setLoading(true)
    setError(null)
    setResults(null)

    try {
      const url = buildFindUrl(process.env.NEXT_PUBLIC_API_URL ?? '', slug, trimmed, captchaToken)
      const res = await fetch(url)
      if (res.status === 429) {
        setError('Too many searches from your network. Please wait a minute and try again.')
        return
      }
      if (!res.ok) throw new Error('Search failed')
      const data: RsvpFindResult[] = await res.json()
      setResults(data)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
      // A Turnstile token is single-use; get a fresh one ready for the next search.
      resetCaptcha()
    }
  }

  return (
    <div className="space-y-6">
      {siteKey && (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js"
            strategy="afterInteractive"
            onLoad={() => setTurnstileLoaded(true)}
          />
          <div ref={turnstileContainerRef} />
        </>
      )}

      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Type your first and last name..."
          className="flex-1 rounded-xl border border-[color-mix(in_srgb,var(--accent)_50%,transparent)] bg-white px-4 py-3 text-[#3b2f2f] placeholder-[#8a6a4a] shadow-sm focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_30%,transparent)]"
          autoComplete="off"
          aria-label="Your name"
        />
        <button
          type="submit"
          disabled={loading || query.trim().length < MIN_QUERY_LENGTH || waitingOnCaptcha}
          className="w-full sm:w-auto rounded-xl bg-[var(--accent)] px-6 py-3 font-semibold text-[#3b2f2f] shadow transition hover:bg-[#b8963e] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Searching...' : 'Find Me'}
        </button>
      </form>

      {waitingOnCaptcha && !error && (
        <p role="status" className="text-center text-sm text-[#8a6a4a]">Verifying you&apos;re human...</p>
      )}

      {error && (
        <p role="alert" className="text-center text-sm text-red-600">{error}</p>
      )}

      {results !== null && results.length === 0 && (
        <div role="status" className="rounded-xl border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-amber-50 p-6 text-center">
          <p className="text-sm text-[#6b5344]">
            Oops! We&apos;re having trouble finding your invite. Please try another spelling of your name or contact the couple
          </p>
        </div>
      )}

      {results && results.length > 0 && (
        <div role="status" className="space-y-3">
          <p className="text-center text-sm text-[#8a6a4a]">
            {results.length === 1 ? 'We found your invitation!' : `We found ${results.length} matches. Select yours below.`}
          </p>
          {results.map((r, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl border border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-white px-5 py-4 shadow-sm"
            >
              <span className="font-serif text-lg font-semibold text-[#3b2f2f]">{r.maskedName}</span>
              <a
                href={`/rsvp/${r.token}`}
                className="shrink-0 rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[#3b2f2f] shadow transition hover:bg-[#b8963e]"
              >
                RSVP Now
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
