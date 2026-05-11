import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useUpdateWeddingWebsite, usePublishWeddingWebsite, type WeddingWebsite } from './useWeddingWebsite'
import PageHeader from '@/components/PageHeader'
import { apiClient } from '@/core/api/client'

interface Props {
  website: WeddingWebsite
  coupleId: string
}

export default function WeddingWebsiteEditor({ website, coupleId }: Props) {
  const update = useUpdateWeddingWebsite(coupleId)
  const publish = usePublishWeddingWebsite(coupleId)

  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('story')

  // Local form state — mirror of the website fields
  const [form, setForm] = useState({
    partnerOneName:    website.partnerOneName,
    partnerTwoName:    website.partnerTwoName,
    weddingDate:       website.weddingDate ?? '',
    ourStory:          website.ourStory ?? '',
    testimony:         website.testimony ?? '',
    covenantStatement: website.covenantStatement ?? '',
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
    websitePin:        '',
  })

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
    setSaved(false)
  }

  const handleSave = async () => {
    await update.mutateAsync({
      ...form,
      weddingDate:  form.weddingDate  || null,
      rsvpDeadline: form.rsvpDeadline || null,
    } as Parameters<typeof update.mutateAsync>[0])
    setSaved(true)
  }

  const handlePublishToggle = () => publish.mutate(!website.isPublished)

  const publicUrl = `https://www.altarwed.com/wedding/${website.slug}`

  return (
    <div>
      <PageHeader
        title="Wedding Website"
        subtitle={publicUrl}
        action={
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${website.isPublished ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {website.isPublished ? 'Published' : 'Draft'}
            </span>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer"
              className="text-sm text-gold hover:underline hidden sm:inline">
              View ↗
            </a>
            <button
              onClick={handlePublishToggle}
              disabled={publish.isPending}
              className="rounded-lg border border-gold px-4 py-1.5 text-sm font-medium text-brown hover:bg-gold/10 disabled:opacity-60 transition"
            >
              {publish.isPending ? '…' : website.isPublished ? 'Unpublish' : 'Publish'}
            </button>
          </div>
        }
      />

      <div className="max-w-3xl mx-auto py-8 px-6">

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
          <Row label="Groom / Partner 1 name">
            <Input value={form.partnerOneName} onChange={set('partnerOneName')} />
          </Row>
          <Row label="Bride / Partner 2 name">
            <Input value={form.partnerTwoName} onChange={set('partnerTwoName')} />
          </Row>
          <Row label="Wedding date">
            <Input type="date" value={form.weddingDate} onChange={set('weddingDate')} />
          </Row>
          <Row label="Our story" hint="Share how you met and fell in love.">
            <Textarea value={form.ourStory} onChange={set('ourStory')} rows={6} />
          </Row>
          <Row label="Our testimony" hint="Share your shared faith journey.">
            <Textarea value={form.testimony} onChange={set('testimony')} rows={6} />
          </Row>
          <Row label="Why we chose a covenant ceremony" hint="Help your guests understand the significance.">
            <Textarea value={form.covenantStatement} onChange={set('covenantStatement')} rows={5} />
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

        {activeTab === 'hotel' && <>
          <Row label="Hotel name">
            <Input value={form.hotelName} onChange={set('hotelName')} />
          </Row>
          <Row label="Booking link">
            <Input type="url" placeholder="https://" value={form.hotelUrl} onChange={set('hotelUrl')} />
          </Row>
          <Row label="Details for guests" hint="Room block code, cut-off date, etc.">
            <Textarea value={form.hotelDetails} onChange={set('hotelDetails')} rows={4} />
          </Row>
        </>}

        {activeTab === 'privacy' && <PrivacyTab website={website} form={form} setForm={setForm} setSaved={setSaved} />}

        {activeTab === 'registry' && <>
          {([1, 2, 3] as const).map(n => (
            <div key={n} className="rounded-xl border border-gold-light p-5 space-y-4">
              <p className="text-sm font-medium text-brown">Registry {n}</p>
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
        </>}
      </div>

      {/* Save bar */}
      <div className="mt-10 flex items-center justify-between gap-4 pt-6 border-t border-gold-light">
        {saved
          ? <span className="text-sm text-green-600 font-medium">Saved ✓</span>
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

type Tab = 'story' | 'scripture' | 'details' | 'hotel' | 'registry' | 'privacy'
const TABS: { id: Tab; label: string }[] = [
  { id: 'story',     label: 'Our Story' },
  { id: 'scripture', label: 'Scripture' },
  { id: 'details',   label: 'Event Details' },
  { id: 'hotel',     label: 'Hotel' },
  { id: 'registry',  label: 'Registry' },
  { id: 'privacy',   label: 'Privacy' },
]

const inputCls = 'w-full rounded-lg border border-gold-light px-4 py-2.5 text-brown text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold'

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputCls} />
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} resize-none`} />
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-brown mb-1">{label}</label>
      {hint && <p className="text-xs text-brown-light mb-1.5">{hint}</p>}
      {children}
    </div>
  )
}

function PrivacyTab({
  website,
  form,
  setForm,
  setSaved,
}: {
  website: WeddingWebsite
  form: { websitePin: string }
  setForm: React.Dispatch<React.SetStateAction<any>>
  setSaved: React.Dispatch<React.SetStateAction<boolean>>
}) {
  const [pinEnabled, setPinEnabled] = useState(
    website.isPinProtected || form.websitePin.trim().length > 0
  )

  function handleToggle(checked: boolean) {
    setPinEnabled(checked)
    if (!checked) {
      // Empty string signals backend to clear the PIN
      setForm((prev: any) => ({ ...prev, websitePin: ' ' }))
      setSaved(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gold-light p-5 space-y-4">
        <div className="flex items-start gap-3">
          <input
            id="pin-toggle"
            type="checkbox"
            checked={pinEnabled}
            onChange={e => handleToggle(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gold-light text-gold focus:ring-gold"
          />
          <div>
            <label htmlFor="pin-toggle" className="text-sm font-medium text-brown cursor-pointer">
              Enable PIN protection
            </label>
            <p className="text-xs text-brown-light mt-0.5">
              Guests must enter a PIN to view your wedding details. Your hero photo and names will still be visible — only the tabs (story, details, etc.) are gated.
            </p>
          </div>
        </div>

        {pinEnabled && (
          <Row label="PIN" hint="4–10 characters. Share this privately with your invited guests.">
            <input
              type="text"
              maxLength={10}
              placeholder="e.g. 1234"
              value={form.websitePin.trim()}
              onChange={e => {
                setForm((prev: any) => ({ ...prev, websitePin: e.target.value }))
                setSaved(false)
              }}
              className={inputCls + ' max-w-[160px]'}
            />
          </Row>
        )}

        {!pinEnabled && website.isPinProtected && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            PIN protection is currently active. Save changes to remove it.
          </p>
        )}
      </div>
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gold-light">
          <h2 className="font-serif text-lg font-bold text-brown">Browse Wedding Verses</h2>
          <button onClick={onClose} className="text-brown-light hover:text-brown text-xl leading-none">✕</button>
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
      <Row label="Scripture text" hint="Edit freely after autofilling.">
        <Textarea value={text} onChange={onTextChange} rows={8} />
      </Row>
    </>
  )
}
