package com.altarwed.application.dto;

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
        List<Recipient> recipients
) {
    public record Recipient(
            UUID guestId,
            String lobPostcardId,
            String deliveryStatus,
            String errorMessage
    ) {}
}
