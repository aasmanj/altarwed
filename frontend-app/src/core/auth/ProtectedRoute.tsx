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
  if (role && user?.role !== role) return <Navigate to="/login" replace />

  return <>{children}</>
}
