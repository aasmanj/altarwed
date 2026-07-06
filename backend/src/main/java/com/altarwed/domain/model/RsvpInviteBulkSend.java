package com.altarwed.domain.model;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Idempotency receipt for one bulk RSVP invite send (issue #295). Recorded once per
 * (coupleId, idempotencyKey) before the invites fan out, so a retry carrying the same
 * client-generated key replays this stored summary instead of re-emailing the batch.
 * Same shape and rationale as {@link SaveTheDateSend} (issue #232).
 *
 * Pure domain record: zero Spring/JPA imports (the dependency rule).
 */
public record RsvpInviteBulkSend(
        UUID id,
        UUID coupleId,
        String idempotencyKey,
        Integer sentCount,
        Integer skippedCount,
        LocalDateTime createdAt
) {}
