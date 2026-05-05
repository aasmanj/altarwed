import { useState } from 'react'
import { apiClient } from '@/core/api/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await apiClient.post('/api/v1/auth/forgot-password', { email })
      setSubmitted(true)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 429) {
        setError('Too many attempts. Please wait a minute and try again.')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ivory px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-3xl font-bold text-brown">AltarWed</h1>
          <p className="mt-2 text-brown-light">Reset your password</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm border border-gold-light">
          {submitted ? (
            <div className="text-center space-y-3">
              <p className="text-brown font-medium">Check your email</p>
              <p className="text-sm text-brown-light">
                If an account exists for <strong>{email}</strong>, you'll receive a password reset link shortly.
              </p>
              <a href="/login" className="mt-4 inline-block text-sm text-gold hover:underline">
                Back to sign in
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && (
                <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <p className="mb-5 text-sm text-brown-light">
                Enter your email and we'll send you a link to reset your password.
              </p>

              <div className="mb-6">
                <label className="mb-1.5 block text-sm font-medium text-brown" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gold-light px-4 py-2.5 text-brown focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-gold py-2.5 font-semibold text-white hover:bg-gold-dark disabled:opacity-60 transition"
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>

              <div className="mt-4 text-center">
                <a href="/login" className="text-sm text-gold hover:underline">
                  Back to sign in
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
