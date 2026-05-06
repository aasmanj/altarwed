import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/core/auth/AuthContext'

export default function RegisterPage() {
  const { register, user } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    partnerOneName: '',
    partnerTwoName: '',
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

    setLoading(true)
    try {
      await register({
        partnerOneName: form.partnerOneName.trim(),
        partnerTwoName: form.partnerTwoName.trim(),
        email: form.email.trim(),
        password: form.password,
        weddingDate: form.weddingDate || null,
      })
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

          <div className="mb-5 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brown" htmlFor="partnerOneName">
                Your name
              </label>
              <input
                id="partnerOneName"
                type="text"
                required
                autoComplete="given-name"
                value={form.partnerOneName}
                onChange={set('partnerOneName')}
                className="w-full rounded-lg border border-gold-light px-4 py-2.5 text-brown focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brown" htmlFor="partnerTwoName">
                Partner's name
              </label>
              <input
                id="partnerTwoName"
                type="text"
                required
                autoComplete="off"
                value={form.partnerTwoName}
                onChange={set('partnerTwoName')}
                className="w-full rounded-lg border border-gold-light px-4 py-2.5 text-brown focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </div>
          </div>

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
