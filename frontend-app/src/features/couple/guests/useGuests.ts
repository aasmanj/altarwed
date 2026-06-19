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
  mailCountry: string | null
  noteForCouple: string | null
  inviteSendCount: number | null
  inviteSentAt: string | null
  saveTheDateSentAt: string | null
  respondedAt: string | null
  partyId: string | null
  partyName: string | null
  partyContact: boolean | null
  // Latest Resend delivery outcome per email type (from the delivery webhook):
  // DELIVERED / BOUNCED / COMPLAINED / DELAYED / SENT, or null if no event yet.
  // Distinct from the *SentAt stamps, which only mean "we attempted the send".
  saveTheDateDeliveryStatus: string | null
  inviteDeliveryStatus: string | null
  // True when this guest's email is unsubscribed and excluded from marketing sends.
  // Reason is the suppression source (USER_REQUEST | BOUNCE | COMPLAINT) so the UI can
  // word the badge and decide whether to offer a one-click resubscribe.
  emailUnsubscribed: boolean | null
  emailUnsubscribedReason: string | null
}

// Synchronous result of a save-the-date send: what was queued vs skipped, plus the
// exact malformed addresses the couple must fix before they will send.
export interface SaveTheDateSendResult {
  queued: number
  invalidCount: number
  suppressedCount: number
  invalidEmails: { guestId: string; name: string; email: string }[]
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
  mailCountry?: string
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
  mailCountry?: string
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
// unambiguously means "remove from table", the general PATCH endpoint
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
        old?.map(g => g.id === updated.id ? mergePreservingDelivery(g, updated) : g) ?? []
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

// Reverses an email unsubscribe for one guest (the couple confirms the guest asked).
// The server returns the guest with emailUnsubscribed cleared, so we update the cached
// row and the "Unsubscribed" badge disappears without a full refetch.
export function useResubscribeGuest(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (guestId: string) =>
      apiClient.post(`/api/v1/guests/couple/${coupleId}/${guestId}/resubscribe`).then(r => r.data as Guest),
    onSuccess: (updated: Guest) =>
      qc.setQueryData<Guest[]>(key(coupleId), old =>
        old?.map(g => g.id === updated.id ? mergePreservingDelivery(g, updated) : g) ?? []
      ),
  })
}

// Single-guest write endpoints (invite, resubscribe) return the guest without the
// delivery-status rollup (that is computed only on the list endpoint), so a naive
// replace would null out saveTheDateDeliveryStatus/inviteDeliveryStatus and wipe the
// Delivered/Bounced badge on the Save-the-Dates page, which reads the same cache.
// Keep the prior delivery fields; everything else comes from the authoritative response.
function mergePreservingDelivery(prev: Guest, updated: Guest): Guest {
  return {
    ...updated,
    saveTheDateDeliveryStatus: prev.saveTheDateDeliveryStatus,
    inviteDeliveryStatus: prev.inviteDeliveryStatus,
  }
}
