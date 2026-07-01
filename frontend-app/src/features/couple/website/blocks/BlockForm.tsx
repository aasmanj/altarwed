import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ImagePlus, Loader2, RotateCcw, Pencil } from 'lucide-react'
import { apiClient } from '@/core/api/client'
import { useWeddingWebsite } from '../useWeddingWebsite'
import { useAuth } from '@/core/auth/AuthContext'
import { useConfirm } from '@/components/ConfirmDialog'
import { defaultContentJson, type BlockType, type WeddingPageBlock } from './types'
import { useOpenWebsiteSection, type WebsiteSection } from './blockEditContext'
import { normalizeImageFile, isAllowedImageType, IMAGE_ACCEPT } from '@/lib/normalizeImageFile'
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, uploadErrorMessage } from '@/lib/upload'

// Debounced autosave: every time `contentJson` changes locally, schedule a save
// 150ms later. New keystrokes reset the timer (classic debounce). On unmount
// (e.g. tab switch) the pending save is flushed so we never lose data.
// The 150ms cadence is tuned for the live-preview pipeline: the optimistic
// React Query cache update in onMutate fires the postMessage that drives the
// iframe, so the lower the debounce, the snappier the preview feels. We don't
// go below ~100ms because each save = one backend PATCH + one DB write.
const AUTOSAVE_DEBOUNCE_MS = 150
interface Props {
  block: WeddingPageBlock
  onSave: (contentJson: string) => void
}

