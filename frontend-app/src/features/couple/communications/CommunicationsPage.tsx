import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Send, AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { useAuth } from '@/core/auth/AuthContext'
import { useConfirm } from '@/components/ConfirmDialog'
import PageHeader from '@/components/PageHeader'
import { useGuests } from '@/features/couple/guests/useGuests'
import {
  usePrintOrders,
  useCreatePrintOrder,
  useRefreshPrintOrderStatus,
  type CreatePrintOrderPayload,
  type PrintOrder,
  type PrintOrderType,
} from './usePrintOrders'

type TemplateKey =
  | 'SAVE_THE_DATE_CLASSIC'
  | 'SAVE_THE_DATE_PHOTO'
  | 'INVITATION_CLASSIC'
  | 'INVITATION_PHOTO'

const TEMPLATES: Record<PrintOrderType, { key: TemplateKey; label: string; description: string }[]> = {
  SAVE_THE_DATE: [
    { key: 'SAVE_THE_DATE_CLASSIC', label: 'Classic', description: 'Cream + gold, no photo. Best when you don\'t yet have a couple portrait.' },
    { key: 'SAVE_THE_DATE_PHOTO', label: 'Photo', description: 'Full-bleed hero photo with names and date overlaid.' },
  ],
  INVITATION: [
    { key: 'INVITATION_CLASSIC', label: 'Classic', description: 'Cream + gold, scripture footer, ceremony details on back.' },
    { key: 'INVITATION_PHOTO', label: 'Photo', description: 'Full-bleed hero photo with formal invitation copy.' },
  ],
}

const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  SAVE_THE_DATE_CLASSIC: 'Save the Date - Classic',
  SAVE_THE_DATE_PHOTO: 'Save the Date - Photo',
  INVITATION_CLASSIC: 'Invitation - Classic',
  INVITATION_PHOTO: 'Invitation - Photo',
}

// Mirrors backend COST_PER_POSTCARD_CENTS = 150 in PrintOrderService.
const COST_PER_POSTCARD_CENTS = 150

