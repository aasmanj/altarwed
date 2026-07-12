import { useState, type ReactNode, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { GripVertical } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, sortableKeyboardCoordinates, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAuth } from '@/core/auth/AuthContext'
import PageHeader from '@/components/PageHeader'
import { useConfirm } from '@/components/ConfirmDialog'
import { AnimatedModal } from '@/components/AnimatedModal'
import {
  useCeremonySections,
  useCreateCeremonySection,
  useUpdateCeremonySection,
  useDeleteCeremonySection,
  useReorderCeremonySections,
  CeremonySection,
  CeremonySectionPayload,
} from './useCeremonySections'
import { orderedSections } from './ceremonyReorder'

const SECTION_TYPES = [
  { value: 'PROCESSIONAL', label: 'Processional' },
  { value: 'OPENING', label: 'Opening / Welcome' },
  { value: 'PRAYER', label: 'Prayer' },
  { value: 'SCRIPTURE_READING', label: 'Scripture Reading' },
  { value: 'MESSAGE', label: 'Message / Homily' },
  { value: 'VOWS', label: 'Vows' },
  { value: 'RING_EXCHANGE', label: 'Ring Exchange' },
  { value: 'UNITY_CEREMONY', label: 'Unity Ceremony' },
  { value: 'MUSIC', label: 'Music / Special Song' },
  { value: 'PRONOUNCEMENT', label: 'Pronouncement & Kiss' },
  { value: 'RECESSIONAL', label: 'Recessional' },
  { value: 'CUSTOM', label: 'Custom' },
]

const DEFAULT_SECTIONS: CeremonySectionPayload[] = [
  { title: 'Processional', sectionType: 'PROCESSIONAL', content: '', sortOrder: 0 },
  { title: 'Opening & Welcome', sectionType: 'OPENING', content: '', sortOrder: 1 },
  { title: 'Opening Prayer', sectionType: 'PRAYER', content: '', sortOrder: 2 },
  { title: 'Scripture Reading', sectionType: 'SCRIPTURE_READING', content: '', sortOrder: 3 },
  { title: 'Message', sectionType: 'MESSAGE', content: '', sortOrder: 4 },
  { title: 'Vows', sectionType: 'VOWS', content: '', sortOrder: 5 },
  { title: 'Ring Exchange', sectionType: 'RING_EXCHANGE', content: '', sortOrder: 6 },
  { title: 'Pronouncement & Kiss', sectionType: 'PRONOUNCEMENT', content: '', sortOrder: 7 },
  { title: 'Recessional', sectionType: 'RECESSIONAL', content: '', sortOrder: 8 },
]

