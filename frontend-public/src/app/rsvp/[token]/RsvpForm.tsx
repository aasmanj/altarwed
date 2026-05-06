'use client'

import { useState } from 'react'

type Status = 'ATTENDING' | 'DECLINING' | 'MAYBE'

export default function RsvpForm({
  token, plusOneAllowed, apiUrl,
}: {
  token: string
  plusOneAllowed: boolean
  apiUrl: string
}) {
  const [status, setStatus]       = useState<Status | null>(null)
  const [plusOne, setPlusOne]     = useState('')
  const [dietary, setDietary]     = useState('')
  const [meal, setMeal]           = useState('')
  const [song, setSong]           = useState('')
  const [shuttle, setShuttle]     = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]           = useState(false)
  const [error, setError]         = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!status) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`${apiUrl}/api/v1/guests/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          status,
          plusOneName: plusOne || undefined,
          dietaryRestrictions: dietary || undefined,
          mealPreference: meal || undefined,
          songRequest: song || undefined,
          shuttleNeeded: shuttle || undefined,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      setDone(true)
    } catch {
      setError('Something went wrong. Please try again or contact the couple directly.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="text-center space-y-3 py-4">
        <p className="text-2xl">{status === 'ATTENDING' ? '🎉' : '💌'}</p>
        <p className="font-serif text-xl font-semibold text-[#3b2f2f]">
          {status === 'ATTENDING' ? 'See you there!' : 'Thanks for letting us know'}
        </p>
        <p className="text-[#6b5344] text-sm">
          {status === 'ATTENDING'
            ? "We can't wait to celebrate with you."
            : "We'll miss you and appreciate you responding."}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Status selection */}
      <div>
        <p className="text-sm font-medium text-[#3b2f2f] mb-3 text-center">Will you be attending?</p>
        <div className="grid grid-cols-3 gap-3">
          {([
            { value: 'ATTENDING', label: 'Attending', icon: '✓' },
            { value: 'DECLINING', label: 'Declining', icon: '✗' },
            { value: 'MAYBE',     label: 'Maybe',     icon: '?' },
          ] as { value: Status; label: string; icon: string }[]).map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatus(opt.value)}
              className={`rounded-xl border py-3 text-sm font-medium transition ${
                status === opt.value
                  ? 'border-[#4a1942] bg-[#4a1942] text-white'
                  : 'border-[#e8dcc8] text-[#3b2f2f] hover:border-[#d4af6a]'
              }`}
            >
              <span className="block text-lg mb-0.5">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* +1 name — only show if attending and plusOneAllowed */}
      {status === 'ATTENDING' && plusOneAllowed && (
        <div>
          <label className="block text-sm font-medium text-[#3b2f2f] mb-1.5">
            Guest name <span className="text-[#a08060] font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={plusOne}
            onChange={e => setPlusOne(e.target.value)}
            placeholder="Your +1's name"
            className="w-full rounded-lg border border-[#e8dcc8] px-4 py-2.5 text-[#3b2f2f] text-sm focus:border-[#d4af6a] focus:outline-none focus:ring-1 focus:ring-[#d4af6a]"
          />
        </div>
      )}

      {/* Attending-only fields */}
      {status === 'ATTENDING' && (
        <>
          <div>
            <label className="block text-sm font-medium text-[#3b2f2f] mb-1.5">
              Meal preference <span className="text-[#a08060] font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={meal}
              onChange={e => setMeal(e.target.value)}
              placeholder="e.g. Chicken, Fish, Vegetarian"
              className="w-full rounded-lg border border-[#e8dcc8] px-4 py-2.5 text-[#3b2f2f] text-sm focus:border-[#d4af6a] focus:outline-none focus:ring-1 focus:ring-[#d4af6a]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#3b2f2f] mb-1.5">
              Dietary restrictions <span className="text-[#a08060] font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={dietary}
              onChange={e => setDietary(e.target.value)}
              placeholder="e.g. vegetarian, gluten-free, nut allergy"
              className="w-full rounded-lg border border-[#e8dcc8] px-4 py-2.5 text-[#3b2f2f] text-sm focus:border-[#d4af6a] focus:outline-none focus:ring-1 focus:ring-[#d4af6a]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#3b2f2f] mb-1.5">
              Song request <span className="text-[#a08060] font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={song}
              onChange={e => setSong(e.target.value)}
              placeholder="e.g. How Great Thou Art"
              className="w-full rounded-lg border border-[#e8dcc8] px-4 py-2.5 text-[#3b2f2f] text-sm focus:border-[#d4af6a] focus:outline-none focus:ring-1 focus:ring-[#d4af6a]"
            />
          </div>
          <label className="flex items-center gap-3 text-sm text-[#3b2f2f] cursor-pointer">
            <input
              type="checkbox"
              checked={shuttle}
              onChange={e => setShuttle(e.target.checked)}
              className="h-4 w-4 rounded border-[#e8dcc8] accent-[#4a1942]"
            />
            I&apos;ll need shuttle transportation
          </label>
        </>
      )}

      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}

      <button
        type="submit"
        disabled={!status || submitting}
        className="w-full rounded-xl bg-[#4a1942] py-3 font-semibold text-white hover:bg-[#3b1235] disabled:opacity-50 transition"
      >
        {submitting ? 'Submitting…' : 'Submit RSVP'}
      </button>
    </form>
  )
}
