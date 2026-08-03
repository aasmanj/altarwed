import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useAuth } from '@/core/auth/AuthContext'
import PageHeader from '@/components/PageHeader'
import { useConfirm } from '@/components/ConfirmDialog'
import QueryErrorState from '@/components/QueryErrorState'
import { AnimatedModal } from '@/components/AnimatedModal'
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
import { toast } from 'sonner'
import { Printer, Users, Search, X, Circle, CircleCheck, CircleX, Pencil, AlertTriangle, WandSparkles, Eraser, IdCard } from 'lucide-react'
import { TOUCH_REVEAL } from '@/lib/touchReveal'
import { useGuests, useAssignGuestTable, type Guest, type RsvpStatus } from '@/features/couple/guests/useGuests'
import {
  useSeatingTables,
  useCreateSeatingTable,
  useUpdateSeatingTable,
  useDeleteSeatingTable,
  type SeatingTable,
} from './useSeatingTables'
import {
  CAPACITY_PRESETS,
  TABLE_SHAPES,
  normalizeShape,
  shapeLabel,
  type TableShape,
} from './tableShape'
import {
  groupUnassignedByParty,
  partyHeadcountById,
  countUnseatedAttending,
  rsvpStatusLabel,
  rsvpColorClass,
  seatedNonAttendingFlag,
  type GroupedUnassigned,
  type PartyGroup,
} from './seatingGroups'
import { planAutoSeat, seatedGuestIds, autoSeatSummary } from './autoSeat'
import TableShapeIcon from './TableShapeIcon'

// ─── RSVP status indicator ───────────────────────────────────────────────────
// A distinct icon shape per status (check / x / hollow circle) plus an accessible
// label, so the status is never conveyed by color alone (WCAG 1.4.1).
function RsvpStatusDot({ status }: { status: RsvpStatus }) {
  const Icon = status === 'ATTENDING' ? CircleCheck : status === 'DECLINING' ? CircleX : Circle
  return (
    <span className="flex-shrink-0 inline-flex items-center" title={rsvpStatusLabel(status)}>
      <Icon size={13} className={rsvpColorClass(status)} aria-hidden="true" />
      <span className="sr-only">RSVP: {rsvpStatusLabel(status)}</span>
    </span>
  )
}

// ─── Guest chip (draggable on desktop) ──────────────────────────────────────

