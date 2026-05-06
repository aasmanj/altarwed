import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/core/auth/AuthContext'
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

const MAX_TABLES = 20

function GuestChip({ guest, isDragging = false }: { guest: Guest; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: guest.id })
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0 : 1 }
    : undefined

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-stone-200 shadow-sm cursor-grab active:cursor-grabbing select-none text-sm text-stone-800"
    >
      <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
      {guest.name}
      {guest.plusOneName && (
        <span className="text-xs text-stone-400">+{guest.plusOneName}</span>
      )}
    </div>
  )
}

function TableColumn({
  tableNumber,
  label,
  guests,
}: {
  tableNumber: number | null
  label: string
  guests: Guest[]
}) {
  const id = tableNumber === null ? 'unassigned' : String(tableNumber)
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-48 rounded-xl border-2 transition-colors ${
        isOver ? 'border-amber-400 bg-amber-50' : 'border-stone-200 bg-stone-50'
      }`}
    >
      <div className="px-3 py-2 border-b border-stone-200 bg-white rounded-t-xl">
        <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide">{label}</p>
        <p className="text-xs text-stone-400">{guests.length} {guests.length === 1 ? 'guest' : 'guests'}</p>
      </div>
      <div className="p-2 space-y-2 min-h-[120px]">
        {guests.map(g => (
          <GuestChip key={g.id} guest={g} />
        ))}
      </div>
    </div>
  )
}

export default function SeatingPage() {
  const { user } = useAuth()
  const coupleId = user?.id ?? ''
  const { data: guests = [], isLoading } = useGuests(coupleId)
  const updateGuest = useUpdateGuest(coupleId)

  const [tableCount, setTableCount] = useState(() => {
    const max = Math.max(0, ...guests.map(g => g.tableNumber ?? 0))
    return Math.max(max, 1)
  })
  const [activeGuest, setActiveGuest] = useState<Guest | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function handleDragStart(event: DragStartEvent) {
    const guest = guests.find(g => g.id === event.active.id)
    setActiveGuest(guest ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveGuest(null)
    const { over, active } = event
    if (!over) return
    const guest = guests.find(g => g.id === active.id)
    if (!guest) return
    const newTable = over.id === 'unassigned' ? null : Number(over.id)
    if (guest.tableNumber === newTable) return
    updateGuest.mutate({ guestId: guest.id, payload: { tableNumber: newTable ?? undefined } })
  }

  const unassigned = guests.filter(g => !g.tableNumber)
  const tableNumbers = Array.from({ length: tableCount }, (_, i) => i + 1)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-amber-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="bg-white border-b border-stone-200 px-6 py-4">
        <div className="max-w-full mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="text-sm text-stone-400 hover:text-stone-700 transition">← Dashboard</Link>
            <h1 className="text-2xl font-semibold text-stone-900">Seating Chart</h1>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-stone-600">Tables:</label>
            <select
              value={tableCount}
              onChange={e => setTableCount(Number(e.target.value))}
              className="border border-stone-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500"
            >
              {Array.from({ length: MAX_TABLES }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="px-6 py-8">
        <p className="text-sm text-stone-500 mb-6">Drag guests between tables to assign seating. Changes save automatically.</p>

        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            <TableColumn
              tableNumber={null}
              label="Unassigned"
              guests={unassigned}
            />
            {tableNumbers.map(n => (
              <TableColumn
                key={n}
                tableNumber={n}
                label={`Table ${n}`}
                guests={guests.filter(g => g.tableNumber === n)}
              />
            ))}
          </div>

          <DragOverlay>
            {activeGuest && (
              <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border-2 border-amber-400 shadow-lg text-sm text-stone-800 cursor-grabbing">
                <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                {activeGuest.name}
              </div>
            )}
          </DragOverlay>
        </DndContext>

        <div className="mt-8 p-4 bg-white rounded-xl border border-stone-200 text-sm text-stone-600">
          <span className="font-medium text-stone-800">{guests.length - unassigned.length}</span> of{' '}
          <span className="font-medium text-stone-800">{guests.length}</span> guests assigned to tables.
        </div>
      </div>
    </div>
  )
}
