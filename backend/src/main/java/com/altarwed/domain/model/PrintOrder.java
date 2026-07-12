package com.altarwed.domain.model;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record PrintOrder(
        UUID id,
        UUID coupleId,
        PrintOrderType orderType,
        PrintOrderStatus status,
        String templateKey,
        Integer recipientCount,
        Integer costCents,
        String errorMessage,
        LocalDateTime createdAt,
        LocalDateTime submittedAt,
        List<PrintOrderRecipient> recipients,
        // Client-supplied dedup token. A repeat submit with the same key for the
        // same couple returns the original order instead of mailing again.
        // Nullable for legacy rows created before idempotency was added.
        String idempotencyKey,
        // Issue #59: Stripe payment tracking. Null for legacy pre-payment-gate orders.
        // stripePaymentIntentId is only populated once Checkout completes (the session id exists
        // from creation, the payment intent id only exists once the couple actually pays).
        String stripeCheckoutSessionId,
        String stripePaymentIntentId,
        Integer amountChargedCents,
        Integer amountRefundedCents,
        // Issue #53: the Lob submit batch runs asynchronously, triggered later by the payment
        // webhook -- a different invocation than the one that created the order -- so the
        // return-address block must be persisted rather than held only in-memory.
        String returnName,
        String returnAddressLine1,
        String returnAddressLine2,
        String returnCity,
        String returnState,
        String returnZip,
        // Printed-card shape/size the couple chose: LANDSCAPE_6X11 (default), PORTRAIT_6X9, or
        // PORTRAIT_5X7. Persisted because the Lob render runs asynchronously after payment (a
        // different invocation than the one that created the order). Null on legacy rows -> the
        // Lob adapter renders the original 6x11 landscape.
        String cardSize
) {
}
