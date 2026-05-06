import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useVendorProfile, useUpdateVendorProfile } from './useVendor'

const CATEGORIES = [
  { value: 'PHOTOGRAPHER',   label: 'Photographer' },
  { value: 'VIDEOGRAPHER',   label: 'Videographer' },
  { value: 'FLORIST',        label: 'Florist' },
  { value: 'CATERER',        label: 'Caterer' },
  { value: 'VENUE',          label: 'Venue' },
  { value: 'OFFICIANT',      label: 'Officiant / Pastor' },
  { value: 'MUSIC',          label: 'Music' },
  { value: 'CAKE',           label: 'Cake' },
  { value: 'HAIR_AND_MAKEUP',label: 'Hair & Makeup' },
  { value: 'INVITATION',     label: 'Invitations & Stationery' },
  { value: 'TRANSPORTATION', label: 'Transportation' },
  { value: 'COORDINATOR',    label: 'Wedding Coordinator' },
  { value: 'OTHER',          label: 'Other' },
]

const inputCls = 'w-full rounded-lg border border-[#e8dcc8] px-4 py-2.5 text-[#3b2f2f] text-sm focus:border-[#d4af6a] focus:outline-none focus:ring-1 focus:ring-[#d4af6a]'

export default function VendorListingPage() {
  const { data: vendor, isLoading } = useVendorProfile()
  const update = useUpdateVendorProfile()
  const [saved, setSaved] = useState(false)

  const [form, setForm] = useState({
    businessName: '',
    category: '',
    city: '',
    state: '',
    isChristianOwned: false,
  })

  useEffect(() => {
    if (vendor) {
      setForm({
        businessName: vendor.businessName,
        category: vendor.category,
        city: vendor.city,
        state: vendor.state,
        isChristianOwned: vendor.isChristianOwned,
      })
    }
  }, [vendor])

  const set = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm(prev => ({
      ...prev,
      [field]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value,
    }))
    setSaved(false)
  }

  const handleSave = async () => {
    await update.mutateAsync(form)
    setSaved(true)
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
      <header className="border-b border-[#e8dcc8] bg-white px-6 py-4 flex items-center justify-between">
        <span className="font-serif text-xl font-bold text-[#3b2f2f]">AltarWed</span>
        <Link to="/vendor" className="text-sm text-[#a08060] hover:text-[#3b2f2f] transition">
          ← Dashboard
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className="mb-8">
          <h1 className="font-serif text-2xl font-bold text-[#3b2f2f]">My Listing</h1>
          <p className="text-[#6b5344] text-sm mt-1">
            This is how your business appears to couples on AltarWed
          </p>
          {vendor && (
            <div className="mt-2 flex items-center gap-2">
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                vendor.isVerified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {vendor.isVerified ? 'Verified' : 'Pending verification'}
              </span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-[#e8dcc8] p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-[#3b2f2f] mb-1">Business name</label>
            <input value={form.businessName} onChange={set('businessName')} className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#3b2f2f] mb-1">Category</label>
              <select value={form.category} onChange={set('category')} className={inputCls}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#3b2f2f] mb-1">City</label>
              <input value={form.city} onChange={set('city')} className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#3b2f2f] mb-1">State</label>
            <input value={form.state} onChange={set('state')} className={inputCls} maxLength={50} />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.isChristianOwned} onChange={set('isChristianOwned')}
              className="h-4 w-4 rounded border-[#e8dcc8] accent-[#d4af6a]" />
            <div>
              <p className="text-sm font-medium text-[#3b2f2f]">Christian-owned business</p>
              <p className="text-xs text-[#a08060]">Shown as a badge on your listing</p>
            </div>
          </label>

          <div className="flex items-center justify-between pt-4 border-t border-[#e8dcc8]">
            {saved
              ? <span className="text-sm text-green-600 font-medium">Saved ✓</span>
              : <span className="text-sm text-[#a08060]">Unsaved changes</span>
            }
            <button
              onClick={handleSave}
              disabled={update.isPending}
              className="rounded-lg bg-[#3b2f2f] px-6 py-2.5 font-semibold text-white hover:bg-[#5c4033] disabled:opacity-60 transition text-sm"
            >
              {update.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-[#e8dcc8] bg-[#fdfaf6] p-5">
          <p className="text-sm font-medium text-[#3b2f2f] mb-1">Coming soon</p>
          <p className="text-sm text-[#a08060]">Bio, photos, and portfolio will be available in the next update.</p>
        </div>
      </main>
    </div>
  )
}
