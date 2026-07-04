'use client'

import { useState } from 'react'
import { PartyPopper, Clock, Mail, Check, X } from 'lucide-react'

// PENDING is the "remind me" path, status stays PENDING, remindInDays is sent.
type Status = 'ATTENDING' | 'DECLINING' | 'PENDING'

interface PartyMemberInfo {
  guestId: string
  name: string
  currentRsvpStatus: string | null
  currentDietary: string | null
  currentSongRequest: string | null
}

interface CustomQuestion {
  id: string
  questionText: string
  type: 'TEXT' | 'YES_NO' | 'CHOICE'
  options: string[]
  required: boolean
}

type PartyStatus = 'ATTENDING' | 'DECLINING' | 'PENDING'

export default function RsvpForm({
  token, plusOneAllowed, weddingSlug, hasRegistry, apiUrl, partyMembers,
  currentRsvpStatus, currentPlusOneName, currentDietary, currentSongRequest, currentNoteForCouple,
  customQuestions,
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
  customQuestions?: CustomQuestion[]
}) {
  const hasExistingResponse = currentRsvpStatus === 'ATTENDING' || currentRsvpStatus === 'DECLINING'

  const [status, setStatus]             = useState<Status | null>(
    hasExistingResponse ? (currentRsvpStatus as Status) : null
  )
  const [remindInDays, setRemindInDays] = useState<number | null>(null)
  // partyStatuses: keyed by guestId, value is ATTENDING/DECLINING/PENDING. Pre-filled from
  // each member's existing response so re-RSVPing shows their prior choice, not a reset.
  const [partyStatuses, setPartyStatuses] = useState<Record<string, PartyStatus>>(() => {
    const init: Record<string, PartyStatus> = {}
    partyMembers?.forEach(m => { init[m.guestId] = m.currentRsvpStatus === 'DECLINING' ? 'DECLINING' : 'ATTENDING' })
    return init
  })
  // Per-member dietary + song, collected for each attending member (note-to-couple stays a
  // single party-level field). Pre-filled from any existing answers.
  const [partyDietary, setPartyDietary] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    partyMembers?.forEach(m => { init[m.guestId] = m.currentDietary ?? '' })
    return init
  })
  const [partySong, setPartySong] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    partyMembers?.forEach(m => { init[m.guestId] = m.currentSongRequest ?? '' })
    return init
  })
  const [plusOne, setPlusOne]           = useState(currentPlusOneName ?? '')
  const [dietary, setDietary]           = useState(currentDietary ?? '')
  const [song, setSong]                 = useState(currentSongRequest ?? '')
  const [noteForCouple, setNoteForCouple] = useState(currentNoteForCouple ?? '')
  // Answers to the couple's custom questions, keyed by question id.
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting]     = useState(false)
  const [done, setDone]                 = useState(false)
  const [error, setError]               = useState('')

  // Required custom questions must be answered, but only when attending (that is the only
  // time they are shown).
  const requiredCustomAnswered = !customQuestions || status !== 'ATTENDING'
    || customQuestions.filter(q => q.required).every(q => (customAnswers[q.id] ?? '').trim() !== '')

  // A submission is ready when ATTENDING/DECLINING is selected (and any required custom
  // questions are answered), OR the guest chose "remind me" and picked an interval.
  const isReady = (((status === 'ATTENDING' || status === 'DECLINING') ||
                  (status === 'PENDING' && remindInDays !== null))) && requiredCustomAnswered

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
      // Build party responses for other members. Dietary/song only ride along for members
      // marked attending; a declining member sends just their status.
      const partyResponses = partyMembers && partyMembers.length > 0
        ? partyMembers.map(m => {
            const memberStatus = partyStatuses[m.guestId] ?? 'ATTENDING'
            const attending = memberStatus === 'ATTENDING'
            return {
              guestId: m.guestId,
              status: memberStatus,
              dietaryRestrictions: attending ? (partyDietary[m.guestId]?.trim() || undefined) : undefined,
              songRequest: attending ? (partySong[m.guestId]?.trim() || undefined) : undefined,
            }
          })
        : undefined

      // Custom answers ride along only on a real response and only when the couple has
      // questions. Attending sends the filled-in answers; declining sends an empty list so
      // the backend clears any answers from a prior attending response. Reminders send none.
      const isRealResponse = status === 'ATTENDING' || status === 'DECLINING'
      const customAnswersPayload = (isRealResponse && customQuestions && customQuestions.length > 0)
        ? (status === 'ATTENDING'
            ? customQuestions
                .map(q => ({ questionId: q.id, answerText: (customAnswers[q.id] ?? '').trim() }))
                .filter(a => a.answerText !== '')
            : [])
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
          customAnswers: customAnswersPayload,
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
        <div className="flex justify-center" aria-hidden="true">
          {status === 'ATTENDING'
            ? <PartyPopper className="w-8 h-8 text-[#d4af6a]" />
            : status === 'PENDING'
            ? <Clock className="w-8 h-8 text-[#d4af6a]" />
            : <Mail className="w-8 h-8 text-[#d4af6a]" />}
        </div>
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
              className="inline-block mt-2 rounded-xl border border-[#d4af6a] px-5 py-3 text-sm font-semibold text-[#3b2f2f] hover:bg-[#d4af6a]/10 transition"
            >
              Now go check out the registry →
            </a>
          ) : (
            <p className="mt-2 text-sm text-[#8a6a4a] italic">
              The couple hasn&apos;t set up their registry yet. Check back soon.
            </p>
          )
        )}
        {/* Recovery path: the emailed RSVP link is single-use, so once a guest has
            responded, point them at the find-your-invitation finder (which mints a
            fresh link) rather than the dead emailed one. Uses the wedding-scoped
            finder when we know the slug, otherwise the name-search entry point. */}
        <p className="mt-4 text-sm text-[#6b5344]">
          Need to change your response?{' '}
          <a
            href={weddingSlug ? `/wedding/${weddingSlug}/rsvp` : '/find-wedding'}
            className="font-medium text-[#4a1942] underline hover:text-[#3b1235]"
          >
            Find your invitation
          </a>
        </p>
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
            { value: 'ATTENDING' as Status, label: 'Attending', Icon: Check },
            { value: 'DECLINING' as Status, label: 'Declining', Icon: X },
          ]).map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleStatusSelect(opt.value)}
              className={`min-h-[44px] rounded-xl border py-3 text-sm font-medium transition ${
                status === opt.value
                  ? 'border-[#4a1942] bg-[#4a1942] text-white'
                  : 'border-[#e8dcc8] text-[#3b2f2f] hover:border-[#d4af6a]'
              }`}
            >
              <opt.Icon className="w-5 h-5 mx-auto mb-0.5" aria-hidden="true" />
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
            className={`min-h-[44px] w-full rounded-xl border py-2.5 text-sm font-medium transition ${
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
                  className={`flex-1 rounded-lg border py-3 text-sm font-medium transition ${
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
            maxLength={200}
            placeholder="Your +1's name"
            className="w-full rounded-lg border border-[#e8dcc8] px-4 py-2.5 text-[#3b2f2f] text-base sm:text-sm focus:border-[#d4af6a] focus:outline-none focus:ring-1 focus:ring-[#d4af6a]"
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
              maxLength={500}
              placeholder="e.g. vegetarian, gluten-free, nut allergy"
              className="w-full rounded-lg border border-[#e8dcc8] px-4 py-2.5 text-[#3b2f2f] text-base sm:text-sm focus:border-[#d4af6a] focus:outline-none focus:ring-1 focus:ring-[#d4af6a]"
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
              maxLength={200}
              placeholder="e.g. How Great Thou Art"
              className="w-full rounded-lg border border-[#e8dcc8] px-4 py-2.5 text-[#3b2f2f] text-base sm:text-sm focus:border-[#d4af6a] focus:outline-none focus:ring-1 focus:ring-[#d4af6a]"
            />
          </div>
        </>
      )}

      {/* Custom questions the couple added, shown when attending. */}
      {status === 'ATTENDING' && customQuestions && customQuestions.length > 0 && (
        <div className="space-y-4">
          {customQuestions.map(q => {
            const val = customAnswers[q.id] ?? ''
            const setVal = (v: string) => setCustomAnswers(prev => ({ ...prev, [q.id]: v }))
            const labelText = q.required ? `${q.questionText} *` : q.questionText
            if (q.type === 'YES_NO') {
              return (
                <fieldset key={q.id}>
                  <legend className="text-sm font-medium text-[#3b2f2f] mb-1.5">{labelText}</legend>
                  <div className="flex gap-2">
                    {['Yes', 'No'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setVal(opt)}
                        className={`flex-1 rounded-lg border py-3 text-sm font-medium transition ${
                          val === opt
                            ? 'border-[#4a1942] bg-[#4a1942] text-white'
                            : 'border-[#e8dcc8] text-[#3b2f2f] hover:border-[#d4af6a]'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )
            }
            if (q.type === 'CHOICE') {
              return (
                <div key={q.id}>
                  <label htmlFor={`cq-${q.id}`} className="block text-sm font-medium text-[#3b2f2f] mb-1.5">{labelText}</label>
                  <select
                    id={`cq-${q.id}`}
                    value={val}
                    onChange={e => setVal(e.target.value)}
                    required={q.required}
                    className="w-full rounded-lg border border-[#e8dcc8] px-4 py-2.5 text-[#3b2f2f] text-base sm:text-sm focus:border-[#d4af6a] focus:outline-none focus:ring-1 focus:ring-[#d4af6a]"
                  >
                    <option value="">Select...</option>
                    {q.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              )
            }
            return (
              <div key={q.id}>
                <label htmlFor={`cq-${q.id}`} className="block text-sm font-medium text-[#3b2f2f] mb-1.5">{labelText}</label>
                <input
                  id={`cq-${q.id}`}
                  type="text"
                  value={val}
                  onChange={e => setVal(e.target.value)}
                  required={q.required}
                  maxLength={2000}
                  className="w-full rounded-lg border border-[#e8dcc8] px-4 py-2.5 text-[#3b2f2f] text-base sm:text-sm focus:border-[#d4af6a] focus:outline-none focus:ring-1 focus:ring-[#d4af6a]"
                />
              </div>
            )
          })}
        </div>
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
            className="w-full rounded-lg border border-[#e8dcc8] px-4 py-2.5 text-[#3b2f2f] text-base sm:text-sm focus:border-[#d4af6a] focus:outline-none focus:ring-1 focus:ring-[#d4af6a] resize-none"
          />
        </div>
      )}

      {/* Party members, show individual toggles when guest is a party contact */}
      {partyMembers && partyMembers.length > 0 && (status === 'ATTENDING' || status === 'DECLINING') && (
        <div className="border border-[#e8dcc8] rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-[#3b2f2f]">Other members in your party</p>
          <p className="text-xs text-[#8a6a4a]">Let us know if each person will be attending.</p>
          {partyMembers.map(m => (
            <div key={m.guestId} className="space-y-2 border-b border-[#f0e8da] last:border-0 pb-3 last:pb-0">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-[#3b2f2f]">{m.name}</span>
                <div className="flex gap-2">
                  {(['ATTENDING', 'DECLINING'] as PartyStatus[]).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPartyStatuses(prev => ({ ...prev, [m.guestId]: s }))}
                      className={`min-h-[44px] rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
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
              {/* Per-member meal details, only when that member is attending. */}
              {partyStatuses[m.guestId] === 'ATTENDING' && (
                <div className="grid gap-2">
                  <input
                    type="text"
                    value={partyDietary[m.guestId] ?? ''}
                    onChange={e => setPartyDietary(prev => ({ ...prev, [m.guestId]: e.target.value }))}
                    maxLength={500}
                    placeholder="Dietary restrictions (optional)"
                    aria-label={`Dietary restrictions for ${m.name}`}
                    className="w-full rounded-lg border border-[#e8dcc8] px-3 py-2 text-[#3b2f2f] text-base sm:text-xs focus:border-[#d4af6a] focus:outline-none focus:ring-1 focus:ring-[#d4af6a]"
                  />
                  <input
                    type="text"
                    value={partySong[m.guestId] ?? ''}
                    onChange={e => setPartySong(prev => ({ ...prev, [m.guestId]: e.target.value }))}
                    maxLength={200}
                    placeholder="Song request (optional)"
                    aria-label={`Song request for ${m.name}`}
                    className="w-full rounded-lg border border-[#e8dcc8] px-3 py-2 text-[#3b2f2f] text-base sm:text-xs focus:border-[#d4af6a] focus:outline-none focus:ring-1 focus:ring-[#d4af6a]"
                  />
                </div>
              )}
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
