import { apiClient } from './client'
import type { UserRole } from '@/core/auth/AuthContext'
import type { Acquisition } from '@/core/analytics/utm'

// Shape the backend actually returns (refreshToken excluded from JSON via @JsonIgnore;
// it is set as an HttpOnly session cookie by the server on login/register/refresh).
interface BackendAuthResponse {
  accessToken: string
  tokenType: string
  userId: string
  email: string
  role: UserRole
  partnerOneName: string | null
  partnerTwoName: string | null
  weddingDate: string | null
  marketingConsent: boolean
}

// Shape AuthContext expects
export interface AuthResponse {
  accessToken: string
  user: {
    id: string
    email: string
    role: UserRole
    partnerOneName: string | null
    partnerTwoName: string | null
    weddingDate: string | null
    marketingConsent: boolean
  }
}

function mapResponse(data: BackendAuthResponse): AuthResponse {
  return {
    accessToken: data.accessToken,
    user: {
      id: data.userId,
      email: data.email,
      role: data.role ?? 'COUPLE',
      partnerOneName: data.partnerOneName ?? null,
      partnerTwoName: data.partnerTwoName ?? null,
      weddingDate: data.weddingDate ?? null,
      marketingConsent: data.marketingConsent ?? false,
    },
  }
}

export interface RegisterCouplePayload {
  partnerOneName: string
  partnerTwoName: string
  email: string
  password: string
  weddingDate?: string | null
  acquisition?: Acquisition | null
  marketingConsent?: boolean
}

export interface RegisterVendorPayload {
  businessName: string
  category: string
  city: string
  state: string
  email: string
  password: string
  isChristianOwned: boolean
  denominationIds?: string[]
}

export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await apiClient.post<BackendAuthResponse>('/api/v1/auth/login', { email, password })
    return mapResponse(data)
  },

  register: async (payload: RegisterCouplePayload): Promise<AuthResponse> => {
    const { data } = await apiClient.post<BackendAuthResponse>('/api/v1/couples/register', payload)
    return mapResponse(data)
  },

  registerVendor: async (payload: RegisterVendorPayload): Promise<AuthResponse> => {
    const { data } = await apiClient.post<BackendAuthResponse>('/api/v1/vendors/register', payload)
    return mapResponse(data)
  },

  // No body needed: the browser sends the HttpOnly session cookie automatically.
  refresh: async (): Promise<AuthResponse> => {
    const { data } = await apiClient.post<BackendAuthResponse>('/api/v1/auth/refresh', {})
    return mapResponse(data)
  },

  // No body needed: server reads the cookie and clears it in the response.
  logout: async (): Promise<void> => {
    await apiClient.post('/api/v1/auth/logout', {})
  },
}
