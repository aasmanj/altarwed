import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useVendorProfile, useUpdateVendorProfile, useUploadVendorLogo, useSetListingActive } from './useVendor'
import {
  usePortfolioPhotos,
  useUploadPortfolioPhoto,
  useDeletePortfolioPhoto,
  useReorderPortfolioPhotos,
  useUpdatePortfolioPhotoCaption,
  type PortfolioPhoto,
} from './useVendorPortfolio'
import { normalizeImageFile, IMAGE_ACCEPT } from '@/lib/normalizeImageFile'

const CATEGORIES = [
  { value: 'ALTERATIONS',     label: 'Alterations, Tailoring & Dry Cleaning' },
  { value: 'CAKE',            label: 'Cake' },
  { value: 'CATERER',         label: 'Caterer' },
  { value: 'COORDINATOR',     label: 'Wedding Coordinator' },
  { value: 'FLORIST',         label: 'Florist' },
  { value: 'HAIR_AND_MAKEUP', label: 'Hair & Makeup' },
  { value: 'INVITATION',      label: 'Invitations & Stationery' },
  { value: 'MUSIC',           label: 'Music' },
  { value: 'OFFICIANT',       label: 'Officiant / Pastor' },
  { value: 'PHOTOGRAPHER',    label: 'Photographer' },
  { value: 'TRANSPORTATION',  label: 'Transportation' },
  { value: 'VENUE',           label: 'Venue' },
  { value: 'VIDEOGRAPHER',    label: 'Videographer' },
  { value: 'OTHER',           label: 'Other' },
]

const PRICE_TIERS = [
  { value: '',    label: 'Not specified' },
  { value: '$',   label: '$ - Budget-friendly' },
  { value: '$$',  label: '$$ - Mid-range' },
  { value: '$$$', label: '$$$ - Premium' },
]

