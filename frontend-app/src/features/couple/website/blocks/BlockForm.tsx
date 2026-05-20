import { useEffect, useRef, useState } from 'react'
import type { BlockType, WeddingPageBlock } from './types'

// Debounced autosave: every time `contentJson` changes locally, schedule a save
// 400ms later. New keystrokes reset the timer (classic debounce). On unmount
// (e.g. tab switch) the pending save is flushed so we never lose data.
interface Props {
  block: WeddingPageBlock
  onSave: (contentJson: string) => void
}

export default function BlockForm({ block, onSave }: Props) {
  const [draft, setDraft] = useState<string>(block.contentJson || '{}')
  const timerRef = useRef<number | null>(null)
  const pendingRef = useRef<string | null>(null)

  // If the upstream block changes from elsewhere (e.g. a server refetch), sync.
  useEffect(() => {
    setDraft(block.contentJson || '{}')
  }, [block.id, block.contentJson])

  const scheduleSave = (next: string) => {
    setDraft(next)
    pendingRef.current = next
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      if (pendingRef.current !== null) {
        onSave(pendingRef.current)
        pendingRef.current = null
      }
    }, 400)
  }

  // Flush on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      if (pendingRef.current !== null) {
        onSave(pendingRef.current)
        pendingRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const parsed = safeParse(draft)
  const updateField = (key: string, value: unknown) => {
    scheduleSave(JSON.stringify({ ...parsed, [key]: value }))
  }

  return <FieldsFor type={block.type} content={parsed} onChange={updateField} />
}

function safeParse(s: string): Record<string, unknown> {
  try {
    const v = JSON.parse(s)
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

function FieldsFor({
  type,
  content,
  onChange,
}: {
  type: BlockType
  content: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
}) {
  const str = (k: string) => (typeof content[k] === 'string' ? (content[k] as string) : '')
  const num = (k: string, fallback: number) =>
    typeof content[k] === 'number' ? (content[k] as number) : fallback

  switch (type) {
    case 'TEXT':
      return (
        <Field label="Paragraph">
          <textarea
            value={str('markdown')}
            onChange={e => onChange('markdown', e.target.value)}
            rows={5}
            className={inputClass}
            placeholder="Write a paragraph…"
          />
        </Field>
      )

    case 'HEADING':
      return (
        <>
          <Field label="Heading text">
            <input
              type="text"
              value={str('text')}
              onChange={e => onChange('text', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Size">
            <select
              value={num('level', 2)}
              onChange={e => onChange('level', Number(e.target.value))}
              className={inputClass}
            >
              <option value={1}>Large (H1)</option>
              <option value={2}>Medium (H2)</option>
              <option value={3}>Small (H3)</option>
            </select>
          </Field>
        </>
      )

    case 'IMAGE':
      return (
        <>
          <Field label="Image URL">
            <input
              type="url"
              value={str('url')}
              onChange={e => onChange('url', e.target.value)}
              className={inputClass}
              placeholder="https://…"
            />
          </Field>
          <Field label="Caption (optional)">
            <input
              type="text"
              value={str('caption')}
              onChange={e => onChange('caption', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Alt text (accessibility)">
            <input
              type="text"
              value={str('alt')}
              onChange={e => onChange('alt', e.target.value)}
              className={inputClass}
            />
          </Field>
        </>
      )

    case 'SCRIPTURE':
      return (
        <>
          <Field label="Reference (e.g. Colossians 3:14)">
            <input
              type="text"
              value={str('reference')}
              onChange={e => onChange('reference', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Verse text">
            <textarea
              value={str('text')}
              onChange={e => onChange('text', e.target.value)}
              rows={3}
              className={inputClass}
            />
          </Field>
          <Field label="Translation">
            <input
              type="text"
              value={str('translation') || 'ESV'}
              onChange={e => onChange('translation', e.target.value)}
              className={inputClass}
            />
          </Field>
        </>
      )

    case 'REGISTRY_CARD':
      return (
        <Field label="Which registry slot">
          <select
            value={num('slot', 1)}
            onChange={e => onChange('slot', Number(e.target.value))}
            className={inputClass}
          >
            <option value={1}>Slot 1</option>
            <option value={2}>Slot 2</option>
            <option value={3}>Slot 3</option>
          </select>
          <p className="text-xs text-stone-500 mt-1">
            Manage the registry URLs and labels on the Registry tab of the classic editor.
          </p>
        </Field>
      )

    case 'WEDDING_PARTY_GRID':
      return (
        <Field label="Side">
          <select
            value={str('side') || 'BRIDE'}
            onChange={e => onChange('side', e.target.value)}
            className={inputClass}
          >
            <option value="BRIDE">Bride's side</option>
            <option value="GROOM">Groom's side</option>
          </select>
        </Field>
      )

    // The remaining types have no editable payload — content is pulled from the
    // website's scalar fields (venue, hotel, photos, vows) at render time.
    case 'DIVIDER':
    case 'VENUE_CARD':
    case 'HOTEL_CARD':
    case 'COUNTDOWN':
    case 'RSVP_CTA':
    case 'PHOTO_ALBUM_GRID':
    case 'VOWS_PREVIEW':
      return (
        <p className="text-xs text-stone-500 italic">
          This block has no settings. Edit the related fields in the classic editor to change its content.
        </p>
      )
  }
}

const inputClass =
  'w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs font-medium text-stone-600 mb-1">{label}</span>
      {children}
    </label>
  )
}
