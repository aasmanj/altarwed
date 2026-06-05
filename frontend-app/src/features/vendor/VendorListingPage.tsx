import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useVendorProfile, useUpdateVendorProfile } from './useVendor'
import { useDenominations } from './useDenominations'

const CATEGORIES = [
  { value: 'PHOTOGRAPHER',    label: 'Photographer' },
  { value: 'VIDEOGRAPHER',    label: 'Videographer' },
  { value: 'FLORIST',         label: 'Florist' },
  { value: 'CATERER',         label: 'Caterer' },
  { value: 'VENUE',           label: 'Venue' },
  { value: 'OFFICIANT',       label: 'Officiant / Pastor' },
  { value: 'MUSIC',           label: 'Music' },
  { value: 'CAKE',            label: 'Cake' },
  { value: 'HAIR_AND_MAKEUP', label: 'Hair & Makeup' },
  { value: 'INVITATION',      label: 'Invitations & Stationery' },
  { value: 'TRANSPORTATION',  label: 'Transportation' },
  { value: 'COORDINATOR',     label: 'Wedding Coordinator' },
  { value: 'OTHER',           label: 'Other' },
]

const PRICE_TIERS = [
  { value: '',    label: 'Not specified' },
  { value: '$',   label: '$ - Budget-friendly' },
  { value: '$$',  label: '$$ - Mid-range' },
  { value: '$$$', label: '$$$ - Premium' },
]

const inputCls = 'w-full rounded-lg border border-[#e8dcc8] px-4 py-2.5 text-[#3b2f2f] text-sm focus:border-[#d4af6a] focus:outline-none focus:ring-1 focus:ring-[#d4af6a]'
const textareaCls = 'w-full rounded-lg border border-[#e8dcc8] px-4 py-2.5 text-[#3b2f2f] text-sm focus:border-[#d4af6a] focus:outline-none focus:ring-1 focus:ring-[#d4af6a] resize-y'
const labelCls = 'block text-sm font-medium text-[#3b2f2f] mb-1'

