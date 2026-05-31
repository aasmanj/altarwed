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
        String idempotencyKey
) {
}
