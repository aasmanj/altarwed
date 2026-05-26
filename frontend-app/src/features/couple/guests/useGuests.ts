import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/api/client'

export type RsvpStatus = 'PENDING' | 'ATTENDING' | 'DECLINING'
export type GuestSide = 'BRIDE' | 'GROOM' | 'BOTH'

export interface Guest {
  id: string
  coupleId: string
  name: string
  email: string | null
  phone: string | null
  rsvpStatus: RsvpStatus
  plusOneAllowed: boolean
  plusOneName: string | null
  dietaryRestrictions: string | null
  songRequest: string | null
  tableNumber: number | null
  side: GuestSide | null
  notes: string | null
  mailLine1: string | null
  mailCity: string | null
  mailState: string | null
  mailZip: string | null
  noteForCouple: string | null
  inviteSendCount: number | null
  inviteSentAt: string | null
  respondedAt: string | null
  partyId: string | null
  partyName: string | null
  partyContact: boolean | null
}

export interface CreateGuestPayload {
  name: string
  email?: string
  phone?: string
  plusOneAllowed: boolean
  side?: GuestSide
  dietaryRestrictions?: string
  notes?: string
  mailLine1?: string
  mailCity?: string
  mailState?: string
  mailZip?: string
  partyId?: string
  partyName?: string
  partyContact?: boolean
}

export interface CreatePartyPayload {
  partyName: string
  members: Omit<CreateGuestPayload, 'partyId' | 'partyName' | 'partyContact'>[]
}

export interface UpdateGuestPayload {
  name?: string
  email?: string
  phone?: string
  rsvpStatus?: RsvpStatus
  plusOneAllowed?: boolean
  plusOneName?: string
  dietaryRestrictions?: string
  songRequest?: string
  tableNumber?: number
  side?: GuestSide
  notes?: string
  mailLine1?: string
  mailCity?: string
  mailState?: string
  mailZip?: string
}

const key = (coupleId: string) => ['guests', coupleId]

export function useGuests(coupleId: string) {
  return useQuery<Guest[]>({
    queryKey: key(coupleId),
    queryFn: () => apiClient.get(`/api/v1/guests/couple/${coupleId}`).then(r => r.data),
  })
}

export function useAddGuest(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateGuestPayload) =>
      apiClient.post(`/api/v1/guests/couple/${coupleId}`, payload).then(r => r.data),
    onSuccess: (newGuest: Guest) =>
      qc.setQueryData<Guest[]>(key(coupleId), old => old ? [...old, newGuest] : [newGuest]),
  })
}

export function useUpdateGuest(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ guestId, payload }: { guestId: string; payload: UpdateGuestPayload }) =>
      apiClient.patch(`/api/v1/guests/couple/${coupleId}/${guestId}`, payload).then(r => r.data),
    onMutate: async ({ guestId, payload }) => {
      await qc.cancelQueries({ queryKey: key(coupleId) })
      const previous = qc.getQueryData<Guest[]>(key(coupleId))
      qc.setQueryData<Guest[]>(key(coupleId), old =>
        old?.map(g => g.id === guestId ? { ...g, ...payload } : g) ?? []
      )
      return { previous }
    },
    onSuccess: (updated: Guest) =>
      qc.setQueryData<Guest[]>(key(coupleId), old =>
        old?.map(g => g.id === updated.id ? updated : g) ?? []
      ),
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key(coupleId), ctx.previous)
    },
  })
}

// Dedicated hook for seating assignment. Uses PUT (not PATCH) so null
// unambiguously means "remove from table" — the general PATCH endpoint
// uses null-means-not-provided merge semantics and can't clear tableNumber.
export function useAssignGuestTable(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ guestId, tableNumber }: { guestId: string; tableNumber: number | null }) =>
      apiClient
        .put(`/api/v1/guests/couple/${coupleId}/${guestId}/table`, { tableNumber })
        .then(r => r.data as Guest),
    // Optimistic update so the chip moves instantly in the UI.
    onMutate: async ({ guestId, tableNumber }) => {
      await qc.cancelQueries({ queryKey: key(coupleId) })
      const previous = qc.getQueryData<Guest[]>(key(coupleId))
      qc.setQueryData<Guest[]>(key(coupleId), old =>
        old?.map(g => g.id === guestId ? { ...g, tableNumber } : g) ?? []
      )
      return { previous }
    },
    onSuccess: (updated: Guest) =>
      qc.setQueryData<Guest[]>(key(coupleId), old =>
        old?.map(g => g.id === updated.id ? updated : g) ?? []
      ),
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key(coupleId), ctx.previous)
    },
  })
}

export function useRemoveGuest(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (guestId: string) =>
      apiClient.delete(`/api/v1/guests/couple/${coupleId}/${guestId}`),
    onSuccess: (_data, guestId) =>
      qc.setQueryData<Guest[]>(key(coupleId), old => old?.filter(g => g.id !== guestId) ?? []),
  })
}

export function useSendInvite(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (guestId: string) =>
      apiClient.post(`/api/v1/guests/couple/${coupleId}/${guestId}/invite`).then(r => r.data),
    onSuccess: (updated: Guest) =>
      qc.setQueryData<Guest[]>(key(coupleId), old =>
        old?.map(g => g.id === updated.id ? updated : g) ?? []
      ),
  })
}

export function useBulkAddGuests(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (guests: CreateGuestPayload[]) =>
      apiClient.post(`/api/v1/guests/couple/${coupleId}/bulk`, { guests }).then(r => r.data),
    onSuccess: (newGuests: Guest[]) =>
      qc.setQueryData<Guest[]>(key(coupleId), old => old ? [...old, ...newGuests] : newGuests),
  })
}

export function useCreateParty(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreatePartyPayload) =>
      apiClient.post(`/api/v1/guests/couple/${coupleId}/party`, payload).then(r => r.data),
    onSuccess: (newGuests: Guest[]) =>
      qc.setQueryData<Guest[]>(key(coupleId), old => old ? [...old, ...newGuests] : newGuests),
  })
}

export function useSendAllInvites(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiClient.post(`/api/v1/guests/couple/${coupleId}/invite-all`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(coupleId) }),
  })
}
