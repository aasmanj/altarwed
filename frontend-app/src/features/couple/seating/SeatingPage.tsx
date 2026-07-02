import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/core/auth/AuthContext'
import PageHeader from '@/components/PageHeader'
import { useConfirm } from '@/components/ConfirmDialog'
import QueryErrorState from '@/components/QueryErrorState'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import { Printer, Users, Search } from 'lucide-react'
import { useGuests, useAssignGuestTable, type Guest } from '@/features/couple/guests/useGuests'
import {
  useSeatingTables,
  useCreateSeatingTable,
  useUpdateSeatingTable,
  useDeleteSeatingTable,
  type SeatingTable,
} from './useSeatingTables'

// ─── Guest chip (draggable on desktop) ──────────────────────────────────────

function GuestChip({
  guest,
  isAssigned = false,
  onUnassign,
  tables,
  onAssignTo,
}: {
  guest: Guest
  isAssigned?: boolean
  onUnassign?: () => void
  tables: SeatingTable[]
  onAssignTo: (tableNumber: number | null) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: guest.id })
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  // Keep pointer/click/key events on the table picker from reaching the draggable
  // wrapper, otherwise dnd-kit treats interacting with the select as a drag start.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, opacity: isDragging ? 0.3 : 1 }}
      className="group flex flex-col gap-1.5 px-3 py-2 bg-white rounded-lg border border-stone-200 shadow-sm select-none text-sm text-stone-800"
    >
      {/* Drag handle row. Listeners live here (not on the whole chip) so the picker
          below stays clickable. */}
      <div className="flex items-center gap-2 cursor-grab active:cursor-grabbing" {...listeners} {...attributes}>
        <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
        <span className="truncate flex-1">{guest.name}</span>
        {guest.plusOneName && (
          <span className="text-xs text-stone-400 flex-shrink-0">+{guest.plusOneName}</span>
        )}
        {isAssigned && onUnassign && (
          <button
            onPointerDown={stop}
            onClick={e => { stop(e); onUnassign() }}
            className="opacity-0 group-hover:opacity-100 transition flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-stone-400 hover:text-rose-600 hover:bg-rose-50"
            title="Remove from table"
            aria-label={`Unassign ${guest.name}`}
          >
            ✕
          </button>
        )}
      </div>
      {/* Click-to-assign: pick a table directly, no dragging required. Same target set
          as the drag-and-drop columns, plus an Unassigned option. */}
      <select
        value={guest.tableNumber != null && tables[guest.tableNumber - 1] ? guest.tableNumber : ''}
        onPointerDown={stop}
        onClick={stop}
        onKeyDown={stop}
        onChange={e => onAssignTo(e.target.value === '' ? null : Number(e.target.value))}
        aria-label={`Seat ${guest.name} at a table`}
        className="w-full rounded border border-stone-200 bg-stone-50 px-1.5 py-1 text-xs text-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-400"
      >
        <option value="">Unassigned</option>
        {tables.map((t, i) => (
          <option key={t.id} value={i + 1}>{t.name}</option>
        ))}
      </select>
    </div>
  )
}

// ─── Table column (droppable, desktop only) ──────────────────────────────────

