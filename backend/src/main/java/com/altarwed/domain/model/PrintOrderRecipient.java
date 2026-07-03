package com.altarwed.domain.model;

import java.time.LocalDate;
import java.util.UUID;

public record PrintOrderRecipient(
        UUID id,
        UUID printOrderId,
        UUID guestId,
        String lobPostcardId,
        String deliveryStatus,
        String errorMessage,
        // Issue #59 UX: real USPS tracking, populated once Lob/USPS surfaces it (best-effort,
        // may stay null for the life of the recipient if never scanned/exposed).
        String trackingNumber,
        LocalDate expectedDeliveryDate
) {
}