function normalizeUrl(raw: string): string {
  if (!raw || /^https?:\/\//i.test(raw)) return raw
  return `https://${raw}`
}

const inputCls = 'w-full rounded-lg border border-[#e8dcc8] px-4 py-2.5 text-[#3b2f2f] text-sm focus:border-[#d4af6a] focus:outline-none focus:ring-1 focus:ring-[#d4af6a]'
const textareaCls = 'w-full rounded-lg border border-[#e8dcc8] px-4 py-2.5 text-[#3b2f2f] text-sm focus:border-[#d4af6a] focus:outline-none focus:ring-1 focus:ring-[#d4af6a] resize-y'
const labelCls = 'block text-sm font-medium text-[#3b2f2f] mb-1'

export default function VendorListingPage() {
  const { data: vendor, isLoading } = useVendorProfile()
  const update = useUpdateVendorProfile()
  const uploadLogo = useUploadVendorLogo()
  const setListingActive = useSetListingActive()
  const portfolioPhotos = usePortfolioPhotos(vendor?.id)
  const uploadPortfolioPhoto = useUploadPortfolioPhoto()
  const deletePortfolioPhoto = useDeletePortfolioPhoto()
  const reorderPortfolioPhotos = useReorderPortfolioPhotos()
  const updatePortfolioCaption = useUpdatePortfolioPhotoCaption()
  const portfolioFileRef = useRef<HTMLInputElement>(null)
  const [portfolioError, setPortfolioError] = useState('')
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [saved, setSaved] = useState<boolean | null>(null)
  const [saveError, setSaveError] = useState('')
  const [logoError, setLogoError] = useState('')

  const [form, setForm] = useState({
    businessName: '',
    category: '',
    city: '',
    state: '',
    isChristianOwned: false,
    priceTier: '',
    bio: '',
    description: '',
    websiteUrl: '',
    phone: '',
    contactEmail: '',
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
        bio: vendor.bio ?? '',
        description: vendor.description ?? '',
        websiteUrl: vendor.websiteUrl ?? '',
        phone: vendor.phone ?? '',
        contactEmail: vendor.contactEmail ?? '',
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

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    if (!picked) return
    setLogoError('')
    try {
      // Convert HEIC (iPhone / Google Photos) to JPEG before upload.
      await uploadLogo.mutateAsync(await normalizeImageFile(picked))
    } catch {
      setLogoError('Logo upload failed. Please try again.')
    }
  }

  const handleSave = async () => {
    setSaveError('')
    try {
      await update.mutateAsync({
        ...form,
        priceTier: form.priceTier || undefined,
        bio: form.bio || undefined,
        description: form.description || undefined,
        websiteUrl: normalizeUrl(form.websiteUrl) || undefined,
        phone: form.phone || undefined,
        contactEmail: form.contactEmail || undefined,
      })
      setSaved(true)
    } catch {
      setSaveError('Save failed. Please try again.')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fdfaf6] flex items-center justify-center">
        <p className="text-[#8a6a4a] animate-pulse">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fdfaf6]">
      <header className="border-b border-[#e8dcc8] bg-white px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3">
        <Link to="/vendor" className="text-sm text-[#8a6a4a] hover:text-[#3b2f2f] transition">
          ← Dashboard
        </Link>
        <span className="text-[#e8dcc8]" aria-hidden="true">|</span>
        <span className="font-serif text-lg font-semibold text-[#3b2f2f]">My Listing</span>
      </header>

      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-8">
          <h1 className="font-serif text-2xl font-bold text-[#3b2f2f]">My Listing</h1>
          <p className="text-[#6b5344] text-sm mt-1">
            This is how your business appears to couples on AltarWed
          </p>
          {vendor && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  !vendor.isVerified
                    ? 'bg-yellow-100 text-yellow-700'
                    : vendor.isActive
                      ? 'bg-green-100 text-green-700'
                      : 'bg-stone-200 text-stone-600'
                }`}>
                  {!vendor.isVerified ? 'Pending verification' : vendor.isActive ? 'Live' : 'Paused'}
                </span>
                {vendor.isVerified && (
                  <button
                    type="button"
                    onClick={() => setListingActive.mutate(!vendor.isActive)}
                    disabled={setListingActive.isPending}
                    className="text-xs font-medium text-[#8a6a4a] hover:text-[#3b2f2f] underline underline-offset-2 disabled:opacity-50"
                  >
                    {setListingActive.isPending
                      ? 'Saving...'
                      : vendor.isActive ? 'Pause listing' : 'Resume listing'}
                  </button>
                )}
              </div>
              {!vendor.isVerified && (
                <p className="text-xs text-[#8a6a4a]">
                  Your listing is under review. Once verified, it will appear in the public directory.
                </p>
              )}
              {vendor.isVerified && !vendor.isActive && (
                <p className="text-xs text-[#8a6a4a]">
                  Your listing is paused, so couples can't find you and you won't receive new inquiries. Resume any time.
                </p>
              )}
              {setListingActive.isError && (
                <p className="text-xs text-rose-600">Could not update your listing. Please try again.</p>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-[#e8dcc8] p-5 sm:p-8 space-y-6">

          {/* Logo */}
          <div>
            <p className={labelCls}>Business logo</p>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-[#f5ede0] border border-[#e8dcc8] flex items-center justify-center shrink-0 overflow-hidden">
                {vendor?.logoUrl
                  ? <img src={vendor.logoUrl} alt={`${form.businessName} logo`} className="h-full w-full object-cover" />
                  : <span className="font-serif text-2xl text-[#8a6a4a]">{form.businessName.charAt(0) || '?'}</span>
                }
              </div>
              <div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept={IMAGE_ACCEPT}
                  onChange={handleLogoChange}
                  className="sr-only"
                  id="logoUpload"
                  aria-label="Upload business logo"
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadLogo.isPending}
                  className="text-sm font-medium text-[#d4af6a] hover:text-[#8a6a4a] transition disabled:opacity-50"
                >
                  {uploadLogo.isPending ? 'Uploading…' : vendor?.logoUrl ? 'Change logo' : 'Upload logo'}
                </button>
                <p className="text-xs text-[#8a6a4a] mt-0.5">JPEG, PNG, or WebP, max 15 MB</p>
                {logoError && <p role="alert" className="text-xs text-red-600 mt-1">{logoError}</p>}
              </div>
            </div>
          </div>

          {/* Business name */}
          <div>
            <label htmlFor="businessName" className={labelCls}>Business name</label>
            <input id="businessName" value={form.businessName} onChange={set('businessName')} className={inputCls} />
          </div>

          {/* Account email (read-only — login identity, not shown publicly) */}
          <div>
            <label htmlFor="accountEmail" className={labelCls}>Account email</label>
            <input
              id="accountEmail"
              type="email"
              value={vendor?.email ?? ''}
              readOnly
              className={`${inputCls} bg-[#fdfaf6] text-[#8a6a4a] cursor-default`}
              aria-describedby="accountEmailHint"
            />
            <p id="accountEmailHint" className="text-xs text-[#8a6a4a] mt-1">
              This is your login email. To change it, contact support.
            </p>
          </div>

          {/* Contact email for couples */}
          <div>
            <label htmlFor="contactEmail" className={labelCls}>Contact email for couples</label>
            <input
              id="contactEmail"
              type="email"
              value={form.contactEmail}
              onChange={set('contactEmail')}
              className={inputCls}
              maxLength={255}
            />
            <p className="text-xs text-[#8a6a4a] mt-1">
              Optional. Shown publicly on your listing so couples can reach you. Leave blank to use your account email.
            </p>
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
              Short bio <span className="text-[#8a6a4a] font-normal">(shown on listing card)</span>
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
            <p className="text-xs text-[#8a6a4a] mt-1">{form.bio.length}/1000</p>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className={labelCls}>
              Full description <span className="text-[#8a6a4a] font-normal">(shown on your listing page)</span>
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
            <p className="text-xs text-[#8a6a4a] mt-1">{form.description.length}/2000</p>
          </div>

          {/* Website + Phone */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="websiteUrl" className={labelCls}>Website URL</label>
              <input
                id="websiteUrl"
                type="text"
                value={form.websiteUrl}
                onChange={set('websiteUrl')}
                onBlur={() => setForm(prev => ({ ...prev, websiteUrl: normalizeUrl(prev.websiteUrl) }))}
                className={inputCls}
                maxLength={500}
              />
              {form.websiteUrl && !/^https?:\/\//i.test(form.websiteUrl) && (
                <p className="text-xs text-[#8a6a4a] mt-1">Will be saved as: {normalizeUrl(form.websiteUrl)}</p>
              )}
            </div>
            <div>
              <label htmlFor="phone" className={labelCls}>Phone number</label>
              <input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={set('phone')}
                className={inputCls}
                maxLength={30}
              />
              <p className="text-xs text-[#8a6a4a] mt-1">Include area code</p>
            </div>
          </div>

          {/* Christian-owned */}
          <label htmlFor="isChristianOwned" className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              id="isChristianOwned"
              checked={form.isChristianOwned}
              onChange={set('isChristianOwned')}
              className="h-4 w-4 rounded border-[#e8dcc8] accent-[#d4af6a]"
            />
            <span className="flex flex-col">
              <span className="text-sm font-medium text-[#3b2f2f]">Christian-owned business</span>
              <span className="text-xs text-[#8a6a4a]">Shown as a badge on your listing</span>
            </span>
          </label>

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
                <span className="text-sm text-[#8a6a4a]">Unsaved changes</span>
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

        {/* Portfolio */}
        <div className="bg-white rounded-2xl border border-[#e8dcc8] p-5 sm:p-8 space-y-5 mt-6">
          <div>
            <h2 className="font-serif text-lg font-semibold text-[#3b2f2f]">Portfolio</h2>
            <p className="text-sm text-[#6b5344] mt-0.5">Add photos to showcase your work (max 10)</p>
          </div>

          {portfolioPhotos.isLoading && (
            <p className="text-sm text-[#8a6a4a] animate-pulse">Loading photos…</p>
          )}

          {!portfolioPhotos.isLoading && (portfolioPhotos.data?.length ?? 0) > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {portfolioPhotos.data!.map((photo: PortfolioPhoto, index: number) => (
                <div key={photo.id} className="group relative">
                  <div className="relative aspect-square overflow-hidden rounded-lg border border-[#e8dcc8]">
                    <img
                      src={photo.photoUrl}
                      alt={photo.caption ?? 'Portfolio photo'}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPortfolioError('')
                        deletePortfolioPhoto.mutate(photo.id)
                      }}
                      className="absolute top-1 right-1 hidden group-hover:flex items-center justify-center w-6 h-6 rounded-full bg-white/90 text-red-500 hover:bg-white text-xs font-bold shadow transition"
                      aria-label="Delete photo"
                    >
                      x
                    </button>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => {
                        const ids = portfolioPhotos.data!.map((p: PortfolioPhoto) => p.id)
                        const newIds = [...ids]
                        ;[newIds[index - 1], newIds[index]] = [newIds[index], newIds[index - 1]]
                        reorderPortfolioPhotos.mutate(newIds)
                      }}
                      className="text-[#8a6a4a] hover:text-[#3b2f2f] disabled:opacity-30 transition text-xs px-1"
                      aria-label="Move photo up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={index === portfolioPhotos.data!.length - 1}
                      onClick={() => {
                        const ids = portfolioPhotos.data!.map((p: PortfolioPhoto) => p.id)
                        const newIds = [...ids]
                        ;[newIds[index], newIds[index + 1]] = [newIds[index + 1], newIds[index]]
                        reorderPortfolioPhotos.mutate(newIds)
                      }}
                      className="text-[#8a6a4a] hover:text-[#3b2f2f] disabled:opacity-30 transition text-xs px-1"
                      aria-label="Move photo down"
                    >
                      ↓
                    </button>
                    <input
                      type="text"
                      defaultValue={photo.caption ?? ''}
                      onBlur={e => {
                        const val = e.target.value.trim()
                        if (val !== (photo.caption ?? '')) {
                          updatePortfolioCaption.mutate({ photoId: photo.id, caption: val })
                        }
                      }}
                      placeholder="Add caption"
                      className="flex-1 text-xs border border-[#e8dcc8] rounded px-2 py-1 text-[#3b2f2f] focus:border-[#d4af6a] focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {portfolioError && (
            <p role="alert" className="text-sm text-red-600">{portfolioError}</p>
          )}

          <input
            ref={portfolioFileRef}
            type="file"
            accept={IMAGE_ACCEPT}
            className="sr-only"
            aria-label="Upload portfolio photo"
            onChange={async e => {
              const picked = e.target.files?.[0]
              if (!picked) return
              setPortfolioError('')
              try {
                const normalized = await normalizeImageFile(picked)
                await uploadPortfolioPhoto.mutateAsync({ file: normalized })
              } catch (err: unknown) {
                const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
                setPortfolioError(detail ?? 'Upload failed. Please try again.')
              }
              if (portfolioFileRef.current) portfolioFileRef.current.value = ''
            }}
          />

          {(portfolioPhotos.data?.length ?? 0) >= 10 ? (
            <p className="text-sm text-[#8a6a4a]">Portfolio full (10/10). Delete a photo to add another.</p>
          ) : (
            <button
              type="button"
              onClick={() => portfolioFileRef.current?.click()}
              disabled={uploadPortfolioPhoto.isPending}
              className="rounded-lg border border-[#e8dcc8] px-4 py-2 text-sm font-medium text-[#3b2f2f] hover:bg-[#f5ede0] disabled:opacity-60 transition"
            >
              {uploadPortfolioPhoto.isPending ? 'Uploading…' : '+ Add photo'}
            </button>
          )}
        </div>
      </main>
    </div>
  )
}
