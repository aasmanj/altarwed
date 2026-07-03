import { useEffect, useRef, useState } from 'react'
import { X, ImagePlus, Loader2 } from 'lucide-react'
import { useUpdateWeddingWebsite, type WeddingWebsite } from '../useWeddingWebsite'
import { apiClient } from '@/core/api/client'
import { normalizeImageFile, isAllowedImageType, IMAGE_ACCEPT } from '@/lib/normalizeImageFile'
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, uploadErrorMessage } from '@/lib/upload'
import { useHotels, useAddHotel, useUpdateHotel, useDeleteHotel } from '../useHotels'
import { HotelTab } from '../HotelTab'
import WeddingPartyManager from '@/features/couple/weddingparty/WeddingPartyManager'
import type { WebsiteSection } from './blockEditContext'

// In-editor slide-over for editing the structured data behind a data-driven
// card block (venue/hotel/registry). The couple edits the underlying fields
// right here and the live preview refreshes on close.
interface Props {
  section: WebsiteSection
  website: WeddingWebsite
  coupleId: string
  onClose: () => void
}

const SECTION_TITLES: Record<WebsiteSection, string> = {
  details: 'Event details',
  travel: 'Hotels for guests',
  registry: 'Registry links',
  weddingParty: 'Wedding party',
}

// Common registries, offered as one-tap chips so the Label field is never a
// blank prompt. Mirrors the onboarding wizard's list.
const REGISTRY_SUGGESTIONS = ['Amazon', 'Target', 'Zola', 'Crate & Barrel', 'Honeyfund']

// Standard wedding dress codes, surfaced as datalist suggestions (couples can
// still type their own). The blog guide explains which fits which venue + time.
const DRESS_CODE_OPTIONS = [
  'Black tie',
  'Formal / Black tie optional',
  'Cocktail attire',
  'Semi-formal',
  'Dressy casual',
  'Beach formal',
  'Casual',
]

export default function WebsiteSectionDrawer({ section, website, coupleId, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  // onClose is an inline closure recreated on every parent render. Hold it in a
  // ref so the focus effect below can be mount-only (`[]`) without going stale;
  // otherwise the effect would tear down on each parent re-render and yank focus
  // out of whatever input the couple is typing in.
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  // Focus the panel on open; restore focus to the trigger on close. Escape and
  // backdrop click both close. Tab is trapped within the panel so focus never
  // leaks to the editor behind the modal (per the project Accessibility Rules).
  // Mount-only: the drawer is conditionally mounted per section, so a new
  // section is a fresh mount and this effect re-runs anyway.
  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key === 'Tab') trapFocus(e, panelRef.current)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previouslyFocused.current?.focus?.()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={SECTION_TITLES[section]}
        className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col outline-none"
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-gold-light flex-shrink-0">
          <h2 className="font-serif text-lg font-bold text-brown">{SECTION_TITLES[section]}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-brown-light hover:text-brown p-1 rounded hover:bg-ivory transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {section === 'details' && <DetailsSection website={website} coupleId={coupleId} onSaved={onClose} />}
          {section === 'registry' && <RegistrySection website={website} coupleId={coupleId} onSaved={onClose} />}
          {section === 'travel' && <TravelSection websiteId={website.id} />}
          {section === 'weddingParty' && <WeddingPartyManager websiteId={website.id} />}
        </div>
      </div>
    </div>
  )
}

// Keep Tab focus inside the drawer. Cycles from the last focusable element back
// to the first (and Shift+Tab the other way) so focus never lands on the editor
// behind the modal while aria-modal is true.
function trapFocus(e: KeyboardEvent, panel: HTMLElement | null) {
  if (!panel) return
  const focusable = panel.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
  )
  if (focusable.length === 0) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement
  if (e.shiftKey && (active === first || active === panel)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}

const inputCls =
  'w-full rounded-lg border border-gold-light px-3 py-2 text-brown text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold'

function LabeledField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-medium text-brown mb-1">{label}</span>
      {hint && <span className="block text-xs text-brown-light mb-1.5">{hint}</span>}
      {children}
    </label>
  )
}

// Injectable dependencies for the venue-photo upload flow. Kept as an interface
// so the flow can be unit-tested with no DOM (frontend-app's vitest runs in a
// node environment), mirroring runLogoUpload on the vendor side.
export interface VenuePhotoUploadDeps {
  // Convert HEIC/HEIF to JPEG (returns the file unchanged otherwise).
  normalize: (file: File) => Promise<File>
  // Post-normalization type gate that matches the backend jpeg/png/webp whitelist.
  isAllowedType: (file: File) => boolean
  // Actually upload one already-validated file; resolves to the stored photo URL.
  upload: (file: File) => Promise<string>
}

export type VenuePhotoUploadResult = { photoUrl: string } | { error: string }

