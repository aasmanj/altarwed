package com.altarwed.domain.model;

import java.util.UUID;

public record PrintOrderRecipient(
        UUID id,
        UUID printOrderId,
        UUID guestId,
        String lobPostcardId,
        String deliveryStatus,
        String errorMessage
) {
}