function TableColumn({
  table,
  guests,
  onEdit,
  onUnassign,
  onAssign,
  tables,
  sticky = false,
  filtersActive = false,
  totalCount,
}: {
  table: SeatingTable | null
  guests: Guest[]
  onEdit?: (t: SeatingTable) => void
  onUnassign?: (guestId: string) => void
  onAssign: (guestId: string, tableNumber: number | null) => void
  tables: SeatingTable[]
  sticky?: boolean
  // Unassigned column only: whether a search/attending filter is narrowing the pool, and
  // the unfiltered total, so the header and empty state can say "X of Y shown" instead of
  // wrongly implying everyone is seated.
  filtersActive?: boolean
  totalCount?: number
}) {
  const id = table ? table.id : 'unassigned'
  const { setNodeRef, isOver } = useDroppable({ id })
  const filled = guests.length
  const capacity = table?.capacity ?? Infinity
  const overCapacity = filled > capacity
  const isUnassigned = !table

  // Unassigned column is sticky to the left so it's always reachable as a drop
  // target, no matter how many tables the couple has added.
  const stickyCls = sticky ? 'sticky left-0 z-10' : ''
  const baseColorCls = isUnassigned
    ? (isOver ? 'border-amber-500 bg-amber-100' : 'border-amber-300 bg-amber-50/70')
    : (isOver ? 'border-amber-400 bg-amber-50' : 'border-stone-200 bg-stone-50')

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-52 rounded-xl border-2 transition-colors flex flex-col ${baseColorCls} ${stickyCls}`}
    >
      <div className={`px-3 py-2 border-b rounded-t-xl ${isUnassigned ? 'border-amber-200 bg-amber-50' : 'border-stone-200 bg-white'}`}>
        <div className="flex items-center justify-between gap-1">
          <p className={`text-xs font-semibold truncate ${isUnassigned ? 'text-amber-900' : 'text-stone-700'}`}>
            {table ? table.name : '○ Unassigned'}
          </p>
          {table && onEdit && (
            <button
              onClick={() => onEdit(table)}
              className="text-stone-300 hover:text-stone-600 flex-shrink-0"
              title="Edit table"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
        </div>
        {table && (
          <p className={`text-xs mt-0.5 ${overCapacity ? 'text-rose-500 font-medium' : 'text-stone-400'}`}>
            {filled}/{table.capacity} seats{overCapacity ? ' · over capacity' : ''}
          </p>
        )}
        {!table && (
          <p className="text-xs text-amber-700 mt-0.5">
            {filtersActive && totalCount != null
              ? `${filled} of ${totalCount} shown`
              : `${filled} ${filled === 1 ? 'guest' : 'guests'} · drop here to remove`}
          </p>
        )}
      </div>
      <div className="p-2 space-y-1.5 flex-1 min-h-[80px]">
        {guests.map(g => (
          <GuestChip
            key={g.id}
            guest={g}
            isAssigned={!isUnassigned}
            onUnassign={onUnassign ? () => onUnassign(g.id) : undefined}
            tables={tables}
            onAssignTo={(tn) => onAssign(g.id, tn)}
          />
        ))}
        {isUnassigned && filled === 0 && (
          <p className="text-xs text-amber-700/60 italic px-1 py-2">
            {filtersActive && (totalCount ?? 0) > 0
              ? 'No unseated guests match your filters.'
              : 'All guests seated. Drag a guest here to remove them from a table.'}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Mobile tap-to-assign card ───────────────────────────────────────────────

function MobileGuestChip({
  guest,
  isSelected,
  onTap,
}: {
  guest: Guest
  isSelected: boolean
  onTap: () => void
}) {
  return (
    <button
      onClick={onTap}
      className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm text-left transition ${
        isSelected
          ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-300'
          : 'border-stone-200 bg-white text-stone-800'
      }`}
    >
      <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
      <span className="truncate font-medium">{guest.name}</span>
      {guest.plusOneName && (
        <span className="text-xs text-stone-400 flex-shrink-0 ml-auto">+{guest.plusOneName}</span>
      )}
      {isSelected && (
        <span className="text-xs text-amber-600 font-semibold flex-shrink-0 ml-auto">Selected</span>
      )}
    </button>
  )
}

