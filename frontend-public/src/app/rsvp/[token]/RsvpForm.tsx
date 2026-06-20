'use client'

import { useState } from 'react'

// PENDING is the "remind me" path, status stays PENDING, remindInDays is sent.
type Status = 'ATTENDING' | 'DECLINING' | 'PENDING'

interface PartyMemberInfo {
  guestId: string
  name: string
}

type PartyStatus = 'ATTENDING' | 'DECLINING' | 'PENDING'

export default function RsvpForm({
  token, plusOneAllowed, weddingSlug, hasRegistry, apiUrl, partyMembers,
  currentRsvpStatus, currentPlusOneName, currentDietary, currentSongRequest, currentNoteForCouple,
}: {
  token: string
  plusOneAllowed: boolean
  weddingSlug: string | null
  hasRegistry: boolean
  apiUrl: string
  partyMembers?: PartyMemberInfo[]
  currentRsvpStatus?: string
  currentPlusOneName?: string
  currentDietary?: string
  currentSongRequest?: string
  currentNoteForCouple?: string
}) {
  const hasExistingResponse = currentRsvpStatus === 'ATTENDING' || currentRsvpStatus === 'DECLINING'

  const [status, setStatus]             = useState<Status | null>(
    hasExistingResponse ? (currentRsvpStatus as Status) : null
  )
  const [remindInDays, setRemindInDays] = useState<number | null>(null)
  // partyStatuses: keyed by guestId, value is ATTENDING/DECLINING/PENDING
  const [partyStatuses, setPartyStatuses] = useState<Record<string, PartyStatus>>(() => {
    const init: Record<string, PartyStatus> = {}
    partyMembers?.forEach(m => { init[m.guestId] = 'ATTENDING' })
    return init
  })
  const [plusOne, setPlusOne]           = useState(currentPlusOneName ?? '')
  const [dietary, setDietary]           = useState(currentDietary ?? '')
  const [song, setSong]                 = useState(currentSongRequest ?? '')
  const [noteForCouple, setNoteForCouple] = useState(currentNoteForCouple ?? '')
  const [submitting, setSubmitting]     = useState(false)
  const [done, setDone]                 = useState(false)
  const [error, setError]               = useState('')

  // A submission is ready when ATTENDING/DECLINING is selected,
  // OR the guest chose "remind me" and picked an interval.
  const isReady = (status === 'ATTENDING' || status === 'DECLINING') ||
                  (status === 'PENDING' && remindInDays !== null)

  const handleStatusSelect = (s: Status) => {
    setStatus(s)
    if (s !== 'PENDING') setRemindInDays(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isReady) return
    setSubmitting(true)
    setError('')
    try {
      // Build party responses for other members
      const partyResponses = partyMembers && partyMembers.length > 0
        ? partyMembers.map(m => ({ guestId: m.guestId, status: partyStatuses[m.guestId] ?? 'ATTENDING' }))
        : undefined

      const res = await fetch(`${apiUrl}/api/v1/guests/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          status: status ?? 'PENDING',
          plusOneName: plusOne || undefined,
          dietaryRestrictions: dietary || undefined,
          songRequest: song || undefined,
          noteForCouple: noteForCouple.trim() || undefined,
          remindInDays: remindInDays ?? undefined,
          partyResponses,
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
      <div role="status" className="text-center space-y-4 py-4">
        <p className="text-2xl" aria-hidden="true">{status === 'ATTENDING' ? '🎉' : status === 'PENDING' ? '⏰' : '💌'}</p>
        <p className="font-serif text-xl font-semibold text-[#3b2f2f]">
          {status === 'ATTENDING' ? 'See you there!'
           : status === 'PENDING' ? "We'll remind you!"
           : 'Thanks for letting us know'}
        </p>
        <p className="text-[#6b5344] text-sm">
          {status === 'ATTENDING'
            ? "We can't wait to celebrate with you."
            : status === 'PENDING'
            ? `We'll send you a reminder in ${remindInDays} day${remindInDays === 1 ? '' : 's'}.`
            : "We'll miss you and appreciate you responding."}
        </p>
        {status === 'ATTENDING' && weddingSlug && (
          hasRegistry ? (
            <a
              href={`/wedding/${weddingSlug}/registry`}
              className="inline-block mt-2 rounded-xl border border-[#d4af6a] px-5 py-2.5 text-sm font-semibold text-[#3b2f2f] hover:bg-[#d4af6a]/10 transition"
            >
              Now go check out the registry →
            </a>
          ) : (
            <p className="mt-2 text-sm text-[#8a6a4a] italic">
              The couple hasn&apos;t set up their registry yet. Check back soon.
            </p>
          )
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {hasExistingResponse && (
        <div className="rounded-xl bg-[#f5ede0] border border-[#e8dcc8] px-4 py-3 text-sm text-[#6b5344] text-center">
          You already responded: <strong className="text-[#3b2f2f]">{currentRsvpStatus === 'ATTENDING' ? 'Attending' : 'Declining'}</strong>. Update your response below.
        </div>
      )}
      {/* Status selection */}
      <div>
        <p className="text-sm font-medium text-[#3b2f2f] mb-3 text-center">Will you be attending?</p>
        <div className="grid grid-cols-2 gap-3">
          {([
            { value: 'ATTENDING' as Status, label: 'Attending', icon: '✓' },
            { value: 'DECLINING' as Status, label: 'Declining', icon: '✗' },
          ]).map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleStatusSelect(opt.value)}
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

        {/* "Remind me" replaces the MAYBE button. Backend keeps rsvpStatus=PENDING and
            schedules a fresh invite after the chosen interval. */}
        <div className="mt-3">
          <button
            type="button"
            onClick={() => handleStatusSelect('PENDING')}
            className={`w-full rounded-xl border py-2.5 text-sm font-medium transition ${
              status === 'PENDING'
                ? 'border-[#4a1942] bg-[#4a1942]/10 text-[#4a1942]'
                : 'border-[#e8dcc8] text-[#6b5344] hover:border-[#d4af6a]'
            }`}
          >
            Not sure yet? Remind me later
          </button>
          {status === 'PENDING' && (
            <div className="mt-2 flex gap-2">
              {([1, 3, 7] as const).map(days => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setRemindInDays(days)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium transition ${
                    remindInDays === days
                      ? 'border-[#4a1942] bg-[#4a1942] text-white'
                      : 'border-[#e8dcc8] text-[#3b2f2f] hover:border-[#d4af6a]'
                  }`}
                >
                  {days} day{days > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* +1 name, only show if attending and plusOneAllowed */}
      {status === 'ATTENDING' && plusOneAllowed && (
        <div>
          <label className="block text-sm font-medium text-[#3b2f2f] mb-1.5">
            Guest name <span className="text-[#8a6a4a] font-normal">(optional)</span>
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
              Dietary restrictions <span className="text-[#8a6a4a] font-normal">(optional)</span>
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
              Song request <span className="text-[#8a6a4a] font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={song}
              onChange={e => setSong(e.target.value)}
              placeholder="e.g. How Great Thou Art"
              className="w-full rounded-lg border border-[#e8dcc8] px-4 py-2.5 text-[#3b2f2f] text-sm focus:border-[#d4af6a] focus:outline-none focus:ring-1 focus:ring-[#d4af6a]"
            />
          </div>
        </>
      )}

      {/* Note to couple, available regardless of status so declining guests can leave a blessing */}
      {(status === 'ATTENDING' || status === 'DECLINING') && (
        <div>
          <label className="block text-sm font-medium text-[#3b2f2f] mb-1.5">
            Leave a note for the couple <span className="text-[#8a6a4a] font-normal">(private, only they will see it)</span>
          </label>
          <textarea
            value={noteForCouple}
            onChange={e => setNoteForCouple(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="A blessing, a prayer, congratulations…"
            className="w-full rounded-lg border border-[#e8dcc8] px-4 py-2.5 text-[#3b2f2f] text-sm focus:border-[#d4af6a] focus:outline-none focus:ring-1 focus:ring-[#d4af6a] resize-none"
          />
        </div>
      )}

      {/* Party members, show individual toggles when guest is a party contact */}
      {partyMembers && partyMembers.length > 0 && (status === 'ATTENDING' || status === 'DECLINING') && (
        <div className="border border-[#e8dcc8] rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-[#3b2f2f]">Other members in your party</p>
          <p className="text-xs text-[#8a6a4a]">Let us know if each person will be attending.</p>
          {partyMembers.map(m => (
            <div key={m.guestId} className="flex items-center justify-between gap-4">
              <span className="text-sm text-[#3b2f2f]">{m.name}</span>
              <div className="flex gap-2">
                {(['ATTENDING', 'DECLINING'] as PartyStatus[]).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPartyStatuses(prev => ({ ...prev, [m.guestId]: s }))}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      partyStatuses[m.guestId] === s
                        ? 'border-[#4a1942] bg-[#4a1942] text-white'
                        : 'border-[#e8dcc8] text-[#6b5344] hover:border-[#d4af6a]'
                    }`}
                  >
                    {s === 'ATTENDING' ? 'Attending' : 'Declining'}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 text-center">{error}</p>
      )}

      <button
        type="submit"
        disabled={!isReady || submitting}
        className="w-full rounded-xl bg-[#4a1942] py-3 font-semibold text-white hover:bg-[#3b1235] disabled:opacity-50 transition"
      >
        {submitting ? 'Submitting…'
         : status === 'PENDING' ? 'Set reminder'
         : 'Submit RSVP'}
      </button>

      {/* Submitting an RSVP re-subscribes the guest to this couple's wedding emails
          (recipient-initiated re-consent), so disclose it. Only shown on an actual
          response, the "Set reminder" path does not re-subscribe. */}
      {status !== 'PENDING' && (
        <p className="text-center text-xs text-[#8a6a4a]">
          By submitting, you&apos;ll receive email updates about this wedding. You can unsubscribe anytime from the link in those emails.
        </p>
      )}
    </form>
  )
}
