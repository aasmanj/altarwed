import { useState, useCallback, useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'
import Papa from 'papaparse'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useAuth } from '@/core/auth/AuthContext'
import PageHeader from '@/components/PageHeader'
import {
  useGuests, useAddGuest, useUpdateGuest, useRemoveGuest,
  useSendInvite,
  type Guest, type RsvpStatus, type GuestSide,
} from './useGuests'
import TipCallout from '@/components/TipCallout'
import { TIPS } from '@/lib/tips'
import {
  useGoogleSheetSync, useSetGoogleSheetSync, useDeleteGoogleSheetSync,
  useTriggerGoogleSheetSync, useGoogleOAuthStatus, useGoogleDisconnect, relativeTime,
} from './useGoogleSheetSync'
import { apiClient } from '@/core/api/client'

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

  const { data: sheetSync }     = useGoogleSheetSync(coupleId)
  const setSheetSync            = useSetGoogleSheetSync(coupleId)
  const deleteSheetSync         = useDeleteGoogleSheetSync(coupleId)
  const triggerSheetSync        = useTriggerGoogleSheetSync(coupleId)
  const { data: oauthStatus }   = useGoogleOAuthStatus(coupleId)
  const googleDisconnect        = useGoogleDisconnect(coupleId)

  const [showSheetSync, setShowSheetSync] = useState(false)
  const [sheetUrlInput, setSheetUrlInput] = useState('')
  const [googleJustConnected] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('google_connected') === 'true') {
      window.history.replaceState({}, '', window.location.pathname)
      return true
    }
    return false
  })

  const [copiedHeaders, setCopiedHeaders] = useState(false)
  const SHEET_TEMPLATE_COLUMNS =
    'Side\tNames of all guests in Party (separated by , if multiple)\tPhone Number\tEmail Address\t' +
    'Street Address\tCity\tState\tZip Code\tAllowed Plus One?\tPlus One Name\t' +
    'RSVP Status\tTable #\tDietary Restriction\tNotes\tAltarWed ID (do not modify)'
  const copyHeaders = useCallback(() => {
    navigator.clipboard.writeText(SHEET_TEMPLATE_COLUMNS).then(() => {
      setCopiedHeaders(true)
      setTimeout(() => setCopiedHeaders(false), 2000)
    })
  }, [SHEET_TEMPLATE_COLUMNS])

  const [showAddModal, setShowAddModal] = useState(false)
  const [showAdd, setShowAdd]           = useState(false)
  const [filter, setFilter]             = useState<RsvpStatus | 'ALL'>('ALL')
  const [editingId, setEditingId]       = useState<string | null>(null)
  const [searchQuery, setSearchQuery]   = useState('')
  type SortKey = 'name' | 'email' | 'side' | 'status' | 'table'
  const [sortKey, setSortKey]           = useState<SortKey>('name')
  const [sortDir, setSortDir]           = useState<'asc' | 'desc'>('asc')

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc') }
  }

  const STATUS_RANK: Record<RsvpStatus, number> = { ATTENDING: 0, PENDING: 1, DECLINING: 2 }
  const SIDE_RANK: Record<string, number> = { BRIDE: 0, GROOM: 1, BOTH: 2, '': 3 }
  const compareGuests = (a: Guest, b: Guest): number => {
    let cmp = 0
    switch (sortKey) {
      case 'name':   cmp = a.name.localeCompare(b.name); break
      case 'email':  cmp = (a.email ?? '').localeCompare(b.email ?? ''); break
      case 'side':   cmp = (SIDE_RANK[a.side ?? ''] ?? 3) - (SIDE_RANK[b.side ?? ''] ?? 3); break
      case 'status': cmp = STATUS_RANK[a.rsvpStatus] - STATUS_RANK[b.rsvpStatus]; break
      case 'table':  cmp = (a.tableNumber ?? 999) - (b.tableNumber ?? 999); break
    }
    return sortDir === 'asc' ? cmp : -cmp
  }

  const q = searchQuery.trim().toLowerCase()
  const filtered = guests
    .filter(g => filter === 'ALL' || g.rsvpStatus === filter)
    .filter(g => !q
      || g.name.toLowerCase().includes(q)
      || (g.email ?? '').toLowerCase().includes(q)
      || (g.partyName ?? '').toLowerCase().includes(q)
      || (g.plusOneName ?? '').toLowerCase().includes(q))
    .sort(compareGuests)

  const total     = guests.length
  const attending = guests.filter(g => g.rsvpStatus === 'ATTENDING').length
  const declining = guests.filter(g => g.rsvpStatus === 'DECLINING').length
  const pending   = guests.filter(g => g.rsvpStatus === 'PENDING').length
  const notSent   = guests.filter(g => !g.inviteSentAt).length
  const responded = attending + declining
  const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0

  const [showAnalytics, setShowAnalytics] = useState(false)

  // Celebrate the very first RSVP. We persist the "seen first RSVP" flag in
  // localStorage so the confetti only fires once per couple, even across page
  // reloads. Uses a ref to gate effect re-runs within the same session.
  const firstRsvpFiredRef = useRef(false)
  useEffect(() => {
    if (firstRsvpFiredRef.current) return
    if (guests.length === 0) return
    const storageKey = `confetti.firstRsvp.${coupleId}`
    if (window.localStorage.getItem(storageKey) === '1') {
      firstRsvpFiredRef.current = true
      return
    }
    const hasResponse = guests.some(g => g.respondedAt)
    if (hasResponse) {
      window.localStorage.setItem(storageKey, '1')
      firstRsvpFiredRef.current = true
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.4 },
        colors: ['#d4af6a', '#22c55e', '#f5ede0', '#fbbf24'],
      })
    }
  }, [guests, coupleId])

  function exportCsv() {
    const rows = guests.map(g => ({
      'Side':                         g.side ?? '',
      'Names of all guests in Party': g.name,
      'Phone Number':                 g.phone ?? '',
      'Email Address':                g.email ?? '',
      'Street Address':               g.mailLine1 ?? '',
      'City':                         g.mailCity ?? '',
      'State':                        g.mailState ?? '',
      'Zip Code':                     g.mailZip ?? '',
      'Allowed Plus One?':            g.plusOneAllowed ? 'Yes' : 'No',
      'Plus One Name':                g.plusOneName ?? '',
      'RSVP Status':                  g.rsvpStatus,
      'Table #':                      g.tableNumber ?? '',
      'Dietary Restriction':          g.dietaryRestrictions ?? '',
      'Notes':                        g.notes ?? '',
      'Invitation Sent':              g.inviteSentAt ? new Date(g.inviteSentAt).toLocaleDateString() : '',
      'Responded At':                 g.respondedAt ? new Date(g.respondedAt).toLocaleDateString() : '',
    }))
    // BOM prefix so Excel opens the file with correct UTF-8 encoding
    const csv = '﻿' + Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `guest-list-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    // Delay revoke so the download has time to start before the object URL is released
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // Analytics data
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
          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportCsv}
              disabled={guests.length === 0}
              className="rounded-lg border border-gold px-3 py-2 text-sm font-medium text-brown hover:bg-gold/10 disabled:opacity-50 transition min-h-[44px]"
              title="Downloads as CSV"
            >
              Export<span className="hidden sm:inline"> Guest List</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-white hover:bg-gold-dark transition min-h-[44px]"
            >
              + Add Guest
            </button>
          </div>
        }
      />

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-10">

        <div className="mb-6">
          <TipCallout tip={TIPS.guestsRsvpTiming} />
        </div>

        {/* Google Sheets connected status banner */}
        {sheetSync && !showSheetSync && (
          <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 flex items-center justify-between gap-4 text-sm text-green-800">
            <span>
              <span className="font-medium">Google Sheet connected</span>
              {' · '}Last synced: {relativeTime(sheetSync.lastSynced)}
            </span>
            <button
              onClick={() => triggerSheetSync.mutate()}
              disabled={triggerSheetSync.isPending}
              className="shrink-0 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800 disabled:opacity-50 transition"
            >
              {triggerSheetSync.isPending ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        )}

        {/* Google Sheets live sync panel */}
        {showSheetSync && (
          <div className="mb-6 rounded-xl border border-gold-light bg-white p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-semibold text-brown">Google Sheets live sync</p>
                <p className="text-xs text-brown-light mt-0.5">
                  Connect your Google account or paste a published CSV URL. We sync every 15 minutes.
                </p>
              </div>
              <button onClick={() => setShowSheetSync(false)} className="text-brown-light hover:text-brown text-xl">x</button>
            </div>

            {/* One-way sync notice */}
            <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
              <span className="font-semibold">One-way sync: Sheet to AltarWed.</span>{' '}
              Changes you make to guests on this dashboard are saved here only — they won&apos;t update your spreadsheet.
              If you edit a guest here after syncing, that edit stays unless the sheet overwrites it on the next pull.
            </div>

            {/* OAuth connection status */}
            {oauthStatus?.connected ? (
              <div className="mb-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800 flex items-center justify-between gap-4">
                <div>
                  <span className="font-medium">Google account connected</span>
                  {oauthStatus.googleEmail && (
                    <span className="ml-1 text-blue-600">({oauthStatus.googleEmail})</span>
                  )}
                  <p className="text-xs text-blue-600 mt-0.5">
                    Paste any Google Sheet URL below. No need to publish it publicly.
                  </p>
                </div>
                <button
                  onClick={() => googleDisconnect.mutate()}
                  disabled={googleDisconnect.isPending}
                  className="shrink-0 text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="mb-3 rounded-lg bg-ivory border border-gold-light px-4 py-3">
                <p className="text-sm font-medium text-brown mb-1">Connect your Google account</p>
                <p className="text-xs text-brown-light mb-3">
                  Connect once, then paste any Google Sheet URL below. Your sheet stays private.
                </p>
                <button
                  onClick={async () => {
                    const resp = await apiClient.get('/api/v1/integrations/google-sheets/auth-url')
                    window.location.href = resp.data.authUrl
                  }}
                  className="rounded-lg bg-brown px-4 py-2 text-sm font-semibold text-white hover:bg-brown/90 transition"
                >
                  Connect Google Account
                </button>
              </div>
            )}

            {googleJustConnected && (
              <div className="mb-3 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
                Google account connected! Paste your sheet URL below and click Save.
              </div>
            )}

            {/* Existing sync status */}
            {sheetSync && (
              <div className="mb-3 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 flex items-center justify-between gap-4">
                <div>
                  <span className="font-medium">Sync active</span>
                  {' '}Last synced: {relativeTime(sheetSync.lastSynced)}
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
                  {triggerSheetSync.isPending ? 'Syncing...' : 'Sync now'}
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="url"
                value={sheetUrlInput}
                onChange={e => setSheetUrlInput(e.target.value)}
                placeholder={oauthStatus?.connected
                  ? 'https://docs.google.com/spreadsheets/d/...'
                  : 'Publish URL: https://docs.google.com/spreadsheets/d/.../pub?output=csv'}
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
                {setSheetSync.isPending ? 'Saving...' : 'Save'}
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

            {/* Column template tip */}
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-stone-700">
              <p className="font-semibold text-stone-800 mb-1">Column template</p>
              <p className="mb-2 text-stone-600">
                Starting a new sheet? Copy these headers into row 1 and AltarWed will map all your data automatically.
              </p>
              <div className="flex flex-wrap gap-1 mb-2">
                {['Side', 'Names of all guests in Party (separated by , if multiple)', 'Phone Number', 'Email Address',
                  'Street Address', 'City', 'State', 'Zip Code', 'Allowed Plus One?',
                  'Plus One Name', 'RSVP Status', 'Table #', 'Dietary Restriction', 'Notes',
                  'AltarWed ID (do not modify)'].map(col => (
                  <span key={col} className="rounded bg-amber-100 border border-amber-200 px-1.5 py-0.5 text-[10px] font-mono text-amber-900">
                    {col}
                  </span>
                ))}
              </div>
              <p className="text-stone-500 mb-2">
                AltarWed will fill in the last column automatically — it's how we keep your sheet in sync even if you rename guests.
              </p>
              <button
                onClick={copyHeaders}
                className="rounded-md bg-amber-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-amber-700 transition"
              >
                {copiedHeaders ? 'Copied!' : 'Copy headers'}
              </button>
              {oauthStatus?.connected && (
                <p className="mt-2 text-stone-500">
                  Paste your sheet URL from the browser address bar above.
                </p>
              )}
            </div>
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
            dietaryCounts={dietaryCounts}
            songCount={songCount}
          />
        )}

        {/* Search bar */}
        <div className="mb-4">
          <div className="relative">
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or party..."
              className="w-full rounded-lg border border-gold-light pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brown-light pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brown-light hover:text-brown text-sm"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="mt-1.5 text-xs text-brown-light">
              {filtered.length} {filtered.length === 1 ? 'match' : 'matches'}
            </p>
          )}
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

        {/* Add guest choice modal */}
        {showAddModal && (
          <AddGuestModal
            onClose={() => setShowAddModal(false)}
            onManual={() => { setShowAddModal(false); setShowAdd(true) }}
            onSheetSync={() => { setShowAddModal(false); setShowSheetSync(true); setSheetUrlInput(sheetSync?.sheetUrl ?? '') }}
          />
        )}

        {/* Add guest form */}
        {showAdd && (
          <AddGuestForm
            onSubmit={async (data) => {
              const wasFirstGuest = guests.length === 0
              await addGuest.mutateAsync(data)
              setShowAdd(false)
              if (wasFirstGuest) {
                // First guest added — celebrate the milestone.
                confetti({
                  particleCount: 120,
                  spread: 70,
                  origin: { y: 0.4 },
                  colors: ['#d4af6a', '#3b2f2f', '#f5ede0', '#fbbf24'],
                })
              }
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gold-light bg-ivory/60">
                    <SortableTh label="Name"   col="name"   sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh label="Email"  col="email"  sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden sm:table-cell" />
                    <SortableTh label="Side"   col="side"   sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden md:table-cell" />
                    <SortableTh label="Status" col="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh label="Table"  col="table"  sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden lg:table-cell" />
                    <th className="px-4 py-2.5" />
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
                      <GuestRow
                        key={guest.id}
                        guest={guest}
                        onEdit={() => setEditingId(guest.id)}
                        onRemove={() => { if (confirm(`Remove ${guest.name}?`)) removeGuest.mutate(guest.id) }}
                        onInvite={() => {
                          const action = guest.inviteSentAt ? 'Resend' : 'Send'
                          if (confirm(`${action} an RSVP invite to ${guest.name} at ${guest.email}?`)) {
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
          <button
            onClick={onEdit}
            className="text-left hover:text-gold hover:underline transition"
            title="Click to edit"
          >
            {guest.name}
          </button>
          {guest.partyContact && <span className="ml-2 text-xs text-gold font-normal">(contact)</span>}
          {guest.plusOneName && <span className="ml-2 text-xs text-brown-light">+ {guest.plusOneName}</span>}
          {guest.partyName && (
            <span className="block text-xs text-brown-light/80 mt-0.5 italic truncate">{guest.partyName}</span>
          )}
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
// Add guest choice modal
// ---------------------------------------------------------------------------
function AddGuestModal({
  onClose,
  onManual,
  onSheetSync,
}: {
  onClose: () => void
  onManual: () => void
  onSheetSync: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-serif text-lg font-semibold text-brown">Add Guests</h3>
          <button onClick={onClose} className="text-brown-light hover:text-brown text-xl leading-none">✕</button>
        </div>
        <div className="space-y-3">
          <button
            onClick={onSheetSync}
            className="w-full rounded-xl border-2 border-gold/40 hover:border-gold bg-ivory/50 hover:bg-gold/5 px-5 py-4 text-left transition"
          >
            <p className="font-semibold text-brown text-sm">📋 Sync Google Sheet</p>
            <p className="text-xs text-brown-light mt-1">Connect your Google Sheet and we'll keep your guest list in sync automatically.</p>
          </button>
          <button
            onClick={onManual}
            className="w-full rounded-xl border-2 border-gold/40 hover:border-gold bg-ivory/50 hover:bg-gold/5 px-5 py-4 text-left transition"
          >
            <p className="font-semibold text-brown text-sm">✏️ Add Guest Manually</p>
            <p className="text-xs text-brown-light mt-1">Add one guest at a time with name, email, address and RSVP details.</p>
          </button>
        </div>
      </div>
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

function GuestAnalyticsPanel({ attending, declining, pending, notSent, responseRate, total, dietaryCounts, songCount }: {
  attending: number; declining: number; pending: number; notSent: number
  responseRate: number; total: number
  dietaryCounts: Record<string, number>
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

// ---------------------------------------------------------------------------
// Sortable column header
// ---------------------------------------------------------------------------
function SortableTh<K extends string>({
  label, col, sortKey, sortDir, onSort, className = '',
}: {
  label: string
  col: K
  sortKey: K
  sortDir: 'asc' | 'desc'
  onSort: (k: K) => void
  className?: string
}) {
  const isActive = sortKey === col
  return (
    <th className={`text-left px-4 py-2.5 text-xs font-semibold text-brown-light uppercase tracking-wide ${className}`}>
      <button
        onClick={() => onSort(col)}
        className={`flex items-center gap-1 hover:text-brown transition ${isActive ? 'text-brown' : ''}`}
        title={`Sort by ${label}`}
      >
        {label}
        <span className="text-[10px] leading-none">
          {isActive ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  )
}
