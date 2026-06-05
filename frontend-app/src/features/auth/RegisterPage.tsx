import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import confetti from 'canvas-confetti'
import { useAuth } from '@/core/auth/AuthContext'
import { captureEvent } from '@/core/analytics/analytics'
import { getStoredAcquisition, clearStoredAcquisition } from '@/core/analytics/utm'

export default function RegisterPage() {
  const { register, user } = useAuth()
  const navigate = useNavigate()

  // Per CLAUDE.md: partnerOne = Groom, partnerTwo = Bride.
  // We split first/last in the UI and concatenate on submit so the
  // backend column shape doesn't change in Phase 0.
  const [form, setForm] = useState({
    groomFirstName: '',
    groomLastName: '',
    brideFirstName: '',
    brideLastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    weddingDate: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) {
    navigate('/dashboard', { replace: true })
    return null
  }

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    const groomName = `${form.groomFirstName.trim()} ${form.groomLastName.trim()}`.trim()
    const brideName = `${form.brideFirstName.trim()} ${form.brideLastName.trim()}`.trim()
    if (!groomName || !brideName) {
      setError('Please enter both names.')
      return
    }

    setLoading(true)
    try {
      const acquisition = getStoredAcquisition()
      await register({
        partnerOneName: groomName,
        partnerTwoName: brideName,
        email: form.email.trim(),
        password: form.password,
        weddingDate: form.weddingDate || null,
        acquisition: acquisition ?? null,
      })
      // Funnel conversion event. The couple is identified by AuthContext's effect
      // the moment register() sets the user, so this capture is attached to the
      // right person. UTM props let PostHog break the funnel down by campaign;
      // they mirror what the backend just persisted on the couples row.
      captureEvent('signed_up', {
        has_wedding_date: !!form.weddingDate,
        utm_source: acquisition?.utmSource ?? null,
        utm_campaign: acquisition?.utmCampaign ?? null,
      })
      // One signup per stored attribution: clear it so a second account made on
      // this browser isn't credited to the same campaign.
      clearStoredAcquisition()
      // Celebrate the new account. canvas-confetti paints its own fixed canvas on
      // document.body, so the burst persists across the navigate() below and lands
      // the couple on their dashboard mid-celebration. Skip it for users who have
      // asked the OS to reduce motion (a11y).
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!reduceMotion) {
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.4 }, colors: ['#d4af6a', '#3b2f2f', '#f5ede0', '#22c55e'] })
      }
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      const msg = err?.response?.data?.message
      if (msg?.toLowerCase().includes('email')) {
        setError('An account with that email already exists.')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ivory px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-3xl font-bold text-brown">AltarWed</h1>
          <p className="mt-2 text-brown-light">Create your wedding account</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-8 shadow-sm border border-gold-light">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Bride fieldset rendered above Groom to match the display convention. */}
          <fieldset className="mb-5">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-brown-light">Bride</legend>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text" required placeholder="First name" autoComplete="off"
                value={form.brideFirstName} onChange={set('brideFirstName')}
                className="w-full rounded-lg border border-gold-light px-4 py-2.5 text-brown focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
              />
              <input
                type="text" required placeholder="Last name" autoComplete="off"
                value={form.brideLastName} onChange={set('brideLastName')}
                className="w-full rounded-lg border border-gold-light px-4 py-2.5 text-brown focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </div>
          </fieldset>
          <fieldset className="mb-5">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-brown-light">Groom</legend>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text" required placeholder="First name" autoComplete="off"
                value={form.groomFirstName} onChange={set('groomFirstName')}
                className="w-full rounded-lg border border-gold-light px-4 py-2.5 text-brown focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
              />
              <input
                type="text" required placeholder="Last name" autoComplete="off"
                value={form.groomLastName} onChange={set('groomLastName')}
                className="w-full rounded-lg border border-gold-light px-4 py-2.5 text-brown focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </div>
          </fieldset>

          <div className="mb-5">
            <label className="mb-1.5 block text-sm font-medium text-brown" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={set('email')}
              className="w-full rounded-lg border border-gold-light px-4 py-2.5 text-brown focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </div>

          <div className="mb-5">
            <label className="mb-1.5 block text-sm font-medium text-brown" htmlFor="weddingDate">
              Wedding date <span className="text-brown-light font-normal">(optional)</span>
            </label>
            <input
              id="weddingDate"
              type="date"
              value={form.weddingDate}
              onChange={set('weddingDate')}
              className="w-full rounded-lg border border-gold-light px-4 py-2.5 text-brown focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </div>

          <div className="mb-5">
            <label className="mb-1.5 block text-sm font-medium text-brown" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={form.password}
              onChange={set('password')}
              className="w-full rounded-lg border border-gold-light px-4 py-2.5 text-brown focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </div>

          <div className="mb-6">
            <label className="mb-1.5 block text-sm font-medium text-brown" htmlFor="confirmPassword">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
              className="w-full rounded-lg border border-gold-light px-4 py-2.5 text-brown focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gold py-2.5 font-semibold text-white hover:bg-gold-dark disabled:opacity-60 transition"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>

          <p className="mt-4 text-center text-sm text-brown-light">
            Already have an account?{' '}
            <Link to="/login" className="text-gold hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