function GuestChip({
  guest,
  isAssigned = false,
  onUnassign,
  tables,
  onAssignTo,
  partyName,
  partyHeadcount,
}: {
  guest: Guest
  isAssigned?: boolean
  onUnassign?: () => void
  tables: SeatingTable[]
  onAssignTo: (tableNumber: number | null) => void
  // Household label + size to show on the chip. Omitted (null) when the chip already
  // sits inside a household group, where repeating the name on every row is noise.
  partyName?: string | null
  partyHeadcount?: number
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: guest.id })
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  // Keep pointer/click/key events on the table picker from reaching the draggable
  // wrapper, otherwise dnd-kit treats interacting with the select as a drag start.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  // Flag a seated guest who is not attending: a declined guest left on the chart would
  // otherwise silently ride onto the printed board.
  const flag = seatedNonAttendingFlag(guest, isAssigned)
  const showSubline = !!partyName || !!flag

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, opacity: isDragging ? 0.3 : 1 }}
      className="group flex flex-col gap-1.5 px-3 py-2 bg-white rounded-lg border border-stone-200 shadow-sm select-none text-sm text-stone-800"
    >
      {/* Drag handle row. Listeners live here (not on the whole chip) so the picker
          below stays clickable. */}
      <div className="flex items-center gap-2 cursor-grab active:cursor-grabbing" {...listeners} {...attributes}>
        <RsvpStatusDot status={guest.rsvpStatus} />
        <span className="truncate flex-1">{guest.name}</span>
        {guest.plusOneName && (
          <span className="text-xs text-stone-400 flex-shrink-0">+{guest.plusOneName}</span>
        )}
        {isAssigned && onUnassign && (
          <button
            onPointerDown={stop}
            onClick={e => { stop(e); onUnassign() }}
            className={`${TOUCH_REVEAL} transition flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-stone-400 hover:text-rose-600 hover:bg-rose-50`}
            title="Remove from table"
            aria-label={`Unassign ${guest.name}`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {showSubline && (
        <div className="flex items-center gap-1.5 flex-wrap pl-[21px]">
          {partyName && (
            <span className="text-[11px] text-stone-400 truncate">
              {partyName}{partyHeadcount ? ` · ${partyHeadcount}` : ''}
            </span>
          )}
          {flag && (
            <span
              className={`text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 ${
                flag.tone === 'danger'
                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                  : 'bg-stone-100 text-stone-500'
              }`}
            >
              {flag.label}
            </span>
          )}
        </div>
      )}
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
  groups,
  onSeatParty,
  partyHeadcounts,
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
  // Unassigned column only: households + individuals to render as grouped, one-click
  // seatable sections. When absent the column falls back to a flat chip list.
  groups?: GroupedUnassigned
  onSeatParty?: (members: Guest[], tableNumber: number) => void
  // partyId -> household headcount, for the household label shown on each chip.
  partyHeadcounts?: Map<string, number>
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
          <div className="flex items-center gap-1.5 min-w-0">
            {table
              ? <TableShapeIcon shape={table.shape} capacity={table.capacity} size={18} className="text-stone-500 flex-shrink-0" />
              : <Circle size={14} className="text-amber-500 flex-shrink-0" aria-hidden="true" />}
            <p className={`text-xs font-semibold truncate ${isUnassigned ? 'text-amber-900' : 'text-stone-700'}`}>
              {table ? table.name : 'Unassigned'}
            </p>
          </div>
          {table && onEdit && (
            <button
              onClick={() => onEdit(table)}
              className="text-stone-300 hover:text-stone-600 flex-shrink-0"
              title="Edit table"
              aria-label="Edit table"
            >
              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
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
        {isUnassigned && groups && onSeatParty ? (
          <UnassignedGroupedBody
            groups={groups}
            tables={tables}
            onAssign={onAssign}
            onSeatParty={onSeatParty}
            partyHeadcounts={partyHeadcounts}
          />
        ) : (
          guests.map(g => (
            <GuestChip
              key={g.id}
              guest={g}
              isAssigned={!isUnassigned}
              onUnassign={onUnassign ? () => onUnassign(g.id) : undefined}
              tables={tables}
              onAssignTo={(tn) => onAssign(g.id, tn)}
              partyName={g.partyName}
              partyHeadcount={g.partyId ? partyHeadcounts?.get(g.partyId) : undefined}
            />
          ))
        )}
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

// ─── Grouped unassigned pool (desktop) ───────────────────────────────────────
// Households first (each with a one-click "seat all" picker), then everyone with
// no household under Individuals. Individual chips keep drag-and-drop and the
// per-chip picker, so no existing single-guest flow changes.

function SeatAllPicker({ group, tables, onSeatParty }: {
  group: PartyGroup
  tables: SeatingTable[]
  onSeatParty: (members: Guest[], tableNumber: number) => void
}) {
  const selectId = `seat-all-${group.partyId}`
  return (
    <>
      <label htmlFor={selectId} className="sr-only">Seat the {group.partyName} household at a table</label>
      <select
        id={selectId}
        value=""
        onChange={e => { if (e.target.value) onSeatParty(group.guests, Number(e.target.value)) }}
        className="w-full rounded border border-amber-300 bg-amber-50 px-1.5 py-1 text-xs font-medium text-amber-800 focus:outline-none focus:ring-1 focus:ring-amber-400"
      >
        <option value="">Seat all {group.headcount} at...</option>
        {tables.map((t, i) => (
          <option key={t.id} value={i + 1}>{t.name}</option>
        ))}
      </select>
    </>
  )
}

function PartyGroupBlock({ group, tables, onAssign, onSeatParty }: {
  group: PartyGroup
  tables: SeatingTable[]
  onAssign: (guestId: string, tableNumber: number | null) => void
  onSeatParty: (members: Guest[], tableNumber: number) => void
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-white/60 p-1.5 space-y-1.5">
      <div className="flex items-center justify-between gap-1 px-0.5">
        <p className="text-xs font-semibold text-amber-900 truncate">
          {group.partyName}
          <span className="font-normal text-amber-700"> · {group.headcount}</span>
        </p>
      </div>
      <SeatAllPicker group={group} tables={tables} onSeatParty={onSeatParty} />
      <div className="space-y-1.5">
        {group.guests.map(g => (
          <GuestChip
            key={g.id}
            guest={g}
            tables={tables}
            onAssignTo={(tn) => onAssign(g.id, tn)}
            partyName={null}
          />
        ))}
      </div>
    </div>
  )
}

function UnassignedGroupedBody({ groups, tables, onAssign, onSeatParty, partyHeadcounts }: {
  groups: GroupedUnassigned
  tables: SeatingTable[]
  onAssign: (guestId: string, tableNumber: number | null) => void
  onSeatParty: (members: Guest[], tableNumber: number) => void
  partyHeadcounts?: Map<string, number>
}) {
  return (
    <div className="space-y-2">
      {groups.parties.map(group => (
        <PartyGroupBlock
          key={group.partyId}
          group={group}
          tables={tables}
          onAssign={onAssign}
          onSeatParty={onSeatParty}
        />
      ))}
      {groups.individuals.length > 0 && (
        <div className="space-y-1.5">
          {groups.parties.length > 0 && (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700/70 px-0.5 pt-1">
              Individuals
            </p>
          )}
          {groups.individuals.map(g => (
            <GuestChip
              key={g.id}
              guest={g}
              tables={tables}
              onAssignTo={(tn) => onAssign(g.id, tn)}
              partyName={g.partyName}
              partyHeadcount={g.partyId ? partyHeadcounts?.get(g.partyId) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Mobile tap-to-assign card ───────────────────────────────────────────────

function MobileGuestChip({
  guest,
  isSelected,
  onTap,
  partyName,
  partyHeadcount,
}: {
  guest: Guest
  isSelected: boolean
  onTap: () => void
  partyName?: string | null
  partyHeadcount?: number
}) {
  return (
    <button
      onClick={onTap}
      className={`w-full flex flex-col gap-0.5 px-3 py-2.5 rounded-lg border text-sm text-left transition ${
        isSelected
          ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-300'
          : 'border-stone-200 bg-white text-stone-800'
      }`}
    >
      <span className="flex items-center gap-2 w-full">
        <RsvpStatusDot status={guest.rsvpStatus} />
        <span className="truncate font-medium">{guest.name}</span>
        {guest.plusOneName && !isSelected && (
          <span className="text-xs text-stone-400 flex-shrink-0 ml-auto">+{guest.plusOneName}</span>
        )}
        {isSelected && (
          <span className="text-xs text-amber-600 font-semibold flex-shrink-0 ml-auto">Selected</span>
        )}
      </span>
      {partyName && (
        <span className="text-[11px] text-stone-400 truncate pl-[21px]">
          {partyName}{partyHeadcount ? ` · ${partyHeadcount}` : ''}
        </span>
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
        <div className="flex items-center gap-2 min-w-0">
          <TableShapeIcon shape={table.shape} capacity={table.capacity} size={22} className="text-stone-500 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-stone-700 truncate">{table.name}</p>
            <p className={`text-xs mt-0.5 ${overCapacity ? 'text-rose-500 font-medium' : 'text-stone-400'}`}>
              {filled}/{table.capacity} seats{overCapacity ? ' · over capacity' : ''}
            </p>
          </div>
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
            aria-label="Edit table"
          >
            <Pencil className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      {guests.length > 0 && (
        <div className="p-3 flex flex-wrap gap-2">
          {guests.map(g => {
            const flag = seatedNonAttendingFlag(g, true)
            return (
              <span
                key={g.id}
                className={`text-xs bg-white border rounded-full px-2.5 py-1 inline-flex items-center gap-1.5 ${
                  flag?.tone === 'danger' ? 'border-rose-200 text-rose-700' : 'border-stone-200 text-stone-700'
                }`}
              >
                <RsvpStatusDot status={g.rsvpStatus} />
                {g.name}
                {flag && (
                  <span className={`font-semibold uppercase tracking-wide ${flag.tone === 'danger' ? 'text-rose-600' : 'text-stone-400'}`}>
                    {flag.label}
                  </span>
                )}
              </span>
            )
          })}
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
  const [shape, setShape] = useState<TableShape>(normalizeShape(table?.shape))

  async function handleSave() {
    const cap = Math.max(1, parseInt(capacity) || 8)
    if (table) {
      await update.mutateAsync({ tableId: table.id, name: name.trim() || table.name, capacity: cap, shape })
    } else {
      await create.mutateAsync({ name: name.trim() || 'New Table', capacity: cap, shape })
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
    <AnimatedModal onClose={onClose} backdropClassName="bg-black/50" ariaLabelledBy="table-modal-title" panelClassName="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto">
        <h2 id="table-modal-title" className="text-lg font-semibold text-stone-900 mb-5">
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
            <span className="block text-sm font-medium text-stone-700 mb-1.5">Table Shape</span>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Table shape">
              {TABLE_SHAPES.map(s => {
                const selected = shape === s
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setShape(s)}
                    aria-pressed={selected}
                    className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                      selected
                        ? 'border-amber-500 bg-amber-50 text-amber-800'
                        : 'border-stone-300 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <TableShapeIcon shape={s} capacity={parseInt(capacity) || 8} size={30} />
                    {shapeLabel(s)}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label htmlFor="table-capacity" className="block text-sm font-medium text-stone-700 mb-1">Seat Capacity</label>
            <div className="flex flex-wrap gap-1.5 mb-2" role="group" aria-label="Capacity presets">
              {CAPACITY_PRESETS.map(preset => {
                const selected = (parseInt(capacity) || 0) === preset
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCapacity(String(preset))}
                    aria-pressed={selected}
                    className={`min-w-[2.25rem] rounded-lg border px-2 py-1 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                      selected
                        ? 'border-amber-500 bg-amber-50 text-amber-800'
                        : 'border-stone-300 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    {preset}
                  </button>
                )
              })}
            </div>
            <input
              id="table-capacity"
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
    </AnimatedModal>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

// Concurrency cap for the bulk seat actions. Small enough to be polite to the API
// and to keep the optimistic-cache snapshots from stacking, large enough that an
// 80-guest auto-seat still feels instant.
const BULK_BATCH_SIZE = 5

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
  // On by default: the pool you work from is the people who are actually coming, so
  // declined/unreplied guests do not clutter it. This only filters the *unassigned*
  // pool; a guest who was seated and later declined is never hidden, they stay on the
  // chart with a "Declined" badge so the couple notices before printing.
  const [attendingOnly, setAttendingOnly] = useState(true)
  // Guards the two bulk actions (auto-seat / clear all) so a couple cannot fire a
  // second wave of writes on top of one still in flight.
  const [bulkBusy, setBulkBusy] = useState(false)
  const confirm = useConfirm()

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

  // Seat every member of a household at one table in a single action. Members already at
  // the target table are skipped so we don't fire no-op writes.
  function seatParty(members: Guest[], tableNumber: number) {
    for (const g of members) {
      if (g.tableNumber === tableNumber) continue
      assignTable.mutate({ guestId: g.id, tableNumber })
    }
    setSelectedGuestId(null)
  }

  // Apply a batch of seat writes. There is no bulk-assign endpoint, so this is N
  // calls to the existing per-guest endpoint, throttled to BULK_BATCH_SIZE at a time:
  // unbounded Promise.all over an 80-guest list would open 80 sockets at once and
  // interleave 80 optimistic-cache snapshots. On the first failure we stop instead of
  // pushing the rest, so a couple sees one error toast rather than a wall of them and
  // the chart is left in a state they can re-run auto-seat on.
  async function applySeatWrites(writes: { guestId: string; tableNumber: number | null }[]) {
    let applied = 0
    for (let i = 0; i < writes.length; i += BULK_BATCH_SIZE) {
      const chunk = writes.slice(i, i + BULK_BATCH_SIZE)
      const results = await Promise.all(
        chunk.map(w => assignTable.mutateAsync(w).then(() => true, () => false)),
      )
      applied += results.filter(Boolean).length
      if (results.some(ok => !ok)) return { applied, failed: true }
    }
    return { applied, failed: false }
  }

  // One click that turns ~80 placements into ~10 corrections: fill the tables the
  // couple already built with whole households, largest first. Purely additive, it
  // never moves someone who is already seated, so "Clear all seats" is its inverse.
  async function handleAutoSeat() {
    const plan = planAutoSeat(guests, tables)
    if (plan.assignments.length === 0) {
      toast.info(
        plan.unplaced.length > 0
          ? 'No household fits in the seats left. Add a table or raise a capacity, then try again.'
          : 'Nothing to auto-seat. Every attending guest already has a table.',
      )
      return
    }
    setBulkBusy(true)
    try {
      const { applied, failed } = await applySeatWrites(plan.assignments)
      if (failed) {
        toast.warning(`Auto-seat stopped early. ${applied} of ${plan.assignments.length} guests were seated.`)
        return
      }
      toast.success(autoSeatSummary(plan.seatedGuests, plan.tablesUsed, plan.unplaced.length))
    } finally {
      setBulkBusy(false)
    }
  }

  // The single-action inverse of auto-seat. Destructive to the arrangement (though
  // never to the guest list), so it asks first.
  async function handleClearAllSeats() {
    const ids = seatedGuestIds(guests, tables.length)
    if (ids.length === 0) {
      toast.info('No one is seated yet.')
      return
    }
    const ok = await confirm({
      title: `Clear all ${ids.length} seat assignments?`,
      message: 'Everyone moves back to the unassigned pool. Your guest list, tables and RSVPs are not affected.',
      tone: 'danger',
      confirmLabel: 'Clear all seats',
    })
    if (!ok) return
    setBulkBusy(true)
    try {
      const { applied, failed } = await applySeatWrites(ids.map(guestId => ({ guestId, tableNumber: null })))
      if (failed) {
        toast.warning(`Stopped early. ${applied} of ${ids.length} guests were unseated.`)
        return
      }
      toast.success(`Cleared ${applied} seat ${applied === 1 ? 'assignment' : 'assignments'}.`)
    } finally {
      setBulkBusy(false)
    }
  }

  function guestsForTable(table: SeatingTable) {
    const idx = tables.indexOf(table) + 1
    return guests.filter(g => g.tableNumber === idx)
  }
  const unassignedGuests = guests.filter(g => !g.tableNumber || !tables[g.tableNumber - 1])
  const assignedCount = guests.filter(g => g.tableNumber && tables[g.tableNumber - 1]).length
  // Household sizes across the whole list, so a chip shows its household even when some
  // members are already seated.
  const partyHeadcounts = partyHeadcountById(guests)
  const unseatedAttending = countUnseatedAttending(guests, tables.length)

  // Search + attending filter only narrow the unassigned pool, the list you work from
  // when seating. Seated guests stay visible at their tables so the chart always shows
  // the full picture.
  const sq = seatingSearch.trim().toLowerCase()
  const matchesSearch = (g: Guest) =>
    !sq || g.name.toLowerCase().includes(sq) || (g.plusOneName ?? '').toLowerCase().includes(sq)
  const passesAttending = (g: Guest) => !attendingOnly || g.rsvpStatus === 'ATTENDING'
  const visibleUnassigned = unassignedGuests.filter(g => matchesSearch(g) && passesAttending(g))
  const groupedUnassigned = groupUnassignedByParty(visibleUnassigned)
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

  // Seating has a hard prerequisite: guests. Adding tables before there is anyone to
  // seat is a dead end, so when the guest list is empty we point the couple there first
  // instead of showing an empty board.
  if (guests.length === 0) {
    return (
      <div className="min-h-screen bg-ivory flex flex-col">
        <PageHeader title="Seating Chart" subtitle="Arrange your guests at reception tables" />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-md text-center">
            <div className="flex justify-center mb-4">
              <Users className="w-12 h-12 text-stone-300" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-medium text-stone-800 mb-2">No guests to seat yet</h3>
            <p className="text-stone-500 text-sm mb-6">
              Add your guest list first, then come back to arrange them at tables. Guests you
              group into a household can be seated together in one click.
            </p>
            <Link
              to="/dashboard/guests"
              className="inline-block px-5 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
            >
              Go to guest list
            </Link>
          </div>
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
            <Link
              to="/dashboard/seating/place-cards"
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 transition"
              title="Print cut-apart escort cards, one per guest with their table"
            >
              <IdCard size={14} />
              Print place cards
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
            {/* Bulk actions: one click to fill the tables, one click to undo it. */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={handleAutoSeat}
                disabled={bulkBusy}
                title="Fill your tables with whole households, largest first. Nobody already seated is moved."
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <WandSparkles size={14} aria-hidden="true" />
                {bulkBusy ? 'Working…' : 'Auto-seat by household'}
              </button>
              <button
                onClick={handleClearAllSeats}
                disabled={bulkBusy}
                title="Move every seated guest back to the unassigned pool"
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <Eraser size={14} aria-hidden="true" />
                Clear all seats
              </button>
            </div>
          </div>
        )}
        {tables.length > 0 && unseatedAttending > 0 && (
          <div
            role="status"
            className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
          >
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span>
              <strong className="font-semibold">
                {unseatedAttending} attending {unseatedAttending === 1 ? 'guest is' : 'guests are'} not seated yet.
              </strong>{' '}
              Seat them before you print the board.
            </span>
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

            {/* Unassigned pool, grouped by household */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-stone-500 mb-2">
                Unassigned ({visibleUnassigned.length}{filtersActive ? ` of ${unassignedGuests.length}` : ''})
              </p>
              {unassignedGuests.length === 0 ? (
                <p className="text-xs text-stone-400 italic">All guests are assigned.</p>
              ) : visibleUnassigned.length === 0 ? (
                <p className="text-xs text-stone-400 italic">No unseated guests match your search.</p>
              ) : (
                <div className="space-y-3">
                  {groupedUnassigned.parties.map(group => (
                    <div key={group.partyId} className="rounded-xl border border-amber-200 bg-amber-50/60 p-2 space-y-2">
                      <div className="flex items-center justify-between gap-2 px-1">
                        <p className="text-sm font-semibold text-amber-900 truncate">
                          {group.partyName}
                          <span className="font-normal text-amber-700"> · {group.headcount}</span>
                        </p>
                      </div>
                      <label htmlFor={`m-seat-all-${group.partyId}`} className="sr-only">
                        Seat the {group.partyName} household at a table
                      </label>
                      <select
                        id={`m-seat-all-${group.partyId}`}
                        value=""
                        onChange={e => { if (e.target.value) seatParty(group.guests, Number(e.target.value)) }}
                        className="w-full rounded-lg border border-amber-300 bg-white px-2.5 py-2 text-sm font-medium text-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      >
                        <option value="">Seat all {group.headcount} at...</option>
                        {tables.map((t, i) => (
                          <option key={t.id} value={i + 1}>{t.name}</option>
                        ))}
                      </select>
                      <div className="space-y-2">
                        {group.guests.map(g => (
                          <MobileGuestChip
                            key={g.id}
                            guest={g}
                            isSelected={selectedGuestId === g.id}
                            onTap={() => setSelectedGuestId(prev => prev === g.id ? null : g.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                  {groupedUnassigned.individuals.length > 0 && (
                    <div className="space-y-2">
                      {groupedUnassigned.parties.length > 0 && (
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 px-1">
                          Individuals
                        </p>
                      )}
                      {groupedUnassigned.individuals.map(g => (
                        <MobileGuestChip
                          key={g.id}
                          guest={g}
                          isSelected={selectedGuestId === g.id}
                          onTap={() => setSelectedGuestId(prev => prev === g.id ? null : g.id)}
                          partyName={g.partyName}
                          partyHeadcount={g.partyId ? partyHeadcounts.get(g.partyId) : undefined}
                        />
                      ))}
                    </div>
                  )}
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
                        {tableGuests.map(g => {
                          const flag = seatedNonAttendingFlag(g, true)
                          return (
                            <div key={g.id} className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5 min-w-0">
                                <RsvpStatusDot status={g.rsvpStatus} />
                                <span className="text-xs text-stone-600 truncate">{g.name}</span>
                                {flag && (
                                  <span className={`text-[10px] font-semibold uppercase tracking-wide flex-shrink-0 ${flag.tone === 'danger' ? 'text-rose-600' : 'text-stone-400'}`}>
                                    {flag.label}
                                  </span>
                                )}
                              </span>
                              <button
                                onClick={() => handleMobileUnassign(g.id)}
                                className="text-xs text-stone-400 hover:text-rose-500 flex-shrink-0"
                              >
                                Remove
                              </button>
                            </div>
                          )
                        })}
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
              Seat a whole household in one click with the picker at the top of its group.
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
                  groups={groupedUnassigned}
                  onSeatParty={seatParty}
                  partyHeadcounts={partyHeadcounts}
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
                    partyHeadcounts={partyHeadcounts}
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

      <AnimatePresence>
        {editingTable !== null && (
          <TableModal
            table={editingTable === 'new' ? null : editingTable}
            coupleId={coupleId}
            onClose={() => setEditingTable(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
