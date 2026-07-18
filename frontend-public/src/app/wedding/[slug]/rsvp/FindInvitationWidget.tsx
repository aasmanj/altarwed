'use client'

import { useState, useRef } from 'react'
import { useTurnstile } from '@/lib/useTurnstile'

interface RsvpFindResult {
  maskedName: string
  token: string
}

interface Props {
  slug: string
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

export default function FindInvitationWidget({ slug }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<RsvpFindResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Issue #89: a real captcha gates the one endpoint that mints an RSVP capability
  // token from a bare name match, so scripted mass-enumeration of a wedding's guest
  // list is impractical. All widget mechanics (single-use token reset, bounded
  // ready-gate, never-re-latch guard) live in the shared useTurnstile hook, also
  // used by the vendor inquiry form (issue #100).
  const { captchaToken, waitingOnCaptcha, resetCaptcha, turnstileSlot } = useTurnstile()

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
      {turnstileSlot}

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
          className="w-full sm:w-auto rounded-xl bg-[var(--accent)] px-6 py-3 font-semibold text-[var(--on-accent)] shadow transition hover:bg-[color-mix(in_srgb,var(--accent)_88%,black)] disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="shrink-0 rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--on-accent)] shadow transition hover:bg-[color-mix(in_srgb,var(--accent)_88%,black)]"
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
