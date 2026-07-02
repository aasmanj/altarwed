import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/core/auth/AuthContext'
import { useConfirm } from '@/components/ConfirmDialog'
import { apiClient } from '@/core/api/client'

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [deleting, setDeleting] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  // Password changes reuse the existing forgot-password flow: we email the
  // signed-in couple a one-time reset link instead of accepting a new password
  // directly here. That keeps a single, already-hardened code path (rate limited,
  // token hashed server-side) and needs no new backend endpoint.
  async function handleSendPasswordReset() {
    if (!user) return
    setSendingReset(true)
    try {
      await apiClient.post('/api/v1/auth/forgot-password', { email: user.email })
      setResetSent(true)
      toast.success('A password reset link has been sent to your email.')
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 429) {
        toast.error('Too many attempts. Please wait a minute and try again.')
      } else {
        toast.error('Something went wrong. Please try again or email hello@altarwed.com.')
      }
    } finally {
      setSendingReset(false)
    }
  }

  async function handleDeleteAccount() {
    const confirmed = await confirm({
      title: 'Delete your account?',
      message:
        'This permanently deletes your wedding website, guest list, photos, and all other data. There is no undo.',
      confirmLabel: 'Yes, delete everything',
      cancelLabel: 'Cancel',
      tone: 'danger',
    })
    if (!confirmed) return

    if (!user) return
    setDeleting(true)
    try {
      await apiClient.delete(`/api/v1/couples/${user.id}`)
      await logout()
      // Navigate to the public site. Falls back to the login page if the
      // browser blocks cross-origin navigation (e.g. PWA or iframe context).
      try {
        window.location.href = 'https://www.altarwed.com'
      } catch {
        navigate('/login')
      }
    } catch {
      toast.error('Something went wrong. Please try again or email hello@altarwed.com.')
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-ivory">
      <header className="border-b border-gold-light bg-white px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-4">
        <Link
          to="/dashboard"
          className="text-sm font-medium text-brown-light hover:text-brown transition"
        >
          &larr; Dashboard
        </Link>
        <span className="font-serif text-xl font-bold text-brown">Settings</span>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        {/* Account info */}
        <section className="bg-white rounded-2xl border border-gold-light p-6 space-y-3">
          <h2 className="font-serif text-lg font-semibold text-brown">Account</h2>
          <div className="text-sm text-brown-light space-y-1">
            <p><span className="font-medium text-brown">Email:</span> {user?.email}</p>
            {user?.partnerOneName && (
              <p><span className="font-medium text-brown">Groom:</span> {user.partnerOneName}</p>
            )}
            {user?.partnerTwoName && (
              <p><span className="font-medium text-brown">Bride:</span> {user.partnerTwoName}</p>
            )}
          </div>
        </section>

        {/* Password */}
        <section className="bg-white rounded-2xl border border-gold-light p-6 space-y-4">
          <h2 className="font-serif text-lg font-semibold text-brown">Password</h2>
          <p className="text-sm text-brown-light">
            We will email a secure reset link to{' '}
            <span className="font-medium text-brown">{user?.email}</span> so you can set a new
            password. The link expires after a short while.
          </p>
          {resetSent && (
            <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
              A password reset link has been sent to your email. Open it to choose a new password.
            </div>
          )}
          <button
            onClick={handleSendPasswordReset}
            disabled={sendingReset}
            className="px-4 py-2 rounded-lg bg-gold text-brown text-sm font-medium hover:bg-gold-dark disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {sendingReset
              ? 'Sending...'
              : resetSent
                ? 'Resend reset email'
                : 'Send password reset email'}
          </button>
        </section>

        {/* Danger zone */}
        <section className="bg-white rounded-2xl border border-red-200 p-6 space-y-4">
          <h2 className="font-serif text-lg font-semibold text-red-700">Danger zone</h2>
          <p className="text-sm text-brown-light">
            Deleting your account is permanent and cannot be undone. Your wedding website,
            guest list, photos, and all associated data will be removed immediately.
          </p>
          <button
            onClick={handleDeleteAccount}
            disabled={deleting}
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {deleting ? 'Deleting...' : 'Delete account'}
          </button>
        </section>
      </main>
    </div>
  )
}
