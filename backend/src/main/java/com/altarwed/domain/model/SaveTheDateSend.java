package com.altarwed.domain.model;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Idempotency receipt for one save-the-date batch send (issue #232). Recorded once per
 * (coupleId, idempotencyKey) before the emails fan out, so a retry carrying the same
 * client-generated key replays this stored summary instead of re-emailing the batch.
 *
 * Pure domain record: zero Spring/JPA imports (the dependency rule).
 */
public record SaveTheDateSend(
        UUID id,
        UUID coupleId,
        String idempotencyKey,
        Integer queuedCount,
        Integer invalidCount,
        Integer suppressedCount,
        LocalDateTime createdAt
) {}