// Run the full pick-to-upload flow for a single venue photo. Returns the stored
// URL on success or a user-facing error message. Never throws: a rejected file
// (over the size cap, wrong type) or a failed request is turned into an
// actionable message here instead of the pre-fix silent no-op (#184). Mirrors
// BlockImageUpload's validate -> upload -> uploadErrorMessage chain.
export async function runVenuePhotoUpload(
  picked: File,
  deps: VenuePhotoUploadDeps,
): Promise<VenuePhotoUploadResult> {
  try {
    // Convert HEIC (iPhone / Google Photos) to JPEG before validating.
    const file = await deps.normalize(picked)
    if (!deps.isAllowedType(file)) {
      return { error: 'Only JPEG, PNG, or WebP images are supported.' }
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return { error: `Image must be under ${MAX_UPLOAD_LABEL}.` }
    }
    const photoUrl = await deps.upload(file)
    return { photoUrl }
  } catch (err: unknown) {
    return { error: uploadErrorMessage(err, 'Upload failed. Try again.') }
  }
}

function DetailsSection({ website, coupleId, onSaved }: { website: WeddingWebsite; coupleId: string; onSaved: () => void }) {
  const update = useUpdateWeddingWebsite(coupleId)
  const [form, setForm] = useState({
    ceremonyTime: website.ceremonyTime ?? '',
    venueName: website.venueName ?? '',
    venueAddress: website.venueAddress ?? '',
    venueCity: website.venueCity ?? '',
    venueState: website.venueState ?? '',
    dressCode: website.dressCode ?? '',
    weddingDate: website.weddingDate ?? '',
    engagementDate: website.engagementDate ?? '',
    rsvpDeadline: website.rsvpDeadline ?? '',
    venueAdditionalInfo: website.venueAdditionalInfo ?? '',
  })
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const [venuePhotoUrl, setVenuePhotoUrl] = useState<string | null>(website.venuePhotoUrl ?? null)
  const [venueUploading, setVenueUploading] = useState(false)
  const [venueError, setVenueError] = useState<string | null>(null)
  const venuePhotoRef = useRef<HTMLInputElement>(null)

  const handleVenuePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    if (!picked) return
    setVenueError(null)
    setVenueUploading(true)
    const result = await runVenuePhotoUpload(picked, {
      normalize: normalizeImageFile,
      isAllowedType: isAllowedImageType,
      upload: async (file) => {
        const fd = new FormData()
        fd.append('file', file)
        const res = await apiClient.post<{ photoUrl: string }>(
          `/api/v1/uploads/wedding-websites/${website.id}/venue-photo`, fd,
          { headers: { 'Content-Type': 'multipart/form-data' } },
        )
        return res.data.photoUrl
      },
    })
    if ('photoUrl' in result) {
      setVenuePhotoUrl(result.photoUrl)
    } else {
      setVenueError(result.error)
    }
    setVenueUploading(false)
    if (venuePhotoRef.current) venuePhotoRef.current.value = ''
  }

  const save = async () => {
    await update.mutateAsync({
      ...form,
      weddingDate: form.weddingDate || null,
      engagementDate: form.engagementDate || null,
      rsvpDeadline: form.rsvpDeadline || null,
      venueAdditionalInfo: form.venueAdditionalInfo || null,
    } as Parameters<typeof update.mutateAsync>[0])
    onSaved()
  }

  return (
    <>
      <LabeledField label="Ceremony time" hint='e.g. "3:00 PM"'>
        <input value={form.ceremonyTime} onChange={set('ceremonyTime')} className={inputCls} />
      </LabeledField>
      <LabeledField label="Venue name">
        <input value={form.venueName} onChange={set('venueName')} className={inputCls} />
      </LabeledField>
      <LabeledField label="Street address">
        <input value={form.venueAddress} onChange={set('venueAddress')} className={inputCls} />
      </LabeledField>
      <div className="grid grid-cols-2 gap-3">
        <LabeledField label="City">
          <input value={form.venueCity} onChange={set('venueCity')} className={inputCls} />
        </LabeledField>
        <LabeledField label="State">
          <input value={form.venueState} onChange={set('venueState')} className={inputCls} />
        </LabeledField>
      </div>
      <LabeledField label="Dress code" hint="Type your own or pick a standard one. Not sure? Use the guide below.">
        <input
          value={form.dressCode}
          onChange={set('dressCode')}
          className={inputCls}
          list="dresscode-options"
          placeholder="e.g. Cocktail attire"
        />
        <datalist id="dresscode-options">
          {DRESS_CODE_OPTIONS.map(o => <option key={o} value={o} />)}
        </datalist>
        <a
          href="https://www.altarwed.com/blog/wedding-dress-code-guide"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-xs text-gold hover:underline"
        >
          Not sure what to pick? Read our dress code guide by venue and time of day →
        </a>
      </LabeledField>
      <LabeledField label="Wedding date">
        <input type="date" value={form.weddingDate} onChange={set('weddingDate')} className={inputCls} />
        {form.weddingDate && form.weddingDate < new Date().toISOString().slice(0, 10) && (
          <p className="mt-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            This date has already passed. If you're documenting a past ceremony, that's fine!
          </p>
        )}
      </LabeledField>
      <LabeledField label="Engagement date" hint="Used to tailor your planning checklist timeline.">
        <input type="date" value={form.engagementDate} onChange={set('engagementDate')} className={inputCls} />
      </LabeledField>
      <LabeledField label="RSVP deadline">
        <input type="date" value={form.rsvpDeadline} onChange={set('rsvpDeadline')} className={inputCls} />
      </LabeledField>

      <LabeledField label="Venue photo" hint="Optional. Shows above the venue details on your wedding site.">
        <input
          ref={venuePhotoRef}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
          onChange={handleVenuePhotoChange}
        />
        {venuePhotoUrl && (
          <img
            src={venuePhotoUrl}
            alt="Venue"
            className="w-full rounded-lg border border-gold-light object-cover mb-2 max-h-40"
          />
        )}
        <button
          type="button"
          onClick={() => venuePhotoRef.current?.click()}
          disabled={venueUploading}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-gold-light px-4 py-2.5 text-sm text-brown-light hover:border-gold hover:text-brown transition disabled:opacity-50"
        >
          {venueUploading
            ? <><Loader2 size={14} className="animate-spin" /> Uploading…</>
            : <><ImagePlus size={14} /> {venuePhotoUrl ? 'Replace photo' : 'Upload venue photo'}</>
          }
        </button>
        {venueError && <p className="mt-1.5 text-xs text-red-500" role="alert">{venueError}</p>}
      </LabeledField>

      <LabeledField label="Additional details" hint="Parking info, directions, accessibility notes, etc.">
        <textarea
          value={form.venueAdditionalInfo}
          onChange={set('venueAdditionalInfo')}
          rows={4}
          className={inputCls}
        />
      </LabeledField>

      <SaveButton onClick={save} pending={update.isPending} />
    </>
  )
}

