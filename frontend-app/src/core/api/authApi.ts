import { apiClient } from './client'
import type { UserRole } from '@/core/auth/AuthContext'

// Shape the backend actually returns
interface BackendAuthResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  userId: string
  email: string
  role: UserRole
  partnerOneName: string | null
  partnerTwoName: string | null
}

// Shape AuthContext expects
export interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: {
    id: string
    email: string
    role: UserRole
    partnerOneName: string | null
    partnerTwoName: string | null
  }
}

function mapResponse(data: BackendAuthResponse): AuthResponse {
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: {
      id: data.userId,
      email: data.email,
      role: data.role ?? 'COUPLE',
      partnerOneName: data.partnerOneName ?? null,
      partnerTwoName: data.partnerTwoName ?? null,
    },
  }
}

export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await apiClient.post<BackendAuthResponse>('/api/v1/auth/login', { email, password })
    return mapResponse(data)
  },

  refresh: async (refreshToken: string): Promise<AuthResponse> => {
    const { data } = await apiClient.post<BackendAuthResponse>('/api/v1/auth/refresh', { refreshToken })
    return mapResponse(data)
  },

  logout: async (refreshToken: string | null): Promise<void> => {
    if (refreshToken) await apiClient.post('/api/v1/auth/logout', { refreshToken })
  },
}
