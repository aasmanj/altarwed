'use client'

import { useState } from 'react'

interface Prayer {
  id: string
  guestName: string
  prayerText: string
  createdAt: string
}

export default function PrayerWallSection({
  slug,
  initialPrayers,
  apiUrl,
}: {
  slug: string
  initialPrayers: Prayer[]
  apiUrl: string
}) {
  const [prayers, setPrayers] = useState<Prayer[]>(initialPrayers)
  const [guestName, setGuestName] = useState('')
  const [prayerText, setPrayerText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`${apiUrl}/api/v1/prayers/website/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestName: guestName.trim(), prayerText: prayerText.trim() }),
      })
      if (!res.ok) throw new Error()
      const newPrayer: Prayer = await res.json()
      setPrayers(prev => [newPrayer, ...prev])
      setGuestName('')
      setPrayerText('')
      setSubmitted(true)
      setTimeout(() => setSubmitted(false), 4000)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section>
      <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#3b2f2f] mb-6 text-center">
        Prayer Wall
      </h2>
      <p className="text-center text-[#6b5344] mb-8 text-sm">
        Leave a prayer or blessing for the couple as they begin their covenant journey.
      </p>

      {/* Submit form */}
      <div className="rounded-2xl border border-[#e8dcc8] bg-white p-6 mb-8">
        {submitted ? (
          <div className="text-center py-4">
            <p className="text-2xl mb-2">🙏</p>
            <p className="font-serif text-lg font-semibold text-[#3b2f2f]">Thank you for your prayer</p>
            <p className="text-sm text-[#6b5344] mt-1">Your blessing has been added to the prayer wall.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#6b5344] uppercase tracking-wide mb-1.5">
                Your name
              </label>
              <input
                required
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                maxLength={200}
                placeholder="Your name"
                className="w-full rounded-lg border border-[#e8dcc8] px-4 py-2.5 text-[#3b2f2f] text-sm focus:border-[#d4af6a] focus:outline-none focus:ring-1 focus:ring-[#d4af6a]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6b5344] uppercase tracking-wide mb-1.5">
                Your prayer or blessing
              </label>
              <textarea
                required
                value={prayerText}
                onChange={e => setPrayerText(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Lord, bless this couple…"
                className="w-full rounded-lg border border-[#e8dcc8] px-4 py-2.5 text-[#3b2f2f] text-sm focus:border-[#d4af6a] focus:outline-none focus:ring-1 focus:ring-[#d4af6a] resize-none"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#3b2f2f] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#5c4033] disabled:opacity-50 transition"
            >
              {submitting ? 'Submitting…' : 'Leave a prayer 🙏'}
            </button>
          </form>
        )}
      </div>

      {/* Prayer list */}
      {prayers.length > 0 && (
        <div className="space-y-4">
          {prayers.map(prayer => (
            <div key={prayer.id} className="rounded-2xl border border-[#e8dcc8] bg-white p-5">
              <p className="text-[#3b2f2f] leading-relaxed text-sm italic mb-3">
                &ldquo;{prayer.prayerText}&rdquo;
              </p>
              <p className="text-xs text-[#a08060] font-medium">— {prayer.guestName}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
