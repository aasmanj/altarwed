package com.altarwed.domain.model.email;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A durable send-intent row in the email_outbox table: the transactional outbox
 * pattern. Instead of firing an email on a fire-and-forget async thread (which a
 * restart or crash silently drops), the business operation enqueues one of these
 * rows in its own transaction. A scheduled sender later drains PENDING rows,
 * calls the EmailPort, and marks each SENT, retrying with backoff and giving up
 * to FAILED after a bounded number of attempts.
 *
 * payload is the JSON form of the matching {@link OutboxPayloads} record for
 * {@code type}; the sender rehydrates it to reconstruct the original EmailPort call.
 * recipient is a low-cardinality single address for observability/queryability and
 * is null for batch sends (which fan out many recipients from the payload).
 */
public record EmailOutboxEntry(
        UUID id,
        EmailType type,
        String recipient,
        String payload,
        OutboxStatus status,
        int attempts,
        LocalDateTime nextAttemptAt,
        LocalDateTime createdAt,
        LocalDateTime sentAt,
        String lastError
) {

    /**
     * Builds a fresh PENDING entry ready to enqueue. next_attempt_at is now so the
     * next sender poll picks it up immediately; attempts starts at 0.
     */
    public static EmailOutboxEntry pending(EmailType type, String recipient, String payload) {
        LocalDateTime now = LocalDateTime.now();
        return new EmailOutboxEntry(
                UUID.randomUUID(), type, recipient, payload,
                OutboxStatus.PENDING, 0, now, now, null, null);
    }
}