function RegistrySection({ website, coupleId, onSaved }: { website: WeddingWebsite; coupleId: string; onSaved: () => void }) {
  const update = useUpdateWeddingWebsite(coupleId)
  const [form, setForm] = useState({
    registryLabel1: website.registryLabel1 ?? '',
    registryUrl1: website.registryUrl1 ?? '',
    registryLabel2: website.registryLabel2 ?? '',
    registryUrl2: website.registryUrl2 ?? '',
    registryLabel3: website.registryLabel3 ?? '',
    registryUrl3: website.registryUrl3 ?? '',
  })
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))
  const pick = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const save = async () => {
    await update.mutateAsync(form as Parameters<typeof update.mutateAsync>[0])
    onSaved()
  }

  return (
    <>
      <p className="text-sm text-brown-light mb-4">
        Add the registries you'd like guests to see. Most couples link one or two
        (Amazon, Target, Zola).
      </p>
      {([1, 2, 3] as const).map(n => {
        const labelKey = `registryLabel${n}` as const
        return (
        <div key={n} className="rounded-xl border border-gold-light p-4 mb-3 space-y-3">
          <p className="text-xs font-medium text-brown">Registry {n}</p>
          <LabeledField label="Label" hint='e.g. "Amazon"'>
            <input value={form[labelKey]} onChange={set(labelKey)} className={inputCls} />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {REGISTRY_SUGGESTIONS.map(name => (
                <button
                  key={name}
                  type="button"
                  onClick={() => pick(labelKey, name)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition ${
                    form[labelKey] === name
                      ? 'border-gold bg-gold text-brown'
                      : 'border-gold-light text-brown-light hover:border-gold hover:text-brown'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </LabeledField>
          <LabeledField label="Link">
            <input type="url" value={form[`registryUrl${n}`]} onChange={set(`registryUrl${n}`)} className={inputCls} placeholder="https://" />
          </LabeledField>
        </div>
        )
      })}
      <SaveButton onClick={save} pending={update.isPending} />
    </>
  )
}

function TravelSection({ websiteId }: { websiteId: string }) {
  const { data: hotels = [], isLoading: hotelsLoading } = useHotels(websiteId)
  const addHotel = useAddHotel(websiteId)
  const updateHotel = useUpdateHotel(websiteId)
  const deleteHotel = useDeleteHotel(websiteId)

  // HotelTab manages its own add/edit state and saves immediately via the
  // mutations below, so there is no separate Save button for this section.
  return (
    <HotelTab
      hotels={hotels}
      isLoading={hotelsLoading}
      onAdd={(p) => addHotel.mutate(p)}
      onUpdate={(id, p) => updateHotel.mutate({ hotelId: id, payload: p })}
      onDelete={(id) => deleteHotel.mutate(id)}
      isAddPending={addHotel.isPending}
      isUpdatePending={updateHotel.isPending}
      isDeletePending={deleteHotel.isPending}
    />
  )
}

function SaveButton({ onClick, pending }: { onClick: () => void; pending: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className="w-full rounded-lg bg-gold px-6 py-2.5 font-semibold text-brown hover:bg-gold-dark disabled:opacity-60 transition mt-2"
    >
      {pending ? 'Saving…' : 'Save and close'}
    </button>
  )
}
