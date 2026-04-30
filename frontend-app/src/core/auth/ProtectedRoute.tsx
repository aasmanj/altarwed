import { type ReactNode, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth, type UserRole } from './AuthContext'

interface Props {
  children: ReactNode
  role?: UserRole
}

export function ProtectedRoute({ children, role }: Props) {
  const { isAuthenticated, user, refreshAccessToken } = useAuth()
  const [checking, setChecking] = useState(!isAuthenticated)

  useEffect(() => {
    if (!isAuthenticated) {
      refreshAccessToken().finally(() => setChecking(false))
    }
  }, [isAuthenticated, refreshAccessToken])

  if (checking) {
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