export default function CeremonyPage() {
  const { user } = useAuth()
  const coupleId = user?.id ?? ''
  const { data: sections = [], isLoading } = useCeremonySections(coupleId)
  const createSection = useCreateCeremonySection(coupleId)
  const updateSection = useUpdateCeremonySection(coupleId)
  const deleteSection = useDeleteCeremonySection(coupleId)
  const reorderSectionsMutation = useReorderCeremonySections(coupleId)
  const confirm = useConfirm()

  // Mouse needs an 8px drag before it counts (so the Edit/Remove buttons still click);
  // touch waits 250ms (so scrolling the list does not start a drag); keyboard sensor
  // makes reordering operable without a pointer (a11y).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Single source of truth for display order (drag list + numbering + persistence).
  const ordered = orderedSections(sections)

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = ordered.map(s => s.id)
    const orderedIds = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
    reorderSectionsMutation.mutate({ snapshot: ordered, orderedIds })
  }

  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null)
  const [editTarget, setEditTarget] = useState<CeremonySection | null>(null)
  const [seedError, setSeedError] = useState<string | null>(null)
  const [form, setForm] = useState<CeremonySectionPayload>({
    title: '', sectionType: 'CUSTOM', content: '', sortOrder: 0,
  })

  const openAdd = () => {
    setForm({ title: '', sectionType: 'CUSTOM', content: '', sortOrder: sections.length })
    setEditTarget(null)
    setModalMode('add')
  }

  const openEdit = (s: CeremonySection) => {
    setForm({ title: s.title, sectionType: s.sectionType, content: s.content ?? '', sortOrder: s.sortOrder })
    setEditTarget(s)
    setModalMode('edit')
  }

  const handleSeed = async () => {
    setSeedError(null)
    let created = 0
    try {
      for (const s of DEFAULT_SECTIONS) {
        await createSection.mutateAsync(s)
        created++
      }
    } catch {
      // A mid-loop failure (flaky network, transient 5xx) used to reject unhandled and leave a
      // partial order of service with no message, and because the template card only renders when
      // there are zero sections, it vanished, stranding the couple. Now: keep whatever was created,
      // tell them exactly what happened, and let them finish manually or retry.
      setSeedError(
        created === 0
          ? "We couldn't load the ceremony template. Please check your connection and try again."
          : `We added the first ${created} of ${DEFAULT_SECTIONS.length} sections before hitting a snag. Add the rest with "+ Add section", or edit what's there.`
      )
    }
  }

  const handleSubmit = async () => {
    if (modalMode === 'add') {
      await createSection.mutateAsync(form)
    } else if (modalMode === 'edit' && editTarget) {
      await updateSection.mutateAsync({ id: editTarget.id, payload: form })
    }
    setModalMode(null)
  }

  const handleDelete = async (id: string) => {
    if (await confirm({
      title: 'Remove this section?',
      message: 'It will be removed from your order of service.',
      tone: 'danger',
      confirmLabel: 'Remove',
    })) {
      await deleteSection.mutateAsync(id)
    }
  }

  const typeLabel = (type: string) =>
    SECTION_TYPES.find(t => t.value === type)?.label ?? type

  return (
    <div className="min-h-screen bg-ivory">
      <PageHeader
        title="Ceremony Builder"
        subtitle="Plan your order of service: scripture, vows, music, and more."
        maxWidth="max-w-3xl"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {sections.length > 0 && (
              <Link
                to="/dashboard/ceremony/program"
                className="rounded-lg border border-brown px-4 py-2 text-sm font-semibold text-brown hover:bg-brown/5 transition"
              >
                Print Program
              </Link>
            )}
            <button
              onClick={openAdd}
              className="rounded-lg bg-brown px-4 py-2 text-sm font-semibold text-white hover:bg-brown/90 transition"
            >
              + Add section
            </button>
          </div>
        }
      />

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-6">

        {isLoading && (
          <p className="text-center text-sm text-brown-light py-12">Loading…</p>
        )}

        {seedError && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {seedError}
          </div>
        )}

        {!isLoading && sections.length === 0 && (
          <div className="rounded-xl border border-gold-light bg-white p-8 text-center">
            <p className="font-serif text-lg font-semibold text-brown mb-2">Start with a template</p>
            <p className="text-sm text-brown-light mb-5">
              Load a classic Christian ceremony order or build your own from scratch.
            </p>
            <button
              onClick={handleSeed}
              disabled={createSection.isPending}
              className="rounded-lg bg-brown px-5 py-2.5 text-sm font-semibold text-white hover:bg-brown/90 disabled:opacity-60 transition mr-3"
            >
              {createSection.isPending ? 'Creating…' : 'Use classic order'}
            </button>
            <button
              onClick={openAdd}
              className="rounded-lg border border-brown px-5 py-2.5 text-sm font-semibold text-brown hover:bg-brown/5 transition"
            >
              Build from scratch
            </button>
          </div>
        )}

        {!isLoading && sections.length > 0 && (
          <div className="space-y-3">
            {ordered.length > 1 && (
              <p className="text-xs text-brown-light -mt-1 mb-1">Drag a section to reorder your order of service.</p>
            )}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={ordered.map(s => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {ordered.map((s, i) => (
                    <SortableSection key={s.id} id={s.id}>
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/10 text-xs font-bold text-gold">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-brown text-sm">{s.title}</p>
                        <p className="text-xs text-brown-light mt-0.5">{typeLabel(s.sectionType)}</p>
                        {s.content && (
                          <p className="text-xs text-brown-light mt-1.5 leading-relaxed line-clamp-2 font-serif">{s.content}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => openEdit(s)}
                          className="rounded-lg border border-gold-light px-3 py-2 text-xs font-medium text-brown hover:border-gold hover:bg-gold/5 transition min-h-[44px]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50 transition min-h-[44px]"
                        >
                          Remove
                        </button>
                      </div>
                    </SortableSection>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}

        {/* Tips card */}
        <div className="rounded-xl bg-gold/5 border border-gold-light p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-brown-light mb-2">Faith-first tips</p>
          <ul className="space-y-1.5 text-xs text-brown-light">
            <li>• Open with prayer to invite God into your covenant moment.</li>
            <li>• Choose 1–2 scripture readings that speak to covenant love.</li>
            <li>• Unity ceremonies (candle, sand, communion) represent two becoming one.</li>
            <li>
              • Add your officiant, musicians, and readers on the{' '}
              <Link to="/dashboard/wedding-party" className="underline hover:text-brown">Wedding Party</Link>{' '}
              page (set side to "Ceremony"). They'll appear on your printed program.
            </li>
            <li>
              • When you're ready, hit <span className="font-medium text-brown">Print Program</span>{' '}
              up top, generates a letter-sized order of service guests can hold during the ceremony.
            </li>
          </ul>
        </div>
      </main>

      {/* Add / Edit modal */}
      <AnimatePresence>
        {modalMode !== null && (
          <AnimatedModal
            onClose={() => setModalMode(null)}
            containerClassName="items-end sm:items-center justify-center px-4"
            ariaLabelledBy="ceremony-modal-title"
            panelClassName="w-full max-w-lg rounded-2xl bg-white p-6 max-h-[90vh] overflow-y-auto"
          >
            <h3 id="ceremony-modal-title" className="font-serif text-lg font-bold text-brown mb-5">
              {modalMode === 'add' ? 'Add section' : 'Edit section'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-brown block mb-1">Section type</label>
                <select
                  value={form.sectionType}
                  onChange={e => {
                    const label = SECTION_TYPES.find(t => t.value === e.target.value)?.label ?? ''
                    setForm(f => ({ ...f, sectionType: e.target.value, title: f.title || label }))
                  }}
                  className="w-full rounded-xl border border-gold-light px-3 py-2.5 text-sm text-brown focus:border-gold focus:outline-none"
                >
                  {SECTION_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-brown block mb-1">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  maxLength={200}
                  placeholder="e.g. Opening Prayer"
                  className="w-full rounded-xl border border-gold-light px-3 py-2.5 text-sm text-brown focus:border-gold focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-brown block mb-1">
                  Notes / content <span className="text-brown-light font-normal">(optional)</span>
                </label>
                <textarea
                  value={form.content ?? ''}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  rows={4}
                  placeholder="Scripture reference, song title, speaker name, notes…"
                  className="w-full rounded-xl border border-gold-light px-3 py-2.5 text-sm text-brown placeholder-brown-light/60 focus:border-gold focus:outline-none resize-none leading-relaxed"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSubmit}
                disabled={!form.title || createSection.isPending || updateSection.isPending}
                className="flex-1 rounded-xl bg-brown py-2.5 text-sm font-semibold text-white hover:bg-brown/90 disabled:opacity-60 transition"
              >
                {createSection.isPending || updateSection.isPending ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setModalMode(null)}
                className="flex-1 rounded-xl border border-gold-light py-2.5 text-sm font-medium text-brown hover:bg-ivory transition"
              >
                Cancel
              </button>
            </div>
          </AnimatedModal>
        )}
      </AnimatePresence>
    </div>
  )
}

// One order-of-service row, made sortable. The grip handle (left) carries the dnd
// listeners so the row's own Edit/Remove buttons keep working; touch-none on the
// handle stops the browser from scrolling mid-drag.
function SortableSection({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
    opacity: isDragging ? 0.6 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-3 rounded-xl border border-gold-light bg-white px-4 py-4 sm:px-5"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder section"
        className="mt-0.5 shrink-0 rounded-md p-1 text-brown-light hover:text-brown cursor-grab active:cursor-grabbing touch-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
      >
        <GripVertical className="h-5 w-5" />
      </button>
      {children}
    </div>
  )
}
