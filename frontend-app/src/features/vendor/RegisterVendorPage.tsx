import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/core/auth/AuthContext'

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

const cls = {
  input: 'w-full rounded-lg border border-[#e8dcc8] px-4 py-2.5 text-[#3b2f2f] text-sm focus:border-[#d4af6a] focus:outline-none focus:ring-1 focus:ring-[#d4af6a]',
  label: 'block text-sm font-medium text-[#3b2f2f] mb-1',
}

export default function RegisterVendorPage() {
  const { registerVendor } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    businessName: '',
    category: '',
    city: '',
    state: '',
    email: '',
    password: '',
    confirmPassword: '',
    isChristianOwned: false,
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const set = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setForm(prev => ({
    ...prev,
    [field]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value,
  }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await registerVendor({
        businessName: form.businessName,
        category: form.category,
        city: form.city,
        state: form.state,
        email: form.email,
        password: form.password,
        isChristianOwned: form.isChristianOwned,
      })
      navigate('/vendor')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail ?? 'Registration failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fdfaf6] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <h1 className="font-serif text-3xl font-bold text-[#3b2f2f]">List your business</h1>
          <p className="text-[#6b5344] mt-2 text-sm">
            Join AltarWed's faith-based vendor directory
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#e8dcc8] p-8 space-y-5 shadow-sm">
          <div>
            <label className={cls.label}>Business name *</label>
            <input required value={form.businessName} onChange={set('businessName')}
              className={cls.input} placeholder="Jordan's Photography" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={cls.label}>Category *</label>
              <select required value={form.category} onChange={set('category')} className={cls.input}>
                <option value="">— Select —</option>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={cls.label}>City *</label>
              <input required value={form.city} onChange={set('city')} className={cls.input} placeholder="Dallas" />
            </div>
          </div>

          <div>
            <label className={cls.label}>State *</label>
            <input required value={form.state} onChange={set('state')} className={cls.input} placeholder="TX" maxLength={50} />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.isChristianOwned} onChange={set('isChristianOwned')}
              className="h-4 w-4 rounded border-[#e8dcc8] accent-[#d4af6a]" />
            <span className="text-sm text-[#3b2f2f]">This is a Christian-owned business</span>
          </label>

          <hr className="border-[#e8dcc8]" />

          <div>
            <label className={cls.label}>Email *</label>
            <input required type="email" value={form.email} onChange={set('email')}
              className={cls.input} placeholder="you@yourbusiness.com" />
          </div>
          <div>
            <label className={cls.label}>Password *</label>
            <input required type="password" value={form.password} onChange={set('password')}
              className={cls.input} placeholder="At least 8 characters" />
          </div>
          <div>
            <label className={cls.label}>Confirm password *</label>
            <input required type="password" value={form.confirmPassword} onChange={set('confirmPassword')}
              className={cls.input} placeholder="Repeat password" />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={submitting}
            className="w-full rounded-xl bg-[#3b2f2f] py-3 font-semibold text-white hover:bg-[#5c4033] disabled:opacity-60 transition">
            {submitting ? 'Creating account…' : 'Create vendor account'}
          </button>
        </form>

        <p className="text-center text-sm text-[#a08060] mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-[#3b2f2f] font-medium hover:underline">Sign in</Link>
        </p>
        <p className="text-center text-sm text-[#a08060] mt-2">
          Planning a wedding?{' '}
          <Link to="/register" className="text-[#3b2f2f] font-medium hover:underline">Sign up as a couple</Link>
        </p>
      </div>
    </div>
  )
}
