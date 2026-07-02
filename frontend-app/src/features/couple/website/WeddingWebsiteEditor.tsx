import { useEffect, useRef, useState, useId, createContext, useContext } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import confetti from 'canvas-confetti'
import { useUpdateWeddingWebsite, usePublishWeddingWebsite, type WeddingWebsite } from './useWeddingWebsite'
import { useHotels, useAddHotel, useUpdateHotel, useDeleteHotel, type WeddingHotelPayload, type WeddingHotel } from './useHotels'
import { MapPin, DollarSign, X, Loader2, ExternalLink, Check } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { useConfirm } from '@/components/ConfirmDialog'
import { useModalA11y } from '@/lib/useModalA11y'
import { apiClient } from '@/core/api/client'
import ShareModal from './ShareModal'
import DraftBanner from './DraftBanner'

interface Props {
  website: WeddingWebsite
  coupleId: string
}

export default function WeddingWebsiteEditor({ website, coupleId }: Props) {
  const update = useUpdateWeddingWebsite(coupleId)
  const publish = usePublishWeddingWebsite(coupleId)
  const { data: hotels = [], isLoading: hotelsLoading } = useHotels(website.id)
  const addHotel    = useAddHotel(website.id)
  const updateHotel = useUpdateHotel(website.id)
  const deleteHotel = useDeleteHotel(website.id)

  const confirm = useConfirm()
  const [searchParams] = useSearchParams()
  const [saved, setSaved] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  // Honour ?tab=registry (or any valid tab name) so external links can deep-link
  // to a specific section (e.g. the Registry dashboard tile). Unknown values fall
  // back to 'story' so a typo in the URL doesn't break the editor.
  const tabParam = searchParams.get('tab')
  const validTabs: Tab[] = ['story', 'scripture', 'details', 'hotel', 'registry']
  const [activeTab, setActiveTab] = useState<Tab>(
    validTabs.includes(tabParam as Tab) ? (tabParam as Tab) : 'story'
  )

  // Local form state, mirror of the website fields
  const [form, setForm] = useState({
    partnerOneName:    website.partnerOneName,
    partnerTwoName:    website.partnerTwoName,
    weddingDate:       website.weddingDate ?? '',
    ourStory:          website.ourStory ?? '',
    scriptureReference:website.scriptureReference ?? '',
    scriptureText:     website.scriptureText ?? '',
    venueName:         website.venueName ?? '',
    venueAddress:      website.venueAddress ?? '',
    venueCity:         website.venueCity ?? '',
    venueState:        website.venueState ?? '',
    ceremonyTime:      website.ceremonyTime ?? '',
    dressCode:         website.dressCode ?? '',
    hotelName:         website.hotelName ?? '',
    hotelUrl:          website.hotelUrl ?? '',
    hotelDetails:      website.hotelDetails ?? '',
    registryUrl1:      website.registryUrl1 ?? '',
    registryLabel1:    website.registryLabel1 ?? '',
    registryUrl2:      website.registryUrl2 ?? '',
    registryLabel2:    website.registryLabel2 ?? '',
    registryUrl3:      website.registryUrl3 ?? '',
    registryLabel3:    website.registryLabel3 ?? '',
    rsvpDeadline:      website.rsvpDeadline ?? '',
  })

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
    setSaved(false)
  }

  // Snapshot of the form as first loaded so we can tell whether the couple has
  // actually changed anything (on mount `saved` is false but nothing is dirty yet).
  const pristineFormRef = useRef(form)

  // Warn before a hard refresh or tab close when there are unsaved edits (#106).
  // The classic editor persists only on the "Save changes" button, so without this
  // a reload would silently wipe everything the couple typed.
  useEffect(() => {
    const isDirty = !saved && JSON.stringify(form) !== JSON.stringify(pristineFormRef.current)
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [form, saved])

  // Registry is backed by three fixed slots, but couples shouldn't be greeted by
  // three empty boxes. Show one to start (plus any already filled), and let them
  // reveal more with an "Add another" button. Three covers Amazon + Target + Zola,
  // which is plenty; if couples ever hit the cap we'd migrate to an N-row table.
  const [visibleRegistries, setVisibleRegistries] = useState<number>(() => {
    const filled = ([1, 2, 3] as const).filter(
      n => form[`registryUrl${n}`]?.trim() || form[`registryLabel${n}`]?.trim()
    ).length
    return Math.max(1, filled)
  })

  const handleSave = async () => {
    await update.mutateAsync({
      ...form,
      weddingDate:  form.weddingDate  || null,
      rsvpDeadline: form.rsvpDeadline || null,
    } as Parameters<typeof update.mutateAsync>[0])
    setSaved(true)
  }

  const handlePublishToggle = async () => {
    const publishing = !website.isPublished
    if (!publishing) {
      const ok = await confirm({
        title: 'Unpublish your site?',
        message: 'Guests will see a "coming soon" page until you publish again.',
        tone: 'danger',
        confirmLabel: 'Unpublish',
      })
      if (!ok) return
    }
    publish.mutate(publishing, {
      onSuccess: () => {
        if (publishing) {
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 }, colors: ['#d4af6a', '#3b2f2f', '#f5ede0'] })
          setShowShareModal(true)
        }
      },
    })
  }

  const publicUrl = `https://www.altarwed.com/wedding/${website.slug}`
  // Draft sites 404 on the public URL, so point "View" at the owner-only preview
  // route until the site is published.
  const viewUrl = website.isPublished ? publicUrl : `https://www.altarwed.com/preview/${website.slug}/home`

  const coupleNames = `${website.partnerOneName} & ${website.partnerTwoName}`

  return (
    <div>
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        slug={website.slug}
        coupleNames={coupleNames}
      />
      {/* Persistent draft reminder (#159): the classic editor's Publish is a
          de-emphasized outline button next to the filled "Save changes", so
          couples can finish onboarding without realizing guests can't see the
          site. This banner reuses handlePublishToggle, which publishes (no
          confirm) whenever the site is a draft. */}
      <DraftBanner
        isPublished={website.isPublished}
        onPublish={handlePublishToggle}
        isPublishing={publish.isPending}
      />
      <PageHeader
        title="Wedding Website"
        subtitle={publicUrl}
        maxWidth="max-w-3xl"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${website.isPublished ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {website.isPublished ? 'Published' : 'Draft'}
            </span>
            <a href={viewUrl} target="_blank" rel="noopener noreferrer"
              className="text-sm text-gold hover:underline hidden sm:inline-flex items-center gap-1">
              {website.isPublished ? 'View' : 'Preview'}
              <ExternalLink size={14} aria-hidden="true" />
            </a>
            <button
              onClick={handlePublishToggle}
              disabled={publish.isPending}
              className="rounded-lg border border-gold px-3 py-1.5 text-sm font-medium text-brown hover:bg-gold/10 disabled:opacity-60 transition min-h-[36px]"
            >
              {publish.isPending ? '…' : website.isPublished ? 'Unpublish' : 'Publish'}
            </button>
          </div>
        }
      />

      <div className="max-w-3xl mx-auto py-6 sm:py-8 px-4 sm:px-6">

      {/* Tabs */}
      <div className="flex gap-1 mb-8 border-b border-gold-light overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition border-b-2 -mb-px ${
              activeTab === t.id
                ? 'border-gold text-brown'
                : 'border-transparent text-brown-light hover:text-brown'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="space-y-6">
        {activeTab === 'story' && <>
          {/* Bride field above Groom per the bride-first display convention. */}
          <Row label="Bride's name">
            <Input value={form.partnerTwoName} onChange={set('partnerTwoName')} />
          </Row>
          <Row label="Groom's name">
            <Input value={form.partnerOneName} onChange={set('partnerOneName')} />
          </Row>
          <Row label="Wedding date">
            <Input type="date" value={form.weddingDate} onChange={set('weddingDate')} />
          </Row>
          <Row label="Our story" hint="Share how you met and fell in love.">
            <Textarea value={form.ourStory} onChange={set('ourStory')} rows={6} />
          </Row>
        </>}

        {activeTab === 'scripture' && <>
          <ScriptureTab
            reference={form.scriptureReference}
            text={form.scriptureText}
            onReferenceChange={set('scriptureReference')}
            onTextChange={set('scriptureText')}
            onFetched={(ref, text) => {
              setForm(prev => ({ ...prev, scriptureReference: ref, scriptureText: text }))
              setSaved(false)
            }}
          />
        </>}

        {activeTab === 'details' && <>
          <Row label="Ceremony time" hint='e.g. "3:00 PM"'>
            <Input value={form.ceremonyTime} onChange={set('ceremonyTime')} />
          </Row>
          <Row label="Venue name">
            <Input value={form.venueName} onChange={set('venueName')} />
          </Row>
          <Row label="Street address">
            <Input value={form.venueAddress} onChange={set('venueAddress')} />
          </Row>
          <div className="grid grid-cols-2 gap-4">
            <Row label="City">
              <Input value={form.venueCity} onChange={set('venueCity')} />
            </Row>
            <Row label="State">
              <Input value={form.venueState} onChange={set('venueState')} />
            </Row>
          </div>
          <Row label="Dress code" hint='e.g. "Black tie optional" or "Garden formal"'>
            <Input value={form.dressCode} onChange={set('dressCode')} />
          </Row>
          <Row label="RSVP deadline">
            <Input type="date" value={form.rsvpDeadline} onChange={set('rsvpDeadline')} />
          </Row>
        </>}

        {activeTab === 'hotel' && (
          <HotelTab
            hotels={hotels}
            isLoading={hotelsLoading}
            onAdd={(payload) => addHotel.mutate(payload)}
            onUpdate={(hotelId, payload) => updateHotel.mutate({ hotelId, payload })}
            onDelete={(hotelId) => deleteHotel.mutate(hotelId)}
            isAddPending={addHotel.isPending}
            isUpdatePending={updateHotel.isPending}
            isDeletePending={deleteHotel.isPending}
          />
        )}

        {activeTab === 'registry' && <>
          <p className="text-sm text-brown-light">
            Add the registries you'd like guests to see. Most couples link one or two
            (Amazon, Target, Zola). Guests see a button for each after they RSVP.
          </p>
          {([1, 2, 3] as const).filter(n => n <= visibleRegistries).map(n => (
            <div key={n} className="rounded-xl border border-gold-light p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-brown">Registry {n}</p>
                {/* Allow clearing a revealed slot. Clears its fields and hides the
                    last slot so the couple isn't stuck with an empty box. */}
                {n === visibleRegistries && n > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm(prev => ({ ...prev, [`registryLabel${n}`]: '', [`registryUrl${n}`]: '' }))
                      setVisibleRegistries(v => v - 1)
                      setSaved(false)
                    }}
                    className="text-xs text-brown-light hover:text-red-600 transition"
                  >
                    Remove
                  </button>
                )}
              </div>
              <Row label="Label" hint='e.g. "Amazon" or "Williams Sonoma"'>
                <Input
                  value={form[`registryLabel${n}`]}
                  onChange={set(`registryLabel${n}`)}
                />
              </Row>
              <Row label="Link">
                <Input
                  type="url"
                  placeholder="https://"
                  value={form[`registryUrl${n}`]}
                  onChange={set(`registryUrl${n}`)}
                />
              </Row>
            </div>
          ))}
          {visibleRegistries < 3 && (
            <button
              type="button"
              onClick={() => setVisibleRegistries(v => Math.min(3, v + 1))}
              className="w-full rounded-xl border border-dashed border-gold-light py-3 text-sm font-medium text-gold hover:bg-gold/5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              + Add another registry link
            </button>
          )}
        </>}
      </div>

      {/* Save bar */}
      <div className="mt-10 flex items-center justify-between gap-4 pt-6 border-t border-gold-light">
        {saved
          ? <span className="inline-flex items-center gap-1 text-sm text-green-600 font-medium"><Check size={14} aria-hidden="true" /> Saved</span>
          : <span className="text-sm text-brown-light">Unsaved changes</span>
        }
        <button
          onClick={handleSave}
          disabled={update.isPending}
          className="rounded-lg bg-gold px-6 py-2.5 font-semibold text-white hover:bg-gold-dark disabled:opacity-60 transition"
        >
          {update.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type Tab = 'story' | 'scripture' | 'details' | 'hotel' | 'registry'
const TABS: { id: Tab; label: string }[] = [
  { id: 'story',     label: 'Our Story' },
  { id: 'scripture', label: 'Scripture' },
  { id: 'details',   label: 'Event Details' },
  { id: 'hotel',     label: 'Travel' },
  { id: 'registry',  label: 'Registry' },
]

const inputCls = 'w-full rounded-lg border border-gold-light px-4 py-2.5 text-brown text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold'

// Row generates a stable id and shares it through this context so the single
// text control it wraps (Input/Textarea) can adopt it as its `id`, giving the
// Row's <label htmlFor> a programmatic target (WCAG 1.3.1 / 4.1.2). Using a
// context rather than nesting the input inside the <label> keeps the
// non-labelable sibling controls (e.g. the scripture "Autofill" buttons) out
// of the label's content model.
const RowIdContext = createContext<string | undefined>(undefined)

function Input({ id, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const rowId = useContext(RowIdContext)
  return <input id={id ?? rowId} {...props} className={inputCls} />
}

function Textarea({ id, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const rowId = useContext(RowIdContext)
  return <textarea id={id ?? rowId} {...props} className={`${inputCls} resize-none`} />
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-brown mb-1">{label}</label>
      {hint && <p className="text-xs text-brown-light mb-1.5">{hint}</p>}
      <RowIdContext.Provider value={id}>{children}</RowIdContext.Provider>
    </div>
  )
}

function ScriptureBrowserModal({ onSelect, onClose }: {
  onSelect: (ref: string, text: string) => void
  onClose: () => void
}) {
  const [browseQuery, setBrowseQuery] = useState('')
  const featured = useQuery<{ references: string[] }>({
    queryKey: ['scripture-featured'],
    queryFn: () => apiClient.get('/api/v1/scripture/featured').then(r => r.data),
    staleTime: Infinity,
  })
  const lookup = useMutation<{ reference: string; text: string }, Error, string>({
    mutationFn: (q: string) =>
      apiClient.get(`/api/v1/scripture/search?q=${encodeURIComponent(q)}`).then(r => r.data),
  })
  const [preview, setPreview] = useState<{ reference: string; text: string } | null>(null)

  const handleLookup = (ref: string) => {
    lookup.mutate(ref, { onSuccess: (v) => setPreview(v) })
  }

  const handleBrowseSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (browseQuery.trim()) handleLookup(browseQuery.trim())
  }

  const ref = useModalA11y(true, onClose)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="scripture-modal-title"
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gold-light">
          <h2 id="scripture-modal-title" className="font-serif text-lg font-bold text-brown">Browse Wedding Verses</h2>
          <button onClick={onClose} aria-label="Close" className="text-brown-light hover:text-brown leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-5 flex-1">
          {/* Search */}
          <form onSubmit={handleBrowseSearch} className="flex gap-2">
            <input
              type="text"
              value={browseQuery}
              onChange={e => setBrowseQuery(e.target.value)}
              placeholder='e.g. "Ephesians 5:25"'
              className="flex-1 rounded-lg border border-gold-light px-3 py-2 text-sm text-brown placeholder-brown-light/60 focus:border-gold focus:outline-none"
            />
            <button
              type="submit"
              disabled={!browseQuery.trim() || lookup.isPending}
              className="rounded-lg border border-gold px-3 py-2 text-sm font-medium text-brown hover:bg-gold/10 disabled:opacity-50 transition whitespace-nowrap"
            >
              {lookup.isPending ? 'Looking up…' : 'Look up'}
            </button>
          </form>
          {lookup.isError && (
            <p className="text-xs text-red-600">Verse not found. Try "John 3:16" or "1 Corinthians 13".</p>
          )}

          {/* Preview */}
          {preview && (
            <div className="rounded-xl border border-gold bg-gold/5 px-4 py-3 space-y-2">
              <p className="font-serif font-bold text-brown">{preview.reference}</p>
              <p className="text-sm text-brown-light italic leading-relaxed">"{preview.text}"</p>
              <button
                onClick={() => { onSelect(preview.reference, preview.text); onClose() }}
                className="rounded-lg bg-brown px-4 py-1.5 text-sm font-semibold text-white hover:bg-brown/90 transition"
              >
                Use this verse
              </button>
            </div>
          )}

          {/* Featured list */}
          {featured.data && (
            <div>
              <p className="text-xs font-medium text-brown-light uppercase tracking-wide mb-2">Curated wedding verses</p>
              <ul className="space-y-1.5">
                {featured.data.references.map(ref => (
                  <li key={ref}>
                    <button
                      onClick={() => handleLookup(ref)}
                      className="w-full text-left rounded-lg border border-gold-light bg-white px-3 py-2 text-sm text-brown hover:border-gold hover:bg-gold/5 transition"
                    >
                      {ref}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ScriptureTab({
  reference, text, onReferenceChange, onTextChange, onFetched,
}: {
  reference: string
  text: string
  onReferenceChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onTextChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onFetched: (ref: string, text: string) => void
}) {
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [showBrowser, setShowBrowser] = useState(false)

  const handleFetch = async () => {
    if (!reference.trim()) return
    setFetching(true)
    setFetchError('')
    try {
      const query = encodeURIComponent(reference.trim())
      const res = await fetch(`https://bible-api.com/${query}`)
      if (!res.ok) throw new Error('Not found')
      const data = await res.json()
      if (!data.text) throw new Error('No text returned')
      onFetched(data.reference ?? reference, data.text.trim())
    } catch {
      setFetchError('Could not find that reference. Try a format like "1 Corinthians 13" or "John 3:16".')
    } finally {
      setFetching(false)
    }
  }

  return (
    <>
      {showBrowser && (
        <ScriptureBrowserModal
          onSelect={(ref, txt) => onFetched(ref, txt)}
          onClose={() => setShowBrowser(false)}
        />
      )}
      <Row label="Scripture reference" hint='e.g. "1 Corinthians 13" or "John 3:16-17"'>
        <div className="flex gap-2">
          <Input value={reference} onChange={onReferenceChange} className={inputCls + ' flex-1'} />
          <button
            type="button"
            onClick={handleFetch}
            disabled={fetching || !reference.trim()}
            className="rounded-lg border border-gold px-3 py-2 text-sm font-medium text-brown hover:bg-gold/10 disabled:opacity-50 transition whitespace-nowrap"
          >
            {fetching ? 'Fetching…' : 'Autofill text'}
          </button>
        </div>
        {fetchError && <p className="mt-1.5 text-xs text-red-600">{fetchError}</p>}
        <button
          type="button"
          onClick={() => setShowBrowser(true)}
          className="mt-2 text-sm text-gold hover:underline font-medium"
        >
          Browse wedding verses →
        </button>
      </Row>
      <Row label="Scripture text" hint="Verse text is locked to the chosen translation. Use 'Browse wedding verses' or 'Autofill' to change it.">
        <Textarea value={text} onChange={onTextChange} rows={8} readOnly className={inputCls + ' resize-none bg-ivory cursor-not-allowed'} />
      </Row>
    </>
  )
}

// ---------------------------------------------------------------------------
// Hotel tab, multi-hotel management
// ---------------------------------------------------------------------------
const hotelInputCls = 'w-full rounded-lg border border-gold-light px-3 py-2 text-brown text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold'

// Whether to render the "no hotels added yet" empty state. Kept as a pure,
// exported predicate so it can be unit-tested without a DOM (#187): the message
// must NOT show while the hotels query is still loading (the array defaults to
// [] before it resolves, so an empty array alone is ambiguous), only once
// loading has settled on a genuinely empty result and we're not mid-add.
export function shouldShowNoHotelsEmptyState(
  hotelCount: number,
  isLoading: boolean,
  isAddingNew: boolean,
): boolean {
  return !isLoading && hotelCount === 0 && !isAddingNew
}

export function HotelTab({ hotels, isLoading, onAdd, onUpdate, onDelete, isAddPending, isUpdatePending, isDeletePending }: {
  hotels: WeddingHotel[]
  isLoading: boolean
  onAdd: (p: WeddingHotelPayload) => void
  onUpdate: (id: string, p: WeddingHotelPayload) => void
  onDelete: (id: string) => void
  isAddPending: boolean
  isUpdatePending: boolean
  isDeletePending: boolean
}) {
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const confirm = useConfirm()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-brown">Hotel blocks for your guests</p>
        <button
          type="button"
          onClick={() => setEditingId('new')}
          className="rounded-lg bg-gold px-4 py-1.5 text-xs font-semibold text-white hover:bg-gold-dark transition"
        >
          + Add hotel
        </button>
      </div>

      {editingId === 'new' && (
        <HotelForm
          onSave={(p) => { onAdd(p); setEditingId(null) }}
          onCancel={() => setEditingId(null)}
          isPending={isAddPending}
        />
      )}

      {isLoading && hotels.length === 0 && editingId !== 'new' && (
        <p className="flex items-center justify-center gap-2 text-sm text-brown-light py-8 border border-dashed border-gold-light rounded-xl">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Loading hotels…
        </p>
      )}

      {shouldShowNoHotelsEmptyState(hotels.length, isLoading, editingId === 'new') && (
        <p className="text-sm text-brown-light text-center py-8 border border-dashed border-gold-light rounded-xl">
          No hotels added yet. Add your first hotel block so guests know where to stay.
        </p>
      )}

      {hotels.map(hotel => editingId === hotel.id ? (
        <HotelForm
          key={hotel.id}
          initial={hotel}
          onSave={(p) => { onUpdate(hotel.id, p); setEditingId(null) }}
          onCancel={() => setEditingId(null)}
          isPending={isUpdatePending}
        />
      ) : (
        <div key={hotel.id} className="rounded-xl border border-gold-light bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-brown">{hotel.name}</p>
              {hotel.address && <p className="text-xs text-brown-light mt-0.5">{hotel.address}</p>}
              <div className="flex flex-wrap gap-3 mt-2">
                {hotel.distanceFromVenue && (
                  <span className="inline-flex items-center gap-1 text-xs text-brown-light"><MapPin size={12} className="text-gold" aria-hidden="true" /> {hotel.distanceFromVenue}</span>
                )}
                {hotel.blockRate && (
                  <span className="inline-flex items-center gap-1 text-xs text-brown-light"><DollarSign size={12} className="text-gold" aria-hidden="true" /> {hotel.blockRate}</span>
                )}
                {hotel.bookingUrl && (
                  <a href={hotel.bookingUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-gold hover:underline">Book →</a>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button type="button" onClick={() => setEditingId(hotel.id)}
                className="text-xs text-brown-light hover:text-brown">Edit</button>
              <button
                type="button"
                onClick={async () => { if (await confirm({ title: `Remove "${hotel.name}"?`, message: 'This hotel block will be removed from your wedding website.', tone: 'danger', confirmLabel: 'Remove' })) onDelete(hotel.id) }}
                disabled={isDeletePending}
                className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
              >Remove</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function HotelForm({ initial, onSave, onCancel, isPending }: {
  initial?: WeddingHotel
  onSave: (p: WeddingHotelPayload) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [name, setName]     = useState(initial?.name ?? '')
  const [address, setAddr]  = useState(initial?.address ?? '')
  const [url, setUrl]       = useState(initial?.bookingUrl ?? '')
  const [rate, setRate]     = useState(initial?.blockRate ?? '')
  const [dist, setDist]     = useState(initial?.distanceFromVenue ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      name: name.trim(),
      address: address.trim() || undefined,
      bookingUrl: url.trim() || undefined,
      blockRate: rate.trim() || undefined,
      distanceFromVenue: dist.trim() || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gold bg-white p-5 space-y-3">
      <p className="text-sm font-medium text-brown">{initial ? 'Edit hotel' : 'New hotel'}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-brown-light mb-1">Hotel name *</label>
          <input required value={name} onChange={e => setName(e.target.value)} className={hotelInputCls} />
        </div>
        <div>
          <label className="block text-xs text-brown-light mb-1">Address</label>
          <input value={address} onChange={e => setAddr(e.target.value)} className={hotelInputCls} />
        </div>
        <div>
          <label className="block text-xs text-brown-light mb-1">Booking link</label>
          <input type="url" value={url} onChange={e => setUrl(e.target.value)} className={hotelInputCls} placeholder="https://..." />
        </div>
        <div>
          <label className="block text-xs text-brown-light mb-1">Block rate / notes</label>
          <input value={rate} onChange={e => setRate(e.target.value)} className={hotelInputCls} />
        </div>
        <div>
          <label className="block text-xs text-brown-light mb-1">Distance from venue</label>
          <input value={dist} onChange={e => setDist(e.target.value)} className={hotelInputCls} />
        </div>
      </div>
      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={isPending}
          className="rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-white hover:bg-gold-dark disabled:opacity-60 transition">
          {isPending ? 'Saving…' : 'Save hotel'}
        </button>
        <button type="button" onClick={onCancel}
          className="rounded-lg border border-gold-light px-5 py-2 text-sm font-medium text-brown hover:bg-ivory transition">
          Cancel
        </button>
      </div>
    </form>
  )
}

