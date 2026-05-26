import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ImagePlus, Loader2 } from 'lucide-react'
import { apiClient } from '@/core/api/client'
import { useWeddingWebsite } from '../useWeddingWebsite'
import { useAuth } from '@/core/auth/AuthContext'
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

  const { user } = useAuth()
  const coupleId = user?.id ?? ''
  const { data: website } = useWeddingWebsite(coupleId)
  const websiteId = website?.id ?? ''

  return <FieldsFor type={block.type} content={parsed} onChange={updateField} websiteId={websiteId} onSaveNow={onSave} draft={draft} />
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
  websiteId,
  onSaveNow,
  draft,
}: {
  type: BlockType
  content: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
  websiteId: string
  onSaveNow: (json: string) => void
  draft: string
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
          <BlockImageUpload
            currentUrl={str('url')}
            websiteId={websiteId}
            onUploaded={url => onChange('url', url)}
          />
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

    case 'STORY_ENTRY':
      return (
        <>
          <Field label="Date or label (optional)">
            <input
              type="text"
              value={str('dateLabel')}
              onChange={e => onChange('dateLabel', e.target.value)}
              className={inputClass}
              placeholder="e.g. January 22, 2026 · The day we met"
            />
            <p className="text-xs text-stone-400 mt-1">Free text — write a date, a place, anything.</p>
          </Field>
          <Field label="Story text">
            <textarea
              value={str('body')}
              onChange={e => onChange('body', e.target.value)}
              rows={5}
              className={inputClass}
              placeholder="Tell the story of this moment…"
            />
          </Field>
          <Field label="Photo (optional)">
            <BlockImageUpload
              currentUrl={str('imageUrl')}
              websiteId={websiteId}
              onUploaded={url => {
                // Immediately flush the full draft with the new URL so the image
                // isn't lost if the user saves before the debounce fires.
                const current = safeParse(draft)
                onSaveNow(JSON.stringify({ ...current, imageUrl: url }))
              }}
            />
          </Field>
          {str('imageUrl') && (
            <Field label="Photo position">
              <div className="flex gap-2">
                {(['left', 'right'] as const).map(pos => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => onChange('imagePosition', pos)}
                    className={`flex-1 py-1.5 rounded border text-xs font-medium transition ${
                      str('imagePosition') === pos || (!str('imagePosition') && pos === 'right')
                        ? 'border-amber-500 bg-amber-50 text-amber-800'
                        : 'border-stone-300 text-stone-500 hover:border-stone-400'
                    }`}
                  >
                    {pos === 'left' ? '◀ Photo left' : 'Photo right ▶'}
                  </button>
                ))}
              </div>
            </Field>
          )}
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

    case 'DIVIDER':
      return <BlockHint>Visual separator between sections. Nothing to configure.</BlockHint>

    case 'VENUE_CARD':
      return (
        <BlockHint>
          Displays your ceremony venue, address, time, and dress code.
          Update these in the <EditorLink tab="details">Event Details tab</EditorLink>.
        </BlockHint>
      )

    case 'HOTEL_CARD':
      return (
        <BlockHint>
          Shows your hotel block(s) for out-of-town guests.
          Add or edit hotels in the <EditorLink tab="hotel">Travel tab</EditorLink>.
        </BlockHint>
      )

    case 'COUNTDOWN':
      return (
        <BlockHint>
          Counts down to your wedding date automatically.
          Update your date in <EditorLink tab="details">Event Details</EditorLink>.
        </BlockHint>
      )

    case 'RSVP_CTA':
      return (
        <>
          <Field label="Heading (optional)">
            <input
              type="text"
              value={str('heading') || ''}
              onChange={e => onChange('heading', e.target.value)}
              className={inputClass}
              placeholder="Join us as we say 'I do'"
            />
          </Field>
          <Field label="Button label (optional)">
            <input
              type="text"
              value={str('buttonLabel') || ''}
              onChange={e => onChange('buttonLabel', e.target.value)}
              className={inputClass}
              placeholder="RSVP Now"
            />
          </Field>
        </>
      )

    case 'PHOTO_ALBUM_GRID':
      return (
        <BlockHint>
          Displays all photos you've uploaded.
          Add more from the <EditorLink tab="photos">Photos dashboard</EditorLink>.
        </BlockHint>
      )

    case 'VOWS_PREVIEW':
      return (
        <BlockHint>
          Shows your written vows (visible to guests only after you publish).
          Write them in the <EditorLink tab="vows">Vows dashboard</EditorLink>.
        </BlockHint>
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

// Friendly contextual hint for blocks whose content is driven by other data sources.
function BlockHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-stone-500 leading-relaxed bg-stone-50 border border-stone-200 rounded-md px-3 py-2.5">
      {children}
    </p>
  )
}

// ── BlockImageUpload ─────────────────────────────────────────────────────────
// Upload-from-computer widget used by IMAGE and STORY_ENTRY blocks.
// Calls POST /api/v1/uploads/wedding-websites/{websiteId}/block-image and hands
// back the returned URL — caller writes it into contentJson via onChange.
function BlockImageUpload({
  currentUrl,
  websiteId,
  onUploaded,
}: {
  currentUrl: string
  websiteId: string
  onUploaded: (url: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // Shared upload logic so both the file picker and drag-and-drop go through
  // the same validation + endpoint. Uses the upload-immediately pattern: the
  // moment we have a File the POST fires; the caller's onUploaded writes the
  // returned URL into contentJson and the autosave fires from there.
  const uploadFile = async (file: File | undefined) => {
    if (!file || !websiteId) return
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError('Only JPEG, PNG, or WebP images are supported.')
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('Image must be under 15 MB.')
      return
    }
    setError(null)
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await apiClient.post<{ url: string }>(
        `/api/v1/uploads/wedding-websites/${websiteId}/block-image`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      onUploaded(res.data.url)
    } catch {
      setError('Upload failed. Try again.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => uploadFile(e.target.files?.[0])

  return (
    <div className="space-y-2">
      {currentUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={currentUrl} alt="Current" className="w-full max-h-36 object-cover rounded-lg border border-stone-200" />
      )}
      {/* Drop zone doubles as the click-to-upload button. The visual highlights
          on drag-enter so the user gets confirmation the drop will be accepted. */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
          if (!dragOver) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault()
          setDragOver(false)
          const file = e.dataTransfer.files?.[0]
          if (file) uploadFile(file)
        }}
        disabled={uploading || !websiteId}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-md border-2 border-dashed text-xs transition disabled:opacity-50 ${
          dragOver
            ? 'border-amber-500 bg-amber-50 text-amber-800'
            : 'border-stone-300 text-stone-500 hover:border-amber-400 hover:text-amber-700'
        }`}
      >
        {uploading
          ? <><Loader2 size={12} className="animate-spin" /> Uploading…</>
          : dragOver
          ? <><ImagePlus size={14} /> Drop to upload</>
          : <><ImagePlus size={12} /> {currentUrl ? 'Replace photo' : 'Drop a photo here, or click to choose'}</>
        }
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  )
}

// Link to a specific tab in the classic wedding website editor.
const TAB_PATHS: Record<string, string> = {
  details: '/dashboard/website',
  hotel:   '/dashboard/website',
  photos:  '/dashboard/photos',
  vows:    '/dashboard/vows',
}

function EditorLink({ tab, children }: { tab: string; children: React.ReactNode }) {
  const path = TAB_PATHS[tab] ?? '/dashboard/website'
  return (
    <Link to={path} className="text-amber-700 underline hover:text-amber-900">
      {children}
    </Link>
  )
}