function MobileTableCard({
  table,
  guests,
  selectedGuestId,
  onAssign,
  onEdit,
}: {
  table: SeatingTable
  guests: Guest[]
  selectedGuestId: string | null
  onAssign: (tableId: string) => void
  onEdit: (t: SeatingTable) => void
}) {
  const filled = guests.length
  const overCapacity = filled > table.capacity

  return (
    <div className="rounded-xl border-2 border-stone-200 bg-stone-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-200 bg-white flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-stone-700">{table.name}</p>
          <p className={`text-xs mt-0.5 ${overCapacity ? 'text-rose-500 font-medium' : 'text-stone-400'}`}>
            {filled}/{table.capacity} seats{overCapacity ? ' · over capacity' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedGuestId && (
            <button
              onClick={() => onAssign(table.id)}
              className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-amber-700 transition"
            >
              Assign here
            </button>
          )}
          <button
            onClick={() => onEdit(table)}
            className="text-stone-300 hover:text-stone-600"
            title="Edit table"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>
      </div>
      {guests.length > 0 && (
        <div className="p-3 flex flex-wrap gap-2">
          {guests.map(g => (
            <span
              key={g.id}
              className="text-xs bg-white border border-stone-200 rounded-full px-2.5 py-1 text-stone-700"
            >
              {g.name}
            </span>
          ))}
        </div>
      )}
      {guests.length === 0 && (
        <p className="px-4 py-3 text-xs text-stone-400 italic">No guests assigned</p>
      )}
    </div>
  )
}

// ─── Table edit modal ────────────────────────────────────────────────────────