export default function CommunicationsPage() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const coupleId = user?.id ?? ''
  const { data: guests = [], isLoading: guestsLoading, isError: guestsError, refetch: refetchGuests } = useGuests(coupleId)
  const { data: orders = [], isLoading: ordersLoading, isError: ordersError, refetch: refetchOrders } = usePrintOrders(coupleId)
  const createOrder = useCreatePrintOrder(coupleId)

  const [orderType, setOrderType] = useState<PrintOrderType>('SAVE_THE_DATE')
  const [templateKey, setTemplateKey] = useState<TemplateKey>('SAVE_THE_DATE_CLASSIC')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [returnName, setReturnName] = useState(
    user?.partnerOneName && user?.partnerTwoName
      ? `${user.partnerTwoName} & ${user.partnerOneName}`
      : ''
  )
  const [returnAddressLine1, setReturnAddressLine1] = useState('')
  const [returnAddressLine2, setReturnAddressLine2] = useState('')
  const [returnCity, setReturnCity] = useState('')
  const [returnState, setReturnState] = useState('')
  const [returnZip, setReturnZip] = useState('')
  const [lastResult, setLastResult] = useState<string | null>(null)
  // Dedup token regenerated whenever the batch contents change (see effect below),
  // so each distinct batch is a new order server-side. A retry of the SAME batch
  // keeps the key and is deduped by the backend.
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID())

  // Regenerate the dedup key whenever the batch contents change, so each distinct
  // batch is treated as a new order. A retry of the SAME batch (selection/template
  // unchanged, e.g. after a transient failure) keeps the key and is deduped
  // server-side. Clearing the selection after a success also rotates the key.
  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID())
  }, [orderType, templateKey, selectedIds])

  const mailableGuests = useMemo(
    () => guests.filter(g => g.mailLine1 && g.mailLine1.trim().length > 0),
    [guests]
  )

  const guestById = useMemo(
    () => new Map(guests.map(g => [g.id, g])),
    [guests]
  )

  const eligibleSelected = selectedIds.filter(id => mailableGuests.some(g => g.id === id))
  const estimatedCostDollars = (eligibleSelected.length * COST_PER_POSTCARD_CENTS) / 100

  function toggleType(t: PrintOrderType) {
    setOrderType(t)
    setTemplateKey(TEMPLATES[t][0].key)
  }

  function toggleGuest(id: string) {
    setSelectedIds(curr => curr.includes(id) ? curr.filter(x => x !== id) : [...curr, id])
  }

  function selectAllMailable() {
    setSelectedIds(mailableGuests.map(g => g.id))
  }

  function clearSelection() {
    setSelectedIds([])
  }

  // Inline validation hints shown below each relevant field when the form has
  // been touched but the field is still invalid.
  const stateInvalid = returnState.trim().length > 0 && returnState.trim().length !== 2
  const zipInvalid = returnZip.trim().length > 0 && !/^\d{5}(-\d{4})?$/.test(returnZip.trim())

  // Single source of truth for submit readiness. `canSubmit` is derived from
  // the hint so the validation rules can't drift between the two.
  function submitBlockerHint(): string | null {
    if (eligibleSelected.length === 0) return 'Select at least one recipient above'
    if (!returnName.trim()) return 'Enter a name for the return address'
    if (!returnAddressLine1.trim()) return 'Enter address line 1'
    if (!returnCity.trim()) return 'Enter the city'
    if (returnState.trim().length !== 2) return 'Enter a 2-letter state code (e.g. CA)'
    if (!/^\d{5}(-\d{4})?$/.test(returnZip.trim())) return 'Enter a valid 5-digit ZIP'
    return null
  }

  const blocker = submitBlockerHint()
  const canSubmit = blocker === null

  async function handleSubmit() {
    if (createOrder.isPending) return
    const confirmed = await confirm({
      title: 'Confirm print order',
      message: `You are about to send ${eligibleSelected.length} ${orderType === 'SAVE_THE_DATE' ? 'save-the-date' : 'invitation'} postcards. Estimated cost: $${estimatedCostDollars.toFixed(2)}. This action cannot be undone once postcards are submitted to the printer.`,
      confirmLabel: 'Submit order',
      tone: 'danger',
    })
    if (!confirmed) return

    const payload: CreatePrintOrderPayload = {
      orderType,
      templateKey,
      guestIds: eligibleSelected,
      returnName: returnName.trim(),
      returnAddressLine1: returnAddressLine1.trim(),
      returnAddressLine2: returnAddressLine2.trim() || undefined,
      returnCity: returnCity.trim(),
      returnState: returnState.trim().toUpperCase(),
      returnZip: returnZip.trim(),
      idempotencyKey,
    }
    try {
      const order = await createOrder.mutateAsync(payload)
      const failedCount = order.recipients.filter(r => r.deliveryStatus === 'FAILED').length
      setLastResult(
        order.status === 'SUBMITTED'
          ? `Submitted ${order.recipientCount} postcards to print.`
          : order.status === 'PARTIAL_FAILURE'
            ? `Submitted ${order.recipientCount - failedCount} postcards. ${failedCount} failed. See order details below.`
            // DRAFT here means this submit was deduped against an order still being
            // processed (idempotent replay). It is NOT a failure, so don't alarm the
            // couple; point them at Past orders, which refetches the real status.
            : order.status === 'DRAFT'
              ? 'This order is still being processed. Check Past orders below in a moment for the final status.'
              : `Order failed: ${order.errorMessage ?? 'Unknown error'}`
      )
      // Clearing the selection rotates the key via the effect above, so the next
      // deliberate batch is treated as a new order.
      setSelectedIds([])
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })
      setLastResult(`Failed to submit: ${msg.response?.data?.message ?? msg.message ?? 'Unknown error'}`)
      // Keep the SAME key on failure: if the couple retries, the backend dedups
      // in case the batch actually went through before the error surfaced.
    }
  }

  return (
    <div className="min-h-screen bg-ivory">
      <PageHeader
        title="Communications"
        subtitle="Send digital + physical save-the-dates and invitations"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-10">

        {/* Channel chooser */}
        <section aria-labelledby="channel-heading">
          <h2 id="channel-heading" className="font-serif text-2xl font-bold text-brown mb-2">How would you like to reach your guests?</h2>
          <p className="text-sm text-stone-500 mb-5">Choose email for instant free delivery, or order printed postcards mailed to their door.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <a
              href="#email-section"
              className="flex items-start gap-4 rounded-xl border-2 border-gold-light bg-white p-5 hover:border-amber-400 hover:shadow-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <Mail className="w-6 h-6 text-amber-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold text-brown mb-0.5">Email <span className="text-xs font-normal text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 ml-1">Free</span></p>
                <p className="text-sm text-stone-500">Send save-the-dates and RSVP invitations straight to your guests&apos; inboxes.</p>
              </div>
            </a>
            <a
              href="#print-section"
              className="flex items-start gap-4 rounded-xl border-2 border-gold-light bg-white p-5 hover:border-amber-400 hover:shadow-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <Send className="w-6 h-6 text-amber-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold text-brown mb-0.5">Print &amp; Mail <span className="text-xs font-normal text-stone-500">$1.50/card</span></p>
                <p className="text-sm text-stone-500">We print and mail physical postcards to guests who have a mailing address on file.</p>
              </div>
            </a>
          </div>
        </section>

        {/* Email section */}
        <section id="email-section" aria-labelledby="email-heading">
          <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">Email</span>
          <h2 id="email-heading" className="font-serif text-xl font-bold text-brown mb-1 mt-1">Email your guests</h2>
          <p className="text-sm text-stone-500 mb-4">Two faith-themed emails, both free. Send the save-the-date first, then RSVP invitations closer to the day.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              to="/dashboard/save-the-date"
              className="flex flex-col rounded-xl border border-gold-light bg-white p-5 hover:shadow-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">First - Free</span>
              <h3 className="font-serif text-lg font-semibold text-brown mb-1">Save-the-dates</h3>
              <p className="text-sm text-brown-light flex-1">A one-time announcement emailed to everyone with an email address. Send it months ahead so guests can plan.</p>
              <span className="mt-3 text-sm font-medium text-amber-700">Go to save-the-dates &rarr;</span>
            </Link>
            <Link
              to="/dashboard/guests"
              className="flex flex-col rounded-xl border border-gold-light bg-white p-5 hover:shadow-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">Then - Free</span>
              <h3 className="font-serif text-lg font-semibold text-brown mb-1">RSVP invitations</h3>
              <p className="text-sm text-brown-light flex-1">Sent guest by guest from your guest list, each person gets their own RSVP link. Up to 3 sends per guest.</p>
              <span className="mt-3 text-sm font-medium text-amber-700">Open guest list to send &rarr;</span>
            </Link>
          </div>
        </section>

        {/* Print & Mail section */}
        <section id="print-section" className="rounded-xl border border-stone-200 bg-white p-6" aria-labelledby="print-heading">
          <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">Print &amp; Mail</span>
          <h2 id="print-heading" className="font-serif text-xl font-bold text-brown mb-1 mt-1">Order physical postcards</h2>
          <p className="text-sm text-stone-500 mb-6">
            Postcards are printed and mailed via a third-party service with first-class postage included.
            You are charged a flat $1.50 per postcard when you submit. No card is required until Stripe billing launches.
          </p>

          {/* 1. Order type */}
          <div className="mb-5" role="group" aria-labelledby="order-type-label">
            <p id="order-type-label" className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">1. What are you sending?</p>
            <div className="flex flex-wrap gap-2">
              {(['SAVE_THE_DATE', 'INVITATION'] as PrintOrderType[]).map(t => (
                <button
                  key={t}
                  onClick={() => toggleType(t)}
                  aria-pressed={orderType === t}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border ${
                    orderType === t
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  {t === 'SAVE_THE_DATE' ? 'Save the Date' : 'Invitation'}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Template picker */}
          <div className="mb-5" role="group" aria-labelledby="template-label">
            <p id="template-label" className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">2. Choose a template</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {TEMPLATES[orderType].map(t => (
                <button
                  key={t.key}
                  onClick={() => setTemplateKey(t.key)}
                  aria-pressed={templateKey === t.key}
                  className={`text-left p-4 rounded-lg border ${
                    templateKey === t.key
                      ? 'border-amber-600 bg-amber-50'
                      : 'border-stone-200 bg-white hover:bg-stone-50'
                  }`}
                >
                  <p className="font-semibold text-stone-800">{t.label}</p>
                  <p className="text-xs text-stone-500 mt-1">{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Guest list */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <p id="recipients-label" className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                3. Pick recipients
                {!guestsLoading && !guestsError && ` (${mailableGuests.length} have a mailing address)`}
              </p>
              {!guestsLoading && !guestsError && mailableGuests.length > 0 && (
                <div className="flex gap-3">
                  <button
                    onClick={selectAllMailable}
                    className="text-sm text-amber-700 hover:underline py-1 px-2 min-h-[36px]"
                  >
                    Select all
                  </button>
                  <button
                    onClick={clearSelection}
                    className="text-sm text-stone-500 hover:underline py-1 px-2 min-h-[36px]"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {guestsLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-stone-500" aria-busy="true">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Loading guest list...
              </div>
            ) : guestsError ? (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span>
                  Could not load guest list.{' '}
                  <button onClick={() => refetchGuests()} className="underline font-medium">Try again</button>
                </span>
              </div>
            ) : mailableGuests.length === 0 ? (
              <div className="rounded-lg bg-amber-50 border border-amber-100 p-4 text-sm text-amber-800">
                No guests have a mailing address yet.{' '}
                <Link to="/dashboard/guests" className="underline font-medium">Add addresses on the guest list</Link>{' '}
                so they show up here.
              </div>
            ) : (
              <div
                className="max-h-72 overflow-y-auto rounded-lg border border-stone-200 divide-y divide-stone-100"
                role="group"
                aria-labelledby="recipients-label"
              >
                {mailableGuests.map(g => {
                  const checked = selectedIds.includes(g.id)
                  return (
                    <label key={g.id} className="flex items-start gap-3 p-3 cursor-pointer hover:bg-stone-50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleGuest(g.id)}
                        className="mt-1 w-4 h-4"
                        aria-label={`Select ${g.name}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-stone-800">{g.name}</p>
                        <p className="text-xs text-stone-500 truncate">
                          {[g.mailLine1, g.mailCity, g.mailState, g.mailZip].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* 4. Return address */}
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2" id="return-address-label">
              4. Return address <span className="font-normal normal-case text-stone-400">(required)</span>
            </p>
            <div className="grid gap-3 sm:grid-cols-2" role="group" aria-labelledby="return-address-label">
              <div className="sm:col-span-2">
                <label htmlFor="returnName" className="sr-only">Name or couple</label>
                <input
                  id="returnName"
                  value={returnName} onChange={e => setReturnName(e.target.value)}
                  placeholder="Name or couple"
                  aria-required="true"
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="returnAddressLine1" className="sr-only">Address line 1</label>
                <input
                  id="returnAddressLine1"
                  value={returnAddressLine1} onChange={e => setReturnAddressLine1(e.target.value)}
                  placeholder="Address line 1"
                  aria-required="true"
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="returnAddressLine2" className="sr-only">Apt / suite (optional)</label>
                <input
                  id="returnAddressLine2"
                  value={returnAddressLine2} onChange={e => setReturnAddressLine2(e.target.value)}
                  placeholder="Apt / suite (optional)"
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="returnCity" className="sr-only">City</label>
                <input
                  id="returnCity"
                  value={returnCity} onChange={e => setReturnCity(e.target.value)}
                  placeholder="City"
                  aria-required="true"
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="returnState" className="sr-only">State (2-letter code)</label>
                  <input
                    id="returnState"
                    value={returnState} onChange={e => setReturnState(e.target.value.toUpperCase())}
                    maxLength={2} placeholder="State"
                    aria-required="true"
                    aria-invalid={stateInvalid}
                    className={`w-full rounded border px-3 py-2 text-sm uppercase ${stateInvalid ? 'border-rose-400 bg-rose-50' : 'border-stone-300'}`}
                  />
                  {stateInvalid && (
                    <p className="text-xs text-rose-600 mt-1">Use 2-letter code (e.g. CA)</p>
                  )}
                </div>
                <div>
                  <label htmlFor="returnZip" className="sr-only">ZIP code</label>
                  <input
                    id="returnZip"
                    value={returnZip} onChange={e => setReturnZip(e.target.value)}
                    placeholder="ZIP"
                    aria-required="true"
                    aria-invalid={zipInvalid}
                    className={`w-full rounded border px-3 py-2 text-sm ${zipInvalid ? 'border-rose-400 bg-rose-50' : 'border-stone-300'}`}
                  />
                  {zipInvalid && (
                    <p className="text-xs text-rose-600 mt-1">Enter a valid 5-digit ZIP</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-stone-100 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-sm text-stone-600">
                {eligibleSelected.length > 0 ? (
                  <>Estimated cost: <span className="font-semibold text-stone-900">${estimatedCostDollars.toFixed(2)}</span> ({eligibleSelected.length} postcards)</>
                ) : (
                  <span className="text-stone-400">Pick at least one guest to see cost.</span>
                )}
              </div>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || createOrder.isPending}
                className="w-full sm:w-auto px-5 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 min-h-[44px]"
              >
                {createOrder.isPending ? 'Submitting...' : 'Submit print order'}
              </button>
            </div>
            {!canSubmit && blocker && (
              <p className="text-xs text-stone-500">{blocker}</p>
            )}
          </div>

          {/* Always in the DOM so screen readers catch content changes in the live region. */}
          <div role="status" aria-live="polite" className={lastResult ? 'mt-4 p-3 bg-stone-50 rounded-lg text-sm text-stone-700' : 'sr-only'}>
            {lastResult}
          </div>
        </section>

        {/* Past orders */}
        <section aria-labelledby="past-orders-heading">
          <h2 id="past-orders-heading" className="font-serif text-xl font-bold text-brown mb-3">Past print orders</h2>
          {ordersLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-stone-500" aria-busy="true">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Loading orders...
            </div>
          ) : ordersError ? (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span>
                Could not load past orders.{' '}
                <button onClick={() => refetchOrders()} className="underline font-medium">Try again</button>
              </span>
            </div>
          ) : orders.length === 0 ? (
            <p className="text-sm text-stone-500">No print orders yet.</p>
          ) : (
            <div className="space-y-3">
              {orders.map(o => (
                <PastOrderCard key={o.id} order={o} coupleId={coupleId} guestById={guestById} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function PastOrderCard({
  order,
  coupleId,
  guestById,
}: {
  order: PrintOrder
  coupleId: string
  guestById: Map<string, { name: string }>
}) {
  const refresh = useRefreshPrintOrderStatus(coupleId)
  // Only postcards that were actually submitted have a provider id worth tracking.
  const trackable = order.recipients.some(r => r.lobPostcardId)

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-stone-800">
            {order.orderType === 'SAVE_THE_DATE' ? 'Save the Date' : 'Invitation'} &middot;{' '}
            <span className="text-stone-500 text-sm">
              {TEMPLATE_LABELS[order.templateKey as TemplateKey] ?? order.templateKey}
            </span>
          </p>
          <p className="text-xs text-stone-500 mt-0.5">
            {new Date(order.createdAt).toLocaleString()} &middot; {order.recipientCount} recipients &middot; ${(order.costCents / 100).toFixed(2)}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {order.errorMessage && (
        <p className="text-xs text-rose-600 mt-2">{order.errorMessage}</p>
      )}

      {order.recipients.length > 0 && (
        <div className="mt-3 border-t border-stone-100 pt-3">
          <div className="flex items-center justify-between mb-2 gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Recipients</p>
            {trackable && (
              <button
                onClick={() => refresh.mutate(order.id)}
                disabled={refresh.isPending}
                className="inline-flex items-center gap-1 text-xs text-amber-700 hover:underline disabled:opacity-50 disabled:no-underline"
              >
                <RefreshCw className={`w-3 h-3 ${refresh.isPending ? 'animate-spin' : ''}`} aria-hidden="true" />
                {refresh.isPending ? 'Checking...' : 'Check delivery status'}
              </button>
            )}
          </div>
          <ul className="divide-y divide-stone-100">
            {order.recipients.map(r => {
              const name = guestById.get(r.guestId)?.name ?? `Guest ${r.guestId.slice(0, 8)}`
              return (
                <li key={r.guestId} className="flex items-start justify-between gap-3 py-1.5 text-sm">
                  <div className="min-w-0">
                    <span className="block truncate text-stone-700">{name}</span>
                    {r.deliveryStatus === 'FAILED' && r.errorMessage && (
                      <span className="text-xs text-rose-600">{r.errorMessage}</span>
                    )}
                  </div>
                  <DeliveryStatusBadge status={r.deliveryStatus} />
                </li>
              )
            })}
          </ul>
          {refresh.isError && (
            <p className="text-xs text-rose-600 mt-2">Could not refresh status. Please try again.</p>
          )}
        </div>
      )}
    </div>
  )
}

// Maps a recipient's delivery status to a friendly label + color. The status is either our own
// submit state (SUBMITTED/FAILED) or a Lob USPS tracking event ("Mailed", "In Transit",
// "Delivered", "Returned to Sender", ...), so match defensively on keywords rather than exact values.
function deliveryStatusStyle(status: string | null): { label: string; cls: string } {
  const s = (status ?? '').toLowerCase()
  if (s === '' || s === 'submitted') return { label: 'Submitted', cls: 'bg-stone-100 text-stone-600' }
  if (s === 'failed') return { label: 'Failed', cls: 'bg-rose-100 text-rose-700' }
  if (s.includes('return')) return { label: status as string, cls: 'bg-rose-100 text-rose-700' }
  // Exact match only: "Processed for Delivery" / "Out for Delivery" are still in transit, not done.
  if (s === 'delivered') return { label: status as string, cls: 'bg-emerald-100 text-emerald-700' }
  if (s.includes('mailed')) return { label: 'Mailed', cls: 'bg-sky-100 text-sky-700' }
  // In Transit, In Local Area, Processed for Delivery, Re-Routed, etc.
  return { label: status as string, cls: 'bg-amber-100 text-amber-700' }
}

function DeliveryStatusBadge({ status }: { status: string | null }) {
  const { label, cls } = deliveryStatusStyle(status)
  return (
    <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded ${cls}`}>{label}</span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DRAFT: 'bg-stone-100 text-stone-700',
    SUBMITTED: 'bg-emerald-100 text-emerald-700',
    PARTIAL_FAILURE: 'bg-amber-100 text-amber-700',
    FAILED: 'bg-rose-100 text-rose-700',
    MAILED: 'bg-sky-100 text-sky-700',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${styles[status] ?? 'bg-stone-100 text-stone-700'}`}>
      {status.replace('_', ' ')}
    </span>
  )
}
