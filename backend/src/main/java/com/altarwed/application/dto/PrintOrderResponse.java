package com.altarwed.application.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record PrintOrderResponse(
        UUID id,
        UUID coupleId,
        String orderType,
        String status,
        String templateKey,
        Integer recipientCount,
        Integer costCents,
        String errorMessage,
        LocalDateTime createdAt,
        LocalDateTime submittedAt,
        List<Recipient> recipients,
        // Issue #59: what Stripe actually charged/refunded. Null on legacy pre-payment-gate orders.
        Integer amountChargedCents,
        Integer amountRefundedCents
) {
    public record Recipient(
            UUID guestId,
            String lobPostcardId,
            String deliveryStatus,
            String errorMessage,
            // Issue #59 UX: real USPS tracking (best-effort; null until the provider has it, and
            // for legacy orders). Linked to USPS's public tracker in the UI, not a delivery
            // guarantee -- USPS First-Class Mail does not offer one.
            String trackingNumber,
            LocalDate expectedDeliveryDate
    ) {}
}
