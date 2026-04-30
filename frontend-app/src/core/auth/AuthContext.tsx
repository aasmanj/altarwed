import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { authApi } from '@/core/api/authApi'

export type UserRole = 'COUPLE' | 'VENDOR'

interface AuthUser {
  id: string
  email: string
  role: UserRole
  name: string
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshAccessToken: () => Promise<string | null>
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // Access token stored in memory only — never localStorage (XSS risk)
  const [state, setState] = useState<AuthState>({ user: null, accessToken: null })
  const refreshPromise = useRef<Promise<string | null> | null>(null)

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken, user } = await authApi.login(email, password)
    // Refresh token is set as httpOnly cookie by the backend — we never touch it
    setState({ user, accessToken })
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {})
    setState({ user: null, accessToken: null })
  }, [])

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    // Deduplicate concurrent refresh calls
    if (refreshPromise.current) return refreshPromise.current

    refreshPromise.current = authApi
      .refresh()
      .then(({ accessToken, user }) => {
        setState({ user, accessToken })
        return accessToken
      })
      .catch(() => {
        setState({ user: null, accessToken: null })
        return null
      })
      .finally(() => {
        refreshPromise.current = null
      })

    return refreshPromise.current
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      logout,
      refreshAccessToken,
      isAuthenticated: state.user !== null,
    }),
    [state, login, logout, refreshAccessToken],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
