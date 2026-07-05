import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { authApi } from '@/core/api/authApi'
import type { RegisterCouplePayload, RegisterVendorPayload } from '@/core/api/authApi'
import { setupAuthInterceptor } from '@/core/api/client'
import { identifyUser, initAnalytics, disableAnalytics } from '@/core/analytics/analytics'

export type UserRole = 'COUPLE' | 'VENDOR'

interface AuthUser {
  id: string
  email: string
  role: UserRole
  partnerOneName: string | null
  partnerTwoName: string | null
  weddingDate: string | null
  marketingConsent: boolean
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  // Returns the created couple so the caller can gate/boot analytics on the
  // freshly persisted marketingConsent flag without waiting for a re-render.
  register: (payload: RegisterCouplePayload) => Promise<{ user: AuthUser }>
  registerVendor: (payload: RegisterVendorPayload) => Promise<void>
  logout: () => Promise<void>
  refreshAccessToken: () => Promise<string | null>
  isAuthenticated: boolean
  // True while the one-time silent refresh on app load is in flight. Protected
  // routes wait on this so a stored session is restored before we decide whether
  // to bounce the user to /login.
  isBootstrapping: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Non-credential hint: tells the app whether to attempt a silent bootstrap refresh
// on mount. The actual credential is the HttpOnly session cookie managed by the browser
// (invisible to JS). This hint avoids an unnecessary network round-trip for users who
// have never logged in or have explicitly logged out.
//
// On browser close the session cookie is cleared but this hint may remain. The next
// mount will attempt bootstrap, get a 401 (no cookie), clear the hint, and show login.
const SESSION_HINT_KEY = 'altarwed.sh'

export function AuthProvider({ children }: { children: ReactNode }) {
  // Access token lives in memory only (short-lived, 15 min). Refresh token lives in
  // the browser's HttpOnly session cookie -- JS never sees it.
  const [state, setState] = useState<AuthState>({ user: null, accessToken: null })
  const refreshPromise = useRef<Promise<string | null> | null>(null)

  // Bootstrap: attempt a silent refresh if our session hint says we were logged in.
  // Starts true only when the hint is present so logged-out visitors skip the spinner.
  const [bootstrapping, setBootstrapping] = useState<boolean>(
    () => typeof window !== 'undefined' && localStorage.getItem(SESSION_HINT_KEY) === '1',
  )
  const bootstrapped = useRef(false)

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken, user } = await authApi.login(email, password)
    localStorage.setItem(SESSION_HINT_KEY, '1')
    setState({ user, accessToken })
  }, [])

  const register = useCallback(async (payload: RegisterCouplePayload) => {
    const { accessToken, user } = await authApi.register(payload)
    localStorage.setItem(SESSION_HINT_KEY, '1')
    setState({ user, accessToken })
    return { user }
  }, [])

  const registerVendor = useCallback(async (payload: RegisterVendorPayload) => {
    const { accessToken, user } = await authApi.registerVendor(payload)
    localStorage.setItem(SESSION_HINT_KEY, '1')
    setState({ user, accessToken })
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {})
    localStorage.removeItem(SESSION_HINT_KEY)
    setState({ user: null, accessToken: null })
    // Turn analytics off entirely so the next person on a shared browser sends
    // nothing until they themselves consent, and starts as a fresh, unlinked
    // anonymous visitor rather than a continuation of this couple's session.
    disableAnalytics()
  }, [])

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    // Deduplicate concurrent refresh calls
    if (refreshPromise.current) return refreshPromise.current

    refreshPromise.current = authApi
      .refresh()
      .then(({ accessToken, user }) => {
        localStorage.setItem(SESSION_HINT_KEY, '1')
        setState({ user, accessToken })
        return accessToken
      })
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status
        // Only destroy the stored session when the server authoritatively rejects
        // the token (expired/revoked/malformed). A network blip or a 5xx is
        // transient -- keep the hint so the next reload can retry instead of
        // forcing a full re-login. Without this, a momentary outage on bootstrap
        // would silently log a returning couple out.
        const authoritativeReject = status === 400 || status === 401 || status === 403
        if (authoritativeReject) {
          localStorage.removeItem(SESSION_HINT_KEY)
          setState({ user: null, accessToken: null })
        }
        return null
      })
      .finally(() => {
        refreshPromise.current = null
      })

    return refreshPromise.current
  }, [])

  // Wire the axios interceptor so every request gets the current token,
  // and 401/403 responses trigger a silent refresh via the HttpOnly cookie.
  useEffect(() => {
    setupAuthInterceptor(
      () => state.accessToken,
      refreshAccessToken,
    )
  }, [state.accessToken, refreshAccessToken])

  // One-time silent refresh on mount to rehydrate a persisted session. The ref
  // guard makes this run exactly once even under React StrictMode's double-invoke,
  // and refreshAccessToken is itself single-flight, so a rotated refresh token is
  // never spent twice.
  //
  // We only attempt the network call when the session hint is present (bootstrapping=true).
  // No hint means the user is definitely logged out; skip the call entirely.
  useEffect(() => {
    if (bootstrapped.current) return
    bootstrapped.current = true
    if (bootstrapping) {
      refreshAccessToken().finally(() => setBootstrapping(false))
    } else {
      setBootstrapping(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Gate analytics on the couple's explicit marketing consent (captured at
  // registration). Only couples who opted in get PostHog loaded and identified.
  // Vendors and couples who declined get zero telemetry in the app.
  useEffect(() => {
    if (state.user?.marketingConsent) {
      initAnalytics()
      identifyUser(state.user.id, { role: state.user.role })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.user?.id, state.user?.marketingConsent])

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      register,
      registerVendor,
      logout,
      refreshAccessToken,
      isAuthenticated: state.user !== null,
      isBootstrapping: bootstrapping,
    }),
    [state, login, register, registerVendor, logout, refreshAccessToken, bootstrapping],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
