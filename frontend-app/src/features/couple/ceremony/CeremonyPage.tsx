import { useState } from 'react'
import { useAuth } from '@/core/auth/AuthContext'
import PageHeader from '@/components/PageHeader'
import {
  useCeremonySections,
  useCreateCeremonySection,
  useUpdateCeremonySection,
  useDeleteCeremonySection,
  CeremonySection,
  CeremonySectionPayload,
} from './useCeremonySections'

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

  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null)
  const [editTarget, setEditTarget] = useState<CeremonySection | null>(null)
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
    for (const s of DEFAULT_SECTIONS) {
      await createSection.mutateAsync(s)
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
    if (confirm('Remove this section from the order of service?')) {
      await deleteSection.mutateAsync(id)
    }
  }

  const typeLabel = (type: string) =>
    SECTION_TYPES.find(t => t.value === type)?.label ?? type

  return (
    <div className="min-h-screen bg-ivory">
      <PageHeader
        title="Ceremony Builder"
        subtitle="Plan your order of service — scripture, vows, music, and more."
        action={
          <button
            onClick={openAdd}
            className="rounded-lg bg-brown px-4 py-2 text-sm font-semibold text-white hover:bg-brown/90 transition"
          >
            + Add section
          </button>
        }
      />

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-6">

        {isLoading && (
          <p className="text-center text-sm text-brown-light py-12">Loading…</p>
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
            {sections.map((s, i) => (
              <div
                key={s.id}
                className="flex items-start gap-4 rounded-xl border border-gold-light bg-white px-5 py-4"
              >
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
                    className="rounded-lg border border-gold-light px-3 py-1.5 text-xs font-medium text-brown hover:border-gold hover:bg-gold/5 transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tips card */}
        <div className="rounded-xl bg-gold/5 border border-gold-light p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-brown-light mb-2">Faith-first tips</p>
          <ul className="space-y-1.5 text-xs text-brown-light">
            <li>• Open with prayer to invite God into your covenant moment.</li>
            <li>• Choose 1–2 scripture readings that speak to covenant love.</li>
            <li>• Unity ceremonies (candle, sand, communion) represent two becoming one.</li>
            <li>• Share a printed order of service so guests can follow along.</li>
          </ul>
        </div>
      </main>

      {/* Add / Edit modal */}
      {modalMode !== null && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-serif text-lg font-bold text-brown mb-5">
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

              <div>
                <label className="text-xs font-medium text-brown block mb-1">Order position</label>
                <input
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-gold-light px-3 py-2.5 text-sm text-brown focus:border-gold focus:outline-none"
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
          </div>
        </div>
      )}
    </div>
  )
}
