import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import confetti from 'canvas-confetti'
import { ChevronDown, ChevronUp, Send } from 'lucide-react'
import { useConfirm } from '@/components/ConfirmDialog'
import { useSendBulkInvites, type Guest } from './useGuests'
import { invitableGuests, unsentInvitableIds, summariseInviteResult } from './bulkInvite'

/**
 * Bulk RSVP invite panel for the guest list. Mirrors the save-the-date sender's
 * All / Unsent / None selectors and single "Send to N guests" button, but for RSVP
 * invitations. Selection is a convenience: the backend still applies and reports the
 * skip rules, so a stale selection never sends to an ineligible guest. Per-row single
 * send on the guest table is unchanged and still available.
 */
export default function BulkInviteSender({ coupleId, guests }: { coupleId: string; guests: Guest[] }) {
  const confirm = useConfirm()
  const bulkInvite = useSendBulkInvites(coupleId)
  const [showList, setShowList] = useState(false)
  // null means "use the default (unsent) selection"; a concrete array is an explicit set.
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null)
  // Per-attempt dedup token (issue #295), mirroring SaveTheDatePage's #232 pattern. A retry
  // of the SAME selection (e.g. after a lost response) keeps the key and is deduped
  // server-side, so the batch is never re-emailed. A new selection or a completed send
  // rotates it.
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID())

  // Rotate the dedup key whenever the recipient selection changes, so each distinct batch
  // is a fresh attempt server-side. Retries of the SAME selection keep the key (deduped).
  // The success path also rotates it explicitly, since resetting back to the default (null)
  // selection after a send may leave this dependency unchanged.
  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID())
  }, [selectedIds])

  // Guests an RSVP invite can actually reach: pending, has an email, not unsubscribed,
  // and under the send cap. Over-cap / responded / unsubscribed guests are excluded from
  // the picker (the backend reports them as skips if an id sneaks through a race).
  const invitable = useMemo(() => invitableGuests(guests), [guests])

  // Default recipients: pending guests who have not been invited yet, so re-running the
  // bulk send does not resend to guests who already received an invite.
  const unsentIds = useMemo(() => unsentInvitableIds(guests), [guests])

  const activeIds = selectedIds ?? unsentIds
  const activeSet = new Set(activeIds)
  // Only count/send ids that are still invitable (a selection can go stale after a refetch).
  const sendIds = invitable.filter(g => activeSet.has(g.id)).map(g => g.id)
  const sendCount = sendIds.length
  const alreadyInvitedCount = invitable.filter(g => g.inviteSentAt).length

  function toggleGuest(id: string) {
    const current = selectedIds ?? unsentIds
    setSelectedIds(current.includes(id) ? current.filter(x => x !== id) : [...current, id])
  }

  async function handleSend() {
    if (bulkInvite.isPending || sendCount === 0) return
    if (
      !(await confirm({
        title: `Send RSVP invites to ${sendCount} guest${sendCount === 1 ? '' : 's'}?`,
        message:
          'Each selected guest receives their own RSVP link. Guests who have already responded, have no email, are unsubscribed, or have hit the 3-invite limit are skipped automatically.',
        confirmLabel: 'Send invites',
      }))
    ) {
      return
    }
    try {
      const result = await bulkInvite.mutateAsync({ guestIds: sendIds, idempotencyKey })
      // Reset back to the default (unsent) set so the just-invited guests drop out, and
      // rotate the dedup key so the NEXT send is a new attempt (the selection reset alone
      // may not change the effect dependency when it was already null).
      setSelectedIds(null)
      setIdempotencyKey(crypto.randomUUID())
      if (result.replayed) {
        // The server matched a previous send with this key: nothing was re-emailed.
        toast(summariseInviteResult(result))
        return
      }
      if (result.sent > 0) {
        toast.success(summariseInviteResult(result))
        confetti({
          particleCount: 140,
          spread: 80,
          origin: { y: 0.5 },
          colors: ['#d4af6a', '#3b2f2f', '#f5ede0', '#fbbf24', '#fde68a'],
        })
      } else {
        // Nothing sent (everything was skipped) is not an error, but the couple must know.
        toast(summariseInviteResult(result))
      }
    } catch {
      // useSendBulkInvites.onError already surfaced the failure toast.
    }
  }

  if (invitable.length === 0) return null

  return (
    <div className="mb-6 rounded-xl border border-gold-light bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-lg font-semibold text-brown">Send RSVP invitations</h2>
          <p className="text-sm text-brown-light">
            {sendCount} of {invitable.length} pending guest{invitable.length === 1 ? '' : 's'} selected.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSend}
          disabled={bulkInvite.isPending || sendCount === 0}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          <Send size={15} aria-hidden="true" />
          {bulkInvite.isPending
            ? 'Sending…'
            : `Send RSVP invites to ${sendCount} guest${sendCount === 1 ? '' : 's'}`}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <span className="font-semibold uppercase tracking-wide text-brown-light">Select</span>
        <button type="button" onClick={() => setSelectedIds(invitable.map(g => g.id))} className="text-amber-700 hover:underline">
          All pending
        </button>
        {alreadyInvitedCount > 0 && (
          <button type="button" onClick={() => setSelectedIds(null)} className="text-amber-700 hover:underline">
            Unsent only
          </button>
        )}
        <button type="button" onClick={() => setSelectedIds([])} className="text-stone-500 hover:underline">
          None
        </button>
        <button
          type="button"
          onClick={() => setShowList(v => !v)}
          className="ml-auto inline-flex items-center gap-1 text-brown-light hover:text-brown"
          aria-expanded={showList}
        >
          {showList ? (
            <>Hide list <ChevronUp size={13} /></>
          ) : (
            <>Choose individually <ChevronDown size={13} /></>
          )}
        </button>
      </div>

      {showList && (
        <div className="mt-3 max-h-56 divide-y divide-stone-100 overflow-y-auto rounded-lg border border-stone-200">
          {invitable.map(g => (
            <label key={g.id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-stone-50">
              <input
                type="checkbox"
                checked={activeSet.has(g.id)}
                onChange={() => toggleGuest(g.id)}
                className="h-4 w-4 rounded border-stone-300 accent-amber-600"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-stone-800">{g.name}</p>
                <p className="truncate text-xs text-stone-400">{g.email}</p>
              </div>
              {g.inviteSentAt && (
                <span className="ml-auto flex-shrink-0 text-xs font-medium text-stone-500">
                  Invited{(g.inviteSendCount ?? 0) > 1 ? ` ${g.inviteSendCount}x` : ''}
                </span>
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
