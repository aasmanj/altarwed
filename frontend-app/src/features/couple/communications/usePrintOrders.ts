import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/api/client'

export type PrintOrderType = 'SAVE_THE_DATE' | 'INVITATION'
export type PrintOrderStatus = 'DRAFT' | 'SUBMITTED' | 'PARTIAL_FAILURE' | 'FAILED' | 'MAILED'

export interface PrintOrderRecipient {
  guestId: string
  lobPostcardId: string | null
  deliveryStatus: string | null
  errorMessage: string | null
}

export interface PrintOrder {
  id: string
  coupleId: string
  orderType: PrintOrderType
  status: PrintOrderStatus
  templateKey: string
  recipientCount: number
  costCents: number
  errorMessage: string | null
  createdAt: string
  submittedAt: string | null
  recipients: PrintOrderRecipient[]
}

export interface CreatePrintOrderPayload {
  orderType: PrintOrderType
  templateKey: string
  guestIds: string[]
  returnName: string
  returnAddressLine1: string
  returnAddressLine2?: string
  returnCity: string
  returnState: string
  returnZip: string
  // Per-submit dedup token. The backend returns the original order if it sees
  // the same key again, so a retry can never mail/charge the batch twice.
  idempotencyKey: string
}

const key = (coupleId: string) => ['print-orders', coupleId]

export function usePrintOrders(coupleId: string) {
  return useQuery<PrintOrder[]>({
    queryKey: key(coupleId),
    queryFn: () => apiClient.get(`/api/v1/print-orders/couple/${coupleId}`).then(r => r.data),
    enabled: !!coupleId,
  })
}

export function useCreatePrintOrder(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreatePrintOrderPayload) =>
      apiClient.post(`/api/v1/print-orders/couple/${coupleId}`, payload).then(r => r.data as PrintOrder),
    onSuccess: order => {
      qc.setQueryData<PrintOrder[]>(key(coupleId), old => old ? [order, ...old] : [order])
    },
  })
}

// Poll the mail provider for the latest per-recipient delivery status of one order, then splice
// the refreshed order back into the cached list so the UI updates in place.
export function useRefreshPrintOrderStatus(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderId: string) =>
      apiClient
        .post(`/api/v1/print-orders/couple/${coupleId}/${orderId}/refresh-status`)
        .then(r => r.data as PrintOrder),
    onSuccess: updated => {
      qc.setQueryData<PrintOrder[]>(key(coupleId), old =>
        old ? old.map(o => (o.id === updated.id ? updated : o)) : old)
    },
  })
}
