import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useAuth } from '@/core/auth/AuthContext'
import PageHeader from '@/components/PageHeader'
import {
  useGuests, useAddGuest, useUpdateGuest, useRemoveGuest,
  useSendInvite, useSendAllInvites, useCreateParty, useBulkAddGuests,
  type Guest, type RsvpStatus, type GuestSide, type CreatePartyPayload, type CreateGuestPayload,
} from './useGuests'
import TipCallout from '@/components/TipCallout'
import { TIPS } from '@/lib/tips'
import {
  useGoogleSheetSync, useSetGoogleSheetSync, useDeleteGoogleSheetSync,
  useTriggerGoogleSheetSync, relativeTime,
} from './useGoogleSheetSync'

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

  const createParty   = useCreateParty(coupleId)
  const bulkAdd       = useBulkAddGuests(coupleId)

  const { data: sheetSync }     = useGoogleSheetSync(coupleId)
  const setSheetSync            = useSetGoogleSheetSync(coupleId)
  const deleteSheetSync         = useDeleteGoogleSheetSync(coupleId)
  const triggerSheetSync        = useTriggerGoogleSheetSync(coupleId)

  const [showSheetSync, setShowSheetSync] = useState(false)
  const [sheetUrlInput, setSheetUrlInput] = useState('')

  const [showAdd, setShowAdd]         = useState(false)
  const [showParty, setShowParty]     = useState(false)
  const [showImport, setShowImport]   = useState(false)
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
  const notSent   = guests.filter(g => !g.inviteSentAt).length
  const responded = attending + declining
  const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0

  const [showAnalytics, setShowAnalytics] = useState(false)

  function exportCsv() {
    const rows = guests.map(g => ({
      Name:                g.name,
      Email:               g.email ?? '',
      Phone:               g.phone ?? '',
      'RSVP Status':       g.rsvpStatus,
      Side:                g.side ?? '',
      'Plus One Allowed':  g.plusOneAllowed ? 'Yes' : 'No',
      'Plus One Name':     g.plusOneName ?? '',
      'Meal Preference':   g.mealPreference ?? '',
      'Dietary Restrictions': g.dietaryRestrictions ?? '',
      'Song Request':      g.songRequest ?? '',
      'Table Number':      g.tableNumber ?? '',
      'Address Line 1':    g.mailLine1 ?? '',
      'City':              g.mailCity ?? '',
      'State':             g.mailState ?? '',
      'ZIP':               g.mailZip ?? '',
      'Party Name':        g.partyName ?? '',
      'Invite Sent':       g.inviteSentAt ? new Date(g.inviteSentAt).toLocaleDateString() : '',
      'Responded At':      g.respondedAt ? new Date(g.respondedAt).toLocaleDateString() : '',
    }))
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href     = url
    link.download = `guest-list-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Analytics data
  const mealCounts   = guests.filter(g => g.mealPreference).reduce<Record<string,number>>((acc, g) => {
    const k = g.mealPreference!; acc[k] = (acc[k] ?? 0) + 1; return acc
  }, {})
  const dietaryCounts = guests.filter(g => g.dietaryRestrictions).reduce<Record<string,number>>((acc, g) => {
    const k = g.dietaryRestrictions!; acc[k] = (acc[k] ?? 0) + 1; return acc
  }, {})
  const songCount   = guests.filter(g => g.songRequest).length

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
              onClick={() => { setShowSheetSync(v => !v); setSheetUrlInput(sheetSync?.sheetUrl ?? '') }}
              className="rounded-lg border border-gold px-4 py-2 text-sm font-medium text-brown hover:bg-gold/10 transition"
            >
              Google Sheets
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="rounded-lg border border-gold px-4 py-2 text-sm font-medium text-brown hover:bg-gold/10 transition"
            >
              Import CSV
            </button>
            <button
              onClick={exportCsv}
              disabled={guests.length === 0}
              className="rounded-lg border border-gold px-4 py-2 text-sm font-medium text-brown hover:bg-gold/10 disabled:opacity-50 transition"
            >
              Export CSV
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

        {/* Google Sheets live sync panel */}
        {showSheetSync && (
          <div className="mb-6 rounded-xl border border-gold-light bg-white p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-semibold text-brown">Google Sheets live sync</p>
                <p className="text-xs text-brown-light mt-0.5">
                  Paste the URL of a Google Sheet published as CSV. We'll sync every 15 minutes.
                </p>
              </div>
              <button onClick={() => setShowSheetSync(false)} className="text-brown-light hover:text-brown text-xl">✕</button>
            </div>

            {sheetSync && (
              <div className="mb-3 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 flex items-center justify-between gap-4">
                <div>
                  <span className="font-medium">Sync active</span>
                  {' — '}Last synced: {relativeTime(sheetSync.lastSynced)}
                  {sheetSync.rowCount != null && ` · ${sheetSync.rowCount} rows`}
                  {sheetSync.lastError && (
                    <p className="mt-1 text-red-600 text-xs">Error: {sheetSync.lastError}</p>
                  )}
                </div>
                <button
                  onClick={() => triggerSheetSync.mutate()}
                  disabled={triggerSheetSync.isPending}
                  className="shrink-0 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800 disabled:opacity-50 transition"
                >
                  {triggerSheetSync.isPending ? 'Syncing…' : 'Sync now'}
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="url"
                value={sheetUrlInput}
                onChange={e => setSheetUrlInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/…"
                className="flex-1 rounded-lg border border-gold-light px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
              />
              <button
                onClick={async () => {
                  if (!sheetUrlInput.trim()) return
                  await setSheetSync.mutateAsync(sheetUrlInput.trim())
                  setShowSheetSync(false)
                }}
                disabled={setSheetSync.isPending || !sheetUrlInput.trim()}
                className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white hover:bg-gold-dark disabled:opacity-50 transition"
              >
                {setSheetSync.isPending ? 'Saving…' : 'Save'}
              </button>
              {sheetSync && (
                <button
                  onClick={async () => {
                    await deleteSheetSync.mutateAsync()
                    setShowSheetSync(false)
                  }}
                  disabled={deleteSheetSync.isPending}
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
                >
                  Remove
                </button>
              )}
            </div>

            <p className="mt-2 text-xs text-brown-light">
              In your sheet: File &rarr; Share &rarr; Publish to web &rarr; CSV. Columns: Name, Email, Plus One Name, Meal Preference, Dietary Restrictions, Song Request.
            </p>
          </div>
        )}

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

        {/* Analytics toggle */}
        <div className="mb-4">
          <button
            onClick={() => setShowAnalytics(v => !v)}
            className="text-sm text-gold hover:underline"
          >
            {showAnalytics ? 'Hide analytics ▲' : 'Show analytics ▼'}
          </button>
        </div>

        {/* Analytics panel */}
        {showAnalytics && (
          <GuestAnalyticsPanel
            attending={attending}
            declining={declining}
            pending={pending}
            notSent={notSent}
            responseRate={responseRate}
            total={total}
            mealCounts={mealCounts}
            dietaryCounts={dietaryCounts}
            songCount={songCount}
          />
        )}

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

        {/* CSV import modal */}
        {showImport && (
          <CsvImportModal
            onImport={async (rows) => {
              await bulkAdd.mutateAsync(rows)
              setShowImport(false)
            }}
            onClose={() => setShowImport(false)}
            isPending={bulkAdd.isPending}
          />
        )}

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
// CSV import modal
// ---------------------------------------------------------------------------
const CSV_TEMPLATE = 'Name,Email,Phone,Side,Party Name\nJohn Smith,john@example.com,555-0100,GROOM,Smith Family\nJane Smith,,, GROOM,Smith Family\nMary Jones,mary@example.com,,BRIDE,'

function CsvImportModal({ onImport, onClose, isPending }: {
  onImport: (rows: CreateGuestPayload[]) => Promise<void>
  onClose: () => void
  isPending: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<CreateGuestPayload[] | null>(null)
  const [parseError, setParseError] = useState('')

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'guest-import-template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setParseError('')
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors.length > 0) {
          setParseError(`Parse error: ${result.errors[0].message}`)
          return
        }
        // Build party groups: rows with the same Party Name share a partyId.
        const partyIdMap = new Map<string, string>()
        const rows: CreateGuestPayload[] = result.data
          .filter(row => (row['Name'] ?? '').trim())
          .map(row => {
            const name  = (row['Name']  ?? '').trim()
            const email = (row['Email'] ?? '').trim() || undefined
            const phone = (row['Phone'] ?? '').trim() || undefined
            const side  = (['BRIDE','GROOM','BOTH'].includes((row['Side'] ?? '').trim().toUpperCase())
              ? (row['Side'] ?? '').trim().toUpperCase()
              : undefined) as GuestSide | undefined
            const partyNameVal = (row['Party Name'] ?? '').trim() || undefined
            let partyId: string | undefined
            let partyName: string | undefined
            if (partyNameVal) {
              if (!partyIdMap.has(partyNameVal)) {
                partyIdMap.set(partyNameVal, crypto.randomUUID())
              }
              partyId   = partyIdMap.get(partyNameVal)
              partyName = partyNameVal
            }
            return { name, email, phone, side, plusOneAllowed: false, partyId, partyName }
          })
        if (rows.length === 0) { setParseError('No valid rows found.'); return }
        setPreview(rows)
      },
      error: (err) => setParseError(err.message),
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-serif text-lg font-semibold text-brown">Import guests from CSV</h3>
          <button onClick={onClose} className="text-brown-light hover:text-brown text-xl leading-none">✕</button>
        </div>

        {!preview ? (
          <>
            <p className="text-sm text-brown-light mb-4">
              Upload a CSV file with columns: <strong>Name, Email, Phone, Side, Party Name</strong>.<br />
              Rows with the same Party Name are automatically grouped into a party.
            </p>
            <button onClick={downloadTemplate}
              className="text-sm text-gold hover:underline mb-4 block">
              Download template CSV →
            </button>
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile}
              className="block w-full text-sm text-brown-light file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gold/10 file:text-brown hover:file:bg-gold/20 cursor-pointer" />
            {parseError && <p className="mt-3 text-sm text-red-600">{parseError}</p>}
          </>
        ) : (
          <>
            <p className="text-sm text-brown-light mb-3">{preview.length} guest{preview.length !== 1 ? 's' : ''} ready to import:</p>
            <div className="rounded-xl border border-gold-light overflow-hidden mb-5">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-ivory/60 border-b border-gold-light">
                    <th className="text-left px-3 py-2 text-brown font-semibold">Name</th>
                    <th className="text-left px-3 py-2 text-brown font-semibold hidden sm:table-cell">Email</th>
                    <th className="text-left px-3 py-2 text-brown font-semibold">Side</th>
                    <th className="text-left px-3 py-2 text-brown font-semibold">Party</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((g, i) => (
                    <tr key={i} className="border-b border-gold-light/40 last:border-0">
                      <td className="px-3 py-1.5 text-brown">{g.name}</td>
                      <td className="px-3 py-1.5 text-brown-light hidden sm:table-cell">{g.email ?? '—'}</td>
                      <td className="px-3 py-1.5 text-brown-light capitalize">{g.side?.toLowerCase() ?? '—'}</td>
                      <td className="px-3 py-1.5 text-brown-light">{g.partyName ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => onImport(preview)}
                disabled={isPending}
                className="rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-white hover:bg-gold-dark disabled:opacity-60 transition"
              >
                {isPending ? 'Importing…' : `Import ${preview.length} guest${preview.length !== 1 ? 's' : ''}`}
              </button>
              <button onClick={() => setPreview(null)}
                className="rounded-lg border border-gold-light px-5 py-2 text-sm font-medium text-brown hover:bg-ivory transition">
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
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
  const [name, setName]           = useState('')
  const [email, setEmail]         = useState('')
  const [phone, setPhone]         = useState('')
  const [side, setSide]           = useState<GuestSide | ''>('')
  const [plusOne, setPlusOne]     = useState(false)
  const [mailLine1, setMailLine1] = useState('')
  const [mailCity, setMailCity]   = useState('')
  const [mailState, setMailState] = useState('')
  const [mailZip, setMailZip]     = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      name,
      email: email || undefined,
      phone: phone || undefined,
      plusOneAllowed: plusOne,
      side: side || undefined,
      mailLine1: mailLine1 || undefined,
      mailCity: mailCity || undefined,
      mailState: mailState || undefined,
      mailZip: mailZip || undefined,
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
        <Field label="Address line 1">
          <input value={mailLine1} onChange={e => setMailLine1(e.target.value)}
            className={inputCls} placeholder="123 Main St" />
        </Field>
        <Field label="City">
          <input value={mailCity} onChange={e => setMailCity(e.target.value)}
            className={inputCls} placeholder="Dallas" />
        </Field>
        <Field label="State (2-letter)">
          <input value={mailState} onChange={e => setMailState(e.target.value.toUpperCase())}
            className={inputCls} placeholder="TX" maxLength={2} />
        </Field>
        <Field label="ZIP">
          <input value={mailZip} onChange={e => setMailZip(e.target.value)}
            className={inputCls} placeholder="75201" maxLength={10} />
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
  const [meal, setMeal]           = useState(guest.mealPreference ?? '')
  const [song, setSong]           = useState(guest.songRequest ?? '')
  const [mailLine1, setMailLine1] = useState(guest.mailLine1 ?? '')
  const [mailCity, setMailCity]   = useState(guest.mailCity ?? '')
  const [mailState, setMailState] = useState(guest.mailState ?? '')
  const [mailZip, setMailZip]     = useState(guest.mailZip ?? '')

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
      mailLine1: mailLine1 || undefined,
      mailCity: mailCity || undefined,
      mailState: mailState || undefined,
      mailZip: mailZip || undefined,
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
          <Field label="Address line 1">
            <input value={mailLine1} onChange={e => setMailLine1(e.target.value)}
              placeholder="123 Main St" className={inputCls} />
          </Field>
          <Field label="City">
            <input value={mailCity} onChange={e => setMailCity(e.target.value)}
              placeholder="Dallas" className={inputCls} />
          </Field>
          <Field label="State (2-letter)">
            <input value={mailState} onChange={e => setMailState(e.target.value.toUpperCase())}
              placeholder="TX" maxLength={2} className={inputCls} />
          </Field>
          <Field label="ZIP">
            <input value={mailZip} onChange={e => setMailZip(e.target.value)}
              placeholder="75201" maxLength={10} className={inputCls} />
          </Field>
          <div className="flex items-end gap-6 pb-0.5">
            <label className="flex items-center gap-2 text-sm text-brown">
              <input type="checkbox" checked={plusOne} onChange={e => setPlusOne(e.target.checked)}
                className="rounded border-gold-light" />
              Allow +1
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

// ---------------------------------------------------------------------------
// Guest analytics panel
// ---------------------------------------------------------------------------
const PIE_COLORS = ['#4ade80', '#f87171', '#fbbf24', '#94a3b8']

function GuestAnalyticsPanel({ attending, declining, pending, notSent, responseRate, total, mealCounts, dietaryCounts, songCount }: {
  attending: number; declining: number; pending: number; notSent: number
  responseRate: number; total: number
  mealCounts: Record<string, number>; dietaryCounts: Record<string, number>
  songCount: number
}) {
  const pieData = [
    { name: 'Attending', value: attending },
    { name: 'Declining', value: declining },
    { name: 'Pending', value: pending },
    { name: 'Not invited', value: notSent },
  ].filter(d => d.value > 0)

  return (
    <div className="rounded-xl border border-gold-light bg-white p-6 mb-6 space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Pie chart */}
        <div>
          <p className="text-sm font-medium text-brown mb-2">Response breakdown</p>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={55} dataKey="value" paddingAngle={2}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [`${v} guests`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1">
              {pieData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-brown-light">{d.name}</span>
                  <span className="font-semibold text-brown">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Key stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-gold-light bg-ivory/50 p-4 text-center">
            <p className="font-serif text-2xl font-bold text-brown">{responseRate}%</p>
            <p className="text-xs text-brown-light mt-0.5">Response rate</p>
          </div>
          <div className="rounded-xl border border-gold-light bg-ivory/50 p-4 text-center">
            <p className="font-serif text-2xl font-bold text-brown">{songCount}</p>
            <p className="text-xs text-brown-light mt-0.5">Song requests</p>
          </div>
          <div className="rounded-xl border border-gold-light bg-ivory/50 p-4 text-center">
            <p className="font-serif text-2xl font-bold text-brown">{total}</p>
            <p className="text-xs text-brown-light mt-0.5">Total guests</p>
          </div>
        </div>
      </div>

      {/* Meal preferences */}
      {Object.keys(mealCounts).length > 0 && (
        <div>
          <p className="text-sm font-medium text-brown mb-2">Meal preferences</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(mealCounts).map(([meal, count]) => (
              <span key={meal} className="px-3 py-1 rounded-full bg-gold/10 text-brown text-xs font-medium">
                {meal} <span className="text-gold font-bold ml-1">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Dietary restrictions */}
      {Object.keys(dietaryCounts).length > 0 && (
        <div>
          <p className="text-sm font-medium text-brown mb-2">Dietary restrictions</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(dietaryCounts).map(([restriction, count]) => (
              <span key={restriction} className="px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-medium">
                {restriction} <span className="font-bold ml-1">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
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
