import axios from 'axios'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080',
  withCredentials: true,  // sends httpOnly refresh token cookie
  headers: { 'Content-Type': 'application/json' },
})

// Attach access token from memory on every request
apiClient.interceptors.request.use((config) => {
  // Access token is injected by the auth interceptor below (see setupAuthInterceptor)
  return config
})

let _getToken: (() => string | null) | null = null
let _refresh: (() => Promise<string | null>) | null = null

export function setupAuthInterceptor(
  getToken: () => string | null,
  refresh: () => Promise<string | null>,
) {
  _getToken = getToken
  _refresh = refresh
}

// Attach Bearer token; on 401 try one silent refresh then retry
apiClient.interceptors.request.use((config) => {
  const token = _getToken?.()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if ((error.response?.status === 401 || error.response?.status === 403) && !original._retry && _refresh) {
      original._retry = true
      const newToken = await _refresh()
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`
        return apiClient(original)
      }
    }
    return Promise.reject(error)
  },
)
