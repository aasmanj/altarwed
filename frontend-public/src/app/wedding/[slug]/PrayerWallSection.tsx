'use client'

import { useRef, useState } from 'react'
import { Heart, Loader2, Sparkles } from 'lucide-react'

interface Prayer {
  id: string
  guestName: string
  prayerText: string
  createdAt: string
  _isNew?: boolean
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
  const newPrayerRef = useRef<HTMLDivElement>(null)

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
      setPrayers(prev => [{ ...newPrayer, _isNew: true }, ...prev])
      setGuestName('')
      setPrayerText('')
      setSubmitted(true)
      setTimeout(() => setSubmitted(false), 4000)
      setTimeout(() => newPrayerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section>
      <div className="text-center mb-6">
        <div className="flex justify-center mb-2">
          <Heart className="w-6 h-6 text-[#d4af6a]" strokeWidth={1.5} />
        </div>
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#3b2f2f]">
          Prayer Wall
        </h2>
        <p className="text-center text-[#6b5344] mt-2 text-sm">
          Leave a prayer or blessing for the couple as they begin their covenant journey.
        </p>
      </div>

      {/* Submit form */}
      <div className="rounded-2xl border border-[#e8dcc8] bg-white p-6 mb-8">
        {submitted ? (
          <div className="text-center py-4">
            <div className="flex justify-center mb-2">
              <Sparkles className="w-7 h-7 text-[#d4af6a]" />
            </div>
            <p className="font-serif text-lg font-semibold text-[#3b2f2f]">Thank you for your prayer</p>
            <p className="text-sm text-[#6b5344] mt-1">Your blessing has been added below.</p>
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
              className="inline-flex items-center gap-2 rounded-lg bg-[#3b2f2f] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#5c4033] disabled:opacity-50 transition"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting…
                </>
              ) : 'Leave a prayer'}
            </button>
          </form>
        )}
      </div>

      {/* Prayer list */}
      {prayers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {prayers.map((prayer, i) => (
            <div
              key={prayer.id}
              ref={i === 0 ? newPrayerRef : undefined}
              className={`rounded-2xl border border-[#e8dcc8] bg-white p-5 transition-all duration-500 ${prayer._isNew ? 'ring-2 ring-[#d4af6a]/40' : ''}`}
            >
              <p className="text-[#3b2f2f] leading-relaxed text-sm italic mb-3">
                &ldquo;{prayer.prayerText}&rdquo;
              </p>
              <p className="text-xs text-[#a08060] font-medium">— {prayer.guestName}</p>
            </div>
          ))}
        </div>
      )}

      {prayers.length === 0 && !submitted && (
        <div className="text-center py-6 text-[#a08060]">
          <p className="font-serif text-base">Be the first to leave a blessing</p>
        </div>
      )}
    </section>
  )
}
