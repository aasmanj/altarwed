import { apiClient } from './client'
import type { UserRole } from '@/core/auth/AuthContext'

interface AuthResponse {
  accessToken: string
  user: {
    id: string
    email: string
    role: UserRole
    name: string
  }
}

export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await apiClient.post<AuthResponse>('/api/v1/auth/login', { email, password })
    return data
  },

  refresh: async (): Promise<AuthResponse> => {
    const { data } = await apiClient.post<AuthResponse>('/api/v1/auth/refresh')
    return data
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/api/v1/auth/logout')
  },
}
