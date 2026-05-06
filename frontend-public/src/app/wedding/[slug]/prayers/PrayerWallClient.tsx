'use client'

import { useState } from 'react'

interface Prayer {
  id: string
  guestName: string
  prayerText: string
  createdAt: string
}

const COLORS = [
  'bg-[#fdf6ec] border-[#e8d5b0]',
  'bg-[#f0f7f4] border-[#b8d9c8]',
  'bg-[#f5f0f8] border-[#d4b8e0]',
  'bg-[#fef9ec] border-[#e8dba0]',
  'bg-[#f0f4f8] border-[#b0c8e0]',
]

function cardColor(index: number) {
  return COLORS[index % COLORS.length]
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  return months === 1 ? '1 month ago' : `${months} months ago`
}

export default function PrayerWallClient({
  slug,
  coupleNames,
  initialPrayers,
  apiUrl,
}: {
  slug: string
  coupleNames: string
  initialPrayers: Prayer[]
  apiUrl: string
}) {
  const [prayers, setPrayers] = useState<Prayer[]>(initialPrayers)
  const [guestName, setGuestName] = useState('')
  const [prayerText, setPrayerText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
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
      setTimeout(() => setSubmitted(false), 5000)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="text-center">
        <div className="text-4xl mb-3">🙏</div>
        <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#3b2f2f]">Blessings & Prayers</h2>
        <p className="mt-3 text-[#6b5344] text-sm max-w-sm mx-auto leading-relaxed">
          Leave a prayer or blessing for {coupleNames} as they begin their covenant journey together.
        </p>
      </div>

      {/* Write a blessing form */}
      <div className="relative">
        {/* Decorative ruled lines behind the form — guestbook feel */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border-b border-[#e8dcc8]/50" style={{ height: '2.5rem' }} />
          ))}
        </div>

        <div className="relative bg-[#fffef9] rounded-2xl border border-[#e8dcc8] shadow-sm p-7">
          <div className="flex items-center gap-2 mb-5">
            <div className="h-px flex-1 bg-[#e8dcc8]" />
            <p className="text-xs uppercase tracking-[0.2em] text-[#a08060] px-2">Write a blessing</p>
            <div className="h-px flex-1 bg-[#e8dcc8]" />
          </div>

          {submitted ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-3">✨</div>
              <p className="font-serif text-xl font-semibold text-[#3b2f2f]">Thank you for your prayer!</p>
              <p className="text-sm text-[#6b5344] mt-2">Your blessing has been added to the wall.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                required
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                maxLength={200}
                placeholder="Your name"
                className="w-full bg-transparent border-b border-[#d4af6a]/60 py-2 text-[#3b2f2f] placeholder-[#c0a882] focus:outline-none focus:border-[#d4af6a] text-sm transition"
              />
              <textarea
                required
                value={prayerText}
                onChange={e => setPrayerText(e.target.value)}
                maxLength={2000}
                rows={4}
                placeholder="Lord, bless this couple as they covenant together…"
                className="w-full bg-transparent border-b border-[#d4af6a]/60 py-2 text-[#3b2f2f] placeholder-[#c0a882] focus:outline-none focus:border-[#d4af6a] text-sm resize-none transition leading-relaxed"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-full bg-[#3b2f2f] px-6 py-2.5 text-xs font-semibold uppercase tracking-widest text-white hover:bg-[#5c4033] disabled:opacity-50 transition"
                >
                  {submitting ? 'Adding…' : 'Add My Blessing'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Prayer cards — masonry-style, different pastel backgrounds */}
      {prayers.length > 0 && (
        <div>
          <p className="text-center text-xs uppercase tracking-[0.2em] text-[#a08060] mb-6">
            {prayers.length} {prayers.length === 1 ? 'blessing' : 'blessings'} so far
          </p>
          <div className="columns-1 sm:columns-2 gap-4 space-y-4">
            {prayers.map((prayer, i) => (
              <div
                key={prayer.id}
                className={`break-inside-avoid rounded-2xl border p-5 ${cardColor(i)}`}
              >
                {/* Tiny cross ornament */}
                <div className="text-center text-[#d4af6a]/60 text-xs mb-3">✦</div>
                <p className="text-[#3b2f2f] leading-relaxed text-sm font-serif italic mb-4">
                  &ldquo;{prayer.prayerText}&rdquo;
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#6b5344]">— {prayer.guestName}</p>
                  <p className="text-xs text-[#a08060]">{timeAgo(prayer.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {prayers.length === 0 && !submitted && (
        <div className="text-center py-8 text-[#a08060]">
          <p className="font-serif text-lg">Be the first to leave a blessing</p>
        </div>
      )}
    </div>
  )
}
