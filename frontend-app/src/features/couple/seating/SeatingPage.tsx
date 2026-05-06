import { useState } from 'react'
import { useAuth } from '@/core/auth/AuthContext'
import PageHeader from '@/components/PageHeader'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import { useGuests, useUpdateGuest, type Guest } from '@/features/couple/guests/useGuests'
import {
  useSeatingTables,
  useCreateSeatingTable,
  useUpdateSeatingTable,
  useDeleteSeatingTable,
  type SeatingTable,
} from './useSeatingTables'

// ─── Guest chip (draggable) ──────────────────────────────────────────────────

function GuestChip({ guest }: { guest: Guest }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: guest.id })
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ ...style, opacity: isDragging ? 0.3 : 1 }}
      className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-stone-200 shadow-sm cursor-grab active:cursor-grabbing select-none text-sm text-stone-800"
    >
      <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
      <span className="truncate">{guest.name}</span>
      {guest.plusOneName && (
        <span className="text-xs text-stone-400 flex-shrink-0">+{guest.plusOneName}</span>
      )}
    </div>
  )
}

// ─── Table column (droppable) ────────────────────────────────────────────────

function TableColumn({
  table,
  guests,
  onEdit,
}: {
  table: SeatingTable | null   // null = unassigned column
  guests: Guest[]
  onEdit?: (t: SeatingTable) => void
}) {
  const id = table ? table.id : 'unassigned'
  const { setNodeRef, isOver } = useDroppable({ id })
  const filled = guests.length
  const capacity = table?.capacity ?? Infinity
  const overCapacity = filled > capacity

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-52 rounded-xl border-2 transition-colors flex flex-col ${
        isOver ? 'border-amber-400 bg-amber-50' : 'border-stone-200 bg-stone-50'
      }`}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-stone-200 bg-white rounded-t-xl">
        <div className="flex items-center justify-between gap-1">
          <p className="text-xs font-semibold text-stone-700 truncate">
            {table ? table.name : 'Unassigned'}
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
          <p className="text-xs text-stone-400 mt-0.5">{filled} guests</p>
        )}
      </div>

      {/* Guest list */}
      <div className="p-2 space-y-1.5 flex-1 min-h-[80px]">
        {guests.map(g => (
          <GuestChip key={g.id} guest={g} />
        ))}
      </div>
    </div>
  )
}

// ─── Table edit modal ────────────────────────────────────────────────────────

function TableModal({
  table,
  coupleId,
  onClose,
}: {
  table: SeatingTable | null  // null = create mode
  coupleId: string
  onClose: () => void
}) {
  const create = useCreateSeatingTable(coupleId)
  const update = useUpdateSeatingTable(coupleId)
  const del = useDeleteSeatingTable(coupleId)

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
    if (confirm(`Remove "${table.name}"? Guests at this table will become unassigned.`)) {
      await del.mutateAsync(table.id)
      onClose()
    }
  }

  const isPending = create.isPending || update.isPending || del.isPending

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
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
  const { data: guests = [], isLoading: guestsLoading } = useGuests(coupleId)
  const { data: tables = [], isLoading: tablesLoading } = useSeatingTables(coupleId)
  const updateGuest = useUpdateGuest(coupleId)

  const [activeGuest, setActiveGuest] = useState<Guest | null>(null)
  const [editingTable, setEditingTable] = useState<SeatingTable | 'new' | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function handleDragStart(event: DragStartEvent) {
    setActiveGuest(guests.find(g => g.id === event.active.id) ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveGuest(null)
    const { over, active } = event
    if (!over) return
    const guest = guests.find(g => g.id === active.id)
    if (!guest) return

    // Resolve the drop target: unassigned column or a named table
    const targetTable = over.id === 'unassigned'
      ? null
      : tables.find(t => t.id === over.id)

    // tableNumber: use 1-based index into the sorted table array
    const newTableNumber = targetTable
      ? tables.indexOf(targetTable) + 1
      : null

    if (guest.tableNumber === newTableNumber) return
    updateGuest.mutate({ guestId: guest.id, payload: { tableNumber: newTableNumber ?? undefined } })
  }

  // Map guests to table slots: tableNumber 1..N → tables[0..N-1]
  function guestsForTable(table: SeatingTable) {
    const idx = tables.indexOf(table) + 1  // 1-based
    return guests.filter(g => g.tableNumber === idx)
  }
  const unassignedGuests = guests.filter(g => !g.tableNumber || !tables[g.tableNumber - 1])

  const assignedCount = guests.filter(g => g.tableNumber && tables[g.tableNumber - 1]).length
  const isLoading = guestsLoading || tablesLoading

  if (isLoading) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      <PageHeader
        title="Seating Chart"
        subtitle="Drag guests between tables to assign seats"
        action={
          <button
            onClick={() => setEditingTable('new')}
            className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white hover:bg-gold-dark transition"
          >
            + Add table
          </button>
        }
      />

      {/* Board */}
      <div className="flex-1 px-6 py-6 overflow-auto">
        {tables.length === 0 ? (
          <div className="max-w-md mx-auto mt-16 text-center">
            <div className="text-5xl mb-4">🪑</div>
            <h3 className="text-lg font-medium text-stone-800 mb-2">No tables yet</h3>
            <p className="text-stone-500 text-sm mb-6">Add tables first, then drag guests to assign seats.</p>
            <button
              onClick={() => setEditingTable('new')}
              className="px-5 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
            >
              Add First Table
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-stone-500 mb-4">
              Drag guests between tables. Click the pencil icon to rename a table or change its capacity.
            </p>
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="flex gap-4 items-start pb-4">
                {/* Unassigned column always first */}
                <TableColumn
                  table={null}
                  guests={unassignedGuests}
                />
                {/* Named tables */}
                {tables.map(t => (
                  <TableColumn
                    key={t.id}
                    table={t}
                    guests={guestsForTable(t)}
                    onEdit={setEditingTable}
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
        <div className="bg-white border-t border-stone-200 px-6 py-3 flex items-center gap-6 text-sm text-stone-600 flex-shrink-0">
          <span><strong className="text-stone-900">{guests.length}</strong> guests total</span>
          <span><strong className="text-stone-900">{assignedCount}</strong> assigned</span>
          <span><strong className="text-stone-900">{unassignedGuests.length}</strong> unassigned</span>
          <span>
            <strong className="text-stone-900">{tables.reduce((s, t) => s + t.capacity, 0)}</strong> seats across{' '}
            <strong className="text-stone-900">{tables.length}</strong> tables
          </span>
        </div>
      )}

      {/* Table create/edit modal */}
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