export default function VendorListingPage() {
  const { data: vendor, isLoading } = useVendorProfile()
  const { data: denominations } = useDenominations()
  const update = useUpdateVendorProfile()
  const [saved, setSaved] = useState<boolean | null>(null)
  const [saveError, setSaveError] = useState('')

  const [form, setForm] = useState({
    businessName: '',
    category: '',
    city: '',
    state: '',
    isChristianOwned: false,
    priceTier: '',
    denominationIds: [] as string[],
    bio: '',
    description: '',
    websiteUrl: '',
    phone: '',
  })

  useEffect(() => {
    if (vendor) {
      setForm({
        businessName: vendor.businessName,
        category: vendor.category,
        city: vendor.city,
        state: vendor.state,
        isChristianOwned: vendor.isChristianOwned,
        priceTier: vendor.priceTier ?? '',
        denominationIds: vendor.denominationIds ?? [],
        bio: vendor.bio ?? '',
        description: vendor.description ?? '',
        websiteUrl: vendor.websiteUrl ?? '',
        phone: vendor.phone ?? '',
      })
    }
  }, [vendor])

  const set = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm(prev => ({
      ...prev,
      [field]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value,
    }))
    setSaved(false)
    setSaveError('')
  }

  const toggleDenomination = (id: string) => {
    setForm(prev => ({
      ...prev,
      denominationIds: prev.denominationIds.includes(id)
        ? prev.denominationIds.filter(d => d !== id)
        : [...prev.denominationIds, id],
    }))
    setSaved(false)
    setSaveError('')
  }

  const handleSave = async () => {
    setSaveError('')
    try {
      await update.mutateAsync({
        ...form,
        priceTier: form.priceTier || undefined,
        bio: form.bio || undefined,
        description: form.description || undefined,
        websiteUrl: form.websiteUrl || undefined,
        phone: form.phone || undefined,
      })
      setSaved(true)
    } catch {
      setSaveError('Save failed. Please try again.')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fdfaf6] flex items-center justify-center">
        <p className="text-[#a08060] animate-pulse">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fdfaf6]">
      <header className="border-b border-[#e8dcc8] bg-white px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
        <span className="font-serif text-xl font-bold text-[#3b2f2f] shrink-0">AltarWed</span>
        <Link to="/vendor" className="shrink-0 text-sm text-[#a08060] hover:text-[#3b2f2f] transition">
          ← Dashboard
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-8">
          <h1 className="font-serif text-2xl font-bold text-[#3b2f2f]">My Listing</h1>
          <p className="text-[#6b5344] text-sm mt-1">
            This is how your business appears to couples on AltarWed
          </p>
          {vendor && (
            <div className="mt-3 flex items-start gap-3">
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                vendor.isVerified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {vendor.isVerified ? 'Verified' : 'Pending verification'}
              </span>
              {!vendor.isVerified && (
                <p className="text-xs text-[#a08060] mt-0.5">
                  Your listing is under review. Once verified, it will appear in the public directory.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-[#e8dcc8] p-5 sm:p-8 space-y-6">

          {/* Business name */}
          <div>
            <label htmlFor="businessName" className={labelCls}>Business name</label>
            <input id="businessName" value={form.businessName} onChange={set('businessName')} className={inputCls} />
          </div>

          {/* Category + City */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="category" className={labelCls}>Category</label>
              <select id="category" value={form.category} onChange={set('category')} className={inputCls}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="city" className={labelCls}>City</label>
              <input id="city" value={form.city} onChange={set('city')} className={inputCls} />
            </div>
          </div>

          {/* State + Price tier */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="state" className={labelCls}>State</label>
              <input id="state" value={form.state} onChange={set('state')} className={inputCls} maxLength={50} />
            </div>
            <div>
              <label htmlFor="priceTier" className={labelCls}>Price range</label>
              <select id="priceTier" value={form.priceTier} onChange={set('priceTier')} className={inputCls}>
                {PRICE_TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {/* Bio */}
          <div>
            <label htmlFor="bio" className={labelCls}>
              Short bio <span className="text-[#a08060] font-normal">(shown on listing card)</span>
            </label>
            <textarea
              id="bio"
              value={form.bio}
              onChange={set('bio')}
              className={textareaCls}
              rows={2}
              maxLength={1000}
              placeholder="One or two sentences about what makes your business unique"
            />
            <p className="text-xs text-[#a08060] mt-1">{form.bio.length}/1000</p>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className={labelCls}>
              Full description <span className="text-[#a08060] font-normal">(shown on your listing page)</span>
            </label>
            <textarea
              id="description"
              value={form.description}
              onChange={set('description')}
              className={textareaCls}
              rows={5}
              maxLength={2000}
              placeholder="Tell couples about your services, style, packages, and what a couple can expect when working with you"
            />
            <p className="text-xs text-[#a08060] mt-1">{form.description.length}/2000</p>
          </div>

          {/* Website + Phone */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="websiteUrl" className={labelCls}>Website URL</label>
              <input
                id="websiteUrl"
                type="url"
                value={form.websiteUrl}
                onChange={set('websiteUrl')}
                className={inputCls}
                placeholder="https://yourbusiness.com"
                maxLength={500}
              />
            </div>
            <div>
              <label htmlFor="phone" className={labelCls}>Phone number</label>
              <input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={set('phone')}
                className={inputCls}
                placeholder="(555) 555-5555"
                maxLength={30}
              />
            </div>
          </div>

          {/* Christian-owned */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              id="isChristianOwned"
              checked={form.isChristianOwned}
              onChange={set('isChristianOwned')}
              className="h-4 w-4 rounded border-[#e8dcc8] accent-[#d4af6a]"
            />
            <div>
              <p className="text-sm font-medium text-[#3b2f2f]">Christian-owned business</p>
              <p className="text-xs text-[#a08060]">Shown as a badge on your listing</p>
            </div>
          </label>

          {/* Denominations */}
          {denominations && denominations.length > 0 && (
            <fieldset>
              <legend className="text-sm font-medium text-[#3b2f2f] mb-2">
                Denomination(s) you serve
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {denominations.map(d => (
                  <label key={d.id} className="flex items-center gap-2 cursor-pointer text-sm text-[#3b2f2f]">
                    <input
                      type="checkbox"
                      checked={form.denominationIds.includes(d.id)}
                      onChange={() => toggleDenomination(d.id)}
                      className="h-4 w-4 rounded border-[#e8dcc8] accent-[#d4af6a]"
                    />
                    {d.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {/* Save bar */}
          <div className="flex items-center justify-between pt-4 border-t border-[#e8dcc8]">
            <div>
              {saveError && (
                <p role="alert" className="text-sm text-red-600">{saveError}</p>
              )}
              {!saveError && saved === true && (
                <span className="text-sm text-green-600 font-medium">Saved ✓</span>
              )}
              {!saveError && saved === false && (
                <span className="text-sm text-[#a08060]">Unsaved changes</span>
              )}
            </div>
            <button
              onClick={handleSave}
              disabled={update.isPending}
              className="rounded-lg bg-[#3b2f2f] px-6 py-2.5 font-semibold text-white hover:bg-[#5c4033] disabled:opacity-60 transition text-sm"
            >
              {update.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
