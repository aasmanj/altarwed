import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/api/client'

export interface GoogleOAuthStatus {
  connected: boolean
  googleEmail: string | null
}

export interface GoogleSheetSyncStatus {
  id: string
  coupleId: string
  sheetUrl: string
  lastSynced: string | null
  lastError: string | null
  rowCount: number | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// -----------------------------------------------------------------------
// Hooks
// -----------------------------------------------------------------------

export function useGoogleSheetSync(coupleId: string) {
  return useQuery<GoogleSheetSyncStatus | null>({
    queryKey: ['googleSheetSync', coupleId],
    queryFn: async () => {
      const res = await apiClient.get(`/api/v1/google-sheet-sync/couple/${coupleId}`)
      return res.data
    },
    enabled: !!coupleId,
    staleTime: 30_000,
    // 404 means "not configured", return null instead of throwing
    retry: (_, err: any) => err?.response?.status !== 404,
    select: (data) => data ?? null,
  })
}

export function useSetGoogleSheetSync(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sheetUrl: string) =>
      apiClient.put(`/api/v1/google-sheet-sync/couple/${coupleId}`, { sheetUrl }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['googleSheetSync', coupleId] }),
  })
}

export function useDeleteGoogleSheetSync(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.delete(`/api/v1/google-sheet-sync/couple/${coupleId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['googleSheetSync', coupleId] }),
  })
}

// Backend now returns { sync, added, updated } so the dashboard can
// display "Synced: X added, Y updated" in a toast.
export interface TriggerSyncResult {
  sync: GoogleSheetSyncStatus
  added: number | null
  updated: number | null
}

export function useTriggerGoogleSheetSync(coupleId: string) {
  const qc = useQueryClient()
  return useMutation<TriggerSyncResult>({
    mutationFn: () =>
      apiClient.post(`/api/v1/google-sheet-sync/couple/${coupleId}/trigger`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['googleSheetSync', coupleId] })
      qc.invalidateQueries({ queryKey: ['guests', coupleId] })
    },
  })
}

export function useGoogleOAuthStatus(coupleId: string) {
  return useQuery<GoogleOAuthStatus>({
    queryKey: ['google-oauth-status', coupleId],
    queryFn: () => apiClient.get('/api/v1/integrations/google-sheets/status').then(r => r.data),
    enabled: !!coupleId,
  })
}

export function useGoogleDisconnect(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.delete('/api/v1/integrations/google-sheets'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['google-oauth-status', coupleId] }),
  })
}

// Fetched on demand (when the couple clicks "Choose Google Sheet"), not as a
// standing query: the access token it returns is short-lived, so we want a fresh
// one at the moment the Picker opens rather than a cached one.
export interface PickerConfigResponse {
  accessToken: string
  apiKey: string
  appId: string
  configured: boolean
}

export async function fetchPickerConfig(): Promise<PickerConfigResponse> {
  const res = await apiClient.get('/api/v1/integrations/google-sheets/picker-config')
  return res.data
}

// -----------------------------------------------------------------------
// Utility: human-readable relative time
// -----------------------------------------------------------------------
export function relativeTime(isoString: string | null): string {
  if (!isoString) return 'Never'
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
