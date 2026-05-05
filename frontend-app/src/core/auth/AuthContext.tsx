import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { authApi } from '@/core/api/authApi'
import { setupAuthInterceptor } from '@/core/api/client'

export type UserRole = 'COUPLE' | 'VENDOR'

interface AuthUser {
  id: string
  email: string
  role: UserRole
  partnerOneName: string | null
  partnerTwoName: string | null
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
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
  const [state, setState] = useState<AuthState>({ user: null, accessToken: null, refreshToken: null })
  const refreshPromise = useRef<Promise<string | null> | null>(null)

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken, refreshToken, user } = await authApi.login(email, password)
    setState({ user, accessToken, refreshToken })
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout(state.refreshToken).catch(() => {})
    setState({ user: null, accessToken: null, refreshToken: null })
  }, [state.refreshToken])

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    // Deduplicate concurrent refresh calls
    if (refreshPromise.current) return refreshPromise.current

    const currentRefreshToken = state.refreshToken
    if (!currentRefreshToken) {
      setState({ user: null, accessToken: null, refreshToken: null })
      return null
    }

    refreshPromise.current = authApi
      .refresh(currentRefreshToken)
      .then(({ accessToken, refreshToken, user }) => {
        setState({ user, accessToken, refreshToken })
        return accessToken
      })
      .catch(() => {
        setState({ user: null, accessToken: null, refreshToken: null })
        return null
      })
      .finally(() => {
        refreshPromise.current = null
      })

    return refreshPromise.current
  }, [state.refreshToken])

  // Wire the axios interceptor so every request gets the current token,
  // and 401/403 responses trigger a silent refresh via the httpOnly cookie.
  useEffect(() => {
    setupAuthInterceptor(
      () => state.accessToken,
      refreshAccessToken,
    )
  }, [state.accessToken, refreshAccessToken])

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
