import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/core/auth/AuthContext'
import PageHeader from '@/components/PageHeader'
import { useGuests } from '@/features/couple/guests/useGuests'
import {
  usePrintOrders,
  useCreatePrintOrder,
  type CreatePrintOrderPayload,
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

// Mirrors backend COST_PER_POSTCARD_CENTS = 150 in PrintOrderService.
const COST_PER_POSTCARD_CENTS = 150

export default function CommunicationsPage() {
  const { user } = useAuth()
  const coupleId = user?.id ?? ''
  const { data: guests = [] } = useGuests(coupleId)
  const { data: orders = [] } = usePrintOrders(coupleId)
  const createOrder = useCreatePrintOrder(coupleId)

  const [orderType, setOrderType] = useState<PrintOrderType>('SAVE_THE_DATE')
  const [templateKey, setTemplateKey] = useState<TemplateKey>('SAVE_THE_DATE_CLASSIC')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [returnName, setReturnName] = useState(
    user?.partnerOneName && user?.partnerTwoName
      ? `${user.partnerOneName} & ${user.partnerTwoName}`
      : ''
  )
  const [returnAddressLine1, setReturnAddressLine1] = useState('')
  const [returnAddressLine2, setReturnAddressLine2] = useState('')
  const [returnCity, setReturnCity] = useState('')
  const [returnState, setReturnState] = useState('')
  const [returnZip, setReturnZip] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [lastResult, setLastResult] = useState<string | null>(null)

  const mailableGuests = useMemo(
    () => guests.filter(g => g.mailAddress && g.mailAddress.trim().length > 0),
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

  async function submit() {
    setConfirmOpen(false)
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
    }
    try {
      const order = await createOrder.mutateAsync(payload)
      const failedCount = order.recipients.filter(r => r.deliveryStatus === 'FAILED').length
      setLastResult(
        order.status === 'SUBMITTED'
          ? `Submitted ${order.recipientCount} postcards to print.`
          : order.status === 'PARTIAL_FAILURE'
            ? `Submitted ${order.recipientCount - failedCount} postcards. ${failedCount} failed. See order details below.`
            : `Order failed: ${order.errorMessage ?? 'Unknown error'}`
      )
      setSelectedIds([])
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })
      setLastResult(`Failed to submit: ${msg.response?.data?.message ?? msg.message ?? 'Unknown error'}`)
    }
  }

  const canSubmit =
    eligibleSelected.length > 0 &&
    returnName.trim() && returnAddressLine1.trim() &&
    returnCity.trim() && returnState.trim().length === 2 && /^\d{5}(-\d{4})?$/.test(returnZip.trim())

  return (
    <div className="min-h-screen bg-ivory">
      <PageHeader
        title="Communications"
        subtitle="Send digital + physical save-the-dates and invitations"
      />

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">

        {/* Digital quick links */}
        <section className="grid gap-4 sm:grid-cols-2">
          <Link
            to="/dashboard/save-the-date"
            className="block rounded-xl border border-gold-light bg-white p-5 hover:shadow-md transition"
          >
            <h3 className="font-serif text-lg font-semibold text-brown mb-1">Digital save-the-dates</h3>
            <p className="text-sm text-brown-light">Send a faith-themed email to every guest with an email address. Free.</p>
          </Link>
          <Link
            to="/dashboard/guests"
            className="block rounded-xl border border-gold-light bg-white p-5 hover:shadow-md transition"
          >
            <h3 className="font-serif text-lg font-semibold text-brown mb-1">Digital RSVP invitations</h3>
            <p className="text-sm text-brown-light">Send individual RSVP links from the guest list. Free, up to 3 sends per guest.</p>
          </Link>
        </section>

        {/* Physical print order */}
        <section className="rounded-xl border border-stone-200 bg-white p-6">
          <h2 className="font-serif text-xl font-bold text-brown mb-1">Order physical postcards</h2>
          <p className="text-sm text-stone-500 mb-6">
            Printed and mailed via Lob. First-class postage included. We charge a flat estimate of $1.50 per
            postcard at submit time; actual provider cost is billed monthly.
          </p>

          {/* 1. Order type */}
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">1. What are you sending?</p>
            <div className="flex gap-2">
              {(['SAVE_THE_DATE', 'INVITATION'] as PrintOrderType[]).map(t => (
                <button
                  key={t}
                  onClick={() => toggleType(t)}
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
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">2. Choose a template</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {TEMPLATES[orderType].map(t => (
                <button
                  key={t.key}
                  onClick={() => setTemplateKey(t.key)}
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
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                3. Pick recipients ({mailableGuests.length} have a mailing address)
              </p>
              <div className="flex gap-2 text-xs">
                <button onClick={selectAllMailable} className="text-amber-700 hover:underline">Select all</button>
                <button onClick={clearSelection} className="text-stone-500 hover:underline">Clear</button>
              </div>
            </div>
            {mailableGuests.length === 0 ? (
              <div className="rounded-lg bg-amber-50 border border-amber-100 p-4 text-sm text-amber-800">
                No guests have a mailing address yet.{' '}
                <Link to="/dashboard/guests" className="underline font-medium">Add addresses on the guest list</Link>{' '}
                so they show up here.
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto rounded-lg border border-stone-200 divide-y divide-stone-100">
                {mailableGuests.map(g => {
                  const checked = selectedIds.includes(g.id)
                  return (
                    <label key={g.id} className="flex items-start gap-3 p-3 cursor-pointer hover:bg-stone-50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleGuest(g.id)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-stone-800">{g.name}</p>
                        <p className="text-xs text-stone-500 truncate">{g.mailAddress}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* 4. Return address */}
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">4. Return address</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={returnName} onChange={e => setReturnName(e.target.value)}
                placeholder="Name or couple"
                className="rounded border border-stone-300 px-3 py-2 text-sm sm:col-span-2"
              />
              <input
                value={returnAddressLine1} onChange={e => setReturnAddressLine1(e.target.value)}
                placeholder="Address line 1"
                className="rounded border border-stone-300 px-3 py-2 text-sm sm:col-span-2"
              />
              <input
                value={returnAddressLine2} onChange={e => setReturnAddressLine2(e.target.value)}
                placeholder="Apt / suite (optional)"
                className="rounded border border-stone-300 px-3 py-2 text-sm sm:col-span-2"
              />
              <input
                value={returnCity} onChange={e => setReturnCity(e.target.value)}
                placeholder="City"
                className="rounded border border-stone-300 px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={returnState} onChange={e => setReturnState(e.target.value.toUpperCase())}
                  maxLength={2} placeholder="ST"
                  className="rounded border border-stone-300 px-3 py-2 text-sm uppercase"
                />
                <input
                  value={returnZip} onChange={e => setReturnZip(e.target.value)}
                  placeholder="ZIP"
                  className="rounded border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between gap-4 pt-4 border-t border-stone-100">
            <div className="text-sm text-stone-600">
              {eligibleSelected.length > 0 ? (
                <>Estimated cost: <span className="font-semibold text-stone-900">${estimatedCostDollars.toFixed(2)}</span> ({eligibleSelected.length} postcards)</>
              ) : (
                <span className="text-stone-400">Pick at least one guest to see cost.</span>
              )}
            </div>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={!canSubmit || createOrder.isPending}
              className="px-5 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              {createOrder.isPending ? 'Submitting…' : 'Submit print order'}
            </button>
          </div>

          {lastResult && (
            <div className="mt-4 p-3 bg-stone-50 rounded-lg text-sm text-stone-700">
              {lastResult}
            </div>
          )}
        </section>

        {/* Past orders */}
        <section>
          <h2 className="font-serif text-xl font-bold text-brown mb-3">Past print orders</h2>
          {orders.length === 0 ? (
            <p className="text-sm text-stone-500">No print orders yet.</p>
          ) : (
            <div className="space-y-3">
              {orders.map(o => {
                const failed = o.recipients.filter(r => r.deliveryStatus === 'FAILED')
                return (
                  <div key={o.id} className="rounded-xl border border-stone-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-stone-800">
                          {o.orderType === 'SAVE_THE_DATE' ? 'Save the Date' : 'Invitation'} ·{' '}
                          <span className="text-stone-500 text-sm">{o.templateKey}</span>
                        </p>
                        <p className="text-xs text-stone-500 mt-0.5">
                          {new Date(o.createdAt).toLocaleString()} · {o.recipientCount} recipients · ${(o.costCents / 100).toFixed(2)}
                        </p>
                      </div>
                      <StatusBadge status={o.status} />
                    </div>
                    {o.errorMessage && (
                      <p className="text-xs text-rose-600 mt-2">{o.errorMessage}</p>
                    )}
                    {failed.length > 0 && (
                      <details className="mt-2 text-xs text-stone-500">
                        <summary className="cursor-pointer hover:text-stone-800">
                          {failed.length} failed - see details
                        </summary>
                        <ul className="mt-1 space-y-0.5 list-disc list-inside">
                          {failed.map(r => (
                            <li key={r.guestId}>
                              Guest {r.guestId.slice(0, 8)}: {r.errorMessage}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* Confirm modal */}
      {confirmOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="font-serif text-lg font-bold text-brown mb-2">Confirm print order</h3>
            <p className="text-sm text-stone-600 mb-4">
              You are about to send <span className="font-semibold">{eligibleSelected.length}</span>{' '}
              {orderType === 'SAVE_THE_DATE' ? 'save-the-date' : 'invitation'} postcards.
              Estimated cost: <span className="font-semibold">${estimatedCostDollars.toFixed(2)}</span>.
              This action cannot be undone once postcards are submitted to the printer.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700"
              >
                Submit order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
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
