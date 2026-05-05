import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiClient } from '@/core/api/client'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ivory px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm border border-gold-light text-center space-y-3">
          <p className="text-brown font-medium">Invalid reset link</p>
          <p className="text-sm text-brown-light">This link is missing a token. Request a new one.</p>
          <a href="/forgot-password" className="inline-block text-sm text-gold hover:underline">
            Request new link
          </a>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    try {
      await apiClient.post('/api/v1/auth/reset-password', { token, newPassword: password })
      setDone(true)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 400) {
        setError('This reset link has expired or already been used. Please request a new one.')
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
          <p className="mt-2 text-brown-light">Choose a new password</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm border border-gold-light">
          {done ? (
            <div className="text-center space-y-3">
              <p className="text-brown font-medium">Password updated</p>
              <p className="text-sm text-brown-light">You can now sign in with your new password.</p>
              <a href="/login" className="inline-block mt-2 text-sm text-gold hover:underline">
                Sign in
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && (
                <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="mb-5">
                <label className="mb-1.5 block text-sm font-medium text-brown" htmlFor="password">
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gold-light px-4 py-2.5 text-brown focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                />
              </div>

              <div className="mb-6">
                <label className="mb-1.5 block text-sm font-medium text-brown" htmlFor="confirm">
                  Confirm new password
                </label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-lg border border-gold-light px-4 py-2.5 text-brown focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-gold py-2.5 font-semibold text-white hover:bg-gold-dark disabled:opacity-60 transition"
              >
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
