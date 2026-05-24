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
        List<PrintOrderRecipient> recipients
) {
}
