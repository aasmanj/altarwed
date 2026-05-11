import { useState } from 'react'
import { useAuth } from '@/core/auth/AuthContext'
import PageHeader from '@/components/PageHeader'
import {
  useGuests, useAddGuest, useUpdateGuest, useRemoveGuest,
  useSendInvite, useSendAllInvites,
  type Guest, type RsvpStatus, type GuestSide,
} from './useGuests'

const STATUS_LABEL: Record<RsvpStatus, string> = {
  PENDING: 'Pending', ATTENDING: 'Attending', DECLINING: 'Declining', MAYBE: 'Maybe',
}
const STATUS_COLOR: Record<RsvpStatus, string> = {
  PENDING:   'bg-yellow-50 text-yellow-700',
  ATTENDING: 'bg-green-50 text-green-700',
  DECLINING: 'bg-red-50 text-red-700',
  MAYBE:     'bg-blue-50 text-blue-700',
}
const SIDES: GuestSide[] = ['BRIDE', 'GROOM', 'BOTH']

export default function GuestListPage() {
  const { user } = useAuth()
  const coupleId = user?.id ?? ''

  const { data: guests = [], isLoading } = useGuests(coupleId)
  const addGuest    = useAddGuest(coupleId)
  const updateGuest = useUpdateGuest(coupleId)
  const removeGuest = useRemoveGuest(coupleId)
  const sendInvite  = useSendInvite(coupleId)
  const sendAll     = useSendAllInvites(coupleId)

  const [showAdd, setShowAdd]   = useState(false)
  const [filter, setFilter]     = useState<RsvpStatus | 'ALL'>('ALL')
  const [editingId, setEditingId] = useState<string | null>(null)

  const filtered = filter === 'ALL' ? guests : guests.filter(g => g.rsvpStatus === filter)

  const total     = guests.length
  const attending = guests.filter(g => g.rsvpStatus === 'ATTENDING').length
  const declining = guests.filter(g => g.rsvpStatus === 'DECLINING').length
  const pending   = guests.filter(g => g.rsvpStatus === 'PENDING' || g.rsvpStatus === 'MAYBE').length

  return (
    <div className="min-h-screen bg-ivory">
      <PageHeader
        title="Guest List"
        subtitle="Manage invites and track RSVPs"
        action={
          <div className="flex gap-3">
            <button
              onClick={() => sendAll.mutate()}
              disabled={sendAll.isPending || pending === 0}
              className="rounded-lg border border-gold px-4 py-2 text-sm font-medium text-brown hover:bg-gold/10 disabled:opacity-50 transition"
            >
              {sendAll.isPending ? 'Sending…' : `Send all pending invites (${pending})`}
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white hover:bg-gold-dark transition"
            >
              + Add guest
            </button>
          </div>
        }
      />

      <main className="mx-auto max-w-5xl px-6 py-10">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total', value: total,     color: 'text-brown' },
            { label: 'Attending', value: attending, color: 'text-green-700' },
            { label: 'Declined',  value: declining, color: 'text-red-600' },
            { label: 'Pending',   value: pending,   color: 'text-yellow-600' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-gold-light bg-white p-5 text-center">
              <p className={`font-serif text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-brown-light mt-1 uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-6 border-b border-gold-light overflow-x-auto">
          {(['ALL', 'PENDING', 'ATTENDING', 'DECLINING', 'MAYBE'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition ${
                filter === f ? 'border-gold text-brown' : 'border-transparent text-brown-light hover:text-brown'
              }`}
            >
              {f === 'ALL' ? 'All guests' : STATUS_LABEL[f]}
            </button>
          ))}
        </div>

        {/* Add guest form */}
        {showAdd && (
          <AddGuestForm
            onSubmit={async (data) => {
              await addGuest.mutateAsync(data)
              setShowAdd(false)
            }}
            onCancel={() => setShowAdd(false)}
            isPending={addGuest.isPending}
          />
        )}

        {/* Guest table */}
        {isLoading ? (
          <p className="text-center text-brown-light py-16 animate-pulse">Loading guests…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-brown font-medium mb-1">
              {filter === 'ALL' ? 'No guests yet' : `No ${STATUS_LABEL[filter].toLowerCase()} guests`}
            </p>
            <p className="text-sm text-brown-light">
              {filter === 'ALL' ? 'Add your first guest to get started.' : 'Try a different filter.'}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-gold-light bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gold-light bg-ivory/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-brown uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-brown uppercase tracking-wide hidden sm:table-cell">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-brown uppercase tracking-wide hidden md:table-cell">Side</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-brown uppercase tracking-wide">RSVP</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-brown uppercase tracking-wide hidden lg:table-cell">Table</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(guest => (
                  editingId === guest.id ? (
                    <EditGuestRow
                      key={guest.id}
                      guest={guest}
                      onSave={async (payload) => {
                        await updateGuest.mutateAsync({ guestId: guest.id, payload })
                        setEditingId(null)
                      }}
                      onCancel={() => setEditingId(null)}
                      isPending={updateGuest.isPending}
                    />
                  ) : (
                    <tr key={guest.id} className="border-b border-gold-light/50 last:border-0 hover:bg-ivory/30 transition">
                      <td className="px-4 py-3 font-medium text-brown">{guest.name}</td>
                      <td className="px-4 py-3 text-brown-light hidden sm:table-cell">{guest.email ?? '—'}</td>
                      <td className="px-4 py-3 text-brown-light hidden md:table-cell capitalize">
                        {guest.side ? guest.side.toLowerCase() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[guest.rsvpStatus]}`}>
                          {STATUS_LABEL[guest.rsvpStatus]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-brown-light hidden lg:table-cell">
                        {guest.tableNumber ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          {guest.email && (
                            <button
                              onClick={() => sendInvite.mutate(guest.id)}
                              disabled={sendInvite.isPending}
                              className="text-xs text-gold hover:underline disabled:opacity-50"
                              title={guest.inviteSentAt ? 'Resend invite' : 'Send invite'}
                            >
                              {guest.inviteSentAt ? 'Resend' : 'Invite'}
                            </button>
                          )}
                          <button
                            onClick={() => setEditingId(guest.id)}
                            className="text-xs text-brown-light hover:text-brown"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Remove ${guest.name}?`)) removeGuest.mutate(guest.id)
                            }}
                            className="text-xs text-red-400 hover:text-red-600"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add guest form
// ---------------------------------------------------------------------------
function AddGuestForm({ onSubmit, onCancel, isPending }: {
  onSubmit: (data: Parameters<ReturnType<typeof useAddGuest>['mutateAsync']>[0]) => Promise<void>
  onCancel: () => void
  isPending: boolean
}) {
  const [name, setName]               = useState('')
  const [email, setEmail]             = useState('')
  const [phone, setPhone]             = useState('')
  const [side, setSide]               = useState<GuestSide | ''>('')
  const [plusOne, setPlusOne]         = useState(false)
  const [mailAddress, setMailAddress] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      name,
      email: email || undefined,
      phone: phone || undefined,
      plusOneAllowed: plusOne,
      side: side || undefined,
      mailAddress: mailAddress || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gold bg-white p-5 mb-6 space-y-4">
      <p className="font-medium text-brown text-sm">New guest</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Name *">
          <input required value={name} onChange={e => setName(e.target.value)}
            className={inputCls} placeholder="Full name" />
        </Field>
        <Field label="Email">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            className={inputCls} placeholder="guest@example.com" />
        </Field>
        <Field label="Phone">
          <input value={phone} onChange={e => setPhone(e.target.value)}
            className={inputCls} placeholder="Optional" />
        </Field>
        <Field label="Side">
          <select value={side} onChange={e => setSide(e.target.value as GuestSide | '')}
            className={inputCls}>
            <option value="">— Select —</option>
            {SIDES.map(s => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
          </select>
        </Field>
        <Field label="Mailing address">
          <input value={mailAddress} onChange={e => setMailAddress(e.target.value)}
            className={inputCls} placeholder="123 Main St, Dallas TX 75201" />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-brown">
        <input type="checkbox" checked={plusOne} onChange={e => setPlusOne(e.target.checked)}
          className="rounded border-gold-light" />
        Allow +1
      </label>
      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={isPending}
          className="rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-white hover:bg-gold-dark disabled:opacity-60 transition">
          {isPending ? 'Adding…' : 'Add guest'}
        </button>
        <button type="button" onClick={onCancel}
          className="rounded-lg border border-gold-light px-5 py-2 text-sm font-medium text-brown hover:bg-ivory transition">
          Cancel
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Inline edit row
// ---------------------------------------------------------------------------
function EditGuestRow({ guest, onSave, onCancel, isPending }: {
  guest: Guest
  onSave: (payload: Parameters<ReturnType<typeof useUpdateGuest>['mutateAsync']>[0]['payload']) => Promise<void>
  onCancel: () => void
  isPending: boolean
}) {
  const [name, setName]               = useState(guest.name)
  const [email, setEmail]             = useState(guest.email ?? '')
  const [side, setSide]               = useState<GuestSide | ''>(guest.side ?? '')
  const [status, setStatus]           = useState(guest.rsvpStatus)
  const [table, setTable]             = useState(guest.tableNumber?.toString() ?? '')
  const [plusOne, setPlusOne]         = useState(guest.plusOneAllowed)
  const [meal, setMeal]               = useState(guest.mealPreference ?? '')
  const [song, setSong]               = useState(guest.songRequest ?? '')
  const [shuttle, setShuttle]         = useState(guest.shuttleNeeded ?? false)
  const [mailAddress, setMailAddress] = useState(guest.mailAddress ?? '')

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      name, email: email || undefined,
      side: side || undefined,
      rsvpStatus: status,
      tableNumber: table ? parseInt(table) : undefined,
      plusOneAllowed: plusOne,
      mealPreference: meal || undefined,
      songRequest: song || undefined,
      shuttleNeeded: shuttle,
      mailAddress: mailAddress || undefined,
    })
  }

  return (
    <tr className="border-b border-gold bg-gold/5">
      <td colSpan={6} className="px-4 py-4">
        <form onSubmit={handleSave} className="grid sm:grid-cols-3 gap-3">
          <Field label="Name">
            <input required value={name} onChange={e => setName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Email">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Side">
            <select value={side} onChange={e => setSide(e.target.value as GuestSide | '')} className={inputCls}>
              <option value="">—</option>
              {SIDES.map(s => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
            </select>
          </Field>
          <Field label="RSVP Status">
            <select value={status} onChange={e => setStatus(e.target.value as RsvpStatus)} className={inputCls}>
              {(['PENDING', 'ATTENDING', 'DECLINING', 'MAYBE'] as RsvpStatus[]).map(s => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </Field>
          <Field label="Table #">
            <input type="number" min="1" value={table} onChange={e => setTable(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Meal preference">
            <input value={meal} onChange={e => setMeal(e.target.value)}
              placeholder="e.g. Chicken, Vegetarian" className={inputCls} />
          </Field>
          <Field label="Song request">
            <input value={song} onChange={e => setSong(e.target.value)}
              placeholder="e.g. How Great Thou Art" className={inputCls} />
          </Field>
          <Field label="Mailing address">
            <input value={mailAddress} onChange={e => setMailAddress(e.target.value)}
              placeholder="123 Main St, Dallas TX 75201" className={inputCls} />
          </Field>
          <div className="flex items-end gap-6 pb-0.5">
            <label className="flex items-center gap-2 text-sm text-brown">
              <input type="checkbox" checked={plusOne} onChange={e => setPlusOne(e.target.checked)}
                className="rounded border-gold-light" />
              Allow +1
            </label>
            <label className="flex items-center gap-2 text-sm text-brown">
              <input type="checkbox" checked={shuttle} onChange={e => setShuttle(e.target.checked)}
                className="rounded border-gold-light" />
              Needs shuttle
            </label>
          </div>
          <div className="sm:col-span-3 flex gap-3 pt-1">
            <button type="submit" disabled={isPending}
              className="rounded-lg bg-gold px-4 py-1.5 text-sm font-semibold text-white hover:bg-gold-dark disabled:opacity-60 transition">
              {isPending ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={onCancel}
              className="rounded-lg border border-gold-light px-4 py-1.5 text-sm font-medium text-brown hover:bg-ivory transition">
              Cancel
            </button>
          </div>
        </form>
      </td>
    </tr>
  )
}

const inputCls = 'w-full rounded-lg border border-gold-light px-3 py-2 text-brown text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-brown-light mb-1">{label}</label>
      {children}
    </div>
  )
}
