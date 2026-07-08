import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/api/client'

export type PrintOrderType = 'SAVE_THE_DATE' | 'INVITATION'
// Printed-card shape/size the couple can choose. LANDSCAPE_6X11 is the original default; the two
// PORTRAIT options are the fiancee-requested upright cards. Kept in sync with the backend
// card_size CHECK constraint (V89) and the Lob adapter's dimsFor().
export type CardSize = 'LANDSCAPE_6X11' | 'PORTRAIT_6X9' | 'PORTRAIT_5X7'
// PENDING_PAYMENT/PROCESSING are new (issue #59/#53): the order is created before the couple
// pays, then the Lob batch runs asynchronously once Stripe confirms the charge. DRAFT is legacy
// (pre-payment-gate orders only, kept so old rows still render).
export type PrintOrderStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'PROCESSING'
  | 'SUBMITTED'
  | 'PARTIAL_FAILURE'
  | 'FAILED'
  | 'MAILED'

export interface PrintOrderRecipient {
  guestId: string
  lobPostcardId: string | null
  deliveryStatus: string | null
  errorMessage: string | null
  // Real USPS tracking data (issue #59), best-effort: null until the provider has it, and
  // always null for legacy orders. Not a delivery guarantee -- USPS First-Class Mail doesn't
  // offer one -- just what Lob/USPS have reported so far.
  trackingNumber: string | null
  expectedDeliveryDate: string | null
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
  amountChargedCents: number | null
  amountRefundedCents: number | null
  cardSize: CardSize | null
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
  // Printed-card shape/size. Omitted/null renders the original 6x11 landscape.
  cardSize: CardSize
}

export interface ExcludedGuest {
  guestId: string
  guestName: string | null
  reason: string
}

// Issue #59: creating an order no longer immediately mails anything. It returns a Stripe
// Checkout URL the couple must complete first, plus non-blocking warnings (duplicate
// addresses) and the guests excluded before any charge (bad address, ownership mismatch).
export interface CreatePrintOrderResult {
  order: PrintOrder
  checkoutUrl: string | null
  warnings: string[]
  excludedGuests: ExcludedGuest[]
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
      apiClient
        .post(`/api/v1/print-orders/couple/${coupleId}`, payload)
        .then(r => r.data as CreatePrintOrderResult),
    onSuccess: result => {
      qc.setQueryData<PrintOrder[]>(key(coupleId), old =>
        old ? [result.order, ...old] : [result.order])
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
