import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { isAdminEmail } from './admin'

// Client-side gate for founder-only routes (currently /admin/metrics). It is
// meant to nest inside <ProtectedRoute>, which already resolves the one-time
// bootstrap refresh and the authenticated check, so by the time AdminRoute
// renders the user is signed in. A logged-in non-admin is redirected to their
// dashboard and never sees the founder shell (or fires its metrics query).
//
// The real security boundary is the server-side ADMIN_EMAILS whitelist, which
// 403s any non-admin request. This guard is defense-in-depth and a UX nicety:
// it stops regular couples and vendors from reaching an empty 403 shell.
export function AdminRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (!isAdminEmail(user?.email)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
