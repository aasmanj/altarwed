import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
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
  // True when this guest's email is suppressed for this couple (a per-couple opt-out or
  // a global bounce/complaint) and excluded from sends. Reason is the source
  // (USER_REQUEST | BOUNCE | COMPLAINT) so the UI can word the badge. A guest resubscribes
  // by RSVPing on the wedding site; there is no couple-side resubscribe.
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
  // True when this is an idempotent replay of an earlier send (issue #232): the couple
  // retried the same attempt, so nothing was re-emailed and invalidEmails is empty.
  replayed?: boolean
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
  // Party / household. A non-blank name groups the guest (joining a same-named party or
  // starting one); an empty string clears it. Resolved to a partyId server-side.
  partyName?: string
}

const key = (coupleId: string) => ['guests', coupleId]

export function useGuests(coupleId: string) {
  return useQuery<Guest[]>({
    queryKey: key(coupleId),
    queryFn: () => apiClient.get(`/api/v1/guests/couple/${coupleId}`).then(r => r.data),
    // Override the app-wide 5-minute staleTime default (main.tsx). Unlike budget/checklist/
    // website data, guest RSVP status can change from outside this app entirely: a guest
    // submits their RSVP on the public Next.js wedding site with no auth (GuestService.
    // submitRsvp), which never touches this browser's cache. Treating this query as always
    // stale means every remount/window-refocus refetches, so the RSVP tally on the dashboard
    // (AtAGlanceCard) reflects guest activity that happened while the couple wasn't looking.
    staleTime: 0,
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
        old?.map(g => g.id === updated.id ? mergePreservingDelivery(g, updated) : g) ?? []
      ),
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key(coupleId), ctx.previous)
      toast.error('Could not save your guest change. Please try again.')
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
        old?.map(g => g.id === updated.id ? mergePreservingDelivery(g, updated) : g) ?? []
      ),
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key(coupleId), ctx.previous)
      toast.error('Could not update the seating assignment. Please try again.')
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

// Single-guest write endpoints (invite, edit, table) return the guest without the
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