export default function BlockForm({ block, onSave }: Props) {
  const confirm = useConfirm()
  const [draft, setDraft] = useState<string>(block.contentJson || '{}')
  const timerRef = useRef<number | null>(null)
  const pendingRef = useRef<string | null>(null)

  // Sync draft when the user navigates to a different block. We deliberately
  // omit block.contentJson from the deps: the mutation's optimistic update +
  // onSettled refetch cycle changes contentJson mid-keystroke, which resets
  // the controlled input and moves the cursor backward. Switching blocks
  // (block.id changes) is the only case that should reset the draft.
  useEffect(() => {
    setDraft(block.contentJson || '{}')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.id])

  const scheduleSave = (next: string) => {
    setDraft(next)
    pendingRef.current = next
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      if (pendingRef.current !== null) {
        onSave(pendingRef.current)
        pendingRef.current = null
      }
    }, AUTOSAVE_DEBOUNCE_MS)
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

  // Reset to type's default contentJson. Useful when a couple has experimented
  // with custom text and wants to start over with the standard placeholder
  // (e.g. "New heading"). Confirms first because typing in a long story is
  // easy to wipe by accident.
  const resetToDefault = async () => {
    const fresh = defaultContentJson(block.type)
    if (draft === fresh) return
    if (!await confirm({
      title: 'Reset this block?',
      message: 'It will return to its default content and your current edits will be lost.',
      tone: 'danger',
      confirmLabel: 'Reset',
    })) return
    if (timerRef.current) window.clearTimeout(timerRef.current)
    pendingRef.current = null
    setDraft(fresh)
    onSave(fresh)
  }

  return (
    <div>
      <FieldsFor type={block.type} content={parsed} onChange={updateField} websiteId={websiteId} onSaveNow={onSave} draft={draft} />
      <div className="mt-1 flex items-center justify-end">
        <button
          type="button"
          onClick={resetToDefault}
          className="text-[10px] text-stone-400 hover:text-amber-700 inline-flex items-center gap-1 transition"
          title="Reset this block to its default contents"
        >
          <RotateCcw size={10} /> Reset to default
        </button>
      </div>
    </div>
  )
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
          <Field label="Label (optional)">
            <input
              type="text"
              value={str('dateLabel')}
              onChange={e => onChange('dateLabel', e.target.value)}
              className={inputClass}
            />
            <p className="text-xs text-stone-400 mt-1">Can be a date, a place, or a label like "The Proposal" or "When We Met".</p>
          </Field>
          <Field label="Story text">
            <textarea
              value={str('body')}
              onChange={e => onChange('body', e.target.value)}
              rows={5}
              className={inputClass}
            />
            <p className="text-xs text-stone-400 mt-1">Tell guests about this moment.</p>
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
            <select
              value={str('translation') || 'ESV'}
              onChange={e => onChange('translation', e.target.value)}
              className={inputClass}
            >
              {['NIV', 'NIV84', 'ESV', 'KJV', 'NKJV', 'NLT', 'CSB', 'NASB', 'HCSB', 'MSG'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
        </>
      )

    case 'REGISTRY_CARD':
      return (
        <>
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
          </Field>
          <SectionEditButton section="registry" fallbackTab="registry">Manage registry links</SectionEditButton>
        </>
      )

    case 'WEDDING_PARTY_GRID':
      return (
        <>
          <BlockHint>
            Shows your wedding party for the chosen side. Add or reorder members
            right here, no need to leave the editor.
          </BlockHint>
          <div className="mt-3">
            <Field label="Which side to show">
              <select
                value={str('side') || 'BRIDE'}
                onChange={e => onChange('side', e.target.value)}
                className={inputClass}
              >
                <option value="BRIDE">Bride&apos;s side</option>
                <option value="GROOM">Groom&apos;s side</option>
              </select>
            </Field>
          </div>
          <SectionEditButton section="weddingParty" fallbackTab="weddingparty">Add or edit members</SectionEditButton>
        </>
      )

    case 'DIVIDER':
      return <BlockHint>Visual separator between sections. Nothing to configure.</BlockHint>

    case 'VENUE_CARD':
      return (
        <>
          <BlockHint>
            Displays your ceremony venue, address, time, and dress code.
          </BlockHint>
          <SectionEditButton section="details" fallbackTab="details">Edit venue details</SectionEditButton>
        </>
      )

    case 'HOTEL_CARD':
      return (
        <>
          <BlockHint>
            Shows your hotel block(s) for out-of-town guests.
          </BlockHint>
          <SectionEditButton section="travel" fallbackTab="hotel">Add or edit hotels</SectionEditButton>
        </>
      )

    case 'COUNTDOWN':
      return (
        <>
          <BlockHint>
            Counts down to your wedding date automatically.
          </BlockHint>
          <SectionEditButton section="details" fallbackTab="details">Edit wedding date</SectionEditButton>
        </>
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
// back the returned URL: caller writes it into contentJson via onChange.
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
  const uploadFile = async (picked: File | undefined) => {
    if (!picked || !websiteId) return
    // Convert HEIC (iPhone / Google Photos) to JPEG before validating.
    const file = await normalizeImageFile(picked)
    if (!isAllowedImageType(file)) {
      setError('Only JPEG, PNG, or WebP images are supported.')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`Image must be under ${MAX_UPLOAD_LABEL}.`)
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
    } catch (err: unknown) {
      setError(uploadErrorMessage(err, 'Upload failed. Try again.'))
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => uploadFile(e.target.files?.[0])

  return (
    <div className="space-y-2">
      {currentUrl && (
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
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={handleFile}
      />
    </div>
  )
}

// Link to a specific tab in the classic wedding website editor. The classic
// editor (WeddingWebsiteEditor) reads ?tab=<id> on mount, so we MUST carry the
// query string here, otherwise the link silently lands on the default "Our
// Story" tab and the couple never finds the Event Details fields.
const TAB_PATHS: Record<string, string> = {
  details:      '/dashboard/website?tab=details',
  hotel:        '/dashboard/website?tab=hotel',
  photos:       '/dashboard/photos',
  vows:         '/dashboard/vows',
  weddingparty: '/dashboard/wedding-party',
}

function EditorLink({ tab, children }: { tab: string; children: React.ReactNode }) {
  const path = TAB_PATHS[tab] ?? '/dashboard/website'
  return (
    <Link to={path} className="text-amber-700 underline hover:text-amber-900">
      {children}
    </Link>
  )
}

// Opens the in-editor drawer to edit the structured data behind a card block,
// keeping the couple inside the page builder. Falls back to navigating to the
// classic editor tab if there's no drawer provider in the tree (defensive: the
// drawer is only mounted by SideBySideEditor, BlockForm's only real consumer).
function SectionEditButton({
  section, fallbackTab, children,
}: {
  section: WebsiteSection
  fallbackTab: string
  children: React.ReactNode
}) {
  const openSection = useOpenWebsiteSection()
  if (!openSection) {
    return (
      <div className="mt-2">
        <EditorLink tab={fallbackTab}>{children}</EditorLink>
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={() => openSection(section)}
      className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 transition"
    >
      <Pencil size={12} aria-hidden="true" /> {children}
    </button>
  )
}
