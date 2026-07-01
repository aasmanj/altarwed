'use client'

import { useState, useRef } from 'react'

interface RsvpFindResult {
  maskedName: string
  token: string
}

interface Props {
  slug: string
}

export default function FindInvitationWidget({ slug }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<RsvpFindResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setError('Please enter at least 2 characters.')
      return
    }

    setLoading(true)
    setError(null)
    setResults(null)

    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/guests/rsvp/find?slug=${encodeURIComponent(slug)}&name=${encodeURIComponent(trimmed)}`
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
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Type your first and last name..."
          className="flex-1 rounded-xl border border-[#d4af6a]/50 bg-white px-4 py-3 text-[#3b2f2f] placeholder-[#8a6a4a] shadow-sm focus:border-[#d4af6a] focus:outline-none focus:ring-2 focus:ring-[#d4af6a]/30"
          autoComplete="off"
          aria-label="Your name"
        />
        <button
          type="submit"
          disabled={loading || query.trim().length < 2}
          className="w-full sm:w-auto rounded-xl bg-[#d4af6a] px-6 py-3 font-semibold text-[#3b2f2f] shadow transition hover:bg-[#b8963e] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Searching...' : 'Find Me'}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-center text-sm text-red-600">{error}</p>
      )}

      {results !== null && results.length === 0 && (
        <div role="status" className="rounded-xl border border-[#d4af6a]/30 bg-amber-50 p-6 text-center">
          <p className="font-medium text-[#3b2f2f]">No invitation found</p>
          <p className="mt-1 text-sm text-[#6b5344]">
            Try a different spelling, or contact the couple directly to make sure you&apos;re on the guest list.
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
              className="flex items-center justify-between rounded-xl border border-[#d4af6a]/40 bg-white px-5 py-4 shadow-sm"
            >
              <span className="font-serif text-lg font-semibold text-[#3b2f2f]">{r.maskedName}</span>
              <a
                href={`/rsvp/${r.token}`}
                className="shrink-0 rounded-lg bg-[#d4af6a] px-5 py-3 text-sm font-semibold text-[#3b2f2f] shadow transition hover:bg-[#b8963e]"
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
