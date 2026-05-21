import { useState } from 'react'
import { useAuth } from '@/core/auth/AuthContext'
import PageHeader from '@/components/PageHeader'
import {
  useGuests, useAddGuest, useUpdateGuest, useRemoveGuest,
  useSendInvite, useSendAllInvites, useCreateParty,
  type Guest, type RsvpStatus, type GuestSide, type CreatePartyPayload,
} from './useGuests'
import TipCallout from '@/components/TipCallout'
import { TIPS } from '@/lib/tips'

const STATUS_LABEL: Record<RsvpStatus, string> = {
  PENDING: 'Remind me', ATTENDING: 'Attending', DECLINING: 'Declining',
}
const STATUS_COLOR: Record<RsvpStatus, string> = {
  PENDING:   'bg-yellow-50 text-yellow-700',
  ATTENDING: 'bg-green-50 text-green-700',
  DECLINING: 'bg-red-50 text-red-700',
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

  const createParty = useCreateParty(coupleId)

  const [showAdd, setShowAdd]         = useState(false)
  const [showParty, setShowParty]     = useState(false)
  const [filter, setFilter]           = useState<RsvpStatus | 'ALL'>('ALL')
  const [editingId, setEditingId]     = useState<string | null>(null)

  const filtered = filter === 'ALL' ? guests : guests.filter(g => g.rsvpStatus === filter)

  // Group filtered guests: parties first (grouped by partyId), then solo guests
  type GuestGroup = { type: 'party'; partyId: string; partyName: string; members: Guest[] } | { type: 'solo'; guest: Guest }
  const groups: GuestGroup[] = (() => {
    const partyMap = new Map<string, Guest[]>()
    const solos: Guest[] = []
    for (const g of filtered) {
      if (g.partyId) {
        const arr = partyMap.get(g.partyId) ?? []
        arr.push(g)
        partyMap.set(g.partyId, arr)
      } else {
        solos.push(g)
      }
    }
    const result: GuestGroup[] = []
    partyMap.forEach((members, partyId) => {
      result.push({ type: 'party', partyId, partyName: members[0].partyName ?? 'Party', members })
    })
    solos.forEach(g => result.push({ type: 'solo', guest: g }))
    return result
  })()

  const total     = guests.length
  const attending = guests.filter(g => g.rsvpStatus === 'ATTENDING').length
  const declining = guests.filter(g => g.rsvpStatus === 'DECLINING').length
  const pending   = guests.filter(g => g.rsvpStatus === 'PENDING').length

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
              onClick={() => setShowParty(true)}
              className="rounded-lg border border-gold px-4 py-2 text-sm font-medium text-brown hover:bg-gold/10 transition"
            >
              + Create party
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

        <div className="mb-6">
          <TipCallout tip={TIPS.guestsRsvpTiming} />
        </div>

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
          {(['ALL', 'PENDING', 'ATTENDING', 'DECLINING'] as const).map(f => (
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

        {/* Create party form */}
        {showParty && (
          <CreatePartyForm
            onSubmit={async (data) => {
              await createParty.mutateAsync(data)
              setShowParty(false)
            }}
            onCancel={() => setShowParty(false)}
            isPending={createParty.isPending}
          />
        )}

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
          <div className="space-y-4">
            {groups.map((group) => group.type === 'party' ? (
              <div key={group.partyId} className="rounded-xl border border-gold-light bg-white overflow-hidden">
                {/* Party header */}
                <div className="px-4 py-2.5 bg-gold/5 border-b border-gold-light flex items-center gap-2">
                  <span className="text-xs font-semibold text-gold uppercase tracking-wide">Party</span>
                  <span className="font-medium text-brown text-sm">{group.partyName}</span>
                  <span className="text-xs text-brown-light ml-1">({group.members.length} members)</span>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {group.members.map(guest => (
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
                        <GuestRow
                          key={guest.id}
                          guest={guest}
                          onEdit={() => setEditingId(guest.id)}
                          onRemove={() => { if (confirm(`Remove ${guest.name}?`)) removeGuest.mutate(guest.id) }}
                          onInvite={() => {
                            const action = guest.inviteSentAt ? 'Resend' : 'Send'
                            if (confirm(`${action} RSVP invite to ${guest.name} at ${guest.email}?\nThis link covers all party members.`)) {
                              sendInvite.mutate(guest.id)
                            }
                          }}
                          sendInvitePending={sendInvite.isPending}
                        />
                      )
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div key={group.guest.id} className="rounded-xl border border-gold-light bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {editingId === group.guest.id ? (
                      <EditGuestRow
                        guest={group.guest}
                        onSave={async (payload) => {
                          await updateGuest.mutateAsync({ guestId: group.guest.id, payload })
                          setEditingId(null)
                        }}
                        onCancel={() => setEditingId(null)}
                        isPending={updateGuest.isPending}
                      />
                    ) : (
                      <GuestRow
                        guest={group.guest}
                        onEdit={() => setEditingId(group.guest.id)}
                        onRemove={() => { if (confirm(`Remove ${group.guest.name}?`)) removeGuest.mutate(group.guest.id) }}
                        onInvite={() => {
                          const g = group.guest
                          const action = g.inviteSentAt ? 'Resend' : 'Send'
                          if (confirm(`${action} an RSVP invite to ${g.name} at ${g.email}?`)) {
                            sendInvite.mutate(g.id)
                          }
                        }}
                        sendInvitePending={sendInvite.isPending}
                      />
                    )}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared guest row (used inside both party blocks and solo blocks)
// ---------------------------------------------------------------------------
function GuestRow({ guest, onEdit, onRemove, onInvite, sendInvitePending }: {
  guest: Guest
  onEdit: () => void
  onRemove: () => void
  onInvite: () => void
  sendInvitePending: boolean
}) {
  return (
    <>
      <tr className="border-b border-gold-light/50 hover:bg-ivory/30 transition">
        <td className="px-4 py-3 font-medium text-brown">
          {guest.name}
          {guest.partyContact && <span className="ml-2 text-xs text-gold font-normal">(contact)</span>}
          {guest.plusOneName && <span className="ml-2 text-xs text-brown-light">+ {guest.plusOneName}</span>}
        </td>
        <td className="px-4 py-3 text-brown-light hidden sm:table-cell">{guest.email ?? '—'}</td>
        <td className="px-4 py-3 text-brown-light hidden md:table-cell capitalize">
          {guest.side ? guest.side.toLowerCase() : '—'}
        </td>
        <td className="px-4 py-3">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[guest.rsvpStatus]}`}>
            {STATUS_LABEL[guest.rsvpStatus]}
          </span>
        </td>
        <td className="px-4 py-3 text-brown-light hidden lg:table-cell">{guest.tableNumber ?? '—'}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 justify-end">
            {guest.email && (guest.inviteSendCount ?? 0) < 3 && (
              <button onClick={onInvite} disabled={sendInvitePending}
                className="text-xs text-gold hover:underline disabled:opacity-50">
                {guest.inviteSentAt ? 'Resend' : 'Invite'}
              </button>
            )}
            {guest.email && (guest.inviteSendCount ?? 0) >= 3 && (
              <span className="text-xs text-brown-light" title="Maximum 3 invites reached">Max sent</span>
            )}
            <button onClick={onEdit} className="text-xs text-brown-light hover:text-brown">Edit</button>
            <button onClick={onRemove} className="text-xs text-red-400 hover:text-red-600">Remove</button>
          </div>
        </td>
      </tr>
      {guest.noteForCouple && (
        <tr className="border-b border-gold-light/50 last:border-0 bg-gold/5">
          <td colSpan={6} className="px-4 py-2 text-xs text-brown italic">
            <span className="font-semibold not-italic">Note from {guest.name}:</span> &ldquo;{guest.noteForCouple}&rdquo;
          </td>
        </tr>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Create party form
// ---------------------------------------------------------------------------
function CreatePartyForm({ onSubmit, onCancel, isPending }: {
  onSubmit: (data: CreatePartyPayload) => Promise<void>
  onCancel: () => void
  isPending: boolean
}) {
  const [partyName, setPartyName] = useState('')
  const [members, setMembers] = useState([
    { name: '', email: '', side: '' as GuestSide | '' },
    { name: '', email: '', side: '' as GuestSide | '' },
  ])

  const updateMember = (i: number, field: string, value: string) => {
    setMembers(ms => ms.map((m, idx) => idx === i ? { ...m, [field]: value } : m))
  }
  const addRow = () => setMembers(ms => [...ms, { name: '', email: '', side: '' }])
  const removeRow = (i: number) => setMembers(ms => ms.filter((_, idx) => idx !== i))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const validMembers = members.filter(m => m.name.trim())
    if (validMembers.length < 1) return
    onSubmit({
      partyName: partyName.trim(),
      members: validMembers.map(m => ({
        name: m.name.trim(),
        email: m.email.trim() || undefined,
        plusOneAllowed: false,
        side: m.side || undefined,
      })),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gold bg-white p-5 mb-6 space-y-4">
      <p className="font-medium text-brown text-sm">Create a guest party</p>
      <p className="text-xs text-brown-light">Group a family or household under one party name. The first member will receive the shared RSVP invite.</p>
      <Field label="Party name *">
        <input required value={partyName} onChange={e => setPartyName(e.target.value)}
          className={inputCls} placeholder="e.g. The Johnson Family" />
      </Field>
      <div className="space-y-3">
        {members.map((m, i) => (
          <div key={i} className="grid sm:grid-cols-3 gap-3 items-end">
            <Field label={i === 0 ? 'Name * (contact)' : 'Name'}>
              <input value={m.name} onChange={e => updateMember(i, 'name', e.target.value)}
                className={inputCls} placeholder="Full name" required={i === 0} />
            </Field>
            <Field label="Email">
              <input type="email" value={m.email} onChange={e => updateMember(i, 'email', e.target.value)}
                className={inputCls} placeholder="Optional" />
            </Field>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Field label="Side">
                  <select value={m.side} onChange={e => updateMember(i, 'side', e.target.value)} className={inputCls}>
                    <option value="">—</option>
                    {SIDES.map(s => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
                  </select>
                </Field>
              </div>
              {members.length > 1 && (
                <button type="button" onClick={() => removeRow(i)}
                  className="mb-0.5 text-xs text-red-400 hover:text-red-600 pb-2">Remove</button>
              )}
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={addRow}
        className="text-sm text-gold hover:underline">+ Add another member</button>
      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={isPending}
          className="rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-white hover:bg-gold-dark disabled:opacity-60 transition">
          {isPending ? 'Creating…' : 'Create party'}
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
              {(['PENDING', 'ATTENDING', 'DECLINING'] as RsvpStatus[]).map(s => (
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
