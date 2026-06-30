import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth, type UserRole } from './AuthContext'

interface Props {
  children: ReactNode
  role?: UserRole
}

export function ProtectedRoute({ children, role }: Props) {
  const { isAuthenticated, user, isBootstrapping } = useAuth()

  // Wait for the one-time bootstrap refresh (AuthProvider) to finish before
  // deciding. This is what lets a returning user (new/reopened tab, refresh)
  // land on their dashboard instead of being bounced to /login.
  if (isBootstrapping) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />
  // Role mismatch on an authenticated user (e.g. a logged-in vendor following a
  // couple-only link). Send them to their own dashboard instead of /login, which
  // would wrongly imply they are signed out. Route paths mirror App.tsx: couples
  // live under /dashboard, vendors under /vendor.
  if (role && user?.role !== role) {
    const dashboardPath = user?.role === 'VENDOR' ? '/vendor' : '/dashboard'
    return <Navigate to={dashboardPath} replace />
  }

  return <>{children}</>
}