function TableModal({
  table,
  coupleId,
  onClose,
}: {
  table: SeatingTable | null
  coupleId: string
  onClose: () => void
}) {
  const create = useCreateSeatingTable(coupleId)
  const update = useUpdateSeatingTable(coupleId)
  const del = useDeleteSeatingTable(coupleId)
  const confirm = useConfirm()

  const [name, setName] = useState(table?.name ?? '')
  const [capacity, setCapacity] = useState(String(table?.capacity ?? 8))

  async function handleSave() {
    const cap = Math.max(1, parseInt(capacity) || 8)
    if (table) {
      await update.mutateAsync({ tableId: table.id, name: name.trim() || table.name, capacity: cap })
    } else {
      await create.mutateAsync({ name: name.trim() || 'New Table', capacity: cap })
    }
    onClose()
  }

  async function handleDelete() {
    if (!table) return
    if (await confirm({
      title: `Remove "${table.name}"?`,
      message: 'Guests seated at this table will become unassigned. Your guest list is not affected.',
      tone: 'danger',
      confirmLabel: 'Remove table',
    })) {
      await del.mutateAsync(table.id)
      onClose()
    }
  }

  const isPending = create.isPending || update.isPending || del.isPending

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-stone-900 mb-5">
          {table ? 'Edit Table' : 'Add Table'}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Table Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Head Table, Family, Table 1"
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional: first field of a modal the user just opened
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Seat Capacity</label>
            <input
              type="number"
              min="1"
              max="100"
              value={capacity}
              onChange={e => setCapacity(e.target.value)}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          {table && (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="px-3 py-2.5 border border-rose-200 text-rose-600 rounded-lg text-sm hover:bg-rose-50 disabled:opacity-50"
            >
              Delete
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-stone-300 rounded-lg text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex-1 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
          >
            {isPending ? 'Saving…' : table ? 'Save' : 'Add Table'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function SeatingPage() {
  const { user } = useAuth()
  const coupleId = user?.id ?? ''
  const { data: guests = [], isLoading: guestsLoading, isError: guestsError, refetch: refetchGuests } = useGuests(coupleId)
  const { data: tables = [], isLoading: tablesLoading, isError: tablesError, refetch: refetchTables } = useSeatingTables(coupleId)
  const assignTable = useAssignGuestTable(coupleId)

  const [activeGuest, setActiveGuest] = useState<Guest | null>(null)
  const [editingTable, setEditingTable] = useState<SeatingTable | 'new' | null>(null)
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [seatingSearch, setSeatingSearch] = useState('')
  // Off by default: couples often seat guests before everyone has RSVP'd, so we don't
  // hide the un-replied by default. The toggle is there for the final attending-only pass.
  const [attendingOnly, setAttendingOnly] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveGuest(guests.find(g => g.id === event.active.id) ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveGuest(null)
    const { over, active } = event
    if (!over) return
    const guest = guests.find(g => g.id === active.id)
    if (!guest) return

    const targetTable = over.id === 'unassigned'
      ? null
      : tables.find(t => t.id === over.id)

    const newTableNumber = targetTable
      ? tables.indexOf(targetTable) + 1
      : null

    if (guest.tableNumber === newTableNumber) return
    assignTable.mutate({ guestId: guest.id, tableNumber: newTableNumber })
  }

  function handleMobileAssign(tableId: string) {
    if (!selectedGuestId) return
    const guest = guests.find(g => g.id === selectedGuestId)
    if (!guest) return
    const targetTable = tables.find(t => t.id === tableId)
    const newTableNumber = targetTable ? tables.indexOf(targetTable) + 1 : null
    assignTable.mutate({ guestId: guest.id, tableNumber: newTableNumber })
    setSelectedGuestId(null)
  }

  function handleMobileUnassign(guestId: string) {
    assignTable.mutate({ guestId, tableNumber: null })
    setSelectedGuestId(null)
  }

  function guestsForTable(table: SeatingTable) {
    const idx = tables.indexOf(table) + 1
    return guests.filter(g => g.tableNumber === idx)
  }
  const unassignedGuests = guests.filter(g => !g.tableNumber || !tables[g.tableNumber - 1])
  const assignedCount = guests.filter(g => g.tableNumber && tables[g.tableNumber - 1]).length

  // Search + attending filter only narrow the unassigned pool, the list you work from
  // when seating. Seated guests stay visible at their tables so the chart always shows
  // the full picture.
  const sq = seatingSearch.trim().toLowerCase()
  const matchesSearch = (g: Guest) =>
    !sq || g.name.toLowerCase().includes(sq) || (g.plusOneName ?? '').toLowerCase().includes(sq)
  const passesAttending = (g: Guest) => !attendingOnly || g.rsvpStatus === 'ATTENDING'
  const visibleUnassigned = unassignedGuests.filter(g => matchesSearch(g) && passesAttending(g))
  const filtersActive = sq !== '' || attendingOnly

  const assignSeat = (guestId: string, tableNumber: number | null) =>
    assignTable.mutate({ guestId, tableNumber })

  const isLoading = guestsLoading || tablesLoading
  const isError = guestsError || tablesError
  const refetch = () => { refetchGuests(); refetchTables() }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-ivory">
        <PageHeader title="Seating Chart" subtitle="Drag guests between tables to assign seats" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <QueryErrorState what="your seating chart" onRetry={refetch} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      <PageHeader
        title="Seating Chart"
        subtitle={
          isMobile
            ? 'Tap a guest, then tap a table to assign'
            : 'Drag guests between tables to assign seats'
        }
        action={
          <div className="flex items-center gap-2">
            <Link
              to="/dashboard/seating/board"
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 transition"
              title="Print a Find Your Seat board for the reception"
            >
              <Printer size={14} />
              Print seating board
            </Link>
            <button
              onClick={() => setEditingTable('new')}
              className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown hover:bg-gold-dark transition"
            >
              + Add table
            </button>
          </div>
        }
      />

      <div className="flex-1 px-4 md:px-6 py-6 overflow-auto">
        {tables.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
              <input
                type="search"
                value={seatingSearch}
                onChange={e => setSeatingSearch(e.target.value)}
                placeholder="Search guests to seat..."
                aria-label="Search unseated guests"
                className="w-full rounded-lg border border-stone-300 pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
              <input
                type="checkbox"
                checked={attendingOnly}
                onChange={e => setAttendingOnly(e.target.checked)}
                className="rounded border-stone-300 text-amber-600 focus:ring-amber-400"
              />
              Attending only
            </label>
          </div>
        )}
        {tables.length === 0 ? (
          <div className="max-w-md mx-auto mt-16 text-center">
            <div className="flex justify-center mb-4">
              <Users className="w-12 h-12 text-stone-300" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-medium text-stone-800 mb-2">No tables yet</h3>
            <p className="text-stone-500 text-sm mb-6">Add tables first, then assign guests to seats.</p>
            <button
              onClick={() => setEditingTable('new')}
              className="px-5 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
            >
              Add First Table
            </button>
          </div>
        ) : isMobile ? (
          // Mobile: tap-to-assign vertical layout
          <div className="space-y-6">
            {selectedGuestId && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-800 font-medium">
                Tap a table below to assign {guests.find(g => g.id === selectedGuestId)?.name ?? 'guest'}.
                <button
                  onClick={() => setSelectedGuestId(null)}
                  className="ml-2 text-amber-600 underline text-xs"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Unassigned pool */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-stone-500 mb-2">
                Unassigned ({visibleUnassigned.length}{filtersActive ? ` of ${unassignedGuests.length}` : ''})
              </p>
              {unassignedGuests.length === 0 ? (
                <p className="text-xs text-stone-400 italic">All guests are assigned.</p>
              ) : visibleUnassigned.length === 0 ? (
                <p className="text-xs text-stone-400 italic">No unseated guests match your search.</p>
              ) : (
                <div className="space-y-2">
                  {visibleUnassigned.map(g => (
                    <MobileGuestChip
                      key={g.id}
                      guest={g}
                      isSelected={selectedGuestId === g.id}
                      onTap={() => setSelectedGuestId(prev => prev === g.id ? null : g.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Tables */}
            <div className="space-y-4">
              {tables.map(t => {
                const tableGuests = guestsForTable(t)
                return (
                  <div key={t.id}>
                    <MobileTableCard
                      table={t}
                      guests={tableGuests}
                      selectedGuestId={selectedGuestId}
                      onAssign={handleMobileAssign}
                      onEdit={setEditingTable}
                    />
                    {/* Show assigned guests with unassign option */}
                    {tableGuests.length > 0 && (
                      <div className="mt-2 space-y-1.5 px-1">
                        {tableGuests.map(g => (
                          <div key={g.id} className="flex items-center justify-between gap-2">
                            <span className="text-xs text-stone-600 truncate">{g.name}</span>
                            <button
                              onClick={() => handleMobileUnassign(g.id)}
                              className="text-xs text-stone-400 hover:text-rose-500 flex-shrink-0"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          // Desktop: drag-and-drop
          <>
            <p className="text-sm text-stone-500 mb-4">
              Drag guests between tables, or drop them on the Unassigned column to remove a seat assignment.
              Hover a seated guest and click ✕ for a one-click unassign.
            </p>
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="flex gap-4 items-start pb-4 overflow-x-auto">
                <TableColumn
                  table={null}
                  guests={visibleUnassigned}
                  sticky
                  tables={tables}
                  onAssign={assignSeat}
                  filtersActive={filtersActive}
                  totalCount={unassignedGuests.length}
                />
                {tables.map(t => (
                  <TableColumn
                    key={t.id}
                    table={t}
                    guests={guestsForTable(t)}
                    onEdit={setEditingTable}
                    onUnassign={(guestId) => assignTable.mutate({ guestId, tableNumber: null })}
                    onAssign={assignSeat}
                    tables={tables}
                  />
                ))}
              </div>

              <DragOverlay>
                {activeGuest && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border-2 border-amber-400 shadow-xl text-sm text-stone-800 cursor-grabbing">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    {activeGuest.name}
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          </>
        )}
      </div>

      {/* Summary bar */}
      {tables.length > 0 && (
        <div className="bg-white border-t border-stone-200 px-4 md:px-6 py-3 flex flex-wrap items-center gap-4 md:gap-6 text-sm text-stone-600 flex-shrink-0">
          <span><strong className="text-stone-900">{guests.length}</strong> guests total</span>
          <span><strong className="text-stone-900">{assignedCount}</strong> assigned</span>
          <span><strong className="text-stone-900">{unassignedGuests.length}</strong> unassigned</span>
          <span>
            <strong className="text-stone-900">{tables.reduce((s, t) => s + t.capacity, 0)}</strong> seats across{' '}
            <strong className="text-stone-900">{tables.length}</strong> tables
          </span>
        </div>
      )}

      {editingTable !== null && (
        <TableModal
          table={editingTable === 'new' ? null : editingTable}
          coupleId={coupleId}
          onClose={() => setEditingTable(null)}
        />
      )}
    </div>
  )
}
