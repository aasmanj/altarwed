import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { authApi } from '@/core/api/authApi'
import type { RegisterCouplePayload, RegisterVendorPayload } from '@/core/api/authApi'
import { setupAuthInterceptor } from '@/core/api/client'
import { identifyUser, resetAnalytics } from '@/core/analytics/analytics'

export type UserRole = 'COUPLE' | 'VENDOR'

interface AuthUser {
  id: string
  email: string
  role: UserRole
  partnerOneName: string | null
  partnerTwoName: string | null
  weddingDate: string | null
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (payload: RegisterCouplePayload) => Promise<void>
  registerVendor: (payload: RegisterVendorPayload) => Promise<void>
  logout: () => Promise<void>
  refreshAccessToken: () => Promise<string | null>
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

// The refresh token (7-day lifespan) is persisted in localStorage so that
// opening a new tab or clicking "Edit this website" from the public wedding
// page doesn't force a re-login. The short-lived access token (15 min) stays
// in memory only. localStorage is readable only on the same origin
// (app.altarwed.com), so there is no cross-site leakage.
const REFRESH_TOKEN_KEY = 'altarwed.rt'

function saveRefreshToken(token: string | null) {
  if (token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, token)
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Access token: memory only (short-lived, 15 min). Refresh token: seeded
  // from localStorage so silent re-auth works across new tabs and page loads.
  const [state, setState] = useState<AuthState>(() => ({
    user: null,
    accessToken: null,
    refreshToken: typeof window !== 'undefined' ? localStorage.getItem(REFRESH_TOKEN_KEY) : null,
  }))
  const refreshPromise = useRef<Promise<string | null> | null>(null)

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken, refreshToken, user } = await authApi.login(email, password)
    saveRefreshToken(refreshToken)
    setState({ user, accessToken, refreshToken })
  }, [])

  const register = useCallback(async (payload: RegisterCouplePayload) => {
    const { accessToken, refreshToken, user } = await authApi.register(payload)
    saveRefreshToken(refreshToken)
    setState({ user, accessToken, refreshToken })
  }, [])

  const registerVendor = useCallback(async (payload: RegisterVendorPayload) => {
    const { accessToken, refreshToken, user } = await authApi.registerVendor(payload)
    saveRefreshToken(refreshToken)
    setState({ user, accessToken, refreshToken })
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout(state.refreshToken).catch(() => {})
    saveRefreshToken(null)
    setState({ user: null, accessToken: null, refreshToken: null })
    // Unlink the analytics identity so the next person on a shared browser is a
    // fresh anonymous visitor, not a continuation of this couple's session.
    resetAnalytics()
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
        saveRefreshToken(refreshToken)
        setState({ user, accessToken, refreshToken })
        return accessToken
      })
      .catch(() => {
        saveRefreshToken(null)
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

  // Tie analytics events to the authenticated couple. Keyed on the user id so a
  // token refresh (new user object, same id) doesn't re-identify, and logout
  // (id goes undefined) is a no-op here, handled by resetAnalytics() in logout().
  useEffect(() => {
    if (state.user) identifyUser(state.user.id, { role: state.user.role })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.user?.id])

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      register,
      registerVendor,
      logout,
      refreshAccessToken,
      isAuthenticated: state.user !== null,
    }),
    [state, login, register, registerVendor, logout, refreshAccessToken],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
